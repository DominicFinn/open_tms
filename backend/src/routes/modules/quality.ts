/**
 * Quality routes: the Quality Centre.
 *
 * Module: quality. Registered by index.ts, which owns the server lifecycle and the JWT scope.
 * See .claude/rules/module-boundaries.md for what this module may depend on.
 */

import type { FastifyInstance } from 'fastify';
import { qualityCentreRoutes } from '../qualityCentre.js';

/**
 * Registered at the root, outside the JWT scope. These routes are public or authenticate
 * themselves, so the global JWT hook must not apply to them.
 */
export async function registerQualityPublicRoutes(_server: FastifyInstance): Promise<void> {
  // No public routes in this module.
}

/** Registered inside the JWT scope: an internal user token is required. */
export async function registerQualityAuthenticatedRoutes(app: FastifyInstance): Promise<void> {
  await app.register(qualityCentreRoutes);
}
