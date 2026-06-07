import React, { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';

import { Logo } from '@/components/brand/Logo';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import {
  clearCarrierSession,
  getCarrierUser,
  type CarrierSessionUser,
} from './pages/carrier-portal/carrierSession';

const NAV: { to: string; label: string; end?: boolean }[] = [
  { to: '/carrier-portal', label: 'Dashboard', end: true },
  { to: '/carrier-portal/history', label: 'Tender History' },
  { to: '/carrier-portal/bids', label: 'Bid History' },
  { to: '/carrier-portal/profile', label: 'Profile' },
];

export function CarrierPortalLayout() {
  const navigate = useNavigate();
  const [user, setUser] = useState<CarrierSessionUser | null>(null);

  useEffect(() => {
    const u = getCarrierUser();
    if (!u) {
      navigate('/carrier-portal/login');
      return;
    }
    setUser(u);
  }, [navigate]);

  function handleLogout() {
    clearCarrierSession();
    navigate('/carrier-portal/login');
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-border bg-background/80 px-4 backdrop-blur md:px-6">
        <div className="flex items-center gap-3">
          <Logo size="sm" wordmark={<>Carrier <span className="text-primary">Portal</span></>} />
          {user.carrierName && (
            <>
              <Separator orientation="vertical" className="h-5" />
              <span className="text-sm text-muted-foreground">{user.carrierName}</span>
            </>
          )}
        </div>

        <nav className="flex items-center gap-1">
          {NAV.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground',
                )
              }
            >
              {item.label}
            </NavLink>
          ))}
          <Separator orientation="vertical" className="mx-2 h-5" />
          {user.email && (
            <span className="hidden text-xs text-muted-foreground sm:inline">{user.email}</span>
          )}
          <Button variant="outline" size="sm" onClick={handleLogout}>
            <LogOut className="h-4 w-4" />
            Logout
          </Button>
        </nav>
      </header>

      <main className="mx-auto max-w-[1200px] px-4 py-6 md:px-6 md:py-8">
        <Outlet />
      </main>
    </div>
  );
}
