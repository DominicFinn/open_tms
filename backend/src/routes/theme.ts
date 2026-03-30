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

export async function themeRoutes(server: FastifyInstance) {
  const prisma = container.resolve<PrismaClient>(TOKENS.PrismaClient);
  const storageProvider = container.resolve<IBinaryStorageProvider>(TOKENS.IBinaryStorageProvider);

  // GET /api/v1/theme — public, returns theme config + themeUpdatedAt for cache check
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
    const org = await prisma.organization.findFirst();
    if (!org) {
      return { data: { themeConfig: null, themeUpdatedAt: null, hasLogo: false }, error: null };
    }
    return {
      data: {
        themeConfig: org.themeConfig,
        themeUpdatedAt: org.themeUpdatedAt,
        hasLogo: !!org.logoStorageKey,
      },
      error: null,
    };
  });

  // PUT /api/v1/theme — save theme config
  server.put('/api/v1/theme', {
    schema: {
      description: 'Update the theme configuration. Accepts CSS custom property overrides. Only allowed theme variable names are accepted.',
      tags: ['Theme'],
      body: {
        type: 'object',
        required: ['themeConfig'],
        properties: {
          themeConfig: {
            type: 'object',
            description: 'CSS variable overrides, e.g. { "primary": "#1976D2", "secondary": "#FF9800" }',
          },
        },
      },
      response: {
        200: { type: 'object', properties: { data: { type: 'object' }, error: { type: 'object', nullable: true } } },
        400: errorResponse,
      },
    },
  }, async (req, reply) => {
    const { themeConfig } = req.body as { themeConfig: Record<string, string> };

    // Validate keys and values
    const sanitized: Record<string, string> = {};
    for (const [key, value] of Object.entries(themeConfig)) {
      if (!ALLOWED_THEME_KEYS.includes(key)) {
        reply.code(400);
        return { data: null, error: `Invalid theme key: "${key}". Allowed keys: ${ALLOWED_THEME_KEYS.join(', ')}` };
      }
      if (typeof value !== 'string' || !isValidCSSValue(value)) {
        reply.code(400);
        return { data: null, error: `Invalid value for "${key}": must be a valid CSS color (hex, rgb, rgba)` };
      }
      sanitized[key] = value;
    }

    const org = await prisma.organization.findFirst();
    if (!org) {
      reply.code(404);
      return { data: null, error: 'Organization not found' };
    }

    const updated = await prisma.organization.update({
      where: { id: org.id },
      data: {
        themeConfig: Object.keys(sanitized).length > 0 ? sanitized : Prisma.JsonNull,
        themeUpdatedAt: new Date(),
      },
    });

    return { data: { themeConfig: updated.themeConfig, themeUpdatedAt: updated.themeUpdatedAt }, error: null };
  });

  // DELETE /api/v1/theme — reset to defaults
  server.delete('/api/v1/theme', {
    schema: {
      description: 'Reset theme to defaults (removes all custom overrides).',
      tags: ['Theme'],
      response: {
        200: { type: 'object', properties: { data: { type: 'object', properties: { message: { type: 'string' } } }, error: { type: 'object', nullable: true } } },
      },
    },
  }, async () => {
    const org = await prisma.organization.findFirst();
    if (org) {
      await prisma.organization.update({
        where: { id: org.id },
        data: { themeConfig: Prisma.JsonNull, themeUpdatedAt: new Date() },
      });
    }
    return { data: { message: 'Theme reset to defaults' }, error: null };
  });

  // GET /api/v1/theme/logo — public, returns logo binary
  server.get('/api/v1/theme/logo', {
    schema: {
      description: 'Download the organization logo. Returns the image file with appropriate Content-Type. Unauthenticated.',
      tags: ['Theme'],
      response: { 404: errorResponse },
    },
  }, async (req, reply) => {
    const org = await prisma.organization.findFirst();
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
  server.post('/api/v1/theme/logo', {
    schema: {
      description: 'Upload an organization logo. Accepts PNG, JPEG, SVG, or WebP. Max 2 MB. The logo is displayed in the nav bar and on generated documents.',
      tags: ['Theme'],
      consumes: ['multipart/form-data'],
      response: {
        200: { type: 'object', properties: { data: { type: 'object', properties: { message: { type: 'string' } } }, error: { type: 'object', nullable: true } } },
        400: errorResponse,
      },
    },
  }, async (req, reply) => {
    const data = await req.file();
    if (!data) {
      reply.code(400);
      return { data: null, error: 'No file uploaded. Send multipart form with field "file".' };
    }

    if (!ALLOWED_LOGO_TYPES.includes(data.mimetype)) {
      reply.code(400);
      return { data: null, error: `Invalid file type: ${data.mimetype}. Allowed: ${ALLOWED_LOGO_TYPES.join(', ')}` };
    }

    const fileBuffer = await data.toBuffer();
    if (fileBuffer.length > MAX_LOGO_SIZE) {
      reply.code(400);
      return { data: null, error: `Logo too large. Maximum size is ${MAX_LOGO_SIZE / 1024 / 1024} MB.` };
    }

    const org = await prisma.organization.findFirst();
    if (!org) {
      reply.code(404);
      return { data: null, error: 'Organization not found' };
    }

    // Delete old logo if exists
    if (org.logoStorageKey) {
      try { await storageProvider.delete(org.logoStorageKey); } catch { /* best effort */ }
    }

    const storageKey = `files/${randomUUID()}`;
    await storageProvider.store(storageKey, fileBuffer, { 'content-type': data.mimetype });

    await prisma.organization.update({
      where: { id: org.id },
      data: {
        logoStorageKey: storageKey,
        logoMimeType: data.mimetype,
        themeUpdatedAt: new Date(), // Invalidate frontend cache
      },
    });

    return { data: { message: 'Logo uploaded successfully' }, error: null };
  });

  // DELETE /api/v1/theme/logo — remove logo
  server.delete('/api/v1/theme/logo', {
    schema: {
      description: 'Remove the organization logo.',
      tags: ['Theme'],
      response: {
        200: { type: 'object', properties: { data: { type: 'object', properties: { message: { type: 'string' } } }, error: { type: 'object', nullable: true } } },
      },
    },
  }, async () => {
    const org = await prisma.organization.findFirst();
    if (org?.logoStorageKey) {
      try { await storageProvider.delete(org.logoStorageKey); } catch { /* best effort */ }
      await prisma.organization.update({
        where: { id: org.id },
        data: { logoStorageKey: null, logoMimeType: null, themeUpdatedAt: new Date() },
      });
    }
    return { data: { message: 'Logo removed' }, error: null };
  });
}
