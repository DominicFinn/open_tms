import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { API_URL } from '../../api';
import { customerFetch } from './CustomerDashboard';

interface RmaSummary {
  id: string;
  rmaNumber: string;
  orderId: string;
  status: string;
  returnReason: string;
  suggestedRefundCents: number;
  actualRefundCents: number | null;
  createdAt: string;
  returnTrackingNumber: string | null;
  returnPickupScheduledAt: string | null;
  _count: { lines: number };
}

function statusChip(s: string): string {
  const m: Record<string, string> = {
    requested: 'info', authorized: 'primary', in_transit: 'info',
    received: 'warning', inspecting: 'warning', dispositioning: 'warning',
    completed: 'success', rejected: 'error',
  };
  return `vn-chip-${m[s] || 'secondary'}`;
}

function fmt(s: string): string {
  return s.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

export default function CustomerReturns() {
  const [rmas, setRmas] = useState<RmaSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (statusFilter) params.set('status', statusFilter);
    customerFetch(`${API_URL}/api/v1/customer-portal/rmas?${params}`)
      .then(r => r.json())
      .then(json => { setRmas(json.data?.rmas || []); setTotal(json.data?.total || 0); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [statusFilter]);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Returns</h1>
        <Link to="/customer-portal/returns/new" className="vn-btn vn-btn-primary vn-btn-sm">
          <span className="material-icons">add</span> Request Return
        </Link>
      </div>

      <div className="vn-card">
        <div className="vn-filters" style={{ padding: '8px 16px' }}>
          <select className="vn-filter-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="">All Statuses</option>
            <option value="requested">Requested</option>
            <option value="authorized">Authorized</option>
            <option value="in_transit">In Transit</option>
            <option value="received">Received</option>
            <option value="inspecting">Inspecting</option>
            <option value="dispositioning">Pending Refund</option>
            <option value="completed">Completed</option>
            <option value="rejected">Rejected</option>
          </select>
          <div style={{ marginLeft: 'auto', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            {total} return{total === 1 ? '' : 's'}
          </div>
        </div>
        <div className="vn-table-wrap">
          <table className="vn-table">
            <thead>
              <tr>
                <th>RMA Number</th>
                <th>Status</th>
                <th>Reason</th>
                <th>Lines</th>
                <th>Refund</th>
                <th>Return Tracking</th>
                <th>Requested</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={7} style={{ textAlign: 'center', padding: 24 }}><div className="vn-loading-spinner" /></td></tr>}
              {!loading && rmas.length === 0 && (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: 24, color: 'var(--text-secondary)' }}>
                  You have not requested any returns yet. <Link to="/customer-portal/returns/new">Request one now</Link>.
                </td></tr>
              )}
              {rmas.map(r => (
                <tr key={r.id}>
                  <td>
                    <Link className="vn-table-id" to={`/customer-portal/returns/${r.id}`}>{r.rmaNumber}</Link>
                  </td>
                  <td><span className={`vn-chip ${statusChip(r.status)}`}>{fmt(r.status)}</span></td>
                  <td>{fmt(r.returnReason)}</td>
                  <td>{r._count?.lines ?? 0}</td>
                  <td>
                    {r.actualRefundCents != null
                      ? <strong>${(r.actualRefundCents / 100).toFixed(2)}</strong>
                      : <span className="vn-table-secondary">${(r.suggestedRefundCents / 100).toFixed(2)} est.</span>}
                  </td>
                  <td>
                    {r.returnTrackingNumber
                      ? <span className="vn-table-secondary">{r.returnTrackingNumber}</span>
                      : <span className="vn-table-secondary">--</span>}
                  </td>
                  <td><span className="vn-table-secondary">{new Date(r.createdAt).toLocaleDateString()}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
