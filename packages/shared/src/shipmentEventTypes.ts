/**
 * Canonical shipment timeline event types, shared by the backend timeline
 * projection/backfill/filter and the frontend filter dropdown + labels.
 *
 * Shipment events are platform-generated and read-only — there is no manual
 * event creation. Legacy device/EDI rows (e.g. "location", "status_change",
 * "edi_214") still render via the humanized fallback in shipmentEventLabel().
 */

export interface ShipmentEventTypeDef {
  type: string;
  label: string;
}

export const SHIPMENT_EVENT_TYPES: ShipmentEventTypeDef[] = [
  { type: 'created', label: 'Created' },
  { type: 'updated', label: 'Updated' },
  { type: 'status_changed', label: 'Status changed' },
  { type: 'carrier_assigned', label: 'Carrier assigned' },
  { type: 'leaves_origin', label: 'Leaves origin' },
  { type: 'entered_waypoint', label: 'Entered waypoint' },
  { type: 'exited_waypoint', label: 'Exited waypoint' },
  { type: 'enters_destination', label: 'Enters destination' },
  { type: 'delivered', label: 'Delivered' },
  { type: 'exception', label: 'Exception' },
  { type: 'archived', label: 'Archived' },
  { type: 'unarchived', label: 'Unarchived' },
  { type: 'deleted', label: 'Deleted' },
];

const LABELS: Record<string, string> = Object.fromEntries(
  SHIPMENT_EVENT_TYPES.map(e => [e.type, e.label])
);

/** Friendly label for a stored eventType, humanizing unknown/legacy values. */
export function shipmentEventLabel(type: string | null | undefined): string {
  if (!type) return 'Event';
  if (LABELS[type]) return LABELS[type];
  return type
    .split(/[_\s]+/)
    .filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}
