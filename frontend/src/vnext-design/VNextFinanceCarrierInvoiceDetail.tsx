import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { API_URL } from '../api';

interface LineItem {
  id: string;
  chargeType: string;
  description: string;
  amountCents: number;
  expectedAmountCents: number | null;
  varianceCents: number | null;
  matchStatus: string;
  shipmentId?: string;
  freightClass?: string;
  billedWeight?: number;
  actualWeight?: number;
}

interface CarrierInvoiceData {
  id: string;
  invoiceNumber: string;
  status: string;
  carrier: { id: string; name: string; scacCode?: string };
  totalCents: number;
  approvedCents: number | null;
  paidCents: number;
  currency: string;
  matchStatus: string;
  varianceCents: number | null;
  variancePercent: number | null;
  autoApproved: boolean;
  receivedDate: string;
  dueDate: string;
  approvedBy?: string;
  approvedAt?: string;
  paidAt?: string;
  paymentReference?: string;
  notes?: string;
  lineItems: LineItem[];
}

function formatMoney(cents: number): string {
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function formatDate(d?: string): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
function statusChip(s: string): string {
  const m: Record<string, string> = { received: 'info', matched: 'success', discrepancy: 'error', approved: 'success', scheduled: 'warning', paid: 'success', disputed: 'error' };
  return m[s] || 'secondary';
}
function matchChip(s: string): string {
  const m: Record<string, string> = { matched: 'success', variance: 'warning', unmatched: 'error', pending: 'secondary', partial_match: 'warning', mismatch: 'error' };
  return m[s] || 'secondary';
}

export default function VNextFinanceCarrierInvoiceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [invoice, setInvoice] = useState<CarrierInvoiceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState('');

  const load = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/api/v1/carrier-invoices/${id}`);
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
      const res = await fetch(`${API_URL}/api/v1/carrier-invoices/${id}/${action}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : '{}',
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      await load();
    } catch (e: any) { alert(e.message); }
    finally { setActionLoading(''); }
  };

  if (loading) return <div className="vn-empty"><span className="material-icons" style={{ animation: 'spin 1s linear infinite' }}>refresh</span><h3>Loading...</h3></div>;
  if (error || !invoice) return <div className="vn-alert vn-alert-error">{error || 'Not found'}</div>;

  const ci = invoice;

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <button className="vn-btn vn-btn-ghost vn-btn-sm" onClick={() => navigate('/finance/carrier-invoices')}>
          <span className="material-icons">arrow_back</span> Carrier Invoices
        </button>
        <span style={{ color: 'var(--on-surface-variant)', fontSize: 13 }}>/ {ci.invoiceNumber}</span>
      </div>

      <div className="vn-page-header">
        <div>
          <h1>{ci.invoiceNumber}</h1>
          <div className="vn-page-header-meta">
            <span className={`vn-chip vn-chip-${statusChip(ci.status)}`}>{ci.status}</span>
            <span className={`vn-chip vn-chip-${matchChip(ci.matchStatus)}`}>{ci.matchStatus.replace(/_/g, ' ')}</span>
            {ci.autoApproved && <span className="vn-chip vn-chip-info">auto-approved</span>}
          </div>
        </div>
        <div className="vn-page-actions">
          {['received', 'matched', 'discrepancy'].includes(ci.status) && (
            <button className="vn-btn vn-btn-primary vn-btn-sm" onClick={() => doAction('approve')} disabled={!!actionLoading}>
              {actionLoading === 'approve' ? 'Approving...' : 'Approve for Payment'}
            </button>
          )}
          {['approved', 'scheduled'].includes(ci.status) && (
            <button className="vn-btn vn-btn-success vn-btn-sm" onClick={() => doAction('pay', { amountCents: ci.approvedCents ?? ci.totalCents })} disabled={!!actionLoading}>
              <span className="material-icons">payment</span>
              {actionLoading === 'pay' ? 'Recording...' : 'Record Payment'}
            </button>
          )}
        </div>
      </div>

      <div className="vn-detail-grid">
        <div className="vn-detail-main">
          {/* Three-way match results */}
          <div className="vn-card" style={{ marginBottom: 24 }}>
            <div className="vn-card-header"><h2>Freight Audit — Line-by-Line Match</h2></div>
            <div className="vn-table-wrap">
              <table className="vn-table">
                <thead>
                  <tr>
                    <th>Description</th>
                    <th>Type</th>
                    <th>Match</th>
                    <th style={{ textAlign: 'right' }}>Invoiced</th>
                    <th style={{ textAlign: 'right' }}>Expected</th>
                    <th style={{ textAlign: 'right' }}>Variance</th>
                  </tr>
                </thead>
                <tbody>
                  {ci.lineItems.map(li => (
                    <tr key={li.id}>
                      <td>
                        {li.description}
                        {li.freightClass && <span className="vn-table-secondary"> (Class {li.freightClass})</span>}
                        {li.billedWeight && <span className="vn-table-secondary"> — {li.billedWeight} lbs</span>}
                      </td>
                      <td><span className="vn-chip vn-chip-secondary">{li.chargeType.replace(/_/g, ' ')}</span></td>
                      <td><span className={`vn-chip vn-chip-${matchChip(li.matchStatus)}`}>{li.matchStatus}</span></td>
                      <td style={{ textAlign: 'right', fontWeight: 500 }}>{formatMoney(li.amountCents)}</td>
                      <td style={{ textAlign: 'right' }}>{li.expectedAmountCents != null ? formatMoney(li.expectedAmountCents) : '—'}</td>
                      <td style={{ textAlign: 'right', color: li.varianceCents && li.varianceCents > 0 ? 'var(--error)' : li.varianceCents && li.varianceCents < 0 ? 'var(--success)' : undefined, fontWeight: li.varianceCents ? 500 : 400 }}>
                        {li.varianceCents != null ? `${li.varianceCents > 0 ? '+' : ''}${formatMoney(li.varianceCents)}` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={3} style={{ textAlign: 'right', fontWeight: 700 }}>Total</td>
                    <td style={{ textAlign: 'right', fontWeight: 700 }}>{formatMoney(ci.totalCents)}</td>
                    <td></td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: ci.varianceCents && ci.varianceCents > 0 ? 'var(--error)' : 'var(--on-surface-variant)' }}>
                      {ci.varianceCents != null ? `${ci.varianceCents > 0 ? '+' : ''}${formatMoney(ci.varianceCents)} (${ci.variancePercent}%)` : '—'}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>

        <div className="vn-detail-sidebar">
          <div className="vn-card" style={{ padding: 20 }}>
            <h3 style={{ margin: '0 0 16px' }}>Invoice Details</h3>
            <div className="vn-info-grid">
              <div className="vn-info-item"><label>Carrier</label><span>{ci.carrier.name}{ci.carrier.scacCode && ` (${ci.carrier.scacCode})`}</span></div>
              <div className="vn-info-item"><label>Invoice Total</label><span style={{ fontWeight: 600 }}>{formatMoney(ci.totalCents)}</span></div>
              {ci.approvedCents != null && <div className="vn-info-item"><label>Approved</label><span style={{ color: 'var(--success)' }}>{formatMoney(ci.approvedCents)}</span></div>}
              <div className="vn-info-item"><label>Received</label><span>{formatDate(ci.receivedDate)}</span></div>
              <div className="vn-info-item"><label>Due Date</label><span>{formatDate(ci.dueDate)}</span></div>
              {ci.approvedAt && <div className="vn-info-item"><label>Approved At</label><span>{formatDate(ci.approvedAt)}</span></div>}
              {ci.paidAt && <div className="vn-info-item"><label>Paid</label><span>{formatDate(ci.paidAt)}</span></div>}
              {ci.paymentReference && <div className="vn-info-item"><label>Payment Ref</label><span>{ci.paymentReference}</span></div>}
              {ci.notes && <div className="vn-info-item"><label>Notes</label><span>{ci.notes}</span></div>}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
