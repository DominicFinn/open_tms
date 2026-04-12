import React, { useState, useEffect } from 'react';
import { API_URL } from '../api';

interface CarrierInvoice {
  id: string;
  invoiceNumber: string;
  carrierId: string;
  carrier: { name: string; scacCode: string | null };
  status: string;
  totalCents: number;
  approvedCents: number | null;
  currency: string;
  matchStatus: string;
  varianceCents: number | null;
  variancePercent: number | null;
  autoApproved: boolean;
  receivedDate: string;
  dueDate: string;
  lineItems: any[];
}

function formatMoney(cents: number): string {
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function statusChip(status: string): string {
  switch (status) {
    case 'received': return 'info';
    case 'matched': return 'success';
    case 'discrepancy': return 'error';
    case 'approved': return 'success';
    case 'scheduled': return 'warning';
    case 'paid': return 'success';
    case 'disputed': return 'error';
    default: return 'secondary';
  }
}

function matchChip(status: string): string {
  switch (status) {
    case 'matched': return 'success';
    case 'partial_match': return 'warning';
    case 'mismatch': return 'error';
    default: return 'secondary';
  }
}

export default function VNextFinanceCarrierInvoices() {
  const [invoices, setInvoices] = useState<CarrierInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    fetch(`${API_URL}/api/v1/carrier-invoices`)
      .then(r => r.json())
      .then(j => setInvoices(j.data || []))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const stats = {
    total: invoices.length,
    pendingReview: invoices.filter(i => ['received', 'discrepancy'].includes(i.status)).length,
    discrepancies: invoices.filter(i => i.status === 'discrepancy').length,
    totalDue: invoices.filter(i => ['approved', 'scheduled'].includes(i.status)).reduce((s, i) => s + (i.approvedCents ?? i.totalCents), 0),
  };

  const filtered = invoices.filter(i => {
    if (statusFilter !== 'all' && i.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return i.invoiceNumber.toLowerCase().includes(q) || i.carrier.name.toLowerCase().includes(q);
    }
    return true;
  });

  if (loading) return <div className="vn-empty"><span className="material-icons" style={{ animation: 'spin 1s linear infinite' }}>refresh</span><h3>Loading...</h3></div>;
  if (error) return <div className="vn-alert vn-alert-error">{error}</div>;

  return (
    <>
      <div className="vn-page-header">
        <div>
          <h1>Carrier Invoices</h1>
          <p>{invoices.length} carrier invoices</p>
        </div>
      </div>

      <div className="vn-stats">
        <div className="vn-stat">
          <div className="vn-stat-icon primary"><span className="material-icons">local_shipping</span></div>
          <div><div className="vn-stat-value">{stats.total}</div><div className="vn-stat-label">Total</div></div>
        </div>
        <div className="vn-stat">
          <div className="vn-stat-icon warning"><span className="material-icons">pending_actions</span></div>
          <div><div className="vn-stat-value">{stats.pendingReview}</div><div className="vn-stat-label">Pending Review</div></div>
        </div>
        <div className="vn-stat">
          <div className="vn-stat-icon error"><span className="material-icons">error_outline</span></div>
          <div><div className="vn-stat-value">{stats.discrepancies}</div><div className="vn-stat-label">Discrepancies</div></div>
        </div>
        <div className="vn-stat">
          <div className="vn-stat-icon info"><span className="material-icons">payments</span></div>
          <div><div className="vn-stat-value">{formatMoney(stats.totalDue)}</div><div className="vn-stat-label">Due for Payment</div></div>
        </div>
      </div>

      <div className="vn-card">
        <div className="vn-filters">
          <div className="vn-filter-group">
            <span className="material-icons">search</span>
            <input className="vn-filter-input" placeholder="Search carrier invoices..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="vn-filter-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="all">All Status</option>
            <option value="received">Received</option>
            <option value="matched">Matched</option>
            <option value="discrepancy">Discrepancy</option>
            <option value="approved">Approved</option>
            <option value="paid">Paid</option>
          </select>
        </div>

        {filtered.length === 0 ? (
          <div className="vn-empty"><span className="material-icons">local_shipping</span><h3>No carrier invoices found</h3></div>
        ) : (
          <div className="vn-table-wrap">
            <table className="vn-table">
              <thead>
                <tr>
                  <th>Invoice #</th>
                  <th>Carrier</th>
                  <th>Status</th>
                  <th>Match</th>
                  <th style={{ textAlign: 'right' }}>Amount</th>
                  <th style={{ textAlign: 'right' }}>Variance</th>
                  <th>Received</th>
                  <th>Due</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(inv => (
                  <tr key={inv.id}>
                    <td><span className="vn-table-id">{inv.invoiceNumber}</span></td>
                    <td>{inv.carrier.name}{inv.carrier.scacCode && <span className="vn-table-secondary"> ({inv.carrier.scacCode})</span>}</td>
                    <td>
                      <span className={`vn-chip vn-chip-${statusChip(inv.status)}`}>{inv.status}</span>
                      {inv.autoApproved && <span className="vn-chip vn-chip-info" style={{ marginLeft: 4, fontSize: 10 }}>auto</span>}
                    </td>
                    <td><span className={`vn-chip vn-chip-${matchChip(inv.matchStatus)}`}>{inv.matchStatus.replace(/_/g, ' ')}</span></td>
                    <td style={{ textAlign: 'right', fontWeight: 500 }}>{formatMoney(inv.totalCents)}</td>
                    <td style={{ textAlign: 'right', color: inv.varianceCents && inv.varianceCents > 0 ? 'var(--error)' : inv.varianceCents && inv.varianceCents < 0 ? 'var(--success)' : 'var(--on-surface-variant)' }}>
                      {inv.varianceCents ? `${inv.varianceCents > 0 ? '+' : ''}${formatMoney(inv.varianceCents)}` : '—'}
                      {inv.variancePercent ? ` (${inv.variancePercent}%)` : ''}
                    </td>
                    <td className="vn-table-secondary">{formatDate(inv.receivedDate)}</td>
                    <td className="vn-table-secondary">{formatDate(inv.dueDate)}</td>
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
