import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_URL } from '../api';
import './warehouse.css';

export default function WarehouseCreateShipment() {
  const navigate = useNavigate();
  const [reference, setReference] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [originId, setOriginId] = useState('');
  const [destinationId, setDestinationId] = useState('');
  const [pickupDate, setPickupDate] = useState('');
  const [carrierId, setCarrierId] = useState('');
  const [customers, setCustomers] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [carriers, setCarriers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Pre-fill origin from selected warehouse location
  useEffect(() => {
    try {
      const loc = JSON.parse(localStorage.getItem('warehouse_location') || '{}');
      if (loc.id) setOriginId(loc.id);
    } catch {}
  }, []);

  useEffect(() => {
    Promise.all([
      fetch(`${API_URL}/api/v1/customers`).then(r => r.json()),
      fetch(`${API_URL}/api/v1/warehouse/locations`).then(r => r.json()),
      fetch(`${API_URL}/api/v1/carriers`).then(r => r.json()),
    ]).then(([cust, loc, carr]) => {
      setCustomers(cust.data || []);
      setLocations(loc.data || []);
      setCarriers(carr.data || []);
    });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!reference || !customerId || !originId || !destinationId) {
      setError('Please fill in all required fields');
      return;
    }
    setLoading(true);
    setError('');

    try {
      const res = await fetch(`${API_URL}/api/v1/warehouse/shipments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reference,
          customerId,
          originId,
          destinationId,
          pickupDate: pickupDate || undefined,
          carrierId: carrierId || undefined,
        }),
      });
      const json = await res.json();
      if (json.error) {
        setError(json.error);
        setLoading(false);
        return;
      }
      navigate(`/warehouse/shipments/${json.data.id}`);
    } catch {
      setError('Network error');
      setLoading(false);
    }
  }

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
        <button className="wh-action-btn wh-action-btn-outline" style={{ flex: 'none', padding: '8px 12px' }} onClick={() => navigate('/warehouse')}>
          <span className="material-icons">arrow_back</span>
        </button>
        <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>Create Shipment</h2>
      </div>

      {error && (
        <div className="wh-banner wh-banner-error">
          <span className="material-icons">error</span>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div className="wh-login-field">
          <label>Reference *</label>
          <input
            type="text"
            value={reference}
            onChange={e => setReference(e.target.value)}
            placeholder="SH-001"
            required
            data-manual-input="true"
          />
        </div>

        <div className="wh-login-field">
          <label>Customer *</label>
          <select
            value={customerId}
            onChange={e => setCustomerId(e.target.value)}
            required
            style={{
              width: '100%', padding: '10px 12px', borderRadius: '8px',
              border: '1px solid var(--outline-variant)', fontSize: '16px',
              background: 'var(--surface)', color: 'var(--on-surface)',
            }}
          >
            <option value="">Select customer</option>
            {customers.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        <div className="wh-login-field">
          <label>Origin *</label>
          <select
            value={originId}
            onChange={e => setOriginId(e.target.value)}
            required
            style={{
              width: '100%', padding: '10px 12px', borderRadius: '8px',
              border: '1px solid var(--outline-variant)', fontSize: '16px',
              background: 'var(--surface)', color: 'var(--on-surface)',
            }}
          >
            <option value="">Select origin</option>
            {locations.map(l => (
              <option key={l.id} value={l.id}>{l.name} — {l.city}</option>
            ))}
          </select>
        </div>

        <div className="wh-login-field">
          <label>Destination *</label>
          <select
            value={destinationId}
            onChange={e => setDestinationId(e.target.value)}
            required
            style={{
              width: '100%', padding: '10px 12px', borderRadius: '8px',
              border: '1px solid var(--outline-variant)', fontSize: '16px',
              background: 'var(--surface)', color: 'var(--on-surface)',
            }}
          >
            <option value="">Select destination</option>
            {locations.map(l => (
              <option key={l.id} value={l.id}>{l.name} — {l.city}</option>
            ))}
          </select>
        </div>

        <div className="wh-login-field">
          <label>Pickup Date</label>
          <input
            type="date"
            value={pickupDate}
            onChange={e => setPickupDate(e.target.value)}
            style={{
              width: '100%', padding: '10px 12px', borderRadius: '8px',
              border: '1px solid var(--outline-variant)', fontSize: '16px',
              background: 'var(--surface)', color: 'var(--on-surface)',
              boxSizing: 'border-box',
            }}
          />
        </div>

        <div className="wh-login-field">
          <label>Carrier</label>
          <select
            value={carrierId}
            onChange={e => setCarrierId(e.target.value)}
            style={{
              width: '100%', padding: '10px 12px', borderRadius: '8px',
              border: '1px solid var(--outline-variant)', fontSize: '16px',
              background: 'var(--surface)', color: 'var(--on-surface)',
            }}
          >
            <option value="">None</option>
            {carriers.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        <button
          type="submit"
          className="wh-login-btn wh-login-btn-primary"
          disabled={loading}
          style={{ marginTop: '8px' }}
        >
          {loading ? 'Creating...' : 'Create Shipment'}
        </button>
      </form>
    </>
  );
}
