import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { API_URL } from '../api';

interface QueryData {
  id: string;
  queryNumber: string;
  queryType: string;
  reason: string;
  description: string;
  status: string;
  disputedAmountCents: number | null;
  adjustmentCents: number | null;
  shipmentId?: string;
  invoiceId?: string;
  carrierInvoiceId?: string;
  cargoDiscrepancyId?: string;
  coldChainExcursionId?: string;
  creditNoteId?: string;
  assigneeId?: string;
  createdBy?: string;
  createdAt: string;
  resolvedBy?: string;
  resolvedAt?: string;
  resolutionNotes?: string;
}

function formatMoney(cents: number): string {
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function formatDate(d?: string): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
function statusChip(s: string): string {
  const m: Record<string, string> = { raised: 'warning', investigating: 'info', resolved_adjusted: 'success', resolved_upheld: 'secondary', closed: 'secondary' };
  return m[s] || 'secondary';
}
function reasonLabel(r: string): string {
  const m: Record<string, string> = { overcharge: 'Overcharge', service_failure: 'Service Failure', missing_pod: 'Missing POD', wrong_rate: 'Wrong Rate', damage_claim: 'Damage Claim', missing_items: 'Missing Items', temperature_excursion: 'Temperature Excursion' };
  return m[r] || r;
}

export default function VNextFinanceQueryDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [query, setQuery] = useState<QueryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showResolve, setShowResolve] = useState(false);
  const [resolution, setResolution] = useState<'adjusted' | 'upheld'>('adjusted');
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [adjustmentAmount, setAdjustmentAmount] = useState('');
  const [createCreditNote, setCreateCreditNote] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/api/v1/financial-queries/${id}`);
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setQuery(json.data);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [id]);

  const resolve = async () => {
    if (!resolutionNotes.trim()) { alert('Resolution notes are required'); return; }
    setActionLoading(true);
    try {
      const adjustmentCents = resolution === 'adjusted' && adjustmentAmount
        ? Math.round(parseFloat(adjustmentAmount) * 100) : undefined;
      const res = await fetch(`${API_URL}/api/v1/financial-queries/${id}/resolve`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resolution, resolutionNotes, adjustmentCents, createCreditNote: resolution === 'adjusted' ? createCreditNote : undefined }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setShowResolve(false);
      await load();
    } catch (e: any) { alert(e.message); }
    finally { setActionLoading(false); }
  };

  if (loading) return <div className="vn-empty"><span className="material-icons" style={{ animation: 'spin 1s linear infinite' }}>refresh</span><h3>Loading...</h3></div>;
  if (error || !query) return <div className="vn-alert vn-alert-error">{error || 'Not found'}</div>;

  const q = query;
  const isOpen = ['raised', 'investigating'].includes(q.status);

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <button className="vn-btn vn-btn-ghost vn-btn-sm" onClick={() => navigate('/finance/queries')}>
          <span className="material-icons">arrow_back</span> Queries
        </button>
        <span style={{ color: 'var(--on-surface-variant)', fontSize: 13 }}>/ {q.queryNumber}</span>
      </div>

      <div className="vn-page-header">
        <div>
          <h1>{q.queryNumber}</h1>
          <div className="vn-page-header-meta">
            <span className={`vn-chip vn-chip-${q.queryType === 'customer_dispute' ? 'primary' : 'warning'}`}>
              {q.queryType === 'customer_dispute' ? 'Customer Dispute' : 'Carrier Dispute'}
            </span>
            <span className={`vn-chip vn-chip-${statusChip(q.status)}`}>{q.status.replace(/_/g, ' ')}</span>
          </div>
        </div>
        <div className="vn-page-actions">
          {isOpen && (
            <button className="vn-btn vn-btn-primary vn-btn-sm" onClick={() => setShowResolve(!showResolve)}>
              <span className="material-icons">check_circle</span> Resolve
            </button>
          )}
        </div>
      </div>

      {/* Resolution form */}
      {showResolve && (
        <div className="vn-card" style={{ marginBottom: 24, padding: 20 }}>
          <h3 style={{ margin: '0 0 16px' }}>Resolve Query</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="vn-field">
              <label className="vn-field-label">Resolution</label>
              <select className="vn-input" value={resolution} onChange={e => setResolution(e.target.value as any)}>
                <option value="adjusted">Adjusted (issue credit/adjustment)</option>
                <option value="upheld">Upheld (original charge is correct)</option>
              </select>
            </div>
            {resolution === 'adjusted' && (
              <>
                <div className="vn-field">
                  <label className="vn-field-label">Adjustment Amount ($)</label>
                  <input className="vn-input" type="number" step="0.01" value={adjustmentAmount} onChange={e => setAdjustmentAmount(e.target.value)}
                    placeholder={q.disputedAmountCents ? (q.disputedAmountCents / 100).toFixed(2) : '0.00'} />
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input type="checkbox" checked={createCreditNote} onChange={e => setCreateCreditNote(e.target.checked)} />
                  Generate credit note automatically
                </label>
              </>
            )}
            <div className="vn-field">
              <label className="vn-field-label">Resolution Notes</label>
              <textarea className="vn-input" rows={3} value={resolutionNotes} onChange={e => setResolutionNotes(e.target.value)} placeholder="Describe the resolution..." />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="vn-btn vn-btn-primary" onClick={resolve} disabled={actionLoading}>
                {actionLoading ? 'Resolving...' : 'Resolve Query'}
              </button>
              <button className="vn-btn vn-btn-ghost" onClick={() => setShowResolve(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      <div className="vn-detail-grid">
        <div className="vn-detail-main">
          <div className="vn-card" style={{ marginBottom: 24, padding: 20 }}>
            <h3 style={{ margin: '0 0 12px' }}>Description</h3>
            <p style={{ margin: 0, lineHeight: 1.6 }}>{q.description}</p>
          </div>

          {q.resolvedAt && (
            <div className={`vn-alert vn-alert-${q.status === 'resolved_adjusted' ? 'success' : 'info'}`} style={{ marginBottom: 24 }}>
              <span className="material-icons">{q.status === 'resolved_adjusted' ? 'check_circle' : 'info'}</span>
              <div>
                <strong>Resolved — {q.status === 'resolved_adjusted' ? 'Adjusted' : 'Upheld'}</strong>
                {q.adjustmentCents != null && <span> — Adjustment: {formatMoney(q.adjustmentCents)}</span>}
                {q.resolutionNotes && <p style={{ margin: '8px 0 0' }}>{q.resolutionNotes}</p>}
              </div>
            </div>
          )}

          {q.creditNoteId && (
            <div className="vn-card" style={{ marginBottom: 24, padding: 20 }}>
              <h3 style={{ margin: '0 0 8px' }}>Credit Note</h3>
              <Link to={`/finance/credit-notes/${q.creditNoteId}`} style={{ color: 'var(--primary)' }}>View Credit Note</Link>
            </div>
          )}
        </div>

        <div className="vn-detail-sidebar">
          <div className="vn-card" style={{ padding: 20 }}>
            <h3 style={{ margin: '0 0 16px' }}>Query Details</h3>
            <div className="vn-info-grid">
              <div className="vn-info-item"><label>Reason</label><span>{reasonLabel(q.reason)}</span></div>
              {q.disputedAmountCents != null && <div className="vn-info-item"><label>Disputed Amount</label><span style={{ fontWeight: 600 }}>{formatMoney(q.disputedAmountCents)}</span></div>}
              <div className="vn-info-item"><label>Created</label><span>{formatDate(q.createdAt)}</span></div>
              {q.resolvedAt && <div className="vn-info-item"><label>Resolved</label><span>{formatDate(q.resolvedAt)}</span></div>}
              {q.shipmentId && <div className="vn-info-item"><label>Shipment</label><Link to={`/shipments/${q.shipmentId}`} style={{ color: 'var(--primary)' }}>View</Link></div>}
              {q.invoiceId && <div className="vn-info-item"><label>Invoice</label><Link to={`/finance/invoices/${q.invoiceId}`} style={{ color: 'var(--primary)' }}>View</Link></div>}
              {q.carrierInvoiceId && <div className="vn-info-item"><label>Carrier Invoice</label><Link to={`/finance/carrier-invoices/${q.carrierInvoiceId}`} style={{ color: 'var(--primary)' }}>View</Link></div>}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
