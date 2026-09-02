/**
 * FinnTMS routes: shipments, orders, carriers, lanes, tendering, EDI, tracking, cold chain.
 *
 * Module: tms. Registered by index.ts, which owns the server lifecycle and the JWT scope.
 * See .claude/rules/module-boundaries.md for what this module may depend on.
 */

import type { FastifyInstance } from 'fastify';
import { publicShipmentShareRoutes } from '../publicShipmentShare.js';
import { authRoutes } from '../auth.js';
import { carrierPortalRoutes } from '../carrierPortal.js';
import { customerPortalRoutes } from '../customerPortal.js';
import { customerDeveloperRoutes } from '../customerDeveloper.js';
import { customerApiRoutes } from '../customerApi.js';
import { orderLineItemRulesRoutes } from '../orderLineItemRules.js';
import { ediInboundRoutes } from '../ediInbound.js';
import { ediTenderRoutes } from '../ediTender.js';
import { edi214Routes } from '../edi214.js';
import { edi210Routes } from '../edi210.js';
import { edi820Routes } from '../edi820.js';
import { edi997Routes } from '../edi997.js';
import { ediImportRoutes } from '../ediImport.js';
import { carrierTrackingRoutes } from '../carrierTracking.js';
import { carrierRoutes } from '../carriers.js';
import { shipmentRoutes } from '../shipments.js';
import { shipmentShareLinkRoutes } from '../shipmentShareLinks.js';
import { shipmentTypeRoutes } from '../shipmentTypes.js';
import { laneRoutes } from '../lanes.js';
import { laneRouteRoutes } from '../laneRoutes.js';
import { orderRoutes } from '../orders.js';
import { pendingLaneRequestRoutes } from '../pendingLaneRequests.js';
import { distanceRoutes } from '../distance.js';
import { documentRoutes } from '../documents.js';
import { dailyReportRoutes } from '../dailyReport.js';
import { eventRoutes } from '../events.js';
import { mapsSettingsRoutes } from '../mapsSettings.js';
import { arrivalCriteriaRoutes } from '../arrivalCriteria.js';
import { tenderRoutes } from '../tenders.js';
import { carrierUserRoutes } from '../carrierUsers.js';
import { tradingPartnerRoutes } from '../tradingPartners.js';
import deviceRoutes from '../devices.js';
import telemetryRoutes from '../telemetry.js';
import { cargoTrackingRoutes } from '../cargoTracking.js';
import { coldChainRoutes } from '../coldChain.js';
import { etaMonitorRoutes } from '../etaMonitor.js';
import { slaRoutes } from '../sla.js';
import { slaReportRoutes } from '../slaReports.js';
import { mapRoutes } from '../map.js';
import { manifestIngestionRoutes } from '../manifestIngestion.js';
import { rmaRoutes } from '../rma.js';
import { cutoffMonitorRoutes } from '../cutoffMonitor.js';
import { packagingTypesRoutes } from '../packagingTypes.js';
import { containerIntelligenceRoutes } from '../containerIntelligence.js';
import { edi940Routes } from '../edi940.js';
import { customerRmaApiRoutes } from '../customerRmaApi.js';
import { edi180Routes } from '../edi180.js';
import { agentDecisionRoutes } from '../agentDecisions.js';
import { llmSettingsRoutes } from '../llmSettings.js';
import { iotVendorRoutes } from '../iotVendors.js';
import { agentConfigRoutes } from '../agentConfig.js';
import { automationRuleRoutes } from '../automationRules.js';
import { skillRoutes } from '../skills.js';
import { quoteRoutes } from '../quotes.js';
import { brokerReportRoutes } from '../brokerReports.js';
import { reportsDashboardRoutes } from '../reportsDashboard.js';

/**
 * Registered at the root, outside the JWT scope. These routes are public or authenticate
 * themselves, so the global JWT hook must not apply to them.
 */
export async function registerTmsPublicRoutes(server: FastifyInstance): Promise<void> {
  await server.register(publicShipmentShareRoutes);  // Share links: own access code + viewer JWT, own rate limits
  await server.register(authRoutes);                 // Internal user login / forgot-password / me (own JWT auth internally)
  await server.register(carrierPortalRoutes);        // Own carrier JWT auth internally
  await server.register(customerPortalRoutes);       // Own customer JWT auth internally
  await server.register(customerDeveloperRoutes);    // Own customer JWT auth internally (Developer Area)
  await server.register(customerApiRoutes);          // Own API key auth internally
  await server.register(orderLineItemRulesRoutes);    // Dual auth (main TMS or customer JWT) internally
  // EDI inbound - currently rely on trading partner ID validation.
  // TODO: add proper API key / HMAC auth for EDI endpoints
  await server.register(ediInboundRoutes);
  await server.register(ediTenderRoutes);
  await server.register(edi214Routes);
  await server.register(edi210Routes);
  await server.register(edi820Routes);
  await server.register(edi997Routes);
  await server.register(ediImportRoutes);
  // Carrier tracking has a webhook endpoint that must be publicly reachable.
  // TODO: split webhook into its own route file and add JWT auth to admin endpoints
  await server.register(carrierTrackingRoutes);
}

/** Registered inside the JWT scope: an internal user token is required. */
export async function registerTmsAuthenticatedRoutes(app: FastifyInstance): Promise<void> {
  await app.register(carrierRoutes);
  await app.register(shipmentRoutes);
  await app.register(shipmentShareLinkRoutes);
  await app.register(shipmentTypeRoutes);
  await app.register(laneRoutes);
  await app.register(laneRouteRoutes);
  await app.register(orderRoutes);
  await app.register(pendingLaneRequestRoutes);
  await app.register(distanceRoutes);
  await app.register(documentRoutes);
  await app.register(dailyReportRoutes);
  await app.register(eventRoutes);
  await app.register(mapsSettingsRoutes);
  await app.register(arrivalCriteriaRoutes);
  await app.register(tenderRoutes);
  await app.register(carrierUserRoutes);
  await app.register(tradingPartnerRoutes);
  await app.register(deviceRoutes);
  await app.register(telemetryRoutes);
  await app.register(cargoTrackingRoutes);
  await app.register(coldChainRoutes);
  await app.register(etaMonitorRoutes);
  await app.register(slaRoutes);
  await app.register(slaReportRoutes);
  await app.register(mapRoutes);
  await app.register(manifestIngestionRoutes);
  await app.register(rmaRoutes);
  await app.register(cutoffMonitorRoutes);
  await app.register(packagingTypesRoutes);
  await app.register(containerIntelligenceRoutes);
  await app.register(edi940Routes);
  await app.register(customerRmaApiRoutes);
  await app.register(edi180Routes);
  await app.register(agentDecisionRoutes);
  await app.register(llmSettingsRoutes);
  await app.register(iotVendorRoutes);
  await app.register(agentConfigRoutes);
  await app.register(automationRuleRoutes);
  await app.register(skillRoutes);
  await app.register(quoteRoutes);
  await app.register(brokerReportRoutes);
  await app.register(reportsDashboardRoutes);
}
