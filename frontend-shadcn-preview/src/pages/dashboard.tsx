import * as React from 'react';
import {
  Truck,
  Package,
  AlertTriangle,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  CircleDot,
} from 'lucide-react';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { GradientText } from '@/components/brand/gradient-text';

interface Stat {
  label: string;
  value: string;
  delta: string;
  trend: 'up' | 'down';
  icon: React.ComponentType<{ className?: string }>;
  tone: 'primary' | 'accent' | 'success' | 'warning';
}

const STATS: Stat[] = [
  { label: 'Active shipments', value: '247', delta: '+12.4%', trend: 'up', icon: Truck, tone: 'primary' },
  { label: 'Orders today', value: '38', delta: '+5.1%', trend: 'up', icon: Package, tone: 'accent' },
  { label: 'On-time rate', value: '96.8%', delta: '+0.4 pts', trend: 'up', icon: TrendingUp, tone: 'success' },
  { label: 'Open exceptions', value: '11', delta: '-3', trend: 'down', icon: AlertTriangle, tone: 'warning' },
];

const TONE_CLASSES = {
  primary: 'bg-primary/10 text-primary',
  accent: 'bg-accent/15 text-accent',
  success: 'bg-success/15 text-success',
  warning: 'bg-warning/15 text-warning',
};

const RECENT = [
  { id: 'SHIP-1042', from: 'Chicago, IL', to: 'Atlanta, GA', status: 'In transit', tone: 'info' as const, eta: 'Today, 18:30' },
  { id: 'SHIP-1041', from: 'Dallas, TX', to: 'Miami, FL', status: 'Delivered', tone: 'success' as const, eta: 'Apr 27, 14:12' },
  { id: 'SHIP-1040', from: 'Seattle, WA', to: 'Denver, CO', status: 'Booked', tone: 'muted' as const, eta: 'Apr 29, 09:00' },
  { id: 'SHIP-1039', from: 'Boston, MA', to: 'Newark, NJ', status: 'Exception', tone: 'destructive' as const, eta: '2h delay' },
  { id: 'SHIP-1038', from: 'Phoenix, AZ', to: 'San Diego, CA', status: 'In transit', tone: 'info' as const, eta: 'Today, 22:00' },
];

export function DashboardPage() {
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
            Tuesday &middot; April 28
          </div>
          <h1 className="mt-2 text-4xl font-bold tracking-tight">
            Good afternoon, <GradientText>Dom</GradientText>.
          </h1>
          <p className="mt-2 text-muted-foreground">
            Here is what is moving across your network today.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">Export</Button>
          <Button variant="gradient">New shipment</Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {STATS.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${TONE_CLASSES[stat.tone]}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div
                    className={`flex items-center gap-1 text-xs font-semibold ${
                      stat.trend === 'up' ? 'text-success' : 'text-destructive'
                    }`}
                  >
                    {stat.trend === 'up' ? (
                      <ArrowUpRight className="h-3 w-3" />
                    ) : (
                      <ArrowDownRight className="h-3 w-3" />
                    )}
                    {stat.delta}
                  </div>
                </div>
                <div className="mt-4 text-3xl font-bold tracking-tight">{stat.value}</div>
                <div className="mt-1 text-sm text-muted-foreground">{stat.label}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Recent shipments</CardTitle>
              <CardDescription>Latest activity across all lanes.</CardDescription>
            </div>
            <Button variant="outline" size="sm">
              View all
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <Separator />
            <ul>
              {RECENT.map((row, idx) => (
                <li
                  key={row.id}
                  className={`flex items-center gap-4 px-6 py-4 ${idx > 0 ? 'border-t border-border' : ''}`}
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-md bg-muted">
                    <Truck className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-semibold">{row.id}</span>
                      <Badge variant={row.tone === 'destructive' ? 'destructive' : row.tone === 'success' ? 'success' : row.tone === 'info' ? 'info' : 'muted'}>
                        {row.status}
                      </Badge>
                    </div>
                    <div className="mt-1 truncate text-xs text-muted-foreground">
                      {row.from} <span className="px-1">&rarr;</span> {row.to}
                    </div>
                  </div>
                  <div className="text-right text-xs text-muted-foreground">{row.eta}</div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Triage queue</CardTitle>
            <CardDescription>Open exceptions waiting for review.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
              <div className="flex items-start gap-2">
                <CircleDot className="mt-0.5 h-3 w-3 shrink-0 text-destructive" />
                <div className="text-sm">
                  <div className="font-medium">Cold chain excursion - SHIP-1037</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    Reefer trailer briefly above 8&deg;C for 12 minutes.
                  </div>
                </div>
              </div>
            </div>
            <div className="rounded-lg border border-warning/30 bg-warning/5 p-3">
              <div className="flex items-start gap-2">
                <CircleDot className="mt-0.5 h-3 w-3 shrink-0 text-warning" />
                <div className="text-sm">
                  <div className="font-medium">SLA breach risk - SHIP-1029</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    Predicted ETA exceeds promised delivery by 47 minutes.
                  </div>
                </div>
              </div>
            </div>
            <div className="rounded-lg border border-info/30 bg-info/5 p-3">
              <div className="flex items-start gap-2">
                <CircleDot className="mt-0.5 h-3 w-3 shrink-0 text-info" />
                <div className="text-sm">
                  <div className="font-medium">Route deviation - SHIP-1031</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    Driver 6.2 km outside planned corridor near Memphis.
                  </div>
                </div>
              </div>
            </div>
            <Button variant="outline" className="w-full">
              Open triage board
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
