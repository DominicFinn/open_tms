/**
 * Error codes thrown by the geofence commands. Routes map them onto HTTP status codes; anything
 * from another org reads as not found so its existence stays opaque.
 */
export const GEOFENCE_ENTITY_NOT_FOUND = 'GEOFENCE_ENTITY_NOT_FOUND';

export function statusForGeofenceError(error: string | undefined): number {
  switch (error) {
    case GEOFENCE_ENTITY_NOT_FOUND:
      return 404;
    default:
      return 400;
  }
}
