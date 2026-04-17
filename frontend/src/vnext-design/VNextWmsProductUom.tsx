import React, { useState, useEffect } from 'react';
import { API_URL } from '../api';

interface ProductUom {
  id: string;
  sku: string;
  uomCode: string;
  parentUomCode: string | null;
  conversionFactor: number;
  lengthMm: number | null;
  widthMm: number | null;
  heightMm: number | null;
  weightGrams: number | null;
  barcodeGtin: string | null;
  isDefault: boolean;
}

export default function VNextWmsProductUom() {
  const [records, setRecords] = useState<ProductUom[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ sku: '', uomCode: 'EA', lengthMm: '', widthMm: '', heightMm: '', weightGrams: '', barcodeGtin: '', isDefault: true });

  const loadData = () => {
    setLoading(true);
    const url = search ? `${API_URL}/api/v1/product-uom?search=${encodeURIComponent(search)}` : `${API_URL}/api/v1/product-uom`;
    fetch(url).then(r => r.json()).then(res => setRecords(res.data || [])).finally(() => setLoading(false));
  };

  useEffect(() => { loadData(); }, [search]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setCreating(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/product-uom`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sku: form.sku.trim(), uomCode: form.uomCode,
          lengthMm: form.lengthMm ? parseInt(form.lengthMm) : null,
          widthMm: form.widthMm ? parseInt(form.widthMm) : null,
          heightMm: form.heightMm ? parseInt(form.heightMm) : null,
          weightGrams: form.weightGrams ? parseInt(form.weightGrams) : null,
          barcodeGtin: form.barcodeGtin || null,
          isDefault: form.isDefault,
        }),
      });
      const data = await res.json();
      if (data.error) setError(data.error);
      else { setShowCreate(false); setForm({ sku: '', uomCode: 'EA', lengthMm: '', widthMm: '', heightMm: '', weightGrams: '', barcodeGtin: '', isDefault: true }); loadData(); }
    } catch { setError('Failed to save'); }
    finally { setCreating(false); }
  };

  const handleDelete = async (id: string) => {
    await fetch(`${API_URL}/api/v1/product-uom/${id}`, { method: 'DELETE' });
    loadData();
  };

  const hasDims = (r: ProductUom) => r.lengthMm && r.widthMm && r.heightMm && r.weightGrams;

  return (
    <div>
      <div className="vn-page-header">
        <div>
          <h1>Product Dimensions</h1>
          <p className="vn-page-subtitle">SKU dimensions and weights for cartonization</p>
        </div>
        <button className="vn-btn vn-btn-primary" onClick={() => setShowCreate(true)}>
          <span className="material-icons" style={{ fontSize: '18px', marginRight: '0.5rem' }}>add</span>Add Product
        </button>
      </div>

      {error && <div className="vn-alert vn-alert-error" style={{ marginBottom: '1rem' }}>{error}</div>}

      {showCreate && (
        <div className="vn-modal-backdrop" onClick={() => setShowCreate(false)}>
          <div className="vn-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div className="vn-modal-header"><h3>Add Product Dimensions</h3><button onClick={() => setShowCreate(false)}><span className="material-icons">close</span></button></div>
            <form onSubmit={handleCreate}>
              <div className="vn-modal-body">
                <div className="vn-form-grid">
                  <div className="vn-field"><label className="vn-field-label">SKU *</label><input className="vn-input" value={form.sku} onChange={e => setForm({ ...form, sku: e.target.value })} required /></div>
                  <div className="vn-field"><label className="vn-field-label">UOM Code</label><select className="vn-input" value={form.uomCode} onChange={e => setForm({ ...form, uomCode: e.target.value })}><option>EA</option><option>INNER</option><option>CASE</option><option>PALLET</option></select></div>
                  <div className="vn-field"><label className="vn-field-label">Length (mm)</label><input className="vn-input" type="number" min="1" value={form.lengthMm} onChange={e => setForm({ ...form, lengthMm: e.target.value })} /></div>
                  <div className="vn-field"><label className="vn-field-label">Width (mm)</label><input className="vn-input" type="number" min="1" value={form.widthMm} onChange={e => setForm({ ...form, widthMm: e.target.value })} /></div>
                  <div className="vn-field"><label className="vn-field-label">Height (mm)</label><input className="vn-input" type="number" min="1" value={form.heightMm} onChange={e => setForm({ ...form, heightMm: e.target.value })} /></div>
                  <div className="vn-field"><label className="vn-field-label">Weight (g)</label><input className="vn-input" type="number" min="1" value={form.weightGrams} onChange={e => setForm({ ...form, weightGrams: e.target.value })} /></div>
                  <div className="vn-field" style={{ gridColumn: '1 / -1' }}><label className="vn-field-label">Barcode / GTIN</label><input className="vn-input" value={form.barcodeGtin} onChange={e => setForm({ ...form, barcodeGtin: e.target.value })} placeholder="Optional" /></div>
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
        <input className="vn-filter-input" placeholder="Search by SKU..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {loading ? <div style={{ padding: '2rem', textAlign: 'center' }}><div className="vn-loading-spinner" /></div> : records.length === 0 ? (
        <div className="vn-card" style={{ textAlign: 'center', padding: '3rem' }}>
          <span className="material-icons" style={{ fontSize: '48px', color: 'var(--text-secondary)', marginBottom: '1rem', display: 'block' }}>straighten</span>
          <h3>No product dimensions</h3>
          <p style={{ color: 'var(--text-secondary)' }}>Add SKU dimensions and weights to enable carton recommendations at packing.</p>
        </div>
      ) : (
        <div className="vn-table-wrap">
          <table className="vn-table">
            <thead><tr><th>SKU</th><th>UOM</th><th>L (mm)</th><th>W (mm)</th><th>H (mm)</th><th>Weight (g)</th><th>GTIN</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {records.map(r => (
                <tr key={r.id}>
                  <td><strong>{r.sku}</strong></td>
                  <td>{r.uomCode}</td>
                  <td>{r.lengthMm ?? '--'}</td>
                  <td>{r.widthMm ?? '--'}</td>
                  <td>{r.heightMm ?? '--'}</td>
                  <td>{r.weightGrams ?? '--'}</td>
                  <td style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{r.barcodeGtin || '--'}</td>
                  <td>{hasDims(r) ? <span className="vn-chip vn-chip-success">Complete</span> : <span className="vn-chip vn-chip-warning">Partial</span>}</td>
                  <td><button className="vn-btn vn-btn-outline" style={{ fontSize: '0.75rem', padding: '0.15rem 0.4rem', color: 'var(--color-error)' }} onClick={() => handleDelete(r.id)}>Delete</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
