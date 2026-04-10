import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { randomUUID } from 'crypto';
import { IColdChainRepository } from '../repositories/ColdChainRepository.js';
import { ColdChainService } from '../services/ColdChainService.js';
import { ICommandBus } from '../commands/CommandBus.js';
import { container, TOKENS } from '../di/index.js';
import { CREATE_COLD_CHAIN_PROFILE } from '../commands/coldChain/CreateColdChainProfileCommand.js';
import { UPDATE_COLD_CHAIN_PROFILE } from '../commands/coldChain/UpdateColdChainProfileCommand.js';
import { ACKNOWLEDGE_EXCURSION } from '../commands/coldChain/AcknowledgeExcursionCommand.js';
import { RESOLVE_EXCURSION } from '../commands/coldChain/ResolveExcursionCommand.js';
import { SET_DISPOSITION } from '../commands/coldChain/SetDispositionCommand.js';
import { RECORD_CALIBRATION } from '../commands/coldChain/RecordCalibrationCommand.js';
import { CREATE_CAPA } from '../commands/capa/CreateCAPACommand.js';
import { UPDATE_CAPA } from '../commands/capa/UpdateCAPACommand.js';

export async function coldChainRoutes(server: FastifyInstance) {
  const coldChainRepo = container.resolve<IColdChainRepository>(TOKENS.IColdChainRepository);
  const coldChainService = container.resolve<ColdChainService>(TOKENS.IColdChainService);
  const commandBus = container.resolve<ICommandBus>(TOKENS.ICommandBus);

  // Resolve org ID once
  const getOrgId = async () => {
    const org = await server.prisma.organization.findFirst({ select: { id: true } });
    return org?.id || 'default-org';
  };

  // ─── Cold Chain Profiles ─────────────────────────────────────────────────────

  // GET /api/v1/cold-chain/profiles — List profiles for org
  server.get('/api/v1/cold-chain/profiles', {
    schema: {
      tags: ['Cold Chain'],
      summary: 'List cold chain profiles',
      description: 'Returns all cold chain temperature profiles for the organization. Optionally filter by active status.',
      querystring: {
        type: 'object',
        properties: {
          active: { type: 'string', description: 'Filter by active status (true/false)' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            data: { type: 'array', items: { type: 'object' } },
            error: { type: ['string', 'null'] },
          },
        },
      },
    },
  }, async (req: FastifyRequest, _reply: FastifyReply) => {
    const { active } = req.query as { active?: string };
    const orgId = await getOrgId();
    let profiles = await coldChainRepo.listProfiles(orgId);

    if (active !== undefined) {
      const isActive = active === 'true';
      profiles = profiles.filter((p) => p.active === isActive);
    }

    return { data: profiles, error: null };
  });

  // GET /api/v1/cold-chain/profiles/:id — Get profile by ID
  server.get('/api/v1/cold-chain/profiles/:id', {
    schema: {
      tags: ['Cold Chain'],
      summary: 'Get cold chain profile by ID',
      description: 'Returns a single cold chain profile by its unique identifier.',
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', description: 'Profile ID' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            data: { type: 'object' },
            error: { type: ['string', 'null'] },
          },
        },
        404: {
          type: 'object',
          properties: {
            data: { type: 'null' },
            error: { type: 'string' },
          },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const profile = await coldChainRepo.getProfile(id);
    if (!profile) {
      reply.code(404);
      return { data: null, error: 'Cold chain profile not found' };
    }
    return { data: profile, error: null };
  });

  // POST /api/v1/cold-chain/profiles — Create profile
  server.post('/api/v1/cold-chain/profiles', {
    schema: {
      tags: ['Cold Chain'],
      summary: 'Create a new cold chain profile',
      description: 'Creates a new temperature/humidity monitoring profile with acceptable ranges and alert thresholds.',
      body: {
        type: 'object',
        required: ['name', 'minTemperature', 'maxTemperature', 'alertMinTemperature', 'alertMaxTemperature'],
        properties: {
          name: { type: 'string' },
          description: { type: 'string' },
          minTemperature: { type: 'number' },
          maxTemperature: { type: 'number' },
          alertMinTemperature: { type: 'number' },
          alertMaxTemperature: { type: 'number' },
          minHumidity: { type: 'number' },
          maxHumidity: { type: 'number' },
          alertMinHumidity: { type: 'number' },
          alertMaxHumidity: { type: 'number' },
        },
      },
      response: {
        201: {
          type: 'object',
          properties: {
            data: { type: 'object' },
            error: { type: ['string', 'null'] },
          },
        },
        400: {
          type: 'object',
          properties: {
            data: { type: 'null' },
            error: { type: 'string' },
          },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const body = req.body as any;

    const result = await commandBus.dispatch({
      type: CREATE_COLD_CHAIN_PROFILE,
      orgId: await getOrgId(),
      actorId: null,
      payload: body,
      metadata: { correlationId: randomUUID(), source: 'api' },
    });

    if (!result.success) {
      reply.code(400);
      return { data: null, error: result.error };
    }

    reply.code(201);
    return { data: result.data, error: null };
  });

  // PUT /api/v1/cold-chain/profiles/:id — Update profile
  server.put('/api/v1/cold-chain/profiles/:id', {
    schema: {
      tags: ['Cold Chain'],
      summary: 'Update a cold chain profile',
      description: 'Updates an existing cold chain profile. Can modify temperature/humidity thresholds or deactivate the profile.',
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', description: 'Profile ID' },
        },
      },
      body: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          description: { type: 'string' },
          minTemperature: { type: 'number' },
          maxTemperature: { type: 'number' },
          alertMinTemperature: { type: 'number' },
          alertMaxTemperature: { type: 'number' },
          minHumidity: { type: 'number' },
          maxHumidity: { type: 'number' },
          alertMinHumidity: { type: 'number' },
          alertMaxHumidity: { type: 'number' },
          active: { type: 'boolean' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            data: { type: 'object' },
            error: { type: ['string', 'null'] },
          },
        },
        400: {
          type: 'object',
          properties: {
            data: { type: 'null' },
            error: { type: 'string' },
          },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const body = req.body as any;

    const result = await commandBus.dispatch({
      type: UPDATE_COLD_CHAIN_PROFILE,
      orgId: await getOrgId(),
      actorId: null,
      payload: { id, data: body },
      metadata: { correlationId: randomUUID(), source: 'api' },
    });

    if (!result.success) {
      reply.code(result.error?.includes('not found') ? 404 : 400);
      return { data: null, error: result.error };
    }

    const updated = await coldChainRepo.getProfile(id);
    return { data: updated, error: null };
  });

  // ─── Temperature Logs ────────────────────────────────────────────────────────

  // GET /api/v1/cold-chain/shipments/:shipmentId/temperature-logs — List temperature logs
  server.get('/api/v1/cold-chain/shipments/:shipmentId/temperature-logs', {
    schema: {
      tags: ['Cold Chain'],
      summary: 'List temperature logs for a shipment',
      description: 'Returns immutable temperature log entries for a shipment. Supports time-range filtering and result limiting.',
      params: {
        type: 'object',
        required: ['shipmentId'],
        properties: {
          shipmentId: { type: 'string', description: 'Shipment ID' },
        },
      },
      querystring: {
        type: 'object',
        properties: {
          since: { type: 'string', format: 'date-time', description: 'Start of time range (ISO 8601)' },
          until: { type: 'string', format: 'date-time', description: 'End of time range (ISO 8601)' },
          limit: { type: 'string', description: 'Maximum number of records to return (default 500, max 5000)' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            data: { type: 'array', items: { type: 'object' } },
            error: { type: ['string', 'null'] },
          },
        },
      },
    },
  }, async (req: FastifyRequest, _reply: FastifyReply) => {
    const { shipmentId } = req.params as { shipmentId: string };
    const query = req.query as { since?: string; until?: string; limit?: string };
    const orgId = await getOrgId();

    const limit = Math.min(parseInt(query.limit || '500', 10), 5000);

    const logs = await server.prisma.immutableTemperatureLog.findMany({
      where: {
        orgId,
        shipmentId,
        ...(query.since || query.until
          ? {
              recordedAt: {
                ...(query.since ? { gte: new Date(query.since) } : {}),
                ...(query.until ? { lte: new Date(query.until) } : {}),
              },
            }
          : {}),
      },
      orderBy: { recordedAt: 'desc' },
      take: limit,
    });

    return { data: logs, error: null };
  });

  // GET /api/v1/cold-chain/shipments/:shipmentId/temperature-summary — Temperature summary
  server.get('/api/v1/cold-chain/shipments/:shipmentId/temperature-summary', {
    schema: {
      tags: ['Cold Chain'],
      summary: 'Get temperature summary for a shipment',
      description: 'Returns aggregate temperature statistics including min, max, average, excursion count, and time-in-range percentage.',
      params: {
        type: 'object',
        required: ['shipmentId'],
        properties: {
          shipmentId: { type: 'string', description: 'Shipment ID' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            data: {
              type: 'object',
              properties: {
                totalReadings: { type: 'number' },
                minTemperature: { type: ['number', 'null'] },
                maxTemperature: { type: ['number', 'null'] },
                avgTemperature: { type: ['number', 'null'] },
                excursionCount: { type: 'number' },
                alertCount: { type: 'number' },
                timeInRangePercent: { type: ['number', 'null'] },
                firstReading: { type: ['string', 'null'] },
                lastReading: { type: ['string', 'null'] },
                monitoringDurationMinutes: { type: ['number', 'null'] },
              },
            },
            error: { type: ['string', 'null'] },
          },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { shipmentId } = req.params as { shipmentId: string };
    try {
      const summary = await coldChainService.getTemperatureSummary(shipmentId);
      return { data: summary, error: null };
    } catch (err: any) {
      reply.code(400);
      return { data: null, error: err.message };
    }
  });

  // ─── Excursions ──────────────────────────────────────────────────────────────

  // GET /api/v1/cold-chain/shipments/:shipmentId/excursions — List excursions for shipment
  server.get('/api/v1/cold-chain/shipments/:shipmentId/excursions', {
    schema: {
      tags: ['Cold Chain'],
      summary: 'List excursions for a shipment',
      description: 'Returns all cold chain excursions (temperature breaches) for a shipment, ordered by most recent first.',
      params: {
        type: 'object',
        required: ['shipmentId'],
        properties: {
          shipmentId: { type: 'string', description: 'Shipment ID' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            data: { type: 'array', items: { type: 'object' } },
            error: { type: ['string', 'null'] },
          },
        },
      },
    },
  }, async (req: FastifyRequest, _reply: FastifyReply) => {
    const { shipmentId } = req.params as { shipmentId: string };
    const excursions = await coldChainRepo.listExcursions(shipmentId);
    return { data: excursions, error: null };
  });

  // GET /api/v1/cold-chain/excursions/:id — Get excursion detail
  server.get('/api/v1/cold-chain/excursions/:id', {
    schema: {
      tags: ['Cold Chain'],
      summary: 'Get excursion detail',
      description: 'Returns a single cold chain excursion by ID with full detail including acknowledgement and resolution status.',
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', description: 'Excursion ID' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            data: { type: 'object' },
            error: { type: ['string', 'null'] },
          },
        },
        404: {
          type: 'object',
          properties: {
            data: { type: 'null' },
            error: { type: 'string' },
          },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const excursion = await coldChainRepo.getExcursion(id);
    if (!excursion) {
      reply.code(404);
      return { data: null, error: 'Excursion not found' };
    }
    return { data: excursion, error: null };
  });

  // POST /api/v1/cold-chain/excursions/:id/acknowledge — Acknowledge excursion
  server.post('/api/v1/cold-chain/excursions/:id/acknowledge', {
    schema: {
      tags: ['Cold Chain'],
      summary: 'Acknowledge a cold chain excursion',
      description: 'Marks an excursion as acknowledged. Transitions status from "active" to "acknowledged" and records who acknowledged it.',
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', description: 'Excursion ID' },
        },
      },
      body: {
        type: 'object',
        properties: {
          notes: { type: 'string', description: 'Optional notes about the acknowledgement' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            data: { type: 'object' },
            error: { type: ['string', 'null'] },
          },
        },
        400: {
          type: 'object',
          properties: {
            data: { type: 'null' },
            error: { type: 'string' },
          },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const body = req.body as { notes?: string } || {};

    const result = await commandBus.dispatch({
      type: ACKNOWLEDGE_EXCURSION,
      orgId: await getOrgId(),
      actorId: null,
      payload: { id, notes: body.notes },
      metadata: { correlationId: randomUUID(), source: 'api' },
    });

    if (!result.success) {
      reply.code(400);
      return { data: null, error: result.error };
    }

    return { data: result.data, error: null };
  });

  // POST /api/v1/cold-chain/excursions/:id/resolve — Resolve excursion with disposition
  server.post('/api/v1/cold-chain/excursions/:id/resolve', {
    schema: {
      tags: ['Cold Chain'],
      summary: 'Resolve a cold chain excursion',
      description: 'Marks an excursion as resolved with a disposition decision (released or quarantined).',
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', description: 'Excursion ID' },
        },
      },
      body: {
        type: 'object',
        required: ['dispositionDecision'],
        properties: {
          dispositionDecision: { type: 'string', enum: ['released', 'quarantined'], description: 'Disposition decision' },
          notes: { type: 'string', description: 'Optional resolution notes' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            data: { type: 'object' },
            error: { type: ['string', 'null'] },
          },
        },
        400: {
          type: 'object',
          properties: {
            data: { type: 'null' },
            error: { type: 'string' },
          },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const body = req.body as { dispositionDecision: string; notes?: string };

    const result = await commandBus.dispatch({
      type: RESOLVE_EXCURSION,
      orgId: await getOrgId(),
      actorId: null,
      payload: { id, dispositionDecision: body.dispositionDecision, notes: body.notes },
      metadata: { correlationId: randomUUID(), source: 'api' },
    });

    if (!result.success) {
      reply.code(400);
      return { data: null, error: result.error };
    }

    return { data: result.data, error: null };
  });

  // ─── Disposition ─────────────────────────────────────────────────────────────

  // POST /api/v1/cold-chain/shipments/:shipmentId/disposition — Set shipment disposition
  server.post('/api/v1/cold-chain/shipments/:shipmentId/disposition', {
    schema: {
      tags: ['Cold Chain'],
      summary: 'Set shipment cold chain disposition',
      description: 'Sets or changes the cold chain disposition on a shipment (released, quarantined, or pending_review).',
      params: {
        type: 'object',
        required: ['shipmentId'],
        properties: {
          shipmentId: { type: 'string', description: 'Shipment ID' },
        },
      },
      body: {
        type: 'object',
        required: ['disposition'],
        properties: {
          disposition: { type: 'string', enum: ['released', 'quarantined', 'pending_review'], description: 'Disposition to set' },
          notes: { type: 'string', description: 'Optional notes about the disposition decision' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            data: { type: 'object' },
            error: { type: ['string', 'null'] },
          },
        },
        400: {
          type: 'object',
          properties: {
            data: { type: 'null' },
            error: { type: 'string' },
          },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { shipmentId } = req.params as { shipmentId: string };
    const body = req.body as { disposition: string; notes?: string };

    const result = await commandBus.dispatch({
      type: SET_DISPOSITION,
      orgId: await getOrgId(),
      actorId: null,
      payload: { shipmentId, disposition: body.disposition, notes: body.notes },
      metadata: { correlationId: randomUUID(), source: 'api' },
    });

    if (!result.success) {
      reply.code(400);
      return { data: null, error: result.error };
    }

    return { data: result.data, error: null };
  });

  // ─── Device Calibration ──────────────────────────────────────────────────────

  // GET /api/v1/cold-chain/devices/:deviceId/calibrations — List calibrations for device
  server.get('/api/v1/cold-chain/devices/:deviceId/calibrations', {
    schema: {
      tags: ['Cold Chain'],
      summary: 'List calibrations for a device',
      description: 'Returns all calibration records for a device, ordered by most recent calibration date first.',
      params: {
        type: 'object',
        required: ['deviceId'],
        properties: {
          deviceId: { type: 'string', description: 'Device ID' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            data: { type: 'array', items: { type: 'object' } },
            error: { type: ['string', 'null'] },
          },
        },
      },
    },
  }, async (req: FastifyRequest, _reply: FastifyReply) => {
    const { deviceId } = req.params as { deviceId: string };
    const calibrations = await coldChainRepo.listCalibrations(deviceId);
    return { data: calibrations, error: null };
  });

  // GET /api/v1/cold-chain/devices/:deviceId/calibration/current — Get current valid calibration
  server.get('/api/v1/cold-chain/devices/:deviceId/calibration/current', {
    schema: {
      tags: ['Cold Chain'],
      summary: 'Get current valid calibration for a device',
      description: 'Returns the latest valid (non-expired) calibration record for a device, or null if none exists.',
      params: {
        type: 'object',
        required: ['deviceId'],
        properties: {
          deviceId: { type: 'string', description: 'Device ID' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            data: { type: ['object', 'null'] },
            error: { type: ['string', 'null'] },
          },
        },
      },
    },
  }, async (req: FastifyRequest, _reply: FastifyReply) => {
    const { deviceId } = req.params as { deviceId: string };
    const calibration = await coldChainRepo.getLatestCalibration(deviceId);
    return { data: calibration, error: null };
  });

  // POST /api/v1/cold-chain/devices/:deviceId/calibrations — Record calibration
  server.post('/api/v1/cold-chain/devices/:deviceId/calibrations', {
    schema: {
      tags: ['Cold Chain'],
      summary: 'Record a device calibration',
      description: 'Records a new calibration entry for a device with certificate details, method, accuracy, and optional document reference.',
      params: {
        type: 'object',
        required: ['deviceId'],
        properties: {
          deviceId: { type: 'string', description: 'Device ID' },
        },
      },
      body: {
        type: 'object',
        required: ['calibratedAt', 'calibratedBy', 'expiresAt'],
        properties: {
          calibratedAt: { type: 'string', format: 'date-time', description: 'When the calibration was performed (ISO 8601)' },
          calibratedBy: { type: 'string', description: 'Name or ID of the person who performed the calibration' },
          certificateNumber: { type: 'string', description: 'Calibration certificate number' },
          expiresAt: { type: 'string', format: 'date-time', description: 'When the calibration expires (ISO 8601)' },
          calibrationMethod: { type: 'string', description: 'Method used for calibration' },
          accuracy: { type: 'number', description: 'Measured accuracy' },
          notes: { type: 'string', description: 'Additional notes' },
          documentStorageKey: { type: 'string', description: 'Storage key for the calibration certificate document' },
        },
      },
      response: {
        201: {
          type: 'object',
          properties: {
            data: { type: 'object' },
            error: { type: ['string', 'null'] },
          },
        },
        400: {
          type: 'object',
          properties: {
            data: { type: 'null' },
            error: { type: 'string' },
          },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { deviceId } = req.params as { deviceId: string };
    const body = req.body as any;

    const result = await commandBus.dispatch({
      type: RECORD_CALIBRATION,
      orgId: await getOrgId(),
      actorId: null,
      payload: { deviceId, ...body },
      metadata: { correlationId: randomUUID(), source: 'api' },
    });

    if (!result.success) {
      reply.code(400);
      return { data: null, error: result.error };
    }

    reply.code(201);
    return { data: result.data, error: null };
  });

  // ─── CAPA Reports ────────────────────────────────────────────────────────────

  // GET /api/v1/cold-chain/capa — List CAPA reports
  server.get('/api/v1/cold-chain/capa', {
    schema: {
      tags: ['Cold Chain'],
      summary: 'List CAPA reports',
      description: 'Returns Corrective and Preventive Action reports. Supports filtering by status, issue ID, and shipment ID.',
      querystring: {
        type: 'object',
        properties: {
          status: { type: 'string', description: 'Filter by CAPA status' },
          issueId: { type: 'string', description: 'Filter by related issue ID' },
          shipmentId: { type: 'string', description: 'Filter by related shipment ID' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            data: { type: 'array', items: { type: 'object' } },
            error: { type: ['string', 'null'] },
          },
        },
      },
    },
  }, async (req: FastifyRequest, _reply: FastifyReply) => {
    const { status, issueId, shipmentId } = req.query as { status?: string; issueId?: string; shipmentId?: string };
    const orgId = await getOrgId();

    // The repository supports status, priority, investigatorId, shipmentId filters.
    // For issueId filtering, we filter after fetching since the repo interface
    // uses CAPAReportFilters which does not include issueId directly.
    const filters: any = {};
    if (status) filters.status = status;
    if (shipmentId) filters.shipmentId = shipmentId;

    let reports = await coldChainRepo.listCAPAReports(orgId, filters);

    if (issueId) {
      reports = reports.filter((r) => r.issueId === issueId);
    }

    return { data: reports, error: null };
  });

  // GET /api/v1/cold-chain/capa/:id — Get CAPA report detail
  server.get('/api/v1/cold-chain/capa/:id', {
    schema: {
      tags: ['Cold Chain'],
      summary: 'Get CAPA report detail',
      description: 'Returns a single CAPA report by ID with related issue and shipment data.',
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', description: 'CAPA report ID' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            data: { type: 'object' },
            error: { type: ['string', 'null'] },
          },
        },
        404: {
          type: 'object',
          properties: {
            data: { type: 'null' },
            error: { type: 'string' },
          },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const report = await coldChainRepo.getCAPAReport(id);
    if (!report) {
      reply.code(404);
      return { data: null, error: 'CAPA report not found' };
    }
    return { data: report, error: null };
  });

  // POST /api/v1/cold-chain/capa — Create CAPA report
  server.post('/api/v1/cold-chain/capa', {
    schema: {
      tags: ['Cold Chain'],
      summary: 'Create a CAPA report',
      description: 'Creates a new Corrective and Preventive Action report. Report number is auto-generated in the format CAPA-YYYYMMDD-NNN.',
      body: {
        type: 'object',
        required: ['issueId', 'title', 'description'],
        properties: {
          issueId: { type: 'string', description: 'Related issue (excursion) ID' },
          shipmentId: { type: 'string', description: 'Related shipment ID' },
          title: { type: 'string' },
          description: { type: 'string' },
          priority: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
          immediateAction: { type: 'string' },
          containmentAction: { type: 'string' },
          investigatorId: { type: 'string' },
          investigatorName: { type: 'string' },
          affectedProducts: { type: 'array', items: { type: 'string' } },
          affectedShipmentIds: { type: 'array', items: { type: 'string' } },
          affectedLocationIds: { type: 'array', items: { type: 'string' } },
          eventTimeline: { type: 'object' },
          temperatureData: { type: 'object' },
        },
      },
      response: {
        201: {
          type: 'object',
          properties: {
            data: { type: 'object' },
            error: { type: ['string', 'null'] },
          },
        },
        400: {
          type: 'object',
          properties: {
            data: { type: 'null' },
            error: { type: 'string' },
          },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const body = req.body as any;

    const result = await commandBus.dispatch({
      type: CREATE_CAPA,
      orgId: await getOrgId(),
      actorId: null,
      payload: body,
      metadata: { correlationId: randomUUID(), source: 'api' },
    });

    if (!result.success) {
      reply.code(400);
      return { data: null, error: result.error };
    }

    reply.code(201);
    return { data: result.data, error: null };
  });

  // PUT /api/v1/cold-chain/capa/:id — Update CAPA report
  server.put('/api/v1/cold-chain/capa/:id', {
    schema: {
      tags: ['Cold Chain'],
      summary: 'Update a CAPA report',
      description: 'Updates an existing CAPA report. Supports updating status, investigation details, root cause, corrective/preventive actions, approval, and verification.',
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', description: 'CAPA report ID' },
        },
      },
      body: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          status: { type: 'string' },
          priority: { type: 'string' },
          description: { type: 'string' },
          immediateAction: { type: 'string' },
          containmentAction: { type: 'string' },
          investigationDetails: { type: 'string' },
          rootCause: { type: 'string' },
          rootCauseCategory: { type: 'string' },
          correctiveAction: { type: 'string' },
          correctiveActionDueDate: { type: 'string', format: 'date-time' },
          correctiveActionCompletedDate: { type: 'string', format: 'date-time' },
          preventiveAction: { type: 'string' },
          preventiveActionDueDate: { type: 'string', format: 'date-time' },
          preventiveActionCompletedDate: { type: 'string', format: 'date-time' },
          investigatorId: { type: 'string' },
          investigatorName: { type: 'string' },
          approverId: { type: 'string' },
          approverName: { type: 'string' },
          approvedAt: { type: 'string', format: 'date-time' },
          verificationMethod: { type: 'string' },
          verifiedById: { type: 'string' },
          verifiedByName: { type: 'string' },
          verifiedAt: { type: 'string', format: 'date-time' },
          effectivenessCheck: { type: 'string' },
          lessonsLearned: { type: 'string' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            data: { type: 'object' },
            error: { type: ['string', 'null'] },
          },
        },
        400: {
          type: 'object',
          properties: {
            data: { type: 'null' },
            error: { type: 'string' },
          },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const body = req.body as any;

    const result = await commandBus.dispatch({
      type: UPDATE_CAPA,
      orgId: await getOrgId(),
      actorId: null,
      payload: { id, data: body },
      metadata: { correlationId: randomUUID(), source: 'api' },
    });

    if (!result.success) {
      reply.code(result.error?.includes('not found') ? 404 : 400);
      return { data: null, error: result.error };
    }

    const updated = await coldChainRepo.getCAPAReport(id);
    return { data: updated, error: null };
  });

  // ─── Compliance Reports ──────────────────────────────────────────────────────

  // POST /api/v1/cold-chain/shipments/:shipmentId/compliance-report — Generate compliance report
  server.post('/api/v1/cold-chain/shipments/:shipmentId/compliance-report', {
    schema: {
      tags: ['Cold Chain'],
      summary: 'Generate a compliance report for a shipment',
      description: 'Generates a cold chain compliance report PDF for a shipment, including temperature data, excursion history, and disposition status.',
      params: {
        type: 'object',
        required: ['shipmentId'],
        properties: {
          shipmentId: { type: 'string', description: 'Shipment ID' },
        },
      },
      response: {
        201: {
          type: 'object',
          properties: {
            data: { type: 'object', description: 'Generated document info' },
            error: { type: ['string', 'null'] },
          },
        },
        400: {
          type: 'object',
          properties: {
            data: { type: 'null' },
            error: { type: 'string' },
          },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { shipmentId } = req.params as { shipmentId: string };

    try {
      const complianceService = container.resolve<any>(TOKENS.IComplianceReportService);
      const document = await complianceService.generateComplianceReport(shipmentId);

      reply.code(201);
      return { data: document, error: null };
    } catch (err: any) {
      reply.code(400);
      return { data: null, error: err.message };
    }
  });
}
