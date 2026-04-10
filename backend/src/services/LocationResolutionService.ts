/**
 * LocationResolutionService
 *
 * Resolves raw address data into Location records. When a location doesn't
 * already exist, it is automatically created with a default geofence
 * arrival criteria. This ensures every address that enters the system
 * always becomes a first-class Location with arrival criteria.
 */

import { PrismaClient, Location } from '@prisma/client';
import { ILocationsRepository, CreateLocationDTO } from '../repositories/LocationsRepository.js';
import { IArrivalCriteriaRepository } from '../repositories/ArrivalCriteriaRepository.js';

export interface RawLocationData {
  name: string;
  address1: string;
  address2?: string;
  city: string;
  state?: string;
  postalCode?: string;
  country: string;
  lat?: number;
  lng?: number;
}

export interface LocationResolutionResult {
  location: Location;
  created: boolean; // true if a new location was created
}

export interface ILocationResolutionService {
  /**
   * Resolve address data to an existing location or create a new one.
   * Matching: name + city (case-insensitive). If no match, creates the location
   * and a default geofence arrival criteria.
   */
  resolveOrCreate(data: RawLocationData, actorId?: string): Promise<LocationResolutionResult>;

  /**
   * Ensure a location has at least one arrival criteria.
   * If it has none, create a default geofence.
   */
  ensureArrivalCriteria(locationId: string): Promise<void>;
}

export class LocationResolutionService implements ILocationResolutionService {
  constructor(
    private prisma: PrismaClient,
    private locationsRepo: ILocationsRepository,
    private arrivalCriteriaRepo: IArrivalCriteriaRepository,
  ) {}

  async resolveOrCreate(data: RawLocationData, _actorId?: string): Promise<LocationResolutionResult> {
    // Try to find an existing location by name + city match
    const existing = await this.prisma.location.findFirst({
      where: {
        archived: false,
        name: { equals: data.name, mode: 'insensitive' },
        city: { equals: data.city, mode: 'insensitive' },
      },
    });

    if (existing) {
      // Ensure existing location has arrival criteria
      await this.ensureArrivalCriteria(existing.id);
      return { location: existing, created: false };
    }

    // Create new location
    const locationData: CreateLocationDTO = {
      name: data.name,
      address1: data.address1,
      address2: data.address2,
      city: data.city,
      state: data.state,
      postalCode: data.postalCode,
      country: data.country,
      lat: data.lat,
      lng: data.lng,
    };

    const location = await this.locationsRepo.create(locationData);

    // Create default geofence arrival criteria
    const org = await this.prisma.organization.findFirst({
      select: { defaultGeofenceRadiusMeters: true },
    });
    const defaultRadius = org?.defaultGeofenceRadiusMeters ?? 200;

    await this.arrivalCriteriaRepo.createDefaultGeofence(
      location.id,
      defaultRadius,
      location.lat ?? undefined,
      location.lng ?? undefined,
    );

    return { location, created: true };
  }

  async ensureArrivalCriteria(locationId: string): Promise<void> {
    const existing = await this.arrivalCriteriaRepo.findByLocationId(locationId);
    if (existing.length > 0) return;

    // Get the location's coordinates and org default radius
    const [location, org] = await Promise.all([
      this.locationsRepo.findById(locationId),
      this.prisma.organization.findFirst({
        select: { defaultGeofenceRadiusMeters: true },
      }),
    ]);

    if (!location) return;
    const defaultRadius = org?.defaultGeofenceRadiusMeters ?? 200;

    await this.arrivalCriteriaRepo.createDefaultGeofence(
      locationId,
      defaultRadius,
      location.lat ?? undefined,
      location.lng ?? undefined,
    );
  }
}
