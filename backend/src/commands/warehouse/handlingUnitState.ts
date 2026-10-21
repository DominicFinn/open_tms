/**
 * Dual-write of a unit's warehouse state during the TrackableUnit split (#357).
 *
 * The warehouse still writes bin and zone onto the TMS TrackableUnit while its reads are switched
 * over. Every such write is mirrored onto the HandlingUnit with the same id, so the handling unit
 * is already right when reads move to it. This goes when they do.
 *
 * updateMany, scoped by org, so a unit the projection hasn't reached yet is a no-op rather than an
 * error. The read switch re-copies state from TrackableUnit first, which closes that gap.
 */

import { TransactionClient } from '../BaseCommandHandler.js';

export interface HandlingUnitState {
  currentBinId?: string | null;
  currentZoneId?: string | null;
  receivedAt?: Date | null;
}

export async function mirrorHandlingUnitState(
  tx: TransactionClient,
  orgId: string,
  unitIds: string | readonly string[],
  state: HandlingUnitState,
): Promise<void> {
  const ids = typeof unitIds === 'string' ? [unitIds] : [...unitIds];
  if (ids.length === 0) return;
  await tx.handlingUnit.updateMany({ where: { orgId, id: { in: ids } }, data: state });
}

/** The same mirror for units nested inside another, which move with their parent. */
export async function mirrorChildHandlingUnitState(
  tx: TransactionClient,
  orgId: string,
  parentId: string,
  state: HandlingUnitState,
): Promise<void> {
  await tx.handlingUnit.updateMany({ where: { orgId, parentHandlingUnitId: parentId }, data: state });
}
