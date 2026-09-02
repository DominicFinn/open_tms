/**
 * Core routes: tenancy, identity, documents, notifications, and the issue and triage centre.
 *
 * Module: core. Registered by index.ts, which owns the server lifecycle and the JWT scope.
 * See .claude/rules/module-boundaries.md for what this module may depend on.
 */

import type { FastifyInstance } from 'fastify';
import { themeRoutes } from '../theme.js';
import { internalUserRoutes } from '../internalUsers.js';
import { webhookRoutes } from '../webhook.js';
import { seedRoutes } from '../seed.js';
import { customerRoutes } from '../customers.js';
import { locationRoutes } from '../locations.js';
import { globalSearchRoutes } from '../globalSearch.js';
import { organizationRoutes } from '../organization.js';
import { apiKeyRoutes } from '../apiKeys.js';
import { webhookLogRoutes } from '../webhookLogs.js';
import { queueMonitoringRoutes } from '../queueMonitoring.js';
import { locationReportRoutes } from '../locationReports.js';
import { attachmentRoutes } from '../attachments.js';
import { customFieldRoutes } from '../customFields.js';
import { notificationRoutes } from '../notifications.js';
import { emailSettingsRoutes } from '../emailSettings.js';
import { emailTemplateRoutes } from '../emailTemplates.js';
import { metricsRoutes } from '../metrics.js';
import { locationOpsRoutes } from '../locationOps.js';
import { issueRoutes } from '../issues.js';
import { triageRoutes } from '../triage.js';
import { commentRoutes } from '../comments.js';
import { roleRoutes } from '../roles.js';
import { customerUserRoutes } from '../customerUsers.js';

/**
 * Registered at the root, outside the JWT scope. These routes are public or authenticate
 * themselves, so the global JWT hook must not apply to them.
 */
export async function registerCorePublicRoutes(server: FastifyInstance): Promise<void> {
  await server.register(themeRoutes);                // GET endpoints intentionally public (loaded before login)
  await server.register(internalUserRoutes);         // Internal user admin (own JWT auth + permission check internally)
  await server.register(webhookRoutes);              // Own API key auth internally
  await server.register(seedRoutes);                 // Dev/demo only (guarded by NODE_ENV)
}

/** Registered inside the JWT scope: an internal user token is required. */
export async function registerCoreAuthenticatedRoutes(app: FastifyInstance): Promise<void> {
  await app.register(customerRoutes);
  await app.register(locationRoutes);
  await app.register(globalSearchRoutes);
  await app.register(organizationRoutes);
  await app.register(apiKeyRoutes);
  await app.register(webhookLogRoutes);
  await app.register(queueMonitoringRoutes);
  await app.register(locationReportRoutes);
  await app.register(attachmentRoutes);
  await app.register(customFieldRoutes);
  await app.register(notificationRoutes);
  await app.register(emailSettingsRoutes);
  await app.register(emailTemplateRoutes);
  await app.register(metricsRoutes);
  await app.register(locationOpsRoutes);
  await app.register(issueRoutes);
  await app.register(triageRoutes);
  await app.register(commentRoutes);
  await app.register(roleRoutes);
  await app.register(customerUserRoutes);
}
