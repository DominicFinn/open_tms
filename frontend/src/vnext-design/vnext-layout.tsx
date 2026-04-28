import React, { useState, useEffect, useRef } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  AlarmClock,
  AlertTriangle,
  ArrowDownToLine,
  BadgeCheck,
  BarChart3,
  Bell,
  Bot,
  Boxes,
  Brain,
  Bug,
  Calendar,
  ClipboardCheck,
  ClipboardList,
  Clock,
  CreditCard,
  DollarSign,
  Download,
  FileSpreadsheet,
  FileText,
  GitBranch,
  Grid3x3,
  Handshake,
  HelpCircle,
  Hourglass,
  Network,
  Inbox,
  Key,
  Landmark,
  LayoutDashboard,
  LayoutGrid,
  ListChecks,
  Locate,
  LogOut,
  Mail,
  MailCheck,
  Map as MapIcon,
  MapPin,
  Menu,
  Moon,
  Package,
  Palette,
  RefreshCcw,
  Receipt,
  Route,
  Ruler,
  Scale,
  Search,
  Settings as SettingsIcon,
  Shield,
  ShoppingCart,
  SlidersHorizontal,
  StickyNote,
  Sun,
  SunMoon,
  Tags,
  Thermometer,
  Timer,
  TrendingUp,
  Truck,
  Undo2,
  Upload,
  Users,
  Warehouse as WarehouseIcon,
  Waves,
  Webhook,
  Wrench,
  Zap,
  type LucideIcon,
} from 'lucide-react';

import { ErrorBoundary } from '../components/ErrorBoundary';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { logout } from '../authFetch';
import { Logo } from '@/components/brand/Logo';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

/* ── Theme mode ─────────────────────────────────────── */
function useThemeMode() {
  const [mode, setMode] = useState<'light' | 'dark' | 'system'>(() => {
    return (localStorage.getItem('theme-mode') as 'light' | 'dark' | 'system') || 'system';
  });

  useEffect(() => {
    const root = document.documentElement;
    if (mode === 'system') {
      root.removeAttribute('data-theme');
      localStorage.removeItem('theme-mode');
    } else {
      root.setAttribute('data-theme', mode);
      localStorage.setItem('theme-mode', mode);
    }
  }, [mode]);

  const cycle = () =>
    setMode(prev => (prev === 'light' ? 'dark' : prev === 'dark' ? 'system' : 'light'));

  const Icon = mode === 'light' ? Sun : mode === 'dark' ? Moon : SunMoon;
  const label = mode === 'light' ? 'Light' : mode === 'dark' ? 'Dark' : 'System';

  return { cycle, Icon, label };
}

/* ── App definitions ─────────────────────────────────── */
interface NavItem {
  to: string;
  icon: LucideIcon;
  label: string;
  end?: boolean;
  badge?: string;
}

interface AppDef {
  key: string;
  icon: LucideIcon;
  label: string;
  basePath: string;
  sections: { title: string; items: NavItem[] }[];
}

const APPS: AppDef[] = [
  {
    key: 'operations', icon: Truck, label: 'Operations', basePath: '/',
    sections: [
      { title: 'Operations', items: [
        { to: '/', icon: LayoutDashboard, label: 'Dashboard', end: true },
        { to: '/map', icon: MapIcon, label: 'Map View' },
        { to: '/sla', icon: Timer, label: 'SLA Dashboard' },
        { to: '/shipments', icon: Truck, label: 'Shipments' },
        { to: '/orders', icon: FileText, label: 'Orders' },
        { to: '/issues', icon: Bug, label: 'Issues' },
        { to: '/agent-decisions', icon: Bot, label: 'Agent Decisions' },
        { to: '/automation-rules', icon: Zap, label: 'Automation Rules' },
        { to: '/devices', icon: Locate, label: 'Devices' },
      ]},
      { title: 'Network', items: [
        { to: '/loadboard', icon: LayoutGrid, label: 'Load Board' },
        { to: '/carriers', icon: Truck, label: 'Carriers' },
        { to: '/carrier-bidding', icon: Handshake, label: 'Carrier Bidding' },
        { to: '/customers', icon: Users, label: 'Customers' },
        { to: '/locations', icon: MapPin, label: 'Locations' },
        { to: '/lanes', icon: Route, label: 'Lanes' },
      ]},
      { title: 'Cold Chain', items: [
        { to: '/cold-chain/profiles', icon: Thermometer, label: 'Profiles' },
        { to: '/cold-chain/capa', icon: AlertTriangle, label: 'CAPA Reports' },
      ]},
    ],
  },
  {
    key: 'reports', icon: BarChart3, label: 'Reports', basePath: '/reports',
    sections: [
      { title: 'Overview', items: [
        { to: '/reports', icon: LayoutDashboard, label: 'Dashboard', end: true },
      ]},
      { title: 'Operational', items: [
        { to: '/reports/daily', icon: Calendar, label: 'Daily Report' },
        { to: '/reports/locations', icon: MapPin, label: 'Location Activity' },
        { to: '/sla', icon: Timer, label: 'SLA Compliance' },
      ]},
      { title: 'Financial', items: [
        { to: '/finance/margin-reports', icon: TrendingUp, label: 'Margin Reports' },
        { to: '/finance/aging', icon: Hourglass, label: 'AR Aging' },
        { to: '/finance/exports', icon: Download, label: 'Export to CSV' },
      ]},
      { title: 'Documents', items: [
        { to: '/documents', icon: FileText, label: 'Documents' },
      ]},
    ],
  },
  {
    key: 'finance', icon: Landmark, label: 'Finance', basePath: '/finance',
    sections: [
      { title: 'Finance', items: [
        { to: '/finance', icon: LayoutDashboard, label: 'Dashboard', end: true },
        { to: '/finance/quotes', icon: FileSpreadsheet, label: 'Quotes' },
        { to: '/finance/invoices', icon: Receipt, label: 'Invoices' },
        { to: '/finance/carrier-invoices', icon: Truck, label: 'Carrier Invoices' },
        { to: '/finance/payments', icon: CreditCard, label: 'Record Payments' },
      ]},
      { title: 'Brokerage', items: [
        { to: '/finance/commissions', icon: DollarSign, label: 'Commissions' },
        { to: '/finance/margin-reports', icon: TrendingUp, label: 'Margin Reports' },
      ]},
      { title: 'Disputes', items: [
        { to: '/finance/queries', icon: HelpCircle, label: 'Queries & Disputes' },
        { to: '/finance/credit-notes', icon: StickyNote, label: 'Credit Notes' },
      ]},
      { title: 'Reports', items: [
        { to: '/finance/aging', icon: BarChart3, label: 'AR Aging' },
        { to: '/finance/exports', icon: Download, label: 'Export to CSV' },
      ]},
    ],
  },
  {
    key: 'quality', icon: BadgeCheck, label: 'Quality', basePath: '/quality',
    sections: [
      { title: 'Quality Centre', items: [
        { to: '/quality', icon: LayoutDashboard, label: 'Dashboard', end: true },
        { to: '/quality/summaries', icon: BarChart3, label: 'Issue Analysis' },
        { to: '/quality/capa', icon: AlertTriangle, label: 'CAPA Management' },
        { to: '/quality/sop-checklists', icon: ListChecks, label: 'SOP Checklists' },
        { to: '/quality/sop-audits', icon: ClipboardCheck, label: 'GDP Audits' },
      ]},
      { title: 'Reports', items: [
        { to: '/quality/carrier-scorecard', icon: Truck, label: 'Carrier Scorecard' },
        { to: '/quality/lane-analysis', icon: Route, label: 'Lane Analysis' },
        { to: '/quality/capa-effectiveness', icon: TrendingUp, label: 'CAPA Effectiveness' },
      ]},
    ],
  },
  {
    key: 'warehouse', icon: WarehouseIcon, label: 'Warehouse', basePath: '/wms',
    sections: [
      { title: 'Warehouse', items: [
        { to: '/wms', icon: LayoutDashboard, label: 'Dashboard', end: true },
        { to: '/wms/operations', icon: BarChart3, label: 'Operations KPIs' },
        { to: '/wms/zones', icon: LayoutGrid, label: 'Zones & Bins' },
        { to: '/wms/inventory', icon: Package, label: 'Inventory' },
        { to: '/wms/product-dimensions', icon: Ruler, label: 'Product Dimensions' },
        { to: '/wms/carton-catalogue', icon: Package, label: 'Carton Catalogue' },
        { to: '/wms/pallet-types', icon: Boxes, label: 'Pallet Types' },
        { to: '/wms/cycle-counts', icon: ClipboardCheck, label: 'Cycle Counts' },
        { to: '/wms/replenishment', icon: RefreshCcw, label: 'Replenishment' },
      ]},
      { title: 'Inbound', items: [
        { to: '/wms/receiving-appointments', icon: Calendar, label: 'Appointments' },
        { to: '/wms/receiving', icon: Inbox, label: 'Receiving' },
        { to: '/wms/manifest', icon: Upload, label: 'Manifest Upload' },
        { to: '/wms/putaway', icon: ArrowDownToLine, label: 'Putaway' },
      ]},
      { title: 'Outbound', items: [
        { to: '/wms/waves', icon: Waves, label: 'Waves' },
        { to: '/wms/picking', icon: ShoppingCart, label: 'Picking' },
        { to: '/wms/packing', icon: Package, label: 'Packing' },
        { to: '/wms/pack-audits', icon: Scale, label: 'Pack Audits' },
        { to: '/wms/loading', icon: Truck, label: 'Staging' },
        { to: '/wms/load-plans', icon: ClipboardCheck, label: 'Load Plans' },
        { to: '/wms/cutoff-monitor', icon: AlarmClock, label: 'Cutoff At Risk' },
        { to: '/wms/carrier-cutoffs', icon: Clock, label: 'Carrier Cutoffs' },
      ]},
      { title: 'Reverse Logistics', items: [
        { to: '/wms/returns', icon: Undo2, label: 'Returns / RMA' },
        { to: '/wms/returns/refund-review', icon: Landmark, label: 'Refund Review' },
      ]},
    ],
  },
  {
    key: 'integrations', icon: Network, label: 'Integrations', basePath: '/integrations',
    sections: [
      { title: 'Integrations', items: [
        { to: '/integrations', icon: LayoutDashboard, label: 'Overview', end: true },
        { to: '/integrations/api-keys', icon: Key, label: 'API Keys' },
        { to: '/integrations/webhook-logs', icon: Webhook, label: 'Webhook Logs' },
        { to: '/integrations/edi', icon: Network, label: 'EDI Dashboard' },
        { to: '/integrations/edi/partners', icon: Handshake, label: 'Trading Partners' },
        { to: '/integrations/edi/logs', icon: ClipboardList, label: 'Transaction Log' },
        { to: '/integrations/edi/import', icon: Upload, label: 'EDI Import' },
        { to: '/integrations/carrier-tracking', icon: Locate, label: 'Carrier Tracking' },
      ]},
    ],
  },
  {
    key: 'admin', icon: Shield, label: 'Admin', basePath: '/settings',
    sections: [
      { title: 'Settings', items: [
        { to: '/settings', icon: SettingsIcon, label: 'General', end: true },
        { to: '/settings/theme', icon: Palette, label: 'Theme & Branding' },
        { to: '/settings/email', icon: Mail, label: 'Email' },
        { to: '/settings/email-templates', icon: MailCheck, label: 'Email Templates' },
        { to: '/settings/document-templates', icon: FileText, label: 'Doc Templates' },
        { to: '/settings/custom-fields', icon: SlidersHorizontal, label: 'Custom Fields' },
        { to: '/settings/shipment-types', icon: Tags, label: 'Shipment Types' },
        { to: '/settings/maps', icon: MapIcon, label: 'Maps & Geocoding' },
        { to: '/settings/sla', icon: Timer, label: 'SLA Policies' },
        { to: '/settings/llm', icon: Bot, label: 'AI / LLM' },
        { to: '/settings/agents', icon: Brain, label: 'Agent Config' },
        { to: '/settings/skills', icon: Wrench, label: 'Skills' },
        { to: '/settings/skill-chains', icon: GitBranch, label: 'Skill Chains' },
        { to: '/settings/roles', icon: Shield, label: 'Roles & Permissions' },
        { to: '/settings/users', icon: Users, label: 'Users' },
      ]},
      { title: 'Development', items: [
        { to: '/style-guide', icon: Palette, label: 'Style Guide' },
      ]},
    ],
  },
];

function detectApp(pathname: string): string {
  if (pathname.startsWith('/wms')) return 'warehouse';
  if (pathname.startsWith('/quality')) return 'quality';
  if (pathname.startsWith('/finance')) return 'finance';
  if (pathname.startsWith('/integrations')) return 'integrations';
  if (pathname.startsWith('/settings') || pathname === '/style-guide') return 'admin';
  if (pathname.startsWith('/documents') || pathname.startsWith('/reports')) return 'reports';
  return 'operations';
}

/* ── Layout ─────────────────────────────────────────── */
export default function VNextLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [appGridOpen, setAppGridOpen] = useState(false);
  const theme = useThemeMode();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useCurrentUser();

  const initials = user
    ? `${(user.firstName?.[0] || user.email[0] || '').toUpperCase()}${(user.lastName?.[0] || '').toUpperCase()}`
    : '';

  const activeAppKey = detectApp(location.pathname);
  const activeApp = APPS.find(a => a.key === activeAppKey) || APPS[0];

  const switchApp = (app: AppDef) => {
    setAppGridOpen(false);
    if (app.key !== activeAppKey) navigate(app.basePath);
  };

  const ThemeIcon = theme.Icon;

  return (
    <div className="flex min-h-screen bg-background text-foreground font-sans">
      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-64 shrink-0 flex-col border-r border-border bg-card transition-transform lg:static lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex h-16 items-center px-5">
          <Logo size="md" />
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
                        <span className="flex-1">{item.label}</span>
                        {item.badge && (
                          <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary">
                            {item.badge}
                          </span>
                        )}
                      </NavLink>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
      </aside>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main column */}
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

          <div className="relative max-w-md flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search shipments, orders, carriers..."
              className="pl-9"
            />
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              className="relative inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted/40 hover:text-foreground"
              aria-label="Notifications"
            >
              <Bell className="h-4 w-4" />
              <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-destructive ring-2 ring-background" />
            </button>

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
              onClick={theme.cycle}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted/40 hover:text-foreground"
              title={`Theme: ${theme.label}`}
              aria-label={`Theme: ${theme.label}`}
            >
              <ThemeIcon className="h-4 w-4" />
            </button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="ml-1 flex h-9 w-9 items-center justify-center rounded-full bg-brand-gradient text-xs font-semibold text-white"
                  title={user ? `${user.firstName} ${user.lastName}` : 'Account'}
                >
                  {initials || '?'}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                {user && (
                  <>
                    <DropdownMenuLabel className="font-normal">
                      <div className="text-sm font-semibold">
                        {user.firstName} {user.lastName}
                      </div>
                      <div className="text-xs text-muted-foreground">{user.email}</div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                  </>
                )}
                <DropdownMenuItem onClick={() => navigate('/settings/users')}>
                  <Users className="h-4 w-4" />
                  Manage users
                </DropdownMenuItem>
                <DropdownMenuItem onClick={logout}>
                  <LogOut className="h-4 w-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
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

      {/* App switcher */}
      <Dialog open={appGridOpen} onOpenChange={setAppGridOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Switch app</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
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
