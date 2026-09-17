/**
 * Error codes thrown by the device commands. Routes map them onto HTTP status codes; anything
 * from another org reads as not found so its existence stays opaque.
 */
export const DEVICE_NOT_FOUND = 'DEVICE_NOT_FOUND';
export const DEVICE_EXTERNAL_ID_TAKEN = 'DEVICE_EXTERNAL_ID_TAKEN';
export const ASSIGNMENT_TARGET_NOT_FOUND = 'ASSIGNMENT_TARGET_NOT_FOUND';
export const ASSIGNMENT_TARGET_REQUIRED = 'ASSIGNMENT_TARGET_REQUIRED';

export function statusForDeviceError(error: string | undefined): number {
  switch (error) {
    case DEVICE_NOT_FOUND:
    case ASSIGNMENT_TARGET_NOT_FOUND:
      return 404;
    case DEVICE_EXTERNAL_ID_TAKEN:
      return 409;
    default:
      return 400;
  }
}
