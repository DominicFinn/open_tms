import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { API_URL } from '../api';
import { useOrgContext } from '../hooks/useOrgContext';

interface QuoteLineItem {
  id: string;
  chargeType: string;
  description: string;
  amountCents: number;
  quantity: number;
  accessorialCode?: string;
  freightClass?: string;
  ratePerCwt?: number;
}

interface QuoteData {
  id: string;
  quoteNumber: string;
  version: number;
  status: string;
  customer: { id: string; name: string };
  parentQuote?: { id: string; quoteNumber: string; version: number } | null;
  revisions?: { id: string; quoteNumber: string; version: number; status: string }[];
  serviceLevel: string;
  equipmentType?: string;
  totalRevenueCents: number;
  totalCostCents: number;
  marginCents: number;
  marginPercent: string;
  currency: string;
  validFrom: string;
  validUntil: string;
  orderId?: string;
  notes?: string;
  lineItems: QuoteLineItem[];
  createdAt: string;
}

function formatMoney(cents: number): string {
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function formatDate(d?: string): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
function statusChip(s: string): string {
  const m: Record<string, string> = { draft: 'secondary', sent: 'info', accepted: 'success', declined: 'error', expired: 'warning', superseded: 'secondary' };
  return m[s] || 'secondary';
}

export default function VNextFinanceQuoteDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [quote, setQuote] = useState<QuoteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState('');
  const { isBroker } = useOrgContext();

  const load = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/api/v1/quotes/${id}`);
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setQuote(json.data);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [id]);

  const doAction = async (action: string, body?: any) => {
    setActionLoading(action);
    try {
      const res = await fetch(`${API_URL}/api/v1/quotes/${id}/${action}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : '{}',
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      if (action === 'accept' && json.data?.shipmentId) {
        navigate(`/loadboard`);
        return;
      }
      if (action === 'accept' && json.data?.orderId) {
        navigate(`/orders/${json.data.orderId}`);
        return;
      }
      await load();
    } catch (e: any) { alert(e.message); }
    finally { setActionLoading(''); }
  };

  if (loading) return <div className="vn-empty"><span className="material-icons" style={{ animation: 'spin 1s linear infinite' }}>refresh</span><h3>Loading...</h3></div>;
  if (error || !quote) return <div className="vn-alert vn-alert-error">{error || 'Not found'}</div>;

  const q = quote;
  const isExpired = new Date(q.validUntil) < new Date() && !['accepted', 'expired', 'superseded'].includes(q.status);

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <button className="vn-btn vn-btn-ghost vn-btn-sm" onClick={() => navigate('/finance/quotes')}>
          <span className="material-icons">arrow_back</span> Quotes
        </button>
        <span style={{ color: 'var(--on-surface-variant)', fontSize: 13 }}>/ {q.quoteNumber}</span>
      </div>

      <div className="vn-page-header">
        <div>
          <h1>{q.quoteNumber}</h1>
          <div className="vn-page-header-meta">
            {q.version > 1 && <span className="vn-chip vn-chip-info">v{q.version}</span>}
            <span className={`vn-chip vn-chip-${statusChip(q.status)}`}>{q.status}</span>
            {isExpired && <span className="vn-chip vn-chip-error">EXPIRED</span>}
          </div>
        </div>
        <div className="vn-page-actions">
          {['draft', 'sent'].includes(q.status) && !isExpired && (
            <>
              {isBroker && (
                <button className="vn-btn vn-btn-primary vn-btn-sm" onClick={() => doAction('accept', { createShipment: true })} disabled={!!actionLoading}>
                  <span className="material-icons">rocket_launch</span>
                  {actionLoading === 'accept' ? 'Booking...' : 'Accept & Book'}
                </button>
              )}
              <button className="vn-btn vn-btn-success vn-btn-sm" onClick={() => doAction('accept')} disabled={!!actionLoading}>
                <span className="material-icons">check</span>
                {actionLoading === 'accept' ? 'Accepting...' : 'Accept'}
              </button>
              <button className="vn-btn vn-btn-outline vn-btn-sm" onClick={() => doAction('decline', { reason: 'Declined by user' })} disabled={!!actionLoading}>
                Decline
              </button>
            </>
          )}
          {!['accepted', 'expired'].includes(q.status) && (
            <button className="vn-btn vn-btn-outline vn-btn-sm" onClick={() => navigate(`/finance/quotes/${q.id}/revise`)}>
              <span className="material-icons">edit</span> Revise
            </button>
          )}
        </div>
      </div>

      {/* Margin summary */}
      <div className="vn-stats">
        <div className="vn-stat">
          <div className="vn-stat-icon primary"><span className="material-icons">attach_money</span></div>
          <div><div className="vn-stat-value">{formatMoney(q.totalRevenueCents)}</div><div className="vn-stat-label">Revenue (Customer Pays)</div></div>
        </div>
        <div className="vn-stat">
          <div className="vn-stat-icon warning"><span className="material-icons">local_shipping</span></div>
          <div><div className="vn-stat-value">{formatMoney(q.totalCostCents)}</div><div className="vn-stat-label">Cost (Carrier)</div></div>
        </div>
        <div className="vn-stat">
          <div className="vn-stat-icon success"><span className="material-icons">trending_up</span></div>
          <div><div className="vn-stat-value" style={{ color: q.marginCents >= 0 ? 'var(--success)' : 'var(--error)' }}>{formatMoney(q.marginCents)} ({q.marginPercent}%)</div><div className="vn-stat-label">Margin</div></div>
        </div>
      </div>

      <div className="vn-detail-grid">
        <div className="vn-detail-main">
          {/* Line Items */}
          <div className="vn-card" style={{ marginBottom: 24 }}>
            <div className="vn-card-header"><h2>Line Items</h2></div>
            <div className="vn-table-wrap">
              <table className="vn-table">
                <thead><tr><th>Description</th><th>Type</th><th style={{ textAlign: 'right' }}>Qty</th><th style={{ textAlign: 'right' }}>Amount</th></tr></thead>
                <tbody>
                  {q.lineItems.map(li => (
                    <tr key={li.id}>
                      <td>{li.description}{li.freightClass && <span className="vn-table-secondary"> (Class {li.freightClass})</span>}</td>
                      <td><span className="vn-chip vn-chip-secondary">{li.chargeType.replace(/_/g, ' ')}</span></td>
                      <td style={{ textAlign: 'right' }}>{li.quantity}</td>
                      <td style={{ textAlign: 'right', fontWeight: 500 }}>{formatMoney(li.amountCents * li.quantity)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr><td colSpan={3} style={{ textAlign: 'right', fontWeight: 700 }}>Total (Cost Basis)</td><td style={{ textAlign: 'right', fontWeight: 700 }}>{formatMoney(q.totalCostCents)}</td></tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Revision history */}
          {q.parentQuote && (
            <div className="vn-card" style={{ marginBottom: 24, padding: 20 }}>
              <h3 style={{ margin: '0 0 12px' }}>Revision History</h3>
              <p>This is a revision of <Link to={`/finance/quotes/${q.parentQuote.id}`} style={{ color: 'var(--primary)' }}>{q.parentQuote.quoteNumber}</Link> (v{q.parentQuote.version})</p>
            </div>
          )}

          {q.orderId && (
            <div className="vn-alert vn-alert-success" style={{ marginBottom: 24 }}>
              <span className="material-icons">check_circle</span>
              Quote accepted — <Link to={`/orders/${q.orderId}`} style={{ color: 'inherit', fontWeight: 600 }}>View Order</Link>
            </div>
          )}
        </div>

        <div className="vn-detail-sidebar">
          <div className="vn-card" style={{ padding: 20 }}>
            <h3 style={{ margin: '0 0 16px' }}>Quote Details</h3>
            <div className="vn-info-grid">
              <div className="vn-info-item"><label>Customer</label><span>{q.customer.name}</span></div>
              <div className="vn-info-item"><label>Service Level</label><span>{q.serviceLevel}</span></div>
              {q.equipmentType && <div className="vn-info-item"><label>Equipment</label><span>{q.equipmentType}</span></div>}
              <div className="vn-info-item"><label>Valid From</label><span>{formatDate(q.validFrom)}</span></div>
              <div className="vn-info-item"><label>Valid Until</label><span style={{ color: isExpired ? 'var(--error)' : undefined }}>{formatDate(q.validUntil)}</span></div>
              <div className="vn-info-item"><label>Created</label><span>{formatDate(q.createdAt)}</span></div>
              {q.notes && <div className="vn-info-item"><label>Notes</label><span>{q.notes}</span></div>}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
