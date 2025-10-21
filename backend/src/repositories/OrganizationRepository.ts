import { PrismaClient, Organization } from '@prisma/client';

export interface UpdateOrganizationSettingsDTO {
  name?: string;
  trackingMode?: 'group' | 'item';
  trackableUnitType?: 'pallet' | 'tote' | 'box' | 'stillage' | 'custom';
  customUnitName?: string;
}

export interface IOrganizationRepository {
  getSettings(): Promise<Organization>;
  updateSettings(data: UpdateOrganizationSettingsDTO): Promise<Organization>;
  getTrackableUnitLabel(): Promise<string>;
}

export class OrganizationRepository implements IOrganizationRepository {
  constructor(private prisma: PrismaClient) {}

  /**
   * Get the organization settings (there's only one org in the system)
   * If no org exists, create a default one
   */
  async getSettings(): Promise<Organization> {
    let org = await this.prisma.organization.findFirst();

    if (!org) {
      // Create default organization if it doesn't exist
      org = await this.prisma.organization.create({
        data: {
          name: 'Default Organization',
          trackingMode: 'item',
          trackableUnitType: 'box'
        }
      });
    }

    return org;
  }

  /**
   * Update organization settings
   */
  async updateSettings(data: UpdateOrganizationSettingsDTO): Promise<Organization> {
    const org = await this.getSettings();

    return this.prisma.organization.update({
      where: { id: org.id },
      data
    });
  }

  /**
   * Get the human-readable label for the trackable unit type
   * Returns either the preset type or the custom name
   */
  async getTrackableUnitLabel(): Promise<string> {
    const org = await this.getSettings();

    if (org.trackableUnitType === 'custom' && org.customUnitName) {
      return org.customUnitName;
    }

    // Return the standard type, capitalized
    return org.trackableUnitType.charAt(0).toUpperCase() + org.trackableUnitType.slice(1);
  }
}
