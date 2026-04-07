import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function VNextDashboard() {
  const navigate = useNavigate();

  return (
    <>
      <div className="vn-page-header">
        <div>
          <h1>Dashboard</h1>
          <p>Monday, April 7 2026 — Welcome back, John</p>
        </div>
        <div className="vn-page-actions">
          <button className="vn-btn vn-btn-outline">
            <span className="material-icons">download</span>
            Export
          </button>
          <button className="vn-btn vn-btn-primary" onClick={() => navigate('/vnext/shipments')}>
            <span className="material-icons">add</span>
            New Shipment
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="vn-stats">
        <div className="vn-stat" style={{ cursor: 'pointer' }} onClick={() => navigate('/vnext/shipments')}>
          <div className="vn-stat-icon primary">
            <span className="material-icons">local_shipping</span>
          </div>
          <div>
            <div className="vn-stat-value">142</div>
            <div className="vn-stat-label">Active Shipments</div>
            <div className="vn-stat-change up">
              <span className="material-icons">trending_up</span>
              +12% vs last week
            </div>
          </div>
        </div>
        <div className="vn-stat" style={{ cursor: 'pointer' }} onClick={() => navigate('/vnext/orders')}>
          <div className="vn-stat-icon info">
            <span className="material-icons">receipt_long</span>
          </div>
          <div>
            <div className="vn-stat-value">38</div>
            <div className="vn-stat-label">Pending Orders</div>
            <div className="vn-stat-change down">
              <span className="material-icons">trending_down</span>
              -5% vs last week
            </div>
          </div>
        </div>
        <div className="vn-stat" style={{ cursor: 'pointer' }} onClick={() => navigate('/vnext/issues')}>
          <div className="vn-stat-icon error">
            <span className="material-icons">warning</span>
          </div>
          <div>
            <div className="vn-stat-value">5</div>
            <div className="vn-stat-label">Open Issues</div>
            <div className="vn-stat-change down">
              <span className="material-icons">trending_down</span>
              -2 since yesterday
            </div>
          </div>
        </div>
        <div className="vn-stat" style={{ cursor: 'pointer' }} onClick={() => navigate('/vnext/carrier-bidding')}>
          <div className="vn-stat-icon warning">
            <span className="material-icons">gavel</span>
          </div>
          <div>
            <div className="vn-stat-value">7</div>
            <div className="vn-stat-label">Open Bids</div>
            <div className="vn-stat-change up">
              <span className="material-icons">trending_up</span>
              3 expiring today
            </div>
          </div>
        </div>
        <div className="vn-stat">
          <div className="vn-stat-icon success">
            <span className="material-icons">check_circle</span>
          </div>
          <div>
            <div className="vn-stat-value">96.2%</div>
            <div className="vn-stat-label">On-Time Delivery</div>
            <div className="vn-stat-change up">
              <span className="material-icons">trending_up</span>
              +1.4% this month
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions Grid */}
      <div className="vn-grid-2" style={{ marginBottom: 24 }}>
        {/* Recent Shipments */}
        <div className="vn-card">
          <div className="vn-card-header">
            <h2>Recent Shipments</h2>
            <button className="vn-btn vn-btn-ghost vn-btn-sm" onClick={() => navigate('/vnext/shipments')}>
              View All
              <span className="material-icons">arrow_forward</span>
            </button>
          </div>
          <div className="vn-card-body vn-card-flush">
            <div className="vn-table-wrap">
              <table className="vn-table">
                <thead>
                  <tr>
                    <th>Shipment</th>
                    <th>Route</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { id: 'SHP-4821', from: 'Chicago, IL', to: 'Dallas, TX', status: 'In Transit', color: 'info' },
                    { id: 'SHP-4820', from: 'Los Angeles, CA', to: 'Phoenix, AZ', status: 'Delivered', color: 'success' },
                    { id: 'SHP-4819', from: 'Atlanta, GA', to: 'Miami, FL', status: 'Pickup', color: 'warning' },
                    { id: 'SHP-4818', from: 'New York, NY', to: 'Boston, MA', status: 'Booked', color: 'secondary' },
                  ].map(s => (
                    <tr key={s.id} onClick={() => navigate('/vnext/shipments/SHP-4821')}>
                      <td><span className="vn-table-id">{s.id}</span></td>
                      <td>
                        <div style={{ fontSize: 13 }}>{s.from}</div>
                        <div className="vn-table-secondary">to {s.to}</div>
                      </td>
                      <td><span className={`vn-chip vn-chip-${s.color}`}>{s.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Recent Issues */}
        <div className="vn-card">
          <div className="vn-card-header">
            <h2>Active Issues</h2>
            <button className="vn-btn vn-btn-ghost vn-btn-sm" onClick={() => navigate('/vnext/issues')}>
              View Board
              <span className="material-icons">arrow_forward</span>
            </button>
          </div>
          <div className="vn-card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              { title: 'Delayed pickup at Chicago warehouse', severity: 'error', shipment: 'SHP-4821', time: '2h ago' },
              { title: 'Missing BOL for Dallas delivery', severity: 'warning', shipment: 'SHP-4815', time: '4h ago' },
              { title: 'Carrier unresponsive — ETA update needed', severity: 'error', shipment: 'SHP-4812', time: '6h ago' },
              { title: 'Temperature excursion alert', severity: 'warning', shipment: 'SHP-4808', time: '8h ago' },
            ].map((issue, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 12px',
                borderRadius: 'var(--border-radius-sm)',
                border: '1px solid var(--outline-variant)',
                cursor: 'pointer',
              }}>
                <span className="material-icons" style={{
                  color: issue.severity === 'error' ? 'var(--error)' : 'var(--warning)',
                  fontSize: 20,
                }}>
                  {issue.severity === 'error' ? 'error' : 'warning'}
                </span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--on-surface)' }}>{issue.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--on-surface-variant)' }}>{issue.shipment} · {issue.time}</div>
                </div>
                <span className="material-icons" style={{ fontSize: 18, color: 'var(--on-surface-variant)' }}>chevron_right</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* On-time delivery progress */}
      <div className="vn-card">
        <div className="vn-card-header">
          <h2>Delivery Performance — This Week</h2>
        </div>
        <div className="vn-card-body">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {[
              { label: 'On Time', value: 96.2, count: 127, variant: 'success' },
              { label: 'Late (< 2 hrs)', value: 2.3, count: 3, variant: 'warning' },
              { label: 'Late (> 2 hrs)', value: 1.5, count: 2, variant: 'error' },
            ].map(row => (
              <div key={row.label}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 14 }}>
                  <span style={{ fontWeight: 500, color: 'var(--on-surface)' }}>{row.label}</span>
                  <span style={{ color: 'var(--on-surface-variant)' }}>{row.count} shipments ({row.value}%)</span>
                </div>
                <div className="vn-progress">
                  <div className={`vn-progress-bar ${row.variant}`} style={{ width: `${row.value}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
