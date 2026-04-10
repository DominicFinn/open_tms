/**
 * ColdChainComplianceHandler
 *
 * Listens for shipment.delivered and shipment.status_changed events.
 * When a shipment with cold chain monitoring is completed/delivered:
 * 1. Auto-generates the Cold Chain Compliance Report PDF
 * 2. Optionally auto-delivers shipment docs to the customer (org setting)
 *
 * Also listens for cold_chain.excursion_detected to create triage issues.
 */

import { PrismaClient } from '@prisma/client';
import { DomainEvent } from '../DomainEvent.js';
import { IEventHandler } from '../IEventHandler.js';
import { EVENT_TYPES } from '../eventTypes.js';
import { ComplianceReportService } from '../../services/ComplianceReportService.js';
import { IBinaryStorageProvider } from '../../storage/IBinaryStorageProvider.js';

export class ColdChainComplianceHandler implements IEventHandler {
  readonly name = 'cold_chain.compliance';
  readonly eventPatterns = [
    EVENT_TYPES.SHIPMENT_DELIVERED,
    EVENT_TYPES.SHIPMENT_STATUS_CHANGED,
    EVENT_TYPES.COLD_CHAIN_EXCURSION_DETECTED,
  ];
  readonly options = { concurrency: 2 };

  constructor(
    private prisma: PrismaClient,
    private storageProvider: IBinaryStorageProvider,
  ) {}

  async handle(event: DomainEvent): Promise<void> {
    try {
      if (event.type === EVENT_TYPES.SHIPMENT_DELIVERED) {
        await this.handleShipmentDelivered(event);
      } else if (event.type === EVENT_TYPES.SHIPMENT_STATUS_CHANGED) {
        await this.handleStatusChanged(event);
      } else if (event.type === EVENT_TYPES.COLD_CHAIN_EXCURSION_DETECTED) {
        await this.handleExcursionDetected(event);
      }
    } catch (err) {
      console.error(`[ColdChainComplianceHandler] Error processing ${event.type}:`, err);
    }
  }

  private async handleShipmentDelivered(event: DomainEvent): Promise<void> {
    const shipmentId = event.entityId;
    await this.generateComplianceReportIfNeeded(shipmentId);
  }

  private async handleStatusChanged(event: DomainEvent): Promise<void> {
    const payload = event.payload as { newStatus?: string };
    // Generate report when shipment moves to "delivered" or "completed" status
    if (payload.newStatus === 'delivered' || payload.newStatus === 'completed') {
      const shipmentId = event.entityId;
      await this.generateComplianceReportIfNeeded(shipmentId);
    }
  }

  private async generateComplianceReportIfNeeded(shipmentId: string): Promise<void> {
    // Check if this shipment has cold chain monitoring
    const shipment = await this.prisma.shipment.findUnique({
      where: { id: shipmentId },
      select: {
        id: true,
        coldChainDisposition: true,
        effectiveMinTemp: true,
        effectiveMaxTemp: true,
      },
    });

    if (!shipment) return;

    // Only generate for shipments with cold chain monitoring
    if (
      shipment.coldChainDisposition === 'not_applicable' &&
      shipment.effectiveMinTemp === null &&
      shipment.effectiveMaxTemp === null
    ) {
      return;
    }

    // Check if a compliance report already exists for this shipment
    const existingReport = await this.prisma.generatedDocument.findFirst({
      where: {
        shipmentId,
        documentType: 'cold_chain_compliance',
      },
    });

    if (existingReport) {
      console.log(`[ColdChainComplianceHandler] Compliance report already exists for shipment ${shipmentId}, skipping`);
      return;
    }

    // Generate the compliance report
    const reportService = new ComplianceReportService(this.prisma, this.storageProvider);
    const result = await reportService.generateComplianceReport(shipmentId);
    console.log(`[ColdChainComplianceHandler] Generated compliance report ${result.documentId} for shipment ${shipmentId}`);

    // Check org setting for auto-delivery
    const org = await this.prisma.organization.findFirst({
      select: { autoDeliverShipmentDocs: true },
    });

    if (org?.autoDeliverShipmentDocs) {
      // TODO: Auto-deliver documents to customer via email or integration
      // This will be wired up when the email delivery system is extended
      console.log(`[ColdChainComplianceHandler] Auto-delivery enabled — would deliver docs for shipment ${shipmentId}`);
    }
  }

  private async handleExcursionDetected(event: DomainEvent): Promise<void> {
    const payload = event.payload as {
      shipmentId: string;
      shipmentReference: string;
      excursionType: string;
      severity: string;
      peakValue: number;
      thresholdValue: number;
    };

    // Auto-create a triage issue for critical excursions
    if (payload.severity === 'critical') {
      // Check if an open issue already exists for this shipment + excursion
      const existingIssue = await this.prisma.issue.findFirst({
        where: {
          sourceEntityType: 'shipment',
          sourceEntityId: payload.shipmentId,
          category: 'compliance',
          status: { in: ['open', 'in_progress'] },
        },
      });

      if (existingIssue) return; // Already tracked

      await this.prisma.issue.create({
        data: {
          orgId: event.orgId,
          title: `Temperature excursion on ${payload.shipmentReference}`,
          description: `Critical ${payload.excursionType} excursion detected. ` +
            `Peak temperature: ${payload.peakValue}°C (threshold: ${payload.thresholdValue}°C). ` +
            `Immediate action required — review and determine disposition.`,
          status: 'open',
          priority: 'critical',
          category: 'compliance',
          sourceEntityType: 'shipment',
          sourceEntityId: payload.shipmentId,
          sourceEventId: event.id,
        },
      });

      console.log(`[ColdChainComplianceHandler] Created triage issue for critical excursion on shipment ${payload.shipmentId}`);
    }
  }
}
