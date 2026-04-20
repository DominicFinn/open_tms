import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_URL } from '../api';

interface RmaLine {
  id: string;
  sku: string;
  disposition: string;
  receivedQuantity: number;
  refundAmountCents: number;
}

interface RmaInQueue {
  id: string;
  rmaNumber: string;
  customerId: string;
  orderId: string;
  returnReason: string;
  suggestedRefundCents: number;
  requestedAt: string;
  lines: RmaLine[];
}

function formatStr(s: string): string {
  return s.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function dispositionChip(d: string): string {
  switch (d) {
    case 'restock': return 'vn-chip-success';
    case 'refurb': return 'vn-chip-info';
    case 'scrap': case 'recycle': return 'vn-chip-error';
    case 'donate': return 'vn-chip-primary';
    case 'rtv': return 'vn-chip-warning';
    case 'customer_keeps': return 'vn-chip-secondary';
    default: return 'vn-chip-secondary';
  }
}

export default function VNextWmsRefundReview() {
  const navigate = useNavigate();
  const [rmas, setRmas] = useState<RmaInQueue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = () => {
    setLoading(true);
    fetch(`${API_URL}/api/v1/rmas/refund-review/queue`)
      .then(r => r.json())
      .then(res => setRmas(res.data || []))
      .catch(() => setError('Failed to load queue'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const totalPendingRefund = rmas.reduce((sum, r) => sum + r.suggestedRefundCents, 0);

  return (
    <div>
      <div className="vn-page-header">
        <div>
          <h1>Refund Review Queue</h1>
          <p className="vn-page-subtitle">RMAs awaiting finance approval before refund is issued</p>
        </div>
        <button className="vn-btn vn-btn-outline" onClick={() => navigate('/wms/returns')}>
          <span className="material-icons" style={{ fontSize: '18px', marginRight: '0.5rem' }}>arrow_back</span>
          Back to Returns
        </button>
      </div>

      {error && <div className="vn-alert vn-alert-error" style={{ marginBottom: '1rem' }}>{error}</div>}

      <div className="vn-stats" style={{ marginBottom: '1.5rem' }}>
        <div className="vn-stat">
          <div className="vn-stat-icon vn-stat-icon-primary"><span className="material-icons">receipt_long</span></div>
          <div className="vn-stat-value">{rmas.length}</div>
          <div className="vn-stat-label">Pending Refunds</div>
        </div>
        <div className="vn-stat">
          <div className="vn-stat-icon vn-stat-icon-warning"><span className="material-icons">account_balance</span></div>
          <div className="vn-stat-value">${(totalPendingRefund / 100).toFixed(2)}</div>
          <div className="vn-stat-label">Total Refund Value</div>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: '2rem', textAlign: 'center' }}><div className="vn-loading-spinner" /></div>
      ) : rmas.length === 0 ? (
        <div className="vn-card" style={{ textAlign: 'center', padding: '3rem' }}>
          <span className="material-icons" style={{ fontSize: '48px', color: 'var(--color-success)', marginBottom: '1rem', display: 'block' }}>check_circle</span>
          <h3>Queue is empty</h3>
          <p style={{ color: 'var(--text-secondary)' }}>No RMAs currently awaiting refund review.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {rmas.map(r => (
            <div key={r.id} className="vn-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                <div>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.25rem' }}>
                    <h3 style={{ margin: 0 }}>{r.rmaNumber}</h3>
                    <span className="vn-chip vn-chip-warning">Dispositioning</span>
                    <span className="vn-chip vn-chip-secondary">{formatStr(r.returnReason)}</span>
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    Requested {new Date(r.requestedAt).toLocaleDateString()}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Suggested refund</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-primary)' }}>${(r.suggestedRefundCents / 100).toFixed(2)}</div>
                </div>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem' }}>Line Dispositions</div>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {r.lines.map(l => (
                    <span key={l.id} className={`vn-chip ${dispositionChip(l.disposition)}`}>
                      {l.sku} x{l.receivedQuantity} → {formatStr(l.disposition)}
                    </span>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="vn-btn vn-btn-primary" onClick={() => navigate(`/wms/returns/${r.id}`)}>
                  Review & Complete
                </button>
                <button className="vn-btn vn-btn-outline" onClick={() => navigate(`/wms/returns/${r.id}`)}>
                  View Detail
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
