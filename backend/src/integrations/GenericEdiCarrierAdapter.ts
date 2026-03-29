import { EDI856Service } from '../services/EDI856Service.js';
import { ICarrierAdapter, CarrierShipmentData, CarrierIntegrationConfig, CarrierResponse } from './ICarrierAdapter.js';
import { buildAuthHeaders } from './authHelpers.js';

export class GenericEdiCarrierAdapter implements ICarrierAdapter {
  readonly carrierType = 'generic_edi';
  private ediService: EDI856Service;

  constructor() {
    this.ediService = new EDI856Service();
  }

  async sendShipment(shipment: CarrierShipmentData, config: CarrierIntegrationConfig): Promise<CarrierResponse> {
    const ediPayload = this.ediService.generateEDI856(shipment as any, {
      senderId: config.senderId || undefined,
      receiverId: config.receiverId || undefined,
      interchangeControlNumber: config.interchangeControlNumber || undefined,
    });

    const headers: Record<string, string> = {
      'Content-Type': 'application/edi-x12',
      ...buildAuthHeaders(config),
    };

    try {
      const response = await fetch(config.url, {
        method: 'POST',
        headers,
        body: ediPayload,
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
