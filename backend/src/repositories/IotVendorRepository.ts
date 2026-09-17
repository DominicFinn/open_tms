/**
 * IoT vendor settings reads (#291).
 *
 * Module: tms. One row per (orgId, vendorKey). A missing row means the org has never changed the
 * vendor's settings; IotVendorSettingsService fills in the defaults.
 */

import { PrismaClient } from '@prisma/client';

export interface IotVendorRow {
  vendorKey: string;
  name: string;
  enabled: boolean;
  hasWebhookSecret: boolean;
}

export interface IIotVendorRepository {
  listForOrg(orgId: string): Promise<IotVendorRow[]>;
}

export class IotVendorRepository implements IIotVendorRepository {
  constructor(private prisma: PrismaClient) {}

  async listForOrg(orgId: string): Promise<IotVendorRow[]> {
    const rows = await this.prisma.iotVendor.findMany({
      where: { orgId },
      select: { vendorKey: true, name: true, enabled: true, webhookSecret: true },
    });
    // The secret never leaves the repository, only whether one is set.
    return rows.map(({ webhookSecret, ...v }) => ({ ...v, hasWebhookSecret: !!webhookSecret }));
  }
}
