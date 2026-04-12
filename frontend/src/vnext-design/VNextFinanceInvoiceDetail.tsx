import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { API_URL } from '../api';

interface InvoiceLineItem {
  id: string;
  chargeType: string;
  description: string;
  quantity: number;
  unitPriceCents: number;
  totalCents: number;
  shipmentId?: string;
  freightClass?: string;
}

interface Payment {
  id: string;
  amountCents: number;
  paymentMethod?: string;
  referenceNumber?: string;
  receivedDate: string;
  notes?: string;
}

interface InvoiceData {
  id: string;
  invoiceNumber: string;
  status: string;
  customer: { id: string; name: string; billingEmail?: string; contactEmail?: string };
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  paidCents: number;
  balanceCents: number;
  currency: string;
  paymentTermsDays: number;
  issueDate: string;
  dueDate: string;
  sentAt?: string;
  paidAt?: string;
  notes?: string;
  internalNotes?: string;
  lineItems: InvoiceLineItem[];
  payments: Payment[];
}

function formatMoney(cents: number): string {
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function formatDate(d?: string): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
function statusChip(s: string): string {
  const m: Record<string, string> = { draft: 'secondary', approved: 'info', sent: 'primary', partial_paid: 'warning', paid: 'success', overdue: 'error', void: 'secondary', disputed: 'error' };
  return m[s] || 'secondary';
}

export default function VNextFinanceInvoiceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [invoice, setInvoice] = useState<InvoiceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('ach');
  const [paymentRef, setPaymentRef] = useState('');
  const [showPayment, setShowPayment] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/api/v1/invoices/${id}`);
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setInvoice(json.data);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [id]);

  const doAction = async (action: string, body?: any) => {
    setActionLoading(action);
    try {
      const res = await fetch(`${API_URL}/api/v1/invoices/${id}/${action}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : '{}',
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      await load();
    } catch (e: any) { alert(e.message); }
    finally { setActionLoading(''); }
  };

  const recordPayment = async () => {
    const cents = Math.round(parseFloat(paymentAmount) * 100);
    if (!cents || cents <= 0) { alert('Enter a valid amount'); return; }
    await doAction('payments', { amountCents: cents, paymentMethod, referenceNumber: paymentRef || undefined });
    setShowPayment(false);
    setPaymentAmount('');
    setPaymentRef('');
  };

  if (loading) return <div className="vn-empty"><span className="material-icons" style={{ animation: 'spin 1s linear infinite' }}>refresh</span><h3>Loading...</h3></div>;
  if (error || !invoice) return <div className="vn-alert vn-alert-error">{error || 'Invoice not found'}</div>;

  const i = invoice;
  const isPastDue = new Date(i.dueDate) < new Date() && !['paid', 'void'].includes(i.status);

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <button className="vn-btn vn-btn-ghost vn-btn-sm" onClick={() => navigate('/finance/invoices')}>
          <span className="material-icons">arrow_back</span> Invoices
        </button>
        <span style={{ color: 'var(--on-surface-variant)', fontSize: 13 }}>/ {i.invoiceNumber}</span>
      </div>

      <div className="vn-page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <h1>{i.invoiceNumber}</h1>
          <span className={`vn-chip vn-chip-${statusChip(i.status)}`}>{i.status.replace(/_/g, ' ')}</span>
          {isPastDue && <span className="vn-chip vn-chip-error">OVERDUE</span>}
        </div>
        <div className="vn-page-actions">
          {i.status === 'draft' && (
            <button className="vn-btn vn-btn-primary vn-btn-sm" onClick={() => doAction('approve')} disabled={!!actionLoading}>
              {actionLoading === 'approve' ? 'Approving...' : 'Approve'}
            </button>
          )}
          {['draft', 'approved'].includes(i.status) && (
            <button className="vn-btn vn-btn-primary vn-btn-sm" onClick={() => doAction('send')} disabled={!!actionLoading}>
              <span className="material-icons">send</span>
              {actionLoading === 'send' ? 'Sending...' : 'Send'}
            </button>
          )}
          {['sent', 'partial_paid', 'overdue'].includes(i.status) && (
            <button className="vn-btn vn-btn-success vn-btn-sm" onClick={() => setShowPayment(!showPayment)}>
              <span className="material-icons">payment</span> Record Payment
            </button>
          )}
          {i.paidCents === 0 && !['void', 'paid'].includes(i.status) && (
            <button className="vn-btn vn-btn-outline vn-btn-sm" onClick={() => { if (confirm('Void this invoice?')) doAction('void', { reason: 'Voided by user' }); }} disabled={!!actionLoading}>
              Void
            </button>
          )}
        </div>
      </div>

      {/* Payment form */}
      {showPayment && (
        <div className="vn-card" style={{ marginBottom: 16, padding: 20 }}>
          <h3 style={{ margin: '0 0 12px' }}>Record Payment</h3>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'end' }}>
            <div className="vn-field">
              <label className="vn-field-label">Amount ($)</label>
              <input className="vn-input" type="number" step="0.01" min="0.01" max={i.balanceCents / 100} value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} placeholder={`Max ${(i.balanceCents / 100).toFixed(2)}`} />
            </div>
            <div className="vn-field">
              <label className="vn-field-label">Method</label>
              <select className="vn-input" value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}>
                <option value="ach">ACH</option>
                <option value="wire">Wire</option>
                <option value="check">Check</option>
                <option value="credit_card">Credit Card</option>
              </select>
            </div>
            <div className="vn-field">
              <label className="vn-field-label">Reference #</label>
              <input className="vn-input" value={paymentRef} onChange={e => setPaymentRef(e.target.value)} placeholder="Check #, ACH ref..." />
            </div>
            <button className="vn-btn vn-btn-success" onClick={recordPayment} disabled={!!actionLoading}>
              {actionLoading === 'payments' ? 'Recording...' : 'Record'}
            </button>
            <button className="vn-btn vn-btn-ghost" onClick={() => setShowPayment(false)}>Cancel</button>
          </div>
        </div>
      )}

      <div className="vn-detail-grid">
        <div className="vn-detail-main">
          {/* Line Items */}
          <div className="vn-card" style={{ marginBottom: 24 }}>
            <div className="vn-card-header"><h2>Line Items</h2></div>
            <div className="vn-table-wrap">
              <table className="vn-table">
                <thead>
                  <tr><th>Description</th><th>Type</th><th style={{ textAlign: 'right' }}>Qty</th><th style={{ textAlign: 'right' }}>Unit Price</th><th style={{ textAlign: 'right' }}>Total</th></tr>
                </thead>
                <tbody>
                  {i.lineItems.map(li => (
                    <tr key={li.id}>
                      <td>{li.description}{li.freightClass && <span className="vn-table-secondary"> (Class {li.freightClass})</span>}</td>
                      <td><span className="vn-chip vn-chip-secondary">{li.chargeType.replace(/_/g, ' ')}</span></td>
                      <td style={{ textAlign: 'right' }}>{li.quantity}</td>
                      <td style={{ textAlign: 'right' }}>{formatMoney(li.unitPriceCents)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 500 }}>{formatMoney(li.totalCents)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr><td colSpan={4} style={{ textAlign: 'right', fontWeight: 600 }}>Subtotal</td><td style={{ textAlign: 'right', fontWeight: 600 }}>{formatMoney(i.subtotalCents)}</td></tr>
                  {i.taxCents > 0 && <tr><td colSpan={4} style={{ textAlign: 'right' }}>Tax</td><td style={{ textAlign: 'right' }}>{formatMoney(i.taxCents)}</td></tr>}
                  <tr><td colSpan={4} style={{ textAlign: 'right', fontWeight: 700, fontSize: 16 }}>Total</td><td style={{ textAlign: 'right', fontWeight: 700, fontSize: 16 }}>{formatMoney(i.totalCents)}</td></tr>
                  {i.paidCents > 0 && <tr><td colSpan={4} style={{ textAlign: 'right', color: 'var(--success)' }}>Paid</td><td style={{ textAlign: 'right', color: 'var(--success)' }}>-{formatMoney(i.paidCents)}</td></tr>}
                  <tr><td colSpan={4} style={{ textAlign: 'right', fontWeight: 700, color: i.balanceCents > 0 ? 'var(--error)' : 'var(--success)' }}>Balance Due</td><td style={{ textAlign: 'right', fontWeight: 700, color: i.balanceCents > 0 ? 'var(--error)' : 'var(--success)' }}>{formatMoney(i.balanceCents)}</td></tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Payments */}
          {i.payments.length > 0 && (
            <div className="vn-card" style={{ marginBottom: 24 }}>
              <div className="vn-card-header"><h2>Payment History</h2></div>
              <div className="vn-table-wrap">
                <table className="vn-table">
                  <thead><tr><th>Date</th><th>Method</th><th>Reference</th><th style={{ textAlign: 'right' }}>Amount</th><th>Notes</th></tr></thead>
                  <tbody>
                    {i.payments.map(p => (
                      <tr key={p.id}>
                        <td>{formatDate(p.receivedDate)}</td>
                        <td>{p.paymentMethod ?? '—'}</td>
                        <td className="vn-table-secondary">{p.referenceNumber ?? '—'}</td>
                        <td style={{ textAlign: 'right', fontWeight: 500, color: 'var(--success)' }}>{formatMoney(p.amountCents)}</td>
                        <td className="vn-table-secondary">{p.notes ?? ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="vn-detail-sidebar">
          <div className="vn-card" style={{ padding: 20 }}>
            <h3 style={{ margin: '0 0 16px' }}>Invoice Details</h3>
            <div className="vn-info-grid">
              <div className="vn-info-item"><label>Customer</label><span>{i.customer.name}</span></div>
              <div className="vn-info-item"><label>Issue Date</label><span>{formatDate(i.issueDate)}</span></div>
              <div className="vn-info-item"><label>Due Date</label><span style={{ color: isPastDue ? 'var(--error)' : undefined }}>{formatDate(i.dueDate)}</span></div>
              <div className="vn-info-item"><label>Payment Terms</label><span>Net {i.paymentTermsDays}</span></div>
              {i.sentAt && <div className="vn-info-item"><label>Sent</label><span>{formatDate(i.sentAt)}</span></div>}
              {i.paidAt && <div className="vn-info-item"><label>Paid</label><span>{formatDate(i.paidAt)}</span></div>}
              {i.notes && <div className="vn-info-item"><label>Notes</label><span>{i.notes}</span></div>}
              {i.internalNotes && <div className="vn-info-item"><label>Internal Notes</label><span style={{ fontStyle: 'italic' }}>{i.internalNotes}</span></div>}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
