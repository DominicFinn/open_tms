import { PrismaClient, ReceivingAppointment, ReceivingTask, ReceivingLine } from '@prisma/client';

// ── DTOs ─────────────────────────────────────────────────────

export interface CreateReceivingAppointmentDTO {
  locationId: string;
  inboundShipmentId?: string | null;
  dockBinId?: string | null;
  scheduledAt: Date;
  scheduledEndAt: Date;
  carrierName?: string | null;
  trailerNumber?: string | null;
  sealNumber?: string | null;
  asnReference?: string | null;
  orgId: string;
}

export interface CreateReceivingTaskDTO {
  locationId: string;
  appointmentId?: string | null;
  inboundShipmentId?: string | null;
  dockBinId?: string | null;
  receivingType: string;
  crossDock?: boolean;
  assignedToUserId?: string | null;
  orgId: string;
}

export interface CreateReceivingLineDTO {
  receivingTaskId: string;
  orderLineItemId?: string | null;
  trackableUnitId?: string | null;
  sku: string;
  uomCode?: string;
  expectedQuantity?: number | null;
  lotNumber?: string | null;
  expiryDate?: Date | null;
}

export interface ReceivingTaskWithLines extends ReceivingTask {
  lines: ReceivingLine[];
  appointment: ReceivingAppointment | null;
  _count: { lines: number };
}

// ── Interface ────────────────────────────────────────────────

export interface IReceivingRepository {
  // Appointments
  findAppointmentsByLocation(locationId: string, date?: Date): Promise<ReceivingAppointment[]>;
  findAppointmentById(id: string): Promise<ReceivingAppointment | null>;
  createAppointment(data: CreateReceivingAppointmentDTO): Promise<ReceivingAppointment>;
  updateAppointmentStatus(id: string, status: string): Promise<ReceivingAppointment>;

  // Tasks
  findTasksByLocation(locationId: string, status?: string): Promise<ReceivingTaskWithLines[]>;
  findTaskById(id: string): Promise<ReceivingTaskWithLines | null>;
  createTask(data: CreateReceivingTaskDTO): Promise<ReceivingTask>;
  updateTaskStatus(id: string, status: string): Promise<ReceivingTask>;

  // Lines
  findLinesByTask(taskId: string): Promise<ReceivingLine[]>;
  createLine(data: CreateReceivingLineDTO): Promise<ReceivingLine>;
  updateLine(id: string, data: Partial<Pick<ReceivingLine, 'receivedQuantity' | 'damagedQuantity' | 'inspectionStatus' | 'trackableUnitId' | 'lotNumber' | 'expiryDate'>>): Promise<ReceivingLine>;
}

// ── Implementation ───────────────────────────────────────────

export class ReceivingRepository implements IReceivingRepository {
  constructor(private prisma: PrismaClient) {}

  // ── Appointments ───────────────────────────────────────────

  async findAppointmentsByLocation(locationId: string, date?: Date): Promise<ReceivingAppointment[]> {
    const where: any = { locationId };
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

  async findAppointmentById(id: string): Promise<ReceivingAppointment | null> {
    return this.prisma.receivingAppointment.findUnique({ where: { id } });
  }

  async createAppointment(data: CreateReceivingAppointmentDTO): Promise<ReceivingAppointment> {
    return this.prisma.receivingAppointment.create({ data });
  }

  async updateAppointmentStatus(id: string, status: string): Promise<ReceivingAppointment> {
    return this.prisma.receivingAppointment.update({ where: { id }, data: { status } });
  }

  // ── Tasks ──────────────────────────────────────────────────

  async findTasksByLocation(locationId: string, status?: string): Promise<ReceivingTaskWithLines[]> {
    const where: any = { locationId };
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

  async findTaskById(id: string): Promise<ReceivingTaskWithLines | null> {
    return this.prisma.receivingTask.findUnique({
      where: { id },
      include: {
        lines: { orderBy: { createdAt: 'asc' } },
        appointment: true,
        _count: { select: { lines: true } },
      },
    }) as Promise<ReceivingTaskWithLines | null>;
  }

  async createTask(data: CreateReceivingTaskDTO): Promise<ReceivingTask> {
    return this.prisma.receivingTask.create({ data });
  }

  async updateTaskStatus(id: string, status: string): Promise<ReceivingTask> {
    return this.prisma.receivingTask.update({ where: { id }, data: { status } });
  }

  // ── Lines ──────────────────────────────────────────────────

  async findLinesByTask(taskId: string): Promise<ReceivingLine[]> {
    return this.prisma.receivingLine.findMany({
      where: { receivingTaskId: taskId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async createLine(data: CreateReceivingLineDTO): Promise<ReceivingLine> {
    return this.prisma.receivingLine.create({ data });
  }

  async updateLine(id: string, data: Partial<Pick<ReceivingLine, 'receivedQuantity' | 'damagedQuantity' | 'inspectionStatus' | 'trackableUnitId' | 'lotNumber' | 'expiryDate'>>): Promise<ReceivingLine> {
    return this.prisma.receivingLine.update({ where: { id }, data });
  }
}
