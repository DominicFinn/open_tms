/**
 * Writes a handling unit's warehouse state: where it is, and its quality (#357).
 *
 * The one place warehouse commands move a unit, always scoped by org. Since #357 step 2 the
 * warehouse reads and writes only its HandlingUnit; the TMS TrackableUnit no longer carries bin,
 * zone or quality for it.
 */

import { TransactionClient } from '../BaseCommandHandler.js';

export interface HandlingUnitState {
  currentBinId?: string | null;
  currentZoneId?: string | null;
  qualityStatus?: string;
  receivedAt?: Date | null;
}

/** Updates the named units. Returns how many were in the org. */
export async function setHandlingUnitState(
  tx: TransactionClient,
  orgId: string,
  unitIds: string | readonly string[],
  state: HandlingUnitState,
): Promise<number> {
  const ids = typeof unitIds === 'string' ? [unitIds] : [...unitIds];
  if (ids.length === 0) return 0;
  const { count } = await tx.handlingUnit.updateMany({ where: { orgId, id: { in: ids } }, data: state });
  return count;
}

/** The same for units nested inside another, which move with their parent. */
export async function setChildHandlingUnitState(
  tx: TransactionClient,
  orgId: string,
  parentId: string,
  state: HandlingUnitState,
): Promise<void> {
  await tx.handlingUnit.updateMany({ where: { orgId, parentHandlingUnitId: parentId }, data: state });
}

/**
 * Loads a handling unit within the org, or fails. A unit the projection hasn't created yet reads
 * as not found: it has only just been made upstream, and a retry will find it.
 */
export async function requireHandlingUnit(tx: TransactionClient, orgId: string, id: string): Promise<{ id: string }> {
  const unit = await tx.handlingUnit.findFirst({ where: { id, orgId }, select: { id: true } });
  if (!unit) throw new Error(`Handling unit ${id} not found`);
  return unit;
}
