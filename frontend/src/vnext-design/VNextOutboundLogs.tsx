import React, { useState } from 'react';

const LOGS = [
  { id: 1, time: 'Apr 8, 10:42 AM', integration: 'FedEx EDI', url: 'https://edi.fedex.com/v2/shipments', shipment: 'SHP-4821', status: 'Success', statusColor: 'success', response: 200, error: null },
  { id: 2, time: 'Apr 8, 10:38 AM', integration: 'UPS Tracking', url: 'https://api.ups.com/tracking/v1/details', shipment: 'SHP-4819', status: 'Success', statusColor: 'success', response: 200, error: null },
  { id: 3, time: 'Apr 8, 10:35 AM', integration: 'FedEx EDI', url: 'https://edi.fedex.com/v2/shipments', shipment: 'SHP-4820', status: 'Error', statusColor: 'error', response: 500, error: 'Connection timeout after 30s — remote server did not respond' },
  { id: 4, time: 'Apr 8, 10:30 AM', integration: 'Customer Portal', url: 'https://portal.acmecorp.com/api/updates', shipment: 'SHP-4818', status: 'Success', statusColor: 'success', response: 201, error: null },
  { id: 5, time: 'Apr 8, 10:22 AM', integration: 'Webhook - Acme', url: 'https://hooks.acmecorp.com/tms/events', shipment: null, status: 'Pending', statusColor: 'warning', response: null, error: null },
  { id: 6, time: 'Apr 8, 10:15 AM', integration: 'QuickBooks Sync', url: 'https://api.quickbooks.intuit.com/v3/invoice', shipment: null, status: 'Success', statusColor: 'success', response: 200, error: null },
  { id: 7, time: 'Apr 8, 10:10 AM', integration: 'FedEx EDI', url: 'https://edi.fedex.com/v2/shipments', shipment: 'SHP-4817', status: 'Error', statusColor: 'error', response: 422, error: 'Invalid weight field: expected numeric but received string value' },
  { id: 8, time: 'Apr 8, 10:05 AM', integration: 'UPS Tracking', url: 'https://api.ups.com/tracking/v1/details', shipment: 'SHP-4816', status: 'Success', statusColor: 'success', response: 200, error: null },
];

export default function VNextOutboundLogs() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [integrationFilter, setIntegrationFilter] = useState('all');

  const filtered = LOGS.filter(l => {
    if (statusFilter !== 'all' && l.status.toLowerCase() !== statusFilter) return false;
    if (integrationFilter !== 'all' && l.integration !== integrationFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return l.integration.toLowerCase().includes(q) || (l.shipment || '').toLowerCase().includes(q) || (l.error || '').toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <>
      <div className="vn-page-header">
        <div>
          <h1>Outbound Logs</h1>
          <p>Integration request history</p>
        </div>
      </div>

      {/* Stats */}
      <div className="vn-stats">
        <div className="vn-stat">
          <div className="vn-stat-icon primary"><span className="material-icons">send</span></div>
          <div>
            <div className="vn-stat-value">1,203</div>
            <div className="vn-stat-label">Total Sent</div>
          </div>
        </div>
        <div className="vn-stat">
          <div className="vn-stat-icon success"><span className="material-icons">check_circle</span></div>
          <div>
            <div className="vn-stat-value">1,156</div>
            <div className="vn-stat-label">Successful</div>
          </div>
        </div>
        <div className="vn-stat">
          <div className="vn-stat-icon error"><span className="material-icons">error</span></div>
          <div>
            <div className="vn-stat-value">38</div>
            <div className="vn-stat-label">Errors</div>
          </div>
        </div>
        <div className="vn-stat">
          <div className="vn-stat-icon warning"><span className="material-icons">schedule</span></div>
          <div>
            <div className="vn-stat-value">9</div>
            <div className="vn-stat-label">Pending</div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="vn-card">
        <div className="vn-filters">
          <div className="vn-filter-group" style={{ flex: 1 }}>
            <span className="material-icons">search</span>
            <input
              className="vn-filter-input"
              placeholder="Search by integration, shipment, error..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ width: '100%' }}
            />
          </div>
          <select className="vn-filter-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="all">All Statuses</option>
            <option value="success">Success</option>
            <option value="error">Error</option>
            <option value="pending">Pending</option>
          </select>
          <select className="vn-filter-select" value={integrationFilter} onChange={e => setIntegrationFilter(e.target.value)}>
            <option value="all">All Integrations</option>
            <option value="FedEx EDI">FedEx EDI</option>
            <option value="UPS Tracking">UPS Tracking</option>
            <option value="Customer Portal">Customer Portal</option>
            <option value="Webhook - Acme">Webhook - Acme</option>
            <option value="QuickBooks Sync">QuickBooks Sync</option>
          </select>
        </div>

        <div className="vn-table-wrap">
          <table className="vn-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Integration</th>
                <th>Shipment</th>
                <th>Status</th>
                <th>Response</th>
                <th>Error</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(l => (
                <tr key={l.id}>
                  <td style={{ whiteSpace: 'nowrap', fontSize: 13 }}>{l.time}</td>
                  <td>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{l.integration}</div>
                    <div style={{ fontSize: 12, color: 'var(--on-surface-variant)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.url}</div>
                  </td>
                  <td>
                    {l.shipment ? (
                      <span className="vn-table-id">{l.shipment}</span>
                    ) : (
                      <span style={{ color: 'var(--on-surface-variant)' }}>&mdash;</span>
                    )}
                  </td>
                  <td><span className={`vn-chip vn-chip-${l.statusColor}`}>{l.status}</span></td>
                  <td>
                    {l.response != null ? (
                      <span style={{ fontWeight: 600, fontFamily: 'monospace', fontSize: 13, color: l.response < 400 ? 'var(--color-success)' : 'var(--color-error)' }}>
                        {l.response}
                      </span>
                    ) : (
                      <span style={{ color: 'var(--on-surface-variant)' }}>&mdash;</span>
                    )}
                  </td>
                  <td>
                    {l.error ? (
                      <span style={{ fontSize: 12, color: 'var(--color-error)', maxWidth: 250, display: 'inline-block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {l.error}
                      </span>
                    ) : (
                      <span style={{ color: 'var(--on-surface-variant)' }}>&mdash;</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderTop: '1px solid var(--border-color)', fontSize: 13 }}>
          <button className="vn-btn vn-btn-outline vn-btn-sm" disabled>
            <span className="material-icons" style={{ fontSize: 16 }}>chevron_left</span>
            Previous
          </button>
          <span style={{ color: 'var(--on-surface-variant)' }}>Page 1 of 24</span>
          <button className="vn-btn vn-btn-outline vn-btn-sm">
            Next
            <span className="material-icons" style={{ fontSize: 16 }}>chevron_right</span>
          </button>
        </div>
      </div>
    </>
  );
}
