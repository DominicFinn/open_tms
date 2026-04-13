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

  // ── Connection test ──

  server.post('/api/v1/trading-partners/:id/test-connection', {
    schema: {
      tags: ['Trading Partners'],
      summary: 'Test SFTP or HTTP connection for a trading partner',
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const partner = await partnerRepo.findById(id);
    if (!partner) {
      reply.code(404);
      return { data: null, error: 'Trading partner not found' };
    }

    // Test SFTP connection
    if (partner.sftpHost) {
      try {
        const SftpClient = (await import('ssh2-sftp-client')).default;
        const sftp = new SftpClient();
        const connectConfig: any = {
          host: partner.sftpHost,
          port: partner.sftpPort || 22,
          username: partner.sftpUsername || '',
          readyTimeout: 10000,
        };
        if (partner.sftpPrivateKey) {
          connectConfig.privateKey = partner.sftpPrivateKey;
        } else if (partner.sftpPassword) {
          connectConfig.password = partner.sftpPassword;
        }

        await sftp.connect(connectConfig);

        // Try to list the inbound directory if configured
        let dirListing: string[] = [];
        const testDir = partner.inboundEnabled ? (partner.inboundDir || '/') : '/';
        try {
          const files = await sftp.list(testDir);
          dirListing = files.slice(0, 5).map((f: any) => f.name);
        } catch {
          // Directory might not exist but connection works
        }

        await sftp.end();

        return {
          data: {
            sftp: { success: true, host: partner.sftpHost, port: partner.sftpPort, directory: testDir, sampleFiles: dirListing },
          },
          error: null,
        };
      } catch (err: any) {
        return {
          data: { sftp: { success: false, host: partner.sftpHost, error: err.message } },
          error: `SFTP connection failed: ${err.message}`,
        };
      }
    }

    // Test HTTP connection
    if (partner.httpUrl) {
      try {
        const headers: Record<string, string> = { 'Content-Type': 'application/edi-x12' };
        if (partner.httpAuthType === 'bearer' && partner.httpAuthValue) {
          headers['Authorization'] = `Bearer ${partner.httpAuthValue}`;
        } else if (partner.httpAuthType === 'api_key' && partner.httpAuthHeader && partner.httpAuthValue) {
          headers[partner.httpAuthHeader] = partner.httpAuthValue;
        }

        const response = await fetch(partner.httpUrl, {
          method: 'HEAD',
          headers,
          signal: AbortSignal.timeout(10000),
        });

        return {
          data: {
            http: { success: response.ok, url: partner.httpUrl, statusCode: response.status },
          },
          error: response.ok ? null : `HTTP returned ${response.status}`,
        };
      } catch (err: any) {
        return {
          data: { http: { success: false, url: partner.httpUrl, error: err.message } },
          error: `HTTP connection failed: ${err.message}`,
        };
      }
    }

    reply.code(400);
    return { data: null, error: 'No SFTP or HTTP connection configured for this partner' };
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

  // All logs (cross-partner) with pagination
  server.get('/api/v1/edi-logs', {
    schema: {
      tags: ['EDI Logs'],
      summary: 'List all EDI transaction logs with pagination and filtering',
      querystring: {
        type: 'object',
        properties: {
          transactionType: { type: 'string' },
          direction: { type: 'string' },
          status: { type: 'string' },
          partnerId: { type: 'string' },
          source: { type: 'string' },
          search: { type: 'string' },
          limit: { type: 'integer', default: 50 },
          offset: { type: 'integer', default: 0 },
        },
      },
    },
  }, async (req: FastifyRequest, _reply: FastifyReply) => {
    const { transactionType, direction, status, partnerId, source, search, limit, offset } = req.query as any;
    const result = await partnerRepo.findLogsWithPagination(
      { partnerId, transactionType, direction, status, source, search },
      parseInt(limit) || 50,
      parseInt(offset) || 0,
    );
    return { data: result.logs, total: result.total, error: null };
  });

  // Single log detail
  server.get('/api/v1/edi-logs/:id', {
    schema: {
      tags: ['EDI Logs'],
      summary: 'Get EDI transaction log detail (including raw content)',
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const log = await partnerRepo.findLogById(id);
    if (!log) {
      reply.code(404);
      return { data: null, error: 'EDI transaction log not found' };
    }
    return { data: log, error: null };
  });

  // Log stats
  server.get('/api/v1/edi-logs/stats', {
    schema: {
      tags: ['EDI Logs'],
      summary: 'Get EDI transaction log statistics',
      querystring: {
        type: 'object',
        properties: {
          partnerId: { type: 'string' },
          transactionType: { type: 'string' },
          direction: { type: 'string' },
        },
      },
    },
  }, async (req: FastifyRequest, _reply: FastifyReply) => {
    const { partnerId, transactionType, direction } = req.query as any;
    const stats = await partnerRepo.getLogStats({ partnerId, transactionType, direction });
    return { data: stats, error: null };
  });

  // Retry a failed log entry
  server.post('/api/v1/edi-logs/:id/retry', {
    schema: {
      tags: ['EDI Logs'],
      summary: 'Retry a failed EDI transaction (re-process inbound or re-deliver outbound)',
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const log = await partnerRepo.findLogById(id);
    if (!log) {
      reply.code(404);
      return { data: null, error: 'EDI transaction log not found' };
    }
    if (log.status !== 'error') {
      reply.code(400);
      return { data: null, error: `Cannot retry a log with status "${log.status}" — only "error" logs can be retried` };
    }
    if (log.retryCount >= 3) {
      reply.code(400);
      return { data: null, error: 'Maximum retry count (3) reached' };
    }

    // Mark as pending for retry
    await partnerRepo.updateLog(id, {
      status: 'pending',
      retryCount: log.retryCount + 1,
      lastRetryAt: new Date(),
      errorMessage: null,
    });

    return { data: { id, status: 'pending', retryCount: log.retryCount + 1 }, error: null };
  });

  // ── EDI Router info (for UI to show supported types) ──

  server.get('/api/v1/edi/transaction-types', {
    schema: { tags: ['EDI'], summary: 'List supported EDI transaction types' },
  }, async (_req: FastifyRequest, _reply: FastifyReply) => {
    const types = [
      { code: '850', name: 'Purchase Order', directions: ['inbound'], status: 'active' },
      { code: '855', name: 'PO Acknowledgment', directions: ['outbound'], status: 'active' },
      { code: '856', name: 'Advance Ship Notice', directions: ['outbound'], status: 'active' },
      { code: '204', name: 'Motor Carrier Load Tender', directions: ['outbound'], status: 'active' },
      { code: '990', name: 'Response to Load Tender', directions: ['inbound'], status: 'active' },
      { code: '214', name: 'Shipment Status Message', directions: ['inbound', 'outbound'], status: 'active' },
      { code: '210', name: 'Freight Invoice', directions: ['inbound'], status: 'active' },
      { code: '997', name: 'Functional Acknowledgment', directions: ['inbound', 'outbound'], status: 'active' },
      { code: '810', name: 'Invoice', directions: ['outbound'], status: 'active' },
      { code: '820', name: 'Payment Order/Remittance', directions: ['inbound'], status: 'active' },
    ];
    return { data: types, error: null };
  });
}
