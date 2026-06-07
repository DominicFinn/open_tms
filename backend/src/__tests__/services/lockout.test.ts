import {
  computeLockoutStatus,
  isLockedOut,
  LOCKOUT_MINUTES,
  MAX_FAILED_ATTEMPTS,
  minutesUntilUnlocked,
  nextFailedAttemptState,
} from '../../services/auth/lockout';

describe('lockout helper', () => {
  describe('computeLockoutStatus', () => {
    it('returns unlocked for null/undefined user', () => {
      expect(computeLockoutStatus(null)).toEqual({ isLocked: false, lockedUntil: null, failedAttempts: 0 });
    });

    it('returns unlocked when lockedUntil is in the past', () => {
      const past = new Date(Date.now() - 60_000);
      const status = computeLockoutStatus({ failedLoginAttempts: 5, lockedUntil: past });
      expect(status.isLocked).toBe(false);
      expect(status.failedAttempts).toBe(5);
    });

    it('returns locked when lockedUntil is in the future', () => {
      const future = new Date(Date.now() + 60_000);
      expect(computeLockoutStatus({ failedLoginAttempts: 5, lockedUntil: future }).isLocked).toBe(true);
    });
  });

  describe('isLockedOut', () => {
    it('matches computeLockoutStatus.isLocked', () => {
      const future = new Date(Date.now() + 60_000);
      expect(isLockedOut({ failedLoginAttempts: 5, lockedUntil: future })).toBe(true);
      expect(isLockedOut({ failedLoginAttempts: 0, lockedUntil: null })).toBe(false);
    });
  });

  describe('minutesUntilUnlocked', () => {
    it('returns 0 when no lockout', () => {
      expect(minutesUntilUnlocked({ failedLoginAttempts: 0, lockedUntil: null })).toBe(0);
    });

    it('rounds up remaining minutes', () => {
      const now = new Date('2026-01-01T00:00:00Z');
      const lockedUntil = new Date(now.getTime() + 90_000); // 1.5 minutes
      expect(minutesUntilUnlocked({ failedLoginAttempts: 5, lockedUntil }, now)).toBe(2);
    });
  });

  describe('nextFailedAttemptState', () => {
    it('increments without locking when below threshold', () => {
      const next = nextFailedAttemptState({ failedLoginAttempts: 1, lockedUntil: null });
      expect(next.failedLoginAttempts).toBe(2);
      expect(next.lockedUntil).toBeNull();
      expect(next.triggeredLock).toBe(false);
    });

    it('triggers lock when reaching the max attempts threshold', () => {
      const now = new Date('2026-01-01T00:00:00Z');
      const next = nextFailedAttemptState(
        { failedLoginAttempts: MAX_FAILED_ATTEMPTS - 1, lockedUntil: null },
        now
      );
      expect(next.failedLoginAttempts).toBe(MAX_FAILED_ATTEMPTS);
      expect(next.triggeredLock).toBe(true);
      const expected = new Date(now.getTime() + LOCKOUT_MINUTES * 60 * 1000);
      expect(next.lockedUntil).toEqual(expected);
    });

    it('treats undefined failedLoginAttempts as zero', () => {
      const next = nextFailedAttemptState({ failedLoginAttempts: undefined as any, lockedUntil: null });
      expect(next.failedLoginAttempts).toBe(1);
    });
  });
});
