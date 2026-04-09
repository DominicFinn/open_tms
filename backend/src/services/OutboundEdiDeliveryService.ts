/**
 * Outbound EDI Delivery Service
 *
 * Delivers outbound EDI documents to trading partners via SFTP or HTTP.
 * Used by the tender system (EDI 204), shipment system (EDI 856), and ack system (EDI 997).
 */

import { ITradingPartnerRepository, TradingPartnerWithTransactions } from '../repositories/TradingPartnerRepository.js';

export interface DeliveryResult {
  success: boolean;
  transport: string;
  destination: string;
  fileName?: string;
  responseCode?: number;
  errorMessage?: string;
}

export interface OutboundDeliveryRequest {
  partnerId: string;
  transactionType: string;
  ediContent: string;
  referenceId: string;       // Shipment reference, tender reference, etc.
  shipmentId?: string;
  tenderId?: string;
  orderId?: string;
}

export interface IOutboundEdiDeliveryService {
  deliver(request: OutboundDeliveryRequest): Promise<DeliveryResult>;
  deliverToCarrier(carrierId: string, transactionType: string, ediContent: string, referenceId: string, meta?: { shipmentId?: string; tenderId?: string }): Promise<DeliveryResult | null>;
}

export class OutboundEdiDeliveryService implements IOutboundEdiDeliveryService {
  constructor(private partnerRepo: ITradingPartnerRepository) {}

  async deliver(request: OutboundDeliveryRequest): Promise<DeliveryResult> {
    const partner = await this.partnerRepo.findById(request.partnerId);
    if (!partner) {
      return { success: false, transport: 'none', destination: '', errorMessage: 'Trading partner not found' };
    }

    if (!partner.outboundEnabled) {
      return { success: false, transport: 'none', destination: '', errorMessage: 'Outbound not enabled for this partner' };
    }

    // Check partner supports this transaction type outbound
    const txn = partner.transactions.find(
      t => t.transactionType === request.transactionType && t.direction === 'outbound' && t.enabled
    );
    if (!txn) {
      return { success: false, transport: 'none', destination: '', errorMessage: `Partner does not support outbound ${request.transactionType}` };
    }

    // Log the attempt
    const log = await this.partnerRepo.createLog({
      partnerId: partner.id,
      transactionType: request.transactionType,
      direction: 'outbound',
      fileContent: request.ediContent,
      fileSize: Buffer.byteLength(request.ediContent),
      fileName: this.generateFileName(partner, request),
      transport: partner.outboundTransport,
      status: 'pending',
      shipmentId: request.shipmentId,
      tenderId: request.tenderId,
      orderId: request.orderId,
      shipmentReference: request.referenceId,
    });

    let result: DeliveryResult;

    try {
      if (partner.outboundTransport === 'sftp' && partner.sftpHost) {
        result = await this.deliverViaSftp(partner, request);
      } else if (partner.outboundTransport === 'http' && partner.httpUrl) {
        result = await this.deliverViaHttp(partner, request);
      } else {
        result = { success: false, transport: partner.outboundTransport, destination: '', errorMessage: 'No valid transport configuration' };
      }

      // Update log
      await this.partnerRepo.updateLog(log.id, {
        status: result.success ? 'success' : 'error',
        url: result.destination,
        responseCode: result.responseCode,
        errorMessage: result.errorMessage,
        processedAt: new Date(),
      });
    } catch (err: any) {
      result = { success: false, transport: partner.outboundTransport, destination: '', errorMessage: err.message };
      await this.partnerRepo.updateLog(log.id, {
        status: 'error',
        errorMessage: err.message,
        processedAt: new Date(),
      });
    }

    return result;
  }

  async deliverToCarrier(
    carrierId: string,
    transactionType: string,
    ediContent: string,
    referenceId: string,
    meta?: { shipmentId?: string; tenderId?: string },
  ): Promise<DeliveryResult | null> {
    const partner = await this.partnerRepo.findByCarrierId(carrierId);
    if (!partner || !partner.outboundEnabled) return null;

    const txn = partner.transactions.find(
      t => t.transactionType === transactionType && t.direction === 'outbound' && t.enabled
    );
    if (!txn) return null;

    return this.deliver({
      partnerId: partner.id,
      transactionType,
      ediContent,
      referenceId,
      shipmentId: meta?.shipmentId,
      tenderId: meta?.tenderId,
    });
  }

  // ── Transport implementations ──

  private async deliverViaSftp(partner: TradingPartnerWithTransactions, request: OutboundDeliveryRequest): Promise<DeliveryResult> {
    // Dynamic import to avoid hard dependency on ssh2-sftp-client in backend
    let SftpClient: any;
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      SftpClient = (await (Function('return import("ssh2-sftp-client")')())).default;
    } catch {
      return {
        success: false,
        transport: 'sftp',
        destination: `sftp://${partner.sftpHost}${partner.outboundDir || '/'}`,
        errorMessage: 'ssh2-sftp-client not installed. Run: npm install ssh2-sftp-client',
      };
    }

    const sftp = new SftpClient();
    const fileName = this.generateFileName(partner, request);
    const remotePath = `${partner.outboundDir || '/'}/${fileName}`;

    try {
      const connectConfig: any = {
        host: partner.sftpHost,
        port: partner.sftpPort || 22,
        username: partner.sftpUsername,
      };
      if (partner.sftpPrivateKey) {
        connectConfig.privateKey = partner.sftpPrivateKey;
      } else if (partner.sftpPassword) {
        connectConfig.password = partner.sftpPassword;
      }

      await sftp.connect(connectConfig);
      await sftp.put(Buffer.from(request.ediContent), remotePath);
      await sftp.end();

      return {
        success: true,
        transport: 'sftp',
        destination: `sftp://${partner.sftpHost}${remotePath}`,
        fileName,
      };
    } catch (err: any) {
      try { await sftp.end(); } catch {}
      return {
        success: false,
        transport: 'sftp',
        destination: `sftp://${partner.sftpHost}${remotePath}`,
        errorMessage: err.message,
      };
    }
  }

  private async deliverViaHttp(partner: TradingPartnerWithTransactions, request: OutboundDeliveryRequest): Promise<DeliveryResult> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/edi-x12',
    };

    // Add auth headers
    if (partner.httpAuthType === 'basic' && partner.httpAuthValue) {
      headers['Authorization'] = `Basic ${Buffer.from(partner.httpAuthValue).toString('base64')}`;
    } else if (partner.httpAuthType === 'bearer' && partner.httpAuthValue) {
      headers['Authorization'] = `Bearer ${partner.httpAuthValue}`;
    } else if (partner.httpAuthType === 'api_key' && partner.httpAuthHeader && partner.httpAuthValue) {
      headers[partner.httpAuthHeader] = partner.httpAuthValue;
    }

    try {
      const response = await fetch(partner.httpUrl!, {
        method: 'POST',
        headers,
        body: request.ediContent,
      });

      return {
        success: response.ok,
        transport: 'http',
        destination: partner.httpUrl!,
        responseCode: response.status,
        errorMessage: response.ok ? undefined : `HTTP ${response.status}: ${response.statusText}`,
      };
    } catch (err: any) {
      return {
        success: false,
        transport: 'http',
        destination: partner.httpUrl!,
        errorMessage: err.message,
      };
    }
  }

  // ── Helpers ──

  private generateFileName(partner: TradingPartnerWithTransactions, request: OutboundDeliveryRequest): string {
    const now = new Date();
    const timestamp = now.toISOString().replace(/[:-]/g, '').replace('T', '-').slice(0, 15);
    const type = request.transactionType;

    switch (partner.outboundFileNaming) {
      case 'date':
        return `${type}_${timestamp}.edi`;
      case 'sequence':
        return `${type}_${Date.now()}.edi`;
      case 'reference':
      default:
        const ref = request.referenceId.replace(/[^a-zA-Z0-9-_]/g, '_');
        return `${type}_${ref}_${timestamp}.edi`;
    }
  }
}
