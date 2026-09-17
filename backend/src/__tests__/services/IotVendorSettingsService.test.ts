import { IotVendorSettingsService } from '../../services/iot/IotVendorSettingsService';

describe('IotVendorSettingsService.list', () => {
  it('fills in an enabled default for a vendor the org has never configured', async () => {
    const repo = { listForOrg: jest.fn().mockResolvedValue([]) };
    const service = new IotVendorSettingsService(repo);

    expect(await service.list('org-1')).toEqual([
      { vendorKey: 'system_loco', name: 'System Loco', enabled: true, hasWebhookSecret: false },
    ]);
    expect(repo.listForOrg).toHaveBeenCalledWith('org-1');
  });

  it("uses the org's saved settings when present", async () => {
    const saved = { vendorKey: 'system_loco', name: 'System Loco', enabled: false, hasWebhookSecret: true };
    const service = new IotVendorSettingsService({ listForOrg: jest.fn().mockResolvedValue([saved]) });

    expect(await service.list('org-1')).toEqual([saved]);
  });

  it('ignores saved rows for vendors the platform no longer knows', async () => {
    const service = new IotVendorSettingsService({
      listForOrg: jest.fn().mockResolvedValue([{ vendorKey: 'retired', name: 'Retired', enabled: true, hasWebhookSecret: false }]),
    });

    expect((await service.list('org-1')).map(v => v.vendorKey)).toEqual(['system_loco']);
  });
});
