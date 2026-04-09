import React, { useState, useEffect } from 'react';
import { API_URL } from '../api';

export default function VNextWebhookLogs() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateRange, setDateRange] = useState('24h');
  const [stats, setStats] = useState<{ total: number; successful: number; errors: number; updates: number }>({
    total: 0, successful: 0, errors: 0, updates: 0,
  });

  useEffect(() => {
    loadLogs();
  }, [page, statusFilter]);

  useEffect(() => {
    loadStats();
  }, []);

  async function loadStats() {
    try {
      const res = await fetch(`${API_URL}/api/v1/webhook-logs/stats`);
      if (res.ok) {
        const json = await res.json();
        if (json.data) setStats(json.data);
      }
    } catch {
      // Stats endpoint may not exist, derive from data if needed
    }
  }

  async function loadLogs() {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page: String(page), limit: '50' });
      if (statusFilter !== 'all') params.set('status', statusFilter);
      const res = await fetch(`${API_URL}/api/v1/webhook-logs?${params}`);
      if (!res.ok) throw new Error('Failed to load webhook logs');
      const json = await res.json();
      const data = json.data || [];
      setLogs(Array.isArray(data) ? data : data.items || []);
      if (data.totalPages) setTotalPages(data.totalPages);
      else if (data.total) setTotalPages(Math.ceil(data.total / 50));
      else if (json.meta?.totalPages) setTotalPages(json.meta.totalPages);

      // Derive stats from data if stats endpoint didn't work
      if (stats.total === 0 && Array.isArray(data) && data.length > 0) {
        setStats({
          total: data.length,
          successful: data.filter((l: any) => l.status === 'Success' || l.statusCode < 400).length,
          errors: data.filter((l: any) => l.status === 'Error' || (l.statusCode && l.statusCode >= 400)).length,
          updates: data.filter((l: any) => l.updated).length,
        });
      }
    } catch (e: any) {
      setError(e.message || 'Failed to load webhook logs');
    } finally {
      setLoading(false);
    }
  }

  const filtered = logs.filter(l => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (l.device || '').toLowerCase().includes(q)
      || (l.shipmentId || l.shipment || '').toLowerCase().includes(q)
      || (l.apiKeyName || l.apiKey || '').toLowerCase().includes(q);
  });

  return (
    <>
      <div className="vn-page-header">
        <div>
          <h1>Webhook Logs</h1>
        </div>
      </div>

      {error && (
        <div className="alert alert-error" style={{ marginBottom: 16 }}>
          {error}
        </div>
      )}

      {/* Stats */}
      <div className="vn-stats">
        <div className="vn-stat">
          <div className="vn-stat-icon primary">
            <span className="material-icons">list_alt</span>
          </div>
          <div>
            <div className="vn-stat-value">{stats.total.toLocaleString()}</div>
            <div className="vn-stat-label">Total</div>
          </div>
        </div>
        <div className="vn-stat">
          <div className="vn-stat-icon success">
            <span className="material-icons">check_circle</span>
          </div>
          <div>
            <div className="vn-stat-value">{stats.successful.toLocaleString()}</div>
            <div className="vn-stat-label">Successful</div>
          </div>
        </div>
        <div className="vn-stat">
          <div className="vn-stat-icon error">
            <span className="material-icons">error</span>
          </div>
          <div>
            <div className="vn-stat-value">{stats.errors.toLocaleString()}</div>
            <div className="vn-stat-label">Errors</div>
          </div>
        </div>
        <div className="vn-stat">
          <div className="vn-stat-icon info">
            <span className="material-icons">update</span>
          </div>
          <div>
            <div className="vn-stat-value">{stats.updates.toLocaleString()}</div>
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
            <select className="vn-select" value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}>
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
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '48px' }}>
              <div className="loading-spinner" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="vn-empty">
              <span className="material-icons">list_alt</span>
              <h3>No webhook logs found</h3>
              <p>Logs will appear here when webhooks are received.</p>
            </div>
          ) : (
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
                      <td style={{ fontSize: 13, fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                        {l.createdAt ? new Date(l.createdAt).toLocaleString() : l.time || '—'}
                      </td>
                      <td>
                        <div style={{ fontWeight: 500 }}>{l.device || l.source || '—'}</div>
                        <div style={{ fontSize: 12, color: 'var(--on-surface-variant)' }}>{l.apiKeyName || l.apiKey || ''}</div>
                      </td>
                      <td>
                        <span className={`vn-chip ${l.statusCode && l.statusCode < 400 ? 'success' : l.statusCode && l.statusCode >= 400 ? 'error' : l.status === 'Success' ? 'success' : l.status === 'Error' ? 'error' : 'warning'}`}>
                          {l.status || (l.statusCode ? (l.statusCode < 400 ? 'Success' : 'Error') : '—')}
                        </span>
                      </td>
                      <td>
                        {(l.shipmentId || l.shipment) ? (
                          <span style={{ fontWeight: 500 }}>{l.shipmentId || l.shipment}</span>
                        ) : (
                          <span style={{ color: 'var(--on-surface-variant)' }}>&mdash;</span>
                        )}
                      </td>
                      <td>
                        {l.hasLocation || l.latitude ? (
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
          )}
        </div>
        {/* Pagination */}
        <div className="vn-card-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderTop: '1px solid var(--outline-variant)' }}>
          <button
            className="vn-btn vn-btn-outline"
            style={{ fontSize: 13 }}
            disabled={page <= 1}
            onClick={() => setPage(p => Math.max(1, p - 1))}
          >
            <span className="material-icons" style={{ fontSize: 16 }}>chevron_left</span>
            Previous
          </button>
          <span style={{ fontSize: 13, color: 'var(--on-surface-variant)' }}>Page {page} of {totalPages}</span>
          <button
            className="vn-btn vn-btn-outline"
            style={{ fontSize: 13 }}
            disabled={page >= totalPages}
            onClick={() => setPage(p => p + 1)}
          >
            Next
            <span className="material-icons" style={{ fontSize: 16 }}>chevron_right</span>
          </button>
        </div>
      </div>
    </>
  );
}
