/**
 * Error codes thrown by the geofence commands. Routes map them onto HTTP status codes; anything
 * from another org reads as not found so its existence stays opaque.
 */
export const GEOFENCE_ENTITY_NOT_FOUND = 'GEOFENCE_ENTITY_NOT_FOUND';

/** Thrown when the one-active-geofence-per-entity DB constraint rejects a concurrent create. */
export const GEOFENCE_CONCURRENT_WRITE = 'GEOFENCE_CONCURRENT_WRITE';

export function statusForGeofenceError(error: string | undefined): number {
  switch (error) {
    case GEOFENCE_ENTITY_NOT_FOUND:
      return 404;
    case GEOFENCE_CONCURRENT_WRITE:
      return 409;
    default:
      return 400;
  }
}
