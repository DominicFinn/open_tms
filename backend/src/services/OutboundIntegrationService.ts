import { PrismaClient } from '@prisma/client';
import { EDI856Service } from './EDI856Service.js';

interface ShipmentWithRelations {
  id: string;
  reference: string;
  customer: {
    id: string;
    name: string;
  };
  origin: {
    id: string;
    name: string;
    address1: string;
    address2?: string | null;
    city: string;
    state?: string | null;
    postalCode?: string | null;
    country: string;
  };
  destination: {
    id: string;
    name: string;
    address1: string;
    address2?: string | null;
    city: string;
    state?: string | null;
    postalCode?: string | null;
    country: string;
  };
  carrier?: {
    id: string;
    name: string;
    mcNumber?: string | null;
    dotNumber?: string | null;
  } | null;
  pickupDate?: Date | null;
  deliveryDate?: Date | null;
  orderShipments?: Array<{
    order: {
      id: string;
      orderNumber: string;
      trackableUnits?: Array<{
        id: string;
        identifier: string;
        unitType: string;
        customTypeName?: string | null;
        sequenceNumber: number;
        lineItems: Array<{
          sku: string;
          description?: string | null;
          quantity: number;
          weight?: number | null;
        }>;
      }>;
      lineItems?: Array<{
        sku: string;
        description?: string | null;
        quantity: number;
        weight?: number | null;
      }>;
    };
  }>;
}

export class OutboundIntegrationService {
  private ediService: EDI856Service;
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.ediService = new EDI856Service();
    this.prisma = prisma;
  }

  /**
   * Send EDI 856 to all active outbound integrations when a shipment is created
   */
  async sendShipmentNotification(shipment: ShipmentWithRelations): Promise<void> {
    // Get all active outbound integrations
    const integrations = await this.prisma.outboundIntegration.findMany({
      where: { active: true }
    });

    if (integrations.length === 0) {
      return; // No active integrations
    }

    // Send to each integration
    const promises = integrations.map((integration: any) =>
      this.sendToIntegration(integration.id, shipment)
    );

    // Don't await - fire and forget, but log errors
    Promise.allSettled(promises).catch(error => {
      console.error('Error sending outbound integrations:', error);
    });
  }

  /**
   * Send EDI 856 to a specific integration
   */
  async sendToIntegration(integrationId: string, shipment: ShipmentWithRelations): Promise<void> {
    const integration = await this.prisma.outboundIntegration.findUnique({
      where: { id: integrationId }
    });

    if (!integration || !integration.active) {
      throw new Error(`Integration ${integrationId} not found or inactive`);
    }

    // Generate EDI 856 document
    const ediConfig = {
      senderId: integration.senderId || undefined,
      receiverId: integration.receiverId || undefined,
      interchangeControlNumber: integration.interchangeControlNumber || undefined
    };

    const edi856 = this.ediService.generateEDI856(shipment as any, ediConfig);

    // Prepare headers
    const headers: Record<string, string> = {
      'Content-Type': 'application/edi-x12'
    };

    // Add authentication
    if (integration.authType && integration.authType !== 'none' && integration.authValue) {
      if (integration.authType === 'basic') {
        // Basic auth - expects "username:password" format
        const auth = Buffer.from(integration.authValue).toString('base64');
        headers['Authorization'] = `Basic ${auth}`;
      } else if (integration.authType === 'bearer') {
        headers['Authorization'] = `Bearer ${integration.authValue}`;
      } else if (integration.authType === 'api_key' && integration.authHeader) {
        headers[integration.authHeader] = integration.authValue;
      }
    }

    // Create log entry before sending
    const log = await this.prisma.outboundIntegrationLog.create({
      data: {
        integrationId: integration.id,
        shipmentId: shipment.id,
        shipmentReference: shipment.reference,
        url: integration.url,
        method: 'POST',
        headers: headers as any,
        ediPayload: edi856,
        payloadSize: Buffer.byteLength(edi856, 'utf8'),
        status: 'pending'
      }
    });

    try {
      // Send HTTP POST request
      const response = await fetch(integration.url, {
        method: 'POST',
        headers,
        body: edi856
      });

      const responseBody = await response.text().catch(() => '');
      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      // Update log with response
      await this.prisma.outboundIntegrationLog.update({
        where: { id: log.id },
        data: {
          status: response.ok ? 'success' : 'error',
          responseCode: response.status,
          responseBody: responseBody.substring(0, 10000), // Limit size
          responseHeaders: responseHeaders as any,
          respondedAt: new Date(),
          errorMessage: response.ok ? null : `HTTP ${response.status}: ${response.statusText}`
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error: any) {
      // Update log with error
      await this.prisma.outboundIntegrationLog.update({
        where: { id: log.id },
        data: {
          status: 'error',
          responseCode: null,
          errorMessage: error.message || 'Unknown error',
          respondedAt: new Date()
        }
      });

      throw error;
    }
  }
}
