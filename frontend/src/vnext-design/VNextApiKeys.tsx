import React, { useState, useEffect } from 'react';
import { API_URL } from '../api';

export default function VNextApiKeys() {
  const [keys, setKeys] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [newKeyName, setNewKeyName] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [createdKey, setCreatedKey] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadKeys();
  }, []);

  async function loadKeys() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/api/v1/api-keys`);
      if (!res.ok) throw new Error('Failed to load API keys');
      const json = await res.json();
      setKeys(json.data || []);
    } catch (e: any) {
      setError(e.message || 'Failed to load API keys');
    } finally {
      setLoading(false);
    }
  }

  async function createKey() {
    if (!newKeyName.trim()) return;
    setCreating(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/api/v1/api-keys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newKeyName.trim() }),
      });
      if (!res.ok) throw new Error('Failed to create API key');
      const json = await res.json();
      const created = json.data;
      if (created?.key) {
        setCreatedKey(created.key);
      }
      setNewKeyName('');
      setShowCreate(false);
      await loadKeys();
    } catch (e: any) {
      setError(e.message || 'Failed to create API key');
    } finally {
      setCreating(false);
    }
  }

  async function toggleKey(k: any) {
    setError('');
    try {
      const res = await fetch(`${API_URL}/api/v1/api-keys/${k.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !k.active }),
      });
      if (!res.ok) throw new Error('Failed to update API key');
      await loadKeys();
    } catch (e: any) {
      setError(e.message || 'Failed to update API key');
    }
  }

  async function deleteKey(id: string) {
    if (!confirm('Are you sure you want to delete this API key?')) return;
    setError('');
    try {
      const res = await fetch(`${API_URL}/api/v1/api-keys/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete API key');
      await loadKeys();
    } catch (e: any) {
      setError(e.message || 'Failed to delete API key');
    }
  }

  const filtered = keys.filter(k => {
    if (!search) return true;
    return k.name?.toLowerCase().includes(search.toLowerCase());
  });

  const activeCount = keys.filter(k => k.active !== false).length;

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '48px' }}>
        <div className="loading-spinner" />
      </div>
    );
  }

  return (
    <>
      <div className="vn-page-header">
        <div>
          <h1>API Keys</h1>
        </div>
        <div className="vn-page-actions">
          <button className="vn-btn vn-btn-primary" onClick={() => setShowCreate(true)}>
            <span className="material-icons">add</span>
            Create API Key
          </button>
        </div>
      </div>

      {error && (
        <div className="alert alert-error" style={{ marginBottom: 16 }}>
          {error}
        </div>
      )}

      {createdKey && (
        <div className="alert alert-success" style={{ marginBottom: 16 }}>
          <div style={{ marginBottom: 8 }}>
            <strong>API Key Created!</strong> Copy it now — it will not be shown again.
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <code style={{
              fontFamily: 'monospace',
              fontSize: 14,
              background: 'var(--surface-container)',
              padding: '8px 12px',
              borderRadius: 4,
              flex: 1,
              wordBreak: 'break-all',
            }}>
              {createdKey}
            </code>
            <button
              className="vn-btn vn-btn-outline"
              onClick={() => {
                navigator.clipboard?.writeText(createdKey);
              }}
            >
              <span className="material-icons" style={{ fontSize: 18 }}>content_copy</span>
              Copy
            </button>
            <button
              className="vn-btn vn-btn-outline"
              onClick={() => setCreatedKey('')}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {showCreate && (
        <div className="vn-card" style={{ marginBottom: 16 }}>
          <div className="vn-card-header">
            <h2>Create New API Key</h2>
          </div>
          <div className="vn-card-body">
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                className="vn-input"
                placeholder="Key name (e.g. Production Webhook)"
                value={newKeyName}
                onChange={e => setNewKeyName(e.target.value)}
                style={{ flex: 1 }}
                onKeyDown={e => e.key === 'Enter' && createKey()}
              />
              <button
                className="vn-btn vn-btn-primary"
                onClick={createKey}
                disabled={creating || !newKeyName.trim()}
              >
                {creating ? 'Creating...' : 'Create'}
              </button>
              <button className="vn-btn vn-btn-outline" onClick={() => { setShowCreate(false); setNewKeyName(''); }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="vn-stats">
        <div className="vn-stat">
          <div className="vn-stat-icon primary">
            <span className="material-icons">vpn_key</span>
          </div>
          <div>
            <div className="vn-stat-value">{keys.length}</div>
            <div className="vn-stat-label">Total Keys</div>
          </div>
        </div>
        <div className="vn-stat">
          <div className="vn-stat-icon success">
            <span className="material-icons">check_circle</span>
          </div>
          <div>
            <div className="vn-stat-value">{activeCount}</div>
            <div className="vn-stat-label">Active</div>
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
              {API_URL}/api/v1/webhooks/inbound
            </div>
            <button
              className="vn-btn vn-btn-outline"
              onClick={() => navigator.clipboard?.writeText(`${API_URL}/api/v1/webhooks/inbound`)}
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
                          {k.prefix || k.key?.slice(0, 12) || '****'}...
                        </code>
                      </td>
                      <td>
                        <span className={`vn-chip ${k.active !== false ? 'success' : 'error'}`}>
                          {k.active !== false ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td style={{ fontSize: 13, color: 'var(--on-surface-variant)' }}>
                        {k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleString() : 'Never'}
                      </td>
                      <td style={{ fontSize: 13, color: 'var(--on-surface-variant)' }}>
                        {k.createdAt ? new Date(k.createdAt).toLocaleDateString() : '—'}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <button
                            className="vn-btn-icon"
                            title={k.active !== false ? 'Deactivate' : 'Activate'}
                            onClick={() => toggleKey(k)}
                          >
                            <span className="material-icons" style={{ fontSize: 18 }}>
                              {k.active !== false ? 'toggle_on' : 'toggle_off'}
                            </span>
                          </button>
                          <button className="vn-btn-icon" title="Delete" onClick={() => deleteKey(k.id)}>
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
