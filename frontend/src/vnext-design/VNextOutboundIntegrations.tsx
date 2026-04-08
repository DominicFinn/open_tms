import React, { useState } from 'react';

const INTEGRATIONS = [
  { id: 1, name: 'FedEx EDI', description: 'EDI 204/214 carrier tender and status', type: 'Carrier', typeColor: 'warning', format: 'EDI X12', url: 'https://edi.fedex.com/as2/inbound', status: 'Active', statusColor: 'success', logs: 1042 },
  { id: 2, name: 'UPS Tracking API', description: 'Real-time tracking event push', type: 'Tracking', typeColor: 'info', format: 'JSON REST', url: 'https://api.ups.com/v2/tracking/events', status: 'Active', statusColor: 'success', logs: 856 },
  { id: 3, name: 'Customer ERP', description: 'Order and shipment status sync to SAP', type: 'Tracking', typeColor: 'info', format: 'JSON REST', url: 'https://erp.acmecorp.com/api/v1/shipments', status: 'Active', statusColor: 'success', logs: 423 },
  { id: 4, name: 'DHL Carrier Feed', description: 'Carrier rate and booking integration', type: 'Carrier', typeColor: 'warning', format: 'XML SOAP', url: 'https://xmlpi-ea.dhl.com/XMLShippingServlet', status: 'Active', statusColor: 'success', logs: 312 },
  { id: 5, name: 'Internal Analytics', description: 'Event stream to data warehouse', type: 'Tracking', typeColor: 'info', format: 'JSON REST', url: 'https://analytics.internal.opentms.com/ingest', status: 'Inactive', statusColor: 'error', logs: 0 },
  { id: 6, name: 'Slack Notifications', description: 'Alert channel for critical events', type: 'Carrier', typeColor: 'warning', format: 'JSON Webhook', url: 'https://hooks.slack.com/services/T0X/B0Y/abc123', status: 'Inactive', statusColor: 'error', logs: 87 },
];

export default function VNextOutboundIntegrations() {
  const [search, setSearch] = useState('');

  const filtered = INTEGRATIONS.filter(i => {
    if (!search) return true;
    const q = search.toLowerCase();
    return i.name.toLowerCase().includes(q) || i.description.toLowerCase().includes(q);
  });

  return (
    <>
      <div className="vn-page-header">
        <div>
          <h1>Outbound Integrations</h1>
        </div>
        <div className="vn-page-actions">
          <button className="vn-btn vn-btn-primary">
            <span className="material-icons">add</span>
            New Integration
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="vn-stats">
        <div className="vn-stat">
          <div className="vn-stat-icon primary">
            <span className="material-icons">send</span>
          </div>
          <div>
            <div className="vn-stat-value">6</div>
            <div className="vn-stat-label">Total</div>
          </div>
        </div>
        <div className="vn-stat">
          <div className="vn-stat-icon success">
            <span className="material-icons">check_circle</span>
          </div>
          <div>
            <div className="vn-stat-value">4</div>
            <div className="vn-stat-label">Active</div>
          </div>
        </div>
        <div className="vn-stat">
          <div className="vn-stat-icon warning">
            <span className="material-icons">local_shipping</span>
          </div>
          <div>
            <div className="vn-stat-value">3</div>
            <div className="vn-stat-label">Carrier</div>
          </div>
        </div>
        <div className="vn-stat">
          <div className="vn-stat-icon info">
            <span className="material-icons">gps_fixed</span>
          </div>
          <div>
            <div className="vn-stat-value">3</div>
            <div className="vn-stat-label">Tracking</div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="vn-card">
        <div className="vn-card-header">
          <h2>Integrations</h2>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              className="vn-input"
              placeholder="Search integrations..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ width: 200 }}
            />
          </div>
        </div>
        <div className="vn-card-body" style={{ padding: 0 }}>
          {filtered.length === 0 ? (
            <div className="vn-empty">
              <span className="material-icons">send</span>
              <h3>No integrations found</h3>
              <p>Create an outbound integration to push data to external systems.</p>
            </div>
          ) : (
            <div className="vn-table-wrap">
              <table className="vn-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Type</th>
                    <th>URL</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Logs</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(i => (
                    <tr key={i.id}>
                      <td>
                        <div style={{ fontWeight: 500 }}>{i.name}</div>
                        <div style={{ fontSize: 12, color: 'var(--on-surface-variant)' }}>{i.description}</div>
                      </td>
                      <td>
                        <span className={`vn-chip ${i.typeColor}`}>{i.type}</span>
                        <div style={{ fontSize: 11, color: 'var(--on-surface-variant)', marginTop: 2 }}>{i.format}</div>
                      </td>
                      <td>
                        <code style={{
                          fontFamily: 'monospace',
                          fontSize: 12,
                          color: 'var(--on-surface-variant)',
                          maxWidth: 240,
                          display: 'inline-block',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}>
                          {i.url}
                        </code>
                      </td>
                      <td>
                        <span className={`vn-chip ${i.statusColor}`}>{i.status}</span>
                      </td>
                      <td style={{ textAlign: 'right' }}>{i.logs.toLocaleString()}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <button className="vn-btn-icon" title={i.status === 'Active' ? 'Deactivate' : 'Activate'}>
                            <span className="material-icons" style={{ fontSize: 18 }}>
                              {i.status === 'Active' ? 'toggle_on' : 'toggle_off'}
                            </span>
                          </button>
                          <button className="vn-btn-icon" title="Edit">
                            <span className="material-icons" style={{ fontSize: 18 }}>edit</span>
                          </button>
                          <button className="vn-btn-icon" title="Delete">
                            <span className="material-icons" style={{ fontSize: 18, color: 'var(--error)' }}>delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
