/**
 * Which parts of a shipment a public share link may expose.
 *
 * BUSINESS RULE: sharing is opt-in per section and the list is an allowlist, not a blocklist.
 * A section that does not appear here can never be shared, whatever the client asks for, because
 * the server validates every requested section against this list on write and filters the
 * response against the stored list on read. Financials, margin, rate confirmation, customs
 * paperwork, internal activity and SLA data are deliberately absent: those are commercial and
 * internal, and a share link goes to people outside the organisation.
 */

export const SHIPMENT_SHARE_SECTIONS = [
  'overview',
  'events',
  'orders',
  'cargo',
  'documents',
  'telemetry',
  'carrier',
] as const;

export type ShipmentShareSection = (typeof SHIPMENT_SHARE_SECTIONS)[number];

export const SHIPMENT_SHARE_SECTION_LABELS: Record<ShipmentShareSection, string> = {
  overview: 'Overview',
  events: 'Tracking events',
  orders: 'Orders',
  cargo: 'Cargo',
  documents: 'Documents and BOL',
  telemetry: 'Telemetry',
  carrier: 'Carrier',
};

export const SHIPMENT_SHARE_SECTION_DESCRIPTIONS: Record<ShipmentShareSection, string> = {
  overview: 'Reference, status, origin and destination, pickup and delivery dates',
  events: 'Timeline of tracking events and the last known location',
  orders: 'Order references and line items on the shipment',
  cargo: 'Handling units, weights and dimensions',
  documents: 'Bill of lading and any documents marked shareable',
  telemetry: 'Temperature and sensor readings',
  carrier: 'Carrier name and service level',
};

/** Sections that exist on the shipment page but can never be put on a share link. */
export const SHIPMENT_SHARE_EXCLUDED_SECTIONS = [
  'financials',
  'activity',
  'sla',
  'customs',
  'rate-confirmation',
] as const;

export function isShipmentShareSection(value: string): value is ShipmentShareSection {
  return (SHIPMENT_SHARE_SECTIONS as readonly string[]).includes(value);
}

/**
 * Narrow an arbitrary list of section keys to the allowlist, de-duplicated and in a stable order.
 * Anything unrecognised is dropped rather than rejected, so a stored link created by an older
 * build keeps working when a section is renamed or withdrawn.
 */
export function normaliseShareSections(values: readonly string[]): ShipmentShareSection[] {
  return SHIPMENT_SHARE_SECTIONS.filter((section) => values.includes(section));
}
