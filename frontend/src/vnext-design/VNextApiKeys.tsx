import React, { useState } from 'react';

const API_KEYS = [
  { id: 1, name: 'Production Webhook', prefix: 'otms_prod_8f3a', status: 'Active', statusColor: 'success', lastUsed: 'Apr 8, 2026 09:14', created: 'Jan 15, 2026', webhooks: 1204 },
  { id: 2, name: 'Staging Webhook', prefix: 'otms_stg_2c91', status: 'Active', statusColor: 'success', lastUsed: 'Apr 8, 2026 08:42', created: 'Feb 3, 2026', webhooks: 847 },
  { id: 3, name: 'Mobile App', prefix: 'otms_mob_5d7e', status: 'Active', statusColor: 'success', lastUsed: 'Apr 7, 2026 22:10', created: 'Mar 1, 2026', webhooks: 0 },
  { id: 4, name: 'ERP Integration', prefix: 'otms_erp_a1b4', status: 'Active', statusColor: 'success', lastUsed: 'Apr 8, 2026 09:01', created: 'Nov 20, 2025', webhooks: 290 },
  { id: 5, name: 'Customer Portal', prefix: 'otms_cust_7f2c', status: 'Active', statusColor: 'success', lastUsed: 'Apr 6, 2026 14:33', created: 'Dec 8, 2025', webhooks: 0 },
  { id: 6, name: 'Legacy System', prefix: 'otms_leg_9e0d', status: 'Inactive', statusColor: 'error', lastUsed: 'Feb 14, 2026 11:20', created: 'Jun 5, 2025', webhooks: 0 },
];

export default function VNextApiKeys() {
  const [search, setSearch] = useState('');

  const filtered = API_KEYS.filter(k => {
    if (!search) return true;
    return k.name.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <>
      <div className="vn-page-header">
        <div>
          <h1>API Keys</h1>
        </div>
        <div className="vn-page-actions">
          <button className="vn-btn vn-btn-primary">
            <span className="material-icons">add</span>
            Create API Key
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="vn-stats">
        <div className="vn-stat">
          <div className="vn-stat-icon primary">
            <span className="material-icons">vpn_key</span>
          </div>
          <div>
            <div className="vn-stat-value">8</div>
            <div className="vn-stat-label">Total Keys</div>
          </div>
        </div>
        <div className="vn-stat">
          <div className="vn-stat-icon success">
            <span className="material-icons">check_circle</span>
          </div>
          <div>
            <div className="vn-stat-value">6</div>
            <div className="vn-stat-label">Active</div>
          </div>
        </div>
        <div className="vn-stat">
          <div className="vn-stat-icon info">
            <span className="material-icons">webhook</span>
          </div>
          <div>
            <div className="vn-stat-value">2,341</div>
            <div className="vn-stat-label">Total Webhooks</div>
          </div>
        </div>
      </div>

      {/* Webhook Endpoint */}
      <div className="vn-card">
        <div className="vn-card-header">
          <h2>Webhook Endpoint</h2>
        </div>
        <div className="vn-card-body">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <div style={{
              flex: 1,
              fontFamily: 'monospace',
              fontSize: 13,
              background: 'var(--surface-container)',
              border: '1px solid var(--outline-variant)',
              borderRadius: 'var(--border-radius-sm)',
              padding: '10px 14px',
              color: 'var(--on-surface)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              https://api.opentms.com/v1/webhooks/inbound
            </div>
            <button
              className="vn-btn vn-btn-outline"
              onClick={() => navigator.clipboard?.writeText('https://api.opentms.com/v1/webhooks/inbound')}
            >
              <span className="material-icons" style={{ fontSize: 18 }}>content_copy</span>
              Copy
            </button>
          </div>
          <div style={{ display: 'flex', gap: '24px', fontSize: 13, color: 'var(--on-surface-variant)' }}>
            <div>
              <strong>Header:</strong>{' '}
              <code style={{ background: 'var(--surface-container)', padding: '2px 6px', borderRadius: 4 }}>X-API-Key: &lt;your-key&gt;</code>
            </div>
            <div>
              <strong>Or:</strong>{' '}
              <code style={{ background: 'var(--surface-container)', padding: '2px 6px', borderRadius: 4 }}>Authorization: Bearer &lt;your-key&gt;</code>
            </div>
          </div>
        </div>
      </div>

      {/* Keys Table */}
      <div className="vn-card">
        <div className="vn-card-header">
          <h2>API Keys</h2>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              className="vn-input"
              placeholder="Search keys..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ width: 200 }}
            />
          </div>
        </div>
        <div className="vn-card-body" style={{ padding: 0 }}>
          {filtered.length === 0 ? (
            <div className="vn-empty">
              <span className="material-icons">vpn_key</span>
              <h3>No API keys found</h3>
              <p>Create an API key to get started with integrations.</p>
            </div>
          ) : (
            <div className="vn-table-wrap">
              <table className="vn-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Key</th>
                    <th>Status</th>
                    <th>Last Used</th>
                    <th>Created</th>
                    <th style={{ textAlign: 'right' }}>Webhooks</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(k => (
                    <tr key={k.id}>
                      <td style={{ fontWeight: 500 }}>{k.name}</td>
                      <td>
                        <code style={{
                          fontFamily: 'monospace',
                          fontSize: 12,
                          background: 'var(--surface-container)',
                          padding: '2px 6px',
                          borderRadius: 4,
                        }}>
                          {k.prefix}...
                        </code>
                      </td>
                      <td>
                        <span className={`vn-chip ${k.statusColor}`}>{k.status}</span>
                      </td>
                      <td style={{ fontSize: 13, color: 'var(--on-surface-variant)' }}>{k.lastUsed}</td>
                      <td style={{ fontSize: 13, color: 'var(--on-surface-variant)' }}>{k.created}</td>
                      <td style={{ textAlign: 'right' }}>{k.webhooks.toLocaleString()}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <button className="vn-btn-icon" title={k.status === 'Active' ? 'Deactivate' : 'Activate'}>
                            <span className="material-icons" style={{ fontSize: 18 }}>
                              {k.status === 'Active' ? 'toggle_on' : 'toggle_off'}
                            </span>
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
