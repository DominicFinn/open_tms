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

/**
 * Hook to get the current user's roles and permissions.
 * Falls back to a default admin-like state when no auth is configured
 * (dev mode / single-user deployment).
 */
export function useCurrentUser() {
  const [user, setUser] = useState<CurrentUser | null>(cachedUser);
  const [loading, setLoading] = useState(!cachedUser);

  useEffect(() => {
    if (cachedUser) return;

    // Try to load current user from stored token
    const token = localStorage.getItem('auth_token');
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        const u: CurrentUser = {
          id: payload.sub,
          email: payload.email,
          firstName: payload.firstName,
          lastName: payload.lastName,
          roles: payload.roles || [],
          permissions: payload.permissions || ['*'],
          organizationId: payload.organizationId,
        };
        cachedUser = u;
        setUser(u);
        setLoading(false);
        return;
      } catch {
        // Invalid token, fall through to default
      }
    }

    // No auth configured - default to admin-like access (dev mode)
    const defaultUser: CurrentUser = {
      id: 'dev-user',
      email: 'dev@opentms.local',
      roles: ['admin'],
      permissions: ['*'],
    };
    cachedUser = defaultUser;
    setUser(defaultUser);
    setLoading(false);
  }, []);

  const hasPermission = (...required: string[]): boolean => {
    if (!user) return false;
    if (user.permissions.includes('*')) return true;
    return required.every(p => {
      if (user.permissions.includes(p)) return true;
      const [resource] = p.split(':');
      return user.permissions.includes(`${resource}:*`);
    });
  };

  const hasRole = (...roles: string[]): boolean => {
    if (!user) return false;
    return roles.some(r => user.roles.includes(r));
  };

  return { user, loading, hasPermission, hasRole };
}
