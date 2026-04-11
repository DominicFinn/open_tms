import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';
import { mapEdi214Status, getDefaultStatusMapping } from '../../services/edi214StatusMapping.js';

export interface ProcessInbound214Payload {
  shipmentId: string;
  carrierScac: string;
  proNumber: string;
  statusCode: string;
  reasonCode?: string;
  city: string;
  state: string;
  country?: string;
  statusDate: string; // ISO-8601
  weight?: number;
  referenceNumbers?: Array<{ qualifier: string; number: string }>;
  rawEdiContent: string;
  tradingPartnerId?: string;
}

export const PROCESS_INBOUND_214 = 'shipment.process_inbound_214';

export class ProcessInbound214CommandHandler extends BaseCommandHandler<
  ProcessInbound214Payload,
  { id: string; statusApplied: string }
> {
  readonly commandType = PROCESS_INBOUND_214;

  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) {
    super(prisma, eventBus);
  }

  protected async handle(
    command: Command<ProcessInbound214Payload>,
    tx: TransactionClient,
    emit: EmitFn
  ): Promise<{ id: string; statusApplied: string }> {
    const {
      shipmentId, carrierScac, proNumber, statusCode,
      reasonCode, city, state, country, statusDate,
      rawEdiContent, tradingPartnerId,
    } = command.payload;

    // 1. Find shipment, ensure it exists and is not archived
    const shipment = await tx.shipment.findFirstOrThrow({
      where: { id: shipmentId, archived: false },
      include: {
        stops: {
          include: { location: true },
          orderBy: { sequenceNumber: 'asc' },
        },
      },
    });

    // 2. Resolve status mapping
    const mapping = mapEdi214Status(statusCode) || getDefaultStatusMapping(statusCode);

    // 3. Update shipment status if it differs
    const updateData: Record<string, unknown> = {};
    const statusChanged = mapping.shipmentStatus !== shipment.status;

    if (statusChanged) {
      updateData.status = mapping.shipmentStatus;
    }

    // Set proNumber if we received one and don't already have it
    if (proNumber && !shipment.proNumber) {
      updateData.proNumber = proNumber;
    }

    if (Object.keys(updateData).length > 0) {
      await tx.shipment.update({ where: { id: shipmentId }, data: updateData });
    }

    // 4. Update matching ShipmentStop if the mapping calls for it
    let matchedStopId: string | null = null;
    if (mapping.stopAction && city && shipment.stops.length > 0) {
      const matchedStop = this.findMatchingStop(
        shipment.stops,
        city,
        state,
        mapping.stopAction,
      );

      if (matchedStop) {
        matchedStopId = matchedStop.id;
        const stopUpdate: Record<string, unknown> = {};
        const eventTime = new Date(statusDate);

        if (mapping.stopStatus) {
          stopUpdate.status = mapping.stopStatus;
        }

        if (mapping.stopAction === 'arrive') {
          stopUpdate.actualArrival = eventTime;
          stopUpdate.status = 'arrived';
        } else if (mapping.stopAction === 'depart' || mapping.stopAction === 'complete') {
          stopUpdate.actualDeparture = eventTime;
          stopUpdate.status = 'completed';
        }

        await tx.shipmentStop.update({ where: { id: matchedStop.id }, data: stopUpdate });
      }
    }

    // 5. Create ShipmentEvent for audit trail
    await tx.shipmentEvent.create({
      data: {
        shipmentId,
        eventType: 'edi_214',
        address: city && state ? `${city}, ${state}` : city || '',
        rawPayload: {
          statusCode,
          reasonCode: reasonCode || null,
          carrierScac,
          proNumber,
          tradingPartnerId: tradingPartnerId || null,
          statusDescription: mapping.eventDescription,
        },
        eventTime: new Date(statusDate),
      },
    });

    // 6. Emit domain events

    // Always emit EDI_214_RECEIVED
    emit(this.createEvent(command, {
      type: EVENT_TYPES.EDI_214_RECEIVED,
      entityType: 'shipment',
      entityId: shipmentId,
      payload: {
        shipmentId,
        shipmentReference: shipment.reference,
        carrierScac,
        proNumber,
        statusCode,
        statusDescription: mapping.eventDescription,
        city,
        state,
        tradingPartnerId,
      },
    }));

    // Emit SHIPMENT_STATUS_CHANGED if status actually changed
    if (statusChanged) {
      emit(this.createEvent(command, {
        type: EVENT_TYPES.SHIPMENT_STATUS_CHANGED,
        entityType: 'shipment',
        entityId: shipmentId,
        payload: {
          previousStatus: shipment.status,
          newStatus: mapping.shipmentStatus,
          shipmentReference: shipment.reference,
        },
      }));
    }

    // Emit stop-level events
    if (matchedStopId && mapping.stopAction === 'arrive') {
      emit(this.createEvent(command, {
        type: EVENT_TYPES.SHIPMENT_STOP_ARRIVED,
        entityType: 'shipment',
        entityId: shipmentId,
        payload: {
          stopId: matchedStopId,
          shipmentReference: shipment.reference,
          location: city && state ? `${city}, ${state}` : city,
        },
      }));
    }

    if (matchedStopId && (mapping.stopAction === 'complete' || mapping.stopAction === 'depart')) {
      emit(this.createEvent(command, {
        type: EVENT_TYPES.SHIPMENT_STOP_COMPLETED,
        entityType: 'shipment',
        entityId: shipmentId,
        payload: {
          stopId: matchedStopId,
          shipmentReference: shipment.reference,
          location: city && state ? `${city}, ${state}` : city,
        },
      }));
    }

    // Emit exception event if applicable
    if (mapping.isException) {
      emit(this.createEvent(command, {
        type: EVENT_TYPES.SHIPMENT_EXCEPTION,
        entityType: 'shipment',
        entityId: shipmentId,
        payload: {
          shipmentReference: shipment.reference,
          exceptionType: mapping.exceptionType || 'edi_214',
          description: mapping.eventDescription,
        },
      }));
    }

    // Emit delivered event for D1
    if (mapping.shipmentStatus === 'delivered' && statusChanged) {
      emit(this.createEvent(command, {
        type: EVENT_TYPES.SHIPMENT_DELIVERED,
        entityType: 'shipment',
        entityId: shipmentId,
        payload: {
          shipmentReference: shipment.reference,
          deliveredAt: statusDate,
        },
      }));
    }

    return { id: shipmentId, statusApplied: mapping.shipmentStatus };
  }

  /**
   * Find the best matching ShipmentStop by city/state.
   *
   * Strategy:
   * - For arrivals: find first pending/in_progress stop where location matches
   * - For departures: find first arrived stop where location matches
   * - For completions: find last stop (destination) or location match
   * - Fall back to sequential: first pending stop for arrive, first arrived for depart
   */
  private findMatchingStop(
    stops: Array<{ id: string; status: string; sequenceNumber: number; location: { city: string; state: string | null } }>,
    city: string,
    state: string,
    action: 'arrive' | 'depart' | 'complete',
  ): { id: string } | null {
    const cityLower = city.toLowerCase();
    const stateLower = state.toLowerCase();

    // Try to match by city+state
    const locationMatch = stops.filter(s =>
      s.location.city.toLowerCase() === cityLower &&
      (s.location.state || '').toLowerCase() === stateLower
    );

    if (action === 'arrive') {
      // Prefer a pending stop at this location
      const pendingAtLoc = locationMatch.find(s => s.status === 'pending');
      if (pendingAtLoc) return pendingAtLoc;
      // Fall back: first pending stop overall
      return stops.find(s => s.status === 'pending') || null;
    }

    if (action === 'depart') {
      // Prefer an arrived stop at this location
      const arrivedAtLoc = locationMatch.find(s => s.status === 'arrived');
      if (arrivedAtLoc) return arrivedAtLoc;
      // Fall back: first arrived stop overall
      return stops.find(s => s.status === 'arrived') || null;
    }

    if (action === 'complete') {
      // Prefer a non-completed stop at this location
      const activeAtLoc = locationMatch.find(s => s.status !== 'completed' && s.status !== 'skipped');
      if (activeAtLoc) return activeAtLoc;
      // Fall back: last non-completed stop (likely destination)
      const active = stops.filter(s => s.status !== 'completed' && s.status !== 'skipped');
      return active.length > 0 ? active[active.length - 1] : null;
    }

    return null;
  }
}
