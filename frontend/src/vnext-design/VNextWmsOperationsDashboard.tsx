import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { API_URL } from '../api';

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

function Kpi({ label, value, sub, tone, to }: { label: string; value: string | number; sub?: string; tone?: string; to?: string }) {
  const body = (
    <div className="vn-card" style={{ padding: 14, height: '100%' }}>
      <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 700, color: tone || 'var(--text-primary)', lineHeight: 1.2 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{sub}</div>}
    </div>
  );
  return to ? <Link to={to} style={{ textDecoration: 'none' }}>{body}</Link> : body;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <h3 style={{ margin: '0 0 8px', fontSize: 14, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{title}</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10 }}>
        {children}
      </div>
    </div>
  );
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

  if (loading) return <div style={{ padding: 24, textAlign: 'center' }}><div className="vn-loading-spinner" /></div>;
  if (!data) return <div className="vn-alert vn-alert-error">Could not load dashboard.</div>;

  const accuracyTone = (n: number | null) => n == null ? undefined
    : n >= 98 ? 'var(--color-success)' : n >= 95 ? 'var(--color-warning)' : 'var(--color-error)';

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Warehouse Operations</h1>
          <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
            Live at {new Date(data.generatedAt).toLocaleTimeString()} - refreshes every minute
          </p>
        </div>
        <button className="vn-btn vn-btn-outline" onClick={() => load(true)} disabled={refreshing}>
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      <Section title="Throughput today">
        <Kpi label="Receipts" value={data.throughput.today.receipts} sub={`${data.throughput.last7Days.receipts} last 7d`} />
        <Kpi label="Putaways" value={data.throughput.today.putaways} sub={`${data.throughput.last7Days.putaways} last 7d`} />
        <Kpi label="Picks" value={data.throughput.today.picks} sub={`${data.throughput.last7Days.picks} last 7d`} />
        <Kpi label="Packs" value={data.throughput.today.packs} sub={`${data.throughput.last7Days.packs} last 7d`} />
        <Kpi label="Shipments dispatched" value={data.throughput.today.shipmentsDispatched} sub={`${data.throughput.last7Days.shipmentsDispatched} last 7d`} />
      </Section>

      <Section title="Cycle times (30 days)">
        <Kpi label="Pick cycle" value={data.cycleTimes.pickCycleMinutes != null ? `${data.cycleTimes.pickCycleMinutes}m` : '-'} sub={`${data.cycleTimes.samples.pickCycle} picks`} />
        <Kpi label="Dock to stock" value={data.cycleTimes.dockToStockMinutes != null ? `${data.cycleTimes.dockToStockMinutes}m` : '-'} sub={`${data.cycleTimes.samples.dockToStock} putaways`} />
        <Kpi label="Order to ship" value={data.cycleTimes.orderToShipHours != null ? `${data.cycleTimes.orderToShipHours}h` : '-'} sub={`${data.cycleTimes.samples.orderToShip} orders`} />
      </Section>

      <Section title="Quality & accuracy (30 days)">
        <Kpi label="Pick accuracy" value={fmt(data.quality.pickAccuracyPercent, '%')} sub={`${data.quality.pickAccuracySamples} picks`} tone={accuracyTone(data.quality.pickAccuracyPercent)} />
        <Kpi label="Pack audit pass rate" value={fmt(data.quality.packAuditPassRatePercent, '%')} sub={`${data.quality.packAuditSamples} audits`} tone={accuracyTone(data.quality.packAuditPassRatePercent)} to="/wms/pack-audits" />
        <Kpi label="Inventory accuracy" value={fmt(data.quality.inventoryAccuracyPercent, '%')} sub={`${data.quality.cycleCountSamples} count lines`} tone={accuracyTone(data.quality.inventoryAccuracyPercent)} />
      </Section>

      <Section title="Live work queue">
        <Kpi label="Pending picks" value={data.liveWork.pendingPickTasks} to="/wms/picking" />
        <Kpi label="Pending putaways" value={data.liveWork.pendingPutawayTasks} to="/wms/putaway" />
        <Kpi label="Pending packs" value={data.liveWork.pendingPackTasks} to="/wms/packing" />
        <Kpi label="Active waves" value={data.liveWork.activeWaves} to="/wms/waves" />
        <Kpi label="Receiving in progress" value={data.liveWork.receivingInProgress} to="/wms/receiving" />
      </Section>

      <Section title="Exceptions">
        <Kpi label="Open issues" value={data.exceptions.openIssues} sub={`${data.exceptions.criticalIssues} critical`} tone={data.exceptions.criticalIssues > 0 ? 'var(--color-error)' : undefined} to="/issues" />
        <Kpi label="Cutoff: critical" value={data.exceptions.cutoffAtRisk.critical} sub={`${data.exceptions.cutoffAtRisk.warning} warning`} tone={data.exceptions.cutoffAtRisk.critical > 0 ? 'var(--color-error)' : undefined} to="/wms/cutoff-monitor" />
        <Kpi label="Returns in progress" value={data.exceptions.pendingReturns} to="/wms/returns" />
        <Kpi label="Open pack audit fails" value={data.exceptions.packAuditFailuresOpen} to="/wms/pack-audits" />
      </Section>

      <Section title="Capacity">
        <Kpi label="Total bins" value={data.capacity.totalBins} />
        <Kpi label="Bins with inventory" value={data.capacity.binsWithInventory} />
        <Kpi label="Utilization" value={fmt(data.capacity.utilizationPercent, '%')} tone={
          data.capacity.utilizationPercent == null ? undefined
            : data.capacity.utilizationPercent > 85 ? 'var(--color-warning)'
            : data.capacity.utilizationPercent > 95 ? 'var(--color-error)'
            : 'var(--color-success)'
        } />
      </Section>
    </div>
  );
}
