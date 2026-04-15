import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { API_URL } from '../api';

const BIN_TYPES = [
  { value: 'pallet', label: 'Pallet' },
  { value: 'shelf', label: 'Shelf' },
  { value: 'floor', label: 'Floor' },
  { value: 'dock_door', label: 'Dock Door' },
  { value: 'staging', label: 'Staging' },
  { value: 'pack_station', label: 'Pack Station' },
];

const TEMP_ZONES = [
  { value: '', label: 'Inherit from zone' },
  { value: 'ambient', label: 'Ambient' },
  { value: 'refrigerated', label: 'Refrigerated' },
  { value: 'frozen', label: 'Frozen' },
];

interface PreviewResult {
  count: number;
  labels: string[];
  truncated: boolean;
}

export default function VNextWmsBulkBins() {
  const { zoneId } = useParams<{ zoneId: string }>();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    labelPattern: '{aisle}-{row}-{level}',
    binType: 'pallet',
    aisles: 'A,B,C',
    rowStart: '1',
    rowEnd: '10',
    levelStart: '1',
    levelEnd: '4',
    maxWeightKg: '',
    maxVolumeCbm: '',
    maxPalletPositions: '',
    temperatureZone: '',
    hazmatCertified: false,
  });

  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const getPayload = () => ({
    labelPattern: form.labelPattern,
    aisles: form.aisles.split(',').map(a => a.trim()).filter(Boolean),
    rowStart: parseInt(form.rowStart) || 1,
    rowEnd: parseInt(form.rowEnd) || 1,
    levelStart: parseInt(form.levelStart) || 1,
    levelEnd: parseInt(form.levelEnd) || 1,
  });

  const handlePreview = async () => {
    setError('');
    setPreview(null);

    try {
      const res = await fetch(`${API_URL}/api/v1/warehouse/bins/bulk/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(getPayload()),
      });
      const data = await res.json();
      if (data.error) setError(data.error);
      else setPreview(data.data);
    } catch {
      setError('Failed to generate preview');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSaving(true);

    // We need the locationId from the zone - fetch it
    try {
      const zoneRes = await fetch(`${API_URL}/api/v1/warehouse/zones/${zoneId}`);
      const zoneData = await zoneRes.json();
      if (zoneData.error || !zoneData.data) {
        setError('Could not find zone');
        setSaving(false);
        return;
      }

      const payload = {
        zoneId,
        locationId: zoneData.data.locationId,
        ...getPayload(),
        binType: form.binType,
        maxWeightKg: form.maxWeightKg ? parseFloat(form.maxWeightKg) : null,
        maxVolumeCbm: form.maxVolumeCbm ? parseFloat(form.maxVolumeCbm) : null,
        maxPalletPositions: form.maxPalletPositions ? parseInt(form.maxPalletPositions) : null,
        temperatureZone: form.temperatureZone || null,
        hazmatCertified: form.hazmatCertified,
      };

      const res = await fetch(`${API_URL}/api/v1/warehouse/bins/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (data.error) {
        setError(data.error);
      } else {
        setSuccess(`Created ${data.data.count} bins successfully`);
        setTimeout(() => navigate(`/wms/zones/${zoneId}`), 1500);
      }
    } catch {
      setError('Failed to create bins');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="vn-page-header">
        <div>
          <h1>Bulk Create Bins</h1>
          <p className="vn-page-subtitle">Generate bins from a label pattern with aisle/row/level ranges</p>
        </div>
      </div>

      {error && <div className="vn-alert vn-alert-error" style={{ marginBottom: '1rem' }}>{error}</div>}
      {success && <div className="vn-alert vn-alert-success" style={{ marginBottom: '1rem' }}>{success}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
        {/* Form */}
        <form onSubmit={handleSubmit} className="vn-card">
          <h3 style={{ margin: '0 0 1rem' }}>Configuration</h3>
          <div className="vn-form-grid">
            {/* Label Pattern */}
            <div className="vn-field" style={{ gridColumn: '1 / -1' }}>
              <label className="vn-field-label">Label Pattern *</label>
              <input
                className="vn-input"
                value={form.labelPattern}
                onChange={e => setForm({ ...form, labelPattern: e.target.value })}
                placeholder="e.g. BULK-{aisle}-{row}-{level}"
                required
              />
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Use {'{aisle}'}, {'{row}'}, {'{level}'} as placeholders. Rows and levels are zero-padded.
              </span>
            </div>

            {/* Bin Type */}
            <div className="vn-field">
              <label className="vn-field-label">Bin Type *</label>
              <select className="vn-input" value={form.binType} onChange={e => setForm({ ...form, binType: e.target.value })}>
                {BIN_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>

            {/* Temperature */}
            <div className="vn-field">
              <label className="vn-field-label">Temperature Zone</label>
              <select className="vn-input" value={form.temperatureZone} onChange={e => setForm({ ...form, temperatureZone: e.target.value })}>
                {TEMP_ZONES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>

            {/* Aisles */}
            <div className="vn-field" style={{ gridColumn: '1 / -1' }}>
              <label className="vn-field-label">Aisles (comma-separated) *</label>
              <input
                className="vn-input"
                value={form.aisles}
                onChange={e => setForm({ ...form, aisles: e.target.value })}
                placeholder="A,B,C"
                required
              />
            </div>

            {/* Row range */}
            <div className="vn-field">
              <label className="vn-field-label">Row Start</label>
              <input className="vn-input" type="number" min="1" value={form.rowStart} onChange={e => setForm({ ...form, rowStart: e.target.value })} />
            </div>
            <div className="vn-field">
              <label className="vn-field-label">Row End</label>
              <input className="vn-input" type="number" min="1" value={form.rowEnd} onChange={e => setForm({ ...form, rowEnd: e.target.value })} />
            </div>

            {/* Level range */}
            <div className="vn-field">
              <label className="vn-field-label">Level Start</label>
              <input className="vn-input" type="number" min="1" value={form.levelStart} onChange={e => setForm({ ...form, levelStart: e.target.value })} />
            </div>
            <div className="vn-field">
              <label className="vn-field-label">Level End</label>
              <input className="vn-input" type="number" min="1" value={form.levelEnd} onChange={e => setForm({ ...form, levelEnd: e.target.value })} />
            </div>

            {/* Capacity */}
            <div className="vn-field">
              <label className="vn-field-label">Max Weight (kg)</label>
              <input className="vn-input" type="number" step="0.1" value={form.maxWeightKg} onChange={e => setForm({ ...form, maxWeightKg: e.target.value })} placeholder="Optional" />
            </div>
            <div className="vn-field">
              <label className="vn-field-label">Max Pallet Positions</label>
              <input className="vn-input" type="number" min="1" value={form.maxPalletPositions} onChange={e => setForm({ ...form, maxPalletPositions: e.target.value })} placeholder="Optional" />
            </div>

            {/* Hazmat */}
            <div className="vn-field" style={{ gridColumn: '1 / -1' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={form.hazmatCertified} onChange={e => setForm({ ...form, hazmatCertified: e.target.checked })} />
                Hazmat Certified
              </label>
            </div>
          </div>

          <div className="vn-form-actions" style={{ marginTop: '1.5rem' }}>
            <button type="button" className="vn-btn vn-btn-outline" onClick={() => navigate(-1)}>
              Cancel
            </button>
            <button type="button" className="vn-btn vn-btn-outline" onClick={handlePreview}>
              Preview Labels
            </button>
            <button type="submit" className="vn-btn vn-btn-primary" disabled={saving}>
              {saving ? 'Creating...' : 'Create Bins'}
            </button>
          </div>
        </form>

        {/* Preview */}
        <div className="vn-card">
          <h3 style={{ margin: '0 0 1rem' }}>Preview</h3>
          {preview ? (
            <div>
              <div className="vn-alert vn-alert-info" style={{ marginBottom: '1rem' }}>
                Will create <strong>{preview.count}</strong> bins
              </div>
              <div style={{ maxHeight: '400px', overflow: 'auto', fontFamily: 'monospace', fontSize: '0.85rem', lineHeight: 1.6 }}>
                {preview.labels.map((label, i) => (
                  <div key={i} style={{ padding: '0.2rem 0', borderBottom: '1px solid var(--border)' }}>
                    {label}
                  </div>
                ))}
                {preview.truncated && (
                  <div style={{ padding: '0.5rem 0', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                    ...and {preview.count - preview.labels.length} more
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
              <span className="material-icons" style={{ fontSize: '36px', display: 'block', marginBottom: '0.5rem' }}>preview</span>
              Click "Preview Labels" to see what will be generated
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
