/**
 * Share link administration — the operator side of shipment sharing.
 *
 * Sits inside the authenticated JWT scope and is gated on `shipments:share`, which is separate
 * from `shipments:write` because minting a link puts shipment data outside the organisation.
 * The public half lives in publicShipmentShare.ts.
 */

import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { randomUUID } from 'crypto';
import { container, TOKENS } from '../di/index.js';
import { ICommandBus } from '../commands/CommandBus.js';
import { registerOrgScope } from '../auth/orgScopeMiddleware.js';
import { requirePermission } from '../middleware/jwtAuth.js';
import { IShipmentShareRepository } from '../repositories/ShipmentShareRepository.js';
import {
  CREATE_SHIPMENT_SHARE_LINK,
  UPDATE_SHIPMENT_SHARE_LINK,
  REVOKE_SHIPMENT_SHARE_LINK,
  SHARE_LINK_SHIPMENT_NOT_FOUND,
  SHARE_LINK_NOT_FOUND,
  SHARE_LINK_ALREADY_REVOKED,
} from '../commands/shipmentShare/index.js';
import { SHIPMENT_SHARE_SECTIONS } from '@open-tms/shared';

const MAX_ACCESS_LOG_PAGE_SIZE = 100;

const linkResponseProperties = {
  id: { type: 'string' },
  shipmentId: { type: 'string' },
  label: { type: 'string', nullable: true },
  sections: { type: 'array', items: { type: 'string' } },
  expiresAt: { type: 'string', format: 'date-time' },
  revokedAt: { type: 'string', format: 'date-time', nullable: true },
  accessCount: { type: 'integer' },
  lastAccessedAt: { type: 'string', format: 'date-time', nullable: true },
  createdAt: { type: 'string', format: 'date-time' },
};

export async function shipmentShareLinkRoutes(server: FastifyInstance) {
  await registerOrgScope(server);

  const commandBus = container.resolve<ICommandBus>(TOKENS.ICommandBus);
  const shareRepo = container.resolve<IShipmentShareRepository>(TOKENS.IShipmentShareRepository);

  const publicBaseUrl = process.env.PUBLIC_URL || 'http://localhost:5173';
  const shareUrl = (token: string) => `${publicBaseUrl}/share/${token}`;

  server.get('/api/v1/shipments/:shipmentId/share-links', {
    preHandler: requirePermission('shipments:share'),
    schema: {
      tags: ['Shipment Sharing'],
      summary: 'List the share links issued for a shipment',
      params: {
        type: 'object',
        required: ['shipmentId'],
        properties: { shipmentId: { type: 'string', format: 'uuid' } },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            data: { type: 'array', items: { type: 'object', properties: linkResponseProperties } },
            error: { type: 'string', nullable: true },
          },
        },
      },
    },
  }, async (req: FastifyRequest) => {
    const { shipmentId } = req.params as { shipmentId: string };
    const links = await shareRepo.listForShipment(req.orgId!, shipmentId);
    return { data: links, error: null };
  });

  server.post('/api/v1/shipments/:shipmentId/share-links', {
    preHandler: requirePermission('shipments:share'),
    schema: {
      tags: ['Shipment Sharing'],
      summary: 'Issue a share link for a shipment',
      description:
        'Returns the URL token and the access code exactly once. Neither is recoverable afterwards.',
      params: {
        type: 'object',
        required: ['shipmentId'],
        properties: { shipmentId: { type: 'string', format: 'uuid' } },
      },
      body: {
        type: 'object',
        required: ['sections', 'expiresAt'],
        additionalProperties: false,
        properties: {
          sections: {
            type: 'array',
            minItems: 1,
            items: { type: 'string', enum: [...SHIPMENT_SHARE_SECTIONS] },
          },
          expiresAt: { type: 'string', format: 'date-time' },
          label: { type: 'string', maxLength: 120, nullable: true },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { shipmentId } = req.params as { shipmentId: string };
    const body = req.body as { sections: string[]; expiresAt: string; label?: string | null };

    const result = await commandBus.dispatch({
      type: CREATE_SHIPMENT_SHARE_LINK,
      orgId: req.orgId!,
      actorId: req.user?.sub ?? null,
      payload: { shipmentId, sections: body.sections, expiresAt: body.expiresAt, label: body.label },
      metadata: { correlationId: randomUUID(), source: 'api' },
    });

    if (!result.success) {
      reply.code(result.error === SHARE_LINK_SHIPMENT_NOT_FOUND ? 404 : 400);
      return { data: null, error: result.error };
    }

    const created = result.data as { token: string; accessCode: string; id: string };
    reply.code(201);
    return {
      data: {
        id: created.id,
        url: shareUrl(created.token),
        accessCode: created.accessCode,
        sections: (result.data as any).sections,
        expiresAt: (result.data as any).expiresAt,
        label: (result.data as any).label,
      },
      error: null,
    };
  });

  server.patch('/api/v1/share-links/:id', {
    preHandler: requirePermission('shipments:share'),
    schema: {
      tags: ['Shipment Sharing'],
      summary: 'Change what a share link exposes, or when it expires',
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string', format: 'uuid' } },
      },
      body: {
        type: 'object',
        additionalProperties: false,
        minProperties: 1,
        properties: {
          sections: {
            type: 'array',
            minItems: 1,
            items: { type: 'string', enum: [...SHIPMENT_SHARE_SECTIONS] },
          },
          expiresAt: { type: 'string', format: 'date-time' },
          label: { type: 'string', maxLength: 120, nullable: true },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };

    const result = await commandBus.dispatch({
      type: UPDATE_SHIPMENT_SHARE_LINK,
      orgId: req.orgId!,
      actorId: req.user?.sub ?? null,
      payload: { shareLinkId: id, ...(req.body as object) },
      metadata: { correlationId: randomUUID(), source: 'api' },
    });

    if (!result.success) {
      reply.code(statusForShareLinkError(result.error));
      return { data: null, error: result.error };
    }
    return { data: result.data, error: null };
  });

  server.delete('/api/v1/share-links/:id', {
    preHandler: requirePermission('shipments:share'),
    schema: {
      tags: ['Shipment Sharing'],
      summary: 'Revoke a share link',
      description:
        'The link stops working immediately, including for sessions already open. The row is kept so the access log survives.',
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string', format: 'uuid' } },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };

    const result = await commandBus.dispatch({
      type: REVOKE_SHIPMENT_SHARE_LINK,
      orgId: req.orgId!,
      actorId: req.user?.sub ?? null,
      payload: { shareLinkId: id },
      metadata: { correlationId: randomUUID(), source: 'api' },
    });

    if (!result.success) {
      reply.code(statusForShareLinkError(result.error));
      return { data: null, error: result.error };
    }
    return { data: result.data, error: null };
  });

  server.get('/api/v1/share-links/:id/accesses', {
    preHandler: requirePermission('shipments:share'),
    schema: {
      tags: ['Shipment Sharing'],
      summary: 'List who has opened a share link',
      description:
        'One row per attempt, granted or denied. Includes the email the viewer supplied, which is why this needs shipments:share.',
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string', format: 'uuid' } },
      },
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', minimum: 1, default: 1 },
          perPage: { type: 'integer', minimum: 1, maximum: MAX_ACCESS_LOG_PAGE_SIZE, default: 25 },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const { page = 1, perPage = 25 } = req.query as { page?: number; perPage?: number };

    // Confirms the link belongs to this tenant before the ledger is read. A link from another
    // org reads as absent rather than forbidden, so its existence stays opaque.
    const link = await shareRepo.findById(req.orgId!, id);
    if (!link) {
      reply.code(404);
      return { data: null, error: 'Share link not found' };
    }

    const { items, total } = await shareRepo.listAccesses(req.orgId!, id, page, perPage);
    return { data: items, meta: { page, perPage, total }, error: null };
  });
}

function statusForShareLinkError(error: string | undefined): number {
  if (error === SHARE_LINK_NOT_FOUND) return 404;
  if (error === SHARE_LINK_ALREADY_REVOKED) return 409;
  return 400;
}
