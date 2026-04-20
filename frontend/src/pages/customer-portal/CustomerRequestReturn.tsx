import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_URL } from '../../api';
import { customerFetch } from './CustomerDashboard';

interface OrderLineItem {
  id: string;
  sku: string;
  description: string | null;
  quantity: number;
  unitPriceCents: number | null;
}
interface EligibleOrder {
  id: string;
  orderNumber: string;
  status: string;
  createdAt: string;
  lineItems: OrderLineItem[];
}

interface LineSelection {
  orderLineItemId: string;
  sku: string;
  requestedQuantity: number;
  requestedDisposition: string;
}

const RETURN_REASONS = [
  { v: 'damaged', l: 'Damaged in transit' },
  { v: 'wrong_item', l: 'Wrong item shipped' },
  { v: 'not_as_described', l: 'Not as described' },
  { v: 'no_longer_needed', l: 'No longer needed' },
  { v: 'defective', l: 'Defective / faulty' },
  { v: 'ordered_extra', l: 'Ordered too many' },
  { v: 'other', l: 'Other' },
];

const DISPOSITIONS = [
  { v: '', l: '(let us decide)' },
  { v: 'restock', l: 'Restock' },
  { v: 'refurb', l: 'Refurbish' },
  { v: 'scrap', l: 'Scrap' },
  { v: 'customer_keeps', l: 'Keep the item (refund only)' },
];

export default function CustomerRequestReturn() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<EligibleOrder[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [returnReason, setReturnReason] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<LineSelection[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoadingOrders(true);
    customerFetch(`${API_URL}/api/v1/customer-portal/rmas/eligible-orders`)
      .then(r => r.json())
      .then(json => setOrders(json.data || []))
      .catch(() => setError('Could not load your recent orders.'))
      .finally(() => setLoadingOrders(false));
  }, []);

  const selectedOrder = useMemo(() => orders.find(o => o.id === selectedOrderId), [orders, selectedOrderId]);

  const toggleLine = (item: OrderLineItem) => {
    setLines(current => {
      const existing = current.find(l => l.orderLineItemId === item.id);
      if (existing) return current.filter(l => l.orderLineItemId !== item.id);
      return [...current, { orderLineItemId: item.id, sku: item.sku, requestedQuantity: 1, requestedDisposition: '' }];
    });
  };

  const updateLine = (orderLineItemId: string, patch: Partial<LineSelection>) => {
    setLines(current => current.map(l => l.orderLineItemId === orderLineItemId ? { ...l, ...patch } : l));
  };

  const canSubmit = !!selectedOrderId && !!returnReason && lines.length > 0 && lines.every(l => l.requestedQuantity > 0);

  const handleSubmit = async () => {
    setError(''); setSubmitting(true);
    try {
      const payload = {
        orderId: selectedOrderId,
        returnReason,
        customerNotes: notes || undefined,
        lines: lines.map(l => ({
          orderLineItemId: l.orderLineItemId,
          sku: l.sku,
          requestedQuantity: l.requestedQuantity,
          requestedDisposition: l.requestedDisposition || undefined,
        })),
      };
      const res = await customerFetch(`${API_URL}/api/v1/customer-portal/rmas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.error) { setError(data.error); return; }
      navigate(`/customer-portal/returns/${data.data.id}`);
    } catch (e: any) {
      setError(e.message || 'Failed to submit return request');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 700, margin: '0 0 16px' }}>Request a Return</h1>

      {error && <div className="vn-alert vn-alert-error" style={{ marginBottom: 16 }}>{error}</div>}

      <div className="vn-card" style={{ marginBottom: 16 }}>
        <div style={{ padding: 16 }}>
          <h3 style={{ margin: '0 0 12px' }}>1. Choose order</h3>
          {loadingOrders && <div className="vn-loading-spinner" />}
          {!loadingOrders && orders.length === 0 && (
            <div style={{ color: 'var(--text-secondary)' }}>You have no delivered orders eligible for return.</div>
          )}
          {!loadingOrders && orders.length > 0 && (
            <select className="vn-input" value={selectedOrderId} onChange={e => { setSelectedOrderId(e.target.value); setLines([]); }}>
              <option value="">Select an order...</option>
              {orders.map(o => (
                <option key={o.id} value={o.id}>
                  {o.orderNumber} - {o.lineItems.length} line{o.lineItems.length === 1 ? '' : 's'} - delivered {new Date(o.createdAt).toLocaleDateString()}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {selectedOrder && (
        <div className="vn-card" style={{ marginBottom: 16 }}>
          <div style={{ padding: 16 }}>
            <h3 style={{ margin: '0 0 12px' }}>2. Select items to return</h3>
            <div className="vn-table-wrap">
              <table className="vn-table">
                <thead>
                  <tr>
                    <th style={{ width: 40 }}></th>
                    <th>SKU</th>
                    <th>Description</th>
                    <th>Ordered Qty</th>
                    <th>Return Qty</th>
                    <th>Preferred Outcome</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedOrder.lineItems.map(item => {
                    const selection = lines.find(l => l.orderLineItemId === item.id);
                    const checked = !!selection;
                    return (
                      <tr key={item.id}>
                        <td><input type="checkbox" checked={checked} onChange={() => toggleLine(item)} /></td>
                        <td><strong>{item.sku}</strong></td>
                        <td>{item.description ?? '--'}</td>
                        <td>{item.quantity}</td>
                        <td>
                          {checked ? (
                            <input
                              className="vn-input"
                              type="number" min={1} max={item.quantity}
                              value={selection!.requestedQuantity}
                              onChange={e => updateLine(item.id, { requestedQuantity: Math.min(parseInt(e.target.value) || 1, item.quantity) })}
                              style={{ width: 80 }}
                            />
                          ) : <span className="vn-table-secondary">--</span>}
                        </td>
                        <td>
                          {checked ? (
                            <select
                              className="vn-input"
                              value={selection!.requestedDisposition}
                              onChange={e => updateLine(item.id, { requestedDisposition: e.target.value })}
                            >
                              {DISPOSITIONS.map(d => <option key={d.v} value={d.v}>{d.l}</option>)}
                            </select>
                          ) : <span className="vn-table-secondary">--</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {selectedOrder && lines.length > 0 && (
        <div className="vn-card" style={{ marginBottom: 16 }}>
          <div style={{ padding: 16 }}>
            <h3 style={{ margin: '0 0 12px' }}>3. Reason</h3>
            <div className="vn-field" style={{ marginBottom: 12 }}>
              <label className="vn-field-label">Why are you returning?</label>
              <select className="vn-input" value={returnReason} onChange={e => setReturnReason(e.target.value)}>
                <option value="">Select a reason...</option>
                {RETURN_REASONS.map(r => <option key={r.v} value={r.v}>{r.l}</option>)}
              </select>
            </div>
            <div className="vn-field">
              <label className="vn-field-label">Additional notes (optional)</label>
              <textarea className="vn-input" rows={3} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Describe the issue so our team can help..." />
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button className="vn-btn vn-btn-outline" onClick={() => navigate('/customer-portal/returns')} disabled={submitting}>Cancel</button>
        <button className="vn-btn vn-btn-primary" onClick={handleSubmit} disabled={!canSubmit || submitting}>
          {submitting ? 'Submitting...' : 'Submit Return Request'}
        </button>
      </div>
    </div>
  );
}
