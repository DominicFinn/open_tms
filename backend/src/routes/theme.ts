import { FastifyInstance } from 'fastify';
import { randomUUID } from 'crypto';
import { PrismaClient, Prisma } from '@prisma/client';
import { container } from '../di/container.js';
import { TOKENS } from '../di/tokens.js';
import { IBinaryStorageProvider } from '../storage/IBinaryStorageProvider.js';

/**
 * Theme & branding API — serves theme config and logo for the frontend.
 * The GET endpoints are intentionally unauthenticated so the frontend
 * can load theme/logo before auth completes.
 */

// Allowed CSS variable keys that can be overridden by theme config.
// Prevents arbitrary CSS injection.
const ALLOWED_THEME_KEYS = [
  'primary', 'on-primary', 'primary-container', 'on-primary-container',
  'secondary', 'on-secondary', 'secondary-container', 'on-secondary-container',
  'tertiary', 'on-tertiary', 'tertiary-container', 'on-tertiary-container',
  'error', 'on-error', 'error-container', 'on-error-container',
  'success', 'on-success', 'success-container', 'on-success-container',
  'warning', 'on-warning', 'warning-container', 'on-warning-container',
  'info', 'on-info', 'info-container', 'on-info-container',
  'outline', 'background', 'on-background',
  'surface', 'on-surface', 'surface-variant', 'on-surface-variant',
  'surface-container-lowest', 'surface-container-low', 'surface-container',
  'surface-container-high', 'surface-container-highest',
  'outline-variant', 'neutral-variant',
];

// Validate hex color or simple CSS value
function isValidCSSValue(value: string): boolean {
  return /^#[0-9A-Fa-f]{3,8}$/.test(value) ||
    /^rgb\(\d{1,3},\s*\d{1,3},\s*\d{1,3}\)$/.test(value) ||
    /^rgba\(\d{1,3},\s*\d{1,3},\s*\d{1,3},\s*[\d.]+\)$/.test(value);
}

const ALLOWED_LOGO_TYPES = ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp'];
const MAX_LOGO_SIZE = 2 * 1024 * 1024; // 2 MB

const errorResponse = {
  type: 'object',
  properties: {
    data: { type: 'object', nullable: true },
    error: { type: 'string' },
  },
} as const;

/**
 * Theme & branding — the two endpoints a logged-out browser needs.
 *
 * These are deliberately unauthenticated: the frontend paints the operator's colours and logo
 * before anyone has signed in, so there is no token to read a tenant from.
 *
 * That leaves the tenancy question genuinely open. Organization carries no hostname, domain or
 * slug, so a request arriving here cannot be attributed to a tenant at all. Rather than take
 * whichever row comes back first and pretend that is an answer, `resolvePublicOrg` requires that
 * exactly one Organization exists and refuses to guess when there is more than one. A second
 * tenant therefore breaks branding loudly instead of silently serving one customer's logo to
 * another's users, and the fix at that point is to add a hostname to Organization and resolve on
 * the Host header.
 *
 * Everything that writes lives in themeAdminRoutes, inside the authenticated scope. It used to
 * live here, which meant nine endpoints were public when the comment claimed two were (#117).
 */

export async function themeRoutes(server: FastifyInstance) {
  const prisma = container.resolve<PrismaClient>(TOKENS.PrismaClient);
  const storageProvider = container.resolve<IBinaryStorageProvider>(TOKENS.IBinaryStorageProvider);

  /**
   * The tenant for an unauthenticated branding request.
   *
   * There is nothing on the request to resolve one from, and Organization has no hostname to
   * match against, so this is only answerable while a deployment has a single tenant. It
   * returns null rather than a guess once that stops being true.
   */
  async function resolvePublicOrg() {
    const orgs = await prisma.organization.findMany({ select: { id: true }, take: 2 });
    if (orgs.length !== 1) return null;
    return prisma.organization.findUnique({
      where: { id: orgs[0].id },
      // Only what the two public reads render. Nothing else about the organisation is exposed
      // to an unauthenticated caller.
      select: {
        name: true,
        themeConfig: true,
        themeUpdatedAt: true,
        logoStorageKey: true,
        logoMimeType: true,
      },
    });
  }

  server.get('/api/v1/theme', {
    schema: {
      description: 'Get the current theme configuration. Returns CSS custom property overrides and cache timestamp. Unauthenticated — called before login.',
      tags: ['Theme'],
      response: {
        200: {
          type: 'object',
          properties: {
            data: {
              type: 'object',
              properties: {
                themeConfig: { type: 'object', nullable: true, description: 'CSS custom property overrides (key: value pairs)' },
                themeUpdatedAt: { type: 'string', format: 'date-time', nullable: true, description: 'Cache invalidation timestamp' },
                hasLogo: { type: 'boolean' },
              },
            },
            error: { type: 'object', nullable: true },
          },
        },
      },
    },
  }, async () => {
    const org = await resolvePublicOrg();
    if (!org) {
      return { data: { themeConfig: null, themeUpdatedAt: null, hasLogo: false }, error: null };
    }
    return {
      data: {
        themeConfig: org.themeConfig,
        themeUpdatedAt: org.themeUpdatedAt,
        hasLogo: !!org.logoStorageKey,
        systemName: org.name || 'Open TMS',
      },
      error: null,
    };
  });

  // PUT /api/v1/theme — save theme config

  server.get('/api/v1/theme/logo', {
    schema: {
      description: 'Download the organization logo. Returns the image file with appropriate Content-Type. Unauthenticated.',
      tags: ['Theme'],
      response: { 404: errorResponse },
    },
  }, async (req, reply) => {
    const org = await resolvePublicOrg();
    if (!org?.logoStorageKey) {
      reply.code(404);
      return { data: null, error: 'No logo uploaded' };
    }

    const content = await storageProvider.retrieve(org.logoStorageKey);
    reply.header('Content-Type', org.logoMimeType || 'image/png');
    reply.header('Cache-Control', 'public, max-age=3600');
    return reply.send(content);
  });

  // POST /api/v1/theme/logo — upload logo (multipart)
}
