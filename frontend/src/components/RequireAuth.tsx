import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';

/**
 * Guards the main TMS routes. Redirects to /login with a returnTo param when
 * no auth_token is present in localStorage. The fetch interceptor handles
 * expired / rejected tokens; this guard handles the first-load case.
 */
export default function RequireAuth({ children }: { children: ReactNode }) {
  const token = localStorage.getItem('auth_token');
  const location = useLocation();
  if (!token) {
    const returnTo = encodeURIComponent(location.pathname + location.search + location.hash);
    return <Navigate to={`/login?returnTo=${returnTo}`} replace />;
  }
  return <>{children}</>;
}
