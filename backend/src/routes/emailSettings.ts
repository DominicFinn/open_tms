/**
 * Email Settings Routes — manage org email configuration from Admin.
 *
 * GET  /api/v1/email/settings     — get current email config
 * PUT  /api/v1/email/settings     — update email config
 * POST /api/v1/email/test         — send test email
 */

import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { container } from '../di/container.js';
import { TOKENS } from '../di/tokens.js';
import { IEmailService } from '../services/IEmailService.js';

export async function emailSettingsRoutes(server: FastifyInstance) {
  // Get email settings
  server.get('/api/v1/email/settings', {
    schema: {
      tags: ['Email'],
      summary: 'Get organization email configuration',
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
  }, async (_req, _reply) => {
    const org = await server.prisma.organization.findFirst({
      select: {
        emailProvider: true,
        smtpHost: true,
        smtpPort: true,
        smtpSecure: true,
        smtpUser: true,
        // Never return the password — return a masked indicator instead
        smtpPassword: true,
        emailFromAddress: true,
        emailFromName: true,
        emailEnabled: true,
      },
    });

    if (!org) {
      return { data: null, error: 'Organization not found' };
    }

    return {
      data: {
        ...org,
        smtpPassword: org.smtpPassword ? '••••••••' : null,
      },
      error: null,
    };
  });

  // Update email settings
  server.put('/api/v1/email/settings', {
    schema: {
      tags: ['Email'],
      summary: 'Update organization email configuration',
    },
  }, async (req, reply) => {
    const schema = z.object({
      emailProvider: z.enum(['console', 'smtp']).optional(),
      smtpHost: z.string().optional(),
      smtpPort: z.number().int().min(1).max(65535).optional(),
      smtpSecure: z.boolean().optional(),
      smtpUser: z.string().optional(),
      smtpPassword: z.string().optional(), // Only update if provided (not the masked value)
      emailFromAddress: z.string().email().optional(),
      emailFromName: z.string().optional(),
      emailEnabled: z.boolean().optional(),
    });

    const body = schema.parse((req as any).body);

    const org = await server.prisma.organization.findFirst();
    if (!org) {
      reply.code(404);
      return { data: null, error: 'Organization not found' };
    }

    // Don't overwrite password with the masked value
    const updateData: any = { ...body };
    if (updateData.smtpPassword === '••••••••') {
      delete updateData.smtpPassword;
    }

    const updated = await server.prisma.organization.update({
      where: { id: org.id },
      data: updateData,
      select: {
        emailProvider: true,
        smtpHost: true,
        smtpPort: true,
        smtpSecure: true,
        smtpUser: true,
        emailFromAddress: true,
        emailFromName: true,
        emailEnabled: true,
      },
    });

    return { data: updated, error: null };
  });

  // Send test email
  server.post('/api/v1/email/test', {
    schema: {
      tags: ['Email'],
      summary: 'Send a test email to verify configuration',
    },
  }, async (req, reply) => {
    const schema = z.object({
      to: z.string().email(),
    });

    const { to } = schema.parse((req as any).body);

    const org = await server.prisma.organization.findFirst({
      select: {
        name: true,
        emailFromAddress: true,
        emailFromName: true,
        emailEnabled: true,
      },
    });

    if (!org) {
      reply.code(404);
      return { data: null, error: 'Organization not found' };
    }

    try {
      const emailService = container.resolve<IEmailService>(TOKENS.IEmailService);
      const fromAddress = org.emailFromAddress || 'noreply@opentms.local';
      const result = await emailService.send({
        to,
        subject: `Test Email from ${org.name}`,
        html: `
          <h2>Email Configuration Test</h2>
          <p>This is a test email from <strong>${org.name}</strong>.</p>
          <p>If you received this, your email configuration is working correctly.</p>
          <p style="color:#757575;font-size:12px;">Sent via ${org.name || 'Open TMS'}</p>
        `,
        text: `Email Configuration Test\n\nThis is a test email from ${org.name}.\nIf you received this, your email configuration is working correctly.`,
        from: org.emailFromName
          ? `"${org.emailFromName}" <${fromAddress}>`
          : fromAddress,
      });

      if (result.success) {
        return { data: { sent: true, messageId: result.messageId }, error: null };
      } else {
        reply.code(500);
        return { data: null, error: `Failed to send: ${result.error}` };
      }
    } catch (err) {
      reply.code(500);
      return { data: null, error: `Email service error: ${(err as Error).message}` };
    }
  });
}
