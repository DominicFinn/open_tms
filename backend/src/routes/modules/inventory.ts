/**
 * Inventory routes: stock records and unit of measure.
 *
 * Module: inventory. Registered by index.ts, which owns the server lifecycle and the JWT scope.
 * See .claude/rules/module-boundaries.md for what this module may depend on.
 */

import type { FastifyInstance } from 'fastify';
import { inventoryRoutes } from '../inventory.js';
import { productUomRoutes } from '../productUom.js';

/**
 * Registered at the root, outside the JWT scope. These routes are public or authenticate
 * themselves, so the global JWT hook must not apply to them.
 */
export async function registerInventoryPublicRoutes(_server: FastifyInstance): Promise<void> {
  // No public routes in this module.
}

/** Registered inside the JWT scope: an internal user token is required. */
export async function registerInventoryAuthenticatedRoutes(app: FastifyInstance): Promise<void> {
  await app.register(inventoryRoutes);
  await app.register(productUomRoutes);
}
