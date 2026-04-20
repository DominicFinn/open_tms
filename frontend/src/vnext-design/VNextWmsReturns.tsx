import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_URL } from '../api';

interface Rma {
  id: string;
  rmaNumber: string;
  customerId: string;
  orderId: string;
  status: string;
  returnReason: string;
  suggestedRefundCents: number;
  actualRefundCents: number | null;
  requestedAt: string;
  completedAt: string | null;
  initiatedVia: string;
  _count: { lines: number };
}

function statusChip(s: string): string {
  switch (s) {
    case 'requested': return 'vn-chip-info';
    case 'authorized': return 'vn-chip-primary';
    case 'in_transit': return 'vn-chip-warning';
    case 'received': return 'vn-chip-warning';
    case 'inspecting': return 'vn-chip-warning';
    case 'dispositioning': return 'vn-chip-warning';
    case 'completed': return 'vn-chip-success';
    case 'rejected': return 'vn-chip-error';
    default: return 'vn-chip-secondary';
  }
}

function formatStatus(s: string): string {
  return s.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function formatReason(s: string): string {
  return s.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

export default function VNextWmsReturns() {
  const navigate = useNavigate();
  const [rmas, setRmas] = useState<Rma[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    setLoading(true);
    const url = statusFilter
      ? `${API_URL}/api/v1/rmas?status=${statusFilter}`
      : `${API_URL}/api/v1/rmas`;
    fetch(url)
      .then(r => r.json())
      .then(res => setRmas(res.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [statusFilter]);

  const filtered = rmas.filter(r =>
    !search || r.rmaNumber.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className="vn-page-header">
        <div>
          <h1>Returns</h1>
          <p className="vn-page-subtitle">Manage RMAs from request through disposition to refund</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="vn-btn vn-btn-outline" onClick={() => navigate('/wms/returns/refund-review')}>
            <span className="material-icons" style={{ fontSize: '18px', marginRight: '0.5rem' }}>account_balance</span>
            Refund Review
          </button>
          <button className="vn-btn vn-btn-primary" onClick={() => navigate('/wms/returns/create')}>
            <span className="material-icons" style={{ fontSize: '18px', marginRight: '0.5rem' }}>add</span>
            New RMA
          </button>
        </div>
      </div>

      <div className="vn-filters" style={{ marginBottom: '1rem' }}>
        <select className="vn-filter-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">All Statuses</option>
          <option value="requested">Requested</option>
          <option value="authorized">Authorized</option>
          <option value="in_transit">In Transit</option>
          <option value="received">Received</option>
          <option value="inspecting">Inspecting</option>
          <option value="dispositioning">Dispositioning</option>
          <option value="completed">Completed</option>
          <option value="rejected">Rejected</option>
        </select>
        <input className="vn-filter-input" placeholder="Search RMA number..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {loading ? (
        <div style={{ padding: '2rem', textAlign: 'center' }}><div className="vn-loading-spinner" /></div>
      ) : filtered.length === 0 ? (
        <div className="vn-card" style={{ textAlign: 'center', padding: '3rem' }}>
          <span className="material-icons" style={{ fontSize: '48px', color: 'var(--text-secondary)', marginBottom: '1rem', display: 'block' }}>assignment_return</span>
          <h3>No RMAs</h3>
          <p style={{ color: 'var(--text-secondary)' }}>Create an RMA manually or wait for customer portal requests.</p>
        </div>
      ) : (
        <div className="vn-table-wrap">
          <table className="vn-table">
            <thead>
              <tr>
                <th>RMA #</th><th>Status</th><th>Reason</th><th>Lines</th><th>Suggested Refund</th><th>Actual</th><th>Via</th><th>Requested</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/wms/returns/${r.id}`)}>
                  <td><strong>{r.rmaNumber}</strong></td>
                  <td><span className={`vn-chip ${statusChip(r.status)}`}>{formatStatus(r.status)}</span></td>
                  <td>{formatReason(r.returnReason)}</td>
                  <td>{r._count?.lines ?? 0}</td>
                  <td>${(r.suggestedRefundCents / 100).toFixed(2)}</td>
                  <td>{r.actualRefundCents != null ? `$${(r.actualRefundCents / 100).toFixed(2)}` : '--'}</td>
                  <td><span className="vn-chip vn-chip-secondary" style={{ fontSize: '0.75rem' }}>{formatStatus(r.initiatedVia)}</span></td>
                  <td>{new Date(r.requestedAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
