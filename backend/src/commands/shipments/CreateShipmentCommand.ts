/**
 * CreateShipmentCommand — creates a new shipment and emits SHIPMENT_CREATED.
 *
 * Extracts logic from POST /api/v1/shipments route. Wraps the write in a
 * transaction (the route previously did not) and publishes the domain event
 * after commit.
 */

import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { IQueueAdapter } from '../../queue/IQueueAdapter.js';
import { QUEUES } from '../../queue/events.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';
import { reconcileShipmentDevices } from './reconcileShipmentDevices.js';

export interface CreateShipmentPayload {
  reference?: string;
  /** Multi-tenancy scope. Route handlers thread this from the JWT. */
  orgId?: string | null;
  customerId: string;
  laneId?: string;
  carrierId?: string;
  originId?: string;
  destinationId?: string;
  // Raw address data for auto-resolution (used when no explicit IDs provided)
  originData?: {
    name: string;
    address1: string;
    address2?: string;
    city: string;
    state?: string;
    postalCode?: string;
    country: string;
    lat?: number;
    lng?: number;
  };
  destinationData?: {
    name: string;
    address1: string;
    address2?: string;
    city: string;
    state?: string;
    postalCode?: string;
    country: string;
    lat?: number;
    lng?: number;
  };
  pickupDate?: string;
  deliveryDate?: string;
  pickupWindowStart?: string;
  pickupWindowEnd?: string;
  deliveryWindowStart?: string;
  deliveryWindowEnd?: string;
  shipmentTypeId?: string;
  proNumber?: string;
  items?: Array<{
    sku: string;
    description?: string;
    quantity: number;
    weightKg?: number;
    volumeM3?: number;
  }>;
  devices?: Array<{ name: string; externalId: string }>;
}

export interface CreateShipmentResult {
  id: string;
  reference: string;
  status: string;
  originId: string | null;
  destinationId: string | null;
}

export const CREATE_SHIPMENT = 'shipment.create';

export class CreateShipmentCommandHandler extends BaseCommandHandler<CreateShipmentPayload, CreateShipmentResult> {
  readonly commandType = CREATE_SHIPMENT;

  constructor(
    prisma: PrismaClient,
    eventBus: PgBossEventBus,
    private queue: IQueueAdapter,
  ) {
    super(prisma, eventBus);
  }

  protected async handle(
    command: Command<CreateShipmentPayload>,
    tx: TransactionClient,
    emit: EmitFn
  ): Promise<CreateShipmentResult> {
    const body = command.payload;

    // Multi-tenancy: resolve the writing orgId once at the top so every
    // entity created in this transaction lands in the same tenant. Both
    // Shipment.orgId and Location.orgId are NOT NULL post phase-2/3.
    const orgIdToWrite = body.orgId || command.orgId;
    if (!orgIdToWrite) {
      throw new Error('orgId is required to create a Shipment (multi-tenancy)');
    }

    // Resolve origin/destination from lane, explicit IDs, or raw address data
    let finalOriginId = body.originId;
    let finalDestinationId = body.destinationId;

    if (body.laneId) {
      const lane = await tx.lane.findFirst({
        where: { id: body.laneId, archived: false },
        include: { origin: true, destination: true },
      });
      if (!lane) {
        throw new Error('Lane not found');
      }
      finalOriginId = lane.originId;
      finalDestinationId = lane.destinationId;
    }

    // Auto-resolve origin from raw address data if no explicit ID
    if (!finalOriginId && body.originData) {
      const existing = await tx.location.findFirst({
        where: {
          archived: false,
          name: { equals: body.originData.name, mode: 'insensitive' },
          city: { equals: body.originData.city, mode: 'insensitive' },
        },
      });
      if (existing) {
        finalOriginId = existing.id;
      } else {
        const created = await tx.location.create({
          data: {
            orgId: orgIdToWrite,
            name: body.originData.name,
            address1: body.originData.address1,
            address2: body.originData.address2,
            city: body.originData.city,
            state: body.originData.state,
            postalCode: body.originData.postalCode,
            country: body.originData.country,
            lat: body.originData.lat,
            lng: body.originData.lng,
          },
        });
        finalOriginId = created.id;

        // Emit audit event for auto-created location
        emit(this.createEvent(command, {
          type: EVENT_TYPES.LOCATION_CREATED,
          entityType: 'location',
          entityId: created.id,
          payload: {
            locationName: body.originData.name,
            name: body.originData.name,
            city: body.originData.city,
            country: body.originData.country,
            source: 'shipment_resolution',
          },
        }));
      }
    }

    // Auto-resolve destination from raw address data if no explicit ID
    if (!finalDestinationId && body.destinationData) {
      const existing = await tx.location.findFirst({
        where: {
          archived: false,
          name: { equals: body.destinationData.name, mode: 'insensitive' },
          city: { equals: body.destinationData.city, mode: 'insensitive' },
        },
      });
      if (existing) {
        finalDestinationId = existing.id;
      } else {
        const created = await tx.location.create({
          data: {
            orgId: orgIdToWrite,
            name: body.destinationData.name,
            address1: body.destinationData.address1,
            address2: body.destinationData.address2,
            city: body.destinationData.city,
            state: body.destinationData.state,
            postalCode: body.destinationData.postalCode,
            country: body.destinationData.country,
            lat: body.destinationData.lat,
            lng: body.destinationData.lng,
          },
        });
        finalDestinationId = created.id;

        // Emit audit event for auto-created location
        emit(this.createEvent(command, {
          type: EVENT_TYPES.LOCATION_CREATED,
          entityType: 'location',
          entityId: created.id,
          payload: {
            locationName: body.destinationData.name,
            name: body.destinationData.name,
            city: body.destinationData.city,
            country: body.destinationData.country,
            source: 'shipment_resolution',
          },
        }));
      }
    }

    // A draft may be created with a partial/absent route; completeness (lane OR
    // origin+destination) is enforced only at the ready transition.

    const reference = body.reference && body.reference.trim().length > 0
      ? body.reference
      : `DRAFT-${Date.now().toString(36).toUpperCase()}`;

    // Multi-tenancy: prefer the explicit payload orgId (admin tools acting
    // on behalf of a tenant); fall back to command.orgId (the JWT path).
    // Shipment.orgId is NOT NULL post phase-2 tightening — orgIdToWrite
    // was resolved at the top of this method so every entity in this
    // transaction lands in the same tenant.

    const shipment = await tx.shipment.create({
      data: {
        reference,
        orgId: orgIdToWrite,
        customerId: body.customerId,
        laneId: body.laneId,
        carrierId: body.carrierId,
        originId: finalOriginId ?? null,
        destinationId: finalDestinationId ?? null,
        pickupDate: body.pickupDate ? new Date(body.pickupDate) : undefined,
        deliveryDate: body.deliveryDate ? new Date(body.deliveryDate) : undefined,
        pickupWindowStart: body.pickupWindowStart ? new Date(body.pickupWindowStart) : undefined,
        pickupWindowEnd: body.pickupWindowEnd ? new Date(body.pickupWindowEnd) : undefined,
        deliveryWindowStart: body.deliveryWindowStart ? new Date(body.deliveryWindowStart) : undefined,
        deliveryWindowEnd: body.deliveryWindowEnd ? new Date(body.deliveryWindowEnd) : undefined,
        shipmentTypeId: body.shipmentTypeId,
        proNumber: body.proNumber,
        items: body.items ?? [],
        status: 'draft',
      },
      include: {
        customer: { select: { id: true, name: true } },
        origin: { select: { id: true, name: true, city: true, state: true } },
        destination: { select: { id: true, name: true, city: true, state: true } },
        carrier: { select: { id: true, name: true } },
        lane: body.laneId ? { select: { id: true, name: true } } : false,
      },
    });

    // Emit domain event
    emit(
      this.createEvent(command, {
        type: EVENT_TYPES.SHIPMENT_CREATED,
        entityType: 'shipment',
        entityId: shipment.id,
        payload: {
          shipmentReference: shipment.reference,
          customerId: body.customerId,
          originId: finalOriginId,
          destinationId: finalDestinationId,
          carrierId: body.carrierId,
          laneId: body.laneId,
          status: 'draft',
        },
      })
    );

    // Assign any IoT devices entered on the form (creates Device + active
    // DeviceAssignment so System Loco webhooks resolve to this shipment).
    await reconcileShipmentDevices(tx, {
      orgId: orgIdToWrite,
      shipmentId: shipment.id,
      devices: body.devices,
      emitAssigned: (deviceId, assignmentId) => emit(this.createEvent(command, {
        type: EVENT_TYPES.DEVICE_ASSIGNED,
        entityType: 'device',
        entityId: deviceId,
        payload: { assignmentId, shipmentId: shipment.id },
      })),
      emitUnassigned: (deviceId, assignmentId) => emit(this.createEvent(command, {
        type: EVENT_TYPES.DEVICE_UNASSIGNED,
        entityType: 'device',
        entityId: deviceId,
        payload: { assignmentId, shipmentId: shipment.id },
      })),
    });

    // Enqueue for outbound integrations (fire-and-forget, after tx commits)
    // Note: queue publishing happens in execute() override below
    (shipment as any)._queuePayload = {
      shipmentId: shipment.id,
      eventType: 'created' as const,
      shipmentReference: shipment.reference,
      carrierId: shipment.carrierId || undefined,
    };

    return {
      id: shipment.id,
      reference: shipment.reference,
      status: 'draft',
      originId: finalOriginId ?? null,
      destinationId: finalDestinationId ?? null,
    };
  }

  /**
   * Override execute to also publish queue messages after transaction commits.
   */
  async execute(command: Command<CreateShipmentPayload>) {
    const result = await super.execute(command);

    // Publish to integration queues after successful command
    if (result.success && result.data) {
      const queuePayload = {
        shipmentId: result.data.id,
        eventType: 'created' as const,
        shipmentReference: result.data.reference,
      };
      try {
        await this.queue.publish(QUEUES.OUTBOUND_CARRIER, {
          type: 'shipment.created',
          payload: queuePayload,
        });
        await this.queue.publish(QUEUES.OUTBOUND_TRACKING, {
          type: 'shipment.created',
          payload: queuePayload,
        });
      } catch (err) {
        console.error(`[CreateShipment] Failed to publish to integration queues: ${(err as Error).message}`);
      }
    }

    return result;
  }
}
