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

type FormState = {
  name: string;
  lengthMm: string;
  widthMm: string;
  heightMm: string;
  maxWeightGrams: string;
  unitCostCents: string;
  temperatureZone: string;
  insulated: boolean;
  insulationHours: string;
  tamperEvident: boolean;
  valueClass: string;
  hazmatRated: boolean;
  hazmatClasses: string;
  materialType: string;
};

const emptyForm: FormState = {
  name: '', lengthMm: '', widthMm: '', heightMm: '', maxWeightGrams: '', unitCostCents: '',
  temperatureZone: 'any', insulated: false, insulationHours: '',
  tamperEvident: false, valueClass: 'any',
  hazmatRated: false, hazmatClasses: '',
  materialType: 'corrugated',
};

function cartonToForm(c: Carton): FormState {
  return {
    name: c.name,
    lengthMm: String(c.lengthMm),
    widthMm: String(c.widthMm),
    heightMm: String(c.heightMm),
    maxWeightGrams: String(c.maxWeightGrams),
    unitCostCents: c.unitCostCents != null ? String(c.unitCostCents) : '',
    temperatureZone: c.temperatureZone || 'any',
    insulated: !!c.insulated,
    insulationHours: c.insulationHours != null ? String(c.insulationHours) : '',
    tamperEvident: !!c.tamperEvident,
    valueClass: c.valueClass || 'any',
    hazmatRated: !!c.hazmatRated,
    hazmatClasses: (c.hazmatClasses || []).join(', '),
    materialType: c.materialType || 'corrugated',
  };
}

export default function VNextWmsCartonCatalogue() {
  const [cartons, setCartons] = useState<Carton[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLocation, setSelectedLocation] = useState('');
  const [locations, setLocations] = useState<Array<{ id: string; name: string }>>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);

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
    const params = new URLSearchParams({ locationId: selectedLocation });
    if (showArchived) params.set('includeArchived', 'true');
    fetch(`${API_URL}/api/v1/carton-catalogue?${params}`)
      .then(r => r.json())
      .then(res => setCartons(res.data || []))
      .finally(() => setLoading(false));
  };
  useEffect(() => { loadData(); }, [selectedLocation, showArchived]);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setError('');
    setShowModal(true);
  };

  const openEdit = (c: Carton) => {
    setEditingId(c.id);
    setForm(cartonToForm(c));
    setError('');
    setShowModal(true);
  };

  const buildBody = () => ({
    name: form.name.trim(),
    lengthMm: parseInt(form.lengthMm),
    widthMm: parseInt(form.widthMm),
    heightMm: parseInt(form.heightMm),
    maxWeightGrams: parseInt(form.maxWeightGrams),
    unitCostCents: form.unitCostCents ? parseInt(form.unitCostCents) : null,
    temperatureZone: form.temperatureZone,
    insulated: form.insulated,
    insulationHours: form.insulationHours ? parseInt(form.insulationHours) : null,
    tamperEvident: form.tamperEvident,
    valueClass: form.valueClass,
    hazmatRated: form.hazmatRated,
    hazmatClasses: form.hazmatClasses.split(',').map(s => s.trim()).filter(Boolean),
    materialType: form.materialType,
  });

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const body = buildBody();
      let res: Response;
      if (editingId) {
        res = await fetch(`${API_URL}/api/v1/carton-catalogue/${editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      } else {
        res = await fetch(`${API_URL}/api/v1/carton-catalogue`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...body, locationId: selectedLocation }),
        });
      }
      const json = await res.json();
      if (json.error) {
        setError(json.error);
      } else {
        setShowModal(false);
        setEditingId(null);
        setForm(emptyForm);
        loadData();
      }
    } catch {
      setError('Save failed');
    } finally {
      setBusy(false);
    }
  };

  const handleArchive = async (c: Carton) => {
    setNotice('');
    if (!confirm(`Archive "${c.name}"? It will be hidden from packing recommendations but audit history is preserved.`)) return;
    const res = await fetch(`${API_URL}/api/v1/carton-catalogue/${c.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: false }),
    });
    const json = await res.json();
    if (json.error) setError(json.error);
    else { setNotice(`Archived "${c.name}".`); loadData(); }
  };

  const handleRestore = async (c: Carton) => {
    const res = await fetch(`${API_URL}/api/v1/carton-catalogue/${c.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: true }),
    });
    const json = await res.json();
    if (json.error) setError(json.error);
    else { setNotice(`Restored "${c.name}".`); loadData(); }
  };

  const handleDelete = async (c: Carton) => {
    setNotice('');
    if (!confirm(`Delete "${c.name}" permanently? This cannot be undone. If the carton has been used in any pack audit, it will be archived instead.`)) return;
    const res = await fetch(`${API_URL}/api/v1/carton-catalogue/${c.id}`, { method: 'DELETE' });
    const json = await res.json();
    if (json.error) {
      setError(json.error);
      return;
    }
    if (json.data?.archived) {
      setNotice(`"${c.name}" is referenced by ${json.data.referencedCount} pack audit(s), so it was archived instead of deleted.`);
    } else {
      setNotice(`Deleted "${c.name}".`);
    }
    loadData();
  };

  const volumeLitres = (c: Carton) => ((c.lengthMm * c.widthMm * c.heightMm) / 1e6).toFixed(1);

  return (
    <div>
      <div className="vn-page-header">
        <div>
          <h1>Carton Catalogue</h1>
          <p className="vn-page-subtitle">Available carton sizes for packing recommendations</p>
        </div>
        <div className="vn-page-actions">
          <button className="vn-btn vn-btn-primary" onClick={openCreate}>
            <span className="material-icons" style={{ fontSize: '18px', marginRight: '0.5rem' }}>add</span>Add Carton
          </button>
        </div>
      </div>

      {error && <div className="vn-alert vn-alert-error" style={{ marginBottom: '1rem' }}>{error}</div>}
      {notice && <div className="vn-alert vn-alert-info" style={{ marginBottom: '1rem' }}>{notice}</div>}

      {showModal && (
        <div className="vn-modal-backdrop" onClick={() => setShowModal(false)}>
          <div className="vn-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div className="vn-modal-header">
              <h3>{editingId ? 'Edit Carton' : 'Add Carton Size'}</h3>
              <button onClick={() => setShowModal(false)}><span className="material-icons">close</span></button>
            </div>
            <form onSubmit={handleSave}>
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
                <button type="button" className="vn-btn vn-btn-outline" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="vn-btn vn-btn-primary" disabled={busy}>{busy ? 'Saving...' : editingId ? 'Save changes' : 'Create carton'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="vn-filters" style={{ marginBottom: '1rem' }}>
        <select className="vn-filter-select" value={selectedLocation} onChange={e => setSelectedLocation(e.target.value)}>
          {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto', fontSize: 13 }}>
          <input type="checkbox" checked={showArchived} onChange={e => setShowArchived(e.target.checked)} />
          Show archived
        </label>
      </div>

      {loading ? (
        <div style={{ padding: '2rem', textAlign: 'center' }}><div className="vn-loading-spinner" /></div>
      ) : cartons.length === 0 ? (
        <div className="vn-card" style={{ textAlign: 'center', padding: '3rem' }}>
          <span className="material-icons" style={{ fontSize: '48px', color: 'var(--text-secondary)', marginBottom: '1rem', display: 'block' }}>inventory_2</span>
          <h3>No carton sizes defined</h3>
          <p style={{ color: 'var(--text-secondary)' }}>Add your available box sizes to enable automatic carton recommendations at packing.</p>
        </div>
      ) : (
        <div className="vn-table-wrap">
          <table className="vn-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>L x W x H (mm)</th>
                <th>Volume (L)</th>
                <th>Max Weight (g)</th>
                <th>Temp</th>
                <th>Value</th>
                <th>Hazmat</th>
                <th>Material</th>
                <th>Cost</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {cartons.map(c => (
                <tr key={c.id} style={{ opacity: c.active ? 1 : 0.55 }}>
                  <td>
                    <strong>{c.name}</strong>
                    {!c.active && <span className="vn-chip vn-chip-secondary" style={{ marginLeft: 6, fontSize: 10 }}>archived</span>}
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
                  <td>
                    <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                      {c.active ? (
                        <>
                          <button className="vn-btn-icon" onClick={() => openEdit(c)} title="Edit">
                            <span className="material-icons" style={{ fontSize: 18 }}>edit</span>
                          </button>
                          <button className="vn-btn-icon" onClick={() => handleArchive(c)} title="Archive">
                            <span className="material-icons" style={{ fontSize: 18 }}>archive</span>
                          </button>
                          <button className="vn-btn-icon" onClick={() => handleDelete(c)} title="Delete">
                            <span className="material-icons" style={{ fontSize: 18, color: 'var(--error)' }}>delete_outline</span>
                          </button>
                        </>
                      ) : (
                        <button className="vn-btn vn-btn-sm vn-btn-outline" onClick={() => handleRestore(c)} title="Restore">
                          <span className="material-icons" style={{ fontSize: 16 }}>unarchive</span>
                          Restore
                        </button>
                      )}
                    </div>
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
