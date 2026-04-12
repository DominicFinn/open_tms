import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { API_URL } from '../api';

interface FinancialSummary {
  invoices: { total: number; draft: number; sent: number; overdue: number; totalCents: number; paidCents: number; balanceCents: number };
  carrierInvoices: { total: number; received: number; discrepancy: number; approved: number; totalCents: number };
  quotes: { total: number; draft: number; sent: number; accepted: number };
  queries: { total: number; raised: number; investigating: number };
}

function formatMoney(cents: number): string {
  const abs = Math.abs(cents);
  if (abs >= 100000000) return `$${(cents / 100000000).toFixed(1)}M`;
  if (abs >= 100000) return `$${(cents / 100000).toFixed(0)}K`;
  return `$${(cents / 100).toFixed(2)}`;
}

export default function VNextFinanceDashboard() {
  const [summary, setSummary] = useState<FinancialSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [invRes, ciRes, qteRes, qryRes] = await Promise.all([
          fetch(`${API_URL}/api/v1/invoices`),
          fetch(`${API_URL}/api/v1/carrier-invoices`),
          fetch(`${API_URL}/api/v1/quotes`),
          fetch(`${API_URL}/api/v1/financial-queries`),
        ]);

        const invoices = (await invRes.json()).data || [];
        const carrierInvoices = (await ciRes.json()).data || [];
        const quotes = (await qteRes.json()).data || [];
        const queries = (await qryRes.json()).data || [];

        if (!cancelled) {
          setSummary({
            invoices: {
              total: invoices.length,
              draft: invoices.filter((i: any) => i.status === 'draft').length,
              sent: invoices.filter((i: any) => i.status === 'sent').length,
              overdue: invoices.filter((i: any) => i.status === 'overdue' || (i.status === 'sent' && new Date(i.dueDate) < new Date())).length,
              totalCents: invoices.reduce((s: number, i: any) => s + (i.totalCents || 0), 0),
              paidCents: invoices.reduce((s: number, i: any) => s + (i.paidCents || 0), 0),
              balanceCents: invoices.reduce((s: number, i: any) => s + (i.balanceCents || 0), 0),
            },
            carrierInvoices: {
              total: carrierInvoices.length,
              received: carrierInvoices.filter((i: any) => i.status === 'received').length,
              discrepancy: carrierInvoices.filter((i: any) => i.status === 'discrepancy').length,
              approved: carrierInvoices.filter((i: any) => i.status === 'approved').length,
              totalCents: carrierInvoices.reduce((s: number, i: any) => s + (i.totalCents || 0), 0),
            },
            quotes: {
              total: quotes.length,
              draft: quotes.filter((q: any) => q.status === 'draft').length,
              sent: quotes.filter((q: any) => q.status === 'sent').length,
              accepted: quotes.filter((q: any) => q.status === 'accepted').length,
            },
            queries: {
              total: queries.length,
              raised: queries.filter((q: any) => q.status === 'raised').length,
              investigating: queries.filter((q: any) => q.status === 'investigating').length,
            },
          });
        }
      } catch (e: any) {
        if (!cancelled) setError(e.message || 'Failed to load data');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="vn-empty">
        <span className="material-icons" style={{ animation: 'spin 1s linear infinite' }}>refresh</span>
        <h3>Loading...</h3>
      </div>
    );
  }

  if (error) return <div className="vn-alert vn-alert-error">{error}</div>;

  const s = summary!;

  return (
    <>
      <div className="vn-page-header">
        <div>
          <h1>Finance Dashboard</h1>
          <p>Accounts receivable, payable, quotes, and disputes</p>
        </div>
        <div className="vn-page-actions">
          <Link to="/finance/quotes" className="vn-btn vn-btn-primary" style={{ textDecoration: 'none' }}>
            <span className="material-icons">add</span>
            New Quote
          </Link>
        </div>
      </div>

      {/* AR Stats */}
      <h3 style={{ margin: '0 0 12px', color: 'var(--on-surface-variant)' }}>Accounts Receivable</h3>
      <div className="vn-stats">
        <div className="vn-stat">
          <div className="vn-stat-icon primary"><span className="material-icons">receipt</span></div>
          <div>
            <div className="vn-stat-value">{formatMoney(s.invoices.balanceCents)}</div>
            <div className="vn-stat-label">Outstanding Balance</div>
          </div>
        </div>
        <div className="vn-stat">
          <div className="vn-stat-icon warning"><span className="material-icons">edit_note</span></div>
          <div>
            <div className="vn-stat-value">{s.invoices.draft}</div>
            <div className="vn-stat-label">Draft Invoices</div>
          </div>
        </div>
        <div className="vn-stat">
          <div className="vn-stat-icon info"><span className="material-icons">send</span></div>
          <div>
            <div className="vn-stat-value">{s.invoices.sent}</div>
            <div className="vn-stat-label">Sent / Awaiting Payment</div>
          </div>
        </div>
        <div className="vn-stat">
          <div className="vn-stat-icon error"><span className="material-icons">warning</span></div>
          <div>
            <div className="vn-stat-value">{s.invoices.overdue}</div>
            <div className="vn-stat-label">Overdue</div>
          </div>
        </div>
      </div>

      {/* AP Stats */}
      <h3 style={{ margin: '24px 0 12px', color: 'var(--on-surface-variant)' }}>Accounts Payable</h3>
      <div className="vn-stats">
        <div className="vn-stat">
          <div className="vn-stat-icon primary"><span className="material-icons">local_shipping</span></div>
          <div>
            <div className="vn-stat-value">{formatMoney(s.carrierInvoices.totalCents)}</div>
            <div className="vn-stat-label">Total Carrier Invoices</div>
          </div>
        </div>
        <div className="vn-stat">
          <div className="vn-stat-icon warning"><span className="material-icons">inbox</span></div>
          <div>
            <div className="vn-stat-value">{s.carrierInvoices.received}</div>
            <div className="vn-stat-label">Pending Review</div>
          </div>
        </div>
        <div className="vn-stat">
          <div className="vn-stat-icon error"><span className="material-icons">error_outline</span></div>
          <div>
            <div className="vn-stat-value">{s.carrierInvoices.discrepancy}</div>
            <div className="vn-stat-label">Discrepancies</div>
          </div>
        </div>
        <div className="vn-stat">
          <div className="vn-stat-icon success"><span className="material-icons">check_circle</span></div>
          <div>
            <div className="vn-stat-value">{s.carrierInvoices.approved}</div>
            <div className="vn-stat-label">Approved for Payment</div>
          </div>
        </div>
      </div>

      {/* Quick links */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginTop: 24 }}>
        {/* Quotes card */}
        <div className="vn-card" style={{ padding: 20 }}>
          <h3 style={{ margin: '0 0 12px' }}>Quotes</h3>
          <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
            <div><span style={{ fontWeight: 600, fontSize: 24 }}>{s.quotes.total}</span><br/><small style={{ color: 'var(--on-surface-variant)' }}>Total</small></div>
            <div><span style={{ fontWeight: 600, fontSize: 24 }}>{s.quotes.draft}</span><br/><small style={{ color: 'var(--on-surface-variant)' }}>Draft</small></div>
            <div><span style={{ fontWeight: 600, fontSize: 24 }}>{s.quotes.accepted}</span><br/><small style={{ color: 'var(--on-surface-variant)' }}>Accepted</small></div>
          </div>
          <Link to="/finance/quotes" className="vn-btn vn-btn-secondary" style={{ textDecoration: 'none', width: '100%', justifyContent: 'center' }}>
            View Quotes
          </Link>
        </div>

        {/* Disputes card */}
        <div className="vn-card" style={{ padding: 20 }}>
          <h3 style={{ margin: '0 0 12px' }}>Queries & Disputes</h3>
          <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
            <div><span style={{ fontWeight: 600, fontSize: 24 }}>{s.queries.raised}</span><br/><small style={{ color: 'var(--on-surface-variant)' }}>Open</small></div>
            <div><span style={{ fontWeight: 600, fontSize: 24 }}>{s.queries.investigating}</span><br/><small style={{ color: 'var(--on-surface-variant)' }}>Investigating</small></div>
          </div>
          <Link to="/finance/queries" className="vn-btn vn-btn-secondary" style={{ textDecoration: 'none', width: '100%', justifyContent: 'center' }}>
            View Queries
          </Link>
        </div>
      </div>
    </>
  );
}
