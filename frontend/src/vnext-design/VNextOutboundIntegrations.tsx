import React, { useState, useEffect } from 'react';
import { API_URL } from '../api';

export default function VNextOutboundIntegrations() {
  const [integrations, setIntegrations] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', type: '', format: '', url: '' });
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadIntegrations();
  }, []);

  async function loadIntegrations() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/api/v1/outbound-integrations`);
      if (!res.ok) throw new Error('Failed to load outbound integrations');
      const json = await res.json();
      setIntegrations(json.data || []);
    } catch (e: any) {
      setError(e.message || 'Failed to load outbound integrations');
    } finally {
      setLoading(false);
    }
  }

  async function createIntegration() {
    if (!form.name.trim()) return;
    setCreating(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/api/v1/outbound-integrations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error('Failed to create integration');
      setForm({ name: '', description: '', type: '', format: '', url: '' });
      setShowCreate(false);
      await loadIntegrations();
    } catch (e: any) {
      setError(e.message || 'Failed to create integration');
    } finally {
      setCreating(false);
    }
  }

  async function toggleIntegration(i: any) {
    setError('');
    try {
      const res = await fetch(`${API_URL}/api/v1/outbound-integrations/${i.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !i.active }),
      });
      if (!res.ok) throw new Error('Failed to update integration');
      await loadIntegrations();
    } catch (e: any) {
      setError(e.message || 'Failed to update integration');
    }
  }

  async function deleteIntegration(id: string) {
    if (!confirm('Are you sure you want to delete this integration?')) return;
    setError('');
    try {
      const res = await fetch(`${API_URL}/api/v1/outbound-integrations/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete integration');
      await loadIntegrations();
    } catch (e: any) {
      setError(e.message || 'Failed to delete integration');
    }
  }

  const filtered = integrations.filter(i => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (i.name || '').toLowerCase().includes(q) || (i.description || '').toLowerCase().includes(q);
  });

  const activeCount = integrations.filter(i => i.active !== false).length;
  const carrierCount = integrations.filter(i => (i.type || '').toLowerCase() === 'carrier').length;
  const trackingCount = integrations.filter(i => (i.type || '').toLowerCase() === 'tracking').length;

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
          <h1>Outbound Integrations</h1>
        </div>
        <div className="vn-page-actions">
          <button className="vn-btn vn-btn-primary" onClick={() => setShowCreate(true)}>
            <span className="material-icons">add</span>
            New Integration
          </button>
        </div>
      </div>

      {error && (
        <div className="alert alert-error" style={{ marginBottom: 16 }}>
          {error}
        </div>
      )}

      {showCreate && (
        <div className="vn-card" style={{ marginBottom: 16 }}>
          <div className="vn-card-header">
            <h2>New Outbound Integration</h2>
          </div>
          <div className="vn-card-body">
            <div className="form-grid">
              <div>
                <label>Name</label>
                <input className="vn-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Integration name" />
              </div>
              <div>
                <label>Type</label>
                <input className="vn-input" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} placeholder="Carrier, Tracking, etc." />
              </div>
              <div>
                <label>Format</label>
                <input className="vn-input" value={form.format} onChange={e => setForm({ ...form, format: e.target.value })} placeholder="JSON REST, EDI X12, etc." />
              </div>
              <div>
                <label>URL</label>
                <input className="vn-input" value={form.url} onChange={e => setForm({ ...form, url: e.target.value })} placeholder="https://..." />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label>Description</label>
                <input className="vn-input" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Brief description" />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button className="vn-btn vn-btn-primary" onClick={createIntegration} disabled={creating || !form.name.trim()}>
                {creating ? 'Creating...' : 'Create'}
              </button>
              <button className="vn-btn vn-btn-outline" onClick={() => { setShowCreate(false); setForm({ name: '', description: '', type: '', format: '', url: '' }); }}>
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
            <span className="material-icons">send</span>
          </div>
          <div>
            <div className="vn-stat-value">{integrations.length}</div>
            <div className="vn-stat-label">Total</div>
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
        <div className="vn-stat">
          <div className="vn-stat-icon warning">
            <span className="material-icons">local_shipping</span>
          </div>
          <div>
            <div className="vn-stat-value">{carrierCount}</div>
            <div className="vn-stat-label">Carrier</div>
          </div>
        </div>
        <div className="vn-stat">
          <div className="vn-stat-icon info">
            <span className="material-icons">gps_fixed</span>
          </div>
          <div>
            <div className="vn-stat-value">{trackingCount}</div>
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
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(i => (
                    <tr key={i.id}>
                      <td>
                        <div style={{ fontWeight: 500 }}>{i.name}</div>
                        <div style={{ fontSize: 12, color: 'var(--on-surface-variant)' }}>{i.description || ''}</div>
                      </td>
                      <td>
                        <span className={`vn-chip ${(i.type || '').toLowerCase() === 'carrier' ? 'warning' : 'info'}`}>{i.type || '—'}</span>
                        {i.format && <div style={{ fontSize: 11, color: 'var(--on-surface-variant)', marginTop: 2 }}>{i.format}</div>}
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
                          {i.url || '—'}
                        </code>
                      </td>
                      <td>
                        <span className={`vn-chip ${i.active !== false ? 'success' : 'error'}`}>
                          {i.active !== false ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <button className="vn-btn-icon" title={i.active !== false ? 'Deactivate' : 'Activate'} onClick={() => toggleIntegration(i)}>
                            <span className="material-icons" style={{ fontSize: 18 }}>
                              {i.active !== false ? 'toggle_on' : 'toggle_off'}
                            </span>
                          </button>
                          <button className="vn-btn-icon" title="Delete" onClick={() => deleteIntegration(i.id)}>
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
