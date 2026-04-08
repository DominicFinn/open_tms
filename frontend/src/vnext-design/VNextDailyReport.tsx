import React from 'react';

const IN_TRANSIT = [
  { ref: 'SHP-4821', origin: 'Chicago, IL', dest: 'Dallas, TX', eta: 'Apr 8, 10:00 AM', status: 'On Track', statusColor: 'info' },
  { ref: 'SHP-4817', origin: 'Denver, CO', dest: 'Salt Lake City, UT', eta: 'Apr 8, 2:00 PM', status: 'On Track', statusColor: 'info' },
  { ref: 'SHP-4816', origin: 'Seattle, WA', dest: 'Portland, OR', eta: 'Apr 8, 11:30 AM', status: 'Delayed', statusColor: 'warning' },
  { ref: 'SHP-4813', origin: 'Detroit, MI', dest: 'Columbus, OH', eta: 'Apr 8, 4:00 PM', status: 'On Track', statusColor: 'info' },
  { ref: 'SHP-4810', origin: 'Memphis, TN', dest: 'Louisville, KY', eta: 'Apr 8, 6:00 PM', status: 'At Risk', statusColor: 'error' },
];

const DELIVERIES_DUE = [
  { ref: 'SHP-4821', destination: 'Dallas, TX', carrier: 'Swift Transport', status: 'En Route', statusColor: 'info' },
  { ref: 'SHP-4817', destination: 'Salt Lake City, UT', carrier: 'Mountain Haul', status: 'Arriving', statusColor: 'success' },
  { ref: 'SHP-4816', destination: 'Portland, OR', carrier: 'Pacific Lines', status: 'Delayed', statusColor: 'warning' },
  { ref: 'SHP-4813', destination: 'Columbus, OH', carrier: 'Great Lakes Haul', status: 'En Route', statusColor: 'info' },
];

const PERFORMANCE = [
  { label: 'On-Time Delivery', value: 94.5, variant: 'success' },
  { label: 'Damage-Free', value: 99.1, variant: 'success' },
  { label: 'Customer Satisfaction', value: 87.3, variant: 'warning' },
];

export default function VNextDailyReport() {
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <>
      {/* Page Header */}
      <div className="vn-page-header">
        <div>
          <h1>Daily Report</h1>
          <p style={{ color: 'var(--on-surface-variant)', fontSize: 14, marginTop: 4 }}>{today}</p>
        </div>
        <div className="vn-page-actions">
          <button className="vn-btn vn-btn-outline">
            <span className="material-icons">download</span>
            Export PDF
          </button>
          <button className="vn-btn vn-btn-outline">
            <span className="material-icons">email</span>
            Email Report
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="vn-stats">
        <div className="vn-stat">
          <div className="vn-stat-icon primary">
            <span className="material-icons">local_shipping</span>
          </div>
          <div>
            <div className="vn-stat-value">24</div>
            <div className="vn-stat-label">Shipments Today</div>
            <div className="vn-stat-change up">
              <span className="material-icons">trending_up</span>
              +4 vs yesterday
            </div>
          </div>
        </div>
        <div className="vn-stat">
          <div className="vn-stat-icon success">
            <span className="material-icons">check_circle</span>
          </div>
          <div>
            <div className="vn-stat-value">94.5%</div>
            <div className="vn-stat-label">On-Time %</div>
            <div className="vn-stat-change up">
              <span className="material-icons">trending_up</span>
              +1.2% vs last week
            </div>
          </div>
        </div>
        <div className="vn-stat">
          <div className="vn-stat-icon info">
            <span className="material-icons">inventory_2</span>
          </div>
          <div>
            <div className="vn-stat-value">18</div>
            <div className="vn-stat-label">Deliveries</div>
            <div className="vn-stat-change down">
              <span className="material-icons">trending_down</span>
              -2 vs yesterday
            </div>
          </div>
        </div>
        <div className="vn-stat">
          <div className="vn-stat-icon warning">
            <span className="material-icons">payments</span>
          </div>
          <div>
            <div className="vn-stat-value">$68.4K</div>
            <div className="vn-stat-label">Revenue</div>
            <div className="vn-stat-change up">
              <span className="material-icons">trending_up</span>
              +8% vs avg
            </div>
          </div>
        </div>
      </div>

      {/* Two-Column Grid */}
      <div className="vn-grid-2" style={{ marginBottom: 24 }}>
        {/* Shipments In Transit */}
        <div className="vn-card">
          <div className="vn-card-header">
            <h2>Shipments In Transit</h2>
            <span className="vn-chip vn-chip-info">{IN_TRANSIT.length} active</span>
          </div>
          <div className="vn-card-body vn-card-flush">
            <div className="vn-table-wrap">
              <table className="vn-table">
                <thead>
                  <tr>
                    <th>Ref</th>
                    <th>Origin</th>
                    <th>Destination</th>
                    <th>ETA</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {IN_TRANSIT.map((s, i) => (
                    <tr key={i}>
                      <td><span className="vn-table-id">{s.ref}</span></td>
                      <td style={{ fontSize: 13 }}>{s.origin}</td>
                      <td style={{ fontSize: 13 }}>{s.dest}</td>
                      <td style={{ fontSize: 13 }}>{s.eta}</td>
                      <td><span className={`vn-chip vn-chip-${s.statusColor}`}>{s.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Deliveries Due Today */}
        <div className="vn-card">
          <div className="vn-card-header">
            <h2>Deliveries Due Today</h2>
            <span className="vn-chip vn-chip-success">{DELIVERIES_DUE.length} expected</span>
          </div>
          <div className="vn-card-body vn-card-flush">
            <div className="vn-table-wrap">
              <table className="vn-table">
                <thead>
                  <tr>
                    <th>Ref</th>
                    <th>Destination</th>
                    <th>Carrier</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {DELIVERIES_DUE.map((d, i) => (
                    <tr key={i}>
                      <td><span className="vn-table-id">{d.ref}</span></td>
                      <td style={{ fontSize: 13 }}>{d.destination}</td>
                      <td style={{ fontSize: 13 }}>{d.carrier}</td>
                      <td><span className={`vn-chip vn-chip-${d.statusColor}`}>{d.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Delivery Performance */}
      <div className="vn-card">
        <div className="vn-card-header">
          <h2>Delivery Performance</h2>
        </div>
        <div className="vn-card-body">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {PERFORMANCE.map(row => (
              <div key={row.label}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 14 }}>
                  <span style={{ fontWeight: 500, color: 'var(--on-surface)' }}>{row.label}</span>
                  <span style={{ color: 'var(--on-surface-variant)' }}>{row.value}%</span>
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
