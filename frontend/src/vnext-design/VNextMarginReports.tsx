import React, { useEffect, useState } from 'react';
import { API_URL } from '../api';

type ReportView = 'customer' | 'carrier' | 'lane' | 'time';

interface MarginRow {
  customerId?: string;
  customerName?: string;
  carrierId?: string;
  carrierName?: string;
  laneId?: string;
  laneName?: string;
  period?: string;
  targetMarginPercent?: number | null;
  varianceFromTarget?: number | null;
  shipmentCount: number;
  totalRevenueCents: number;
  totalCostCents: number;
  totalMarginCents: number;
  marginPercent: number;
  revenueCents?: number;
  costCents?: number;
  marginCents?: number;
}

function formatCents(cents: number): string {
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function marginColor(pct: number): string {
  if (pct >= 15) return 'var(--color-success)';
  if (pct >= 5) return 'var(--color-warning)';
  return 'var(--color-error)';
}

export default function VNextMarginReports() {
  const [view, setView] = useState<ReportView>('customer');
  const [data, setData] = useState<MarginRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);
      const endpoint = view === 'time' ? 'over-time' : `by-${view}`;
      const res = await fetch(`${API_URL}/api/v1/reports/margin/${endpoint}?${params}`);
      const json = await res.json();
      setData(json.data || []);
    } catch { setData([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, [view, dateFrom, dateTo]);

  const totals = data.reduce((acc, r) => ({
    revenue: acc.revenue + (r.totalRevenueCents || r.revenueCents || 0),
    cost: acc.cost + (r.totalCostCents || r.costCents || 0),
    margin: acc.margin + (r.totalMarginCents || r.marginCents || 0),
    count: acc.count + (r.shipmentCount || 0),
  }), { revenue: 0, cost: 0, margin: 0, count: 0 });

  const totalMarginPct = totals.revenue > 0 ? (totals.margin / totals.revenue) * 100 : 0;

  return (
    <div style={{ padding: '24px 32px' }}>
      <div className="vn-page-header">
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>Margin Reports</h1>
          <p style={{ margin: '4px 0 0', color: 'var(--on-surface-variant)', fontSize: 14 }}>
            Analyze profitability by customer, carrier, lane, or time period
          </p>
        </div>
      </div>

      {/* Summary stats */}
      <div className="vn-stats" style={{ marginBottom: 24 }}>
        <div className="vn-stat">
          <div className="vn-stat-label">Total Revenue</div>
          <div className="vn-stat-value">{formatCents(totals.revenue)}</div>
        </div>
        <div className="vn-stat">
          <div className="vn-stat-label">Total Cost</div>
          <div className="vn-stat-value">{formatCents(totals.cost)}</div>
        </div>
        <div className="vn-stat">
          <div className="vn-stat-label">Total Margin</div>
          <div className="vn-stat-value" style={{ color: marginColor(totalMarginPct) }}>{formatCents(totals.margin)}</div>
        </div>
        <div className="vn-stat">
          <div className="vn-stat-label">Margin %</div>
          <div className="vn-stat-value" style={{ color: marginColor(totalMarginPct) }}>{totalMarginPct.toFixed(1)}%</div>
        </div>
        <div className="vn-stat">
          <div className="vn-stat-label">Shipments</div>
          <div className="vn-stat-value">{totals.count}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="vn-card" style={{ marginBottom: 16 }}>
        <div className="vn-filters" style={{ padding: '12px 16px' }}>
          <div className="vn-tabs" style={{ flex: 1 }}>
            {(['customer', 'carrier', 'lane', 'time'] as ReportView[]).map(v => (
              <button key={v} className={`vn-tab ${view === v ? 'active' : ''}`} onClick={() => setView(v)}>
                {v === 'customer' ? 'By Customer' : v === 'carrier' ? 'By Carrier' : v === 'lane' ? 'By Lane' : 'Over Time'}
              </button>
            ))}
          </div>
          <input type="date" className="vn-filter-input" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ width: 140 }} />
          <span style={{ color: 'var(--on-surface-variant)' }}>to</span>
          <input type="date" className="vn-filter-input" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ width: 140 }} />
        </div>
      </div>

      {/* Table */}
      <div className="vn-card">
        <div className="vn-table-wrap">
          {loading ? (
            <div style={{ textAlign: 'center', padding: 40 }}><div className="loading-spinner" /></div>
          ) : data.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--on-surface-variant)' }}>No data for the selected period</div>
          ) : (
            <table className="vn-table">
              <thead>
                <tr>
                  <th>{view === 'customer' ? 'Customer' : view === 'carrier' ? 'Carrier' : view === 'lane' ? 'Lane' : 'Period'}</th>
                  <th style={{ textAlign: 'right' }}>Shipments</th>
                  <th style={{ textAlign: 'right' }}>Revenue</th>
                  <th style={{ textAlign: 'right' }}>Cost</th>
                  <th style={{ textAlign: 'right' }}>Margin</th>
                  <th style={{ textAlign: 'right' }}>Margin %</th>
                  {view === 'customer' && <th style={{ textAlign: 'right' }}>Target</th>}
                  {view === 'customer' && <th style={{ textAlign: 'right' }}>Variance</th>}
                </tr>
              </thead>
              <tbody>
                {data.map((r, i) => {
                  const name = r.customerName || r.carrierName || r.laneName || r.period || '-';
                  const revenue = r.totalRevenueCents || r.revenueCents || 0;
                  const cost = r.totalCostCents || r.costCents || 0;
                  const margin = r.totalMarginCents || r.marginCents || 0;
                  const pct = r.marginPercent;
                  return (
                    <tr key={i}>
                      <td style={{ fontWeight: 600 }}>{name}</td>
                      <td style={{ textAlign: 'right' }}>{r.shipmentCount}</td>
                      <td style={{ textAlign: 'right' }}>{formatCents(revenue)}</td>
                      <td style={{ textAlign: 'right' }}>{formatCents(cost)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 600, color: marginColor(pct) }}>{formatCents(margin)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 600, color: marginColor(pct) }}>{pct.toFixed(1)}%</td>
                      {view === 'customer' && (
                        <td style={{ textAlign: 'right' }}>
                          {r.targetMarginPercent != null ? `${r.targetMarginPercent}%` : '-'}
                        </td>
                      )}
                      {view === 'customer' && (
                        <td style={{ textAlign: 'right', fontWeight: 600, color: r.varianceFromTarget != null ? (r.varianceFromTarget >= 0 ? 'var(--color-success)' : 'var(--color-error)') : 'var(--on-surface-variant)' }}>
                          {r.varianceFromTarget != null ? `${r.varianceFromTarget > 0 ? '+' : ''}${r.varianceFromTarget.toFixed(1)}%` : '-'}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
