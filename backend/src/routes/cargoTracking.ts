import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { ICargoTrackingRepository } from '../repositories/CargoTrackingRepository.js';
import { ICargoReconciliationService } from '../services/CargoReconciliationService.js';
import { container, TOKENS } from '../di/index.js';
import { IEventBus, EVENT_TYPES, createEvent } from '../events/index.js';

export async function cargoTrackingRoutes(server: FastifyInstance) {
  const cargoRepo = container.resolve<ICargoTrackingRepository>(TOKENS.ICargoTrackingRepository);
  const reconciliationService = container.resolve<ICargoReconciliationService>(TOKENS.ICargoReconciliationService);

  // ─── Cargo Manifest ────────────────────────────────────────────────────────

  server.get('/api/v1/shipments/:shipmentId/cargo-manifest', {
    schema: {
      tags: ['Cargo Tracking'],
      description: 'Get cargo manifest for a shipment — expected vs actual cargo at each stop',
      params: {
        type: 'object',
        properties: { shipmentId: { type: 'string', format: 'uuid' } },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { shipmentId } = req.params as { shipmentId: string };
    try {
      const manifest = await cargoRepo.getCargoManifest(shipmentId);
      return { data: manifest, error: null };
    } catch (err: any) {
      reply.code(500);
      return { data: null, error: err.message };
    }
  });

  // ─── Cargo Scans ───────────────────────────────────────────────────────────

  server.post('/api/v1/cargo-scans', {
    schema: {
      tags: ['Cargo Tracking'],
      description: 'Record a cargo scan (load, unload, checkpoint) at a stop. Automatically evaluates for misdrops.',
      body: {
        type: 'object',
        required: ['trackableUnitId', 'shipmentStopId', 'shipmentId', 'scanType', 'scanMethod'],
        properties: {
          trackableUnitId: { type: 'string', format: 'uuid' },
          shipmentStopId: { type: 'string', format: 'uuid' },
          shipmentId: { type: 'string', format: 'uuid' },
          scanType: { type: 'string', enum: ['load', 'unload', 'checkpoint'] },
          scanMethod: { type: 'string', enum: ['barcode', 'rfid', 'manual', 'geofence', 'iot'] },
          scannedBy: { type: 'string' },
          lat: { type: 'number' },
          lng: { type: 'number' },
          notes: { type: 'string' },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const body = req.body as any;
    try {
      const result = await reconciliationService.recordCargoScan(body);
      reply.code(201);
      return { data: result, error: null };
    } catch (err: any) {
      reply.code(400);
      return { data: null, error: err.message };
    }
  });

  server.get('/api/v1/shipments/:shipmentId/cargo-scans', {
    schema: {
      tags: ['Cargo Tracking'],
      description: 'Get all cargo scans for a shipment',
      params: {
        type: 'object',
        properties: { shipmentId: { type: 'string', format: 'uuid' } },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { shipmentId } = req.params as { shipmentId: string };
    try {
      const scans = await cargoRepo.findScansByShipment(shipmentId);
      return { data: scans, error: null };
    } catch (err: any) {
      reply.code(500);
      return { data: null, error: err.message };
    }
  });

  server.get('/api/v1/shipment-stops/:stopId/cargo-scans', {
    schema: {
      tags: ['Cargo Tracking'],
      description: 'Get all cargo scans for a specific stop',
      params: {
        type: 'object',
        properties: { stopId: { type: 'string', format: 'uuid' } },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { stopId } = req.params as { stopId: string };
    try {
      const scans = await cargoRepo.findScansByStop(stopId);
      return { data: scans, error: null };
    } catch (err: any) {
      reply.code(500);
      return { data: null, error: err.message };
    }
  });

  // ─── Cargo Discrepancies ───────────────────────────────────────────────────

  server.get('/api/v1/shipments/:shipmentId/cargo-discrepancies', {
    schema: {
      tags: ['Cargo Tracking'],
      description: 'Get all cargo discrepancies for a shipment',
      params: {
        type: 'object',
        properties: { shipmentId: { type: 'string', format: 'uuid' } },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { shipmentId } = req.params as { shipmentId: string };
    try {
      const discrepancies = await cargoRepo.findDiscrepanciesByShipment(shipmentId);
      return { data: discrepancies, error: null };
    } catch (err: any) {
      reply.code(500);
      return { data: null, error: err.message };
    }
  });

  server.get('/api/v1/cargo-discrepancies', {
    schema: {
      tags: ['Cargo Tracking'],
      description: 'Get all open cargo discrepancies across all shipments',
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const discrepancies = await cargoRepo.findOpenDiscrepancies();
      return { data: discrepancies, error: null };
    } catch (err: any) {
      reply.code(500);
      return { data: null, error: err.message };
    }
  });

  server.get('/api/v1/cargo-discrepancies/:id', {
    schema: {
      tags: ['Cargo Tracking'],
      description: 'Get a specific cargo discrepancy by ID',
      params: {
        type: 'object',
        properties: { id: { type: 'string', format: 'uuid' } },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    try {
      const discrepancy = await cargoRepo.findDiscrepancyById(id);
      if (!discrepancy) {
        reply.code(404);
        return { data: null, error: 'Discrepancy not found' };
      }
      return { data: discrepancy, error: null };
    } catch (err: any) {
      reply.code(500);
      return { data: null, error: err.message };
    }
  });

  server.patch('/api/v1/cargo-discrepancies/:id', {
    schema: {
      tags: ['Cargo Tracking'],
      description: 'Update a cargo discrepancy (status, resolution, notes)',
      params: {
        type: 'object',
        properties: { id: { type: 'string', format: 'uuid' } },
      },
      body: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['open', 'investigating', 'resolved', 'dismissed'] },
          resolvedBy: { type: 'string' },
          resolution: { type: 'string' },
          notes: { type: 'string' },
          severity: { type: 'string', enum: ['critical', 'high', 'medium', 'low'] },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const body = req.body as any;
    try {
      const existing = await cargoRepo.findDiscrepancyById(id);
      if (!existing) {
        reply.code(404);
        return { data: null, error: 'Discrepancy not found' };
      }

      const updated = await cargoRepo.updateDiscrepancy(id, body);

      // If resolved, publish event
      if (body.status === 'resolved') {
        const unit = (updated as any).trackableUnit;
        try {
          const eventBus = container.resolve<any>(TOKENS.IEventBus);
          const { randomUUID } = await import('crypto');
          await eventBus.publish({
            id: randomUUID(),
            type: EVENT_TYPES.CARGO_DISCREPANCY_RESOLVED,
            timestamp: new Date().toISOString(),
            orgId: 'default',
            actorId: body.resolvedBy || null,
            entityType: 'cargo_discrepancy',
            entityId: id,
            payload: {
              shipmentId: (updated as any).shipmentId,
              trackableUnitId: (updated as any).trackableUnitId,
              unitIdentifier: unit?.identifier,
              unitType: unit?.unitType,
              discrepancyType: (updated as any).discrepancyType,
              resolution: body.resolution,
            },
            metadata: { correlationId: randomUUID(), source: 'api', schemaVersion: 1 },
          });
        } catch { /* best-effort */ }
      }

      return { data: updated, error: null };
    } catch (err: any) {
      reply.code(400);
      return { data: null, error: err.message };
    }
  });

  // ─── Reconciliation Triggers ───────────────────────────────────────────────

  server.post('/api/v1/shipment-stops/:stopId/reconcile-cargo', {
    schema: {
      tags: ['Cargo Tracking'],
      description: 'Trigger cargo reconciliation for a specific stop (compares expected vs scanned)',
      params: {
        type: 'object',
        properties: { stopId: { type: 'string', format: 'uuid' } },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { stopId } = req.params as { stopId: string };
    try {
      const result = await reconciliationService.reconcileStopCompletion(stopId);
      return { data: result, error: null };
    } catch (err: any) {
      reply.code(400);
      return { data: null, error: err.message };
    }
  });

  server.post('/api/v1/shipments/:shipmentId/check-left-on-vehicle', {
    schema: {
      tags: ['Cargo Tracking'],
      description: 'Check for cargo left on vehicle after all stops are completed',
      params: {
        type: 'object',
        properties: { shipmentId: { type: 'string', format: 'uuid' } },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { shipmentId } = req.params as { shipmentId: string };
    try {
      const result = await reconciliationService.checkLeftOnVehicle(shipmentId);
      return { data: result, error: null };
    } catch (err: any) {
      reply.code(400);
      return { data: null, error: err.message };
    }
  });
}
