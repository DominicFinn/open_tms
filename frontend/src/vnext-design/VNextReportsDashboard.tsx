import React, { useEffect, useState } from 'react';
import { API_URL } from '../api';

interface DashboardData {
  periodLabel: string;
  dateFrom: string;
  dateTo: string;
  shipments: {
    total: number;
    byStatus: Record<string, number>;
    inTransit: number;
    atLocations: number;
    complete: number;
  };
  orders: {
    total: number;
    byStatus: Record<string, number>;
    byDeliveryStatus: Record<string, number>;
  };
  issues: { open: number; inProgress: number; critical: number };
  financial: {
    periodLabel: string;
    totalRevenueCents: number;
    totalCostCents: number;
    totalMarginCents: number;
    marginPercent: number;
    shipmentCount: number;
    notInvoiced: number;
    invoiced: number;
    paid: number;
  };
  invoices: {
    outstanding: number;
    overdueCount: number;
    totalBalanceCents: number;
    overdueBalanceCents: number;
  };
  trends: {
    shipmentCountChange: number | null;
    revenueChange: number | null;
    marginChange: number | null;
    orderCountChange: number | null;
  };
}

type Period = '7d' | '30d' | 'mtd' | 'qtd' | 'ytd';

function formatCents(cents: number): string {
  if (Math.abs(cents) >= 100000000) {
    return `$${(cents / 100000000).toFixed(1)}M`;
  }
  if (Math.abs(cents) >= 100000) {
    return `$${(cents / 100000).toFixed(1)}K`;
  }
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function trendArrow(change: number | null): { icon: string; color: string; text: string } | null {
  if (change == null) return null;
  if (change > 0) return { icon: 'trending_up', color: 'var(--color-success)', text: `+${change}%` };
  if (change < 0) return { icon: 'trending_down', color: 'var(--color-error)', text: `${change}%` };
  return { icon: 'trending_flat', color: 'var(--on-surface-variant)', text: '0%' };
}

function periodDates(period: Period): { dateFrom: string; dateTo: string } {
  const now = new Date();
  const dateTo = now.toISOString().slice(0, 10);
  let dateFrom: string;

  switch (period) {
    case '7d':
      dateFrom = new Date(now.getTime() - 7 * 86400000).toISOString().slice(0, 10);
      break;
    case '30d':
      dateFrom = new Date(now.getTime() - 30 * 86400000).toISOString().slice(0, 10);
      break;
    case 'mtd':
      dateFrom = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
      break;
    case 'qtd': {
      const qMonth = Math.floor(now.getMonth() / 3) * 3;
      dateFrom = `${now.getFullYear()}-${String(qMonth + 1).padStart(2, '0')}-01`;
      break;
    }
    case 'ytd':
      dateFrom = `${now.getFullYear()}-01-01`;
      break;
  }

  return { dateFrom, dateTo };
}

function StatusBar({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '6px 0' }}>
      <span style={{ width: 100, fontSize: 13, color: 'var(--on-surface-variant)' }}>{label}</span>
      <div style={{ flex: 1, background: 'var(--surface-container)', borderRadius: 4, height: 8 }}>
        <div style={{ width: `${pct}%`, background: color, borderRadius: 4, height: 8, minWidth: count > 0 ? 4 : 0, transition: 'width 0.3s' }} />
      </div>
      <span style={{ width: 40, textAlign: 'right', fontSize: 13, fontWeight: 600 }}>{count}</span>
    </div>
  );
}

export default function VNextReportsDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [period, setPeriod] = useState<Period>('30d');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const { dateFrom, dateTo } = periodDates(period);
    fetch(`${API_URL}/api/v1/reports/dashboard?dateFrom=${dateFrom}&dateTo=${dateTo}`)
      .then(r => r.json())
      .then(json => {
        if (!cancelled) {
          setData(json.data);
          setError('');
        }
      })
      .catch(err => { if (!cancelled) setError(err.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [period]);

  if (loading) return (
    <div style={{ padding: '24px 32px', textAlign: 'center' }}>
      <div className="loading-spinner" style={{ margin: '80px auto' }} />
    </div>
  );
  if (error || !data) return (
    <div style={{ padding: '24px 32px' }}>
      <div className="vn-alert vn-alert-error">{error || 'Failed to load dashboard'}</div>
    </div>
  );

  const { shipments, orders, issues, financial, invoices, trends } = data;

  const shipTrend = trendArrow(trends.shipmentCountChange);
  const revTrend = trendArrow(trends.revenueChange);
  const marginTrend = trendArrow(trends.marginChange);
  const orderTrend = trendArrow(trends.orderCountChange);

  return (
    <div style={{ padding: '24px 32px' }}>
      {/* Header */}
      <div className="vn-page-header">
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>Executive Dashboard</h1>
          <p style={{ margin: '4px 0 0', color: 'var(--on-surface-variant)', fontSize: 14 }}>
            {data.periodLabel}
          </p>
        </div>
        <div className="vn-page-actions">
          <div className="vn-tabs">
            {([['7d', '7 Days'], ['30d', '30 Days'], ['mtd', 'MTD'], ['qtd', 'QTD'], ['ytd', 'YTD']] as [Period, string][]).map(([key, label]) => (
              <button key={key} className={`vn-tab ${period === key ? 'active' : ''}`} onClick={() => setPeriod(key)}>
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Row 1: Shipment stats */}
      <div className="vn-stats" style={{ marginBottom: 16 }}>
        <div className="vn-stat">
          <div className="vn-stat-icon" style={{ background: 'var(--primary-container)', color: 'var(--primary)' }}>
            <span className="material-icons">local_shipping</span>
          </div>
          <div>
            <div className="vn-stat-value">{shipments.total}</div>
            <div className="vn-stat-label">Total Shipments</div>
            {shipTrend && <div className="vn-stat-change" style={{ color: shipTrend.color }}><span className="material-icons" style={{ fontSize: 14 }}>{shipTrend.icon}</span> {shipTrend.text}</div>}
          </div>
        </div>
        <div className="vn-stat">
          <div className="vn-stat-icon" style={{ background: 'var(--info-container, #e3f2fd)', color: 'var(--color-info)' }}>
            <span className="material-icons">flight_takeoff</span>
          </div>
          <div>
            <div className="vn-stat-value">{shipments.inTransit}</div>
            <div className="vn-stat-label">In Transit</div>
          </div>
        </div>
        <div className="vn-stat">
          <div className="vn-stat-icon" style={{ background: 'var(--warning-container, #fff3e0)', color: 'var(--color-warning)' }}>
            <span className="material-icons">warehouse</span>
          </div>
          <div>
            <div className="vn-stat-value">{shipments.atLocations}</div>
            <div className="vn-stat-label">At Locations</div>
          </div>
        </div>
        <div className="vn-stat">
          <div className="vn-stat-icon" style={{ background: 'var(--success-container, #e8f5e9)', color: 'var(--color-success)' }}>
            <span className="material-icons">check_circle</span>
          </div>
          <div>
            <div className="vn-stat-value">{shipments.complete}</div>
            <div className="vn-stat-label">Delivered</div>
          </div>
        </div>
      </div>

      {/* Row 2: Financial stats */}
      <div className="vn-stats" style={{ marginBottom: 16 }}>
        <div className="vn-stat">
          <div className="vn-stat-icon" style={{ background: 'var(--primary-container)', color: 'var(--primary)' }}>
            <span className="material-icons">receipt_long</span>
          </div>
          <div>
            <div className="vn-stat-value">{orders.total}</div>
            <div className="vn-stat-label">Total Orders</div>
            {orderTrend && <div className="vn-stat-change" style={{ color: orderTrend.color }}><span className="material-icons" style={{ fontSize: 14 }}>{orderTrend.icon}</span> {orderTrend.text}</div>}
          </div>
        </div>
        <div className="vn-stat">
          <div className="vn-stat-icon" style={{ background: 'var(--success-container, #e8f5e9)', color: 'var(--color-success)' }}>
            <span className="material-icons">trending_up</span>
          </div>
          <div>
            <div className="vn-stat-value">{formatCents(financial.totalRevenueCents)}</div>
            <div className="vn-stat-label">Revenue</div>
            {revTrend && <div className="vn-stat-change" style={{ color: revTrend.color }}><span className="material-icons" style={{ fontSize: 14 }}>{revTrend.icon}</span> {revTrend.text}</div>}
          </div>
        </div>
        <div className="vn-stat">
          <div className="vn-stat-icon" style={{ background: 'var(--error-container, #fde0dc)', color: 'var(--color-error)' }}>
            <span className="material-icons">payments</span>
          </div>
          <div>
            <div className="vn-stat-value">{formatCents(financial.totalCostCents)}</div>
            <div className="vn-stat-label">Cost Spent</div>
          </div>
        </div>
        <div className="vn-stat">
          <div className="vn-stat-icon" style={{ background: financial.marginPercent >= 10 ? 'var(--success-container, #e8f5e9)' : 'var(--warning-container, #fff3e0)', color: financial.marginPercent >= 10 ? 'var(--color-success)' : 'var(--color-warning)' }}>
            <span className="material-icons">show_chart</span>
          </div>
          <div>
            <div className="vn-stat-value">{formatCents(financial.totalMarginCents)} <span style={{ fontSize: 14, fontWeight: 400 }}>({financial.marginPercent}%)</span></div>
            <div className="vn-stat-label">Margin</div>
            {marginTrend && <div className="vn-stat-change" style={{ color: marginTrend.color }}><span className="material-icons" style={{ fontSize: 14 }}>{marginTrend.icon}</span> {marginTrend.text}</div>}
          </div>
        </div>
      </div>

      {/* Row 3: Invoices & Issues */}
      <div className="vn-stats" style={{ marginBottom: 24 }}>
        <div className="vn-stat">
          <div className="vn-stat-icon" style={{ background: 'var(--info-container, #e3f2fd)', color: 'var(--color-info)' }}>
            <span className="material-icons">receipt</span>
          </div>
          <div>
            <div className="vn-stat-value">{invoices.outstanding}</div>
            <div className="vn-stat-label">Outstanding Invoices</div>
            <div style={{ fontSize: 12, color: 'var(--on-surface-variant)' }}>{formatCents(invoices.totalBalanceCents)}</div>
          </div>
        </div>
        <div className="vn-stat">
          <div className="vn-stat-icon" style={{ background: 'var(--error-container, #fde0dc)', color: 'var(--color-error)' }}>
            <span className="material-icons">schedule</span>
          </div>
          <div>
            <div className="vn-stat-value">{invoices.overdueCount}</div>
            <div className="vn-stat-label">Overdue</div>
            <div style={{ fontSize: 12, color: 'var(--color-error)' }}>{formatCents(invoices.overdueBalanceCents)}</div>
          </div>
        </div>
        <div className="vn-stat">
          <div className="vn-stat-icon" style={{ background: 'var(--warning-container, #fff3e0)', color: 'var(--color-warning)' }}>
            <span className="material-icons">bug_report</span>
          </div>
          <div>
            <div className="vn-stat-value">{issues.open + issues.inProgress}</div>
            <div className="vn-stat-label">Active Issues</div>
            <div style={{ fontSize: 12, color: 'var(--on-surface-variant)' }}>{issues.open} open, {issues.inProgress} in progress</div>
          </div>
        </div>
        <div className="vn-stat">
          <div className="vn-stat-icon" style={{ background: issues.critical > 0 ? 'var(--error-container, #fde0dc)' : 'var(--success-container, #e8f5e9)', color: issues.critical > 0 ? 'var(--color-error)' : 'var(--color-success)' }}>
            <span className="material-icons">{issues.critical > 0 ? 'error' : 'verified'}</span>
          </div>
          <div>
            <div className="vn-stat-value">{issues.critical}</div>
            <div className="vn-stat-label">Critical Issues</div>
          </div>
        </div>
      </div>

      {/* Two-column detail grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>
        {/* Shipment Status Breakdown */}
        <div className="vn-card" style={{ padding: 20 }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 600 }}>Shipment Status</h3>
          <StatusBar label="Draft" count={shipments.byStatus['draft'] || 0} total={shipments.total} color="var(--on-surface-variant)" />
          <StatusBar label="Booked" count={shipments.byStatus['booked'] || 0} total={shipments.total} color="var(--color-info)" />
          <StatusBar label="In Transit" count={shipments.byStatus['in_transit'] || 0} total={shipments.total} color="var(--primary)" />
          <StatusBar label="At Pickup" count={shipments.byStatus['at_pickup'] || 0} total={shipments.total} color="var(--color-warning)" />
          <StatusBar label="At Delivery" count={shipments.byStatus['at_delivery'] || 0} total={shipments.total} color="var(--color-warning)" />
          <StatusBar label="Delivered" count={shipments.byStatus['delivered'] || 0} total={shipments.total} color="var(--color-success)" />
          <StatusBar label="Exception" count={shipments.byStatus['exception'] || 0} total={shipments.total} color="var(--color-error)" />
        </div>

        {/* Order Delivery Breakdown */}
        <div className="vn-card" style={{ padding: 20 }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 600 }}>Order Delivery Status</h3>
          <StatusBar label="Unassigned" count={orders.byDeliveryStatus['unassigned'] || 0} total={orders.total} color="var(--on-surface-variant)" />
          <StatusBar label="Assigned" count={orders.byDeliveryStatus['assigned'] || 0} total={orders.total} color="var(--color-info)" />
          <StatusBar label="In Transit" count={orders.byDeliveryStatus['in_transit'] || 0} total={orders.total} color="var(--primary)" />
          <StatusBar label="Delivered" count={orders.byDeliveryStatus['delivered'] || 0} total={orders.total} color="var(--color-success)" />
          <StatusBar label="Exception" count={orders.byDeliveryStatus['exception'] || 0} total={orders.total} color="var(--color-error)" />
        </div>
      </div>

      {/* Billing Pipeline */}
      <div className="vn-card" style={{ padding: 20 }}>
        <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 600 }}>Billing Pipeline</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          <div style={{ textAlign: 'center', padding: 16, borderRadius: 'var(--border-radius-md)', background: 'var(--surface-container)' }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--color-warning)' }}>{financial.notInvoiced}</div>
            <div style={{ fontSize: 13, color: 'var(--on-surface-variant)', marginTop: 4 }}>Not Invoiced</div>
          </div>
          <div style={{ textAlign: 'center', padding: 16, borderRadius: 'var(--border-radius-md)', background: 'var(--surface-container)' }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--color-info)' }}>{financial.invoiced}</div>
            <div style={{ fontSize: 13, color: 'var(--on-surface-variant)', marginTop: 4 }}>Invoiced</div>
          </div>
          <div style={{ textAlign: 'center', padding: 16, borderRadius: 'var(--border-radius-md)', background: 'var(--surface-container)' }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--color-success)' }}>{financial.paid}</div>
            <div style={{ fontSize: 13, color: 'var(--on-surface-variant)', marginTop: 4 }}>Paid</div>
          </div>
        </div>
      </div>
    </div>
  );
}
