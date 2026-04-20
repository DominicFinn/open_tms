import React, { useState, useEffect } from 'react';
import { API_URL } from '../api';

interface Carton {
  id: string; name: string;
  lengthMm: number; widthMm: number; heightMm: number;
  maxWeightGrams: number; unitCostCents: number | null; active: boolean;
  temperatureZone: string; insulated: boolean; insulationHours: number | null;
  tamperEvident: boolean; valueClass: string;
  hazmatRated: boolean; hazmatClasses: string[];
  materialType: string;
}

export default function VNextWmsCartonCatalogue() {
  const [cartons, setCartons] = useState<Carton[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLocation, setSelectedLocation] = useState('');
  const [locations, setLocations] = useState<Array<{ id: string; name: string }>>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const emptyForm = {
    name: '', lengthMm: '', widthMm: '', heightMm: '', maxWeightGrams: '', unitCostCents: '',
    temperatureZone: 'any', insulated: false, insulationHours: '',
    tamperEvident: false, valueClass: 'any',
    hazmatRated: false, hazmatClasses: '',
    materialType: 'corrugated',
  };
  const [form, setForm] = useState(emptyForm);

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
          temperatureZone: form.temperatureZone,
          insulated: form.insulated,
          insulationHours: form.insulationHours ? parseInt(form.insulationHours) : null,
          tamperEvident: form.tamperEvident,
          valueClass: form.valueClass,
          hazmatRated: form.hazmatRated,
          hazmatClasses: form.hazmatClasses.split(',').map(s => s.trim()).filter(Boolean),
          materialType: form.materialType,
        }),
      });
      const data = await res.json();
      if (data.error) setError(data.error);
      else { setShowCreate(false); setForm(emptyForm); loadData(); }
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

                <h4 style={{ margin: '16px 0 8px', fontSize: 13, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Container intelligence</h4>
                <div className="vn-form-grid">
                  <div className="vn-field">
                    <label className="vn-field-label">Temperature zone</label>
                    <select className="vn-input" value={form.temperatureZone} onChange={e => setForm({ ...form, temperatureZone: e.target.value })}>
                      <option value="any">Any (ambient)</option>
                      <option value="ambient">Ambient</option>
                      <option value="refrigerated">Refrigerated</option>
                      <option value="frozen">Frozen</option>
                      <option value="dry_ice">Dry ice</option>
                    </select>
                  </div>
                  <div className="vn-field">
                    <label className="vn-field-label">Value class</label>
                    <select className="vn-input" value={form.valueClass} onChange={e => setForm({ ...form, valueClass: e.target.value })}>
                      <option value="any">Any</option>
                      <option value="standard">Standard</option>
                      <option value="high_value">High-value</option>
                    </select>
                  </div>
                  <div className="vn-field">
                    <label className="vn-field-label">Material</label>
                    <select className="vn-input" value={form.materialType} onChange={e => setForm({ ...form, materialType: e.target.value })}>
                      <option value="corrugated">Corrugated</option>
                      <option value="plastic">Plastic</option>
                      <option value="metal">Metal</option>
                      <option value="foam">Foam</option>
                      <option value="composite">Composite</option>
                    </select>
                  </div>
                  <div className="vn-field">
                    <label className="vn-field-label">Insulation hours (optional)</label>
                    <input className="vn-input" type="number" min="0" value={form.insulationHours} onChange={e => setForm({ ...form, insulationHours: e.target.value })} placeholder="e.g. 24" />
                  </div>
                  <div className="vn-field" style={{ gridColumn: '1 / -1' }}>
                    <label className="vn-field-label">Hazmat UN classes (comma-separated, e.g. "3, 5.1")</label>
                    <input className="vn-input" value={form.hazmatClasses} onChange={e => setForm({ ...form, hazmatClasses: e.target.value })} placeholder="Leave blank for non-hazmat" />
                  </div>
                </div>
                <div style={{ marginTop: 8, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <input type="checkbox" checked={form.insulated} onChange={e => setForm({ ...form, insulated: e.target.checked })} /> Insulated
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <input type="checkbox" checked={form.tamperEvident} onChange={e => setForm({ ...form, tamperEvident: e.target.checked })} /> Tamper-evident
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <input type="checkbox" checked={form.hazmatRated} onChange={e => setForm({ ...form, hazmatRated: e.target.checked })} /> Hazmat-rated
                  </label>
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
            <thead><tr><th>Name</th><th>L x W x H (mm)</th><th>Volume (L)</th><th>Max Weight (g)</th><th>Temp</th><th>Value</th><th>Hazmat</th><th>Material</th><th>Cost</th></tr></thead>
            <tbody>
              {cartons.map(c => (
                <tr key={c.id}>
                  <td>
                    <strong>{c.name}</strong>
                    {c.insulated && <span className="vn-chip vn-chip-info" style={{ marginLeft: 6, fontSize: 10 }}>insulated{c.insulationHours ? ` ${c.insulationHours}h` : ''}</span>}
                    {c.tamperEvident && <span className="vn-chip vn-chip-warning" style={{ marginLeft: 6, fontSize: 10 }}>tamper-evident</span>}
                  </td>
                  <td>{c.lengthMm} x {c.widthMm} x {c.heightMm}</td>
                  <td>{volumeLitres(c)}</td>
                  <td>{c.maxWeightGrams.toLocaleString()}</td>
                  <td><span className="vn-chip vn-chip-secondary" style={{ fontSize: 11 }}>{c.temperatureZone}</span></td>
                  <td><span className="vn-chip vn-chip-secondary" style={{ fontSize: 11 }}>{c.valueClass}</span></td>
                  <td>
                    {c.hazmatRated
                      ? <span className="vn-chip vn-chip-error" style={{ fontSize: 11 }}>{(c.hazmatClasses ?? []).join(', ') || 'yes'}</span>
                      : <span className="vn-table-secondary">-</span>}
                  </td>
                  <td>{c.materialType}</td>
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
