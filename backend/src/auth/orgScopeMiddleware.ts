/**
 * Multi-tenancy: Fastify hooks that resolve `req.orgId` once per request.
 *
 * Why this exists
 * ----------------
 * Phases 1-3 of the multi-tenancy plan had every authed route call
 * `resolveOrgId(req)` by hand at the top of every handler. That worked,
 * but it relied on every author remembering to do it on every new route.
 * Forgetting it on one read endpoint reintroduces a cross-tenant leak.
 *
 * This middleware moves that resolution to a single preHandler so:
 *   1. `req.orgId` is populated for every request that goes through the
 *      authenticated route plugin, with no per-handler boilerplate.
 *   2. `requireOrgScope` fails closed (401) when no tenant context exists.
 *      `registerStrictOrgScope` applies both to every authenticated route
 *      in index.ts, so a new authenticated route cannot forget either.
 *   3. A token without `organizationId` resolves to the sole Organization
 *      only when exactly one exists (#239). With two or more it resolves
 *      to null and the strict scope refuses the request.
 *
 * Two flavours
 * ------------
 *  - `attachOrgScopeHook(prisma)`: a preHandler that resolves the JWT's
 *     orgId (or the sole Organization, see `resolveOrgId`) and stores it on
 *     `req.orgId`. Leaves `req.orgId = null` if neither is available.
 *  - `requireOrgScope`: a preHandler that returns 401 when `req.orgId`
 *     is null. Use on routes that absolutely must run inside a tenant.
 */

import type { FastifyRequest, FastifyReply, FastifyInstance, preHandlerHookHandler } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import { resolveOrgId } from './orgScope.js';

declare module 'fastify' {
  interface FastifyRequest {
    /**
     * The multi-tenancy scope for this request. Populated by
     * `attachOrgScopeHook`; null when neither the JWT nor the
     * sole-Organization fallback could provide one.
     */
    orgId?: string | null;
  }
}

/**
 * Returns a preHandler that resolves the orgId and decorates the request.
 * Designed to be registered via `server.addHook('preHandler', ...)` on
 * route plugins where every endpoint should see `req.orgId`.
 *
 * Idempotent: skips the resolution if `req.orgId` is already populated
 * (e.g. by an upstream auth middleware that wants to override).
 */
export function attachOrgScopeHook(prisma: PrismaClient): preHandlerHookHandler {
  return async (req: FastifyRequest, _reply: FastifyReply): Promise<void> => {
    if (req.orgId !== undefined) return;
    try {
      req.orgId = await resolveOrgId(req, prisma);
    } catch {
      // A failed lookup means no tenant, never a guessed one.
      // `requireOrgScope` blocks the request downstream.
      req.orgId = null;
    }
  };
}

/**
 * preHandler that refuses the request if no orgId is attached. Pair with
 * `attachOrgScopeHook` upstream; use on routes that must run inside a
 * tenant. Returns 401 (not 404) because the missing piece is the
 * authentication context, not the resource — the resource is presumably
 * gated downstream by its own orgId check.
 */
export const requireOrgScope: preHandlerHookHandler = async (
  req: FastifyRequest,
  reply: FastifyReply,
): Promise<void> => {
  if (!req.orgId) {
    reply.code(401);
    await reply.send({
      data: null,
      error: 'Multi-tenancy: this route requires an authenticated tenant context',
    });
  }
};

/**
 * Convenience: register the soft hook against a Fastify plugin/instance
 * so every route declared in it sees `req.orgId`. Use at the top of a
 * route file:
 *
 *   export async function customerRoutes(server: FastifyInstance) {
 *     await registerOrgScope(server);
 *     // …
 *   }
 */
export async function registerOrgScope(server: FastifyInstance): Promise<void> {
  server.addHook('preHandler', attachOrgScopeHook(server.prisma));
}

/**
 * Resolve the tenant and refuse the request without one. index.ts registers this on the
 * authenticated route block, so every route behind `authenticateJWT` runs inside a tenant whether
 * or not its own plugin remembered to ask (#303). Registering it here rather than per plugin is the
 * point: a hook registered on a parent runs before the child plugin's own preHandlers, and the
 * child's `registerOrgScope` is then a no-op because the hook is idempotent.
 */
export async function registerStrictOrgScope(server: FastifyInstance): Promise<void> {
  server.addHook('preHandler', attachOrgScopeHook(server.prisma));
  server.addHook('preHandler', requireOrgScope);
}

/**
 * Customer-portal variant. Auth in the customer portal uses
 * `req.customerUser` (decoded from the customer-portal JWT), which carries
 * a `customerId`. We resolve `req.orgId` by walking through
 * `Customer.orgId` — every Customer row is NOT NULL post phase 2.
 *
 * Behaviour matches `attachOrgScopeHook`:
 *  - idempotent (skips if `req.orgId` already set)
 *  - leaves `req.orgId = null` on missing customerUser, missing Customer
 *    row, or DB error, so `requireOrgScope` can block downstream
 *  - the customer-portal authentication preHandler MUST run first so
 *    `req.customerUser` is populated by the time this hook fires
 *
 * IMPORTANT — do NOT register this with `server.addHook('preHandler', ...)`.
 * Fastify runs instance-level preHandler hooks BEFORE route-level ones, so
 * it would fire while `req.customerUser` is still undefined, set `req.orgId`
 * to null, and — being idempotent — never re-resolve it. Chain it after the
 * authenticator in the route's own preHandler array instead:
 *
 *   const authedCustomer = [
 *     authenticateCustomerJWT,
 *     attachOrgScopeFromCustomerUserHook(server.prisma),
 *   ];
 *   server.get('/api/v1/customer-portal/…', { preHandler: authedCustomer }, …)
 */
export function attachOrgScopeFromCustomerUserHook(prisma: PrismaClient): preHandlerHookHandler {
  return async (req: FastifyRequest, _reply: FastifyReply): Promise<void> => {
    if (req.orgId !== undefined) return;
    const customerId = req.customerUser?.customerId;
    if (!customerId) {
      req.orgId = null;
      return;
    }
    try {
      const customer = await prisma.customer.findUnique({
        where: { id: customerId },
        select: { orgId: true },
      });
      req.orgId = customer?.orgId ?? null;
    } catch {
      req.orgId = null;
    }
  };
}

/**
 * Carrier-portal variant. Auth in the carrier portal uses
 * `req.carrierUser`, which carries a `carrierId`. Resolves `req.orgId`
 * via `Carrier.orgId` — NOT NULL post phase 2.
 *
 * Same ordering constraint as the customer variant above: chain it after
 * `authenticateCarrierJWT` in the route's preHandler array, never via
 * `server.addHook('preHandler', ...)`.
 */
export function attachOrgScopeFromCarrierUserHook(prisma: PrismaClient): preHandlerHookHandler {
  return async (req: FastifyRequest, _reply: FastifyReply): Promise<void> => {
    if (req.orgId !== undefined) return;
    const carrierId = req.carrierUser?.carrierId;
    if (!carrierId) {
      req.orgId = null;
      return;
    }
    try {
      const carrier = await prisma.carrier.findUnique({
        where: { id: carrierId },
        select: { orgId: true },
      });
      req.orgId = carrier?.orgId ?? null;
    } catch {
      req.orgId = null;
    }
  };
}

/**
 * EDI / trading-partner variant. EDI inbound endpoints serve two callers:
 *  1. Authed admins (UI, internal scripts) — JWT carries organizationId.
 *  2. Webhook ingest from carriers / 3PLs / SFTP collectors — no JWT.
 *
 * Resolution order:
 *  1. JWT (`req.user.organizationId`) — admin always wins.
 *  2. Body `partnerId` — webhook payload references a known TradingPartner;
 *     walk through `partner.customer.orgId` (preferred) or
 *     `partner.carrier.orgId` to derive tenant.
 *  3. URL params (`:id` or `:partnerId`) — endpoints like
 *     `/api/v1/trading-partners/:id/logs` carry the partner in the path.
 *  4. Otherwise null — webhook payloads with no partnerId can't be
 *     attributed; the route can decide whether to refuse or accept.
 *
 * The body-derived path is identical to the backfill logic in
 * [TradingPartnerRepository.createLog]; centralising it here means EDI
 * route handlers don't need to re-derive orgId for every command they
 * dispatch.
 */
export function attachOrgScopeFromPartnerHook(prisma: PrismaClient): preHandlerHookHandler {
  return async (req: FastifyRequest, _reply: FastifyReply): Promise<void> => {
    if (req.orgId !== undefined) return;

    // 1. JWT always wins
    const fromJwt = req.user?.organizationId;
    if (fromJwt) {
      req.orgId = fromJwt;
      return;
    }

    // 2/3. Try partnerId from body, then URL params.
    const body = req.body as Record<string, unknown> | null | undefined;
    const params = req.params as Record<string, unknown> | null | undefined;
    const candidate =
      (typeof body?.partnerId === 'string' ? body.partnerId : undefined) ??
      (typeof params?.partnerId === 'string' ? params.partnerId : undefined) ??
      (typeof params?.id === 'string' ? params.id : undefined);

    // No JWT and no partner candidate: leave req.orgId undefined so a
    // downstream `attachOrgScopeHook` (chained as a fallback) can run
    // the sole-Organization lookup. Setting null here would block it,
    // because the standard hook's idempotence check skips when orgId is
    // already defined.
    if (!candidate) return;

    try {
      const partner = await prisma.tradingPartner.findUnique({
        where: { id: candidate },
        select: {
          customer: { select: { orgId: true } },
          carrier: { select: { orgId: true } },
        },
      });
      const derived = partner?.customer?.orgId ?? partner?.carrier?.orgId;
      // Same logic: if the partner exists but has no relation chain back
      // to an org, leave req.orgId undefined for the fallback hook
      // rather than locking it to null.
      if (derived) req.orgId = derived;
    } catch {
      // Defensive: on DB error, do not block the fallback hook.
    }
  };
}

/**
 * Convenience for EDI route plugins. Chains the partner-aware hook with
 * the standard sole-Organization fallback so:
 *  - admin reads use the JWT
 *  - webhook ingest derives orgId from `body.partnerId` / URL params
 *  - everything else (create-partner, unauthed seed flows) lands on the
 *    sole Organization when there is exactly one, and null otherwise
 *
 * Use at the top of an EDI route plugin:
 *
 *   export async function ediInboundRoutes(server: FastifyInstance) {
 *     await registerOrgScopeForEdi(server);
 *     // …
 *   }
 */
export async function registerOrgScopeForEdi(server: FastifyInstance): Promise<void> {
  server.addHook('preHandler', attachOrgScopeFromPartnerHook(server.prisma));
  server.addHook('preHandler', attachOrgScopeHook(server.prisma));
}
