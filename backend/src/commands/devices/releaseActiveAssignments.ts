import { TransactionClient } from '../BaseCommandHandler.js';

/**
 * BUSINESS RULE: a device tracks one thing at a time. Before it's assigned anywhere new, every
 * active assignment it holds is closed. Returns the closed assignment ids so the caller can emit
 * device.unassigned for each.
 */
export async function releaseActiveAssignments(
  tx: TransactionClient,
  orgId: string,
  deviceId: string,
): Promise<string[]> {
  const active = await tx.deviceAssignment.findMany({
    where: { deviceId, active: true, device: { orgId } },
    select: { id: true },
  });
  if (active.length === 0) return [];
  const ids = active.map(a => a.id);
  await tx.deviceAssignment.updateMany({
    where: { id: { in: ids } },
    data: { active: false, unassignedAt: new Date() },
  });
  return ids;
}
