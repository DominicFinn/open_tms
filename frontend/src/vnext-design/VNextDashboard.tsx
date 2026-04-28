import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  Download,
  ExternalLink,
  Info,
  Loader2,
  Package,
  Percent,
  Plus,
  Truck,
} from 'lucide-react';

import { API_URL } from '../api';
import { GradientText } from '@/components/brand/GradientText';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

interface Shipment {
  id: string;
  status?: string;
  referenceNumber?: string;
  originCity?: string;
  originState?: string;
  destinationCity?: string;
  destinationState?: string;
}

interface Order {
  id: string;
  status?: string;
}

interface Issue {
  id: string;
  title?: string;
  status?: string;
  priority?: string;
  sourceEntityId?: string;
  createdAt?: string;
}

interface SlaSummary {
  active: number;
  warning: number;
  breached: number;
  met: number;
  total: number;
}

const STATUS_VARIANT = {
  delivered: 'success',
  in_transit: 'info',
  pickup: 'warning',
  picked_up: 'warning',
  booked: 'muted',
} as const;

const STATUS_LABEL: Record<string, string> = {
  delivered: 'Delivered',
  in_transit: 'In transit',
  pickup: 'Pickup',
  picked_up: 'Pickup',
  booked: 'Booked',
};

function statusToBadge(status?: string) {
  if (!status) return { label: 'Unknown', variant: 'muted' as const };
  const variant = (STATUS_VARIANT as Record<string, string>)[status] ?? 'muted';
  const label = STATUS_LABEL[status] ?? status;
  return { label, variant: variant as 'success' | 'info' | 'warning' | 'muted' };
}

function relativeTime(iso?: string): string {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function VNextDashboard() {
  const navigate = useNavigate();
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [activeIssues, setActiveIssues] = useState<Issue[]>([]);
  const [slaSummary, setSlaSummary] = useState<SlaSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function fetchData() {
      try {
        const [shipRes, ordRes] = await Promise.all([
          fetch(`${API_URL}/api/v1/shipments`),
          fetch(`${API_URL}/api/v1/orders`),
        ]);
        if (!shipRes.ok) throw new Error('Failed to load shipments');
        if (!ordRes.ok) throw new Error('Failed to load orders');
        const shipJson = await shipRes.json();
        const ordJson = await ordRes.json();
        if (!cancelled) {
          setShipments(shipJson.data || []);
          setOrders(ordJson.data || []);
        }
        fetch(`${API_URL}/api/v1/issues`)
          .then(r => r.json())
          .then(json => {
            if (!cancelled) {
              const issues = (json.data || [])
                .filter((i: Issue) => i.status === 'open' || i.status === 'in_progress')
                .slice(0, 5);
              setActiveIssues(issues);
            }
          })
          .catch(() => {});
        fetch(`${API_URL}/api/v1/sla/evaluations/summary`)
          .then(r => r.json())
          .then(json => {
            if (!cancelled) setSlaSummary(json.data || null);
          })
          .catch(() => {});
      } catch (e: any) {
        if (!cancelled) setError(e.message || 'Failed to load data');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchData();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-3 py-24 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin" />
        <h3 className="text-lg font-medium">Loading...</h3>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-3 py-24 text-destructive">
        <CircleAlert className="h-8 w-8" />
        <h3 className="text-lg font-medium">Error</h3>
        <p className="text-sm text-muted-foreground">{error}</p>
      </div>
    );
  }

  const activeShipments = shipments.filter(s => s.status !== 'delivered' && s.status !== 'cancelled');
  const inTransit = shipments.filter(s => s.status === 'in_transit');
  const delivered = shipments.filter(s => s.status === 'delivered');
  const pendingOrders = orders.filter(o => o.status === 'pending' || o.status === 'new');
  const onTimeRate = (((delivered.length / (delivered.length || 1)) * 100)).toFixed(1);
  const recentShipments = shipments.slice(0, 5);
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  const stats = [
    { label: 'Active shipments', value: activeShipments.length, icon: Truck, tone: 'primary', onClick: () => navigate('/shipments') },
    { label: 'Pending orders', value: pendingOrders.length, icon: Package, tone: 'accent', onClick: () => navigate('/orders') },
    { label: 'In transit', value: inTransit.length, icon: Truck, tone: 'warning', onClick: () => navigate('/shipments') },
    { label: 'Delivered', value: delivered.length, icon: CheckCircle2, tone: 'success', onClick: () => navigate('/shipments') },
    { label: 'On-time delivery', value: `${onTimeRate}%`, icon: Percent, tone: 'success' },
  ];

  const tones = {
    primary: 'bg-primary/10 text-primary',
    accent: 'bg-accent/15 text-accent',
    success: 'bg-success/15 text-success',
    warning: 'bg-warning/15 text-warning',
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">{today}</div>
          <h1 className="mt-2 text-4xl font-bold tracking-tight">
            <GradientText>Dashboard</GradientText>
          </h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Download className="h-4 w-4" />
            Export
          </Button>
          <Button variant="gradient" onClick={() => navigate('/shipments/create')}>
            <Plus className="h-4 w-4" />
            New shipment
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {stats.map(stat => {
          const Icon = stat.icon;
          const Wrapper = stat.onClick ? 'button' : 'div';
          return (
            <Card key={stat.label} asChild={false} className={stat.onClick ? 'cursor-pointer transition-colors hover:border-primary/40' : ''}>
              <Wrapper
                {...(stat.onClick ? { type: 'button' as const, onClick: stat.onClick } : {})}
                className="block w-full text-left"
              >
                <CardContent className="p-6">
                  <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg', tones[stat.tone as keyof typeof tones])}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="mt-4 text-3xl font-bold tracking-tight">{stat.value}</div>
                  <div className="mt-1 text-sm text-muted-foreground">{stat.label}</div>
                </CardContent>
              </Wrapper>
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
            <Button variant="outline" size="sm" onClick={() => navigate('/shipments')}>
              View all
              <ArrowRight className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <Separator />
            {recentShipments.length === 0 ? (
              <div className="px-6 py-12 text-center text-sm text-muted-foreground">
                No shipments found
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Shipment</TableHead>
                    <TableHead>Route</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentShipments.map(s => {
                    const badge = statusToBadge(s.status);
                    const origin = s.originCity && s.originState ? `${s.originCity}, ${s.originState}` : s.originCity || 'N/A';
                    const dest = s.destinationCity && s.destinationState ? `${s.destinationCity}, ${s.destinationState}` : s.destinationCity || 'N/A';
                    return (
                      <TableRow
                        key={s.id}
                        onClick={() => navigate(`/shipments/${s.id}`)}
                        className="cursor-pointer"
                      >
                        <TableCell className="font-mono text-sm font-semibold">
                          {s.referenceNumber || `SHP-${s.id}`}
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">{origin}</div>
                          <div className="text-xs text-muted-foreground">to {dest}</div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={badge.variant}>{badge.label}</Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Active issues</CardTitle>
              <CardDescription>Open exceptions waiting for review.</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => navigate('/issues')}>
              View board
              <ArrowRight className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {activeIssues.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">No active issues</div>
            ) : (
              activeIssues.map(issue => {
                const sev = (() => {
                  if (issue.priority === 'critical' || issue.priority === 'high') return 'destructive';
                  if (issue.priority === 'medium') return 'warning';
                  return 'info';
                })();
                const tone = {
                  destructive: 'border-destructive/30 bg-destructive/5 text-destructive',
                  warning: 'border-warning/30 bg-warning/5 text-warning',
                  info: 'border-info/30 bg-info/5 text-info',
                }[sev];
                const SevIcon = sev === 'destructive' ? AlertTriangle : sev === 'warning' ? AlertTriangle : Info;
                return (
                  <button
                    key={issue.id}
                    type="button"
                    onClick={() => navigate(`/issues/${issue.id}`)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-md border p-3 text-left transition-colors',
                      tone,
                    )}
                  >
                    <SevIcon className="h-4 w-4 shrink-0" />
                    <div className="flex-1">
                      <div className="text-sm font-medium text-foreground">{issue.title}</div>
                      <div className="text-xs text-muted-foreground">
                        {issue.sourceEntityId || 'N/A'} &middot; {relativeTime(issue.createdAt)}
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </button>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>

      {slaSummary && slaSummary.total > 0 && (
        <Card className="cursor-pointer transition-colors hover:border-primary/40" onClick={() => navigate('/sla')}>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>SLA health</CardTitle>
            <ExternalLink className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-4 text-center">
              {[
                { label: 'Active', value: slaSummary.active, color: 'text-info' },
                { label: 'Warning', value: slaSummary.warning, color: 'text-warning' },
                { label: 'Breached', value: slaSummary.breached, color: 'text-destructive' },
                { label: 'Met', value: slaSummary.met, color: 'text-success' },
              ].map(s => (
                <div key={s.label}>
                  <div className={cn('text-3xl font-bold tracking-tight', s.color)}>{s.value}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{s.label}</div>
                </div>
              ))}
            </div>
            {slaSummary.breached > 0 && (
              <div className="mt-4 flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                <AlertTriangle className="h-4 w-4" />
                {slaSummary.breached} SLA{slaSummary.breached > 1 ? 's' : ''} breached - click to view details
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Delivery performance - this week</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {(() => {
            const total = shipments.length || 1;
            const otherCount = total - delivered.length - inTransit.length;
            return [
              { label: 'Delivered', count: delivered.length, pct: parseFloat(((delivered.length / total) * 100).toFixed(1)), tone: 'bg-success' },
              { label: 'In transit', count: inTransit.length, pct: parseFloat(((inTransit.length / total) * 100).toFixed(1)), tone: 'bg-warning' },
              { label: 'Other', count: otherCount, pct: parseFloat(((otherCount / total) * 100).toFixed(1)), tone: 'bg-destructive' },
            ];
          })().map(row => (
            <div key={row.label}>
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="font-medium">{row.label}</span>
                <span className="text-muted-foreground">{row.count} shipments ({row.pct}%)</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div className={cn('h-full rounded-full', row.tone)} style={{ width: `${row.pct}%` }} />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
