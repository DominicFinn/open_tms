import { PrismaClient } from '@prisma/client';
import type { HandlingUnitSnapshot, IHandlingUnitSource } from '../../ports/handlingUnitSource.js';

export const TMS_TRACKABLE_UNIT = 'tms_trackable_unit';

/**
 * The TMS side of the handling unit port: a TrackableUnit and the order lines packed into it.
 * This is the only code that reads TrackableUnit on the warehouse's behalf.
 *
 * TrackableUnit has no orgId of its own, so every read is scoped through its order.
 */
export class TrackableUnitHandlingSource implements IHandlingUnitSource {
  constructor(private prisma: PrismaClient) {}

  async getSnapshot(orgId: string, sourceId: string): Promise<HandlingUnitSnapshot | null> {
    const unit = await this.prisma.trackableUnit.findFirst({
      where: { id: sourceId, order: { orgId } },
      select: {
        id: true,
        orderId: true,
        identifier: true,
        unitType: true,
        customTypeName: true,
        barcode: true,
        lineItems: {
          select: { id: true, sku: true, description: true, quantity: true, weight: true, hazmat: true, temperature: true },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!unit) return null;

    return {
      orgId,
      sourceType: TMS_TRACKABLE_UNIT,
      sourceId: unit.id,
      sourceOrderId: unit.orderId,
      identifier: unit.identifier,
      unitType: unit.unitType,
      customTypeName: unit.customTypeName,
      barcode: unit.barcode,
      lines: unit.lineItems.map((line) => ({
        sourceLineId: line.id,
        sku: line.sku,
        description: line.description,
        quantity: line.quantity,
        weight: line.weight,
        hazmat: line.hazmat,
        temperature: line.temperature,
      })),
    };
  }

  async listSourceIdsForOrder(orgId: string, orderId: string): Promise<string[]> {
    const units = await this.prisma.trackableUnit.findMany({
      where: { orderId, order: { orgId } },
      select: { id: true },
    });
    return units.map((unit) => unit.id);
  }

  async listSourceIds(): Promise<Array<{ orgId: string; sourceId: string }>> {
    // tenancy-exempt: a backfill sweep reads every org, and each row carries its own org below
    const units = await this.prisma.trackableUnit.findMany({
      select: { id: true, order: { select: { orgId: true } } },
    });
    return units.map((unit) => ({ orgId: unit.order.orgId, sourceId: unit.id }));
  }
}
