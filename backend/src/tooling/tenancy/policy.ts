/**
 * What the tenancy check accepts without an `orgId`, and why. See .claude/rules/multi-tenancy.md.
 *
 * Everything here is a considered decision. Anything that is simply not fixed yet belongs in
 * baseline.json instead, which may only shrink.
 */

/** Tables that belong to no tenant. */
export const GLOBAL_MODELS: Readonly<Record<string, string>> = {
  Organization: 'The tenant itself.',
  Role: 'System role definitions, unique by name and shared by every tenant. Assignment is per user.',
  AuthProvider: 'Deployment-wide SSO provider configuration, unique by provider.',
  ProjectionCheckpoint: 'Projection bookkeeping for the event pipeline, not tenant data.',
  BinaryStore:
    'Opaque blob store keyed by a storage key. Nothing reads it except through a scoped owner row, ' +
    'and the security rule keeps business data out of the key.',
};

/**
 * Child tables that take their org from a required parent. The value is the relation field. The
 * check confirms the field exists, is required, and points at a model that resolves to an org.
 *
 * A child row is only as scoped as the query that reaches it: every lookup by the child's own id
 * must also check the parent's org.
 */
export const INHERITED_MODELS: Readonly<Record<string, string>> = {
  AgentConfigVersion: 'config',
  ArrivalCriteria: 'location',
  CarrierInvoiceLineItem: 'carrierInvoice',
  CarrierTrackingEvent: 'shipment',
  CarrierTrackingIntegration: 'carrier',
  CarrierUser: 'carrier',
  CustomerLane: 'customer',
  CustomerUser: 'customer',
  CustomFieldDefinition: 'version',
  CustomerWebhookDelivery: 'webhook',
  CycleCountLine: 'cycleCount',
  DeviceAssignment: 'device',
  DeviceEvent: 'device',
  InvoiceLineItem: 'invoice',
  IssueLabelAssignment: 'issue',
  LaneCarrier: 'lane',
  LaneStop: 'lane',
  Load: 'shipment',
  LoadPlanLine: 'loadPlan',
  LoginAuditLog: 'user',
  MagicLink: 'user',
  OrderLineItem: 'order',
  OrderShipment: 'order',
  PackLine: 'packTask',
  PendingLaneRequest: 'order',
  PickLine: 'pickTask',
  QuoteLineItem: 'quote',
  ReceivingLine: 'receivingTask',
  RmaLine: 'rma',
  SOPAuditResponse: 'audit',
  SOPChecklistItem: 'checklist',
  SensorReading: 'device',
  Session: 'user',
  ShipmentAccessory: 'shipment',
  ShipmentEvent: 'shipment',
  ShipmentFlag: 'shipment',
  ShipmentStop: 'shipment',
  SlaRule: 'policy',
  Tender: 'shipment',
  TenderBid: 'tender',
  TenderOffer: 'tender',
  TrackableUnit: 'order',
  TradingPartnerTransaction: 'partner',
  UserRole: 'user',
  WarehouseAisle: 'zone',
  WaveOrder: 'wave',
};

/**
 * Plugins that bring their own org scope helper. A public route file (outside the authenticated
 * block in index.ts) must call one of these.
 */
export const SCOPE_HELPERS: readonly string[] = [
  'registerOrgScope',
  'registerStrictOrgScope',
  'registerOrgScopeForEdi',
  'registerWmsGuard',
  'attachOrgScopeHook',
  'attachOrgScopeFromCustomerUserHook',
  'attachOrgScopeFromCarrierUserHook',
  'attachEdiOrgScopeHook',
  'attachOrgScopeFromApiKeyHook',
  'attachOrgScopeFromIotWebhookHook',
];

/** Public route files that serve no tenant data, or resolve the tenant some other checked way. */
export const UNSCOPED_ROUTE_FILES: Readonly<Record<string, string>> = {
  'routes/auth.ts': 'Login, password reset and /me. The token it mints carries the org.',
  'routes/seed.ts': 'Dev and demo seeding, 403 in production. Targets the sole development org.',
  'routes/publicShipmentShare.ts':
    'Share links resolve a single shipment from the access code and viewer token, never from an org.',
  'routes/carrierTrackingWebhook.ts':
    'Carrier callbacks. Each event is attributed to the org of the integration whose signing secret verified it.',
  'routes/theme.ts':
    'Two unauthenticated branding reads. resolvePublicOrg refuses to guess once a second org exists.',
};

/** Files allowed an `organization.findFirst` with no org predicate. */
export const ORG_LOOKUP_EXEMPTIONS: Readonly<Record<string, string>> = {
  'routes/seed.ts': 'Seeding targets the sole development organisation and is 403 in production.',
};

/** Source that is not application code. */
export const EXEMPT_PATHS: readonly RegExp[] = [/^__tests__\//, /^scripts\//, /^tooling\//];
