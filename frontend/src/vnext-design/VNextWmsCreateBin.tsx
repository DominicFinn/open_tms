import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { API_URL } from '../api';

const BIN_TYPES = [
  { value: 'pallet', label: 'Pallet' }, { value: 'shelf', label: 'Shelf' },
  { value: 'floor', label: 'Floor' }, { value: 'dock_door', label: 'Dock Door' },
  { value: 'staging', label: 'Staging' }, { value: 'pack_station', label: 'Pack Station' },
];
const TEMP_ZONES = [
  { value: '', label: 'Inherit from zone' }, { value: 'ambient', label: 'Ambient' },
  { value: 'refrigerated', label: 'Refrigerated' }, { value: 'frozen', label: 'Frozen' },
];

export default function VNextWmsCreateBin() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const presetZone = searchParams.get('zoneId') || '';
  const presetLocation = searchParams.get('locationId') || '';

  const [zones, setZones] = useState<Array<{ id: string; name: string; locationId: string }>>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    zoneId: presetZone,
    locationId: presetLocation,
    label: '',
    binType: 'pallet',
    temperatureZone: '',
    hazmatCertified: false,
    level: '',
    walkSequence: '0',
    maxWeightKg: '',
    maxVolumeCbm: '',
    maxPalletPositions: '',
  });

  useEffect(() => {
    if (!presetLocation) return;
    fetch(`${API_URL}/api/v1/warehouse/zones?locationId=${presetLocation}`)
      .then(r => r.json())
      .then(res => setZones(res.data || []))
      .catch(() => {});
  }, [presetLocation]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/warehouse/bins`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          zoneId: form.zoneId,
          locationId: form.locationId,
          label: form.label.trim(),
          binType: form.binType,
          temperatureZone: form.temperatureZone || null,
          hazmatCertified: form.hazmatCertified,
          level: form.level ? parseInt(form.level) : null,
          walkSequence: parseInt(form.walkSequence) || 0,
          maxWeightKg: form.maxWeightKg ? parseFloat(form.maxWeightKg) : null,
          maxVolumeCbm: form.maxVolumeCbm ? parseFloat(form.maxVolumeCbm) : null,
          maxPalletPositions: form.maxPalletPositions ? parseInt(form.maxPalletPositions) : null,
        }),
      });
      const data = await res.json();
      if (data.error) setError(data.error);
      else navigate(`/wms/zones/${form.zoneId}`);
    } catch { setError('Failed to create bin'); }
    finally { setSaving(false); }
  };

  return (
    <div>
      <div className="vn-page-header">
        <div><h1>Create Bin</h1><p className="vn-page-subtitle">Add a single storage location</p></div>
      </div>
      {error && <div className="vn-alert vn-alert-error" style={{ marginBottom: '1rem' }}>{error}</div>}
      <form onSubmit={handleSubmit} className="vn-card" style={{ maxWidth: '700px' }}>
        <div className="vn-form-grid">
          <div className="vn-field">
            <label className="vn-field-label">Zone *</label>
            <select className="vn-input" value={form.zoneId} onChange={e => setForm({ ...form, zoneId: e.target.value })} required>
              <option value="">Select zone...</option>
              {zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
            </select>
          </div>
          <div className="vn-field">
            <label className="vn-field-label">Label *</label>
            <input className="vn-input" value={form.label} onChange={e => setForm({ ...form, label: e.target.value })} placeholder="e.g. BULK-A-01-01" required />
          </div>
          <div className="vn-field">
            <label className="vn-field-label">Bin Type *</label>
            <select className="vn-input" value={form.binType} onChange={e => setForm({ ...form, binType: e.target.value })}>
              {BIN_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div className="vn-field">
            <label className="vn-field-label">Temperature Zone</label>
            <select className="vn-input" value={form.temperatureZone} onChange={e => setForm({ ...form, temperatureZone: e.target.value })}>
              {TEMP_ZONES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div className="vn-field"><label className="vn-field-label">Level</label><input className="vn-input" type="number" value={form.level} onChange={e => setForm({ ...form, level: e.target.value })} placeholder="Vertical position" /></div>
          <div className="vn-field"><label className="vn-field-label">Walk Sequence</label><input className="vn-input" type="number" value={form.walkSequence} onChange={e => setForm({ ...form, walkSequence: e.target.value })} /></div>
          <div className="vn-field"><label className="vn-field-label">Max Weight (kg)</label><input className="vn-input" type="number" step="0.1" value={form.maxWeightKg} onChange={e => setForm({ ...form, maxWeightKg: e.target.value })} /></div>
          <div className="vn-field"><label className="vn-field-label">Max Pallet Positions</label><input className="vn-input" type="number" value={form.maxPalletPositions} onChange={e => setForm({ ...form, maxPalletPositions: e.target.value })} /></div>
          <div className="vn-field" style={{ gridColumn: '1 / -1' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
              <input type="checkbox" checked={form.hazmatCertified} onChange={e => setForm({ ...form, hazmatCertified: e.target.checked })} /> Hazmat Certified
            </label>
          </div>
        </div>
        <div className="vn-form-actions" style={{ marginTop: '1.5rem' }}>
          <button type="button" className="vn-btn vn-btn-outline" onClick={() => navigate(-1)}>Cancel</button>
          <button type="submit" className="vn-btn vn-btn-primary" disabled={saving}>{saving ? 'Creating...' : 'Create Bin'}</button>
        </div>
      </form>
    </div>
  );
}
