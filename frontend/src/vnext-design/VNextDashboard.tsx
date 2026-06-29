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
  Inbox,
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
  reference?: string;
  originCity?: string;
  originState?: string;
  destinationCity?: string;
  destinationState?: string;
  createdAt?: string;
}

interface Order {
  id: string;
  status?: string;
  deliveryStatus?: string;
  deliveredAt?: string | null;
  requestedDeliveryDate?: string | null;
  createdAt?: string;
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

// Monday 00:00 (local) of the week containing `d`.
function startOfWeek(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const day = x.getDay(); // 0=Sun .. 6=Sat
  x.setDate(x.getDate() + (day === 0 ? -6 : 1 - day));
  return x;
}

function inRange(iso: string | null | undefined, from: Date, to: Date): boolean {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return t >= from.getTime() && t <= to.getTime();
}

export default function VNextDashboard() {
  const navigate = useNavigate();
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
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
            if (!cancelled) setIssues(json.data || []);
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

  // ── This-week window (Monday 00:00 → now) ──────────────────────────────
  const now = new Date();
  const weekStart = startOfWeek(now);
  const weekEnd = new Date(startOfWeek(now).getTime() + 7 * 86400000 - 1); // Sunday 23:59:59.999

  const shipmentsThisWeek = shipments.filter(s => inRange(s.createdAt, weekStart, now));
  const ordersThisWeek = orders.filter(o => inRange(o.createdAt, weekStart, now));
  const inTransitThisWeek = shipmentsThisWeek.filter(s => s.status === 'in_transit');
  const deliveredThisWeek = orders.filter(o => inRange(o.deliveredAt, weekStart, now));
  const exceptionsThisWeek = issues.filter(i => inRange(i.createdAt, weekStart, now));

  // Open issues are a standing worklist, not week-scoped — keep showing current ones.
  const activeIssues = issues
    .filter(i => i.status === 'open' || i.status === 'in_progress')
    .slice(0, 5);

  // Real on-time rate: of orders delivered THIS WEEK with a requested date,
  // the share that arrived on or before that date. Null when nothing measurable yet.
  const measurableDeliveries = deliveredThisWeek.filter(o => o.requestedDeliveryDate);
  const onTimeCount = measurableDeliveries.filter(
    o => new Date(o.deliveredAt!).getTime() <= new Date(o.requestedDeliveryDate!).getTime(),
  ).length;
  const onTimeRate = measurableDeliveries.length > 0
    ? ((onTimeCount / measurableDeliveries.length) * 100).toFixed(1)
    : null;
  const onTimeTone = onTimeRate === null
    ? 'primary'
    : parseFloat(onTimeRate) >= 95 ? 'success' : parseFloat(onTimeRate) >= 85 ? 'warning' : 'danger';

  const recentShipments = [...shipmentsThisWeek]
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
    .slice(0, 5);

  const fmtDay = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const weekLabel = `This week · ${fmtDay(weekStart)} – ${fmtDay(weekEnd)}`;

  // No real activity this week → frosted "awaiting data" view rather than a wall of zeros.
  const noActivityThisWeek =
    shipmentsThisWeek.length === 0 &&
    ordersThisWeek.length === 0 &&
    deliveredThisWeek.length === 0 &&
    exceptionsThisWeek.length === 0;

  const stats = [
    { label: 'Shipments created', value: shipmentsThisWeek.length, icon: Truck, tone: 'primary', onClick: () => navigate('/shipments') },
    { label: 'Orders created', value: ordersThisWeek.length, icon: Package, tone: 'accent', onClick: () => navigate('/orders') },
    { label: 'In transit', value: inTransitThisWeek.length, icon: Truck, tone: 'warning', onClick: () => navigate('/shipments') },
    { label: 'Delivered', value: deliveredThisWeek.length, icon: CheckCircle2, tone: 'success', onClick: () => navigate('/orders') },
    { label: 'On-time delivery', value: onTimeRate === null ? '—' : `${onTimeRate}%`, icon: Percent, tone: onTimeTone },
  ];

  const tones = {
    primary: 'bg-primary/10 text-primary',
    accent: 'bg-accent/15 text-accent',
    success: 'bg-success/15 text-success',
    warning: 'bg-warning/15 text-warning',
    danger: 'bg-destructive/15 text-destructive',
  };

  const pageHeader = (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <div className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">{weekLabel}</div>
        <h1 className="mt-2 text-4xl font-bold tracking-tight">
          <GradientText>Dashboard</GradientText>
        </h1>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" disabled={noActivityThisWeek}>
          <Download className="h-4 w-4" />
          Export
        </Button>
        <Button variant="gradient" onClick={() => navigate('/shipments/create')}>
          <Plus className="h-4 w-4" />
          New shipment
        </Button>
      </div>
    </div>
  );

  if (noActivityThisWeek) {
    return (
      <div className="space-y-8">
        {pageHeader}
        <div className="relative">
          {/* Faint placeholder scaffold behind the frosted panel */}
          <div className="pointer-events-none select-none space-y-8 opacity-40 blur-[3px]" aria-hidden="true">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {[Truck, Package, Truck, CheckCircle2, Percent].map((Icon, i) => (
                <Card key={i}>
                  <CardContent className="p-6">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="mt-4 text-3xl font-bold tracking-tight text-muted-foreground">--</div>
                    <div className="mt-1 h-3 w-24 rounded bg-muted" />
                  </CardContent>
                </Card>
              ))}
            </div>
            <div className="grid gap-6 lg:grid-cols-3">
              <Card className="lg:col-span-2"><CardContent className="h-64" /></Card>
              <Card><CardContent className="h-64" /></Card>
            </div>
          </div>

          {/* Frosted overlay */}
          <div className="absolute inset-0 flex items-start justify-center pt-16">
            <div className="flex max-w-md flex-col items-center gap-3 rounded-2xl border border-border/60 bg-background/60 px-10 py-12 text-center shadow-lg backdrop-blur-md">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Inbox className="h-7 w-7" />
              </div>
              <h2 className="text-xl font-semibold">Awaiting data this week</h2>
              <p className="text-sm text-muted-foreground">
                Nothing has moved through Open TMS since {fmtDay(weekStart)}. As shipments,
                orders, and exceptions are created this week, your live metrics will appear
                here automatically.
              </p>
              <Button variant="gradient" className="mt-2" onClick={() => navigate('/shipments/create')}>
                <Plus className="h-4 w-4" />
                Create your first shipment
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {pageHeader}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {stats.map(stat => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label} className={stat.onClick ? 'cursor-pointer transition-colors hover:border-primary/40' : ''}>
              <button
                type="button"
                onClick={stat.onClick ?? undefined}
                disabled={!stat.onClick}
                className="block w-full text-left disabled:cursor-default"
              >
                <CardContent className="p-6">
                  <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg', tones[stat.tone as keyof typeof tones])}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="mt-4 text-3xl font-bold tracking-tight">{stat.value}</div>
                  <div className="mt-1 text-sm text-muted-foreground">{stat.label}</div>
                </CardContent>
              </button>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Recent shipments</CardTitle>
              <CardDescription>Created this week.</CardDescription>
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
                No shipments created this week
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
                          {s.reference || s.referenceNumber || `SHP-${s.id}`}
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
          <CardTitle>Delivery performance</CardTitle>
          <CardDescription>Status of shipments created this week.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {(() => {
            const deliveredCount = shipmentsThisWeek.filter(s => s.status === 'delivered').length;
            const inTransitCount = inTransitThisWeek.length;
            const total = shipmentsThisWeek.length || 1;
            const otherCount = shipmentsThisWeek.length - deliveredCount - inTransitCount;
            return [
              { label: 'Delivered', count: deliveredCount, pct: parseFloat(((deliveredCount / total) * 100).toFixed(1)), tone: 'bg-success' },
              { label: 'In transit', count: inTransitCount, pct: parseFloat(((inTransitCount / total) * 100).toFixed(1)), tone: 'bg-warning' },
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
