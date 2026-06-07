/**
 * EDI 997 (Functional Acknowledgment) Inbound Route
 *
 * Processes inbound 997 acknowledgments from trading partners.
 * When a partner sends a 997, it means they're acknowledging receipt of
 * an outbound EDI we sent them (204, 214, 810, 856, etc.).
 *
 * This handler:
 * 1. Parses the 997 to extract AK1/AK9 (which transaction, accept/reject)
 * 2. Finds the original outbound EdiTransactionLog entry by control number
 * 3. Updates the original log: ack997Received = true
 * 4. Creates an inbound 997 log entry
 */

import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { container, TOKENS } from '../di/index.js';
import { IEDI997Service } from '../services/EDI997Service.js';
import { ITradingPartnerRepository } from '../repositories/TradingPartnerRepository.js';

import { registerOrgScopeForEdi } from '../auth/orgScopeMiddleware.js';

export async function edi997Routes(server: FastifyInstance) {
  const edi997Service = container.resolve<IEDI997Service>(TOKENS.IEDI997Service);
  const tradingPartnerRepo = container.resolve<ITradingPartnerRepository>(TOKENS.ITradingPartnerRepository);

  await registerOrgScopeForEdi(server);

  server.post('/api/v1/edi/997/inbound', {
    schema: {
      tags: ['EDI'],
      summary: 'Process inbound EDI 997 (Functional Acknowledgment) from trading partner',
      description: 'Parses an inbound 997, finds the original outbound transaction, and updates its ack status.',
      body: {
        type: 'object',
        required: ['content'],
        properties: {
          content: { type: 'string', description: 'Raw EDI 997 content' },
          partnerId: { type: 'string' },
          fileName: { type: 'string' },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const body = z.object({
      content: z.string().min(1),
      partnerId: z.string().optional(),
      fileName: z.string().optional(),
    }).parse((req as any).body);

    // Create inbound 997 log entry
    const logEntry = await tradingPartnerRepo.createLog({
      orgId: req.orgId!,
      partnerId: body.partnerId || null,
      transactionType: '997',
      direction: 'inbound',
      fileName: body.fileName || 'edi997_inbound.edi',
      fileSize: body.content.length,
      fileContent: body.content,
      transport: 'api',
      status: 'processing',
      source: body.partnerId ? 'sftp' : 'api',
    });

    // Parse the 997
    const result = edi997Service.parse997(body.content);

    if (!result.success) {
      await tradingPartnerRepo.updateLog(logEntry.id, {
        status: 'error',
        errorMessage: result.errors.join('; '),
        processedAt: new Date(),
      });
      reply.code(400);
      return { data: null, error: `EDI 997 parse failed: ${result.errors.join('; ')}` };
    }

    // Try to find the original outbound transaction log entry
    // Match by: partner + outbound direction + transaction type + control number pattern
    let originalLogUpdated = false;
    if (body.partnerId && result.groupControlNumber) {
      const outboundLogs = await tradingPartnerRepo.findLogs({
        partnerId: body.partnerId,
        direction: 'outbound',
        transactionType: result.acknowledgedTransactionType || undefined,
      });

      // Find a log whose content contains the matching GS control number
      // This is a best-effort match since we don't store control numbers as separate fields
      for (const log of outboundLogs) {
        if (log.ack997Received) continue; // Already acknowledged
        if (log.fileContent?.includes(result.groupControlNumber)) {
          await tradingPartnerRepo.updateLog(log.id, {
            ack997Received: true,
            ack997LogId: logEntry.id,
          });
          originalLogUpdated = true;
          break;
        }
      }
    }

    // Update the 997 log entry
    await tradingPartnerRepo.updateLog(logEntry.id, {
      status: 'success',
      processedAt: new Date(),
    });

    reply.code(200);
    return {
      data: {
        logId: logEntry.id,
        ackCode: result.ackCode,
        accepted: result.accepted,
        acknowledgedType: result.acknowledgedTransactionType,
        groupControlNumber: result.groupControlNumber,
        setsAccepted: result.setsAccepted,
        setsReceived: result.setsReceived,
        originalLogUpdated,
      },
      error: null,
    };
  });
}
