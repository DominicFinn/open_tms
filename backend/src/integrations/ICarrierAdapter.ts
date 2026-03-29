export interface CarrierShipmentData {
  id: string;
  reference: string;
  customer: { id: string; name: string };
  origin: {
    name: string; address1: string; address2?: string | null;
    city: string; state?: string | null; postalCode?: string | null; country: string;
  };
  destination: {
    name: string; address1: string; address2?: string | null;
    city: string; state?: string | null; postalCode?: string | null; country: string;
  };
  carrier?: { id: string; name: string; mcNumber?: string | null; dotNumber?: string | null } | null;
  pickupDate?: Date | null;
  deliveryDate?: Date | null;
  orderShipments?: Array<{
    order: {
      id: string;
      orderNumber: string;
      trackableUnits?: Array<{
        id: string; identifier: string; unitType: string;
        sequenceNumber: number;
        lineItems: Array<{ sku: string; description?: string | null; quantity: number; weight?: number | null }>;
      }>;
      lineItems?: Array<{ sku: string; description?: string | null; quantity: number; weight?: number | null }>;
    };
  }>;
}

export interface CarrierIntegrationConfig {
  id: string;
  url: string;
  authType?: string | null;
  authHeader?: string | null;
  authValue?: string | null;
  senderId?: string | null;
  receiverId?: string | null;
  interchangeControlNumber?: string | null;
  payloadFormat: string;
}

export interface CarrierResponse {
  success: boolean;
  trackingNumber?: string;
  carrierReference?: string;
  errorMessage?: string;
  responseCode?: number;
  rawResponse?: string;
}

export interface ICarrierAdapter {
  readonly carrierType: string;
  sendShipment(shipment: CarrierShipmentData, config: CarrierIntegrationConfig): Promise<CarrierResponse>;
}
