import { TransactionClient } from '../BaseCommandHandler.js';

export interface ShipmentDeviceInput {
  name: string;
  externalId: string;
}

export interface ReconcileShipmentDevicesParams {
  orgId: string;
  shipmentId: string;
  /** undefined = caller isn't touching devices (no-op); [] = remove all. */
  devices: ShipmentDeviceInput[] | undefined;
  emitAssigned: (deviceId: string, assignmentId: string) => void;
  emitUnassigned: (deviceId: string, assignmentId: string) => void;
}

/**
 * Reconcile a shipment's active IoT device assignments against the desired list.
 *
 * Upserts a Device per external id (provider system_loco), creates active
 * DeviceAssignments for newly-added devices (deactivating the device's prior
 * assignment elsewhere), and deactivates assignments for devices dropped from
 * the list. Idempotent: re-running with the same list makes no changes.
 *
 * The existing System Loco webhook resolution (SystemLocoAdapter.resolveAssignment)
 * then finds the shipment via the active assignment by device id.
 */
export async function reconcileShipmentDevices(
  tx: TransactionClient,
  { orgId, shipmentId, devices, emitAssigned, emitUnassigned }: ReconcileShipmentDevicesParams
): Promise<void> {
  if (devices === undefined) return;

  const desired = new Map<string, string>();
  for (const d of devices) {
    if (d.externalId && d.name) desired.set(d.externalId, d.name);
  }

  const current = await tx.deviceAssignment.findMany({
    where: { shipmentId, active: true },
    include: { device: { select: { id: true, externalId: true } } },
  });
  const currentExternalIds = new Set(current.map(a => a.device.externalId));

  // Remove assignments for devices no longer in the desired list.
  for (const a of current) {
    if (!desired.has(a.device.externalId)) {
      await tx.deviceAssignment.update({
        where: { id: a.id },
        data: { active: false, unassignedAt: new Date() },
      });
      emitUnassigned(a.deviceId, a.id);
    }
  }

  // Add / ensure assignments for desired devices.
  for (const [externalId, name] of desired) {
    const device = await tx.device.upsert({
      where: { externalId },
      update: { name },
      create: { orgId, externalId, name, provider: 'system_loco' },
    });

    if (currentExternalIds.has(externalId)) continue; // already active on this shipment

    // A device tracks one thing at a time — release any active assignment elsewhere.
    await tx.deviceAssignment.updateMany({
      where: { deviceId: device.id, active: true },
      data: { active: false, unassignedAt: new Date() },
    });

    const assignment = await tx.deviceAssignment.create({
      data: { deviceId: device.id, shipmentId, active: true },
    });
    emitAssigned(device.id, assignment.id);
  }
}
