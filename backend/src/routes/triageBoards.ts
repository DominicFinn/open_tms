/**
 * Triage Board Routes — Saved filter boards for the Triage Centre
 *
 * GET    /api/v1/triage-boards            — list boards for org
 * POST   /api/v1/triage-boards            — create board
 * GET    /api/v1/triage-boards/:id        — get board
 * PATCH  /api/v1/triage-boards/:id        — update board
 * DELETE /api/v1/triage-boards/:id        — delete board
 * GET    /api/v1/triage-boards/:id/issues — apply board filters, return matching issues
 */

import { FastifyInstance } from 'fastify';
import { container } from '../di/container.js';
import { TOKENS } from '../di/tokens.js';
import { ITriageBoardsRepository } from '../repositories/TriageBoardsRepository.js';

export async function triageBoardRoutes(server: FastifyInstance) {
  const prefix = '/api/v1/triage-boards';

  // ----------------------------------------------------------------
  // GET /api/v1/triage-boards — List boards for an org
  // ----------------------------------------------------------------
  server.get(prefix, {
    schema: {
      tags: ['Triage Boards'],
      summary: 'List triage boards for an organization',
      querystring: {
        type: 'object',
        required: ['orgId'],
        properties: {
          orgId: { type: 'string' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            data: { type: 'array', items: { type: 'object' } },
            error: { type: 'string', nullable: true },
          },
        },
      },
    },
  }, async (request) => {
    const repo = container.resolve<ITriageBoardsRepository>(TOKENS.ITriageBoardsRepository);
    const { orgId } = request.query as { orgId: string };
    const boards = await repo.findAll(orgId);
    return { data: boards, error: null };
  });

  // ----------------------------------------------------------------
  // POST /api/v1/triage-boards — Create board
  // ----------------------------------------------------------------
  server.post(prefix, {
    schema: {
      tags: ['Triage Boards'],
      summary: 'Create a new triage board',
      body: {
        type: 'object',
        required: ['orgId', 'name'],
        properties: {
          orgId: { type: 'string' },
          name: { type: 'string' },
          description: { type: 'string' },
          icon: { type: 'string' },
          isDefault: { type: 'boolean' },
          isShared: { type: 'boolean' },

          filterStatus: { type: 'array', items: { type: 'string' } },
          filterSeverity: { type: 'array', items: { type: 'string' } },
          filterPriority: { type: 'array', items: { type: 'integer' } },
          filterCategory: { type: 'array', items: { type: 'string' } },
          filterCustomerId: { type: 'string' },
          filterCarrierId: { type: 'string' },
          filterLaneId: { type: 'string' },
          filterRegion: { type: 'array', items: { type: 'string' } },
          filterTempControlled: { type: 'boolean' },
          filterHazmat: { type: 'boolean' },
          filterAssigneeId: { type: 'string' },
          filterSource: { type: 'array', items: { type: 'string' } },
          filterDateRange: { type: 'string' },
          filterQuery: { type: 'string' },
          filterSignalScoreMin: { type: 'integer' },
          filterShowNoise: { type: 'boolean' },

          viewMode: { type: 'string', enum: ['kanban', 'list', 'timeline'] },
          sortBy: { type: 'string' },
          sortOrder: { type: 'string', enum: ['asc', 'desc'] },
        },
      },
      response: {
        201: {
          type: 'object',
          properties: {
            data: { type: 'object' },
            error: { type: 'string', nullable: true },
          },
        },
      },
    },
  }, async (request, reply) => {
    const repo = container.resolve<ITriageBoardsRepository>(TOKENS.ITriageBoardsRepository);
    const body = request.body as any;

    const board = await repo.create({
      ...body,
      createdBy: request.user?.sub,
    });

    return reply.status(201).send({ data: board, error: null });
  });

  // ----------------------------------------------------------------
  // GET /api/v1/triage-boards/:id — Get single board
  // ----------------------------------------------------------------
  server.get(`${prefix}/:id`, {
    schema: {
      tags: ['Triage Boards'],
      summary: 'Get a triage board by ID',
      params: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
      },
      response: {
        200: {
          type: 'object',
          properties: {
            data: { type: 'object', nullable: true },
            error: { type: 'string', nullable: true },
          },
        },
      },
    },
  }, async (request, reply) => {
    const repo = container.resolve<ITriageBoardsRepository>(TOKENS.ITriageBoardsRepository);
    const { id } = request.params as { id: string };
    const board = await repo.findById(id);
    if (!board) {
      return reply.status(404).send({ data: null, error: 'Triage board not found' });
    }
    return { data: board, error: null };
  });

  // ----------------------------------------------------------------
  // PATCH /api/v1/triage-boards/:id — Update board
  // ----------------------------------------------------------------
  server.patch(`${prefix}/:id`, {
    schema: {
      tags: ['Triage Boards'],
      summary: 'Update a triage board',
      params: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
      },
      body: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          description: { type: 'string', nullable: true },
          icon: { type: 'string', nullable: true },
          isDefault: { type: 'boolean' },
          isShared: { type: 'boolean' },

          filterStatus: { type: 'array', items: { type: 'string' }, nullable: true },
          filterSeverity: { type: 'array', items: { type: 'string' }, nullable: true },
          filterPriority: { type: 'array', items: { type: 'integer' }, nullable: true },
          filterCategory: { type: 'array', items: { type: 'string' }, nullable: true },
          filterCustomerId: { type: 'string', nullable: true },
          filterCarrierId: { type: 'string', nullable: true },
          filterLaneId: { type: 'string', nullable: true },
          filterRegion: { type: 'array', items: { type: 'string' }, nullable: true },
          filterTempControlled: { type: 'boolean', nullable: true },
          filterHazmat: { type: 'boolean', nullable: true },
          filterAssigneeId: { type: 'string', nullable: true },
          filterSource: { type: 'array', items: { type: 'string' }, nullable: true },
          filterDateRange: { type: 'string', nullable: true },
          filterQuery: { type: 'string', nullable: true },
          filterSignalScoreMin: { type: 'integer', nullable: true },
          filterShowNoise: { type: 'boolean' },

          viewMode: { type: 'string', enum: ['kanban', 'list', 'timeline'] },
          sortBy: { type: 'string' },
          sortOrder: { type: 'string', enum: ['asc', 'desc'] },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            data: { type: 'object' },
            error: { type: 'string', nullable: true },
          },
        },
      },
    },
  }, async (request, reply) => {
    const repo = container.resolve<ITriageBoardsRepository>(TOKENS.ITriageBoardsRepository);
    const { id } = request.params as { id: string };
    const body = request.body as any;

    try {
      const board = await repo.update(id, body);
      return { data: board, error: null };
    } catch {
      return reply.status(404).send({ data: null, error: 'Triage board not found' });
    }
  });

  // ----------------------------------------------------------------
  // DELETE /api/v1/triage-boards/:id — Delete board
  // ----------------------------------------------------------------
  server.delete(`${prefix}/:id`, {
    schema: {
      tags: ['Triage Boards'],
      summary: 'Delete a triage board',
      params: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
      },
      response: {
        200: {
          type: 'object',
          properties: {
            data: { type: 'object' },
            error: { type: 'string', nullable: true },
          },
        },
      },
    },
  }, async (request, reply) => {
    const repo = container.resolve<ITriageBoardsRepository>(TOKENS.ITriageBoardsRepository);
    const { id } = request.params as { id: string };

    try {
      const board = await repo.delete(id);
      return { data: board, error: null };
    } catch {
      return reply.status(404).send({ data: null, error: 'Triage board not found' });
    }
  });

  // ----------------------------------------------------------------
  // GET /api/v1/triage-boards/:id/issues — Apply filters and return issues
  // ----------------------------------------------------------------
  server.get(`${prefix}/:id/issues`, {
    schema: {
      tags: ['Triage Boards'],
      summary: 'List issues matching a triage board\'s filters',
      params: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
      },
      querystring: {
        type: 'object',
        properties: {
          limit: { type: 'integer', default: 100 },
          offset: { type: 'integer', default: 0 },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            data: {
              type: 'object',
              properties: {
                issues: { type: 'array', items: { type: 'object' } },
                total: { type: 'integer' },
                board: { type: 'object' },
              },
            },
            error: { type: 'string', nullable: true },
          },
        },
      },
    },
  }, async (request, reply) => {
    const repo = container.resolve<ITriageBoardsRepository>(TOKENS.ITriageBoardsRepository);
    const { id } = request.params as { id: string };
    const { limit = 100, offset = 0 } = request.query as { limit?: number; offset?: number };

    const board = await repo.findById(id);
    if (!board) {
      return reply.status(404).send({ data: null, error: 'Triage board not found' });
    }

    // Build the Prisma where clause from the board's saved filters
    const where = repo.applyFilters(board);

    // Determine sort
    const orderBy: Record<string, string> = {};
    orderBy[board.sortBy || 'createdAt'] = board.sortOrder || 'desc';

    const [issues, total] = await Promise.all([
      server.prisma.issue.findMany({
        where,
        orderBy,
        take: limit,
        skip: offset,
        include: { comments: { orderBy: { createdAt: 'desc' }, take: 1 } },
      }),
      server.prisma.issue.count({ where }),
    ]);

    return { data: { issues, total, board }, error: null };
  });
}
