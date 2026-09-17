import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { randomUUID } from 'crypto';
import { ICargoTrackingRepository } from '../repositories/CargoTrackingRepository.js';
import { ICommandBus } from '../commands/CommandBus.js';
import { CommandResult } from '../commands/types.js';
import {
  RECORD_CARGO_SCAN,
  RECONCILE_STOP_CARGO,
  CHECK_LEFT_ON_VEHICLE,
  UPDATE_CARGO_DISCREPANCY,
} from '../commands/cargoTracking/index.js';
import { container, TOKENS } from '../di/index.js';
import { registerOrgScope, requireOrgScope } from '../auth/orgScopeMiddleware.js';

const uuidParam = (name: string) => ({
  type: 'object',
  required: [name],
  properties: { [name]: { type: 'string', format: 'uuid' } },
});

export async function cargoTrackingRoutes(server: FastifyInstance) {
  // Without these, req.orgId is undefined and Prisma reads `orgId: undefined` as no filter at all.
  await registerOrgScope(server);
  server.addHook('preHandler', requireOrgScope);

  const cargoRepo = container.resolve<ICargoTrackingRepository>(TOKENS.ICargoTrackingRepository);
  const commandBus = container.resolve<ICommandBus>(TOKENS.ICommandBus);

  const dispatch = <T>(req: FastifyRequest, type: string, payload: unknown) =>
    commandBus.dispatch<unknown, T>({
      type,
      orgId: req.orgId!,
      actorId: req.user?.sub ?? null,
      payload,
      metadata: { correlationId: randomUUID(), source: 'api' },
    });

  const sendResult = <T>(reply: FastifyReply, result: CommandResult<T>, successCode = 200) => {
    if (!result.success) return reply.code(422).send({ data: null, error: result.error });
    return reply.code(successCode).send({ data: result.data, error: null });
  };

  const notFound = (reply: FastifyReply, what: string) =>
    reply.code(404).send({ data: null, error: `${what} not found` });

  // ─── Cargo Manifest ────────────────────────────────────────────────────────

  server.get('/api/v1/shipments/:shipmentId/cargo-manifest', {
    schema: {
      tags: ['Cargo Tracking'],
      description: 'Get cargo manifest for a shipment: expected vs actual cargo at each stop',
      params: uuidParam('shipmentId'),
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { shipmentId } = req.params as { shipmentId: string };
    const manifest = await cargoRepo.getCargoManifest(req.orgId!, shipmentId);
    if (!manifest) return notFound(reply, 'Shipment');
    return { data: manifest, error: null };
  });

  // ─── Cargo Scans ───────────────────────────────────────────────────────────

  server.post('/api/v1/cargo-scans', {
    schema: {
      tags: ['Cargo Tracking'],
      description: 'Record a cargo scan (load, unload, checkpoint) at a stop. Automatically evaluates for misdrops.',
      body: {
        type: 'object',
        required: ['trackableUnitId', 'shipmentStopId', 'shipmentId', 'scanType', 'scanMethod'],
        additionalProperties: false,
        properties: {
          trackableUnitId: { type: 'string', format: 'uuid' },
          shipmentStopId: { type: 'string', format: 'uuid' },
          shipmentId: { type: 'string', format: 'uuid' },
          scanType: { type: 'string', enum: ['load', 'unload', 'checkpoint'] },
          scanMethod: { type: 'string', enum: ['barcode', 'rfid', 'manual', 'geofence', 'iot'] },
          scannedBy: { type: 'string', maxLength: 255 },
          lat: { type: 'number', minimum: -90, maximum: 90 },
          lng: { type: 'number', minimum: -180, maximum: 180 },
          notes: { type: 'string', maxLength: 2000 },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const body = req.body as { shipmentId: string; shipmentStopId: string };
    const stop = await cargoRepo.findStopInOrg(req.orgId!, body.shipmentStopId);
    if (!stop || stop.shipmentId !== body.shipmentId) return notFound(reply, 'Shipment stop');
    return sendResult(reply, await dispatch(req, RECORD_CARGO_SCAN, body), 201);
  });

  server.get('/api/v1/shipments/:shipmentId/cargo-scans', {
    schema: {
      tags: ['Cargo Tracking'],
      description: 'Get all cargo scans for a shipment',
      params: uuidParam('shipmentId'),
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { shipmentId } = req.params as { shipmentId: string };
    if (!(await cargoRepo.findShipmentInOrg(req.orgId!, shipmentId))) return notFound(reply, 'Shipment');
    return { data: await cargoRepo.findScansByShipment(req.orgId!, shipmentId), error: null };
  });

  server.get('/api/v1/shipment-stops/:stopId/cargo-scans', {
    schema: {
      tags: ['Cargo Tracking'],
      description: 'Get all cargo scans for a specific stop',
      params: uuidParam('stopId'),
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { stopId } = req.params as { stopId: string };
    if (!(await cargoRepo.findStopInOrg(req.orgId!, stopId))) return notFound(reply, 'Shipment stop');
    return { data: await cargoRepo.findScansByStop(req.orgId!, stopId), error: null };
  });

  // ─── Cargo Discrepancies ───────────────────────────────────────────────────

  server.get('/api/v1/shipments/:shipmentId/cargo-discrepancies', {
    schema: {
      tags: ['Cargo Tracking'],
      description: 'Get all cargo discrepancies for a shipment',
      params: uuidParam('shipmentId'),
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { shipmentId } = req.params as { shipmentId: string };
    if (!(await cargoRepo.findShipmentInOrg(req.orgId!, shipmentId))) return notFound(reply, 'Shipment');
    return { data: await cargoRepo.findDiscrepanciesByShipment(req.orgId!, shipmentId), error: null };
  });

  server.get('/api/v1/cargo-discrepancies', {
    schema: {
      tags: ['Cargo Tracking'],
      description: "Get the organization's open cargo discrepancies across all shipments",
    },
  }, async (req: FastifyRequest) => {
    return { data: await cargoRepo.findOpenDiscrepancies(req.orgId!), error: null };
  });

  server.get('/api/v1/cargo-discrepancies/:id', {
    schema: {
      tags: ['Cargo Tracking'],
      description: 'Get a specific cargo discrepancy by ID',
      params: uuidParam('id'),
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const discrepancy = await cargoRepo.findDiscrepancyById(req.orgId!, id);
    if (!discrepancy) return notFound(reply, 'Discrepancy');
    return { data: discrepancy, error: null };
  });

  server.patch('/api/v1/cargo-discrepancies/:id', {
    schema: {
      tags: ['Cargo Tracking'],
      description: 'Update a cargo discrepancy (status, resolution, notes)',
      params: uuidParam('id'),
      body: {
        type: 'object',
        additionalProperties: false,
        minProperties: 1,
        properties: {
          status: { type: 'string', enum: ['open', 'investigating', 'resolved', 'dismissed'] },
          resolvedBy: { type: 'string', maxLength: 255 },
          resolution: { type: 'string', maxLength: 2000 },
          notes: { type: 'string', maxLength: 2000 },
          severity: { type: 'string', enum: ['critical', 'high', 'medium', 'low'] },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    if (!(await cargoRepo.findDiscrepancyById(req.orgId!, id))) return notFound(reply, 'Discrepancy');
    const body = req.body as Record<string, unknown>;
    return sendResult(reply, await dispatch(req, UPDATE_CARGO_DISCREPANCY, { ...body, id }));
  });

  // ─── Reconciliation Triggers ───────────────────────────────────────────────

  server.post('/api/v1/shipment-stops/:stopId/reconcile-cargo', {
    schema: {
      tags: ['Cargo Tracking'],
      description: 'Trigger cargo reconciliation for a specific stop (compares expected vs scanned)',
      params: uuidParam('stopId'),
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { stopId } = req.params as { stopId: string };
    if (!(await cargoRepo.findStopInOrg(req.orgId!, stopId))) return notFound(reply, 'Shipment stop');
    return sendResult(reply, await dispatch(req, RECONCILE_STOP_CARGO, { shipmentStopId: stopId }));
  });

  server.post('/api/v1/shipments/:shipmentId/check-left-on-vehicle', {
    schema: {
      tags: ['Cargo Tracking'],
      description: 'Check for cargo left on vehicle after all stops are completed',
      params: uuidParam('shipmentId'),
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { shipmentId } = req.params as { shipmentId: string };
    if (!(await cargoRepo.findShipmentInOrg(req.orgId!, shipmentId))) return notFound(reply, 'Shipment');
    return sendResult(reply, await dispatch(req, CHECK_LEFT_ON_VEHICLE, { shipmentId }));
  });
}
