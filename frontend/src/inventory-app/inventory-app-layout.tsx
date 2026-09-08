import React, { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { LogOut, PackageSearch, ScanLine, Warehouse as WarehouseIcon, type LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';
import { clearInventoryAppSession, getInventoryAppToken, getInventoryAppUser } from './inventory-session';

interface InventoryAppUser {
  email?: string;
}

interface BottomNavItem {
  to: string;
  icon: LucideIcon;
  label: string;
  end?: boolean;
}

const NAV: BottomNavItem[] = [
  { to: '/inventory-app', icon: PackageSearch, label: 'Levels', end: true },
  { to: '/inventory-app/scan', icon: ScanLine, label: 'Scan' },
];

export function InventoryAppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState<InventoryAppUser | null>(null);

  useEffect(() => {
    const stored = getInventoryAppUser();
    if (!stored || !getInventoryAppToken()) {
      navigate('/inventory-app/login');
      return;
    }
    if (!localStorage.getItem('inventory_app_location')) {
      navigate('/inventory-app/select-location');
      return;
    }
    setUser(stored);
  }, [navigate]);

  function handleLogout() {
    clearInventoryAppSession();
    localStorage.removeItem('inventory_app_location');
    navigate('/inventory-app/login');
  }

  if (!user) return null;

  const locationName = (() => {
    try {
      const loc = JSON.parse(localStorage.getItem('inventory_app_location') || '{}');
      return loc.name || '';
    } catch {
      return '';
    }
  })();

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground font-sans">
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-border bg-background px-4">
        <div className="flex items-center gap-2 text-base font-semibold">
          <WarehouseIcon className="h-5 w-5 text-primary" />
          <span>Inventory</span>
          {locationName && (
            <span className="text-xs font-normal text-muted-foreground">| {locationName}</span>
          )}
        </div>
        <button
          type="button"
          onClick={handleLogout}
          aria-label="Logout"
          className="inline-flex h-11 w-11 items-center justify-center rounded-md text-muted-foreground hover:bg-muted/40 hover:text-foreground active:bg-muted/60"
        >
          <LogOut className="h-5 w-5" />
        </button>
      </header>

      <main className="flex-1 overflow-y-auto px-4 pb-20 pt-4">
        <Outlet />
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-30 flex h-16 items-stretch border-t border-border bg-card">
        {NAV.map(item => {
          const Icon = item.icon;
          const isActive = item.end
            ? location.pathname === item.to
            : location.pathname === item.to || location.pathname.startsWith(item.to + '/');
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={cn(
                'flex flex-1 flex-col items-center justify-center gap-0.5 px-2 text-[11px] font-medium transition-colors',
                isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground active:text-primary',
              )}
            >
              <Icon className="h-5 w-5" />
              <span className="leading-none">{item.label}</span>
              {isActive && <span aria-hidden className="absolute top-0 h-0.5 w-8 rounded-b bg-primary" />}
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
}
