/**
 * FinancialImpactHandler — auto-creates financial queries when operational
 * discrepancies or excursions are detected.
 *
 * Listens for cargo discrepancy events (missing, damaged, misdrop) and
 * cold chain excursion events, creating FinancialQuery records for
 * investigation and potential adjustment.
 */

import { PrismaClient } from '@prisma/client';
import { DomainEvent } from '../DomainEvent.js';
import { IEventHandler } from '../IEventHandler.js';
import { EVENT_TYPES } from '../eventTypes.js';

export class FinancialImpactHandler implements IEventHandler {
  readonly name = 'financial_impact';
  readonly eventPatterns = [
    EVENT_TYPES.CARGO_MISSING_AT_STOP,
    EVENT_TYPES.CARGO_MISDROP_DETECTED,
    EVENT_TYPES.COLD_CHAIN_DISPOSITION_CHANGED,
  ];
  readonly options = { concurrency: 2, retryLimit: 3, expireInSeconds: 60 };

  constructor(private prisma: PrismaClient) {}

  async handle(event: DomainEvent): Promise<void> {
    try {
      switch (event.type) {
        case EVENT_TYPES.CARGO_MISSING_AT_STOP:
          return this.handleMissingCargo(event);
        case EVENT_TYPES.CARGO_MISDROP_DETECTED:
          return this.handleMisdrop(event);
        case EVENT_TYPES.COLD_CHAIN_DISPOSITION_CHANGED:
          return this.handleDispositionChange(event);
      }
    } catch (err) {
      console.error(`[${this.name}] Error:`, err);
      throw err;
    }
  }

  private async handleMissingCargo(event: DomainEvent): Promise<void> {
    const payload = event.payload as {
      discrepancyId?: string;
      shipmentId?: string;
      unitIdentifier?: string;
      stopName?: string;
    };

    if (!payload.shipmentId) return;

    // Check if a query already exists for this discrepancy
    if (payload.discrepancyId) {
      const existing = await this.prisma.financialQuery.findFirst({
        where: { cargoDiscrepancyId: payload.discrepancyId },
      });
      if (existing) return;
    }

    const queryNumber = await this.getNextQueryNumber(event.orgId);

    await this.prisma.financialQuery.create({
      data: {
        orgId: event.orgId,
        queryNumber,
        queryType: 'carrier_dispute',
        shipmentId: payload.shipmentId,
        reason: 'missing_items',
        description: `Missing cargo detected: ${payload.unitIdentifier ?? 'unknown unit'} at ${payload.stopName ?? 'stop'}. Auto-created for investigation.`,
        status: 'raised',
        cargoDiscrepancyId: payload.discrepancyId,
        createdBy: 'system',
      },
    });

    console.log(`[${this.name}] Created financial query ${queryNumber} for missing cargo on shipment ${payload.shipmentId}`);
  }

  private async handleMisdrop(event: DomainEvent): Promise<void> {
    const payload = event.payload as {
      discrepancyId?: string;
      shipmentId?: string;
      unitIdentifier?: string;
      expectedStop?: string;
      actualStop?: string;
    };

    if (!payload.shipmentId) return;

    if (payload.discrepancyId) {
      const existing = await this.prisma.financialQuery.findFirst({
        where: { cargoDiscrepancyId: payload.discrepancyId },
      });
      if (existing) return;
    }

    const queryNumber = await this.getNextQueryNumber(event.orgId);

    await this.prisma.financialQuery.create({
      data: {
        orgId: event.orgId,
        queryNumber,
        queryType: 'carrier_dispute',
        shipmentId: payload.shipmentId,
        reason: 'damage_claim',
        description: `Cargo misdrop: ${payload.unitIdentifier ?? 'unit'} delivered to wrong stop (expected: ${payload.expectedStop ?? '?'}, actual: ${payload.actualStop ?? '?'}). Auto-created for investigation.`,
        status: 'raised',
        cargoDiscrepancyId: payload.discrepancyId,
        createdBy: 'system',
      },
    });

    console.log(`[${this.name}] Created financial query ${queryNumber} for misdrop on shipment ${payload.shipmentId}`);
  }

  private async handleDispositionChange(event: DomainEvent): Promise<void> {
    const payload = event.payload as {
      shipmentId?: string;
      disposition?: string;
      previousDisposition?: string;
    };

    // Only create query when disposition changes to quarantined
    if (payload.disposition !== 'quarantined') return;
    if (!payload.shipmentId) return;

    // Check if a query already exists for this shipment's excursion
    const existing = await this.prisma.financialQuery.findFirst({
      where: {
        shipmentId: payload.shipmentId,
        reason: 'temperature_excursion',
        status: { in: ['raised', 'investigating'] },
      },
    });
    if (existing) return;

    const queryNumber = await this.getNextQueryNumber(event.orgId);

    await this.prisma.financialQuery.create({
      data: {
        orgId: event.orgId,
        queryNumber,
        queryType: 'carrier_dispute',
        shipmentId: payload.shipmentId,
        reason: 'temperature_excursion',
        description: `Shipment quarantined due to temperature excursion. Investigate for potential write-off or carrier claim.`,
        status: 'raised',
        createdBy: 'system',
      },
    });

    console.log(`[${this.name}] Created financial query ${queryNumber} for quarantined shipment ${payload.shipmentId}`);
  }

  private async getNextQueryNumber(orgId: string): Promise<string> {
    const latest = await this.prisma.financialQuery.findFirst({
      where: { orgId },
      orderBy: { queryNumber: 'desc' },
      select: { queryNumber: true },
    });
    if (!latest) return 'QRY-0001';
    const seq = parseInt(latest.queryNumber.slice(4), 10);
    return `QRY-${String(seq + 1).padStart(4, '0')}`;
  }
}
