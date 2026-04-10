import { EVENT_TYPES } from '../events/eventTypes';

describe('EVENT_TYPES', () => {
  it('contains shipment events', () => {
    expect(EVENT_TYPES.SHIPMENT_CREATED).toBe('shipment.created');
    expect(EVENT_TYPES.SHIPMENT_UPDATED).toBe('shipment.updated');
    expect(EVENT_TYPES.SHIPMENT_STATUS_CHANGED).toBe('shipment.status_changed');
    expect(EVENT_TYPES.SHIPMENT_DELIVERED).toBe('shipment.delivered');
    expect(EVENT_TYPES.SHIPMENT_EXCEPTION).toBe('shipment.exception');
  });

  it('contains order events', () => {
    expect(EVENT_TYPES.ORDER_CREATED).toBe('order.created');
    expect(EVENT_TYPES.ORDER_UPDATED).toBe('order.updated');
    expect(EVENT_TYPES.ORDER_STATUS_CHANGED).toBe('order.status_changed');
    expect(EVENT_TYPES.ORDER_ASSIGNED_TO_SHIPMENT).toBe('order.assigned_to_shipment');
    expect(EVENT_TYPES.ORDER_DELIVERED).toBe('order.delivered');
  });

  it('contains carrier events', () => {
    expect(EVENT_TYPES.CARRIER_CREATED).toBe('carrier.created');
    expect(EVENT_TYPES.CARRIER_UPDATED).toBe('carrier.updated');
    expect(EVENT_TYPES.CARRIER_ARCHIVED).toBe('carrier.archived');
  });

  it('contains customer events', () => {
    expect(EVENT_TYPES.CUSTOMER_CREATED).toBe('customer.created');
    expect(EVENT_TYPES.CUSTOMER_UPDATED).toBe('customer.updated');
    expect(EVENT_TYPES.CUSTOMER_ARCHIVED).toBe('customer.archived');
  });

  it('contains tracking events', () => {
    expect(EVENT_TYPES.TRACKING_LOCATION_RECEIVED).toBe('tracking.location_received');
    expect(EVENT_TYPES.TRACKING_GEOFENCE_ENTERED).toBe('tracking.geofence_entered');
    expect(EVENT_TYPES.TRACKING_ETA_UPDATED).toBe('tracking.eta_updated');
  });

  it('contains integration events', () => {
    expect(EVENT_TYPES.INTEGRATION_OUTBOUND_SENT).toBe('integration.outbound_sent');
    expect(EVENT_TYPES.INTEGRATION_OUTBOUND_FAILED).toBe('integration.outbound_failed');
    expect(EVENT_TYPES.INTEGRATION_WEBHOOK_RECEIVED).toBe('integration.webhook_received');
  });

  it('all values follow entity.action naming convention', () => {
    for (const [key, value] of Object.entries(EVENT_TYPES)) {
      expect(value).toMatch(/^[a-z_]+\.[a-z_]+$/);
    }
  });

  it('all keys are unique', () => {
    const values = Object.values(EVENT_TYPES);
    const unique = new Set(values);
    expect(unique.size).toBe(values.length);
  });
});
