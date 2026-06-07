import { API_URL } from './api';

/**
 * Global fetch interceptor for the main TMS app.
 *
 * - Attaches `Authorization: Bearer <auth_token>` on every request to API_URL
 *   (unless a request already sets Authorization, e.g. portal logins with their
 *   own token scheme).
 * - On a 401 from API_URL, clears the main TMS session and redirects to /login
 *   with the current URL preserved as ?returnTo=...
 *
 * Portal fetches (carrier_token / customer_token / warehouse_token) bring their
 * own Authorization header, so we never override them. Non-API requests pass
 * through untouched.
 */

const MAIN_TMS_TOKEN_KEY = 'auth_token';
const MAIN_TMS_USER_KEY = 'auth_user';

function isApiRequest(url: string): boolean {
  return url.startsWith(API_URL);
}

function requestAlreadyHasAuth(init: RequestInit | undefined, input: RequestInfo | URL): boolean {
  if (init?.headers) {
    const h = new Headers(init.headers as HeadersInit);
    if (h.has('Authorization')) return true;
  }
  if (input instanceof Request && input.headers.has('Authorization')) return true;
  return false;
}

function isPortalRoute(url: string): boolean {
  // WMS admin endpoints share the /api/v1/warehouse/ prefix with the PWA but
  // require the main TMS JWT. Keep them on the standard auth path.
  if (url.includes('/api/v1/warehouse/zones') || url.includes('/api/v1/warehouse/bins')) {
    return false;
  }
  // Portals manage their own tokens — don't inject the main TMS token into them.
  return (
    url.includes('/api/v1/carrier-portal') ||
    url.includes('/api/v1/customer-portal') ||
    url.includes('/api/v1/customer-api') ||
    url.includes('/api/v1/warehouse')
  );
}

function isAuthPublicRoute(url: string): boolean {
  // Login / forgot-password / theme / public tracking — no token needed.
  return (
    url.includes('/api/v1/auth/login') ||
    url.includes('/api/v1/auth/forgot-password') ||
    url.includes('/api/v1/theme') ||
    url.includes('/api/v1/track/')
  );
}

function currentPathForReturnTo(): string {
  const { pathname, search, hash } = window.location;
  const full = `${pathname}${search}${hash}`;
  // Avoid bouncing back to the login page itself.
  if (pathname === '/login' || pathname === '/forgot-password') return '/';
  return full || '/';
}

function redirectToLogin() {
  const returnTo = encodeURIComponent(currentPathForReturnTo());
  const loginUrl = `/login?returnTo=${returnTo}`;
  // Avoid ping-pong if we're already on the login page.
  if (window.location.pathname !== '/login') {
    window.location.assign(loginUrl);
  }
}

export function installAuthFetchInterceptor() {
  if ((window as any).__authFetchInstalled) return;
  (window as any).__authFetchInstalled = true;

  const originalFetch = window.fetch.bind(window);

  window.fetch = async function patchedFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const url = typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.toString()
        : input.url;

    // Only touch requests to our own API.
    if (!isApiRequest(url)) {
      return originalFetch(input, init);
    }

    // Attach Authorization for main TMS routes if we have a token and one isn't already set.
    const token = localStorage.getItem(MAIN_TMS_TOKEN_KEY);
    let finalInit = init;
    if (
      token &&
      !isPortalRoute(url) &&
      !isAuthPublicRoute(url) &&
      !requestAlreadyHasAuth(init, input)
    ) {
      const headers = new Headers(init?.headers as HeadersInit | undefined);
      headers.set('Authorization', `Bearer ${token}`);
      finalInit = { ...init, headers };
    }

    const res = await originalFetch(input, finalInit);

    // On 401 from main TMS routes, bounce to /login.
    if (res.status === 401 && !isPortalRoute(url) && !isAuthPublicRoute(url)) {
      localStorage.removeItem(MAIN_TMS_TOKEN_KEY);
      localStorage.removeItem(MAIN_TMS_USER_KEY);
      redirectToLogin();
    }

    return res;
  };
}

export function logout() {
  localStorage.removeItem(MAIN_TMS_TOKEN_KEY);
  localStorage.removeItem(MAIN_TMS_USER_KEY);
  window.location.assign('/login');
}
