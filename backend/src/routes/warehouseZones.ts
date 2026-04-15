import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { container, TOKENS } from '../di/index.js';
import { IWarehouseZoneRepository } from '../repositories/WarehouseZoneRepository.js';
import { ICommandBus } from '../commands/CommandBus.js';
import { CREATE_WAREHOUSE_ZONE } from '../commands/warehouse/CreateWarehouseZoneCommand.js';
import { UPDATE_WAREHOUSE_ZONE } from '../commands/warehouse/UpdateWarehouseZoneCommand.js';
import { CREATE_WAREHOUSE_BIN } from '../commands/warehouse/CreateWarehouseBinCommand.js';
import { UPDATE_WAREHOUSE_BIN } from '../commands/warehouse/UpdateWarehouseBinCommand.js';
import { BULK_CREATE_BINS } from '../commands/warehouse/BulkCreateBinsCommand.js';
import crypto from 'crypto';

const ZONE_TYPES = ['receiving', 'bulk_storage', 'pick_face', 'staging', 'packing', 'shipping_dock', 'quarantine', 'returns', 'cross_dock'] as const;
const BIN_TYPES = ['pallet', 'shelf', 'floor', 'dock_door', 'staging', 'pack_station'] as const;
const TEMP_ZONES = ['ambient', 'refrigerated', 'frozen'] as const;

export async function warehouseZoneRoutes(server: FastifyInstance) {
  const repo = container.resolve<IWarehouseZoneRepository>(TOKENS.IWarehouseZoneRepository);
  const commandBus = container.resolve<ICommandBus>(TOKENS.ICommandBus);

  // ═══════════════════════════════════════════════════════════
  // ZONES
  // ═══════════════════════════════════════════════════════════

  // GET /api/v1/warehouse/zones?locationId=xxx
  server.get('/api/v1/warehouse/zones', {
    schema: {
      tags: ['WMS - Zones & Bins'],
      summary: 'List warehouse zones for a location',
      querystring: {
        type: 'object',
        required: ['locationId'],
        properties: {
          locationId: { type: 'string', format: 'uuid' },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { locationId } = req.query as { locationId: string };
    const zones = await repo.findZonesByLocation(locationId);
    return { data: zones, error: null };
  });

  // GET /api/v1/warehouse/zones/:id
  server.get('/api/v1/warehouse/zones/:id', {
    schema: {
      tags: ['WMS - Zones & Bins'],
      summary: 'Get zone detail with bins',
      params: { type: 'object', properties: { id: { type: 'string', format: 'uuid' } } },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const zone = await repo.findZoneById(id);
    if (!zone) {
      reply.code(404);
      return { data: null, error: 'Zone not found' };
    }
    const bins = await repo.findBinsByZone(id);
    const aisles = await repo.findAislesByZone(id);
    return { data: { ...zone, bins, aisles }, error: null };
  });

  // POST /api/v1/warehouse/zones
  server.post('/api/v1/warehouse/zones', {
    schema: {
      tags: ['WMS - Zones & Bins'],
      summary: 'Create a warehouse zone',
      body: {
        type: 'object',
        required: ['locationId', 'name', 'zoneType'],
        properties: {
          locationId: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
          zoneType: { type: 'string', enum: [...ZONE_TYPES] },
          temperatureZone: { type: 'string', enum: [...TEMP_ZONES], nullable: true },
          hazmatCertified: { type: 'boolean' },
          maxWeightKg: { type: 'number', nullable: true },
          maxVolumeCbm: { type: 'number', nullable: true },
          sortOrder: { type: 'integer' },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const body = z.object({
      locationId: z.string().uuid(),
      name: z.string().min(1).max(100),
      zoneType: z.enum(ZONE_TYPES),
      temperatureZone: z.enum(TEMP_ZONES).nullable().optional(),
      hazmatCertified: z.boolean().optional(),
      maxWeightKg: z.number().positive().nullable().optional(),
      maxVolumeCbm: z.number().positive().nullable().optional(),
      sortOrder: z.number().int().optional(),
    }).parse((req as any).body);

    const orgId = (req as any).orgId || 'default-org';
    const actorId = (req as any).userId || 'system';

    const result = await commandBus.dispatch({
      type: CREATE_WAREHOUSE_ZONE,
      orgId,
      actorId,
      payload: body,
      metadata: { correlationId: crypto.randomUUID(), source: 'api' },
    });

    if (!result.success) {
      reply.code(400);
      return { data: null, error: result.error };
    }

    reply.code(201);
    return { data: result.data, error: null };
  });

  // PUT /api/v1/warehouse/zones/:id
  server.put<{ Params: { id: string } }>('/api/v1/warehouse/zones/:id', {
    schema: {
      tags: ['WMS - Zones & Bins'],
      summary: 'Update a warehouse zone',
      body: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          zoneType: { type: 'string', enum: [...ZONE_TYPES] },
          temperatureZone: { type: 'string', enum: [...TEMP_ZONES], nullable: true },
          hazmatCertified: { type: 'boolean' },
          maxWeightKg: { type: 'number', nullable: true },
          maxVolumeCbm: { type: 'number', nullable: true },
          sortOrder: { type: 'integer' },
          active: { type: 'boolean' },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const body = z.object({
      name: z.string().min(1).max(100).optional(),
      zoneType: z.enum(ZONE_TYPES).optional(),
      temperatureZone: z.enum(TEMP_ZONES).nullable().optional(),
      hazmatCertified: z.boolean().optional(),
      maxWeightKg: z.number().positive().nullable().optional(),
      maxVolumeCbm: z.number().positive().nullable().optional(),
      sortOrder: z.number().int().optional(),
      active: z.boolean().optional(),
    }).parse((req as any).body);

    const orgId = (req as any).orgId || 'default-org';
    const actorId = (req as any).userId || 'system';

    const result = await commandBus.dispatch({
      type: UPDATE_WAREHOUSE_ZONE,
      orgId,
      actorId,
      payload: { zoneId: id, ...body },
      metadata: { correlationId: crypto.randomUUID(), source: 'api' },
    });

    if (!result.success) {
      reply.code(400);
      return { data: null, error: result.error };
    }

    return { data: result.data, error: null };
  });

  // ═══════════════════════════════════════════════════════════
  // BINS
  // ═══════════════════════════════════════════════════════════

  // GET /api/v1/warehouse/bins?locationId=xxx or ?zoneId=xxx
  server.get('/api/v1/warehouse/bins', {
    schema: {
      tags: ['WMS - Zones & Bins'],
      summary: 'List bins (by location or zone)',
      querystring: {
        type: 'object',
        properties: {
          locationId: { type: 'string', format: 'uuid' },
          zoneId: { type: 'string', format: 'uuid' },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { locationId, zoneId } = req.query as { locationId?: string; zoneId?: string };

    if (zoneId) {
      const bins = await repo.findBinsByZone(zoneId);
      return { data: bins, error: null };
    }
    if (locationId) {
      const bins = await repo.findBinsByLocation(locationId);
      return { data: bins, error: null };
    }

    reply.code(400);
    return { data: null, error: 'Provide locationId or zoneId query parameter' };
  });

  // GET /api/v1/warehouse/bins/:id
  server.get('/api/v1/warehouse/bins/:id', {
    schema: {
      tags: ['WMS - Zones & Bins'],
      summary: 'Get bin detail',
      params: { type: 'object', properties: { id: { type: 'string', format: 'uuid' } } },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const bin = await repo.findBinById(id);
    if (!bin) {
      reply.code(404);
      return { data: null, error: 'Bin not found' };
    }
    return { data: bin, error: null };
  });

  // POST /api/v1/warehouse/bins
  server.post('/api/v1/warehouse/bins', {
    schema: {
      tags: ['WMS - Zones & Bins'],
      summary: 'Create a single warehouse bin',
      body: {
        type: 'object',
        required: ['zoneId', 'locationId', 'label', 'binType'],
        properties: {
          zoneId: { type: 'string', format: 'uuid' },
          locationId: { type: 'string', format: 'uuid' },
          aisleId: { type: 'string', format: 'uuid', nullable: true },
          label: { type: 'string' },
          binType: { type: 'string', enum: [...BIN_TYPES] },
          maxWeightKg: { type: 'number', nullable: true },
          maxVolumeCbm: { type: 'number', nullable: true },
          maxPalletPositions: { type: 'integer', nullable: true },
          temperatureZone: { type: 'string', enum: [...TEMP_ZONES], nullable: true },
          hazmatCertified: { type: 'boolean' },
          level: { type: 'integer', nullable: true },
          walkSequence: { type: 'integer' },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const body = z.object({
      zoneId: z.string().uuid(),
      locationId: z.string().uuid(),
      aisleId: z.string().uuid().nullable().optional(),
      label: z.string().min(1).max(50),
      binType: z.enum(BIN_TYPES),
      maxWeightKg: z.number().positive().nullable().optional(),
      maxVolumeCbm: z.number().positive().nullable().optional(),
      maxPalletPositions: z.number().int().positive().nullable().optional(),
      temperatureZone: z.enum(TEMP_ZONES).nullable().optional(),
      hazmatCertified: z.boolean().optional(),
      level: z.number().int().nullable().optional(),
      walkSequence: z.number().int().optional(),
    }).parse((req as any).body);

    const orgId = (req as any).orgId || 'default-org';
    const actorId = (req as any).userId || 'system';

    const result = await commandBus.dispatch({
      type: CREATE_WAREHOUSE_BIN,
      orgId,
      actorId,
      payload: body,
      metadata: { correlationId: crypto.randomUUID(), source: 'api' },
    });

    if (!result.success) {
      reply.code(400);
      return { data: null, error: result.error };
    }

    reply.code(201);
    return { data: result.data, error: null };
  });

  // PUT /api/v1/warehouse/bins/:id
  server.put<{ Params: { id: string } }>('/api/v1/warehouse/bins/:id', {
    schema: {
      tags: ['WMS - Zones & Bins'],
      summary: 'Update a warehouse bin',
      body: {
        type: 'object',
        properties: {
          label: { type: 'string' },
          binType: { type: 'string', enum: [...BIN_TYPES] },
          maxWeightKg: { type: 'number', nullable: true },
          maxVolumeCbm: { type: 'number', nullable: true },
          maxPalletPositions: { type: 'integer', nullable: true },
          temperatureZone: { type: 'string', enum: [...TEMP_ZONES], nullable: true },
          hazmatCertified: { type: 'boolean' },
          level: { type: 'integer', nullable: true },
          walkSequence: { type: 'integer' },
          active: { type: 'boolean' },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const body = z.object({
      label: z.string().min(1).max(50).optional(),
      binType: z.enum(BIN_TYPES).optional(),
      maxWeightKg: z.number().positive().nullable().optional(),
      maxVolumeCbm: z.number().positive().nullable().optional(),
      maxPalletPositions: z.number().int().positive().nullable().optional(),
      temperatureZone: z.enum(TEMP_ZONES).nullable().optional(),
      hazmatCertified: z.boolean().optional(),
      level: z.number().int().nullable().optional(),
      walkSequence: z.number().int().optional(),
      active: z.boolean().optional(),
    }).parse((req as any).body);

    const orgId = (req as any).orgId || 'default-org';
    const actorId = (req as any).userId || 'system';

    const result = await commandBus.dispatch({
      type: UPDATE_WAREHOUSE_BIN,
      orgId,
      actorId,
      payload: { binId: id, ...body },
      metadata: { correlationId: crypto.randomUUID(), source: 'api' },
    });

    if (!result.success) {
      reply.code(400);
      return { data: null, error: result.error };
    }

    return { data: result.data, error: null };
  });

  // POST /api/v1/warehouse/bins/bulk — bulk create bins from pattern
  server.post('/api/v1/warehouse/bins/bulk', {
    schema: {
      tags: ['WMS - Zones & Bins'],
      summary: 'Bulk create bins from a label pattern',
      description: 'Generate bins using a pattern with {aisle}, {row}, {level} placeholders. Example: "BULK-{aisle}-{row}-{level}" with aisles ["A","B"], rows 1-10, levels 1-4 creates 80 bins.',
      body: {
        type: 'object',
        required: ['zoneId', 'locationId', 'labelPattern', 'binType', 'aisles', 'rowStart', 'rowEnd', 'levelStart', 'levelEnd'],
        properties: {
          zoneId: { type: 'string', format: 'uuid' },
          locationId: { type: 'string', format: 'uuid' },
          labelPattern: { type: 'string' },
          binType: { type: 'string', enum: [...BIN_TYPES] },
          aisles: { type: 'array', items: { type: 'string' } },
          rowStart: { type: 'integer', minimum: 1 },
          rowEnd: { type: 'integer', minimum: 1 },
          levelStart: { type: 'integer', minimum: 1 },
          levelEnd: { type: 'integer', minimum: 1 },
          maxWeightKg: { type: 'number', nullable: true },
          maxVolumeCbm: { type: 'number', nullable: true },
          maxPalletPositions: { type: 'integer', nullable: true },
          temperatureZone: { type: 'string', enum: [...TEMP_ZONES], nullable: true },
          hazmatCertified: { type: 'boolean' },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const body = z.object({
      zoneId: z.string().uuid(),
      locationId: z.string().uuid(),
      labelPattern: z.string().min(1),
      binType: z.enum(BIN_TYPES),
      aisles: z.array(z.string().min(1)).min(1),
      rowStart: z.number().int().min(1),
      rowEnd: z.number().int().min(1),
      levelStart: z.number().int().min(1),
      levelEnd: z.number().int().min(1),
      maxWeightKg: z.number().positive().nullable().optional(),
      maxVolumeCbm: z.number().positive().nullable().optional(),
      maxPalletPositions: z.number().int().positive().nullable().optional(),
      temperatureZone: z.enum(TEMP_ZONES).nullable().optional(),
      hazmatCertified: z.boolean().optional(),
    }).parse((req as any).body);

    if (body.rowEnd < body.rowStart) {
      reply.code(400);
      return { data: null, error: 'rowEnd must be >= rowStart' };
    }
    if (body.levelEnd < body.levelStart) {
      reply.code(400);
      return { data: null, error: 'levelEnd must be >= levelStart' };
    }

    const orgId = (req as any).orgId || 'default-org';
    const actorId = (req as any).userId || 'system';

    const result = await commandBus.dispatch({
      type: BULK_CREATE_BINS,
      orgId,
      actorId,
      payload: body,
      metadata: { correlationId: crypto.randomUUID(), source: 'api' },
    });

    if (!result.success) {
      reply.code(400);
      return { data: null, error: result.error };
    }

    reply.code(201);
    return { data: result.data, error: null };
  });

  // POST /api/v1/warehouse/bins/bulk/preview — preview what bulk create would generate
  server.post('/api/v1/warehouse/bins/bulk/preview', {
    schema: {
      tags: ['WMS - Zones & Bins'],
      summary: 'Preview bulk bin labels without creating',
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const body = z.object({
      labelPattern: z.string().min(1),
      aisles: z.array(z.string().min(1)).min(1),
      rowStart: z.number().int().min(1),
      rowEnd: z.number().int().min(1),
      levelStart: z.number().int().min(1),
      levelEnd: z.number().int().min(1),
    }).parse((req as any).body);

    const labels: string[] = [];
    for (const aisle of body.aisles) {
      for (let row = body.rowStart; row <= body.rowEnd; row++) {
        for (let level = body.levelStart; level <= body.levelEnd; level++) {
          labels.push(
            body.labelPattern
              .replace('{aisle}', aisle)
              .replace('{row}', String(row).padStart(2, '0'))
              .replace('{level}', String(level).padStart(2, '0'))
          );
        }
      }
    }

    return { data: { count: labels.length, labels: labels.slice(0, 50), truncated: labels.length > 50 }, error: null };
  });
}
