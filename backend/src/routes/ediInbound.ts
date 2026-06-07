/**
 * Universal EDI Inbound Endpoint
 *
 * Single endpoint that accepts any inbound EDI document, detects the transaction
 * type, validates the partner supports it, routes to the correct handler, logs
 * everything to EdiTransactionLog, and auto-generates 997 acknowledgments.
 *
 * This replaces the need for the collector to know individual route endpoints -
 * it just sends everything here and the backend handles routing.
 */

import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { container, TOKENS } from '../di/index.js';
import { IEdiRouterService } from '../services/EdiRouterService.js';
import { ITradingPartnerRepository } from '../repositories/TradingPartnerRepository.js';
import { IEDI997Service } from '../services/EDI997Service.js';
import { IOutboundEdiDeliveryService } from '../services/OutboundEdiDeliveryService.js';
import { X12EnvelopeParser } from '../services/edi/X12EnvelopeParser.js';
import * as crypto from 'crypto';

import { registerOrgScopeForEdi } from '../auth/orgScopeMiddleware.js';

export async function ediInboundRoutes(server: FastifyInstance) {
  const ediRouter = container.resolve<IEdiRouterService>(TOKENS.IEdiRouterService);
  const partnerRepo = container.resolve<ITradingPartnerRepository>(TOKENS.ITradingPartnerRepository);
  const edi997Service = container.resolve<IEDI997Service>(TOKENS.IEDI997Service);
  const outboundDelivery = container.resolve<IOutboundEdiDeliveryService>(TOKENS.IOutboundEdiDeliveryService);
  const x12Parser = new X12EnvelopeParser();

  // Multi-tenancy: hybrid hook so unauthed webhook ingest derives orgId
  // from body.partnerId; authed admin calls use the JWT.
  await registerOrgScopeForEdi(server);

  server.post('/api/v1/edi/inbound', {
    schema: {
      tags: ['EDI'],
      summary: 'Universal EDI inbound endpoint - auto-detects type and routes to correct handler',
      description: 'Accepts any X12 EDI document, detects the transaction type, validates partner support, processes, logs, and optionally generates 997 acknowledgments.',
      body: {
        type: 'object',
        required: ['content'],
        properties: {
          content: { type: 'string', description: 'Raw X12 EDI content' },
          partnerId: { type: 'string', description: 'Trading partner ID (optional for manual imports)' },
          fileName: { type: 'string', description: 'Original filename' },
          source: { type: 'string', enum: ['sftp', 'api', 'manual'], description: 'How this file was received' },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const body = z.object({
      content: z.string().min(1),
      partnerId: z.string().optional(),
      fileName: z.string().optional(),
      source: z.enum(['sftp', 'api', 'manual']).optional(),
    }).parse((req as any).body);

    const source = body.source || 'api';

    // 1. Detect transaction type
    const transactionType = ediRouter.detectTransactionType(body.content);
    if (!transactionType) {
      reply.code(400);
      return { data: null, error: 'Could not detect X12 transaction type from content' };
    }

    // 2. Check for supported inbound type
    const route = ediRouter.getRouteForTransaction(transactionType);
    if (!route) {
      reply.code(400);
      return { data: null, error: `Transaction type ${transactionType} is not supported for inbound processing` };
    }

    // 3. If partnerId provided, validate partner supports this type
    let partner: any = null;
    if (body.partnerId) {
      partner = await partnerRepo.findById(body.partnerId);
      if (!partner) {
        reply.code(404);
        return { data: null, error: `Trading partner ${body.partnerId} not found` };
      }

      const txnConfig = partner.transactions?.find(
        (t: any) => t.transactionType === transactionType && t.direction === 'inbound' && t.enabled
      );
      if (!txnConfig) {
        reply.code(400);
        return {
          data: null,
          error: `Trading partner "${partner.name}" does not have inbound ${transactionType} enabled`,
        };
      }
    }

    // 4. Duplicate check via file hash
    const fileHash = crypto.createHash('sha256').update(body.content).digest('hex');

    // 5. Create transaction log entry
    const logEntry = await partnerRepo.createLog({
      orgId: req.orgId!,
      partnerId: body.partnerId || null,
      transactionType,
      direction: 'inbound',
      fileName: body.fileName || `${transactionType}_inbound_${Date.now()}.edi`,
      fileSize: body.content.length,
      fileContent: body.content,
      fileHash,
      transport: source === 'sftp' ? 'sftp' : 'api',
      status: 'processing',
      source,
    });

    // 6. Route to the individual endpoint internally via HTTP
    // We call the existing route handlers via server.inject() to reuse all their logic
    const routeEndpoint = route.endpoint;
    let injectBody: any;

    if (transactionType === '850') {
      // 850 uses 'ediContent' field and needs customerId from partner
      injectBody = {
        ediContent: body.content,
        partnerId: body.partnerId,
        customerId: partner?.customerId || undefined,
        fileName: body.fileName,
        source,
      };
    } else {
      // All other types use 'content' field
      injectBody = {
        content: body.content,
        partnerId: body.partnerId,
        fileName: body.fileName,
      };
    }

    try {
      const response = await server.inject({
        method: 'POST',
        url: routeEndpoint,
        payload: injectBody,
        headers: {
          'content-type': 'application/json',
          // Forward auth headers from original request
          ...(req.headers.authorization ? { authorization: req.headers.authorization } : {}),
        },
      });

      const result = JSON.parse(response.body);

      if (response.statusCode >= 400) {
        await partnerRepo.updateLog(logEntry.id, {
          status: 'error',
          errorMessage: result.error || `Handler returned ${response.statusCode}`,
          processedAt: new Date(),
        });
        reply.code(response.statusCode);
        return {
          data: { logId: logEntry.id, transactionType },
          error: result.error || `Processing failed with status ${response.statusCode}`,
        };
      }

      // Update log with success
      await partnerRepo.updateLog(logEntry.id, {
        status: 'success',
        processedAt: new Date(),
        shipmentReference: result.data?.parsed?.shipmentReference || result.data?.shipmentReference || null,
        shipmentId: result.data?.shipmentId || null,
        orderId: result.data?.orders?.[0]?.id || null,
        tenderId: result.data?.tenderId || null,
        invoiceNumber: result.data?.parsed?.invoiceNumber || null,
      });

      // 7. Auto-generate 997 if partner requires it
      let ack997Sent = false;
      if (partner) {
        const txnConfig = partner.transactions?.find(
          (t: any) => t.transactionType === transactionType && t.direction === 'inbound'
        );
        if (txnConfig?.ack997Required) {
          try {
            const parseResult = x12Parser.parse(body.content);
            const controlNumber = parseResult.envelope?.controlNumbers?.gs || '1';

            const edi997 = edi997Service.generate997({
              senderId: partner.senderId || 'OPENTMS',
              receiverId: partner.receiverId || '',
              originalTransactionType: transactionType,
              originalControlNumber: controlNumber,
              accepted: true,
            });

            // Deliver 997 to partner
            await outboundDelivery.deliver({
              partnerId: partner.id,
              transactionType: '997',
              ediContent: edi997,
              referenceId: `997_ACK_${logEntry.id}`,
            });

            await partnerRepo.updateLog(logEntry.id, { ack997Sent: true });
            ack997Sent = true;
          } catch (ackErr: any) {
            // 997 failure should not fail the main transaction
            console.error(`Failed to send 997 ack for log ${logEntry.id}: ${ackErr.message}`);
          }
        }
      }

      reply.code(response.statusCode);
      return {
        data: {
          logId: logEntry.id,
          transactionType,
          action: result.data?.action || 'processed',
          ack997Sent,
          details: result.data,
        },
        error: null,
      };
    } catch (err: any) {
      await partnerRepo.updateLog(logEntry.id, {
        status: 'error',
        errorMessage: err.message,
        processedAt: new Date(),
      });
      reply.code(500);
      return {
        data: { logId: logEntry.id, transactionType },
        error: `Internal processing error: ${err.message}`,
      };
    }
  });
}
