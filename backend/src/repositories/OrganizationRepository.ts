import { Organization, PrismaClient } from '@prisma/client';

export interface UpdateOrganizationSettingsDTO {
  name?: string;
  trackingMode?: 'group' | 'item';
  trackableUnitType?: 'pallet' | 'tote' | 'box' | 'stillage' | 'custom';
  customUnitName?: string;
  weightUnit?: 'kg' | 'lb';
  dimUnit?: 'cm' | 'in';
  temperatureUnit?: 'C' | 'F';
  distanceUnit?: 'km' | 'mi';
  autoTenderEnabled?: boolean;
  defaultGeofenceRadiusMeters?: number;
  autoDeliverShipmentDocs?: boolean;
  // Brokerage fields
  organizationType?: 'shipper' | 'broker' | 'carrier' | '3pl';
  mcNumber?: string | null;
  bondAmountCents?: number | null;
  bondExpirationDate?: Date | null;
  operatingAuthorityStatus?: 'active' | 'pending' | 'revoked' | null;
  minMarginPercent?: number | null;
  marginAlertEnabled?: boolean;
}

export interface IOrganizationRepository {
  getSettings(orgId: string): Promise<Organization | null>;
  updateSettings(orgId: string, data: UpdateOrganizationSettingsDTO): Promise<Organization | null>;
  getTrackableUnitLabel(orgId: string): Promise<string | null>;
}

export class OrganizationRepository implements IOrganizationRepository {
  constructor(private prisma: PrismaClient) {}

  /** Settings for the caller's own organization. Null when the org does not exist. */
  async getSettings(orgId: string): Promise<Organization | null> {
    return this.prisma.organization.findUnique({ where: { id: orgId } });
  }

  async updateSettings(orgId: string, data: UpdateOrganizationSettingsDTO): Promise<Organization | null> {
    const org = await this.getSettings(orgId);
    if (!org) return null;

    return this.prisma.organization.update({
      where: { id: org.id },
      data,
    });
  }

  /**
   * The human-readable label for the trackable unit type: the custom name when the org uses a
   * custom type, otherwise the preset type capitalised.
   */
  async getTrackableUnitLabel(orgId: string): Promise<string | null> {
    const org = await this.getSettings(orgId);
    if (!org) return null;

    if (org.trackableUnitType === 'custom' && org.customUnitName) {
      return org.customUnitName;
    }

    return org.trackableUnitType.charAt(0).toUpperCase() + org.trackableUnitType.slice(1);
  }
}
