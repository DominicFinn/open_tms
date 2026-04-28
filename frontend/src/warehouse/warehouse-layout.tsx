import React, { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  Calendar,
  ClipboardList,
  ListChecks,
  LogOut,
  Package,
  PlusSquare,
  Settings,
  Warehouse as WarehouseIcon,
  type LucideIcon,
} from 'lucide-react';

import { cn } from '@/lib/utils';

// Keep importing warehouse.css for now: phase 11 inner pages still rely on
// some `wh-*` utility classes from it. Phase 11 migrates those pages and
// phase 12 deletes the CSS file.
import './warehouse.css';

interface WarehouseUser {
  email?: string;
  roles?: string[];
}

interface BottomNavItem {
  to: string;
  icon: LucideIcon;
  label: string;
  end?: boolean;
  adminOnly?: boolean;
}

const NAV: BottomNavItem[] = [
  { to: '/warehouse', icon: ListChecks, label: 'Shipments', end: true },
  { to: '/warehouse/tasks', icon: ClipboardList, label: 'Tasks' },
  { to: '/warehouse/appointments', icon: Calendar, label: 'Arrivals' },
  { to: '/warehouse/archive', icon: Package, label: 'Archive' },
  { to: '/warehouse/create', icon: PlusSquare, label: 'Create', adminOnly: true },
  { to: '/warehouse/settings', icon: Settings, label: 'Settings' },
];

export function WarehouseLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState<WarehouseUser | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem('warehouse_user');
    if (!stored) {
      navigate('/warehouse/login');
      return;
    }
    try {
      setUser(JSON.parse(stored));
    } catch {
      navigate('/warehouse/login');
    }
  }, [navigate]);

  function handleLogout() {
    localStorage.removeItem('warehouse_user');
    localStorage.removeItem('warehouse_location');
    navigate('/warehouse/login');
  }

  if (!user) return null;

  const isAdmin = user.roles?.includes('admin');
  const locationName = (() => {
    try {
      const loc = JSON.parse(localStorage.getItem('warehouse_location') || '{}');
      return loc.name || '';
    } catch {
      return '';
    }
  })();

  const visibleNav = NAV.filter(item => !item.adminOnly || isAdmin);

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground font-sans">
      {/* Topbar - taller for touch */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-border bg-background px-4">
        <div className="flex items-center gap-2 text-base font-semibold">
          <WarehouseIcon className="h-5 w-5 text-primary" />
          <span>Warehouse</span>
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

      {/* Content - leaves room for the bottom nav (h-16) */}
      <main className="flex-1 overflow-y-auto px-4 pb-20 pt-4">
        <Outlet />
      </main>

      {/* Bottom nav - touch first: each tap target >= 48px */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex h-16 items-stretch border-t border-border bg-card">
        {visibleNav.map(item => {
          const Icon = item.icon;
          const isActive =
            item.end
              ? location.pathname === item.to
              : location.pathname === item.to || location.pathname.startsWith(item.to + '/');
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={cn(
                'flex flex-1 flex-col items-center justify-center gap-0.5 px-2 text-[11px] font-medium transition-colors',
                isActive
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground active:text-primary',
              )}
            >
              <Icon className="h-5 w-5" />
              <span className="leading-none">{item.label}</span>
              {isActive && (
                <span aria-hidden className="absolute top-0 h-0.5 w-8 rounded-b bg-primary" />
              )}
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
}
