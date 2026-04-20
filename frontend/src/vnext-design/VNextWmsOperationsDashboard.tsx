import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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

const fmt = (n: number | null, suffix = '') => n == null ? '—' : `${n}${suffix}`;

type IconTone = 'primary' | 'success' | 'warning' | 'error' | 'info' | 'secondary';

function StatTile({
  icon,
  tone,
  label,
  value,
  sub,
  to,
}: {
  icon: string;
  tone: IconTone;
  label: string;
  value: string | number;
  sub?: string;
  to?: string;
}) {
  const navigate = useNavigate();
  return (
    <div
      className="vn-stat"
      style={to ? { cursor: 'pointer' } : undefined}
      onClick={to ? () => navigate(to) : undefined}
    >
      <div className={`vn-stat-icon ${tone}`}>
        <span className="material-icons">{icon}</span>
      </div>
      <div>
        <div className="vn-stat-value">{value}</div>
        <div className="vn-stat-label">{label}</div>
        {sub && <div className="vn-stat-label" style={{ marginTop: 2, opacity: 0.8 }}>{sub}</div>}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="vn-card" style={{ padding: 20, marginBottom: 20 }}>
      <h2 style={{ margin: '0 0 14px', fontSize: 13, fontWeight: 600, color: 'var(--on-surface-variant)', textTransform: 'uppercase', letterSpacing: 0.6 }}>
        {title}
      </h2>
      <div className="vn-stats" style={{ marginBottom: 0 }}>
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
      <div className="vn-empty">
        <span className="material-icons" style={{ animation: 'spin 1s linear infinite' }}>refresh</span>
        <h3>Loading operations dashboard...</h3>
      </div>
    );
  }
  if (!data) return <div className="vn-alert vn-alert-error"><span className="material-icons">error</span><div className="vn-alert-content">Could not load dashboard.</div></div>;

  return (
    <>
      <div className="vn-page-header">
        <div>
          <h1>Warehouse Operations</h1>
          <p>Live at {new Date(data.generatedAt).toLocaleTimeString()} · auto-refreshes every minute</p>
        </div>
        <div className="vn-page-actions">
          <button className="vn-btn vn-btn-outline" onClick={() => load(true)} disabled={refreshing}>
            <span className="material-icons" style={refreshing ? { animation: 'spin 1s linear infinite' } : undefined}>refresh</span>
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      <Section title="Throughput today">
        <StatTile icon="move_to_inbox" tone="primary" label="Receipts" value={data.throughput.today.receipts} sub={`${data.throughput.last7Days.receipts} last 7d`} />
        <StatTile icon="system_update_alt" tone="primary" label="Putaways" value={data.throughput.today.putaways} sub={`${data.throughput.last7Days.putaways} last 7d`} />
        <StatTile icon="shopping_cart_checkout" tone="primary" label="Picks" value={data.throughput.today.picks} sub={`${data.throughput.last7Days.picks} last 7d`} />
        <StatTile icon="inventory_2" tone="primary" label="Packs" value={data.throughput.today.packs} sub={`${data.throughput.last7Days.packs} last 7d`} />
        <StatTile icon="local_shipping" tone="info" label="Shipments dispatched" value={data.throughput.today.shipmentsDispatched} sub={`${data.throughput.last7Days.shipmentsDispatched} last 7d`} />
      </Section>

      <Section title="Cycle times (30 days)">
        <StatTile icon="timer" tone="info" label="Pick cycle" value={data.cycleTimes.pickCycleMinutes != null ? `${data.cycleTimes.pickCycleMinutes}m` : '—'} sub={`${data.cycleTimes.samples.pickCycle} picks`} />
        <StatTile icon="schedule" tone="info" label="Dock to stock" value={data.cycleTimes.dockToStockMinutes != null ? `${data.cycleTimes.dockToStockMinutes}m` : '—'} sub={`${data.cycleTimes.samples.dockToStock} putaways`} />
        <StatTile icon="pending" tone="info" label="Order to ship" value={data.cycleTimes.orderToShipHours != null ? `${data.cycleTimes.orderToShipHours}h` : '—'} sub={`${data.cycleTimes.samples.orderToShip} orders`} />
      </Section>

      <Section title="Quality & accuracy (30 days)">
        <StatTile
          icon="verified"
          tone={accuracyTone(data.quality.pickAccuracyPercent)}
          label="Pick accuracy"
          value={fmt(data.quality.pickAccuracyPercent, '%')}
          sub={`${data.quality.pickAccuracySamples} picks`}
        />
        <StatTile
          icon="fact_check"
          tone={accuracyTone(data.quality.packAuditPassRatePercent)}
          label="Pack audit pass rate"
          value={fmt(data.quality.packAuditPassRatePercent, '%')}
          sub={`${data.quality.packAuditSamples} audits`}
          to="/wms/pack-audits"
        />
        <StatTile
          icon="inventory"
          tone={accuracyTone(data.quality.inventoryAccuracyPercent)}
          label="Inventory accuracy"
          value={fmt(data.quality.inventoryAccuracyPercent, '%')}
          sub={`${data.quality.cycleCountSamples} count lines`}
        />
      </Section>

      <Section title="Live work queue">
        <StatTile icon="shopping_cart" tone="warning" label="Pending picks" value={data.liveWork.pendingPickTasks} to="/wms/picking" />
        <StatTile icon="system_update_alt" tone="warning" label="Pending putaways" value={data.liveWork.pendingPutawayTasks} to="/wms/putaway" />
        <StatTile icon="inventory_2" tone="warning" label="Pending packs" value={data.liveWork.pendingPackTasks} to="/wms/packing" />
        <StatTile icon="waves" tone="primary" label="Active waves" value={data.liveWork.activeWaves} to="/wms/waves" />
        <StatTile icon="move_to_inbox" tone="primary" label="Receiving in progress" value={data.liveWork.receivingInProgress} to="/wms/receiving" />
      </Section>

      <Section title="Exceptions">
        <StatTile
          icon="warning"
          tone={data.exceptions.criticalIssues > 0 ? 'error' : 'warning'}
          label="Open issues"
          value={data.exceptions.openIssues}
          sub={`${data.exceptions.criticalIssues} critical`}
          to="/issues"
        />
        <StatTile
          icon="schedule"
          tone={data.exceptions.cutoffAtRisk.critical > 0 ? 'error' : 'warning'}
          label="Cutoff risk"
          value={data.exceptions.cutoffAtRisk.critical}
          sub={`${data.exceptions.cutoffAtRisk.warning} warning`}
          to="/wms/cutoff-monitor"
        />
        <StatTile icon="keyboard_return" tone="info" label="Returns in progress" value={data.exceptions.pendingReturns} to="/wms/returns" />
        <StatTile icon="report" tone="error" label="Open pack audit fails" value={data.exceptions.packAuditFailuresOpen} to="/wms/pack-audits" />
      </Section>

      <Section title="Capacity">
        <StatTile icon="grid_view" tone="primary" label="Total bins" value={data.capacity.totalBins} />
        <StatTile icon="inventory_2" tone="primary" label="Bins with inventory" value={data.capacity.binsWithInventory} />
        <StatTile
          icon="storage"
          tone={utilizationTone(data.capacity.utilizationPercent)}
          label="Utilization"
          value={fmt(data.capacity.utilizationPercent, '%')}
        />
      </Section>
    </>
  );
}
