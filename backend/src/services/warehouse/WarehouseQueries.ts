import { PrismaClient } from '@prisma/client';
import type {
  CartonSpec,
  FulfilmentProgress,
  ICartonCatalogue,
  IFulfilmentProgress,
  IPackTaskContext,
  PackTaskContext,
} from '../../ports/warehouseQueries.js';

const OPEN = { notIn: ['completed', 'cancelled'] };

/**
 * The warehouse's answers to read-only questions from TMS and core (#359). Every query is scoped by
 * the caller's org.
 */
export class WarehouseQueries implements IFulfilmentProgress, IPackTaskContext, ICartonCatalogue {
  constructor(private prisma: PrismaClient) {}

  async forShipment(orgId: string, shipmentId: string, orderIds: readonly string[]): Promise<FulfilmentProgress> {
    const ids = [...orderIds];
    const [pendingPickTasks, pendingPackTasks, openLoadPlans] = await Promise.all([
      ids.length > 0 ? this.prisma.pickTask.count({ where: { orgId, orderId: { in: ids }, status: OPEN } }) : 0,
      ids.length > 0 ? this.prisma.packTask.count({ where: { orgId, orderId: { in: ids }, status: OPEN } }) : 0,
      this.prisma.loadPlan.count({ where: { orgId, shipmentId, status: OPEN } }),
    ]);
    return { pendingPickTasks, pendingPackTasks, openLoadPlans };
  }

  async get(orgId: string, packTaskId: string): Promise<PackTaskContext | null> {
    const packTask = await this.prisma.packTask.findFirst({
      where: { id: packTaskId, orgId },
      select: {
        id: true,
        orderId: true,
        status: true,
        packLines: { select: { sku: true, expectedQuantity: true, packedQuantity: true } },
      },
    });
    if (!packTask) return null;

    const recentAudits = await this.prisma.packAudit.findMany({
      where: { packTaskId: packTask.id, orgId },
      select: { verdict: true, weightVariancePercent: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });
    return { ...packTask, recentAudits };
  }

  async listActive(orgId: string, locationId?: string): Promise<CartonSpec[]> {
    return this.prisma.cartonCatalogue.findMany({
      where: { orgId, active: true, ...(locationId ? { locationId } : {}) },
      select: {
        id: true, name: true, lengthMm: true, widthMm: true, heightMm: true, maxWeightGrams: true,
        unitCostCents: true, temperatureZone: true, insulated: true, insulationHours: true,
        tamperEvident: true, valueClass: true, hazmatRated: true, hazmatClasses: true, materialType: true, active: true,
      },
    });
  }
}
