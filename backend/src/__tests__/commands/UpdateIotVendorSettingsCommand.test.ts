import {
  UNKNOWN_IOT_VENDOR,
  UPDATE_IOT_VENDOR_SETTINGS,
  UpdateIotVendorSettingsCommandHandler,
} from '../../commands/iotVendors/UpdateIotVendorSettingsCommand';
import { EVENT_TYPES } from '../../events/eventTypes';
import { createTestCommand, mockEventBus } from '../helpers/testUtils';

function makeTx() {
  return {
    iotVendor: {
      upsert: jest.fn().mockImplementation(({ where, update, create }: any) => Promise.resolve({
        id: 'vendor-1',
        vendorKey: where.orgId_vendorKey.vendorKey,
        name: create.name,
        enabled: update.enabled ?? create.enabled,
        webhookSecret: 'webhookSecret' in update ? update.webhookSecret : create.webhookSecret,
      })),
    },
  } as any;
}

function makePrisma(tx: any) {
  return {
    $transaction: jest.fn((fn: Function) => fn(tx)),
    domainEventLog: { findFirst: jest.fn().mockResolvedValue(null) },
  } as any;
}

describe('UpdateIotVendorSettingsCommandHandler', () => {
  it('upserts the org row and emits iot_vendor.settings_updated', async () => {
    const tx = makeTx();
    const { bus } = mockEventBus();
    const handler = new UpdateIotVendorSettingsCommandHandler(makePrisma(tx), bus);

    const result = await handler.execute(createTestCommand(
      UPDATE_IOT_VENDOR_SETTINGS,
      { vendorKey: 'system_loco', enabled: false },
      { orgId: 'org-1', actorId: 'user-1', metadata: { correlationId: 'corr-1', source: 'api' } },
    ));

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ vendorKey: 'system_loco', name: 'System Loco', enabled: false, hasWebhookSecret: false });
    expect(tx.iotVendor.upsert.mock.calls[0][0].where).toEqual({ orgId_vendorKey: { orgId: 'org-1', vendorKey: 'system_loco' } });
    expect(tx.iotVendor.upsert.mock.calls[0][0].update).toEqual({ enabled: false });

    const event = result.events[0];
    expect(event.type).toBe(EVENT_TYPES.IOT_VENDOR_SETTINGS_UPDATED);
    expect(event.orgId).toBe('org-1');
    expect(event.actorId).toBe('user-1');
    expect(event.metadata.correlationId).toBe('corr-1');
  });

  it('never puts the secret in the event', async () => {
    const { bus } = mockEventBus();
    const handler = new UpdateIotVendorSettingsCommandHandler(makePrisma(makeTx()), bus);

    const result = await handler.execute(createTestCommand(
      UPDATE_IOT_VENDOR_SETTINGS,
      { vendorKey: 'system_loco', webhookSecret: 'shh-very-secret' },
      { orgId: 'org-1' },
    ));

    expect(result.data?.hasWebhookSecret).toBe(true);
    expect(JSON.stringify(result.events)).not.toContain('shh-very-secret');
    expect(result.events[0].payload).toEqual(expect.objectContaining({ webhookSecretChanged: true, hasWebhookSecret: true }));
  });

  it('clears the secret when given an empty string', async () => {
    const tx = makeTx();
    const { bus } = mockEventBus();
    const handler = new UpdateIotVendorSettingsCommandHandler(makePrisma(tx), bus);

    await handler.execute(createTestCommand(UPDATE_IOT_VENDOR_SETTINGS, { vendorKey: 'system_loco', webhookSecret: '' }, { orgId: 'org-1' }));

    expect(tx.iotVendor.upsert.mock.calls[0][0].update).toEqual({ webhookSecret: null });
  });

  it('rejects a vendor the platform does not know', async () => {
    const tx = makeTx();
    const { bus } = mockEventBus();
    const handler = new UpdateIotVendorSettingsCommandHandler(makePrisma(tx), bus);

    const result = await handler.execute(createTestCommand(UPDATE_IOT_VENDOR_SETTINGS, { vendorKey: 'acme', enabled: true }, { orgId: 'org-1' }));

    expect(result.success).toBe(false);
    expect(result.error).toBe(UNKNOWN_IOT_VENDOR);
    expect(tx.iotVendor.upsert).not.toHaveBeenCalled();
  });
});
