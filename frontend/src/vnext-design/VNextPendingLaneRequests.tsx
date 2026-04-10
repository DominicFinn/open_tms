import React, { useEffect, useState } from 'react';
import { API_URL } from '../api';

interface PendingLaneRequest {
  id: string;
  order?: { orderNumber?: string };
  origin?: { name: string; city: string; state: string };
  destination?: { name: string; city: string; state: string };
  serviceLevel?: string;
  requiresTemperatureControl?: boolean;
  requiresHazmat?: boolean;
  status: string;
  notes?: string;
  createdAt?: string;
}

function statusChipColor(status: string): string {
  const s = status?.toLowerCase().replace(/[_ ]/g, '');
  if (s === 'pending') return 'warning';
  if (s === 'approved') return 'success';
  if (s === 'rejected') return 'error';
  if (s === 'lanecreated') return 'info';
  return 'secondary';
}

function formatDate(d?: string): string {
  if (!d) return '\u2014';
  const date = new Date(d);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function VNextPendingLaneRequests() {
  const [requests, setRequests] = useState<PendingLaneRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const res = await fetch(`${API_URL}/api/v1/pending-lane-requests`);
        if (!res.ok) throw new Error(`Failed to load pending lane requests (${res.status})`);
        const json = await res.json();
        if (json.error) throw new Error(json.error);
        if (!cancelled) {
          setRequests(json.data || []);
          setError('');
        }
      } catch (err: any) {
        if (!cancelled) setError(err.message || 'Failed to load pending lane requests');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const filtered = requests.filter(r => {
    if (statusFilter !== 'all') {
      const sNorm = r.status?.toLowerCase().replace(/[_ ]/g, '');
      if (sNorm !== statusFilter) return false;
    }
    if (search) {
      const q = search.toLowerCase();
      const orderNum = (r.order?.orderNumber || '').toLowerCase();
      const originLabel = r.origin ? `${r.origin.name} ${r.origin.city} ${r.origin.state}`.toLowerCase() : '';
      const destLabel = r.destination ? `${r.destination.name} ${r.destination.city} ${r.destination.state}`.toLowerCase() : '';
      return orderNum.includes(q) || originLabel.includes(q) || destLabel.includes(q);
    }
    return true;
  });

  const counts = {
    total: requests.length,
    pending: requests.filter(r => r.status?.toLowerCase().replace(/[_ ]/g, '') === 'pending').length,
    approved: requests.filter(r => r.status?.toLowerCase().replace(/[_ ]/g, '') === 'approved').length,
    rejected: requests.filter(r => r.status?.toLowerCase().replace(/[_ ]/g, '') === 'rejected').length,
  };

  if (loading) {
    return (
      <div className="vn-empty">
        <span className="material-icons" style={{ animation: 'spin 1s linear infinite' }}>refresh</span>
        <h3>Loading...</h3>
      </div>
    );
  }

  if (error) {
    return (
      <div className="vn-alert vn-alert-error">
        <span className="material-icons">error</span>
        <div className="vn-alert-content">{error}</div>
      </div>
    );
  }

  return (
    <>
      <div className="vn-page-header">
        <div>
          <h1>Pending Lane Requests</h1>
          <p>{requests.length} requests</p>
        </div>
      </div>

      {/* Stats */}
      <div className="vn-stats">
        <div className="vn-stat">
          <div className="vn-stat-icon primary"><span className="material-icons">route</span></div>
          <div>
            <div className="vn-stat-value">{counts.total}</div>
            <div className="vn-stat-label">Total Requests</div>
          </div>
        </div>
        <div className="vn-stat">
          <div className="vn-stat-icon warning"><span className="material-icons">hourglass_empty</span></div>
          <div>
            <div className="vn-stat-value">{counts.pending}</div>
            <div className="vn-stat-label">Pending</div>
          </div>
        </div>
        <div className="vn-stat">
          <div className="vn-stat-icon success"><span className="material-icons">check_circle</span></div>
          <div>
            <div className="vn-stat-value">{counts.approved}</div>
            <div className="vn-stat-label">Approved</div>
          </div>
        </div>
        <div className="vn-stat">
          <div className="vn-stat-icon error"><span className="material-icons">cancel</span></div>
          <div>
            <div className="vn-stat-value">{counts.rejected}</div>
            <div className="vn-stat-label">Rejected</div>
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
              placeholder="Search by order, origin, destination..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ width: '100%' }}
            />
          </div>
          <select
            className="vn-filter-select"
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
          >
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="lanecreated">Lane Created</option>
          </select>
        </div>

        <div className="vn-table-wrap">
          <table className="vn-table">
            <thead>
              <tr>
                <th>Order</th>
                <th>Route</th>
                <th>Service Level</th>
                <th>Requirements</th>
                <th>Status</th>
                <th>Created</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', color: 'var(--on-surface-variant)', padding: 32 }}>
                    No pending lane requests found
                  </td>
                </tr>
              ) : (
                filtered.map(r => (
                  <tr key={r.id}>
                    <td>
                      <span className="vn-table-id">{r.order?.orderNumber || '\u2014'}</span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span className="vn-route-dot origin" style={{ width: 8, height: 8 }} />
                        <span style={{ fontSize: 13 }}>
                          {r.origin ? `${r.origin.city}, ${r.origin.state}` : '\u2014'}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                        <span className="vn-route-dot destination" style={{ width: 8, height: 8 }} />
                        <span style={{ fontSize: 12, color: 'var(--on-surface-variant)' }}>
                          {r.destination ? `${r.destination.city}, ${r.destination.state}` : '\u2014'}
                        </span>
                      </div>
                    </td>
                    <td style={{ fontSize: 13 }}>{r.serviceLevel || '\u2014'}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {r.requiresTemperatureControl && <span className="vn-chip vn-chip-secondary">Temp Ctrl</span>}
                        {r.requiresHazmat && <span className="vn-chip vn-chip-warning">Hazmat</span>}
                        {!r.requiresTemperatureControl && !r.requiresHazmat && '\u2014'}
                      </div>
                    </td>
                    <td>
                      <span className={`vn-chip vn-chip-${statusChipColor(r.status)}`}>{r.status}</span>
                    </td>
                    <td style={{ fontSize: 13, whiteSpace: 'nowrap' }}>{formatDate(r.createdAt)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        {r.status?.toLowerCase() === 'pending' && (
                          <>
                            <button className="vn-btn vn-btn-success vn-btn-sm">
                              <span className="material-icons">check</span>
                              Approve
                            </button>
                            <button className="vn-btn vn-btn-outline vn-btn-sm" style={{ color: 'var(--error)', borderColor: 'var(--error)' }}>
                              <span className="material-icons">close</span>
                              Reject
                            </button>
                          </>
                        )}
                        <button className="vn-btn-icon">
                          <span className="material-icons" style={{ fontSize: 18 }}>more_vert</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
