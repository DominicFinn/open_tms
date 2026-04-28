import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import {
  Handshake,
  Network,
  Key,
  LayoutDashboard,
  Locate,
  ClipboardList,
  Upload,
  Webhook,
  type LucideIcon,
} from 'lucide-react';

import { ErrorBoundary } from '../components/ErrorBoundary';
import { cn } from '@/lib/utils';

interface Tab {
  to: string;
  label: string;
  icon: LucideIcon;
  end: boolean;
}

const TABS: Tab[] = [
  { to: '/integrations', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/integrations/api-keys', label: 'API Keys', icon: Key, end: false },
  { to: '/integrations/webhook-logs', label: 'Webhooks', icon: Webhook, end: false },
  { to: '/integrations/edi', label: 'EDI Dashboard', icon: Network, end: true },
  { to: '/integrations/edi/partners', label: 'Trading Partners', icon: Handshake, end: false },
  { to: '/integrations/edi/logs', label: 'Transaction Log', icon: ClipboardList, end: false },
  { to: '/integrations/edi/import', label: 'EDI Import', icon: Upload, end: false },
  { to: '/integrations/carrier-tracking', label: 'Carrier Tracking', icon: Locate, end: false },
];

export default function VNextIntegrationsLayout() {
  return (
    <>
      <div className="mb-6 flex flex-wrap items-center gap-1 border-b border-border">
        {TABS.map(tab => {
          const Icon = tab.icon;
          return (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.end}
              className={({ isActive }) =>
                cn(
                  'inline-flex items-center gap-2 px-3 py-2 text-sm font-medium transition-colors -mb-px border-b-2',
                  isActive
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground',
                )
              }
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </NavLink>
          );
        })}
      </div>
      <ErrorBoundary>
        <Outlet />
      </ErrorBoundary>
    </>
  );
}
