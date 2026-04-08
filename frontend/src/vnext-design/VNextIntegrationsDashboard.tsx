import React from 'react';
import { Link } from 'react-router-dom';

const QUEUES = [
  { name: 'events', queued: 4, active: 1, deadLetter: 0 },
  { name: 'outbound', queued: 8, active: 2, deadLetter: 1 },
  { name: 'edi-polling', queued: 0, active: 0, deadLetter: 0 },
];

const ACTIVITY = [
  { icon: 'check_circle', color: 'var(--success)', text: 'EDI 850 processed from Acme Corp', time: '2 min ago' },
  { icon: 'error', color: 'var(--error)', text: 'Outbound 856 failed to FedEx endpoint', time: '8 min ago' },
  { icon: 'vpn_key', color: 'var(--info)', text: "API key 'Production' authenticated", time: '12 min ago' },
  { icon: 'check_circle', color: 'var(--success)', text: 'Webhook delivered to Customer ERP', time: '15 min ago' },
  { icon: 'info', color: 'var(--info)', text: 'EDI polling cycle completed — 0 new messages', time: '20 min ago' },
  { icon: 'error', color: 'var(--error)', text: 'DHL Carrier Feed connection timeout', time: '34 min ago' },
];

export default function VNextIntegrationsDashboard() {
  return (
    <>
      <div className="vn-page-header">
        <div>
          <h1>Integrations</h1>
          <p>Monitor and manage all integration channels</p>
        </div>
      </div>

      {/* Stats */}
      <div className="vn-stats">
        <div className="vn-stat">
          <div className="vn-stat-icon primary">
            <span className="material-icons">extension</span>
          </div>
          <div>
            <div className="vn-stat-value">9</div>
            <div className="vn-stat-label">Active Integrations</div>
          </div>
        </div>
        <div className="vn-stat">
          <div className="vn-stat-icon success">
            <span className="material-icons">vpn_key</span>
          </div>
          <div>
            <div className="vn-stat-value">6</div>
            <div className="vn-stat-label">API Keys</div>
          </div>
        </div>
        <div className="vn-stat">
          <div className="vn-stat-icon warning">
            <span className="material-icons">queue</span>
          </div>
          <div>
            <div className="vn-stat-value">12</div>
            <div className="vn-stat-label">Queue Depth</div>
          </div>
        </div>
        <div className="vn-stat">
          <div className="vn-stat-icon error">
            <span className="material-icons">error</span>
          </div>
          <div>
            <div className="vn-stat-value">3</div>
            <div className="vn-stat-label">Failed</div>
          </div>
        </div>
        <div className="vn-stat">
          <div className="vn-stat-icon info">
            <span className="material-icons">swap_horiz</span>
          </div>
          <div>
            <div className="vn-stat-value">5</div>
            <div className="vn-stat-label">EDI Partners</div>
          </div>
        </div>
      </div>

      {/* 2-column grid */}
      <div className="vn-grid-2">
        {/* Queue Status */}
        <div className="vn-card">
          <div className="vn-card-header">
            <h2>Queue Status</h2>
          </div>
          <div className="vn-card-body" style={{ padding: 0 }}>
            <div className="vn-table-wrap">
              <table className="vn-table">
                <thead>
                  <tr>
                    <th>Queue Name</th>
                    <th style={{ textAlign: 'right' }}>Queued</th>
                    <th style={{ textAlign: 'right' }}>Active</th>
                    <th style={{ textAlign: 'right' }}>Dead Letter</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {QUEUES.map(q => (
                    <tr key={q.name}>
                      <td style={{ fontFamily: 'monospace', fontWeight: 500 }}>{q.name}</td>
                      <td style={{ textAlign: 'right' }}>{q.queued}</td>
                      <td style={{ textAlign: 'right' }}>{q.active}</td>
                      <td style={{ textAlign: 'right', color: q.deadLetter > 0 ? 'var(--error)' : undefined, fontWeight: q.deadLetter > 0 ? 600 : undefined }}>
                        {q.deadLetter}
                      </td>
                      <td>
                        <button className="vn-btn vn-btn-outline" style={{ fontSize: 12, padding: '4px 10px' }}>
                          <span className="material-icons" style={{ fontSize: 14 }}>replay</span>
                          Retry
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="vn-card">
          <div className="vn-card-header">
            <h2>Recent Activity</h2>
          </div>
          <div className="vn-card-body">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {ACTIVITY.map((a, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                  <span className="material-icons" style={{ fontSize: 20, color: a.color, marginTop: 2 }}>{a.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, color: 'var(--on-surface)' }}>{a.text}</div>
                    <div style={{ fontSize: 12, color: 'var(--on-surface-variant)' }}>{a.time}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="vn-card" style={{ marginTop: '16px' }}>
        <div className="vn-card-header">
          <h2>Quick Actions</h2>
        </div>
        <div className="vn-card-body">
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <Link to="/vnext/integrations/api-keys" className="vn-btn vn-btn-outline">
              <span className="material-icons">vpn_key</span>
              Manage API Keys
            </Link>
            <Link to="/vnext/integrations/outbound" className="vn-btn vn-btn-outline">
              <span className="material-icons">send</span>
              Outbound Integrations
            </Link>
            <Link to="/vnext/integrations/webhook-logs" className="vn-btn vn-btn-outline">
              <span className="material-icons">list_alt</span>
              Webhook Logs
            </Link>
            <Link to="/vnext/integrations/edi-partners" className="vn-btn vn-btn-outline">
              <span className="material-icons">swap_horiz</span>
              EDI Partners
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
