/**
 * Portal session storage (customer + carrier).
 *
 * Persists JWT + user payload to BOTH localStorage and a non-HttpOnly cookie
 * so the session survives in browsers where localStorage is cleared between
 * navigations (private mode, strict ITP, certain extension policies). The
 * cookie is read-only fallback for client code — auth is still carried via the
 * `Authorization: Bearer` header, not the cookie itself.
 *
 * Cookie lifetime is 7 days; the backend JWT expires sooner (24h) and 401s
 * out of expired tokens. Cookie max-age just controls how long the client
 * "remembers" them, not how long the session is valid.
 */

const COOKIE_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

function setCookie(name: string, value: string): void {
  if (typeof document === 'undefined') return;
  const encoded = encodeURIComponent(value);
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${name}=${encoded}; path=/; max-age=${COOKIE_MAX_AGE_SECONDS}; SameSite=Lax${secure}`;
}

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const prefix = `${name}=`;
  for (const part of document.cookie.split(';')) {
    const trimmed = part.trim();
    if (trimmed.startsWith(prefix)) {
      return decodeURIComponent(trimmed.slice(prefix.length));
    }
  }
  return null;
}

function deleteCookie(name: string): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${name}=; path=/; max-age=0; SameSite=Lax`;
}

export interface PortalSessionStore<U> {
  save(token: string, user: U): void;
  getToken(): string;
  getUser(): U | null;
  clear(): void;
}

/**
 * Build a session helper bound to a key prefix.
 *
 * @param prefix Cookie/localStorage key prefix (e.g. "customer", "carrier")
 * @param userValid Optional sanity check on the parsed user payload; if it
 *                  returns false the helper treats storage as empty.
 */
export function createPortalSessionStore<U>(
  prefix: string,
  userValid: (u: any) => u is U = (u): u is U => !!u && typeof u === 'object',
): PortalSessionStore<U> {
  const TOKEN_KEY = `${prefix}_token`;
  const USER_KEY = `${prefix}_user`;

  return {
    save(token: string, user: U): void {
      const userJson = JSON.stringify(user);
      try {
        localStorage.setItem(TOKEN_KEY, token);
        localStorage.setItem(USER_KEY, userJson);
      } catch {
        // localStorage blocked — cookie is the fallback.
      }
      setCookie(TOKEN_KEY, token);
      setCookie(USER_KEY, userJson);
    },
    getToken(): string {
      try {
        const v = localStorage.getItem(TOKEN_KEY);
        if (v) return v;
      } catch {
        // ignore
      }
      return getCookie(TOKEN_KEY) || '';
    },
    getUser(): U | null {
      let raw: string | null = null;
      try {
        raw = localStorage.getItem(USER_KEY);
      } catch {
        // ignore
      }
      if (!raw) raw = getCookie(USER_KEY);
      if (!raw) return null;
      try {
        const parsed = JSON.parse(raw);
        return userValid(parsed) ? parsed : null;
      } catch {
        return null;
      }
    },
    clear(): void {
      try {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
      } catch {
        // ignore
      }
      deleteCookie(TOKEN_KEY);
      deleteCookie(USER_KEY);
    },
  };
}
