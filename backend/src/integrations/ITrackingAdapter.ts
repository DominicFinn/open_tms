export interface TrackingShipmentData {
  shipmentId: string;
  shipmentReference: string;
  origin: {
    name: string; address1: string; city: string;
    state?: string | null; postalCode?: string | null; country: string;
    lat?: number | null; lng?: number | null;
  };
  destination: {
    name: string; address1: string; city: string;
    state?: string | null; postalCode?: string | null; country: string;
    lat?: number | null; lng?: number | null;
  };
  carrier?: { name: string } | null;
  expectedPickup?: Date | null;
  expectedDelivery?: Date | null;
  customerName: string;
}

export interface TrackingIntegrationConfig {
  id: string;
  url: string;
  authType?: string | null;
  authHeader?: string | null;
  authValue?: string | null;
}

export interface TrackingResponse {
  success: boolean;
  trackingId?: string;
  errorMessage?: string;
  responseCode?: number;
  rawResponse?: string;
}

export interface ITrackingAdapter {
  readonly providerType: string;
  registerShipment(shipment: TrackingShipmentData, config: TrackingIntegrationConfig): Promise<TrackingResponse>;
  updateShipment?(shipment: Partial<TrackingShipmentData>, config: TrackingIntegrationConfig): Promise<TrackingResponse>;
}
