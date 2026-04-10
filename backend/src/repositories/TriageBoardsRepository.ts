import { PrismaClient, TriageBoard, Prisma } from '@prisma/client';

/* ------------------------------------------------------------------ */
/*  DTOs                                                               */
/* ------------------------------------------------------------------ */

export interface CreateTriageBoardDTO {
  orgId: string;
  name: string;
  description?: string;
  icon?: string;
  createdBy?: string;
  isDefault?: boolean;
  isShared?: boolean;

  filterStatus?: string[];
  filterSeverity?: string[];
  filterPriority?: number[];
  filterCategory?: string[];
  filterCustomerId?: string;
  filterCarrierId?: string;
  filterLaneId?: string;
  filterRegion?: string[];
  filterTempControlled?: boolean;
  filterHazmat?: boolean;
  filterAssigneeId?: string;
  filterSource?: string[];
  filterDateRange?: string;
  filterQuery?: string;
  filterSignalScoreMin?: number;
  filterShowNoise?: boolean;

  viewMode?: string;
  sortBy?: string;
  sortOrder?: string;
}

export interface UpdateTriageBoardDTO {
  name?: string;
  description?: string;
  icon?: string;
  isDefault?: boolean;
  isShared?: boolean;

  filterStatus?: string[] | null;
  filterSeverity?: string[] | null;
  filterPriority?: number[] | null;
  filterCategory?: string[] | null;
  filterCustomerId?: string | null;
  filterCarrierId?: string | null;
  filterLaneId?: string | null;
  filterRegion?: string[] | null;
  filterTempControlled?: boolean | null;
  filterHazmat?: boolean | null;
  filterAssigneeId?: string | null;
  filterSource?: string[] | null;
  filterDateRange?: string | null;
  filterQuery?: string | null;
  filterSignalScoreMin?: number | null;
  filterShowNoise?: boolean;

  viewMode?: string;
  sortBy?: string;
  sortOrder?: string;
}

/* ------------------------------------------------------------------ */
/*  Interface                                                          */
/* ------------------------------------------------------------------ */

export interface ITriageBoardsRepository {
  findAll(orgId: string): Promise<TriageBoard[]>;
  findById(id: string): Promise<TriageBoard | null>;
  create(data: CreateTriageBoardDTO): Promise<TriageBoard>;
  update(id: string, data: UpdateTriageBoardDTO): Promise<TriageBoard>;
  delete(id: string): Promise<TriageBoard>;
  applyFilters(board: TriageBoard): Record<string, unknown>;
}

/* ------------------------------------------------------------------ */
/*  Implementation                                                     */
/* ------------------------------------------------------------------ */

export class TriageBoardsRepository implements ITriageBoardsRepository {
  constructor(private prisma: PrismaClient) {}

  /**
   * List all boards for an org: shared boards + boards created by the caller.
   * (Caller-level filtering by createdBy can be layered on top if needed.)
   */
  async findAll(orgId: string): Promise<TriageBoard[]> {
    return this.prisma.triageBoard.findMany({
      where: {
        orgId,
        OR: [
          { isShared: true },
          { createdBy: { not: null } }, // include personal boards too — the route can further filter by user
        ],
      },
      orderBy: [
        { isDefault: 'desc' },
        { name: 'asc' },
      ],
    });
  }

  async findById(id: string): Promise<TriageBoard | null> {
    return this.prisma.triageBoard.findUnique({ where: { id } });
  }

  async create(data: CreateTriageBoardDTO): Promise<TriageBoard> {
    return this.prisma.triageBoard.create({
      data: {
        orgId: data.orgId,
        name: data.name,
        description: data.description,
        icon: data.icon,
        createdBy: data.createdBy,
        isDefault: data.isDefault ?? false,
        isShared: data.isShared ?? true,

        filterStatus: data.filterStatus ?? Prisma.JsonNull,
        filterSeverity: data.filterSeverity ?? Prisma.JsonNull,
        filterPriority: data.filterPriority ?? Prisma.JsonNull,
        filterCategory: data.filterCategory ?? Prisma.JsonNull,
        filterCustomerId: data.filterCustomerId,
        filterCarrierId: data.filterCarrierId,
        filterLaneId: data.filterLaneId,
        filterRegion: data.filterRegion ?? Prisma.JsonNull,
        filterTempControlled: data.filterTempControlled,
        filterHazmat: data.filterHazmat,
        filterAssigneeId: data.filterAssigneeId,
        filterSource: data.filterSource ?? Prisma.JsonNull,
        filterDateRange: data.filterDateRange,
        filterQuery: data.filterQuery,
        filterSignalScoreMin: data.filterSignalScoreMin,
        filterShowNoise: data.filterShowNoise ?? false,

        viewMode: data.viewMode ?? 'kanban',
        sortBy: data.sortBy ?? 'createdAt',
        sortOrder: data.sortOrder ?? 'desc',
      },
    });
  }

  async update(id: string, data: UpdateTriageBoardDTO): Promise<TriageBoard> {
    const updateData: any = {};

    // Scalar fields — only include if explicitly provided
    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.icon !== undefined) updateData.icon = data.icon;
    if (data.isDefault !== undefined) updateData.isDefault = data.isDefault;
    if (data.isShared !== undefined) updateData.isShared = data.isShared;
    if (data.viewMode !== undefined) updateData.viewMode = data.viewMode;
    if (data.sortBy !== undefined) updateData.sortBy = data.sortBy;
    if (data.sortOrder !== undefined) updateData.sortOrder = data.sortOrder;

    // Nullable scalar filters
    if (data.filterCustomerId !== undefined) updateData.filterCustomerId = data.filterCustomerId;
    if (data.filterCarrierId !== undefined) updateData.filterCarrierId = data.filterCarrierId;
    if (data.filterLaneId !== undefined) updateData.filterLaneId = data.filterLaneId;
    if (data.filterTempControlled !== undefined) updateData.filterTempControlled = data.filterTempControlled;
    if (data.filterHazmat !== undefined) updateData.filterHazmat = data.filterHazmat;
    if (data.filterAssigneeId !== undefined) updateData.filterAssigneeId = data.filterAssigneeId;
    if (data.filterDateRange !== undefined) updateData.filterDateRange = data.filterDateRange;
    if (data.filterQuery !== undefined) updateData.filterQuery = data.filterQuery;
    if (data.filterSignalScoreMin !== undefined) updateData.filterSignalScoreMin = data.filterSignalScoreMin;
    if (data.filterShowNoise !== undefined) updateData.filterShowNoise = data.filterShowNoise;

    // JSON fields — null means "clear this filter", use Prisma.JsonNull
    if (data.filterStatus !== undefined) {
      updateData.filterStatus = data.filterStatus === null ? Prisma.JsonNull : data.filterStatus;
    }
    if (data.filterSeverity !== undefined) {
      updateData.filterSeverity = data.filterSeverity === null ? Prisma.JsonNull : data.filterSeverity;
    }
    if (data.filterPriority !== undefined) {
      updateData.filterPriority = data.filterPriority === null ? Prisma.JsonNull : data.filterPriority;
    }
    if (data.filterCategory !== undefined) {
      updateData.filterCategory = data.filterCategory === null ? Prisma.JsonNull : data.filterCategory;
    }
    if (data.filterRegion !== undefined) {
      updateData.filterRegion = data.filterRegion === null ? Prisma.JsonNull : data.filterRegion;
    }
    if (data.filterSource !== undefined) {
      updateData.filterSource = data.filterSource === null ? Prisma.JsonNull : data.filterSource;
    }

    return this.prisma.triageBoard.update({
      where: { id },
      data: updateData,
    });
  }

  async delete(id: string): Promise<TriageBoard> {
    return this.prisma.triageBoard.delete({ where: { id } });
  }

  /**
   * Convert a TriageBoard's filter fields into a Prisma `where` clause
   * suitable for querying the Issue model.
   */
  applyFilters(board: TriageBoard): Record<string, unknown> {
    const where: Record<string, unknown> = {
      orgId: board.orgId,
    };

    // --- JSON array filters: { in: [...] } ---

    const statusArr = board.filterStatus as string[] | null;
    if (Array.isArray(statusArr) && statusArr.length > 0) {
      where.status = { in: statusArr };
    }

    const severityArr = board.filterSeverity as string[] | null;
    if (Array.isArray(severityArr) && severityArr.length > 0) {
      where.severity = { in: severityArr };
    }

    const priorityArr = board.filterPriority as number[] | null;
    if (Array.isArray(priorityArr) && priorityArr.length > 0) {
      where.priority = { in: priorityArr };
    }

    const categoryArr = board.filterCategory as string[] | null;
    if (Array.isArray(categoryArr) && categoryArr.length > 0) {
      where.category = { in: categoryArr };
    }

    const regionArr = board.filterRegion as string[] | null;
    if (Array.isArray(regionArr) && regionArr.length > 0) {
      where.region = { in: regionArr };
    }

    const sourceArr = board.filterSource as string[] | null;
    if (Array.isArray(sourceArr) && sourceArr.length > 0) {
      where.source = { in: sourceArr };
    }

    // --- Scalar ID filters ---

    if (board.filterCustomerId) {
      where.customerId = board.filterCustomerId;
    }

    if (board.filterCarrierId) {
      where.carrierId = board.filterCarrierId;
    }

    if (board.filterLaneId) {
      where.laneId = board.filterLaneId;
    }

    if (board.filterAssigneeId) {
      where.assigneeId = board.filterAssigneeId;
    }

    // --- Boolean filters ---

    if (board.filterTempControlled !== null && board.filterTempControlled !== undefined) {
      // Temp-controlled issues are linked to shipments that have tempControlled = true.
      // If this needs a join, the route layer can handle it. For direct Issue filtering we
      // would need a denormalized field. For now, store it on the where and let the caller
      // decide how to apply it (e.g., via a subquery or a join).
      // A simple approach: issues may have tags or a derived field. Leaving as-is for now.
    }

    if (board.filterHazmat !== null && board.filterHazmat !== undefined) {
      // Same note as tempControlled — may require join to Shipment. Placeholder.
    }

    // --- Signal score ---

    if (board.filterSignalScoreMin !== null && board.filterSignalScoreMin !== undefined) {
      where.signalScore = { gte: board.filterSignalScoreMin };
    }

    // --- Noise filter ---

    if (!board.filterShowNoise) {
      where.isNoise = false;
    }

    // --- Date range ---

    if (board.filterDateRange) {
      const now = new Date();
      let dateFrom: Date | null = null;

      switch (board.filterDateRange) {
        case 'today': {
          dateFrom = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          break;
        }
        case 'week': {
          dateFrom = new Date(now);
          dateFrom.setDate(dateFrom.getDate() - 7);
          break;
        }
        case 'month': {
          dateFrom = new Date(now);
          dateFrom.setMonth(dateFrom.getMonth() - 1);
          break;
        }
        case 'quarter': {
          dateFrom = new Date(now);
          dateFrom.setMonth(dateFrom.getMonth() - 3);
          break;
        }
        // "custom" — the frontend would supply explicit dates via query params;
        // the board's filterDateRange only signals the preset.
        default:
          break;
      }

      if (dateFrom) {
        where.createdAt = { gte: dateFrom };
      }
    }

    // --- Free-text search (ILIKE on title / description / issueNumber) ---

    if (board.filterQuery) {
      const q = board.filterQuery;
      where.OR = [
        { title: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
        { issueNumber: { contains: q, mode: 'insensitive' } },
      ];
    }

    return where;
  }
}
