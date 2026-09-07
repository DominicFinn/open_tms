/**
 * Facility resolution for the Phase 2a dual-write (#217).
 *
 * BUSINESS RULE: every storage topology row created against a Location must also be filed under
 * the Facility derived from that Location, so that when reads switch over in a later chunk there
 * is no row without a facility. The migration backfills what already exists; this covers rows
 * created after it ran.
 *
 * Find-or-create rather than a separate CREATE_FACILITY dispatch, because the facility must land
 * in the same transaction as the row that needs it. The create is idempotent through the
 * (orgId, sourceLocationId) unique constraint.
 */

import { TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { createEvent } from '../../events/createEvent.js';
import { Command } from '../types.js';

/**
 * Returns the id of the Facility for this org and Location, creating it from the Location's
 * details if it does not exist yet. Emits `facility.created` when it creates one.
 */
export async function resolveFacilityForLocation(
  tx: TransactionClient,
  command: Command<unknown>,
  locationId: string,
  emit: EmitFn
): Promise<string> {
  const orgId = command.orgId;

  const existing = await tx.facility.findUnique({
    where: { orgId_sourceLocationId: { orgId, sourceLocationId: locationId } },
    select: { id: true },
  });
  if (existing) return existing.id;

  // Location lives in core, which wms may depend on. The reverse would not be allowed.
  const location = await tx.location.findFirst({
    where: { id: locationId, orgId },
    select: {
      name: true, address1: true, address2: true,
      city: true, state: true, postalCode: true, country: true,
    },
  });
  if (!location) throw new Error(`Location ${locationId} not found`);

  const facility = await tx.facility.create({
    data: {
      orgId,
      name: location.name,
      sourceLocationId: locationId,
      address1: location.address1,
      address2: location.address2,
      city: location.city,
      state: location.state,
      postalCode: location.postalCode,
      country: location.country,
    },
  });

  emit(createEvent({
    type: EVENT_TYPES.FACILITY_CREATED,
    entityType: 'facility',
    entityId: facility.id,
    orgId,
    actorId: command.actorId,
    correlationId: command.metadata.correlationId,
    source: command.metadata.source,
    payload: { sourceLocationId: locationId, derived: true },
  }));

  return facility.id;
}
