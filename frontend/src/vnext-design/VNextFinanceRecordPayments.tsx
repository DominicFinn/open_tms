import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_URL } from '../api';

interface OutstandingInvoice {
  id: string;
  invoiceNumber: string;
  customer: { name: string };
  status: string;
  totalCents: number;
  paidCents: number;
  balanceCents: number;
  dueDate: string;
}

function formatMoney(cents: number): string {
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function formatDate(d: string): string {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function VNextFinanceRecordPayments() {
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState<OutstandingInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  // Payment entries keyed by invoice ID
  const [payments, setPayments] = useState<Record<string, { amount: string; method: string; ref: string }>>({});
  const [processing, setProcessing] = useState(false);
  const [results, setResults] = useState<Array<{ invoiceNumber: string; success: boolean; message: string }>>([]);

  useEffect(() => {
    fetch(`${API_URL}/api/v1/invoices?status=sent`)
      .then(r => r.json())
      .then(j => {
        // Also fetch partial_paid and overdue
        return Promise.all([
          j,
          fetch(`${API_URL}/api/v1/invoices?status=partial_paid`).then(r => r.json()),
          fetch(`${API_URL}/api/v1/invoices?status=overdue`).then(r => r.json()),
        ]);
      })
      .then(([sent, partial, overdue]) => {
        const all = [...(sent.data || []), ...(partial.data || []), ...(overdue.data || [])];
        // Dedupe by ID and filter to those with balance
        const unique = [...new Map(all.map((i: any) => [i.id, i])).values()].filter((i: any) => i.balanceCents > 0);
        setInvoices(unique as OutstandingInvoice[]);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const filtered = invoices.filter(i => {
    if (!search) return true;
    const q = search.toLowerCase();
    return i.invoiceNumber.toLowerCase().includes(q) || i.customer.name.toLowerCase().includes(q);
  });

  const setPaymentField = (invoiceId: string, field: string, value: string) => {
    setPayments(prev => ({
      ...prev,
      [invoiceId]: { ...(prev[invoiceId] || { amount: '', method: 'ach', ref: '' }), [field]: value },
    }));
  };

  const payFullBalance = (inv: OutstandingInvoice) => {
    setPaymentField(inv.id, 'amount', (inv.balanceCents / 100).toFixed(2));
  };

  const entriesWithAmount = Object.entries(payments).filter(([_, p]) => p.amount && parseFloat(p.amount) > 0);
  const totalToApply = entriesWithAmount.reduce((s, [_, p]) => s + Math.round(parseFloat(p.amount) * 100), 0);

  const processPayments = async () => {
    if (entriesWithAmount.length === 0) return;
    setProcessing(true);
    setResults([]);
    const newResults: Array<{ invoiceNumber: string; success: boolean; message: string }> = [];

    for (const [invoiceId, payment] of entriesWithAmount) {
      const inv = invoices.find(i => i.id === invoiceId);
      if (!inv) continue;

      const amountCents = Math.round(parseFloat(payment.amount) * 100);
      try {
        const res = await fetch(`${API_URL}/api/v1/invoices/${invoiceId}/payments`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amountCents,
            paymentMethod: payment.method || 'ach',
            referenceNumber: payment.ref || undefined,
          }),
        });
        const json = await res.json();
        if (json.error) {
          newResults.push({ invoiceNumber: inv.invoiceNumber, success: false, message: json.error });
        } else {
          newResults.push({ invoiceNumber: inv.invoiceNumber, success: true, message: `${formatMoney(amountCents)} applied — ${json.data?.invoiceStatus}` });
        }
      } catch (e: any) {
        newResults.push({ invoiceNumber: inv.invoiceNumber, success: false, message: e.message });
      }
    }

    setResults(newResults);
    setPayments({});
    setProcessing(false);

    // Refresh the invoice list
    setLoading(true);
    fetch(`${API_URL}/api/v1/invoices?status=sent`)
      .then(r => r.json())
      .then(j => {
        return Promise.all([
          j,
          fetch(`${API_URL}/api/v1/invoices?status=partial_paid`).then(r => r.json()),
          fetch(`${API_URL}/api/v1/invoices?status=overdue`).then(r => r.json()),
        ]);
      })
      .then(([sent, partial, overdue]) => {
        const all = [...(sent.data || []), ...(partial.data || []), ...(overdue.data || [])];
        const unique = [...new Map(all.map((i: any) => [i.id, i])).values()].filter((i: any) => i.balanceCents > 0);
        setInvoices(unique as OutstandingInvoice[]);
      })
      .finally(() => setLoading(false));
  };

  if (loading && invoices.length === 0) return <div className="vn-empty"><span className="material-icons" style={{ animation: 'spin 1s linear infinite' }}>refresh</span><h3>Loading...</h3></div>;
  if (error) return <div className="vn-alert vn-alert-error">{error}</div>;

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <button className="vn-btn vn-btn-ghost vn-btn-sm" onClick={() => navigate('/finance/invoices')}>
          <span className="material-icons">arrow_back</span> Invoices
        </button>
        <span style={{ color: 'var(--on-surface-variant)', fontSize: 13 }}>/ Record Payments</span>
      </div>

      <div className="vn-page-header">
        <div>
          <h1>Record Payments</h1>
          <p>Enter payment amounts against outstanding invoices. Process a bank statement in one go.</p>
        </div>
      </div>

      {/* Results from last batch */}
      {results.length > 0 && (
        <div className="vn-card" style={{ marginBottom: 16, padding: 16 }}>
          <h3 style={{ margin: '0 0 8px' }}>Payment Results</h3>
          {results.map((r, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '4px 0' }}>
              <span className="material-icons" style={{ fontSize: 18, color: r.success ? 'var(--success)' : 'var(--error)' }}>
                {r.success ? 'check_circle' : 'error'}
              </span>
              <strong>{r.invoiceNumber}</strong>
              <span style={{ color: 'var(--on-surface-variant)' }}>{r.message}</span>
            </div>
          ))}
          <button className="vn-btn vn-btn-ghost vn-btn-sm" onClick={() => setResults([])} style={{ marginTop: 8 }}>Dismiss</button>
        </div>
      )}

      <div className="vn-card">
        <div className="vn-filters">
          <div className="vn-filter-group">
            <span className="material-icons">search</span>
            <input className="vn-filter-input" placeholder="Search by invoice # or customer..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          {entriesWithAmount.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontWeight: 500 }}>{entriesWithAmount.length} payment{entriesWithAmount.length > 1 ? 's' : ''} — {formatMoney(totalToApply)}</span>
              <button className="vn-btn vn-btn-success" onClick={processPayments} disabled={processing}>
                <span className="material-icons">payment</span>
                {processing ? 'Processing...' : 'Apply All Payments'}
              </button>
            </div>
          )}
        </div>

        {filtered.length === 0 ? (
          <div className="vn-empty"><span className="material-icons">check_circle</span><h3>No outstanding invoices</h3></div>
        ) : (
          <div className="vn-table-wrap">
            <table className="vn-table">
              <thead>
                <tr>
                  <th>Invoice #</th>
                  <th>Customer</th>
                  <th>Due Date</th>
                  <th style={{ textAlign: 'right' }}>Balance</th>
                  <th style={{ width: 140 }}>Amount ($)</th>
                  <th style={{ width: 100 }}>Method</th>
                  <th style={{ width: 140 }}>Reference</th>
                  <th style={{ width: 60 }}></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(inv => {
                  const p = payments[inv.id] || { amount: '', method: 'ach', ref: '' };
                  const isPastDue = new Date(inv.dueDate) < new Date();
                  return (
                    <tr key={inv.id}>
                      <td>
                        <span className="vn-table-id" style={{ cursor: 'pointer' }} onClick={() => navigate(`/finance/invoices/${inv.id}`)}>
                          {inv.invoiceNumber}
                        </span>
                      </td>
                      <td>{inv.customer.name}</td>
                      <td style={{ color: isPastDue ? 'var(--error)' : undefined }}>{formatDate(inv.dueDate)}{isPastDue && ' (overdue)'}</td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatMoney(inv.balanceCents)}</td>
                      <td>
                        <input className="vn-input" type="number" step="0.01" min="0" max={inv.balanceCents / 100}
                          value={p.amount} onChange={e => setPaymentField(inv.id, 'amount', e.target.value)}
                          placeholder="0.00" style={{ textAlign: 'right' }} />
                      </td>
                      <td>
                        <select className="vn-input" value={p.method} onChange={e => setPaymentField(inv.id, 'method', e.target.value)} style={{ padding: '4px 6px', fontSize: 12 }}>
                          <option value="ach">ACH</option>
                          <option value="wire">Wire</option>
                          <option value="check">Check</option>
                        </select>
                      </td>
                      <td>
                        <input className="vn-input" type="text" value={p.ref} onChange={e => setPaymentField(inv.id, 'ref', e.target.value)}
                          placeholder="Ref #" style={{ fontSize: 12 }} />
                      </td>
                      <td>
                        <button className="vn-btn vn-btn-ghost vn-btn-sm" onClick={() => payFullBalance(inv)} title="Pay full balance" style={{ padding: 4 }}>
                          <span className="material-icons" style={{ fontSize: 16 }}>check_circle</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
