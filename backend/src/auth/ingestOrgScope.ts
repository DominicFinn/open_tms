/**
 * Multi-tenancy for machine-to-machine ingest (#303).
 *
 * Ingest endpoints carry no user JWT, so the tenant comes from the credential that authenticated
 * the request: an API key belongs to one Organization, and an IoT vendor signing secret is
 * configured per Organization. The tenant is never taken from the payload, and never guessed from
 * the first Organization row.
 *
 * Both hooks follow `attachOrgScopeHook`: idempotent, and they leave `req.orgId = null` when the
 * credential is missing or unknown so the route can refuse the request.
 */

import { createHmac, timingSafeEqual } from 'crypto';
import type { FastifyReply, FastifyRequest, preHandlerHookHandler } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import { hashApiKey } from '../middleware/apiKeyAuth.js';
import { resolveSoleOrganizationId } from './orgScope.js';

export const LOCO_SIGNATURE_HEADER = 'x-locoaware-signature';

function readApiKeyHeader(req: FastifyRequest): string | undefined {
  const header = req.headers['x-api-key'];
  if (typeof header === 'string' && header) return header;
  const authorization = req.headers.authorization;
  return authorization?.startsWith('Bearer ') ? authorization.slice('Bearer '.length) : undefined;
}

/** The org of the active API key presented on the request, or null. */
export async function resolveApiKeyOrgId(req: FastifyRequest, prisma: PrismaClient): Promise<string | null> {
  const key = readApiKeyHeader(req);
  if (!key) return null;
  // tenancy-exempt: the API key hash is the credential that establishes the tenant.
  const apiKey = await prisma.apiKey.findUnique({
    where: { keyHash: hashApiKey(key) },
    select: { orgId: true, active: true },
  });
  return apiKey?.active ? apiKey.orgId : null;
}

/**
 * Scope a customer API or device feed request to the org that owns its API key.
 * Register with `server.addHook('preHandler', ...)`: the key is read from headers, so nothing
 * needs to run first.
 */
export function attachOrgScopeFromApiKeyHook(prisma: PrismaClient): preHandlerHookHandler {
  return async (req: FastifyRequest, _reply: FastifyReply): Promise<void> => {
    if (req.orgId !== undefined) return;
    try {
      req.orgId = await resolveApiKeyOrgId(req, prisma);
    } catch {
      req.orgId = null;
    }
  };
}

function signatureMatches(rawBody: Buffer, signature: string, secret: string): boolean {
  const expected = createHmac('sha256', secret).update(rawBody).digest();
  const received = Buffer.from(signature, 'base64');
  return received.length === expected.length && timingSafeEqual(received, expected);
}

/**
 * The org whose System Loco signing secret verifies this body, or null.
 *
 * BUSINESS RULE: each Organization configures its own System Loco secret, so the secret that
 * verifies the signature identifies the tenant. The LOCOAWARE_WEBHOOK_SECRET environment
 * fallback belongs to no Organization, so it only attributes a request when exactly one
 * Organization exists (same rule as #239). With several, an env-signed webhook is refused.
 */
export async function resolveSystemLocoOrgId(
  prisma: PrismaClient,
  rawBody: Buffer,
  signature: string,
): Promise<string | null> {
  // tenancy-exempt: each org's System Loco signing secret is the credential, so every configured secret is tried and the one that verifies the body identifies the tenant.
  const vendors = await prisma.iotVendor.findMany({
    where: { vendorKey: 'system_loco', webhookSecret: { not: null } },
    select: { orgId: true, webhookSecret: true },
  });
  const match = vendors.find((vendor) => signatureMatches(rawBody, signature, vendor.webhookSecret!));
  if (match) return match.orgId;

  const envSecret = process.env.LOCOAWARE_WEBHOOK_SECRET;
  if (!envSecret || !signatureMatches(rawBody, signature, envSecret)) return null;
  return resolveSoleOrganizationId(prisma);
}

/**
 * Scope the IoT device webhook. A signed request is attributed by its signing secret; an unsigned
 * one by its API key. The plugin must capture `req.rawBody` in its content type parser, which runs
 * before preHandler hooks.
 */
export function attachOrgScopeFromIotWebhookHook(prisma: PrismaClient): preHandlerHookHandler {
  return async (req: FastifyRequest, _reply: FastifyReply): Promise<void> => {
    if (req.orgId !== undefined) return;
    try {
      const signature = req.headers[LOCO_SIGNATURE_HEADER];
      if (typeof signature !== 'string') {
        req.orgId = await resolveApiKeyOrgId(req, prisma);
        return;
      }
      const rawBody = (req as FastifyRequest & { rawBody?: Buffer }).rawBody;
      req.orgId = rawBody ? await resolveSystemLocoOrgId(prisma, rawBody, signature) : null;
    } catch {
      req.orgId = null;
    }
  };
}
