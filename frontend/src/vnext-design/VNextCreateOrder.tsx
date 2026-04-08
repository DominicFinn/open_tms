import React, { useState } from 'react';
import { Link } from 'react-router-dom';

interface LineItem {
  id: number;
  sku: string;
  description: string;
  quantity: string;
  weight: string;
}

let nextLineId = 2;

export default function VNextCreateOrder() {
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

  const [lineItems, setLineItems] = useState<LineItem[]>([
    { id: 1, sku: '', description: '', quantity: '', weight: '' },
  ]);

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
            <Link to="/vnext/orders" style={{ color: 'var(--color-primary)', textDecoration: 'none' }}>Orders</Link>
            {' '}&gt; New Order
          </p>
          <h1>New Order</h1>
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
                <select className="vn-select" value={customer} onChange={e => setCustomer(e.target.value)}>
                  <option value="">Select customer...</option>
                  <option value="acme">Acme Corp</option>
                  <option value="global">Global Widgets</option>
                  <option value="techstart">TechStart Inc</option>
                  <option value="freshfoods">FreshFoods LLC</option>
                  <option value="industrial">Industrial Co</option>
                </select>
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
                  <option value="chi">Chicago Distribution Center</option>
                  <option value="la">Los Angeles Terminal</option>
                  <option value="atl">Atlanta Hub</option>
                  <option value="nyc">New York Cross-Dock</option>
                  <option value="den">Denver Cold Storage</option>
                </select>
              </div>
              <div className="vn-field">
                <label className="vn-field-label">Destination Location</label>
                <select className="vn-select" value={destLocation} onChange={e => setDestLocation(e.target.value)}>
                  <option value="">Select destination...</option>
                  <option value="dal">Dallas Warehouse</option>
                  <option value="phx">Phoenix Staging Area</option>
                  <option value="mia">Miami Import Yard</option>
                  <option value="sea">Seattle Port Facility</option>
                  <option value="min">Minneapolis Yard</option>
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
              <div className="vn-field" style={{ display: 'flex', alignItems: 'flex-end' }}>
                <label className="vn-checkbox">
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

          {/* Form Actions */}
          <div className="vn-form-actions">
            <Link to="/vnext/orders" className="vn-btn vn-btn-outline">Cancel</Link>
            <button className="vn-btn vn-btn-primary">
              <span className="material-icons">add</span>
              Create Order
            </button>
          </div>

        </div>
      </div>
    </>
  );
}
