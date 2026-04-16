import React, { useState, useEffect } from 'react';
import { API_URL } from '../api';

interface ReplenishmentRule {
  id: string;
  sku: string;
  pickFaceBinId: string;
  bulkZoneId: string;
  minQuantity: number;
  maxQuantity: number;
  active: boolean;
}

export default function VNextWmsReplenishment() {
  const [rules, setRules] = useState<ReplenishmentRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLocation, setSelectedLocation] = useState('');
  const [locations, setLocations] = useState<Array<{ id: string; name: string }>>([]);
  const [bins, setBins] = useState<Array<{ id: string; label: string; binType: string }>>([]);
  const [zones, setZones] = useState<Array<{ id: string; name: string }>>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ sku: '', pickFaceBinId: '', bulkZoneId: '', minQuantity: '5', maxQuantity: '20' });
  const [creating, setCreating] = useState(false);
  const [checking, setChecking] = useState(false);
  const [checkResult, setCheckResult] = useState<any>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`${API_URL}/api/v1/locations`).then(r => r.json()).then(res => {
      const locs = (res.data || []).filter((l: any) => !l.locationType || ['warehouse', 'distribution_centre', 'cross_dock'].includes(l.locationType));
      setLocations(locs);
      if (locs.length > 0) setSelectedLocation(locs[0].id);
      else setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const loadData = () => {
    if (!selectedLocation) return;
    setLoading(true);
    Promise.all([
      fetch(`${API_URL}/api/v1/replenishment/rules?locationId=${selectedLocation}`).then(r => r.json()).then(res => setRules(res.data || [])),
      fetch(`${API_URL}/api/v1/warehouse/bins?locationId=${selectedLocation}`).then(r => r.json()).then(res => setBins((res.data || []).filter((b: any) => b.active))),
      fetch(`${API_URL}/api/v1/warehouse/zones?locationId=${selectedLocation}`).then(r => r.json()).then(res => setZones((res.data || []).map((z: any) => ({ id: z.id, name: z.name })))),
    ]).finally(() => setLoading(false));
  };

  useEffect(() => { loadData(); }, [selectedLocation]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setCreating(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/replenishment/rules`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          locationId: selectedLocation,
          sku: createForm.sku.trim(),
          pickFaceBinId: createForm.pickFaceBinId,
          bulkZoneId: createForm.bulkZoneId,
          minQuantity: parseInt(createForm.minQuantity),
          maxQuantity: parseInt(createForm.maxQuantity),
        }),
      });
      const data = await res.json();
      if (data.error) setError(data.error);
      else { setShowCreate(false); loadData(); }
    } catch { setError('Failed to create'); }
    finally { setCreating(false); }
  };

  const handleCheck = async () => {
    setError('');
    setChecking(true);
    setCheckResult(null);
    try {
      const res = await fetch(`${API_URL}/api/v1/replenishment/check`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locationId: selectedLocation }),
      });
      const data = await res.json();
      if (data.error) setError(data.error);
      else setCheckResult(data.data);
    } catch { setError('Failed to check'); }
    finally { setChecking(false); }
  };

  const handleToggle = async (id: string, active: boolean) => {
    await fetch(`${API_URL}/api/v1/replenishment/rules/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !active }),
    });
    loadData();
  };

  const handleDelete = async (id: string) => {
    await fetch(`${API_URL}/api/v1/replenishment/rules/${id}`, { method: 'DELETE' });
    loadData();
  };

  const pickFaceBins = bins.filter(b => b.binType === 'shelf' || b.binType === 'pallet' || b.binType === 'floor');

  return (
    <div>
      <div className="vn-page-header">
        <div>
          <h1>Replenishment</h1>
          <p className="vn-page-subtitle">Auto-replenish pick faces from bulk storage when stock drops below minimum</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="vn-btn vn-btn-outline" onClick={handleCheck} disabled={checking}>
            <span className="material-icons" style={{ fontSize: '18px', marginRight: '0.5rem' }}>refresh</span>
            {checking ? 'Checking...' : 'Run Check'}
          </button>
          <button className="vn-btn vn-btn-primary" onClick={() => setShowCreate(true)}>
            <span className="material-icons" style={{ fontSize: '18px', marginRight: '0.5rem' }}>add</span>
            Add Rule
          </button>
        </div>
      </div>

      {error && <div className="vn-alert vn-alert-error" style={{ marginBottom: '1rem' }}>{error}</div>}
      {checkResult && (
        <div className={`vn-alert ${checkResult.tasksCreated > 0 ? 'vn-alert-success' : 'vn-alert-info'}`} style={{ marginBottom: '1rem' }}>
          {checkResult.tasksCreated > 0
            ? `Created ${checkResult.tasksCreated} replenishment task(s): ${checkResult.details.map((d: any) => `${d.sku} to ${d.pickFaceBin} (qty ${d.quantity})`).join(', ')}`
            : 'All pick faces are above minimum levels. No replenishment needed.'}
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <div className="vn-modal-backdrop" onClick={() => setShowCreate(false)}>
          <div className="vn-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div className="vn-modal-header"><h3>New Replenishment Rule</h3><button onClick={() => setShowCreate(false)}><span className="material-icons">close</span></button></div>
            <form onSubmit={handleCreate}>
              <div className="vn-modal-body">
                <div className="vn-field" style={{ marginBottom: '1rem' }}>
                  <label className="vn-field-label">SKU *</label>
                  <input className="vn-input" value={createForm.sku} onChange={e => setCreateForm({ ...createForm, sku: e.target.value })} required />
                </div>
                <div className="vn-field" style={{ marginBottom: '1rem' }}>
                  <label className="vn-field-label">Pick Face Bin *</label>
                  <select className="vn-input" value={createForm.pickFaceBinId} onChange={e => setCreateForm({ ...createForm, pickFaceBinId: e.target.value })} required>
                    <option value="">Select bin...</option>
                    {pickFaceBins.map(b => <option key={b.id} value={b.id}>{b.label} ({b.binType})</option>)}
                  </select>
                </div>
                <div className="vn-field" style={{ marginBottom: '1rem' }}>
                  <label className="vn-field-label">Bulk Zone (pull from) *</label>
                  <select className="vn-input" value={createForm.bulkZoneId} onChange={e => setCreateForm({ ...createForm, bulkZoneId: e.target.value })} required>
                    <option value="">Select zone...</option>
                    {zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
                  </select>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="vn-field">
                    <label className="vn-field-label">Min Qty (trigger) *</label>
                    <input className="vn-input" type="number" min="1" value={createForm.minQuantity} onChange={e => setCreateForm({ ...createForm, minQuantity: e.target.value })} required />
                  </div>
                  <div className="vn-field">
                    <label className="vn-field-label">Max Qty (replenish to) *</label>
                    <input className="vn-input" type="number" min="1" value={createForm.maxQuantity} onChange={e => setCreateForm({ ...createForm, maxQuantity: e.target.value })} required />
                  </div>
                </div>
              </div>
              <div className="vn-modal-footer">
                <button type="button" className="vn-btn vn-btn-outline" onClick={() => setShowCreate(false)}>Cancel</button>
                <button type="submit" className="vn-btn vn-btn-primary" disabled={creating}>{creating ? 'Creating...' : 'Create Rule'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="vn-filters" style={{ marginBottom: '1rem' }}>
        <select className="vn-filter-select" value={selectedLocation} onChange={e => setSelectedLocation(e.target.value)}>
          {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
      </div>

      {loading ? (
        <div style={{ padding: '2rem', textAlign: 'center' }}><div className="vn-loading-spinner" /></div>
      ) : rules.length === 0 ? (
        <div className="vn-card" style={{ textAlign: 'center', padding: '3rem' }}>
          <span className="material-icons" style={{ fontSize: '48px', color: 'var(--text-secondary)', marginBottom: '1rem', display: 'block' }}>sync</span>
          <h3>No replenishment rules</h3>
          <p style={{ color: 'var(--text-secondary)' }}>Set up rules to auto-replenish pick faces when stock drops below a threshold.</p>
        </div>
      ) : (
        <div className="vn-table-wrap">
          <table className="vn-table">
            <thead>
              <tr><th>SKU</th><th>Pick Face Bin</th><th>Bulk Zone</th><th>Min Qty</th><th>Max Qty</th><th>Active</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {rules.map(r => (
                <tr key={r.id}>
                  <td><strong>{r.sku}</strong></td>
                  <td>{bins.find(b => b.id === r.pickFaceBinId)?.label ?? r.pickFaceBinId.slice(0, 8)}</td>
                  <td>{zones.find(z => z.id === r.bulkZoneId)?.name ?? r.bulkZoneId.slice(0, 8)}</td>
                  <td>{r.minQuantity}</td>
                  <td>{r.maxQuantity}</td>
                  <td>
                    <span className={`vn-chip ${r.active ? 'vn-chip-success' : 'vn-chip-secondary'}`} style={{ cursor: 'pointer' }} onClick={() => handleToggle(r.id, r.active)}>
                      {r.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>
                    <button className="vn-btn vn-btn-outline" style={{ fontSize: '0.75rem', padding: '0.15rem 0.4rem', color: 'var(--color-error)' }} onClick={() => handleDelete(r.id)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
