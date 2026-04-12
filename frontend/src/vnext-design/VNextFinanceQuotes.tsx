import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { API_URL } from '../api';

interface Quote {
  id: string;
  quoteNumber: string;
  customerId: string;
  customer: { name: string };
  status: string;
  serviceLevel: string;
  totalRevenueCents: number;
  totalCostCents: number;
  marginCents: number;
  marginPercent: string;
  currency: string;
  validUntil: string;
  createdAt: string;
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
    case 'sent': return 'info';
    case 'accepted': return 'success';
    case 'declined': return 'error';
    case 'expired': return 'warning';
    case 'superseded': return 'secondary';
    default: return 'secondary';
  }
}

export default function VNextFinanceQuotes() {
  const navigate = useNavigate();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    fetch(`${API_URL}/api/v1/quotes`)
      .then(r => r.json())
      .then(j => setQuotes(j.data || []))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const stats = {
    total: quotes.length,
    active: quotes.filter(q => ['draft', 'sent'].includes(q.status)).length,
    accepted: quotes.filter(q => q.status === 'accepted').length,
    totalRevenue: quotes.filter(q => q.status === 'accepted').reduce((s, q) => s + q.totalRevenueCents, 0),
  };

  const filtered = quotes.filter(q => {
    if (statusFilter !== 'all' && q.status !== statusFilter) return false;
    if (search) {
      const s = search.toLowerCase();
      return q.quoteNumber.toLowerCase().includes(s) || q.customer.name.toLowerCase().includes(s);
    }
    return true;
  });

  if (loading) return <div className="vn-empty"><span className="material-icons" style={{ animation: 'spin 1s linear infinite' }}>refresh</span><h3>Loading...</h3></div>;
  if (error) return <div className="vn-alert vn-alert-error">{error}</div>;

  return (
    <>
      <div className="vn-page-header">
        <div>
          <h1>Quotes</h1>
          <p>{quotes.length} quotes</p>
        </div>
        <div className="vn-page-actions">
          <Link to="/finance/quotes/create" className="vn-btn vn-btn-primary" style={{ textDecoration: 'none' }}>
            <span className="material-icons">add</span> New Quote
          </Link>
        </div>
      </div>

      <div className="vn-stats">
        <div className="vn-stat">
          <div className="vn-stat-icon primary"><span className="material-icons">request_quote</span></div>
          <div><div className="vn-stat-value">{stats.total}</div><div className="vn-stat-label">Total</div></div>
        </div>
        <div className="vn-stat">
          <div className="vn-stat-icon info"><span className="material-icons">pending</span></div>
          <div><div className="vn-stat-value">{stats.active}</div><div className="vn-stat-label">Active</div></div>
        </div>
        <div className="vn-stat">
          <div className="vn-stat-icon success"><span className="material-icons">handshake</span></div>
          <div><div className="vn-stat-value">{stats.accepted}</div><div className="vn-stat-label">Accepted</div></div>
        </div>
        <div className="vn-stat">
          <div className="vn-stat-icon success"><span className="material-icons">attach_money</span></div>
          <div><div className="vn-stat-value">{formatMoney(stats.totalRevenue)}</div><div className="vn-stat-label">Won Revenue</div></div>
        </div>
      </div>

      <div className="vn-card">
        <div className="vn-filters">
          <div className="vn-filter-group">
            <span className="material-icons">search</span>
            <input className="vn-filter-input" placeholder="Search quotes..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="vn-filter-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="all">All Status</option>
            <option value="draft">Draft</option>
            <option value="sent">Sent</option>
            <option value="accepted">Accepted</option>
            <option value="declined">Declined</option>
            <option value="expired">Expired</option>
          </select>
        </div>

        {filtered.length === 0 ? (
          <div className="vn-empty"><span className="material-icons">request_quote</span><h3>No quotes found</h3></div>
        ) : (
          <div className="vn-table-wrap">
            <table className="vn-table">
              <thead>
                <tr>
                  <th>Quote #</th>
                  <th>Customer</th>
                  <th>Status</th>
                  <th>Service</th>
                  <th style={{ textAlign: 'right' }}>Revenue</th>
                  <th style={{ textAlign: 'right' }}>Cost</th>
                  <th style={{ textAlign: 'right' }}>Margin</th>
                  <th>Valid Until</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(q => (
                  <tr key={q.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/finance/quotes/${q.id}`)}>
                    <td><span className="vn-table-id">{q.quoteNumber}</span></td>
                    <td>{q.customer.name}</td>
                    <td><span className={`vn-chip vn-chip-${statusChip(q.status)}`}>{q.status}</span></td>
                    <td><span className="vn-chip vn-chip-secondary">{q.serviceLevel}</span></td>
                    <td style={{ textAlign: 'right', fontWeight: 500 }}>{formatMoney(q.totalRevenueCents)}</td>
                    <td style={{ textAlign: 'right' }} className="vn-table-secondary">{formatMoney(q.totalCostCents)}</td>
                    <td style={{ textAlign: 'right', color: q.marginCents >= 0 ? 'var(--success)' : 'var(--error)' }}>
                      {formatMoney(q.marginCents)} <small>({q.marginPercent}%)</small>
                    </td>
                    <td className="vn-table-secondary">
                      {new Date(q.validUntil) < new Date() && q.status !== 'accepted'
                        ? <span style={{ color: 'var(--error)' }}>Expired</span>
                        : formatDate(q.validUntil)
                      }
                    </td>
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
