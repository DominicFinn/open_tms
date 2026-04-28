import * as React from 'react';
import {
  LayoutDashboard,
  Truck,
  PackageOpen,
  Map,
  Users,
  ScrollText,
  Receipt,
  AlertTriangle,
  Settings,
  Boxes,
  Plug,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { Logo } from '@/components/brand/logo';
import { Separator } from '@/components/ui/separator';

export type RouteKey =
  | 'dashboard'
  | 'shipments'
  | 'shipment-detail'
  | 'create-shipment'
  | 'orders'
  | 'carriers'
  | 'lanes'
  | 'invoices'
  | 'issues'
  | 'integrations'
  | 'settings';

interface AppSidebarProps {
  active: RouteKey;
  onNavigate: (route: RouteKey) => void;
}

interface NavItem {
  key: RouteKey;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
}

const SECTIONS: { title: string; items: NavItem[] }[] = [
  {
    title: 'Operations',
    items: [
      { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { key: 'shipments', label: 'Shipments', icon: Truck, badge: '24' },
      { key: 'orders', label: 'Orders', icon: PackageOpen },
      { key: 'lanes', label: 'Lanes', icon: Map },
      { key: 'carriers', label: 'Carriers', icon: Users },
    ],
  },
  {
    title: 'Finance',
    items: [
      { key: 'invoices', label: 'Invoices', icon: Receipt },
      { key: 'issues', label: 'Triage', icon: AlertTriangle, badge: '3' },
    ],
  },
  {
    title: 'System',
    items: [
      { key: 'integrations', label: 'Integrations', icon: Plug },
      { key: 'settings', label: 'Settings', icon: Settings },
    ],
  },
];

export function AppSidebar({ active, onNavigate }: AppSidebarProps) {
  return (
    <aside className="flex h-screen w-64 shrink-0 flex-col border-r border-border bg-card">
      <div className="flex h-16 items-center px-5">
        <Logo size="md" />
      </div>
      <Separator />
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {SECTIONS.map((section, idx) => (
          <div key={section.title} className={cn(idx > 0 && 'mt-6')}>
            <div className="px-3 pb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {section.title}
            </div>
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const Icon = item.icon;
                const isActive =
                  active === item.key ||
                  (item.key === 'shipments' &&
                    (active === 'shipment-detail' || active === 'create-shipment'));
                return (
                  <li key={item.key}>
                    <button
                      type="button"
                      onClick={() => onNavigate(item.key)}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                        isActive
                          ? 'bg-primary/10 text-primary'
                          : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground',
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      <span className="flex-1 text-left">{item.label}</span>
                      {item.badge && (
                        <span
                          className={cn(
                            'rounded-full px-2 py-0.5 text-[10px] font-semibold',
                            isActive
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted text-muted-foreground',
                          )}
                        >
                          {item.badge}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
      <Separator />
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-gradient text-sm font-semibold text-white">
          DF
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">Dom Finn</div>
          <div className="truncate text-xs text-muted-foreground">dom@opentms.dev</div>
        </div>
        <Boxes className="h-4 w-4 text-muted-foreground" />
      </div>
    </aside>
  );
}
