/**
 * Mode rules + cartonization preview API for order line items.
 *
 * Used by the customer portal create-order form to:
 *   1. Know which fields are required given the shipment mode + flags
 *      (LTL needs class/dims; hazmat needs UN data; etc.).
 *   2. Live-preview the derived numbers (density, suggested class, pallet
 *      positions, linear feet) without committing the order.
 *
 * Pure compute endpoints — no writes, no side effects.
 */

import { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { container, TOKENS } from '../di/index.js';
import { IModeRulesService, Mode, LineField } from '../services/orderLineItem/ModeRulesService.js';
import { IOrderCartonizationService } from '../services/orderLineItem/OrderCartonizationService.js';

const MODES: Mode[] = ['ftl', 'ltl', 'parcel', 'intermodal', 'ocean', 'air'];

const ModeRulesQuery = z.object({
  mode: z.enum(MODES as [Mode, ...Mode[]]),
  hazmat: z.coerce.boolean().optional(),
  international: z.coerce.boolean().optional(),
  temperatureControlled: z.coerce.boolean().optional(),
});

const LineSchema = z.object({
  quantity: z.number().nonnegative().default(0),
  weight: z.number().nullable().optional(),
  weightUnit: z.enum(['kg', 'lb', 'g']).optional(),
  length: z.number().nullable().optional(),
  width: z.number().nullable().optional(),
  height: z.number().nullable().optional(),
  dimUnit: z.enum(['cm', 'in', 'mm']).optional(),
  freightClass: z.string().nullable().optional(),
});

const PackingSummarySchema = z.object({
  packagingTypeId: z.string().nullable().optional(),
  unitCount: z.number().int().nonnegative(),
  stackable: z.boolean().optional(),
  unitLengthMm: z.number().nullable().optional(),
  unitWidthMm: z.number().nullable().optional(),
  unitHeightMm: z.number().nullable().optional(),
}).optional();

const CartonizationBody = z.object({
  lines: z.array(LineSchema).default([]),
  packingSummary: PackingSummarySchema,
});

export async function orderLineItemRulesRoutes(server: FastifyInstance) {
  const modeRules = container.resolve<IModeRulesService>(TOKENS.IModeRulesService);
  const cartonization = container.resolve<IOrderCartonizationService>(TOKENS.IOrderCartonizationService);

  server.get('/api/v1/order-line-items/mode-rules', {
    schema: {
      tags: ['Orders - Line Items'],
      summary: 'Required / recommended / hidden fields for a given mode + flags',
      description: 'Drives conditional rendering and required-ness in the portal create-order form. Same rules are re-evaluated server-side on order create.',
      querystring: {
        type: 'object',
        required: ['mode'],
        properties: {
          mode: { type: 'string', enum: MODES },
          hazmat: { type: 'boolean' },
          international: { type: 'boolean' },
          temperatureControlled: { type: 'boolean' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            data: {
              type: 'object',
              properties: {
                required: { type: 'array', items: { type: 'string' } },
                recommended: { type: 'array', items: { type: 'string' } },
                hidden: { type: 'array', items: { type: 'string' } },
              },
            },
            error: { type: ['string', 'null'] },
          },
        },
      },
    },
  }, async (req: FastifyRequest) => {
    const q = ModeRulesQuery.parse(req.query);
    const rules = modeRules.getRules(q.mode, {
      hazmat: q.hazmat,
      international: q.international,
      temperatureControlled: q.temperatureControlled,
    });
    return { data: rules, error: null };
  });

  server.post('/api/v1/order-line-items/cartonization/preview', {
    schema: {
      tags: ['Orders - Line Items'],
      summary: 'Live cartonization preview: density, suggested class, pallet positions, linear feet',
      description: 'Pure compute. Customers supply lines (qty + dims + weight) and an optional order-level packing summary; we return the derived numbers. Never persisted.',
      body: {
        type: 'object',
        properties: {
          lines: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                quantity: { type: 'number', minimum: 0 },
                weight: { type: ['number', 'null'] },
                weightUnit: { type: 'string', enum: ['kg', 'lb', 'g'] },
                length: { type: ['number', 'null'] },
                width: { type: ['number', 'null'] },
                height: { type: ['number', 'null'] },
                dimUnit: { type: 'string', enum: ['cm', 'in', 'mm'] },
                freightClass: { type: ['string', 'null'] },
              },
            },
          },
          packingSummary: {
            type: 'object',
            properties: {
              packagingTypeId: { type: ['string', 'null'] },
              unitCount: { type: 'integer', minimum: 0 },
              stackable: { type: 'boolean' },
              unitLengthMm: { type: ['number', 'null'] },
              unitWidthMm: { type: ['number', 'null'] },
              unitHeightMm: { type: ['number', 'null'] },
            },
          },
        },
      },
    },
  }, async (req: FastifyRequest) => {
    const body = CartonizationBody.parse((req as any).body ?? {});
    const result = cartonization.computeOrder(body.lines, body.packingSummary as any);
    return { data: result, error: null };
  });
}

export type { LineField };
