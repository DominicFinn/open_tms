/**
 * EDI 820 (Payment Order/Remittance Advice) routes.
 *
 * Inbound: customer sends 820 to tell us what they paid and which invoices.
 * The route parses the 820, matches invoice numbers, and auto-records payments.
 */

import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { container, TOKENS } from '../di/index.js';
import { EDI820ParseService } from '../services/EDI820ParseService.js';
import { ICommandBus } from '../commands/CommandBus.js';
import { RECORD_PAYMENT, RecordPaymentPayload } from '../commands/invoices/RecordPaymentCommand.js';
import { PrismaClient } from '@prisma/client';

interface PaymentResult {
  invoiceNumber: string;
  invoiceId: string | null;
  amountCents: number;
  status: 'applied' | 'not_found' | 'already_paid' | 'error';
  message: string;
}

export async function edi820Routes(server: FastifyInstance) {
  const commandBus = container.resolve<ICommandBus>(TOKENS.ICommandBus);
  const prisma = container.resolve<PrismaClient>(TOKENS.PrismaClient);
  const edi820ParseService = new EDI820ParseService();

  // Inbound EDI 820 — parse and auto-record payments
  server.post('/api/v1/edi/820/inbound', {
    schema: {
      tags: ['EDI - Financial'],
      summary: 'Process inbound EDI 820 (Payment Order/Remittance Advice) — parses and auto-records payments against matching invoices',
      body: {
        type: 'object',
        required: ['content'],
        properties: {
          content: { type: 'string', description: 'Raw EDI 820 content' },
          partnerId: { type: 'string' },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const body = z.object({
      content: z.string().min(10),
      partnerId: z.string().optional(),
    }).parse((req as any).body);

    const parsed = edi820ParseService.parseEDI820(body.content);

    if (!parsed.success) {
      reply.code(400);
      return { data: null, error: `EDI 820 parse failed: ${parsed.errors.join('; ')}` };
    }

    const results: PaymentResult[] = [];
    let appliedCount = 0;
    let totalAppliedCents = 0;

    for (const item of parsed.remittanceItems) {
      // Find the invoice by number
      const invoice = await prisma.invoice.findFirst({
        where: { invoiceNumber: item.invoiceNumber },
        select: { id: true, status: true, balanceCents: true, invoiceNumber: true },
      });

      if (!invoice) {
        results.push({
          invoiceNumber: item.invoiceNumber,
          invoiceId: null,
          amountCents: item.amountPaidCents,
          status: 'not_found',
          message: `Invoice ${item.invoiceNumber} not found in system`,
        });
        continue;
      }

      if (['paid', 'void'].includes(invoice.status)) {
        results.push({
          invoiceNumber: item.invoiceNumber,
          invoiceId: invoice.id,
          amountCents: item.amountPaidCents,
          status: 'already_paid',
          message: `Invoice ${item.invoiceNumber} is already ${invoice.status}`,
        });
        continue;
      }

      // Cap payment at remaining balance
      const paymentAmount = Math.min(item.amountPaidCents, invoice.balanceCents);

      if (paymentAmount <= 0) {
        results.push({
          invoiceNumber: item.invoiceNumber,
          invoiceId: invoice.id,
          amountCents: item.amountPaidCents,
          status: 'already_paid',
          message: `Invoice ${item.invoiceNumber} has zero balance`,
        });
        continue;
      }

      try {
        const result = await commandBus.dispatch<RecordPaymentPayload, { id: string; invoiceStatus: string }>({
          type: RECORD_PAYMENT,
          orgId: (req as any).orgId ?? '',
          actorId: (req as any).user?.sub ?? 'edi-820',
          payload: {
            invoiceId: invoice.id,
            amountCents: paymentAmount,
            paymentMethod: parsed.paymentMethod || 'ach',
            referenceNumber: parsed.paymentReference || undefined,
            receivedDate: parsed.paymentDate
              ? `${parsed.paymentDate.slice(0, 4)}-${parsed.paymentDate.slice(4, 6)}-${parsed.paymentDate.slice(6, 8)}`
              : undefined,
            notes: `EDI 820 from ${parsed.payerName || 'customer'}`,
          },
          metadata: { correlationId: crypto.randomUUID(), source: 'edi' },
        });

        if (result.success) {
          appliedCount++;
          totalAppliedCents += paymentAmount;
          results.push({
            invoiceNumber: item.invoiceNumber,
            invoiceId: invoice.id,
            amountCents: paymentAmount,
            status: 'applied',
            message: `Payment of ${paymentAmount}c applied — invoice now ${result.data?.invoiceStatus}`,
          });
        } else {
          results.push({
            invoiceNumber: item.invoiceNumber,
            invoiceId: invoice.id,
            amountCents: paymentAmount,
            status: 'error',
            message: result.error || 'Unknown error',
          });
        }
      } catch (err: any) {
        results.push({
          invoiceNumber: item.invoiceNumber,
          invoiceId: invoice.id,
          amountCents: item.amountPaidCents,
          status: 'error',
          message: err.message,
        });
      }
    }

    reply.code(appliedCount > 0 ? 201 : 400);
    return {
      data: {
        parsed: {
          payerName: parsed.payerName,
          paymentReference: parsed.paymentReference,
          paymentMethod: parsed.paymentMethod,
          paymentDate: parsed.paymentDate,
          totalAmountCents: parsed.totalAmountCents,
          remittanceCount: parsed.remittanceItems.length,
        },
        applied: appliedCount,
        totalAppliedCents,
        results,
      },
      error: appliedCount === 0 ? 'No payments could be applied' : null,
    };
  });

  // Preview EDI 820 (parse without applying)
  server.post('/api/v1/edi/820/preview', {
    schema: {
      tags: ['EDI - Financial'],
      summary: 'Preview EDI 820 parse result without recording payments',
      body: {
        type: 'object',
        required: ['content'],
        properties: {
          content: { type: 'string' },
        },
      },
    },
  }, async (req: FastifyRequest) => {
    const body = z.object({
      content: z.string().min(10),
    }).parse((req as any).body);

    const parsed = edi820ParseService.parseEDI820(body.content);

    // Enrich with invoice match status
    const enriched = await Promise.all(parsed.remittanceItems.map(async item => {
      const invoice = await prisma.invoice.findFirst({
        where: { invoiceNumber: item.invoiceNumber },
        select: { id: true, status: true, balanceCents: true, totalCents: true },
      });
      return {
        ...item,
        matched: !!invoice,
        invoiceStatus: invoice?.status ?? null,
        invoiceBalance: invoice?.balanceCents ?? null,
      };
    }));

    return {
      data: {
        ...parsed,
        remittanceItems: enriched,
      },
      error: null,
    };
  });
}
