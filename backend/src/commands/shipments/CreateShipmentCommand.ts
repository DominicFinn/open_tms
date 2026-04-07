/**
 * CreateShipmentCommand — creates a new shipment and emits SHIPMENT_CREATED.
 *
 * Extracts logic from POST /api/v1/shipments route. Wraps the write in a
 * transaction (the route previously did not) and publishes the domain event
 * after commit.
 */

import { PrismaClient } from '@prisma/client';
import { IEventBus } from '../../events/IEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { IQueueAdapter } from '../../queue/IQueueAdapter.js';
import { QUEUES } from '../../queue/events.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';

export interface CreateShipmentPayload {
  reference: string;
  customerId: string;
  laneId?: string;
  carrierId?: string;
  originId?: string;
  destinationId?: string;
  pickupDate?: string;
  deliveryDate?: string;
  proNumber?: string;
  items?: Array<{
    sku: string;
    description?: string;
    quantity: number;
    weightKg?: number;
    volumeM3?: number;
  }>;
}

export interface CreateShipmentResult {
  id: string;
  reference: string;
  status: string;
  originId: string;
  destinationId: string;
}

export const CREATE_SHIPMENT = 'shipment.create';

export class CreateShipmentCommandHandler extends BaseCommandHandler<CreateShipmentPayload, CreateShipmentResult> {
  readonly commandType = CREATE_SHIPMENT;

  constructor(
    prisma: PrismaClient,
    eventBus: IEventBus,
    private queue: IQueueAdapter
  ) {
    super(prisma, eventBus);
  }

  protected async handle(
    command: Command<CreateShipmentPayload>,
    tx: TransactionClient,
    emit: EmitFn
  ): Promise<CreateShipmentResult> {
    const body = command.payload;

    // Resolve origin/destination from lane if needed
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

    if (!finalOriginId || !finalDestinationId) {
      throw new Error('Either laneId or both originId and destinationId must be provided');
    }

    const shipment = await tx.shipment.create({
      data: {
        reference: body.reference,
        customerId: body.customerId,
        laneId: body.laneId,
        carrierId: body.carrierId,
        originId: finalOriginId,
        destinationId: finalDestinationId,
        pickupDate: body.pickupDate ? new Date(body.pickupDate) : undefined,
        deliveryDate: body.deliveryDate ? new Date(body.deliveryDate) : undefined,
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
      originId: finalOriginId,
      destinationId: finalDestinationId,
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
