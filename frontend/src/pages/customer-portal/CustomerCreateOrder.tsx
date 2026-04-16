import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_URL } from '../../api';
import { customerFetch } from './CustomerDashboard';

interface LineItem {
  description: string;
  quantity: number;
  weightKg: string;
  sku: string;
}

export default function CustomerCreateOrder() {
  const navigate = useNavigate();
  const [poNumber, setPoNumber] = useState('');
  const [serviceLevel, setServiceLevel] = useState('FTL');
  const [originCity, setOriginCity] = useState('');
  const [originState, setOriginState] = useState('');
  const [destCity, setDestCity] = useState('');
  const [destState, setDestState] = useState('');
  const [requestedDeliveryDate, setRequestedDeliveryDate] = useState('');
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [lineItems, setLineItems] = useState<LineItem[]>([{ description: '', quantity: 1, weightKg: '', sku: '' }]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const addItem = () => setLineItems([...lineItems, { description: '', quantity: 1, weightKg: '', sku: '' }]);
  const removeItem = (i: number) => setLineItems(lineItems.filter((_, idx) => idx !== i));
  const updateItem = (i: number, field: keyof LineItem, value: string | number) => {
    const updated = [...lineItems];
    (updated[i] as any)[field] = value;
    setLineItems(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!poNumber.trim()) { setError('PO Number is required'); return; }
    setSubmitting(true);
    setError('');
    try {
      const res = await customerFetch(`${API_URL}/api/v1/customer-portal/orders`, {
        method: 'POST',
        body: JSON.stringify({
          poNumber,
          serviceLevel,
          originCity: originCity || undefined,
          originState: originState || undefined,
          destinationCity: destCity || undefined,
          destinationState: destState || undefined,
          requestedDeliveryDate: requestedDeliveryDate || undefined,
          specialInstructions: specialInstructions || undefined,
          lineItems: lineItems.filter(li => li.description.trim()).map(li => ({
            description: li.description,
            quantity: li.quantity,
            weightKg: li.weightKg ? parseFloat(li.weightKg) : undefined,
            sku: li.sku || undefined,
          })),
        }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      navigate('/customer-portal/orders');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <button className="vn-btn vn-btn-ghost vn-btn-sm" onClick={() => navigate('/customer-portal/orders')} style={{ marginBottom: 16 }}>
        <span className="material-icons">arrow_back</span> Orders
      </button>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24 }}>Create Order</h1>

      <form onSubmit={handleSubmit}>
        {error && <div className="vn-alert vn-alert-error" style={{ marginBottom: 16 }}>{error}</div>}

        <div className="vn-card" style={{ padding: 20, marginBottom: 24 }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 600 }}>Order Details</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div className="vn-field">
              <label className="vn-field-label">PO Number *</label>
              <input className="vn-input" value={poNumber} onChange={e => setPoNumber(e.target.value)} required />
            </div>
            <div className="vn-field">
              <label className="vn-field-label">Service Level</label>
              <select className="vn-input" value={serviceLevel} onChange={e => setServiceLevel(e.target.value)}>
                <option value="FTL">Full Truckload (FTL)</option>
                <option value="LTL">Less Than Truckload (LTL)</option>
              </select>
            </div>
            <div className="vn-field">
              <label className="vn-field-label">Requested Delivery Date</label>
              <input className="vn-input" type="date" value={requestedDeliveryDate} onChange={e => setRequestedDeliveryDate(e.target.value)} />
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>
          <div className="vn-card" style={{ padding: 20 }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 600 }}>Origin</h3>
            <div className="vn-field" style={{ marginBottom: 12 }}>
              <label className="vn-field-label">City</label>
              <input className="vn-input" value={originCity} onChange={e => setOriginCity(e.target.value)} />
            </div>
            <div className="vn-field">
              <label className="vn-field-label">State</label>
              <input className="vn-input" value={originState} onChange={e => setOriginState(e.target.value)} />
            </div>
          </div>
          <div className="vn-card" style={{ padding: 20 }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 600 }}>Destination</h3>
            <div className="vn-field" style={{ marginBottom: 12 }}>
              <label className="vn-field-label">City</label>
              <input className="vn-input" value={destCity} onChange={e => setDestCity(e.target.value)} />
            </div>
            <div className="vn-field">
              <label className="vn-field-label">State</label>
              <input className="vn-input" value={destState} onChange={e => setDestState(e.target.value)} />
            </div>
          </div>
        </div>

        <div className="vn-card" style={{ padding: 20, marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Line Items</h3>
            <button type="button" className="vn-btn vn-btn-outline vn-btn-sm" onClick={addItem}>
              <span className="material-icons" style={{ fontSize: 16 }}>add</span> Add Item
            </button>
          </div>
          {lineItems.map((item, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto', gap: 8, marginBottom: 8, alignItems: 'end' }}>
              <div className="vn-field">
                {i === 0 && <label className="vn-field-label">Description</label>}
                <input className="vn-input" value={item.description} onChange={e => updateItem(i, 'description', e.target.value)} placeholder="Item description" />
              </div>
              <div className="vn-field">
                {i === 0 && <label className="vn-field-label">Qty</label>}
                <input className="vn-input" type="number" min="1" value={item.quantity} onChange={e => updateItem(i, 'quantity', parseInt(e.target.value) || 1)} />
              </div>
              <div className="vn-field">
                {i === 0 && <label className="vn-field-label">Weight (kg)</label>}
                <input className="vn-input" type="number" step="0.1" value={item.weightKg} onChange={e => updateItem(i, 'weightKg', e.target.value)} />
              </div>
              <div className="vn-field">
                {i === 0 && <label className="vn-field-label">SKU</label>}
                <input className="vn-input" value={item.sku} onChange={e => updateItem(i, 'sku', e.target.value)} />
              </div>
              {lineItems.length > 1 && (
                <button type="button" className="vn-btn-icon" onClick={() => removeItem(i)} style={{ marginBottom: 2 }}>
                  <span className="material-icons" style={{ fontSize: 18, color: 'var(--color-error)' }}>close</span>
                </button>
              )}
            </div>
          ))}
        </div>

        <div className="vn-card" style={{ padding: 20, marginBottom: 24 }}>
          <div className="vn-field">
            <label className="vn-field-label">Special Instructions</label>
            <textarea className="vn-input" rows={3} value={specialInstructions} onChange={e => setSpecialInstructions(e.target.value)} placeholder="Any special requirements..." />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
          <button type="button" className="vn-btn vn-btn-outline" onClick={() => navigate('/customer-portal/orders')}>Cancel</button>
          <button type="submit" className="vn-btn vn-btn-primary" disabled={submitting}>
            <span className="material-icons">send</span>
            {submitting ? 'Submitting...' : 'Submit Order'}
          </button>
        </div>
      </form>
    </div>
  );
}
