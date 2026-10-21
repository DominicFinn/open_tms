/**
 * FinnWMS routes: warehouse topology, receiving, putaway, waves, picking, packing, loading.
 *
 * Module: wms. Registered by index.ts, which owns the server lifecycle and the JWT scope.
 * See .claude/rules/module-boundaries.md for what this module may depend on.
 */

import type { FastifyInstance } from 'fastify';
import { facilityRoutes } from '../facilities.js';
import { manifestIngestionRoutes } from '../manifestIngestion.js';
import { warehouseZoneRoutes } from '../warehouseZones.js';
import { receivingRoutes } from '../receiving.js';
import { putawayRoutes } from '../putaway.js';
import { waveRoutes } from '../waves.js';
import { packingRoutes } from '../packing.js';
import { wmsDashboardRoutes } from '../wmsDashboard.js';
import { cycleCountRoutes } from '../cycleCounts.js';
import { replenishmentRoutes } from '../replenishment.js';
import { waveTemplateRoutes } from '../waveTemplates.js';
import { cartonCatalogueRoutes } from '../cartonCatalogue.js';
import { cartonizationRoutes } from '../cartonization.js';
import { loadPlanRoutes } from '../loadPlans.js';
import { packAuditRoutes } from '../packAudit.js';
import { warehouseOperationsDashboardRoutes } from '../warehouseOperationsDashboard.js';

/** Registered inside the JWT scope: an internal user token is required. */
export async function registerWmsAuthenticatedRoutes(app: FastifyInstance): Promise<void> {
  await app.register(facilityRoutes);
  // Supplier ASN manifests into receiving: a warehouse intake (#359)
  await app.register(manifestIngestionRoutes);
  await app.register(warehouseZoneRoutes);
  await app.register(receivingRoutes);
  await app.register(putawayRoutes);
  await app.register(waveRoutes);
  await app.register(packingRoutes);
  await app.register(wmsDashboardRoutes);
  await app.register(cycleCountRoutes);
  await app.register(replenishmentRoutes);
  await app.register(waveTemplateRoutes);
  await app.register(cartonCatalogueRoutes);
  await app.register(cartonizationRoutes);
  await app.register(loadPlanRoutes);
  await app.register(packAuditRoutes);
  await app.register(warehouseOperationsDashboardRoutes);
}
