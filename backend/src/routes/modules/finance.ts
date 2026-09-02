/**
 * Finance routes: charges, invoices, payments, commissions, financial reporting.
 *
 * Module: finance. Registered by index.ts, which owns the server lifecycle and the JWT scope.
 * See .claude/rules/module-boundaries.md for what this module may depend on.
 */

import type { FastifyInstance } from 'fastify';
import { chargeRoutes } from '../charges.js';
import { invoiceRoutes } from '../invoices.js';
import { carrierInvoiceRoutes } from '../carrierInvoices.js';
import { financialQueryRoutes } from '../financialQueries.js';
import { financialReportRoutes } from '../financialReports.js';
import { commissionRoutes } from '../commissions.js';

/**
 * Registered at the root, outside the JWT scope. These routes are public or authenticate
 * themselves, so the global JWT hook must not apply to them.
 */
export async function registerFinancePublicRoutes(_server: FastifyInstance): Promise<void> {
  // No public routes in this module.
}

/** Registered inside the JWT scope: an internal user token is required. */
export async function registerFinanceAuthenticatedRoutes(app: FastifyInstance): Promise<void> {
  await app.register(chargeRoutes);
  await app.register(invoiceRoutes);
  await app.register(carrierInvoiceRoutes);
  await app.register(financialQueryRoutes);
  await app.register(financialReportRoutes);
  await app.register(commissionRoutes);
}
