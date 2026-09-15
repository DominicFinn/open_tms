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

  // IoT device event types, passed through verbatim from the System Loco
  // vendor payload (see SENSOR_EVENT_TYPES / LIFECYCLE_EVENT_TYPES /
  // SHIPMENT_ALERT_SENSOR_TYPES in backend/src/integrations/SystemLocoAdapter.ts).
  // Without an entry here they'd fall through to the raw-string humanizer.
  { type: 'globalLocation', label: 'Location update' },
  { type: 'siteLocation', label: 'Site location update' },
  { type: 'onSite', label: 'Arrived on site' },
  { type: 'zoneChange', label: 'Zone change' },
  { type: 'firmware', label: 'Firmware event' },
  { type: 'securitySwitch', label: 'Security switch' },
  { type: 'charging', label: 'Charging status' },
  { type: 'sterilisation', label: 'Sterilisation' },
  { type: 'missing', label: 'Device missing' },
  { type: 'tamper', label: 'Tamper detected' },
  { type: 'dataDownload', label: 'Data download' },
  { type: 'coldChain', label: 'Cold chain event' },
  { type: 'temperature', label: 'Temperature reading' },
  { type: 'temperatureNormal', label: 'Temperature normal' },
  { type: 'light', label: 'Light reading' },
  { type: 'lightInTransit', label: 'Light detected in transit' },
  { type: 'impact', label: 'Impact detected' },
  { type: 'drop', label: 'Drop detected' },
  { type: 'tip', label: 'Tip detected' },
  { type: 'shocked', label: 'Shock detected' },
  { type: 'tilted', label: 'Tilt detected' },
  { type: 'battery', label: 'Battery reading' },
  { type: 'batteryLow', label: 'Battery low' },
  { type: 'report', label: 'Device report' },
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
