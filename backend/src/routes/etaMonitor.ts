/**
 * ETA Monitor API routes.
 *
 * Provides endpoints for:
 * - Manually triggering an ETA check cycle
 * - Checking ETA for a single shipment
 * - Viewing monitor configuration and status
 */

import { FastifyPluginAsync } from 'fastify';
import { container } from '../di/container.js';
import { TOKENS } from '../di/tokens.js';
import { IShipmentEtaMonitorService } from '../services/routing/ShipmentEtaMonitorService.js';
import { IRoutingProvider } from '../services/routing/IRoutingProvider.js';

export const etaMonitorRoutes: FastifyPluginAsync = async (server) => {
  // GET /api/v1/eta-monitor/status — show monitor config and routing provider info
  server.get('/api/v1/eta-monitor/status', {
    schema: {
      tags: ['ETA Monitor'],
      summary: 'Get ETA monitor status and configuration',
      response: {
        200: {
          type: 'object',
          properties: {
            data: {
              type: 'object',
              properties: {
                enabled: { type: 'boolean' },
                provider: { type: 'string' },
                supportsTruckRouting: { type: 'boolean' },
                supportsTraffic: { type: 'boolean' },
                cronExpression: { type: 'string' },
                config: {
                  type: 'object',
                  properties: {
                    delayThresholdMinutes: { type: 'number' },
                    warningThresholdMinutes: { type: 'number' },
                    criticalThresholdMinutes: { type: 'number' },
                    routeDeviationMeters: { type: 'number' },
                    staleGpsThresholdMinutes: { type: 'number' },
                  },
                },
              },
            },
            error: { type: 'string', nullable: true },
          },
        },
      },
    },
  }, async () => {
    const routingProvider = process.env.ROUTING_PROVIDER || 'none';
    const enabled = routingProvider !== 'none';

    let provider: IRoutingProvider | null = null;
    if (enabled) {
      try {
        provider = container.resolve<IRoutingProvider>(TOKENS.IRoutingProvider);
      } catch {
        // Provider not resolvable
      }
    }

    return {
      data: {
        enabled,
        provider: provider?.name || routingProvider,
        supportsTruckRouting: provider?.supportsTruckRouting ?? false,
        supportsTraffic: provider?.supportsTraffic ?? false,
        cronExpression: process.env.ETA_MONITOR_CRON || '*/10 * * * *',
        config: {
          delayThresholdMinutes: Number(process.env.ETA_DELAY_THRESHOLD_MINUTES || 15),
          warningThresholdMinutes: Number(process.env.ETA_WARNING_THRESHOLD_MINUTES || 30),
          criticalThresholdMinutes: Number(process.env.ETA_CRITICAL_THRESHOLD_MINUTES || 60),
          routeDeviationMeters: Number(process.env.ETA_ROUTE_DEVIATION_METERS || 5000),
          staleGpsThresholdMinutes: Number(process.env.ETA_STALE_GPS_THRESHOLD_MINUTES || 60),
        },
      },
      error: null,
    };
  });

  // POST /api/v1/eta-monitor/run — manually trigger a full ETA check cycle
  server.post('/api/v1/eta-monitor/run', {
    schema: {
      tags: ['ETA Monitor'],
      summary: 'Manually trigger a full ETA monitoring cycle',
      description: 'Runs the ETA monitor immediately, checking all in-transit shipments. Returns a summary of results.',
      response: {
        200: {
          type: 'object',
          properties: {
            data: {
              type: 'object',
              properties: {
                runId: { type: 'string' },
                startedAt: { type: 'string' },
                completedAt: { type: 'string' },
                shipmentsChecked: { type: 'number' },
                shipmentsSkipped: { type: 'number' },
                delaysDetected: { type: 'number' },
                errorsEncountered: { type: 'number' },
                results: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      shipmentId: { type: 'string' },
                      shipmentReference: { type: 'string' },
                      status: { type: 'string' },
                      previousEta: { type: 'string', nullable: true },
                      newEta: { type: 'string', nullable: true },
                      delayMinutes: { type: 'number', nullable: true },
                      nextStopName: { type: 'string', nullable: true },
                      errorMessage: { type: 'string', nullable: true },
                    },
                  },
                },
              },
            },
            error: { type: 'string', nullable: true },
          },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const etaService = container.resolve<IShipmentEtaMonitorService>(TOKENS.IShipmentEtaMonitorService);
      const result = await etaService.runEtaCheck();
      return { data: result, error: null };
    } catch (err) {
      if ((err as Error).message?.includes('No registration')) {
        reply.status(503);
        return {
          data: null,
          error: 'ETA monitor is not enabled. Set ROUTING_PROVIDER env var to "here", "tomtom", or "valhalla".',
        };
      }
      reply.status(500);
      return { data: null, error: (err as Error).message };
    }
  });

  // POST /api/v1/eta-monitor/check/:shipmentId — check ETA for a single shipment
  server.post<{ Params: { shipmentId: string } }>('/api/v1/eta-monitor/check/:shipmentId', {
    schema: {
      tags: ['ETA Monitor'],
      summary: 'Check ETA for a single shipment',
      params: {
        type: 'object',
        properties: {
          shipmentId: { type: 'string' },
        },
        required: ['shipmentId'],
      },
      response: {
        200: {
          type: 'object',
          properties: {
            data: {
              type: 'object',
              properties: {
                shipmentId: { type: 'string' },
                shipmentReference: { type: 'string' },
                status: { type: 'string' },
                previousEta: { type: 'string', nullable: true },
                newEta: { type: 'string', nullable: true },
                delayMinutes: { type: 'number', nullable: true },
                nextStopId: { type: 'string', nullable: true },
                nextStopName: { type: 'string', nullable: true },
                errorMessage: { type: 'string', nullable: true },
              },
            },
            error: { type: 'string', nullable: true },
          },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const etaService = container.resolve<IShipmentEtaMonitorService>(TOKENS.IShipmentEtaMonitorService);
      const result = await etaService.checkSingleShipment(request.params.shipmentId);
      return { data: result, error: null };
    } catch (err) {
      if ((err as Error).message?.includes('No registration')) {
        reply.status(503);
        return {
          data: null,
          error: 'ETA monitor is not enabled. Set ROUTING_PROVIDER env var to "here", "tomtom", or "valhalla".',
        };
      }
      reply.status(500);
      return { data: null, error: (err as Error).message };
    }
  });
};
