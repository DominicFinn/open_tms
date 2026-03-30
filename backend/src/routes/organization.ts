import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { IOrganizationRepository } from '../repositories/OrganizationRepository.js';
import { container, TOKENS } from '../di/index.js';

const updateSettingsSchema = z.object({
  name: z.string().min(1).optional(),
  trackingMode: z.enum(['group', 'item']).optional(),
  trackableUnitType: z.enum(['pallet', 'tote', 'box', 'stillage', 'custom']).optional(),
  customUnitName: z.string().optional(),
  weightUnit: z.enum(['kg', 'lb']).optional(),
  dimUnit: z.enum(['cm', 'in']).optional(),
  temperatureUnit: z.enum(['C', 'F']).optional(),
  distanceUnit: z.enum(['km', 'mi']).optional(),
});

export async function organizationRoutes(server: FastifyInstance) {
  const orgRepo = container.resolve<IOrganizationRepository>(TOKENS.IOrganizationRepository);

  // Get organization settings
  server.get('/api/v1/organization/settings', async (_req: FastifyRequest, _reply: FastifyReply) => {
    const settings = await orgRepo.getSettings();
    return { data: settings, error: null };
  });

  // Update organization settings
  server.put('/api/v1/organization/settings', async (req: FastifyRequest, reply: FastifyReply) => {
    const body = updateSettingsSchema.parse((req as any).body);

    // Validation: if custom type is selected, customUnitName must be provided
    if (body.trackableUnitType === 'custom' && !body.customUnitName) {
      reply.code(400);
      return {
        data: null,
        error: 'Custom unit name is required when trackableUnitType is "custom"'
      };
    }

    const updated = await orgRepo.updateSettings(body);
    return { data: updated, error: null };
  });

  // Get the current trackable unit label (helper endpoint)
  server.get('/api/v1/organization/trackable-unit-label', async (_req: FastifyRequest, _reply: FastifyReply) => {
    const label = await orgRepo.getTrackableUnitLabel();
    return { data: { label }, error: null };
  });
}
