import { useEffect, useState } from 'react';
import { API_URL } from '../api';

interface PalletType {
  id: string;
  code: string;
  name: string;
  description: string | null;
  lengthMm: number;
  widthMm: number;
  heightMm: number;
  tareWeightGrams: number;
  maxLoadGrams: number;
  maxStackHeightMm: number | null;
  material: string;
  reusable: boolean;
  isoCertified: boolean;
  stackable: boolean;
  active: boolean;
}

const MATERIALS = ['wood', 'plastic', 'metal', 'cardboard', 'composite'];

function kg(g: number) { return (g / 1000).toFixed(1); }
function cm(mm: number) { return (mm / 10).toFixed(0); }

export default function VNextPalletTypes() {
  const [rows, setRows] = useState<PalletType[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<PalletType | null>(null);
  const [error, setError] = useState('');
  const [seeding, setSeeding] = useState(false);
  const emptyForm = {
    code: '', name: '', description: '',
    lengthMm: '1200', widthMm: '800', heightMm: '144',
    tareWeightGrams: '25000', maxLoadGrams: '1500000', maxStackHeightMm: '2400',
    material: 'wood', reusable: true, isoCertified: false, stackable: true, active: true,
  };
  const [form, setForm] = useState(emptyForm);

  const load = () => {
    setLoading(true);
    fetch(`${API_URL}/api/v1/pallet-types`)
      .then(r => r.json())
      .then(json => setRows(json.data || []))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setShowForm(true);
  };
  const openEdit = (p: PalletType) => {
    setEditing(p);
    setForm({
      code: p.code, name: p.name, description: p.description ?? '',
      lengthMm: String(p.lengthMm), widthMm: String(p.widthMm), heightMm: String(p.heightMm),
      tareWeightGrams: String(p.tareWeightGrams), maxLoadGrams: String(p.maxLoadGrams),
      maxStackHeightMm: p.maxStackHeightMm ? String(p.maxStackHeightMm) : '',
      material: p.material, reusable: p.reusable, isoCertified: p.isoCertified, stackable: p.stackable, active: p.active,
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    setError('');
    const payload: any = {
      code: form.code.trim(),
      name: form.name.trim(),
      description: form.description || undefined,
      lengthMm: parseInt(form.lengthMm),
      widthMm: parseInt(form.widthMm),
      heightMm: parseInt(form.heightMm),
      tareWeightGrams: parseInt(form.tareWeightGrams),
      maxLoadGrams: parseInt(form.maxLoadGrams),
      maxStackHeightMm: form.maxStackHeightMm ? parseInt(form.maxStackHeightMm) : null,
      material: form.material,
      reusable: form.reusable,
      isoCertified: form.isoCertified,
      stackable: form.stackable,
      active: form.active,
    };
    const url = editing ? `${API_URL}/api/v1/pallet-types/${editing.id}` : `${API_URL}/api/v1/pallet-types`;
    const method = editing ? 'PUT' : 'POST';
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const data = await res.json();
    if (data.error) setError(data.error);
    else { setShowForm(false); load(); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this pallet type? If it is referenced by any trackable units it will be deactivated instead.')) return;
    await fetch(`${API_URL}/api/v1/pallet-types/${id}`, { method: 'DELETE' });
    load();
  };

  const handleSeed = async () => {
    if (!confirm('Add any missing standard pallet types (EUR, US GMA, CHEP, etc.) to your catalogue?')) return;
    setSeeding(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/pallet-types/seed-standards`, { method: 'POST' });
      const data = await res.json();
      alert(`Seed complete. Created: ${data.data.created}, skipped (already exist): ${data.data.skipped}.`);
      load();
    } finally { setSeeding(false); }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Pallet Types</h1>
          <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
            Standard pallet specs used for palletization planning, load plans, and BOL weight totals.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="vn-btn vn-btn-outline" onClick={handleSeed} disabled={seeding}>
            {seeding ? 'Seeding...' : 'Load standard types'}
          </button>
          <button className="vn-btn vn-btn-primary" onClick={openCreate}>
            <span className="material-icons">add</span> New type
          </button>
        </div>
      </div>

      {error && <div className="vn-alert vn-alert-error" style={{ marginBottom: 16 }}>{error}</div>}

      {showForm && (
        <div className="vn-card" style={{ padding: 16, marginBottom: 16 }}>
          <h3 style={{ margin: '0 0 12px' }}>{editing ? 'Edit pallet type' : 'New pallet type'}</h3>
          <div className="vn-form-grid" style={{ gap: 8 }}>
            <div className="vn-field">
              <label className="vn-field-label">Code</label>
              <input className="vn-input" value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} placeholder="EUR1" disabled={!!editing} />
            </div>
            <div className="vn-field">
              <label className="vn-field-label">Name</label>
              <input className="vn-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="vn-field" style={{ gridColumn: '1 / -1' }}>
              <label className="vn-field-label">Description</label>
              <input className="vn-input" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="vn-field">
              <label className="vn-field-label">Length (mm)</label>
              <input className="vn-input" type="number" value={form.lengthMm} onChange={e => setForm(f => ({ ...f, lengthMm: e.target.value }))} />
            </div>
            <div className="vn-field">
              <label className="vn-field-label">Width (mm)</label>
              <input className="vn-input" type="number" value={form.widthMm} onChange={e => setForm(f => ({ ...f, widthMm: e.target.value }))} />
            </div>
            <div className="vn-field">
              <label className="vn-field-label">Deck height (mm)</label>
              <input className="vn-input" type="number" value={form.heightMm} onChange={e => setForm(f => ({ ...f, heightMm: e.target.value }))} />
            </div>
            <div className="vn-field">
              <label className="vn-field-label">Max stack height (mm, optional)</label>
              <input className="vn-input" type="number" value={form.maxStackHeightMm} onChange={e => setForm(f => ({ ...f, maxStackHeightMm: e.target.value }))} placeholder="unlimited" />
            </div>
            <div className="vn-field">
              <label className="vn-field-label">Tare weight (g)</label>
              <input className="vn-input" type="number" value={form.tareWeightGrams} onChange={e => setForm(f => ({ ...f, tareWeightGrams: e.target.value }))} />
            </div>
            <div className="vn-field">
              <label className="vn-field-label">Max load (g, SWL)</label>
              <input className="vn-input" type="number" value={form.maxLoadGrams} onChange={e => setForm(f => ({ ...f, maxLoadGrams: e.target.value }))} />
            </div>
            <div className="vn-field">
              <label className="vn-field-label">Material</label>
              <select className="vn-input" value={form.material} onChange={e => setForm(f => ({ ...f, material: e.target.value }))}>
                {MATERIALS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          </div>
          <div style={{ marginTop: 12, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input type="checkbox" checked={form.reusable} onChange={e => setForm(f => ({ ...f, reusable: e.target.checked }))} /> Reusable
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input type="checkbox" checked={form.isoCertified} onChange={e => setForm(f => ({ ...f, isoCertified: e.target.checked }))} /> ISPM-15 certified
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input type="checkbox" checked={form.stackable} onChange={e => setForm(f => ({ ...f, stackable: e.target.checked }))} /> Stackable
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input type="checkbox" checked={form.active} onChange={e => setForm(f => ({ ...f, active: e.target.checked }))} /> Active
            </label>
          </div>
          <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
            <button className="vn-btn vn-btn-primary" onClick={handleSave}>{editing ? 'Save' : 'Create'}</button>
            <button className="vn-btn vn-btn-outline" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </div>
      )}

      <div className="vn-card">
        <div className="vn-table-wrap">
          <table className="vn-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>Size (L×W×H cm)</th>
                <th>Tare</th>
                <th>Max load</th>
                <th>Max stack</th>
                <th>Material</th>
                <th>Flags</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={10} style={{ textAlign: 'center', padding: 24 }}><div className="vn-loading-spinner" /></td></tr>}
              {!loading && rows.length === 0 && (
                <tr><td colSpan={10} style={{ textAlign: 'center', padding: 24, color: 'var(--text-secondary)' }}>
                  No pallet types yet. Click <strong>Load standard types</strong> to seed EUR, US GMA, CHEP, and more.
                </td></tr>
              )}
              {rows.map(p => (
                <tr key={p.id}>
                  <td><code>{p.code}</code></td>
                  <td>
                    <strong>{p.name}</strong>
                    {p.description && <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{p.description}</div>}
                  </td>
                  <td>{cm(p.lengthMm)}×{cm(p.widthMm)}×{cm(p.heightMm)}</td>
                  <td>{kg(p.tareWeightGrams)} kg</td>
                  <td>{kg(p.maxLoadGrams)} kg</td>
                  <td>{p.maxStackHeightMm ? `${cm(p.maxStackHeightMm)} cm` : '-'}</td>
                  <td>{p.material}</td>
                  <td style={{ fontSize: 11 }}>
                    {p.reusable && <span className="vn-chip vn-chip-secondary" style={{ marginRight: 4 }}>reusable</span>}
                    {p.isoCertified && <span className="vn-chip vn-chip-info" style={{ marginRight: 4 }}>ISPM-15</span>}
                    {p.stackable && <span className="vn-chip vn-chip-secondary">stackable</span>}
                  </td>
                  <td>
                    <span className={`vn-chip ${p.active ? 'vn-chip-success' : 'vn-chip-secondary'}`}>{p.active ? 'Active' : 'Inactive'}</span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button className="vn-btn vn-btn-outline vn-btn-sm" onClick={() => openEdit(p)}>Edit</button>
                    {' '}
                    <button className="vn-btn vn-btn-outline vn-btn-sm" style={{ color: 'var(--color-error)' }} onClick={() => handleDelete(p.id)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
