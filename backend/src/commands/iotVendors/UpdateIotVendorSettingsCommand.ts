import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';
import { findKnownIotVendor } from '../../services/iot/IotVendorSettingsService.js';
import { IotVendorRow } from '../../repositories/IotVendorRepository.js';

export const UNKNOWN_IOT_VENDOR = 'UNKNOWN_IOT_VENDOR';

export interface UpdateIotVendorSettingsPayload {
  vendorKey: string;
  enabled?: boolean;
  /** undefined leaves the secret alone; null or empty string clears it. */
  webhookSecret?: string | null;
}

export const UPDATE_IOT_VENDOR_SETTINGS = 'iot_vendor.update_settings';

export class UpdateIotVendorSettingsCommandHandler extends BaseCommandHandler<UpdateIotVendorSettingsPayload, IotVendorRow> {
  readonly commandType = UPDATE_IOT_VENDOR_SETTINGS;
  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) { super(prisma, eventBus); }

  protected async handle(command: Command<UpdateIotVendorSettingsPayload>, tx: TransactionClient, emit: EmitFn) {
    const { vendorKey, enabled, webhookSecret } = command.payload;
    const known = findKnownIotVendor(vendorKey);
    if (!known) throw new Error(UNKNOWN_IOT_VENDOR);

    const update: { enabled?: boolean; webhookSecret?: string | null } = {};
    if (enabled !== undefined) update.enabled = enabled;
    if (webhookSecret !== undefined) update.webhookSecret = webhookSecret || null;

    const vendor = await tx.iotVendor.upsert({
      where: { orgId_vendorKey: { orgId: command.orgId, vendorKey } },
      update,
      create: {
        orgId: command.orgId,
        vendorKey,
        name: known.name,
        enabled: enabled ?? true,
        webhookSecret: webhookSecret || null,
      },
    });

    // The secret itself never goes into the event, only the fact that it changed.
    emit(this.createEvent(command, {
      type: EVENT_TYPES.IOT_VENDOR_SETTINGS_UPDATED,
      entityType: 'iot_vendor',
      entityId: vendor.id,
      payload: {
        vendorKey,
        enabled: vendor.enabled,
        webhookSecretChanged: webhookSecret !== undefined,
        hasWebhookSecret: !!vendor.webhookSecret,
      },
    }));

    return { vendorKey: vendor.vendorKey, name: vendor.name, enabled: vendor.enabled, hasWebhookSecret: !!vendor.webhookSecret };
  }
}
