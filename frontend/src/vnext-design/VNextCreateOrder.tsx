import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { API_URL } from '../api';

interface LineItem {
  id: number;
  sku: string;
  description: string;
  quantity: string;
  weight: string;
}

let nextLineId = 2;

export default function VNextCreateOrder() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);

  const [customer, setCustomer] = useState('');
  const [poNumber, setPoNumber] = useState('');
  const [orderDate, setOrderDate] = useState('');
  const [requestedDelivery, setRequestedDelivery] = useState('');
  const [serviceLevel, setServiceLevel] = useState('');

  const [originLocation, setOriginLocation] = useState('');
  const [destLocation, setDestLocation] = useState('');

  const [tempControl, setTempControl] = useState('ambient');
  const [hazmat, setHazmat] = useState(false);
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [notes, setNotes] = useState('');

  const [lineItems, setLineItems] = useState<LineItem[]>([
    { id: 1, sku: '', description: '', quantity: '', weight: '' },
  ]);

  const [customers, setCustomers] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch(`${API_URL}/api/v1/customers`).then(r => r.json()),
      fetch(`${API_URL}/api/v1/locations`).then(r => r.json()),
    ]).then(([cRes, lRes]) => {
      setCustomers(cRes.data || []);
      setLocations(lRes.data || []);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!id) return;
    fetch(`${API_URL}/api/v1/orders/${id}`)
      .then(r => { if (!r.ok) throw new Error('Failed to load order'); return r.json(); })
      .then(json => {
        const o = json.data;
        if (!o) return;
        setCustomer(o.customerId || '');
        setPoNumber(o.poNumber || '');
        setOrderDate(o.requestedPickupDate ? o.requestedPickupDate.slice(0, 10) : '');
        setRequestedDelivery(o.requestedDeliveryDate ? o.requestedDeliveryDate.slice(0, 10) : '');
        setServiceLevel(o.serviceLevel || '');
        setOriginLocation(o.originId || '');
        setDestLocation(o.destinationId || '');
        setTempControl(o.temperatureControl || 'ambient');
        setHazmat(Boolean(o.requiresHazmat));
        setSpecialInstructions(o.specialInstructions || '');
        setNotes(o.notes || '');
        if (Array.isArray(o.lineItems) && o.lineItems.length > 0) {
          setLineItems(o.lineItems.map((li: any, idx: number) => ({
            id: idx + 1,
            sku: li.sku || '',
            description: li.description || '',
            quantity: li.quantity != null ? String(li.quantity) : '',
            weight: li.weight != null ? String(li.weight) : '',
          })));
          nextLineId = o.lineItems.length + 1;
        }
      })
      .catch(err => setSubmitError(err.message));
  }, [id]);

  const handleSubmit = async () => {
    setSubmitError('');
    setSubmitting(true);
    try {
      const toIsoDate = (d: string) => d ? new Date(d + 'T00:00:00Z').toISOString() : undefined;
      if (isEdit && id) {
        const body: any = {
          poNumber: poNumber || undefined,
          originId: originLocation || undefined,
          destinationId: destLocation || undefined,
          requestedPickupDate: toIsoDate(orderDate),
          requestedDeliveryDate: toIsoDate(requestedDelivery),
          serviceLevel: serviceLevel || undefined,
          temperatureControl: tempControl || undefined,
          requiresHazmat: hazmat,
          specialInstructions: specialInstructions || undefined,
          notes: notes || undefined,
        };
        const res = await fetch(`${API_URL}/api/v1/orders/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error('Failed to update order');
        const json = await res.json();
        if (json.error) throw new Error(json.error);
        navigate(`/orders/${id}`);
        return;
      }
      const body: any = {
        poNumber, customerId: customer, originId: originLocation, destinationId: destLocation,
        requestedPickupDate: orderDate || undefined, requestedDeliveryDate: requestedDelivery || undefined,
        serviceLevel: serviceLevel || undefined,
        temperatureControl: tempControl, requiresHazmat: hazmat,
        lineItems: lineItems.filter(li => li.sku || li.description).map(li => ({
          sku: li.sku, description: li.description,
          quantity: li.quantity ? parseInt(li.quantity) : undefined,
          weight: li.weight ? parseFloat(li.weight) : undefined,
        })),
        specialInstructions, notes, importSource: 'manual',
      };
      const res = await fetch(`${API_URL}/api/v1/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('Failed to create order');
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      navigate('/orders');
    } catch (err: any) {
      setSubmitError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const addLineItem = () => {
    setLineItems(prev => [...prev, { id: nextLineId++, sku: '', description: '', quantity: '', weight: '' }]);
  };

  const removeLineItem = (id: number) => {
    setLineItems(prev => prev.length > 1 ? prev.filter(item => item.id !== id) : prev);
  };

  const updateLineItem = (id: number, field: keyof LineItem, value: string) => {
    setLineItems(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  return (
    <>
      <div className="vn-page-header">
        <div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
            <Link to="/orders" style={{ color: 'var(--color-primary)', textDecoration: 'none' }}>Orders</Link>
            {' '}&gt; {isEdit ? 'Edit Order' : 'New Order'}
          </p>
          <h1>{isEdit ? 'Edit Order' : 'New Order'}</h1>
        </div>
      </div>

      <div className="vn-card">
        <div className="vn-card-body" style={{ padding: '2rem' }}>

          {/* Order Details */}
          <div className="vn-form-section">
            <h3 className="vn-form-section-title">
              <span className="material-icons">receipt_long</span>
              Order Details
            </h3>
            <div className="vn-form-grid">
              <div className="vn-field">
                <label className="vn-field-label">Customer</label>
                <select className="vn-select" value={customer} onChange={e => setCustomer(e.target.value)} disabled={isEdit}>
                  <option value="">Select customer...</option>
                  {customers.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                {isEdit && <div className="vn-field-hint">Customer cannot be changed after creation</div>}
              </div>
              <div className="vn-field">
                <label className="vn-field-label">PO Number</label>
                <input className="vn-input" type="text" placeholder="Enter PO number" value={poNumber} onChange={e => setPoNumber(e.target.value)} />
              </div>
              <div className="vn-field">
                <label className="vn-field-label">Order Date</label>
                <input className="vn-input" type="date" value={orderDate} onChange={e => setOrderDate(e.target.value)} />
              </div>
              <div className="vn-field">
                <label className="vn-field-label">Requested Delivery Date</label>
                <input className="vn-input" type="date" value={requestedDelivery} onChange={e => setRequestedDelivery(e.target.value)} />
              </div>
              <div className="vn-field">
                <label className="vn-field-label">Service Level</label>
                <select className="vn-select" value={serviceLevel} onChange={e => setServiceLevel(e.target.value)}>
                  <option value="">Select service level...</option>
                  <option value="ftl">FTL</option>
                  <option value="ltl">LTL</option>
                </select>
              </div>
            </div>
          </div>

          {/* Origin & Destination */}
          <div className="vn-form-section">
            <h3 className="vn-form-section-title">
              <span className="material-icons">route</span>
              Origin &amp; Destination
            </h3>
            <div className="vn-form-grid">
              <div className="vn-field">
                <label className="vn-field-label">Origin Location</label>
                <select className="vn-select" value={originLocation} onChange={e => setOriginLocation(e.target.value)}>
                  <option value="">Select origin...</option>
                  {locations.map((l: any) => <option key={l.id} value={l.id}>{l.name} — {l.city}, {l.state}</option>)}
                </select>
              </div>
              <div className="vn-field">
                <label className="vn-field-label">Destination Location</label>
                <select className="vn-select" value={destLocation} onChange={e => setDestLocation(e.target.value)}>
                  <option value="">Select destination...</option>
                  {locations.map((l: any) => <option key={l.id} value={l.id}>{l.name} — {l.city}, {l.state}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Requirements */}
          <div className="vn-form-section">
            <h3 className="vn-form-section-title">
              <span className="material-icons">checklist</span>
              Requirements
            </h3>
            <div className="vn-form-grid">
              <div className="vn-field">
                <label className="vn-field-label">Temperature Control</label>
                <select className="vn-select" value={tempControl} onChange={e => setTempControl(e.target.value)}>
                  <option value="ambient">Ambient</option>
                  <option value="refrigerated">Refrigerated</option>
                  <option value="frozen">Frozen</option>
                </select>
              </div>
              <div className="vn-field">
                <label className="vn-field-label" aria-hidden="true" style={{ visibility: 'hidden' }}>Hazmat</label>
                <label className="vn-checkbox" style={{ display: 'flex', alignItems: 'center', gap: 8, height: 42 }}>
                  <input type="checkbox" checked={hazmat} onChange={e => setHazmat(e.target.checked)} />
                  Hazmat
                </label>
              </div>
              <div className="vn-field vn-col-span-2">
                <label className="vn-field-label">Special Instructions</label>
                <textarea className="vn-textarea" rows={3} placeholder="Enter any special instructions..." value={specialInstructions} onChange={e => setSpecialInstructions(e.target.value)} />
              </div>
            </div>
          </div>

          {/* Line Items */}
          {!isEdit && (
          <div className="vn-form-section">
            <h3 className="vn-form-section-title">
              <span className="material-icons">list</span>
              Line Items
            </h3>
            <div style={{ overflowX: 'auto' }}>
              <table className="vn-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '2px solid var(--border-color)', color: 'var(--text-secondary)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>SKU</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '2px solid var(--border-color)', color: 'var(--text-secondary)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Description</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '2px solid var(--border-color)', color: 'var(--text-secondary)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Qty</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '2px solid var(--border-color)', color: 'var(--text-secondary)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Weight (lb)</th>
                    <th style={{ padding: '0.75rem', textAlign: 'center', borderBottom: '2px solid var(--border-color)', width: '3rem' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {lineItems.map(item => (
                    <tr key={item.id}>
                      <td style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid var(--border-color)' }}>
                        <input className="vn-input" type="text" placeholder="SKU" value={item.sku} onChange={e => updateLineItem(item.id, 'sku', e.target.value)} />
                      </td>
                      <td style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid var(--border-color)' }}>
                        <input className="vn-input" type="text" placeholder="Description" value={item.description} onChange={e => updateLineItem(item.id, 'description', e.target.value)} />
                      </td>
                      <td style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid var(--border-color)', width: '6rem' }}>
                        <input className="vn-input" type="number" placeholder="0" value={item.quantity} onChange={e => updateLineItem(item.id, 'quantity', e.target.value)} />
                      </td>
                      <td style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid var(--border-color)', width: '7rem' }}>
                        <input className="vn-input" type="number" placeholder="0" value={item.weight} onChange={e => updateLineItem(item.id, 'weight', e.target.value)} />
                      </td>
                      <td style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid var(--border-color)', textAlign: 'center' }}>
                        <button
                          className="vn-btn vn-btn-danger"
                          style={{ padding: '0.25rem', minWidth: 'unset' }}
                          onClick={() => removeLineItem(item.id)}
                          title="Remove item"
                        >
                          <span className="material-icons" style={{ fontSize: '1.1rem' }}>delete</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ marginTop: '0.75rem' }}>
              <button className="vn-btn vn-btn-outline" onClick={addLineItem}>
                <span className="material-icons">add</span>
                Add Item
              </button>
            </div>
          </div>
          )}

          {submitError && <div className="vn-alert vn-alert-error" style={{ marginBottom: 16 }}>{submitError}</div>}

          {/* Form Actions */}
          <div className="vn-form-actions">
            <Link to={isEdit && id ? `/orders/${id}` : '/orders'} className="vn-btn vn-btn-outline">Cancel</Link>
            <button className="vn-btn vn-btn-primary" onClick={handleSubmit} disabled={submitting}>
              <span className="material-icons">{isEdit ? 'save' : 'add'}</span>
              {submitting ? (isEdit ? 'Saving...' : 'Creating...') : (isEdit ? 'Save Changes' : 'Create Order')}
            </button>
          </div>

        </div>
      </div>
    </>
  );
}
