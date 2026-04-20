import { useState, useEffect } from 'react';
import { API_URL } from '../api';

export interface CurrentUser {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  roles: string[];
  permissions: string[];
  organizationId?: string;
}

let cachedUser: CurrentUser | null = null;
let inflight: Promise<CurrentUser | null> | null = null;

function readStoredUser(): CurrentUser | null {
  const raw = localStorage.getItem('auth_user');
  if (!raw) return null;
  try {
    return JSON.parse(raw) as CurrentUser;
  } catch {
    return null;
  }
}

async function fetchMe(): Promise<CurrentUser | null> {
  const token = localStorage.getItem('auth_token');
  if (!token) return null;

  // The global fetch interceptor will attach Authorization and redirect on 401.
  try {
    const res = await fetch(`${API_URL}/api/v1/auth/me`);
    if (!res.ok) return null;
    const json = await res.json();
    if (json.error || !json.data) return null;
    const user = json.data as CurrentUser;
    localStorage.setItem('auth_user', JSON.stringify(user));
    return user;
  } catch {
    return null;
  }
}

/**
 * Returns the currently authenticated internal user.
 *
 * Resolves immediately from the cached user (seeded at login and kept in
 * localStorage), then refreshes against GET /api/v1/auth/me in the background
 * so role/permission changes propagate without requiring re-login.
 *
 * If no auth_token is present this returns `null` + `loading=false`. The
 * RequireAuth guard handles the unauthenticated case and redirects to /login.
 */
export function useCurrentUser() {
  const initial = cachedUser ?? readStoredUser();
  const [user, setUser] = useState<CurrentUser | null>(initial);
  const [loading, setLoading] = useState<boolean>(!initial && !!localStorage.getItem('auth_token'));

  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }

    if (!inflight) inflight = fetchMe().finally(() => { inflight = null; });
    inflight.then((fresh) => {
      if (fresh) {
        cachedUser = fresh;
        setUser(fresh);
      }
      setLoading(false);
    });
  }, []);

  const hasPermission = (...required: string[]): boolean => {
    if (!user) return false;
    if (user.permissions.includes('*')) return true;
    return required.every((p) => {
      if (user.permissions.includes(p)) return true;
      const [resource] = p.split(':');
      return user.permissions.includes(`${resource}:*`);
    });
  };

  const hasRole = (...roles: string[]): boolean => {
    if (!user) return false;
    return roles.some((r) => user.roles.includes(r));
  };

  return { user, loading, hasPermission, hasRole };
}
