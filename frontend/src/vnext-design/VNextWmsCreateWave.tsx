import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_URL } from '../api';

interface OrderOption {
  id: string;
  orderNumber: string;
  customerName: string;
  status: string;
  lineItemCount: number;
}

export default function VNextWmsCreateWave() {
  const navigate = useNavigate();
  const [locations, setLocations] = useState<Array<{ id: string; name: string }>>([]);
  const [orders, setOrders] = useState<OrderOption[]>([]);
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    locationId: '',
    pickStrategy: 'discrete',
    cutoffAt: '',
  });

  useEffect(() => {
    fetch(`${API_URL}/api/v1/locations`)
      .then(r => r.json())
      .then(res => {
        const locs = (res.data || []).filter(
          (l: any) => !l.locationType || ['warehouse', 'distribution_centre', 'cross_dock'].includes(l.locationType)
        );
        setLocations(locs);
        if (locs.length === 1) setForm(f => ({ ...f, locationId: locs[0].id }));
      });
  }, []);

  useEffect(() => {
    // Load orders that could be waved (accepted/ready status)
    setLoading(true);
    fetch(`${API_URL}/api/v1/orders`)
      .then(r => r.json())
      .then(res => {
        const eligible = (res.data || []).filter(
          (o: any) => o.status === 'accepted' || o.status === 'ready_to_pick' || o.status === 'processing'
        );
        setOrders(eligible.map((o: any) => ({
          id: o.id,
          orderNumber: o.orderNumber || o.id.slice(0, 8),
          customerName: o.customerName || o.customer?.name || '--',
          status: o.status,
          lineItemCount: o.lineItemCount ?? o._count?.lineItems ?? 0,
        })));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const toggleOrder = (id: string) => {
    const next = new Set(selectedOrders);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedOrders(next);
  };

  const selectAll = () => {
    if (selectedOrders.size === orders.length) setSelectedOrders(new Set());
    else setSelectedOrders(new Set(orders.map(o => o.id)));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedOrders.size === 0) { setError('Select at least one order'); return; }
    if (!form.locationId) { setError('Select a location'); return; }
    setError('');
    setSaving(true);

    try {
      const res = await fetch(`${API_URL}/api/v1/waves`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          locationId: form.locationId,
          pickStrategy: form.pickStrategy,
          orderIds: [...selectedOrders],
          cutoffAt: form.cutoffAt || null,
        }),
      });
      const data = await res.json();
      if (data.error) setError(data.error);
      else navigate(`/wms/waves/${data.data.id}`);
    } catch { setError('Failed to create wave'); }
    finally { setSaving(false); }
  };

  return (
    <div>
      <div className="vn-page-header">
        <div>
          <h1>Create Wave</h1>
          <p className="vn-page-subtitle">Group orders into a pick wave for efficient fulfillment</p>
        </div>
      </div>

      {error && <div className="vn-alert vn-alert-error" style={{ marginBottom: '1rem' }}>{error}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '1.5rem' }}>
        {/* Config panel */}
        <form onSubmit={handleSubmit} className="vn-card" style={{ alignSelf: 'start' }}>
          <h3 style={{ margin: '0 0 1rem' }}>Wave Settings</h3>
          <div className="vn-field" style={{ marginBottom: '1rem' }}>
            <label className="vn-field-label">Location *</label>
            <select className="vn-input" value={form.locationId} onChange={e => setForm({ ...form, locationId: e.target.value })} required>
              <option value="">Select...</option>
              {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>
          <div className="vn-field" style={{ marginBottom: '1rem' }}>
            <label className="vn-field-label">Pick Strategy *</label>
            <select className="vn-input" value={form.pickStrategy} onChange={e => setForm({ ...form, pickStrategy: e.target.value })}>
              <option value="discrete">Discrete (one picker per order)</option>
              <option value="batch">Batch (combine all orders)</option>
              <option value="zone">Zone (split by zone)</option>
            </select>
          </div>
          <div className="vn-field" style={{ marginBottom: '1.5rem' }}>
            <label className="vn-field-label">Cutoff Time</label>
            <input className="vn-input" type="datetime-local" value={form.cutoffAt} onChange={e => setForm({ ...form, cutoffAt: e.target.value })} />
          </div>

          <div style={{ padding: '0.75rem', background: 'var(--surface-secondary)', borderRadius: '6px', marginBottom: '1rem' }}>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Selected Orders</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{selectedOrders.size}</div>
          </div>

          <div className="vn-form-actions">
            <button type="button" className="vn-btn vn-btn-outline" onClick={() => navigate('/wms/waves')}>Cancel</button>
            <button type="submit" className="vn-btn vn-btn-primary" disabled={saving || selectedOrders.size === 0}>
              {saving ? 'Creating...' : 'Create Wave'}
            </button>
          </div>
        </form>

        {/* Order selection table */}
        <div className="vn-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ margin: 0 }}>Select Orders</h3>
            <button className="vn-btn vn-btn-outline" style={{ fontSize: '0.85rem' }} onClick={selectAll}>
              {selectedOrders.size === orders.length ? 'Deselect All' : 'Select All'}
            </button>
          </div>

          {loading ? (
            <div style={{ padding: '2rem', textAlign: 'center' }}><div className="vn-loading-spinner" /></div>
          ) : orders.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
              No eligible orders found. Orders must be in accepted/processing status.
            </div>
          ) : (
            <div className="vn-table-wrap">
              <table className="vn-table">
                <thead>
                  <tr><th style={{ width: '40px' }}></th><th>Order</th><th>Customer</th><th>Status</th><th>Lines</th></tr>
                </thead>
                <tbody>
                  {orders.map(o => (
                    <tr key={o.id} onClick={() => toggleOrder(o.id)} style={{ cursor: 'pointer', background: selectedOrders.has(o.id) ? 'var(--surface-secondary)' : undefined }}>
                      <td><input type="checkbox" checked={selectedOrders.has(o.id)} onChange={() => toggleOrder(o.id)} /></td>
                      <td><strong>{o.orderNumber}</strong></td>
                      <td>{o.customerName}</td>
                      <td><span className="vn-chip vn-chip-info">{o.status}</span></td>
                      <td>{o.lineItemCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
