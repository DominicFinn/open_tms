import React, { useState } from 'react';

const LOGS = [
  { id: 1, time: 'Apr 8, 2026 09:14:32', device: 'GPS Tracker #401', apiKey: 'Production Webhook', status: 'Success', statusColor: 'success', shipment: 'SHP-4821', hasLocation: true, updated: true },
  { id: 2, time: 'Apr 8, 2026 09:12:05', device: 'Mobile App - Driver J. Smith', apiKey: 'Mobile App', status: 'Success', statusColor: 'success', shipment: 'SHP-4819', hasLocation: true, updated: true },
  { id: 3, time: 'Apr 8, 2026 09:10:41', device: 'ERP System', apiKey: 'ERP Integration', status: 'Error', statusColor: 'error', shipment: 'SHP-4818', hasLocation: false, updated: false },
  { id: 4, time: 'Apr 8, 2026 09:08:17', device: 'GPS Tracker #402', apiKey: 'Production Webhook', status: 'Success', statusColor: 'success', shipment: 'SHP-4817', hasLocation: true, updated: true },
  { id: 5, time: 'Apr 8, 2026 09:05:59', device: 'Customer Portal', apiKey: 'Customer Portal', status: 'Skipped', statusColor: 'warning', shipment: null, hasLocation: false, updated: false },
  { id: 6, time: 'Apr 8, 2026 09:03:22', device: 'GPS Tracker #401', apiKey: 'Production Webhook', status: 'Success', statusColor: 'success', shipment: 'SHP-4821', hasLocation: true, updated: true },
  { id: 7, time: 'Apr 8, 2026 09:01:10', device: 'Staging Test Runner', apiKey: 'Staging Webhook', status: 'Not Found', statusColor: 'error', shipment: 'SHP-9999', hasLocation: false, updated: false },
  { id: 8, time: 'Apr 8, 2026 08:58:44', device: 'Mobile App - Driver L. Chen', apiKey: 'Mobile App', status: 'Success', statusColor: 'success', shipment: 'SHP-4820', hasLocation: true, updated: true },
  { id: 9, time: 'Apr 8, 2026 08:55:01', device: 'ERP System', apiKey: 'ERP Integration', status: 'Success', statusColor: 'success', shipment: 'SHP-4816', hasLocation: false, updated: true },
  { id: 10, time: 'Apr 8, 2026 08:52:38', device: 'GPS Tracker #403', apiKey: 'Production Webhook', status: 'Error', statusColor: 'error', shipment: 'SHP-4815', hasLocation: true, updated: false },
];

export default function VNextWebhookLogs() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateRange, setDateRange] = useState('24h');

  const filtered = LOGS.filter(l => {
    if (statusFilter !== 'all') {
      const map: Record<string, string> = { success: 'Success', error: 'Error', skipped: 'Skipped', notfound: 'Not Found' };
      if (l.status !== map[statusFilter]) return false;
    }
    if (search) {
      const q = search.toLowerCase();
      return l.device.toLowerCase().includes(q) || (l.shipment && l.shipment.toLowerCase().includes(q)) || l.apiKey.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <>
      <div className="vn-page-header">
        <div>
          <h1>Webhook Logs</h1>
        </div>
      </div>

      {/* Stats */}
      <div className="vn-stats">
        <div className="vn-stat">
          <div className="vn-stat-icon primary">
            <span className="material-icons">list_alt</span>
          </div>
          <div>
            <div className="vn-stat-value">2,341</div>
            <div className="vn-stat-label">Total</div>
          </div>
        </div>
        <div className="vn-stat">
          <div className="vn-stat-icon success">
            <span className="material-icons">check_circle</span>
          </div>
          <div>
            <div className="vn-stat-value">2,198</div>
            <div className="vn-stat-label">Successful</div>
          </div>
        </div>
        <div className="vn-stat">
          <div className="vn-stat-icon error">
            <span className="material-icons">error</span>
          </div>
          <div>
            <div className="vn-stat-value">89</div>
            <div className="vn-stat-label">Errors</div>
          </div>
        </div>
        <div className="vn-stat">
          <div className="vn-stat-icon info">
            <span className="material-icons">update</span>
          </div>
          <div>
            <div className="vn-stat-value">1,847</div>
            <div className="vn-stat-label">Updates</div>
          </div>
        </div>
      </div>

      {/* Logs Table */}
      <div className="vn-card">
        <div className="vn-card-header">
          <h2>Logs</h2>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input
              className="vn-input"
              placeholder="Search device, shipment..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ width: 200 }}
            />
            <select className="vn-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="all">All Statuses</option>
              <option value="success">Success</option>
              <option value="error">Error</option>
              <option value="skipped">Skipped</option>
              <option value="notfound">Not Found</option>
            </select>
            <select className="vn-select" value={dateRange} onChange={e => setDateRange(e.target.value)}>
              <option value="24h">Last 24 hours</option>
              <option value="48h">Last 48 hours</option>
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
            </select>
          </div>
        </div>
        <div className="vn-card-body" style={{ padding: 0 }}>
          <div className="vn-table-wrap">
            <table className="vn-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Device</th>
                  <th>Status</th>
                  <th>Shipment</th>
                  <th>Location</th>
                  <th>Updated</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(l => (
                  <tr
                    key={l.id}
                    style={{ cursor: 'pointer' }}
                    onClick={() => console.log('Open detail for log', l.id, l)}
                  >
                    <td style={{ fontSize: 13, fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{l.time}</td>
                    <td>
                      <div style={{ fontWeight: 500 }}>{l.device}</div>
                      <div style={{ fontSize: 12, color: 'var(--on-surface-variant)' }}>{l.apiKey}</div>
                    </td>
                    <td>
                      <span className={`vn-chip ${l.statusColor}`}>{l.status}</span>
                    </td>
                    <td>
                      {l.shipment ? (
                        <span style={{ fontWeight: 500 }}>{l.shipment}</span>
                      ) : (
                        <span style={{ color: 'var(--on-surface-variant)' }}>&mdash;</span>
                      )}
                    </td>
                    <td>
                      {l.hasLocation ? (
                        <span className="material-icons" style={{ fontSize: 18, color: 'var(--success)' }}>location_on</span>
                      ) : (
                        <span style={{ color: 'var(--on-surface-variant)' }}>&mdash;</span>
                      )}
                    </td>
                    <td>
                      {l.updated ? (
                        <span className="material-icons" style={{ fontSize: 18, color: 'var(--success)' }}>check_circle</span>
                      ) : (
                        <span style={{ color: 'var(--on-surface-variant)' }}>&mdash;</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        {/* Pagination */}
        <div className="vn-card-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderTop: '1px solid var(--outline-variant)' }}>
          <button className="vn-btn vn-btn-outline" style={{ fontSize: 13 }}>
            <span className="material-icons" style={{ fontSize: 16 }}>chevron_left</span>
            Previous
          </button>
          <span style={{ fontSize: 13, color: 'var(--on-surface-variant)' }}>Page 1 of 47</span>
          <button className="vn-btn vn-btn-outline" style={{ fontSize: 13 }}>
            Next
            <span className="material-icons" style={{ fontSize: 16 }}>chevron_right</span>
          </button>
        </div>
      </div>
    </>
  );
}
