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
import { IEventBus } from '../events/IEventBus.js';
import { createEvent } from '../events/createEvent.js';
import { EVENT_TYPES } from '../events/eventTypes.js';

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
  resolveOrCreate(orgId: string, data: RawLocationData, actorId?: string): Promise<LocationResolutionResult>;

  /**
   * Ensure a location has at least one arrival criteria.
   * If it has none, create a default geofence.
   */
  ensureArrivalCriteria(orgId: string, locationId: string): Promise<void>;
}

export class LocationResolutionService implements ILocationResolutionService {
  constructor(
    private prisma: PrismaClient,
    private locationsRepo: ILocationsRepository,
    private arrivalCriteriaRepo: IArrivalCriteriaRepository,
    private eventBus?: IEventBus,
  ) {}

  async resolveOrCreate(orgId: string, data: RawLocationData, actorId?: string): Promise<LocationResolutionResult> {
    // Match an existing location by name + city within the tenant.
    const existing = await this.prisma.location.findFirst({
      where: {
        orgId,
        archived: false,
        name: { equals: data.name, mode: 'insensitive' },
        city: { equals: data.city, mode: 'insensitive' },
      },
    });

    if (existing) {
      await this.ensureArrivalCriteria(orgId, existing.id);
      return { location: existing, created: false };
    }

    const locationData: CreateLocationDTO = {
      orgId,
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

    await this.arrivalCriteriaRepo.createDefaultGeofence(
      location.id,
      await this.defaultGeofenceRadius(orgId),
      location.lat ?? undefined,
      location.lng ?? undefined,
    );

    if (this.eventBus) {
      try {
        await this.eventBus.publish(createEvent({
          type: EVENT_TYPES.LOCATION_CREATED,
          orgId,
          actorId: actorId ?? null,
          entityType: 'location',
          entityId: location.id,
          payload: {
            locationName: location.name,
            name: location.name,
            city: location.city,
            country: location.country,
            source: 'resolution',
          },
          source: 'resolution',
        }));
      } catch (err) {
        // Non-critical — location is created, audit is best-effort
        console.warn(`[LocationResolution] Failed to publish location.created event: ${(err as Error).message}`);
      }
    }

    return { location, created: true };
  }

  async ensureArrivalCriteria(orgId: string, locationId: string): Promise<void> {
    const location = await this.locationsRepo.findById(locationId, orgId);
    if (!location) return;

    const existing = await this.arrivalCriteriaRepo.findByLocationId(locationId, orgId);
    if (existing.length > 0) return;

    await this.arrivalCriteriaRepo.createDefaultGeofence(
      locationId,
      await this.defaultGeofenceRadius(orgId),
      location.lat ?? undefined,
      location.lng ?? undefined,
    );
  }

  private async defaultGeofenceRadius(orgId: string): Promise<number> {
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
      select: { defaultGeofenceRadiusMeters: true },
    });
    return org?.defaultGeofenceRadiusMeters ?? 200;
  }
}
