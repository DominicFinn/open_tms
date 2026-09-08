import { PrismaClient, ReceivingAppointment, ReceivingTask, ReceivingLine } from '@prisma/client';
import { WarehouseScope, scopedWhere } from './warehouseScope.js';

// Reads only. Every receiving write goes through the command bus, so there is no unscoped
// create or update here for a caller to reach for.

// ── DTOs ─────────────────────────────────────────────────────

export interface ReceivingTaskWithLines extends ReceivingTask {
  lines: ReceivingLine[];
  appointment: ReceivingAppointment | null;
  _count: { lines: number };
}

// ── Interface ────────────────────────────────────────────────

// Every read takes orgId first. Receiving rows are tenant data: an unscoped lookup by id is a
// cross-tenant read, which is what #220 was raised for.
export interface IReceivingRepository {
  // Appointments
  findAppointments(orgId: string, scope: WarehouseScope, date?: Date): Promise<ReceivingAppointment[]>;
  findAppointmentById(orgId: string, id: string): Promise<ReceivingAppointment | null>;

  // Tasks
  findTasks(orgId: string, scope: WarehouseScope, status?: string): Promise<ReceivingTaskWithLines[]>;
  findTaskById(orgId: string, id: string): Promise<ReceivingTaskWithLines | null>;
}

// ── Implementation ───────────────────────────────────────────

export class ReceivingRepository implements IReceivingRepository {
  constructor(private prisma: PrismaClient) {}

  // ── Appointments ───────────────────────────────────────────

  async findAppointments(orgId: string, scope: WarehouseScope, date?: Date): Promise<ReceivingAppointment[]> {
    const where: any = scopedWhere(orgId, scope);
    if (date) {
      const dayStart = new Date(date);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(date);
      dayEnd.setHours(23, 59, 59, 999);
      where.scheduledAt = { gte: dayStart, lte: dayEnd };
    }
    return this.prisma.receivingAppointment.findMany({
      where,
      orderBy: { scheduledAt: 'asc' },
    });
  }

  async findAppointmentById(orgId: string, id: string): Promise<ReceivingAppointment | null> {
    return this.prisma.receivingAppointment.findFirst({ where: { id, orgId } });
  }


  // ── Tasks ──────────────────────────────────────────────────

  async findTasks(orgId: string, scope: WarehouseScope, status?: string): Promise<ReceivingTaskWithLines[]> {
    const where: any = scopedWhere(orgId, scope);
    if (status) where.status = status;
    return this.prisma.receivingTask.findMany({
      where,
      include: {
        lines: true,
        appointment: true,
        _count: { select: { lines: true } },
      },
      orderBy: { createdAt: 'desc' },
    }) as Promise<ReceivingTaskWithLines[]>;
  }

  async findTaskById(orgId: string, id: string): Promise<ReceivingTaskWithLines | null> {
    return this.prisma.receivingTask.findFirst({
      where: { id, orgId },
      include: {
        lines: { orderBy: { createdAt: 'asc' } },
        appointment: true,
        _count: { select: { lines: true } },
      },
    }) as Promise<ReceivingTaskWithLines | null>;
  }


}
