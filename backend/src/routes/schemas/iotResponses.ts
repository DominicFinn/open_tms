/**
 * OpenAPI response shapes for the device, telemetry and IoT vendor routes (#291).
 *
 * Objects allow additional properties so Fastify's serializer doesn't strip the included
 * relations; the listed properties are the ones clients rely on.
 */

const nullableString = { type: 'string', nullable: true } as const;
const nullableNumber = { type: 'number', nullable: true } as const;
const nullableInteger = { type: 'integer', nullable: true } as const;
const dateTime = { type: 'string', format: 'date-time' } as const;
const nullableDateTime = { type: 'string', format: 'date-time', nullable: true } as const;

export const errorEnvelope = {
  type: 'object',
  properties: {
    data: { type: 'null' },
    error: { type: 'string' },
  },
} as const;

function envelope(data: object, meta?: object) {
  return {
    type: 'object',
    properties: {
      data,
      ...(meta ? { meta } : {}),
      error: { type: 'null' },
    },
  };
}

const assignment = {
  type: 'object',
  additionalProperties: true,
  properties: {
    id: { type: 'string' },
    deviceId: { type: 'string' },
    shipmentId: nullableString,
    orderId: nullableString,
    trackableUnitId: nullableString,
    purpose: { type: 'string', nullable: true, enum: ['cargo_condition', 'security', 'location', 'general', null] },
    active: { type: 'boolean' },
    assignedAt: dateTime,
    unassignedAt: nullableDateTime,
  },
} as const;

const device = {
  type: 'object',
  additionalProperties: true,
  properties: {
    id: { type: 'string' },
    externalId: { type: 'string', description: "The provider's device id. Unique across the platform" },
    displayId: nullableString,
    name: { type: 'string' },
    provider: { type: 'string' },
    model: nullableString,
    manufacturer: nullableString,
    status: { type: 'string' },
    batteryLevel: nullableInteger,
    lastSeenAt: nullableDateTime,
    lastLat: nullableNumber,
    lastLng: nullableNumber,
    createdAt: dateTime,
    updatedAt: dateTime,
  },
} as const;

const reading = {
  type: 'object',
  additionalProperties: true,
  properties: {
    id: { type: 'string' },
    deviceId: { type: 'string' },
    shipmentId: nullableString,
    orderId: nullableString,
    eventTime: dateTime,
    temperature: nullableNumber,
    atmosphericPressure: { ...nullableNumber, description: 'hPa' },
    lightLevel: nullableInteger,
    batteryLevel: nullableInteger,
    impactG: nullableNumber,
    tiltAngle: nullableNumber,
    movement: nullableString,
    lat: nullableNumber,
    lng: nullableNumber,
    locationType: nullableString,
    locationAccuracy: { ...nullableNumber, description: 'Accuracy radius in metres' },
    isAlert: { type: 'boolean' },
    alertType: nullableString,
  },
} as const;

const telemetrySummary = {
  type: 'object',
  properties: {
    readingCount: { type: 'integer' },
    alertCount: { type: 'integer' },
    temperature: {
      type: 'object',
      nullable: true,
      properties: {
        min: { type: 'number' },
        max: { type: 'number' },
        avg: { type: 'number' },
        latest: { type: 'number' },
      },
    },
    latestBattery: nullableInteger,
    latestPressure: nullableNumber,
    devices: { type: 'integer', description: 'Number of distinct devices in the readings' },
  },
} as const;

const vendor = {
  type: 'object',
  properties: {
    vendorKey: { type: 'string' },
    name: { type: 'string' },
    enabled: { type: 'boolean' },
    hasWebhookSecret: { type: 'boolean', description: 'Whether a secret is set. The secret itself is never returned' },
  },
} as const;

const pageMeta = {
  type: 'object',
  properties: {
    total: { type: 'integer' },
    limit: { type: 'integer' },
    offset: { type: 'integer' },
  },
} as const;

export const deviceListResponse = envelope({ type: 'array', items: device }, pageMeta);
export const deviceResponse = envelope(device);
export const assignmentResponse = envelope(assignment);
export const unassignResponse = envelope({
  type: 'object',
  properties: {
    unassigned: { type: 'boolean' },
    releasedAssignments: { type: 'integer' },
  },
});
export const readingListResponse = envelope({ type: 'array', items: reading });
export const shipmentTelemetryResponse = envelope({
  type: 'object',
  properties: { readings: { type: 'array', items: reading }, summary: telemetrySummary },
});
export const orderTelemetryResponse = envelope({
  type: 'object',
  properties: {
    readings: { type: 'array', items: reading },
    summary: { type: 'object', properties: { readingCount: { type: 'integer' } } },
  },
});
export const vendorListResponse = envelope({ type: 'array', items: vendor });
export const vendorResponse = envelope(vendor);
