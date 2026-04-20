import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { API_URL } from '../../api';
import { customerFetch } from './CustomerDashboard';

interface RmaLine {
  id: string;
  sku: string;
  requestedQuantity: number;
  receivedQuantity: number;
  requestedDisposition: string | null;
  disposition: string;
  inspectionStatus: string;
  inspectionNotes: string | null;
  refundAmountCents: number;
}

interface RmaDetail {
  id: string;
  rmaNumber: string;
  orderId: string;
  status: string;
  returnReason: string;
  customerNotes: string | null;
  rejectionNotes: string | null;
  requestedAt: string;
  authorizedAt: string | null;
  receivedAt: string | null;
  completedAt: string | null;
  suggestedRefundCents: number;
  actualRefundCents: number | null;
  returnTrackingNumber: string | null;
  returnLabelStorageKey: string | null;
  returnLabelFormat: string | null;
  returnLabelProvider: string | null;
  returnServiceLevel: string | null;
  returnPickupScheduledAt: string | null;
  returnPickupWindow: string | null;
  returnPickupConfirmationNumber: string | null;
  returnPickupCancelledAt: string | null;
  lines: RmaLine[];
}

function statusChip(s: string): string {
  const m: Record<string, string> = {
    requested: 'info', authorized: 'primary',
    in_transit: 'info', received: 'warning', inspecting: 'warning', dispositioning: 'warning',
    completed: 'success', rejected: 'error',
    pass: 'success', fail: 'error', restock: 'success', scrap: 'error',
  };
  return `vn-chip-${m[s] || 'secondary'}`;
}

function fmt(s: string): string {
  return s.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function statusExplain(s: string): string {
  const m: Record<string, string> = {
    requested: 'Your return request is with our team for review.',
    authorized: 'Your return has been approved. Ship the items back using the label we will provide.',
    in_transit: 'We are waiting for your return to arrive at our warehouse.',
    received: 'We have received your return. It is in quarantine pending inspection.',
    inspecting: 'Our team is inspecting the returned items.',
    dispositioning: 'Inspection complete. Your refund is being processed by finance.',
    completed: 'This return is complete and your refund has been issued.',
    rejected: 'We were unable to approve this return. See notes below.',
  };
  return m[s] || '';
}

export default function CustomerReturnDetail() {
  const { id } = useParams<{ id: string }>();
  const [rma, setRma] = useState<RmaDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    customerFetch(`${API_URL}/api/v1/customer-portal/rmas/${id}`)
      .then(r => r.json())
      .then(json => { if (json.error) setError(json.error); else setRma(json.data); })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div style={{ padding: 24, textAlign: 'center' }}><div className="vn-loading-spinner" /></div>;
  if (error || !rma) return <div className="vn-alert vn-alert-error">{error || 'Return not found'}</div>;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <Link to="/customer-portal/returns" className="vn-btn vn-btn-outline vn-btn-sm">Back</Link>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>{rma.rmaNumber}</h1>
        <span className={`vn-chip ${statusChip(rma.status)}`}>{fmt(rma.status)}</span>
      </div>

      <div className="vn-alert vn-alert-info" style={{ marginBottom: 16 }}>
        {statusExplain(rma.status)}
      </div>

      {/* Refund summary */}
      <div className="vn-card" style={{ marginBottom: 16 }}>
        <div style={{ padding: 16, display: 'flex', gap: 32, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Reason</div>
            <div style={{ fontWeight: 600 }}>{fmt(rma.returnReason)}</div>
          </div>
          <div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Estimated Refund</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>${(rma.suggestedRefundCents / 100).toFixed(2)}</div>
          </div>
          {rma.actualRefundCents != null && (
            <div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Final Refund</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-success)' }}>${(rma.actualRefundCents / 100).toFixed(2)}</div>
            </div>
          )}
          <div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Requested</div>
            <div>{new Date(rma.requestedAt).toLocaleString()}</div>
          </div>
        </div>
      </div>

      {/* Return shipping */}
      {(rma.returnLabelStorageKey || rma.returnPickupScheduledAt) && (
        <div className="vn-card" style={{ marginBottom: 16 }}>
          <div style={{ padding: 16 }}>
            <h3 style={{ margin: '0 0 12px' }}>Return Shipping</h3>
            {rma.returnLabelStorageKey && (
              <div style={{ marginBottom: 8 }}>
                <a className="vn-btn vn-btn-primary vn-btn-sm" href={`${API_URL}/api/v1/customer-portal/rmas/${rma.id}/return-label`} target="_blank" rel="noreferrer">
                  <span className="material-icons">download</span> Download Return Label
                </a>
                {rma.returnTrackingNumber && (
                  <span style={{ marginLeft: 12, fontSize: '0.9rem' }}>
                    Tracking: <strong>{rma.returnTrackingNumber}</strong>
                    {rma.returnLabelProvider && <> &middot; via {rma.returnLabelProvider.toUpperCase()}</>}
                    {rma.returnServiceLevel && <> &middot; {fmt(rma.returnServiceLevel)}</>}
                  </span>
                )}
              </div>
            )}
            {rma.returnPickupScheduledAt && (
              <div style={{ fontSize: '0.9rem', padding: '8px 0', borderTop: '1px solid var(--border-color)' }}>
                <strong>Pickup scheduled:</strong> {new Date(rma.returnPickupScheduledAt).toLocaleString()}
                {rma.returnPickupWindow && <> (window {rma.returnPickupWindow})</>}
                {rma.returnPickupConfirmationNumber && <> &middot; confirmation {rma.returnPickupConfirmationNumber}</>}
                {rma.returnPickupCancelledAt && (
                  <span style={{ marginLeft: 12, color: 'var(--color-error)' }}>Cancelled {new Date(rma.returnPickupCancelledAt).toLocaleString()}</span>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Rejection */}
      {rma.rejectionNotes && (
        <div className="vn-alert vn-alert-error" style={{ marginBottom: 16 }}>
          <strong>Why this was rejected:</strong> {rma.rejectionNotes}
        </div>
      )}

      {/* Customer notes */}
      {rma.customerNotes && (
        <div className="vn-card" style={{ marginBottom: 16 }}>
          <div style={{ padding: 16 }}>
            <h3 style={{ margin: '0 0 8px' }}>Your notes</h3>
            <div style={{ fontSize: '0.9rem' }}>{rma.customerNotes}</div>
          </div>
        </div>
      )}

      {/* Lines */}
      <div className="vn-card">
        <div style={{ padding: 16 }}>
          <h3 style={{ margin: '0 0 12px' }}>Items</h3>
          <div className="vn-table-wrap">
            <table className="vn-table">
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Requested Qty</th>
                  <th>Received Qty</th>
                  <th>Outcome</th>
                  <th>Refund</th>
                </tr>
              </thead>
              <tbody>
                {rma.lines.map(line => (
                  <tr key={line.id}>
                    <td><strong>{line.sku}</strong></td>
                    <td>{line.requestedQuantity}</td>
                    <td>{line.receivedQuantity}</td>
                    <td>
                      {line.disposition === 'pending'
                        ? <span className="vn-chip vn-chip-secondary">Pending</span>
                        : <span className={`vn-chip ${statusChip(line.disposition)}`}>{fmt(line.disposition)}</span>}
                    </td>
                    <td>${(line.refundAmountCents / 100).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
