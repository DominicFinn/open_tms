import React, { useState, useEffect } from 'react';
import { API_URL } from '../api';

export default function VNextOutboundLogs() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [integrationFilter, setIntegrationFilter] = useState('all');
  const [stats, setStats] = useState<{ total: number; successful: number; errors: number; pending: number }>({
    total: 0, successful: 0, errors: 0, pending: 0,
  });
  const [integrationNames, setIntegrationNames] = useState<string[]>([]);

  useEffect(() => {
    loadLogs();
  }, [page, statusFilter]);

  useEffect(() => {
    loadStats();
  }, []);

  async function loadStats() {
    try {
      const res = await fetch(`${API_URL}/api/v1/outbound-integration-logs/stats`);
      if (res.ok) {
        const json = await res.json();
        if (json.data) setStats(json.data);
      }
    } catch {
      // Stats endpoint may not exist
    }
  }

  async function loadLogs() {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page: String(page), limit: '50' });
      if (statusFilter !== 'all') params.set('status', statusFilter);
      const res = await fetch(`${API_URL}/api/v1/outbound-integration-logs?${params}`);
      if (!res.ok) throw new Error('Failed to load outbound logs');
      const json = await res.json();
      const data = json.data || [];
      const items = Array.isArray(data) ? data : data.items || [];
      setLogs(items);
      if (data.totalPages) setTotalPages(data.totalPages);
      else if (data.total) setTotalPages(Math.ceil(data.total / 50));
      else if (json.meta?.totalPages) setTotalPages(json.meta.totalPages);

      // Extract unique integration names for filter
      const names = [...new Set(items.map((l: any) => l.integrationName || l.integration).filter(Boolean))] as string[];
      if (names.length > 0) setIntegrationNames(names);

      // Derive stats from data if stats endpoint didn't work
      if (stats.total === 0 && items.length > 0) {
        setStats({
          total: items.length,
          successful: items.filter((l: any) => (l.status || '').toLowerCase() === 'success').length,
          errors: items.filter((l: any) => (l.status || '').toLowerCase() === 'error').length,
          pending: items.filter((l: any) => (l.status || '').toLowerCase() === 'pending').length,
        });
      }
    } catch (e: any) {
      setError(e.message || 'Failed to load outbound logs');
    } finally {
      setLoading(false);
    }
  }

  const filtered = logs.filter(l => {
    const intName = l.integrationName || l.integration || '';
    if (integrationFilter !== 'all' && intName !== integrationFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return intName.toLowerCase().includes(q)
        || (l.shipmentId || l.shipment || '').toLowerCase().includes(q)
        || (l.error || '').toLowerCase().includes(q);
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

      {error && (
        <div className="alert alert-error" style={{ marginBottom: 16 }}>
          {error}
        </div>
      )}

      {/* Stats */}
      <div className="vn-stats">
        <div className="vn-stat">
          <div className="vn-stat-icon primary"><span className="material-icons">send</span></div>
          <div>
            <div className="vn-stat-value">{stats.total.toLocaleString()}</div>
            <div className="vn-stat-label">Total Sent</div>
          </div>
        </div>
        <div className="vn-stat">
          <div className="vn-stat-icon success"><span className="material-icons">check_circle</span></div>
          <div>
            <div className="vn-stat-value">{stats.successful.toLocaleString()}</div>
            <div className="vn-stat-label">Successful</div>
          </div>
        </div>
        <div className="vn-stat">
          <div className="vn-stat-icon error"><span className="material-icons">error</span></div>
          <div>
            <div className="vn-stat-value">{stats.errors.toLocaleString()}</div>
            <div className="vn-stat-label">Errors</div>
          </div>
        </div>
        <div className="vn-stat">
          <div className="vn-stat-icon warning"><span className="material-icons">schedule</span></div>
          <div>
            <div className="vn-stat-value">{stats.pending.toLocaleString()}</div>
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
          <select className="vn-filter-select" value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}>
            <option value="all">All Statuses</option>
            <option value="success">Success</option>
            <option value="error">Error</option>
            <option value="pending">Pending</option>
          </select>
          <select className="vn-filter-select" value={integrationFilter} onChange={e => setIntegrationFilter(e.target.value)}>
            <option value="all">All Integrations</option>
            {integrationNames.map(name => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '48px' }}>
            <div className="loading-spinner" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="vn-empty">
            <span className="material-icons">send</span>
            <h3>No outbound logs found</h3>
            <p>Logs will appear here when outbound integrations send requests.</p>
          </div>
        ) : (
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
                {filtered.map(l => {
                  const statusText = l.status || (l.responseCode ? (l.responseCode < 400 ? 'Success' : 'Error') : 'Pending');
                  const statusColor = statusText.toLowerCase() === 'success' ? 'success' : statusText.toLowerCase() === 'error' ? 'error' : 'warning';
                  const responseCode = l.responseCode || l.response;
                  return (
                    <tr key={l.id}>
                      <td style={{ whiteSpace: 'nowrap', fontSize: 13 }}>
                        {l.createdAt ? new Date(l.createdAt).toLocaleString() : l.time || '—'}
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{l.integrationName || l.integration || '—'}</div>
                        <div style={{ fontSize: 12, color: 'var(--on-surface-variant)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.url || ''}</div>
                      </td>
                      <td>
                        {(l.shipmentId || l.shipment) ? (
                          <span className="vn-table-id">{l.shipmentId || l.shipment}</span>
                        ) : (
                          <span style={{ color: 'var(--on-surface-variant)' }}>&mdash;</span>
                        )}
                      </td>
                      <td><span className={`vn-chip vn-chip-${statusColor}`}>{statusText}</span></td>
                      <td>
                        {responseCode != null ? (
                          <span style={{ fontWeight: 600, fontFamily: 'monospace', fontSize: 13, color: responseCode < 400 ? 'var(--color-success)' : 'var(--color-error)' }}>
                            {responseCode}
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
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderTop: '1px solid var(--border-color)', fontSize: 13 }}>
          <button
            className="vn-btn vn-btn-outline vn-btn-sm"
            disabled={page <= 1}
            onClick={() => setPage(p => Math.max(1, p - 1))}
          >
            <span className="material-icons" style={{ fontSize: 16 }}>chevron_left</span>
            Previous
          </button>
          <span style={{ color: 'var(--on-surface-variant)' }}>Page {page} of {totalPages}</span>
          <button
            className="vn-btn vn-btn-outline vn-btn-sm"
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
