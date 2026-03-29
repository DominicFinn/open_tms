import { ITrackingAdapter, TrackingShipmentData, TrackingIntegrationConfig, TrackingResponse } from './ITrackingAdapter.js';
import { buildAuthHeaders } from './authHelpers.js';

export class GenericWebhookTrackingAdapter implements ITrackingAdapter {
  readonly providerType = 'generic_webhook';

  async registerShipment(shipment: TrackingShipmentData, config: TrackingIntegrationConfig): Promise<TrackingResponse> {
    const payload = {
      event: 'shipment.created',
      shipmentId: shipment.shipmentId,
      shipmentReference: shipment.shipmentReference,
      customer: shipment.customerName,
      origin: {
        name: shipment.origin.name,
        address: shipment.origin.address1,
        city: shipment.origin.city,
        state: shipment.origin.state,
        postalCode: shipment.origin.postalCode,
        country: shipment.origin.country,
        coordinates: shipment.origin.lat && shipment.origin.lng
          ? { lat: shipment.origin.lat, lng: shipment.origin.lng } : undefined,
      },
      destination: {
        name: shipment.destination.name,
        address: shipment.destination.address1,
        city: shipment.destination.city,
        state: shipment.destination.state,
        postalCode: shipment.destination.postalCode,
        country: shipment.destination.country,
        coordinates: shipment.destination.lat && shipment.destination.lng
          ? { lat: shipment.destination.lat, lng: shipment.destination.lng } : undefined,
      },
      carrier: shipment.carrier?.name,
      expectedPickup: shipment.expectedPickup?.toISOString(),
      expectedDelivery: shipment.expectedDelivery?.toISOString(),
    };

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...buildAuthHeaders(config),
    };

    try {
      const response = await fetch(config.url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      const responseBody = await response.text().catch(() => '');
      let trackingId: string | undefined;
      try {
        const parsed = JSON.parse(responseBody);
        trackingId = parsed.trackingId || parsed.id;
      } catch {
        // Response may not be JSON
      }

      return {
        success: response.ok,
        trackingId,
        responseCode: response.status,
        rawResponse: responseBody.substring(0, 10000),
        errorMessage: response.ok ? undefined : `HTTP ${response.status}: ${response.statusText}`,
      };
    } catch (err: any) {
      return {
        success: false,
        errorMessage: err.message || 'Network error',
      };
    }
  }
}
