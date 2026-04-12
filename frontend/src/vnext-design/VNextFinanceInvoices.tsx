import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { API_URL } from '../api';

interface Invoice {
  id: string;
  invoiceNumber: string;
  customerId: string;
  customer: { name: string };
  status: string;
  totalCents: number;
  paidCents: number;
  balanceCents: number;
  currency: string;
  issueDate: string;
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
    case 'draft': return 'secondary';
    case 'approved': return 'info';
    case 'sent': return 'primary';
    case 'partial_paid': return 'warning';
    case 'paid': return 'success';
    case 'overdue': return 'error';
    case 'void': return 'secondary';
    case 'disputed': return 'error';
    default: return 'secondary';
  }
}

export default function VNextFinanceInvoices() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    fetch(`${API_URL}/api/v1/invoices`)
      .then(r => r.json())
      .then(j => setInvoices(j.data || []))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const stats = {
    total: invoices.length,
    outstanding: invoices.filter(i => ['sent', 'partial_paid', 'overdue'].includes(i.status)).reduce((s, i) => s + i.balanceCents, 0),
    overdue: invoices.filter(i => i.status === 'sent' && new Date(i.dueDate) < new Date()).length,
    draft: invoices.filter(i => i.status === 'draft').length,
  };

  const filtered = invoices.filter(i => {
    if (statusFilter !== 'all' && i.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return i.invoiceNumber.toLowerCase().includes(q) || i.customer.name.toLowerCase().includes(q);
    }
    return true;
  });

  if (loading) return <div className="vn-empty"><span className="material-icons" style={{ animation: 'spin 1s linear infinite' }}>refresh</span><h3>Loading...</h3></div>;
  if (error) return <div className="vn-alert vn-alert-error">{error}</div>;

  return (
    <>
      <div className="vn-page-header">
        <div>
          <h1>Invoices</h1>
          <p>{invoices.length} invoices</p>
        </div>
        <div className="vn-page-actions">
          <Link to="/finance/invoices/create" className="vn-btn vn-btn-primary" style={{ textDecoration: 'none' }}>
            <span className="material-icons">add</span>
            New Invoice
          </Link>
        </div>
      </div>

      <div className="vn-stats">
        <div className="vn-stat">
          <div className="vn-stat-icon primary"><span className="material-icons">receipt</span></div>
          <div><div className="vn-stat-value">{stats.total}</div><div className="vn-stat-label">Total</div></div>
        </div>
        <div className="vn-stat">
          <div className="vn-stat-icon warning"><span className="material-icons">account_balance_wallet</span></div>
          <div><div className="vn-stat-value">{formatMoney(stats.outstanding)}</div><div className="vn-stat-label">Outstanding</div></div>
        </div>
        <div className="vn-stat">
          <div className="vn-stat-icon error"><span className="material-icons">warning</span></div>
          <div><div className="vn-stat-value">{stats.overdue}</div><div className="vn-stat-label">Overdue</div></div>
        </div>
        <div className="vn-stat">
          <div className="vn-stat-icon info"><span className="material-icons">edit_note</span></div>
          <div><div className="vn-stat-value">{stats.draft}</div><div className="vn-stat-label">Drafts</div></div>
        </div>
      </div>

      <div className="vn-card">
        <div className="vn-filters">
          <div className="vn-filter-group">
            <span className="material-icons">search</span>
            <input className="vn-filter-input" placeholder="Search invoices..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="vn-filter-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="all">All Status</option>
            <option value="draft">Draft</option>
            <option value="approved">Approved</option>
            <option value="sent">Sent</option>
            <option value="partial_paid">Partial Paid</option>
            <option value="paid">Paid</option>
            <option value="overdue">Overdue</option>
            <option value="void">Void</option>
          </select>
        </div>

        {filtered.length === 0 ? (
          <div className="vn-empty"><span className="material-icons">receipt</span><h3>No invoices found</h3></div>
        ) : (
          <div className="vn-table-wrap">
            <table className="vn-table">
              <thead>
                <tr>
                  <th>Invoice #</th>
                  <th>Customer</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Total</th>
                  <th style={{ textAlign: 'right' }}>Balance</th>
                  <th>Issue Date</th>
                  <th>Due Date</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(inv => (
                  <tr key={inv.id} style={{ cursor: 'pointer' }}>
                    <td><span className="vn-table-id">{inv.invoiceNumber}</span></td>
                    <td>{inv.customer.name}</td>
                    <td><span className={`vn-chip vn-chip-${statusChip(inv.status)}`}>{inv.status.replace(/_/g, ' ')}</span></td>
                    <td style={{ textAlign: 'right', fontWeight: 500 }}>{formatMoney(inv.totalCents)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 500, color: inv.balanceCents > 0 ? 'var(--error)' : 'var(--success)' }}>
                      {formatMoney(inv.balanceCents)}
                    </td>
                    <td className="vn-table-secondary">{formatDate(inv.issueDate)}</td>
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
