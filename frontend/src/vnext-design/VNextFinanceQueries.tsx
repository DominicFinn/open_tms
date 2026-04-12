import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_URL } from '../api';

interface FinancialQuery {
  id: string;
  queryNumber: string;
  queryType: string;
  reason: string;
  description: string;
  status: string;
  disputedAmountCents: number | null;
  shipmentId: string | null;
  invoiceId: string | null;
  carrierInvoiceId: string | null;
  assigneeId: string | null;
  createdBy: string | null;
  createdAt: string;
  resolvedAt: string | null;
  adjustmentCents: number | null;
}

function formatMoney(cents: number): string {
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function statusChip(status: string): string {
  switch (status) {
    case 'raised': return 'warning';
    case 'investigating': return 'info';
    case 'resolved_adjusted': return 'success';
    case 'resolved_upheld': return 'secondary';
    case 'closed': return 'secondary';
    default: return 'secondary';
  }
}

function reasonLabel(reason: string): string {
  const map: Record<string, string> = {
    overcharge: 'Overcharge',
    service_failure: 'Service Failure',
    missing_pod: 'Missing POD',
    wrong_rate: 'Wrong Rate',
    damage_claim: 'Damage Claim',
    missing_items: 'Missing Items',
    temperature_excursion: 'Temp Excursion',
  };
  return map[reason] || reason;
}

export default function VNextFinanceQueries() {
  const navigate = useNavigate();
  const [queries, setQueries] = useState<FinancialQuery[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');

  useEffect(() => {
    fetch(`${API_URL}/api/v1/financial-queries`)
      .then(r => r.json())
      .then(j => setQueries(j.data || []))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const stats = {
    total: queries.length,
    open: queries.filter(q => ['raised', 'investigating'].includes(q.status)).length,
    adjusted: queries.filter(q => q.status === 'resolved_adjusted').length,
    totalDisputed: queries.filter(q => ['raised', 'investigating'].includes(q.status)).reduce((s, q) => s + (q.disputedAmountCents || 0), 0),
  };

  const filtered = queries.filter(q => {
    if (statusFilter !== 'all' && q.status !== statusFilter) return false;
    if (typeFilter !== 'all' && q.queryType !== typeFilter) return false;
    return true;
  });

  // Group by status for kanban-style display
  const columns = [
    { key: 'raised', label: 'Raised', color: 'var(--warning)' },
    { key: 'investigating', label: 'Investigating', color: 'var(--info)' },
    { key: 'resolved', label: 'Resolved', color: 'var(--success)' },
  ];

  if (loading) return <div className="vn-empty"><span className="material-icons" style={{ animation: 'spin 1s linear infinite' }}>refresh</span><h3>Loading...</h3></div>;
  if (error) return <div className="vn-alert vn-alert-error">{error}</div>;

  return (
    <>
      <div className="vn-page-header">
        <div>
          <h1>Queries & Disputes</h1>
          <p>{stats.open} open queries</p>
        </div>
      </div>

      <div className="vn-stats">
        <div className="vn-stat">
          <div className="vn-stat-icon primary"><span className="material-icons">help_outline</span></div>
          <div><div className="vn-stat-value">{stats.total}</div><div className="vn-stat-label">Total</div></div>
        </div>
        <div className="vn-stat">
          <div className="vn-stat-icon warning"><span className="material-icons">pending</span></div>
          <div><div className="vn-stat-value">{stats.open}</div><div className="vn-stat-label">Open</div></div>
        </div>
        <div className="vn-stat">
          <div className="vn-stat-icon success"><span className="material-icons">check_circle</span></div>
          <div><div className="vn-stat-value">{stats.adjusted}</div><div className="vn-stat-label">Adjusted</div></div>
        </div>
        <div className="vn-stat">
          <div className="vn-stat-icon error"><span className="material-icons">attach_money</span></div>
          <div><div className="vn-stat-value">{formatMoney(stats.totalDisputed)}</div><div className="vn-stat-label">Amount Disputed</div></div>
        </div>
      </div>

      <div className="vn-card">
        <div className="vn-filters">
          <select className="vn-filter-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="all">All Status</option>
            <option value="raised">Raised</option>
            <option value="investigating">Investigating</option>
            <option value="resolved_adjusted">Resolved (Adjusted)</option>
            <option value="resolved_upheld">Resolved (Upheld)</option>
            <option value="closed">Closed</option>
          </select>
          <select className="vn-filter-select" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
            <option value="all">All Types</option>
            <option value="customer_dispute">Customer Disputes</option>
            <option value="carrier_dispute">Carrier Disputes</option>
          </select>
        </div>

        {filtered.length === 0 ? (
          <div className="vn-empty"><span className="material-icons">help_outline</span><h3>No queries found</h3></div>
        ) : (
          <div className="vn-table-wrap">
            <table className="vn-table">
              <thead>
                <tr>
                  <th>Query #</th>
                  <th>Type</th>
                  <th>Reason</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Disputed</th>
                  <th style={{ textAlign: 'right' }}>Adjustment</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(q => (
                  <tr key={q.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/finance/queries/${q.id}`)}>
                    <td><span className="vn-table-id">{q.queryNumber}</span></td>
                    <td><span className={`vn-chip vn-chip-${q.queryType === 'customer_dispute' ? 'primary' : 'warning'}`}>{q.queryType === 'customer_dispute' ? 'Customer' : 'Carrier'}</span></td>
                    <td>{reasonLabel(q.reason)}</td>
                    <td><span className={`vn-chip vn-chip-${statusChip(q.status)}`}>{q.status.replace(/_/g, ' ')}</span></td>
                    <td style={{ textAlign: 'right' }}>{q.disputedAmountCents ? formatMoney(q.disputedAmountCents) : '—'}</td>
                    <td style={{ textAlign: 'right', color: q.adjustmentCents ? 'var(--success)' : 'var(--on-surface-variant)' }}>
                      {q.adjustmentCents ? formatMoney(q.adjustmentCents) : '—'}
                    </td>
                    <td className="vn-table-secondary">{new Date(q.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
