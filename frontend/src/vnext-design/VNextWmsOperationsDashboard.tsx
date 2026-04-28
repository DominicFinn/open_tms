import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  Boxes,
  CircleAlert,
  ClipboardCheck,
  Clock,
  Database,
  FileWarning,
  Grid3x3,
  Loader2,
  Package,
  PackageOpen,
  PackagePlus,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  ShoppingCart,
  Timer,
  Truck,
  Waves,
  type LucideIcon,
} from 'lucide-react';

import { API_URL } from '../api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface DashboardPayload {
  generatedAt: string;
  throughput: {
    today: { receipts: number; putaways: number; picks: number; packs: number; shipmentsDispatched: number };
    last7Days: { receipts: number; putaways: number; picks: number; packs: number; shipmentsDispatched: number };
  };
  cycleTimes: {
    pickCycleMinutes: number | null;
    dockToStockMinutes: number | null;
    orderToShipHours: number | null;
    samples: { pickCycle: number; dockToStock: number; orderToShip: number };
  };
  quality: {
    pickAccuracyPercent: number | null;
    packAuditPassRatePercent: number | null;
    inventoryAccuracyPercent: number | null;
    pickAccuracySamples: number;
    packAuditSamples: number;
    cycleCountSamples: number;
  };
  liveWork: {
    pendingPickTasks: number;
    pendingPutawayTasks: number;
    pendingPackTasks: number;
    activeWaves: number;
    receivingInProgress: number;
  };
  exceptions: {
    openIssues: number;
    criticalIssues: number;
    cutoffAtRisk: { critical: number; warning: number };
    pendingReturns: number;
    packAuditFailuresOpen: number;
  };
  capacity: {
    totalBins: number;
    binsWithInventory: number;
    utilizationPercent: number | null;
  };
}

const fmt = (n: number | null, suffix = '') => n == null ? '-' : `${n}${suffix}`;

type IconTone = 'primary' | 'success' | 'warning' | 'error' | 'info' | 'secondary';

const TONE_CLASSES: Record<IconTone, string> = {
  primary: 'bg-primary/10 text-primary',
  success: 'bg-success/15 text-success',
  warning: 'bg-warning/15 text-warning',
  error: 'bg-destructive/10 text-destructive',
  info: 'bg-info/15 text-info',
  secondary: 'bg-muted text-muted-foreground',
};

function StatTile({
  icon: Icon,
  tone,
  label,
  value,
  sub,
  to,
}: {
  icon: LucideIcon;
  tone: IconTone;
  label: string;
  value: string | number;
  sub?: string;
  to?: string;
}) {
  const navigate = useNavigate();
  return (
    <Card className={to ? 'cursor-pointer transition-colors hover:border-primary/40' : ''}>
      <button
        type="button"
        onClick={to ? () => navigate(to) : undefined}
        disabled={!to}
        className="block w-full text-left disabled:cursor-default"
      >
        <CardContent className="p-5">
          <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg', TONE_CLASSES[tone])}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="mt-3 text-2xl font-bold tracking-tight">{value}</div>
          <div className="mt-1 text-sm text-muted-foreground">{label}</div>
          {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
        </CardContent>
      </button>
    </Card>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{title}</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {children}
      </div>
    </div>
  );
}

function accuracyTone(n: number | null): IconTone {
  if (n == null) return 'secondary';
  if (n >= 98) return 'success';
  if (n >= 95) return 'warning';
  return 'error';
}

function utilizationTone(n: number | null): IconTone {
  if (n == null) return 'secondary';
  if (n > 95) return 'error';
  if (n > 85) return 'warning';
  return 'success';
}

export default function VNextWmsOperationsDashboard() {
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = (manual = false) => {
    if (manual) setRefreshing(true); else setLoading(true);
    fetch(`${API_URL}/api/v1/wms/operations-dashboard`)
      .then(r => r.json())
      .then(json => setData(json.data))
      .finally(() => { setLoading(false); setRefreshing(false); });
  };

  useEffect(() => {
    load();
    const id = setInterval(() => load(true), 60_000);
    return () => clearInterval(id);
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-3 py-24 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin" />
        <h3 className="text-lg font-medium">Loading operations dashboard...</h3>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="flex items-center gap-3 rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
        <CircleAlert className="h-5 w-5" />
        Could not load dashboard.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Warehouse Operations</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Live at {new Date(data.generatedAt).toLocaleTimeString()} - auto-refreshes every minute
          </p>
        </div>
        <Button variant="outline" onClick={() => load(true)} disabled={refreshing}>
          <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </Button>
      </div>

      <Section title="Throughput today">
        <StatTile icon={PackageOpen} tone="primary" label="Receipts" value={data.throughput.today.receipts} sub={`${data.throughput.last7Days.receipts} last 7d`} />
        <StatTile icon={PackagePlus} tone="primary" label="Putaways" value={data.throughput.today.putaways} sub={`${data.throughput.last7Days.putaways} last 7d`} />
        <StatTile icon={ShoppingCart} tone="primary" label="Picks" value={data.throughput.today.picks} sub={`${data.throughput.last7Days.picks} last 7d`} />
        <StatTile icon={Package} tone="primary" label="Packs" value={data.throughput.today.packs} sub={`${data.throughput.last7Days.packs} last 7d`} />
        <StatTile icon={Truck} tone="info" label="Shipments dispatched" value={data.throughput.today.shipmentsDispatched} sub={`${data.throughput.last7Days.shipmentsDispatched} last 7d`} />
      </Section>

      <Section title="Cycle times (30 days)">
        <StatTile icon={Timer} tone="info" label="Pick cycle" value={data.cycleTimes.pickCycleMinutes != null ? `${data.cycleTimes.pickCycleMinutes}m` : '-'} sub={`${data.cycleTimes.samples.pickCycle} picks`} />
        <StatTile icon={Clock} tone="info" label="Dock to stock" value={data.cycleTimes.dockToStockMinutes != null ? `${data.cycleTimes.dockToStockMinutes}m` : '-'} sub={`${data.cycleTimes.samples.dockToStock} putaways`} />
        <StatTile icon={Clock} tone="info" label="Order to ship" value={data.cycleTimes.orderToShipHours != null ? `${data.cycleTimes.orderToShipHours}h` : '-'} sub={`${data.cycleTimes.samples.orderToShip} orders`} />
      </Section>

      <Section title="Quality & accuracy (30 days)">
        <StatTile
          icon={ShieldCheck}
          tone={accuracyTone(data.quality.pickAccuracyPercent)}
          label="Pick accuracy"
          value={fmt(data.quality.pickAccuracyPercent, '%')}
          sub={`${data.quality.pickAccuracySamples} picks`}
        />
        <StatTile
          icon={ClipboardCheck}
          tone={accuracyTone(data.quality.packAuditPassRatePercent)}
          label="Pack audit pass rate"
          value={fmt(data.quality.packAuditPassRatePercent, '%')}
          sub={`${data.quality.packAuditSamples} audits`}
          to="/wms/pack-audits"
        />
        <StatTile
          icon={Boxes}
          tone={accuracyTone(data.quality.inventoryAccuracyPercent)}
          label="Inventory accuracy"
          value={fmt(data.quality.inventoryAccuracyPercent, '%')}
          sub={`${data.quality.cycleCountSamples} count lines`}
        />
      </Section>

      <Section title="Live work queue">
        <StatTile icon={ShoppingCart} tone="warning" label="Pending picks" value={data.liveWork.pendingPickTasks} to="/wms/picking" />
        <StatTile icon={PackagePlus} tone="warning" label="Pending putaways" value={data.liveWork.pendingPutawayTasks} to="/wms/putaway" />
        <StatTile icon={Package} tone="warning" label="Pending packs" value={data.liveWork.pendingPackTasks} to="/wms/packing" />
        <StatTile icon={Waves} tone="primary" label="Active waves" value={data.liveWork.activeWaves} to="/wms/waves" />
        <StatTile icon={PackageOpen} tone="primary" label="Receiving in progress" value={data.liveWork.receivingInProgress} to="/wms/receiving" />
      </Section>

      <Section title="Exceptions">
        <StatTile
          icon={AlertTriangle}
          tone={data.exceptions.criticalIssues > 0 ? 'error' : 'warning'}
          label="Open issues"
          value={data.exceptions.openIssues}
          sub={`${data.exceptions.criticalIssues} critical`}
          to="/issues"
        />
        <StatTile
          icon={Clock}
          tone={data.exceptions.cutoffAtRisk.critical > 0 ? 'error' : 'warning'}
          label="Cutoff risk"
          value={data.exceptions.cutoffAtRisk.critical}
          sub={`${data.exceptions.cutoffAtRisk.warning} warning`}
          to="/wms/cutoff-monitor"
        />
        <StatTile icon={RotateCcw} tone="info" label="Returns in progress" value={data.exceptions.pendingReturns} to="/wms/returns" />
        <StatTile icon={FileWarning} tone="error" label="Open pack audit fails" value={data.exceptions.packAuditFailuresOpen} to="/wms/pack-audits" />
      </Section>

      <Section title="Capacity">
        <StatTile icon={Grid3x3} tone="primary" label="Total bins" value={data.capacity.totalBins} />
        <StatTile icon={Boxes} tone="primary" label="Bins with inventory" value={data.capacity.binsWithInventory} />
        <StatTile
          icon={Database}
          tone={utilizationTone(data.capacity.utilizationPercent)}
          label="Utilization"
          value={fmt(data.capacity.utilizationPercent, '%')}
        />
      </Section>
    </div>
  );
}
