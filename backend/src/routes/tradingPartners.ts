import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { ITradingPartnerRepository } from '../repositories/TradingPartnerRepository.js';
import { IEdiRouterService } from '../services/EdiRouterService.js';
import { container, TOKENS } from '../di/index.js';

export async function tradingPartnerRoutes(server: FastifyInstance) {
  const partnerRepo = container.resolve<ITradingPartnerRepository>(TOKENS.ITradingPartnerRepository);

  // List all trading partners
  server.get('/api/v1/trading-partners', {
    schema: {
      tags: ['Trading Partners'],
      summary: 'List all trading partners',
      querystring: {
        type: 'object',
        properties: {
          entityType: { type: 'string' },
          active: { type: 'boolean' },
        },
      },
    },
  }, async (req: FastifyRequest, _reply: FastifyReply) => {
    const { entityType, active } = req.query as any;
    const partners = await partnerRepo.findAll({
      entityType,
      active: active !== undefined ? active === 'true' || active === true : undefined,
    });
    return { data: partners, error: null };
  });

  // Get trading partner by ID
  server.get('/api/v1/trading-partners/:id', {
    schema: { tags: ['Trading Partners'], summary: 'Get trading partner details' },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const partner = await partnerRepo.findById(id);
    if (!partner) {
      reply.code(404);
      return { data: null, error: 'Trading partner not found' };
    }
    return { data: partner, error: null };
  });

  // Create trading partner
  server.post('/api/v1/trading-partners', {
    schema: {
      tags: ['Trading Partners'],
      summary: 'Create a new trading partner',
      body: {
        type: 'object',
        required: ['name', 'entityType'],
        properties: {
          name: { type: 'string' },
          entityType: { type: 'string', enum: ['customer', 'carrier', '3pl', 'warehouse', 'erp', 'other'] },
          customerId: { type: 'string' },
          carrierId: { type: 'string' },
          sftpHost: { type: 'string' },
          sftpPort: { type: 'number' },
          sftpUsername: { type: 'string' },
          sftpPassword: { type: 'string' },
          sftpPrivateKey: { type: 'string' },
          httpUrl: { type: 'string' },
          httpAuthType: { type: 'string' },
          httpAuthHeader: { type: 'string' },
          httpAuthValue: { type: 'string' },
          senderId: { type: 'string' },
          receiverId: { type: 'string' },
          ediVersion: { type: 'string' },
          inboundEnabled: { type: 'boolean' },
          inboundDir: { type: 'string' },
          inboundFilePattern: { type: 'string' },
          pollingInterval: { type: 'number' },
          pollingCron: { type: 'string' },
          outboundEnabled: { type: 'boolean' },
          outboundDir: { type: 'string' },
          outboundTransport: { type: 'string', enum: ['sftp', 'http'] },
          outboundFileNaming: { type: 'string', enum: ['date', 'sequence', 'reference'] },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const body = z.object({
      name: z.string().min(1),
      entityType: z.enum(['customer', 'carrier', '3pl', 'warehouse', 'erp', 'other']),
      customerId: z.string().optional(),
      carrierId: z.string().optional(),
      sftpHost: z.string().optional(),
      sftpPort: z.number().optional(),
      sftpUsername: z.string().optional(),
      sftpPassword: z.string().optional(),
      sftpPrivateKey: z.string().optional(),
      httpUrl: z.string().url().optional(),
      httpAuthType: z.string().optional(),
      httpAuthHeader: z.string().optional(),
      httpAuthValue: z.string().optional(),
      senderId: z.string().optional(),
      receiverId: z.string().optional(),
      ediVersion: z.string().optional(),
      inboundEnabled: z.boolean().optional(),
      inboundDir: z.string().optional(),
      inboundFilePattern: z.string().optional(),
      pollingInterval: z.number().min(60).optional(),
      pollingCron: z.string().optional(),
      outboundEnabled: z.boolean().optional(),
      outboundDir: z.string().optional(),
      outboundTransport: z.enum(['sftp', 'http']).optional(),
      outboundFileNaming: z.enum(['date', 'sequence', 'reference']).optional(),
    }).parse((req as any).body);

    const partner = await partnerRepo.create(body);
    reply.code(201);
    return { data: partner, error: null };
  });

  // Update trading partner
  server.put('/api/v1/trading-partners/:id', {
    schema: { tags: ['Trading Partners'], summary: 'Update a trading partner' },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const body = z.object({
      name: z.string().min(1).optional(),
      active: z.boolean().optional(),
      entityType: z.enum(['customer', 'carrier', '3pl', 'warehouse', 'erp', 'other']).optional(),
      customerId: z.string().nullable().optional(),
      carrierId: z.string().nullable().optional(),
      sftpHost: z.string().nullable().optional(),
      sftpPort: z.number().optional(),
      sftpUsername: z.string().nullable().optional(),
      sftpPassword: z.string().nullable().optional(),
      sftpPrivateKey: z.string().nullable().optional(),
      httpUrl: z.string().nullable().optional(),
      httpAuthType: z.string().nullable().optional(),
      httpAuthHeader: z.string().nullable().optional(),
      httpAuthValue: z.string().nullable().optional(),
      senderId: z.string().nullable().optional(),
      receiverId: z.string().nullable().optional(),
      ediVersion: z.string().optional(),
      inboundEnabled: z.boolean().optional(),
      inboundDir: z.string().optional(),
      inboundFilePattern: z.string().optional(),
      pollingInterval: z.number().min(60).optional(),
      pollingCron: z.string().nullable().optional(),
      outboundEnabled: z.boolean().optional(),
      outboundDir: z.string().nullable().optional(),
      outboundTransport: z.enum(['sftp', 'http']).optional(),
      outboundFileNaming: z.enum(['date', 'sequence', 'reference']).optional(),
    }).parse((req as any).body);

    try {
      const updated = await partnerRepo.update(id, body as any);
      return { data: updated, error: null };
    } catch (err: any) {
      reply.code(400);
      return { data: null, error: err.message };
    }
  });

  // ── Transaction type management ──

  // Add transaction type to partner
  server.post('/api/v1/trading-partners/:id/transactions', {
    schema: {
      tags: ['Trading Partners'],
      summary: 'Add a supported transaction type to a partner',
      body: {
        type: 'object',
        required: ['transactionType', 'direction'],
        properties: {
          transactionType: { type: 'string' },
          direction: { type: 'string', enum: ['inbound', 'outbound'] },
          enabled: { type: 'boolean' },
          fieldMapping: { type: 'object' },
          autoProcess: { type: 'boolean' },
          ack997Required: { type: 'boolean' },
          filePattern: { type: 'string' },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const body = z.object({
      transactionType: z.string().min(1),
      direction: z.enum(['inbound', 'outbound']),
      enabled: z.boolean().optional(),
      fieldMapping: z.any().optional(),
      autoProcess: z.boolean().optional(),
      ack997Required: z.boolean().optional(),
      filePattern: z.string().optional(),
    }).parse((req as any).body);

    try {
      const txn = await partnerRepo.addTransaction({ partnerId: id, ...body });
      reply.code(201);
      return { data: txn, error: null };
    } catch (err: any) {
      reply.code(400);
      return { data: null, error: err.message };
    }
  });

  // Update transaction
  server.put('/api/v1/trading-partners/:id/transactions/:txnId', {
    schema: { tags: ['Trading Partners'], summary: 'Update a transaction type config' },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { txnId } = req.params as { id: string; txnId: string };
    const body = z.object({
      enabled: z.boolean().optional(),
      fieldMapping: z.any().optional(),
      autoProcess: z.boolean().optional(),
      ack997Required: z.boolean().optional(),
      filePattern: z.string().optional(),
    }).parse((req as any).body);

    try {
      const txn = await partnerRepo.updateTransaction(txnId, body as any);
      return { data: txn, error: null };
    } catch (err: any) {
      reply.code(400);
      return { data: null, error: err.message };
    }
  });

  // Remove transaction
  server.delete('/api/v1/trading-partners/:id/transactions/:txnId', {
    schema: { tags: ['Trading Partners'], summary: 'Remove a transaction type from a partner' },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { txnId } = req.params as { id: string; txnId: string };
    try {
      await partnerRepo.removeTransaction(txnId);
      return { data: { removed: true }, error: null };
    } catch (err: any) {
      reply.code(400);
      return { data: null, error: err.message };
    }
  });

  // ── Transaction logs ──

  server.get('/api/v1/trading-partners/:id/logs', {
    schema: { tags: ['Trading Partners'], summary: 'Get EDI transaction logs for a partner' },
  }, async (req: FastifyRequest, _reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const { transactionType, direction, status } = req.query as any;
    const logs = await partnerRepo.findLogs({ partnerId: id, transactionType, direction, status });
    return { data: logs, error: null };
  });

  // All logs (cross-partner)
  server.get('/api/v1/edi-logs', {
    schema: {
      tags: ['Trading Partners'],
      summary: 'List all EDI transaction logs',
      querystring: {
        type: 'object',
        properties: {
          transactionType: { type: 'string' },
          direction: { type: 'string' },
          status: { type: 'string' },
          partnerId: { type: 'string' },
        },
      },
    },
  }, async (req: FastifyRequest, _reply: FastifyReply) => {
    const { transactionType, direction, status, partnerId } = req.query as any;
    const logs = await partnerRepo.findLogs({ partnerId, transactionType, direction, status });
    return { data: logs, error: null };
  });

  // ── EDI Router info (for UI to show supported types) ──

  server.get('/api/v1/edi/transaction-types', {
    schema: { tags: ['Trading Partners'], summary: 'List supported EDI transaction types' },
  }, async (_req: FastifyRequest, _reply: FastifyReply) => {
    const types = [
      { code: '850', name: 'Purchase Order', directions: ['inbound'], status: 'active' },
      { code: '855', name: 'PO Acknowledgment', directions: ['outbound'], status: 'planned' },
      { code: '856', name: 'Advance Ship Notice', directions: ['outbound'], status: 'active' },
      { code: '204', name: 'Motor Carrier Load Tender', directions: ['outbound'], status: 'active' },
      { code: '990', name: 'Response to Load Tender', directions: ['inbound'], status: 'active' },
      { code: '214', name: 'Shipment Status Message', directions: ['inbound', 'outbound'], status: 'planned' },
      { code: '210', name: 'Freight Invoice', directions: ['inbound'], status: 'planned' },
      { code: '997', name: 'Functional Acknowledgment', directions: ['inbound', 'outbound'], status: 'active' },
      { code: '810', name: 'Invoice', directions: ['outbound'], status: 'planned' },
      { code: '820', name: 'Payment Order', directions: ['inbound'], status: 'planned' },
    ];
    return { data: types, error: null };
  });
}
