/**
 * The public half of shipment sharing — what someone outside the organisation actually hits.
 *
 * Three steps. Fetch the gate state for a token, exchange an email plus the access code for a
 * short-lived viewer session, then read the shipment through that session. Nothing here trusts a
 * client-supplied org, shipment or section: the token resolves the tenant, and the granted
 * sections are re-read from the stored link on every request.
 *
 * These routes are registered outside the authenticated JWT scope, so they carry their own rate
 * limiting. They are the only unauthenticated write surface in the shipment domain, and the
 * access code is short enough to guess given enough attempts, so the limits here are the first
 * line of defence and the per-link lockout is the second.
 */

import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { randomUUID } from 'crypto';
import rateLimit from '@fastify/rate-limit';
import { container, TOKENS } from '../di/index.js';
import { ICommandBus } from '../commands/CommandBus.js';
import { IShipmentShareRepository } from '../repositories/ShipmentShareRepository.js';
import { IShipmentShareService } from '../services/ShipmentShareService.js';
import { IShipmentShareViewService } from '../services/ShipmentShareViewService.js';
import { authenticateShareViewerJWT } from '../middleware/jwtAuth.js';
import { RECORD_SHIPMENT_SHARE_ACCESS } from '../commands/shipmentShare/index.js';
import { normaliseShareSections } from '@open-tms/shared';

/** Ten code attempts per minute from one address, across every link it might be trying. */
const AUTHENTICATE_ATTEMPTS_PER_MINUTE = 10;
/** Reading an open session is cheap, but still bounded so a leaked session cannot be used to scrape. */
const VIEW_REQUESTS_PER_MINUTE = 60;

export async function publicShipmentShareRoutes(server: FastifyInstance) {
  await server.register(rateLimit, { global: false });

  const commandBus = container.resolve<ICommandBus>(TOKENS.ICommandBus);
  const shareRepo = container.resolve<IShipmentShareRepository>(TOKENS.IShipmentShareRepository);
  const shareService = container.resolve<IShipmentShareService>(TOKENS.IShipmentShareService);
  const viewService = container.resolve<IShipmentShareViewService>(TOKENS.IShipmentShareViewService);

  server.get('/api/v1/share/:token', {
    config: { rateLimit: { max: VIEW_REQUESTS_PER_MINUTE, timeWindow: '1 minute' } },
    schema: {
      tags: ['Shipment Sharing (Public)'],
      summary: 'Check whether a share link is still open',
      description:
        'Tells the gate page whether to ask for an access code. Reveals nothing about the shipment.',
      params: { type: 'object', required: ['token'], properties: { token: { type: 'string' } } },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { token } = req.params as { token: string };
    const link = await shareRepo.findByTokenHash(shareService.hashToken(token));

    // An unknown token and a token for another tenant are the same answer. There is no tenant
    // context here to check against, which is exactly why the token has to be unguessable.
    if (!link) {
      reply.code(404);
      return { data: null, error: 'This link is not valid' };
    }

    const unavailable = shareService.checkAvailability(link);
    return {
      data: {
        state: unavailable === null ? 'open' : unavailable.replace('denied_', ''),
        expiresAt: link.expiresAt,
      },
      error: null,
    };
  });

  server.post('/api/v1/share/:token/authenticate', {
    config: { rateLimit: { max: AUTHENTICATE_ATTEMPTS_PER_MINUTE, timeWindow: '1 minute' } },
    schema: {
      tags: ['Shipment Sharing (Public)'],
      summary: 'Exchange an email and access code for a viewer session',
      description:
        'Every attempt is written to the shipment access log, granted or denied. Five wrong codes lock the link for 15 minutes.',
      params: { type: 'object', required: ['token'], properties: { token: { type: 'string' } } },
      body: {
        type: 'object',
        required: ['email', 'accessCode'],
        additionalProperties: false,
        properties: {
          email: { type: 'string', format: 'email', maxLength: 254 },
          accessCode: { type: 'string', minLength: 4, maxLength: 32 },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { token } = req.params as { token: string };
    const { email, accessCode } = req.body as { email: string; accessCode: string };

    const link = await shareRepo.findByTokenHash(shareService.hashToken(token));
    if (!link) {
      reply.code(404);
      return { data: null, error: 'This link is not valid' };
    }

    // The pre-read above only resolves the tenant. Every decision, and the counters that go with
    // it, happen inside the command's transaction against a freshly read row.
    const result = await commandBus.dispatch({
      type: RECORD_SHIPMENT_SHARE_ACCESS,
      orgId: link.orgId,
      actorId: null,
      payload: { shareLinkId: link.id, accessCode, email, ip: req.ip },
      metadata: { correlationId: randomUUID(), source: 'public-share' },
    });

    if (!result.success) {
      reply.code(400);
      return { data: null, error: result.error };
    }

    const decision = result.data as {
      granted: boolean;
      reason: string | null;
      shipmentId: string;
      sections: string[];
      linkExpiresAt: Date;
      lockedUntil: Date | null;
    };

    if (!decision.granted) {
      req.log.warn(
        {
          orgId: link.orgId,
          shipmentId: decision.shipmentId,
          shareLinkId: link.id,
          outcome: decision.reason,
        },
        'Share link access denied'
      );
      reply.code(decision.reason === 'denied_bad_code' ? 401 : 403);
      return {
        data: decision.lockedUntil ? { lockedUntil: decision.lockedUntil } : null,
        error: messageForDenial(decision.reason),
      };
    }

    const session = shareService.signViewerToken({
      shareLinkId: link.id,
      shipmentId: decision.shipmentId,
      orgId: link.orgId,
      sections: decision.sections,
      linkExpiresAt: decision.linkExpiresAt,
    });

    return {
      data: {
        sessionToken: session.token,
        expiresAt: session.expiresAt,
        sections: normaliseShareSections(decision.sections),
      },
      error: null,
    };
  });

  server.get('/api/v1/share/session/shipment', {
    preHandler: authenticateShareViewerJWT,
    config: { rateLimit: { max: VIEW_REQUESTS_PER_MINUTE, timeWindow: '1 minute' } },
    schema: {
      tags: ['Shipment Sharing (Public)'],
      summary: 'Read the shared shipment for the current viewer session',
      description:
        'Only the sections the link grants are returned. A link revoked, expired or edited mid-session takes effect on the next request.',
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const viewer = req.shareViewer!;

    // Re-read the link rather than trusting the session's copy of the sections, so revoking a
    // link or narrowing what it shares takes effect immediately instead of at session expiry.
    const link = await shareRepo.findById(viewer.orgId, viewer.sub);
    if (!link) {
      reply.code(404);
      return { data: null, error: 'This link is not valid' };
    }

    const unavailable = shareService.checkAvailability(link);
    if (unavailable) {
      reply.code(403);
      return { data: null, error: messageForDenial(unavailable) };
    }

    const view = await viewService.build(
      viewer.orgId,
      link.shipmentId,
      normaliseShareSections(link.sections)
    );
    if (!view) {
      reply.code(404);
      return { data: null, error: 'This shipment is no longer available' };
    }

    return { data: view, error: null };
  });
}

function messageForDenial(reason: string | null): string {
  switch (reason) {
    case 'denied_revoked':
      return 'This link has been withdrawn by the sender';
    case 'denied_expired':
      return 'This link has expired';
    case 'denied_locked':
      return 'Too many incorrect codes. Try again in 15 minutes';
    default:
      return 'That access code is not correct';
  }
}
