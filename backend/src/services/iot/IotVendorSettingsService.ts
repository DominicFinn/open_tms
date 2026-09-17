/**
 * IoT vendor settings (#291): per-org on/off switches and webhook secrets for IoT tracking vendors.
 */

import { IIotVendorRepository, IotVendorRow } from '../../repositories/IotVendorRepository.js';

/** Vendors the platform knows about. System Loco is the only one so far. */
export const KNOWN_IOT_VENDORS: ReadonlyArray<{ vendorKey: string; name: string }> = [
  { vendorKey: 'system_loco', name: 'System Loco' },
];

export function findKnownIotVendor(vendorKey: string) {
  return KNOWN_IOT_VENDORS.find(v => v.vendorKey === vendorKey) ?? null;
}

export interface IIotVendorSettingsService {
  list(orgId: string): Promise<IotVendorRow[]>;
}

export class IotVendorSettingsService implements IIotVendorSettingsService {
  constructor(private vendors: IIotVendorRepository) {}

  // BUSINESS RULE: a vendor the org has never configured is enabled with no secret. The inbound
  // webhook worker treats a missing row the same way, so listing never needs to write rows.
  async list(orgId: string): Promise<IotVendorRow[]> {
    const saved = new Map((await this.vendors.listForOrg(orgId)).map(v => [v.vendorKey, v]));
    return KNOWN_IOT_VENDORS
      .map(v => saved.get(v.vendorKey) ?? { ...v, enabled: true, hasWebhookSecret: false })
      .sort((a, b) => a.name.localeCompare(b.name));
  }
}
