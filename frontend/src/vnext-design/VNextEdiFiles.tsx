import React, { useState, useEffect } from 'react';
import { API_URL } from '../api';

export default function VNextEdiFiles() {
  const [files, setFiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [stats, setStats] = useState<{ total: number; completed: number; failed: number; pending: number; ordersCreated: number }>({
    total: 0, completed: 0, failed: 0, pending: 0, ordersCreated: 0,
  });
  const limit = 50;

  const filters = [
    { key: 'all', label: 'All' },
    { key: 'Pending', label: 'Pending' },
    { key: 'Processing', label: 'Processing' },
    { key: 'Completed', label: 'Completed' },
    { key: 'Failed', label: 'Failed' },
    { key: 'Duplicate', label: 'Duplicate' },
  ];

  useEffect(() => {
    loadFiles();
  }, [page, activeFilter]);

  useEffect(() => {
    loadStats();
  }, []);

  async function loadStats() {
    try {
      const res = await fetch(`${API_URL}/api/v1/edi-files/stats`);
      if (res.ok) {
        const json = await res.json();
        if (json.data) setStats(json.data);
      }
    } catch {
      // Stats endpoint may not exist
    }
  }

  async function loadFiles() {
    setLoading(true);
    setError('');
    try {
      const offset = (page - 1) * limit;
      const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
      if (activeFilter !== 'all') params.set('status', activeFilter);
      const res = await fetch(`${API_URL}/api/v1/edi-files?${params}`);
      if (!res.ok) throw new Error('Failed to load EDI files');
      const json = await res.json();
      const data = json.data || [];
      const items = Array.isArray(data) ? data : data.items || [];
      setFiles(items);

      if (data.total != null) setTotalPages(Math.ceil(data.total / limit));
      else if (data.totalPages) setTotalPages(data.totalPages);
      else if (json.meta?.total) setTotalPages(Math.ceil(json.meta.total / limit));

      // Derive stats from data if stats endpoint didn't work
      if (stats.total === 0 && items.length > 0) {
        setStats({
          total: items.length,
          completed: items.filter((f: any) => (f.status || '').toLowerCase() === 'completed').length,
          failed: items.filter((f: any) => (f.status || '').toLowerCase() === 'failed').length,
          pending: items.filter((f: any) => (f.status || '').toLowerCase() === 'pending' || (f.status || '').toLowerCase() === 'processing').length,
          ordersCreated: items.reduce((sum: number, f: any) => sum + (f.ordersCreated || f.orders || 0), 0),
        });
      }
    } catch (e: any) {
      setError(e.message || 'Failed to load EDI files');
    } finally {
      setLoading(false);
    }
  }

  async function reprocessFile(fileId: string) {
    setError('');
    try {
      const res = await fetch(`${API_URL}/api/v1/edi-files/${fileId}/reprocess`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to reprocess file');
      await loadFiles();
    } catch (e: any) {
      setError(e.message || 'Failed to reprocess file');
    }
  }

  function getStatusColor(status: string): string {
    const s = (status || '').toLowerCase();
    if (s === 'completed') return 'success';
    if (s === 'failed') return 'error';
    if (s === 'pending' || s === 'processing') return 'warning';
    if (s === 'duplicate') return 'secondary';
    return 'info';
  }

  function getSourceColor(source: string): string {
    const s = (source || '').toLowerCase();
    if (s === 'sftp') return 'info';
    if (s === 'api') return 'primary';
    if (s === 'manual') return 'secondary';
    return 'info';
  }

  return (
    <>
      <div className="vn-page-header">
        <div>
          <h1>EDI Files</h1>
          <p>Browse and manage EDI file processing</p>
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
          <div className="vn-stat-icon primary"><span className="material-icons">folder</span></div>
          <div>
            <div className="vn-stat-value">{stats.total.toLocaleString()}</div>
            <div className="vn-stat-label">Total Files</div>
          </div>
        </div>
        <div className="vn-stat">
          <div className="vn-stat-icon success"><span className="material-icons">check_circle</span></div>
          <div>
            <div className="vn-stat-value">{stats.completed.toLocaleString()}</div>
            <div className="vn-stat-label">Completed</div>
          </div>
        </div>
        <div className="vn-stat">
          <div className="vn-stat-icon error"><span className="material-icons">error</span></div>
          <div>
            <div className="vn-stat-value">{stats.failed.toLocaleString()}</div>
            <div className="vn-stat-label">Failed</div>
          </div>
        </div>
        <div className="vn-stat">
          <div className="vn-stat-icon warning"><span className="material-icons">hourglass_empty</span></div>
          <div>
            <div className="vn-stat-value">{stats.pending.toLocaleString()}</div>
            <div className="vn-stat-label">Pending</div>
          </div>
        </div>
        <div className="vn-stat">
          <div className="vn-stat-icon info"><span className="material-icons">receipt_long</span></div>
          <div>
            <div className="vn-stat-value">{stats.ordersCreated.toLocaleString()}</div>
            <div className="vn-stat-label">Orders Created</div>
          </div>
        </div>
      </div>

      {/* Filter buttons */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {filters.map(f => (
          <button
            key={f.key}
            className={`vn-btn vn-btn-sm ${activeFilter === f.key ? 'vn-btn-primary' : 'vn-btn-outline'}`}
            onClick={() => { setActiveFilter(f.key); setPage(1); }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="vn-card">
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '48px' }}>
            <div className="loading-spinner" />
          </div>
        ) : files.length === 0 ? (
          <div className="vn-empty">
            <span className="material-icons">folder</span>
            <h3>No EDI files found</h3>
            <p>Files will appear here when they are received from EDI partners.</p>
          </div>
        ) : (
          <div className="vn-table-wrap">
            <table className="vn-table">
              <thead>
                <tr>
                  <th>File Name</th>
                  <th>Partner</th>
                  <th>Source</th>
                  <th>Type</th>
                  <th>Size</th>
                  <th>Status</th>
                  <th>Orders</th>
                  <th>Date</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {files.map(f => {
                  const fileName = f.fileName || f.name || '—';
                  const partner = f.partnerName || f.partner || '—';
                  const source = f.source || '—';
                  const fileType = f.fileType || f.type || '—';
                  const size = f.fileSize || f.size || '—';
                  const status = f.status || '—';
                  const orders = f.ordersCreated || f.orders || 0;
                  const date = f.createdAt ? new Date(f.createdAt).toLocaleString() : f.date || '—';

                  return (
                    <tr key={f.id}>
                      <td>
                        <span style={{ fontSize: 13, maxWidth: 200, display: 'inline-block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={fileName}>
                          {fileName}
                        </span>
                      </td>
                      <td style={{ fontSize: 13 }}>{partner}</td>
                      <td><span className={`vn-chip vn-chip-${getSourceColor(source)}`}>{source}</span></td>
                      <td style={{ fontSize: 13 }}>{fileType}</td>
                      <td style={{ fontSize: 13 }}>{typeof size === 'number' ? `${(size / 1024).toFixed(1)} KB` : size}</td>
                      <td><span className={`vn-chip vn-chip-${getStatusColor(status)}`}>{status}</span></td>
                      <td style={{ fontWeight: 600, fontSize: 13 }}>
                        {orders > 0 ? orders : <span style={{ color: 'var(--on-surface-variant)' }}>&mdash;</span>}
                      </td>
                      <td style={{ whiteSpace: 'nowrap', fontSize: 12, color: 'var(--on-surface-variant)' }}>{date}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button className="vn-btn-icon" title="View">
                            <span className="material-icons" style={{ fontSize: 18 }}>visibility</span>
                          </button>
                          {(status || '').toLowerCase() === 'failed' && (
                            <button className="vn-btn-icon" title="Reprocess" onClick={() => reprocessFile(f.id)}>
                              <span className="material-icons" style={{ fontSize: 18 }}>refresh</span>
                            </button>
                          )}
                        </div>
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
