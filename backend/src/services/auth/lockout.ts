export const MAX_FAILED_ATTEMPTS = 5;
export const LOCKOUT_MINUTES = 15;

export interface LockoutFields {
  failedLoginAttempts: number;
  lockedUntil: Date | null;
}

export interface LockoutStatus {
  isLocked: boolean;
  lockedUntil: Date | null;
  failedAttempts: number;
}

export function computeLockoutStatus(user: LockoutFields | null | undefined, now: Date = new Date()): LockoutStatus {
  if (!user) return { isLocked: false, lockedUntil: null, failedAttempts: 0 };
  const isLocked = !!(user.lockedUntil && user.lockedUntil > now);
  return {
    isLocked,
    lockedUntil: user.lockedUntil ?? null,
    failedAttempts: user.failedLoginAttempts ?? 0,
  };
}

export function isLockedOut(user: LockoutFields | null | undefined, now: Date = new Date()): boolean {
  return computeLockoutStatus(user, now).isLocked;
}

export function minutesUntilUnlocked(user: LockoutFields, now: Date = new Date()): number {
  if (!user.lockedUntil) return 0;
  return Math.max(0, Math.ceil((user.lockedUntil.getTime() - now.getTime()) / 60000));
}

export interface NextLockoutState {
  failedLoginAttempts: number;
  lockedUntil: Date | null;
  triggeredLock: boolean;
}

export function nextFailedAttemptState(
  current: LockoutFields,
  now: Date = new Date()
): NextLockoutState {
  const failedLoginAttempts = (current.failedLoginAttempts ?? 0) + 1;
  if (failedLoginAttempts >= MAX_FAILED_ATTEMPTS) {
    return {
      failedLoginAttempts,
      lockedUntil: new Date(now.getTime() + LOCKOUT_MINUTES * 60 * 1000),
      triggeredLock: true,
    };
  }
  return {
    failedLoginAttempts,
    lockedUntil: current.lockedUntil ?? null,
    triggeredLock: false,
  };
}
