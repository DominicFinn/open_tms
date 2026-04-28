import * as React from 'react';

import { AppShell } from '@/components/app/app-shell';
import type { RouteKey } from '@/components/app/app-sidebar';
import { DashboardPage } from '@/pages/dashboard';
import { ShipmentsListPage } from '@/pages/shipments-list';
import { ShipmentDetailPage } from '@/pages/shipment-detail';
import { CreateShipmentPage } from '@/pages/create-shipment';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function App() {
  const [route, setRoute] = React.useState<RouteKey>('dashboard');
  const [theme, setTheme] = React.useState<'light' | 'dark'>('dark');

  React.useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  const toggleTheme = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'));

  let content: React.ReactNode;
  switch (route) {
    case 'dashboard':
      content = <DashboardPage />;
      break;
    case 'shipments':
      content = <ShipmentsListPage onNavigate={setRoute} />;
      break;
    case 'shipment-detail':
      content = <ShipmentDetailPage onNavigate={setRoute} />;
      break;
    case 'create-shipment':
      content = <CreateShipmentPage onNavigate={setRoute} />;
      break;
    default:
      content = <Placeholder route={route} />;
  }

  return (
    <AppShell active={route} onNavigate={setRoute} theme={theme} onToggleTheme={toggleTheme}>
      {content}
    </AppShell>
  );
}

function Placeholder({ route }: { route: RouteKey }) {
  const titles: Record<RouteKey, string> = {
    dashboard: 'Dashboard',
    shipments: 'Shipments',
    'shipment-detail': 'Shipment',
    'create-shipment': 'New shipment',
    orders: 'Orders',
    carriers: 'Carriers',
    lanes: 'Lanes',
    invoices: 'Invoices',
    issues: 'Triage',
    integrations: 'Integrations',
    settings: 'Settings',
  };
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">{titles[route]}</h1>
      <Card>
        <CardHeader>
          <CardTitle>Not in this preview</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          This sample wires up Dashboard, Shipments list, Shipment detail, and Create
          shipment. Other surfaces follow the same pattern: shadcn primitives, brand tokens
          via CSS variables, no custom CSS layer.
        </CardContent>
      </Card>
    </div>
  );
}
