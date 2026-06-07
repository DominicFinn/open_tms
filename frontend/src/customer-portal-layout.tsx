import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Building2,
  Bug,
  Code,
  Cable,
  FileSpreadsheet,
  FileText,
  Grid3x3,
  History,
  Key,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Truck,
  Undo2,
  User,
  Webhook,
  type LucideIcon,
} from 'lucide-react';

import { ErrorBoundary } from './components/ErrorBoundary';
import { clearCustomerSession, getCustomerUser } from './pages/customer-portal/customerSession';
import { Logo } from '@/components/brand/Logo';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

interface CpNavItem {
  to: string;
  icon: LucideIcon;
  label: string;
  end?: boolean;
}

interface CpAppDef {
  key: string;
  icon: LucideIcon;
  label: string;
  basePath: string;
  sections: { title: string; items: CpNavItem[] }[];
}

const APPS: CpAppDef[] = [
  {
    key: 'portal', icon: Building2, label: 'Customer Portal', basePath: '/customer-portal',
    sections: [
      { title: 'Overview', items: [
        { to: '/customer-portal', icon: LayoutDashboard, label: 'Dashboard', end: true },
      ]},
      { title: 'Operations', items: [
        { to: '/customer-portal/orders', icon: Package, label: 'Orders' },
        { to: '/customer-portal/shipments', icon: Truck, label: 'Shipments' },
        { to: '/customer-portal/issues', icon: Bug, label: 'Issues' },
        { to: '/customer-portal/returns', icon: Undo2, label: 'Returns' },
      ]},
      { title: 'Finance & Docs', items: [
        { to: '/customer-portal/invoices', icon: FileSpreadsheet, label: 'Invoices' },
        { to: '/customer-portal/documents', icon: FileText, label: 'Documents' },
      ]},
      { title: 'Account', items: [
        { to: '/customer-portal/profile', icon: User, label: 'Profile' },
      ]},
    ],
  },
  {
    key: 'developer', icon: Code, label: 'Developer', basePath: '/customer-portal/developer',
    sections: [
      { title: 'Overview', items: [
        { to: '/customer-portal/developer', icon: LayoutDashboard, label: 'Dashboard', end: true },
      ]},
      { title: 'Access', items: [
        { to: '/customer-portal/developer/api-keys', icon: Key, label: 'API Keys' },
        { to: '/customer-portal/developer/webhooks', icon: Webhook, label: 'Webhooks' },
      ]},
      { title: 'Integrations', items: [
        { to: '/customer-portal/developer/edi', icon: Cable, label: 'EDI Setup' },
        { to: '/customer-portal/developer/logs', icon: History, label: 'Integration Logs' },
      ]},
    ],
  },
];

function detectApp(pathname: string): string {
  if (pathname.startsWith('/customer-portal/developer')) return 'developer';
  return 'portal';
}

interface PortalUser {
  email?: string;
  customerName?: string;
}

export function CustomerPortalLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [appGridOpen, setAppGridOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const [user, setUser] = useState<PortalUser | null>(null);

  useEffect(() => {
    const u = getCustomerUser();
    if (!u) {
      navigate('/customer-portal/login');
      return;
    }
    setUser(u);
  }, [navigate]);

  const activeAppKey = detectApp(location.pathname);
  const activeApp = APPS.find(a => a.key === activeAppKey) || APPS[0];

  const switchApp = (app: CpAppDef) => {
    setAppGridOpen(false);
    if (app.key !== activeAppKey) navigate(app.basePath);
  };

  const handleLogout = () => {
    clearCustomerSession();
    navigate('/customer-portal/login');
  };

  if (!user) return null;

  const initials = (user.email || '?').slice(0, 2).toUpperCase();
  const ActiveAppIcon = activeApp.icon;

  return (
    <div className="flex min-h-screen bg-background text-foreground font-sans">
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-64 shrink-0 flex-col border-r border-border bg-card transition-transform lg:static lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex h-16 items-center gap-3 px-5 text-lg font-bold tracking-tight">
          <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-primary text-primary-foreground">
            <ActiveAppIcon className="h-5 w-5" />
          </span>
          {activeApp.label}
        </div>
        <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
          {activeApp.sections.map(section => (
            <div key={section.title}>
              <div className="px-3 pb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {section.title}
              </div>
              <ul className="space-y-0.5">
                {section.items.map(item => {
                  const ItemIcon = item.icon;
                  return (
                    <li key={item.to}>
                      <NavLink
                        to={item.to}
                        end={item.end}
                        onClick={() => setSidebarOpen(false)}
                        className={({ isActive }) =>
                          cn(
                            'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                            isActive
                              ? 'bg-primary/10 text-primary'
                              : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground',
                          )
                        }
                      >
                        <ItemIcon className="h-4 w-4" />
                        {item.label}
                      </NavLink>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
      </aside>

      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className="flex min-h-screen flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur md:px-6">
          <button
            type="button"
            onClick={() => setSidebarOpen(o => !o)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted/40 hover:text-foreground lg:hidden"
            aria-label="Toggle sidebar"
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="ml-auto flex items-center gap-2">
            <span className="hidden text-xs text-muted-foreground sm:inline">
              {user.customerName || user.email}
            </span>
            <button
              type="button"
              onClick={() => setAppGridOpen(true)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted/40 hover:text-foreground"
              aria-label="Switch app"
              title="Switch app"
            >
              <Grid3x3 className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted/40 hover:text-foreground"
              aria-label="Logout"
              title="Logout"
            >
              <LogOut className="h-4 w-4" />
            </button>
            <span className="ml-1 flex h-9 w-9 items-center justify-center rounded-full bg-brand-gradient text-xs font-semibold text-white">
              {initials}
            </span>
          </div>
        </header>

        <main className="flex-1 px-4 py-6 md:px-8 md:py-8">
          <div className="mx-auto max-w-[1440px]">
            <ErrorBoundary>
              <Outlet />
            </ErrorBoundary>
          </div>
        </main>
      </div>

      <Dialog open={appGridOpen} onOpenChange={setAppGridOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Switch app</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            {APPS.map(app => {
              const AppIcon = app.icon;
              const isActive = app.key === activeAppKey;
              return (
                <button
                  key={app.key}
                  type="button"
                  onClick={() => switchApp(app)}
                  className={cn(
                    'flex flex-col items-center gap-3 rounded-lg border p-5 transition-colors',
                    isActive
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:border-primary/40 hover:bg-muted/40',
                  )}
                >
                  <span
                    className={cn(
                      'flex h-12 w-12 items-center justify-center rounded-lg',
                      isActive ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground',
                    )}
                  >
                    <AppIcon className="h-6 w-6" />
                  </span>
                  <span className="text-sm font-semibold">{app.label}</span>
                </button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
