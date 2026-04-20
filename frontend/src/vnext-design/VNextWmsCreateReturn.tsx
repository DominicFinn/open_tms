import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_URL } from '../api';

interface Customer { id: string; name: string; }
interface OrderLine { id: string; sku: string; description: string | null; quantity: number; unitPriceCents: number | null; }
interface Order { id: string; orderNumber: string | null; customerId: string; customer: { name: string }; lineItems: OrderLine[]; }

const RETURN_REASONS = ['damaged', 'wrong_item', 'not_as_described', 'no_longer_needed', 'defective', 'ordered_extra', 'other'];
const DISPOSITIONS = ['restock', 'refurb', 'scrap', 'recycle', 'donate', 'rtv', 'customer_keeps'];

function formatStr(s: string): string {
  return s.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

export default function VNextWmsCreateReturn() {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [lineSelections, setLineSelections] = useState<Record<string, { quantity: number; disposition?: string }>>({});
  const [returnReason, setReturnReason] = useState('damaged');
  const [customerNotes, setCustomerNotes] = useState('');
  const [autoAuthorize, setAutoAuthorize] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`${API_URL}/api/v1/customers`)
      .then(r => r.json())
      .then(res => setCustomers(res.data || []));
  }, []);

  useEffect(() => {
    if (!selectedCustomer) { setOrders([]); return; }
    fetch(`${API_URL}/api/v1/orders?customerId=${selectedCustomer}`)
      .then(r => r.json())
      .then(res => setOrders(res.data || []));
  }, [selectedCustomer]);

  useEffect(() => {
    if (!selectedOrderId) { setSelectedOrder(null); return; }
    fetch(`${API_URL}/api/v1/orders/${selectedOrderId}`)
      .then(r => r.json())
      .then(res => setSelectedOrder(res.data || null));
  }, [selectedOrderId]);

  const toggleLine = (lineId: string, maxQty: number) => {
    setLineSelections(prev => {
      const next = { ...prev };
      if (next[lineId]) {
        delete next[lineId];
      } else {
        next[lineId] = { quantity: maxQty };
      }
      return next;
    });
  };

  const setLineQty = (lineId: string, qty: number) => {
    setLineSelections(prev => ({
      ...prev,
      [lineId]: { ...prev[lineId], quantity: qty },
    }));
  };

  const setLineDisposition = (lineId: string, disp: string) => {
    setLineSelections(prev => ({
      ...prev,
      [lineId]: { ...prev[lineId], disposition: disp || undefined },
    }));
  };

  const calculatedRefund = selectedOrder?.lineItems.reduce((sum, line) => {
    const sel = lineSelections[line.id];
    if (!sel) return sum;
    return sum + (line.unitPriceCents ?? 0) * sel.quantity;
  }, 0) ?? 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder) return;
    const lines = Object.entries(lineSelections).map(([orderLineItemId, sel]) => {
      const oli = selectedOrder.lineItems.find(l => l.id === orderLineItemId)!;
      return {
        orderLineItemId,
        sku: oli.sku,
        requestedQuantity: sel.quantity,
        requestedDisposition: sel.disposition,
      };
    });
    if (lines.length === 0) { setError('Select at least one item to return'); return; }

    setError(''); setSaving(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/rmas`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: selectedCustomer,
          orderId: selectedOrderId,
          returnReason,
          customerNotes: customerNotes || undefined,
          autoAuthorize,
          lines,
        }),
      });
      const data = await res.json();
      if (data.error) setError(data.error);
      else navigate(`/wms/returns/${data.data.id}`);
    } catch {
      setError('Failed to create RMA');
    } finally { setSaving(false); }
  };

  return (
    <div>
      <div className="vn-page-header">
        <div>
          <h1>Create Return (RMA)</h1>
          <p className="vn-page-subtitle">Authorize a customer return and select items</p>
        </div>
      </div>

      {error && <div className="vn-alert vn-alert-error" style={{ marginBottom: '1rem' }}>{error}</div>}

      <form onSubmit={handleSubmit}>
        <div className="vn-card" style={{ marginBottom: '1rem' }}>
          <h3 style={{ margin: '0 0 1rem' }}>1. Customer & Order</h3>
          <div className="vn-form-grid">
            <div className="vn-field">
              <label className="vn-field-label">Customer *</label>
              <select className="vn-input" value={selectedCustomer} onChange={e => { setSelectedCustomer(e.target.value); setSelectedOrderId(''); setLineSelections({}); }} required>
                <option value="">Select customer...</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="vn-field">
              <label className="vn-field-label">Order *</label>
              <select className="vn-input" value={selectedOrderId} onChange={e => { setSelectedOrderId(e.target.value); setLineSelections({}); }} required disabled={!selectedCustomer}>
                <option value="">Select order...</option>
                {orders.map(o => <option key={o.id} value={o.id}>{o.orderNumber || o.id.slice(0, 8)}</option>)}
              </select>
            </div>
          </div>
        </div>

        {selectedOrder && (
          <>
            <div className="vn-card" style={{ marginBottom: '1rem' }}>
              <h3 style={{ margin: '0 0 1rem' }}>2. Items to Return</h3>
              {selectedOrder.lineItems.length === 0 ? (
                <p style={{ color: 'var(--text-secondary)' }}>Order has no line items</p>
              ) : (
                <div className="vn-table-wrap">
                  <table className="vn-table">
                    <thead>
                      <tr>
                        <th style={{ width: '40px' }}></th>
                        <th>SKU</th>
                        <th>Description</th>
                        <th>Ordered</th>
                        <th>Return Qty</th>
                        <th>Unit Price</th>
                        <th>Suggested Disposition</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedOrder.lineItems.map(line => {
                        const sel = lineSelections[line.id];
                        return (
                          <tr key={line.id}>
                            <td><input type="checkbox" checked={!!sel} onChange={() => toggleLine(line.id, line.quantity)} /></td>
                            <td><strong>{line.sku}</strong></td>
                            <td>{line.description || '--'}</td>
                            <td>{line.quantity}</td>
                            <td>
                              {sel && (
                                <input className="vn-input" type="number" min="1" max={line.quantity}
                                  value={sel.quantity}
                                  onChange={e => setLineQty(line.id, parseInt(e.target.value) || 1)}
                                  style={{ width: '80px' }} />
                              )}
                            </td>
                            <td>{line.unitPriceCents != null ? `$${(line.unitPriceCents / 100).toFixed(2)}` : '--'}</td>
                            <td>
                              {sel && (
                                <select className="vn-input" value={sel.disposition || ''} onChange={e => setLineDisposition(line.id, e.target.value)} style={{ fontSize: '0.85rem' }}>
                                  <option value="">(decide at inspection)</option>
                                  {DISPOSITIONS.map(d => <option key={d} value={d}>{formatStr(d)}</option>)}
                                </select>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="vn-card" style={{ marginBottom: '1rem' }}>
              <h3 style={{ margin: '0 0 1rem' }}>3. Reason & Notes</h3>
              <div className="vn-form-grid">
                <div className="vn-field">
                  <label className="vn-field-label">Return Reason *</label>
                  <select className="vn-input" value={returnReason} onChange={e => setReturnReason(e.target.value)}>
                    {RETURN_REASONS.map(r => <option key={r} value={r}>{formatStr(r)}</option>)}
                  </select>
                </div>
                <div className="vn-field" style={{ gridColumn: '1 / -1' }}>
                  <label className="vn-field-label">Customer Notes</label>
                  <textarea className="vn-input" rows={3} value={customerNotes} onChange={e => setCustomerNotes(e.target.value)} placeholder="Describe the issue..." />
                </div>
                <div className="vn-field" style={{ gridColumn: '1 / -1' }}>
                  <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', cursor: 'pointer' }}>
                    <input type="checkbox" checked={autoAuthorize} onChange={e => setAutoAuthorize(e.target.checked)} />
                    <span>Auto-authorize (skip the "requested" state, go straight to "authorized")</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="vn-card" style={{ marginBottom: '1rem' }}>
              <h3 style={{ margin: '0 0 0.5rem' }}>4. Review</h3>
              <div style={{ display: 'flex', gap: '2rem', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Lines selected</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{Object.keys(lineSelections).length}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Suggested refund</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-primary)' }}>${(calculatedRefund / 100).toFixed(2)}</div>
                </div>
              </div>
            </div>
          </>
        )}

        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
          <button type="button" className="vn-btn vn-btn-outline" onClick={() => navigate('/wms/returns')}>Cancel</button>
          <button type="submit" className="vn-btn vn-btn-primary" disabled={saving || Object.keys(lineSelections).length === 0}>
            {saving ? 'Creating...' : 'Create RMA'}
          </button>
        </div>
      </form>
    </div>
  );
}
