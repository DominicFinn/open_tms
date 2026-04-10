import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { IArrivalCriteriaRepository } from '../repositories/ArrivalCriteriaRepository.js';
import { ILocationsRepository } from '../repositories/LocationsRepository.js';
import { container, TOKENS } from '../di/index.js';
import { IEventBus, EVENT_TYPES, createEvent } from '../events/index.js';

export async function arrivalCriteriaRoutes(server: FastifyInstance) {
  const arrivalCriteriaRepo = container.resolve<IArrivalCriteriaRepository>(TOKENS.IArrivalCriteriaRepository);
  const locationsRepo = container.resolve<ILocationsRepository>(TOKENS.ILocationsRepository);

  // Get arrival criteria for a location
  server.get('/api/v1/locations/:locationId/arrival-criteria', {
    schema: {
      tags: ['Arrival Criteria'],
      description: 'Get all arrival criteria for a location',
      params: { type: 'object', properties: { locationId: { type: 'string', format: 'uuid' } } },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { locationId } = req.params as { locationId: string };

    const location = await locationsRepo.findById(locationId);
    if (!location) {
      reply.code(404);
      return { data: null, error: 'Location not found' };
    }

    const criteria = await arrivalCriteriaRepo.findByLocationId(locationId);
    return { data: criteria, error: null };
  });

  // Create arrival criteria for a location
  server.post('/api/v1/locations/:locationId/arrival-criteria', {
    schema: {
      tags: ['Arrival Criteria'],
      description: 'Add arrival criteria to a location (geofence, wifi, or ble)',
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { locationId } = req.params as { locationId: string };

    const location = await locationsRepo.findById(locationId);
    if (!location) {
      reply.code(404);
      return { data: null, error: 'Location not found' };
    }

    const body = z.object({
      criteriaType: z.enum(['geofence', 'wifi', 'ble']),
      // Geofence
      radiusMeters: z.number().positive().optional(),
      lat: z.number().optional(),
      lng: z.number().optional(),
      // WiFi
      wifiSsid: z.string().optional(),
      wifiBssid: z.string().optional(),
      // BLE
      bleUuid: z.string().optional(),
      bleMajor: z.number().int().optional(),
      bleMinor: z.number().int().optional(),
      bleRssiThreshold: z.number().int().optional(),
      bleAnchorId: z.string().optional(),
      bleReaderLocation: z.string().optional(),
      // Meta
      name: z.string().optional(),
      priority: z.number().int().default(0),
    }).parse((req as any).body);

    const criteria = await arrivalCriteriaRepo.create({
      locationId,
      ...body,
    });

    // Publish audit event
    try {
      const eventBus = container.resolve<IEventBus>(TOKENS.IEventBus);
      const org = await server.prisma.organization.findFirst({ select: { id: true } });
      await eventBus.publish(createEvent({
        type: EVENT_TYPES.LOCATION_ARRIVAL_CRITERIA_ADDED,
        orgId: org?.id || 'default',
        actorId: req.user?.sub,
        entityType: 'location',
        entityId: locationId,
        payload: {
          locationName: location.name,
          criteriaId: criteria.id,
          criteriaType: body.criteriaType,
        },
        source: 'api',
      }));
    } catch (err) {
      server.log.warn('Failed to publish domain event: ' + (err as Error).message);
    }

    reply.code(201);
    return { data: criteria, error: null };
  });

  // Update arrival criteria
  server.put('/api/v1/locations/:locationId/arrival-criteria/:id', {
    schema: {
      tags: ['Arrival Criteria'],
      description: 'Update arrival criteria',
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { locationId, id } = req.params as { locationId: string; id: string };

    const criteria = await arrivalCriteriaRepo.findById(id);
    if (!criteria || criteria.locationId !== locationId) {
      reply.code(404);
      return { data: null, error: 'Arrival criteria not found' };
    }

    const body = z.object({
      criteriaType: z.enum(['geofence', 'wifi', 'ble']).optional(),
      radiusMeters: z.number().positive().nullable().optional(),
      lat: z.number().nullable().optional(),
      lng: z.number().nullable().optional(),
      wifiSsid: z.string().nullable().optional(),
      wifiBssid: z.string().nullable().optional(),
      bleUuid: z.string().nullable().optional(),
      bleMajor: z.number().int().nullable().optional(),
      bleMinor: z.number().int().nullable().optional(),
      bleRssiThreshold: z.number().int().nullable().optional(),
      bleAnchorId: z.string().nullable().optional(),
      bleReaderLocation: z.string().nullable().optional(),
      name: z.string().nullable().optional(),
      active: z.boolean().optional(),
      priority: z.number().int().optional(),
    }).parse((req as any).body);

    const updated = await arrivalCriteriaRepo.update(id, body);
    return { data: updated, error: null };
  });

  // Delete arrival criteria
  server.delete('/api/v1/locations/:locationId/arrival-criteria/:id', {
    schema: {
      tags: ['Arrival Criteria'],
      description: 'Delete arrival criteria',
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { locationId, id } = req.params as { locationId: string; id: string };

    const criteria = await arrivalCriteriaRepo.findById(id);
    if (!criteria || criteria.locationId !== locationId) {
      reply.code(404);
      return { data: null, error: 'Arrival criteria not found' };
    }

    await arrivalCriteriaRepo.delete(id);
    return { data: { deleted: true }, error: null };
  });
}
