import { PrismaClient } from '@prisma/client';
import type { IShipmentDirectory } from '../../ports/shipmentDirectory.js';

/** TMS's answer to the warehouse: does this shipment exist in the org (#359). */
export class ShipmentDirectory implements IShipmentDirectory {
  constructor(private prisma: PrismaClient) {}

  async shipmentExists(orgId: string, shipmentId: string): Promise<boolean> {
    const shipment = await this.prisma.shipment.findFirst({ where: { id: shipmentId, orgId }, select: { id: true } });
    return shipment !== null;
  }
}
