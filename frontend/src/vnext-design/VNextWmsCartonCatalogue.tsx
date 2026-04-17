import React, { useState, useEffect } from 'react';
import { API_URL } from '../api';

interface Carton { id: string; name: string; lengthMm: number; widthMm: number; heightMm: number; maxWeightGrams: number; unitCostCents: number | null; active: boolean; }

export default function VNextWmsCartonCatalogue() {
  const [cartons, setCartons] = useState<Carton[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLocation, setSelectedLocation] = useState('');
  const [locations, setLocations] = useState<Array<{ id: string; name: string }>>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ name: '', lengthMm: '', widthMm: '', heightMm: '', maxWeightGrams: '', unitCostCents: '' });

  useEffect(() => {
    fetch(`${API_URL}/api/v1/locations`).then(r => r.json()).then(res => {
      const locs = (res.data || []).filter((l: any) => !l.locationType || ['warehouse', 'distribution_centre', 'cross_dock'].includes(l.locationType));
      setLocations(locs);
      if (locs.length > 0) setSelectedLocation(locs[0].id);
      else setLoading(false);
    });
  }, []);

  const loadData = () => {
    if (!selectedLocation) return;
    setLoading(true);
    fetch(`${API_URL}/api/v1/carton-catalogue?locationId=${selectedLocation}`).then(r => r.json()).then(res => setCartons(res.data || [])).finally(() => setLoading(false));
  };
  useEffect(() => { loadData(); }, [selectedLocation]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setCreating(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/carton-catalogue`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          locationId: selectedLocation, name: form.name.trim(),
          lengthMm: parseInt(form.lengthMm), widthMm: parseInt(form.widthMm),
          heightMm: parseInt(form.heightMm), maxWeightGrams: parseInt(form.maxWeightGrams),
          unitCostCents: form.unitCostCents ? parseInt(form.unitCostCents) : null,
        }),
      });
      const data = await res.json();
      if (data.error) setError(data.error);
      else { setShowCreate(false); setForm({ name: '', lengthMm: '', widthMm: '', heightMm: '', maxWeightGrams: '', unitCostCents: '' }); loadData(); }
    } catch { setError('Failed'); }
    finally { setCreating(false); }
  };

  const volumeLitres = (c: Carton) => ((c.lengthMm * c.widthMm * c.heightMm) / 1e6).toFixed(1);

  return (
    <div>
      <div className="vn-page-header">
        <div><h1>Carton Catalogue</h1><p className="vn-page-subtitle">Available carton sizes for packing recommendations</p></div>
        <button className="vn-btn vn-btn-primary" onClick={() => setShowCreate(true)}>
          <span className="material-icons" style={{ fontSize: '18px', marginRight: '0.5rem' }}>add</span>Add Carton
        </button>
      </div>

      {error && <div className="vn-alert vn-alert-error" style={{ marginBottom: '1rem' }}>{error}</div>}

      {showCreate && (
        <div className="vn-modal-backdrop" onClick={() => setShowCreate(false)}>
          <div className="vn-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div className="vn-modal-header"><h3>Add Carton Size</h3><button onClick={() => setShowCreate(false)}><span className="material-icons">close</span></button></div>
            <form onSubmit={handleCreate}>
              <div className="vn-modal-body">
                <div className="vn-form-grid">
                  <div className="vn-field" style={{ gridColumn: '1 / -1' }}><label className="vn-field-label">Name *</label><input className="vn-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder='e.g. "Small Mailer", "Medium Box"' required /></div>
                  <div className="vn-field"><label className="vn-field-label">Length (mm) *</label><input className="vn-input" type="number" min="1" value={form.lengthMm} onChange={e => setForm({ ...form, lengthMm: e.target.value })} required /></div>
                  <div className="vn-field"><label className="vn-field-label">Width (mm) *</label><input className="vn-input" type="number" min="1" value={form.widthMm} onChange={e => setForm({ ...form, widthMm: e.target.value })} required /></div>
                  <div className="vn-field"><label className="vn-field-label">Height (mm) *</label><input className="vn-input" type="number" min="1" value={form.heightMm} onChange={e => setForm({ ...form, heightMm: e.target.value })} required /></div>
                  <div className="vn-field"><label className="vn-field-label">Max Weight (g) *</label><input className="vn-input" type="number" min="1" value={form.maxWeightGrams} onChange={e => setForm({ ...form, maxWeightGrams: e.target.value })} required /></div>
                  <div className="vn-field" style={{ gridColumn: '1 / -1' }}><label className="vn-field-label">Unit Cost (cents)</label><input className="vn-input" type="number" min="0" value={form.unitCostCents} onChange={e => setForm({ ...form, unitCostCents: e.target.value })} placeholder="Optional" /></div>
                </div>
              </div>
              <div className="vn-modal-footer">
                <button type="button" className="vn-btn vn-btn-outline" onClick={() => setShowCreate(false)}>Cancel</button>
                <button type="submit" className="vn-btn vn-btn-primary" disabled={creating}>{creating ? 'Saving...' : 'Save'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="vn-filters" style={{ marginBottom: '1rem' }}>
        <select className="vn-filter-select" value={selectedLocation} onChange={e => setSelectedLocation(e.target.value)}>
          {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
      </div>

      {loading ? <div style={{ padding: '2rem', textAlign: 'center' }}><div className="vn-loading-spinner" /></div> : cartons.length === 0 ? (
        <div className="vn-card" style={{ textAlign: 'center', padding: '3rem' }}>
          <span className="material-icons" style={{ fontSize: '48px', color: 'var(--text-secondary)', marginBottom: '1rem', display: 'block' }}>package_2</span>
          <h3>No carton sizes defined</h3>
          <p style={{ color: 'var(--text-secondary)' }}>Add your available box sizes to enable automatic carton recommendations at packing.</p>
        </div>
      ) : (
        <div className="vn-table-wrap">
          <table className="vn-table">
            <thead><tr><th>Name</th><th>L x W x H (mm)</th><th>Volume (L)</th><th>Max Weight (g)</th><th>Cost</th></tr></thead>
            <tbody>
              {cartons.map(c => (
                <tr key={c.id}>
                  <td><strong>{c.name}</strong></td>
                  <td>{c.lengthMm} x {c.widthMm} x {c.heightMm}</td>
                  <td>{volumeLitres(c)}</td>
                  <td>{c.maxWeightGrams.toLocaleString()}</td>
                  <td>{c.unitCostCents != null ? `$${(c.unitCostCents / 100).toFixed(2)}` : '--'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
