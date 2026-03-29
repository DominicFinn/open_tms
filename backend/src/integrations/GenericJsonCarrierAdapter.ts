import { ICarrierAdapter, CarrierShipmentData, CarrierIntegrationConfig, CarrierResponse } from './ICarrierAdapter.js';
import { buildAuthHeaders } from './authHelpers.js';

export class GenericJsonCarrierAdapter implements ICarrierAdapter {
  readonly carrierType = 'generic_json';

  async sendShipment(shipment: CarrierShipmentData, config: CarrierIntegrationConfig): Promise<CarrierResponse> {
    const payload = {
      shipmentReference: shipment.reference,
      customer: shipment.customer.name,
      origin: {
        name: shipment.origin.name,
        address: shipment.origin.address1,
        city: shipment.origin.city,
        state: shipment.origin.state,
        postalCode: shipment.origin.postalCode,
        country: shipment.origin.country,
      },
      destination: {
        name: shipment.destination.name,
        address: shipment.destination.address1,
        city: shipment.destination.city,
        state: shipment.destination.state,
        postalCode: shipment.destination.postalCode,
        country: shipment.destination.country,
      },
      carrier: shipment.carrier ? {
        name: shipment.carrier.name,
        mcNumber: shipment.carrier.mcNumber,
        dotNumber: shipment.carrier.dotNumber,
      } : undefined,
      pickupDate: shipment.pickupDate?.toISOString(),
      deliveryDate: shipment.deliveryDate?.toISOString(),
      orders: shipment.orderShipments?.map(os => ({
        orderNumber: os.order.orderNumber,
        lineItems: [
          ...(os.order.trackableUnits?.flatMap(u =>
            u.lineItems.map(li => ({ sku: li.sku, description: li.description, quantity: li.quantity, weight: li.weight }))
          ) || []),
          ...(os.order.lineItems?.map(li => ({ sku: li.sku, description: li.description, quantity: li.quantity, weight: li.weight })) || []),
        ],
      })),
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

      return {
        success: response.ok,
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
