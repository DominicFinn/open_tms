import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { API_URL } from '../api';

const ZONE_TYPES = [
  { value: 'receiving', label: 'Receiving' },
  { value: 'bulk_storage', label: 'Bulk Storage' },
  { value: 'pick_face', label: 'Pick Face' },
  { value: 'staging', label: 'Staging' },
  { value: 'packing', label: 'Packing' },
  { value: 'shipping_dock', label: 'Shipping Dock' },
  { value: 'quarantine', label: 'Quarantine' },
  { value: 'returns', label: 'Returns' },
  { value: 'cross_dock', label: 'Cross Dock' },
];

const TEMP_ZONES = [
  { value: '', label: 'None' },
  { value: 'ambient', label: 'Ambient' },
  { value: 'refrigerated', label: 'Refrigerated' },
  { value: 'frozen', label: 'Frozen' },
];

interface LocationOption {
  id: string;
  name: string;
  locationType: string | null;
}

export default function VNextWmsCreateZone() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;

  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    locationId: '',
    name: '',
    zoneType: 'bulk_storage',
    temperatureZone: '',
    hazmatCertified: false,
    maxWeightKg: '',
    maxVolumeCbm: '',
    sortOrder: '0',
  });

  useEffect(() => {
    fetch(`${API_URL}/api/v1/locations`)
      .then(r => r.json())
      .then(res => {
        const warehouseLocations = (res.data || []).filter(
          (l: LocationOption) => !l.locationType || ['warehouse', 'distribution_centre', 'cross_dock'].includes(l.locationType)
        );
        setLocations(warehouseLocations);
        if (warehouseLocations.length === 1 && !isEdit) {
          setForm(f => ({ ...f, locationId: warehouseLocations[0].id }));
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!isEdit) return;
    setLoading(true);
    fetch(`${API_URL}/api/v1/warehouse/zones/${id}`)
      .then(r => r.json())
      .then(res => {
        if (res.data) {
          const z = res.data;
          setForm({
            locationId: z.locationId,
            name: z.name,
            zoneType: z.zoneType,
            temperatureZone: z.temperatureZone || '',
            hazmatCertified: z.hazmatCertified,
            maxWeightKg: z.maxWeightKg != null ? String(z.maxWeightKg) : '',
            maxVolumeCbm: z.maxVolumeCbm != null ? String(z.maxVolumeCbm) : '',
            sortOrder: String(z.sortOrder ?? 0),
          });
        }
      })
      .finally(() => setLoading(false));
  }, [id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);

    const payload: Record<string, unknown> = {
      locationId: form.locationId,
      name: form.name.trim(),
      zoneType: form.zoneType,
      temperatureZone: form.temperatureZone || null,
      hazmatCertified: form.hazmatCertified,
      maxWeightKg: form.maxWeightKg ? parseFloat(form.maxWeightKg) : null,
      maxVolumeCbm: form.maxVolumeCbm ? parseFloat(form.maxVolumeCbm) : null,
      sortOrder: parseInt(form.sortOrder) || 0,
    };

    try {
      const url = isEdit
        ? `${API_URL}/api/v1/warehouse/zones/${id}`
        : `${API_URL}/api/v1/warehouse/zones`;
      const res = await fetch(url, {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        navigate('/wms/zones');
      }
    } catch (err) {
      setError('Failed to save zone');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <div className="vn-loading-spinner" />
      </div>
    );
  }

  return (
    <div>
      <div className="vn-page-header">
        <div>
          <h1>{isEdit ? 'Edit Zone' : 'Create Zone'}</h1>
          <p className="vn-page-subtitle">
            {isEdit ? 'Update zone configuration' : 'Define a new warehouse zone'}
          </p>
        </div>
      </div>

      {error && <div className="vn-alert vn-alert-error" style={{ marginBottom: '1rem' }}>{error}</div>}

      <form onSubmit={handleSubmit} className="vn-card" style={{ maxWidth: '700px' }}>
        <div className="vn-form-grid">
          {/* Location */}
          <div className="vn-field" style={{ gridColumn: '1 / -1' }}>
            <label className="vn-field-label">Location *</label>
            <select
              className="vn-input"
              value={form.locationId}
              onChange={e => setForm({ ...form, locationId: e.target.value })}
              required
              disabled={isEdit}
            >
              <option value="">Select a warehouse location...</option>
              {locations.map(l => (
                <option key={l.id} value={l.id}>{l.name}{l.locationType ? ` (${l.locationType})` : ''}</option>
              ))}
            </select>
          </div>

          {/* Name */}
          <div className="vn-field">
            <label className="vn-field-label">Zone Name *</label>
            <input
              className="vn-input"
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Bulk A, Dock 3, Cold Store"
              required
            />
          </div>

          {/* Zone Type */}
          <div className="vn-field">
            <label className="vn-field-label">Zone Type *</label>
            <select
              className="vn-input"
              value={form.zoneType}
              onChange={e => setForm({ ...form, zoneType: e.target.value })}
              required
            >
              {ZONE_TYPES.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          {/* Temperature Zone */}
          <div className="vn-field">
            <label className="vn-field-label">Temperature Zone</label>
            <select
              className="vn-input"
              value={form.temperatureZone}
              onChange={e => setForm({ ...form, temperatureZone: e.target.value })}
            >
              {TEMP_ZONES.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          {/* Sort Order */}
          <div className="vn-field">
            <label className="vn-field-label">Sort Order</label>
            <input
              className="vn-input"
              type="number"
              value={form.sortOrder}
              onChange={e => setForm({ ...form, sortOrder: e.target.value })}
            />
          </div>

          {/* Max Weight */}
          <div className="vn-field">
            <label className="vn-field-label">Max Weight (kg)</label>
            <input
              className="vn-input"
              type="number"
              step="0.1"
              value={form.maxWeightKg}
              onChange={e => setForm({ ...form, maxWeightKg: e.target.value })}
              placeholder="Optional"
            />
          </div>

          {/* Max Volume */}
          <div className="vn-field">
            <label className="vn-field-label">Max Volume (cbm)</label>
            <input
              className="vn-input"
              type="number"
              step="0.01"
              value={form.maxVolumeCbm}
              onChange={e => setForm({ ...form, maxVolumeCbm: e.target.value })}
              placeholder="Optional"
            />
          </div>

          {/* Hazmat */}
          <div className="vn-field" style={{ gridColumn: '1 / -1' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={form.hazmatCertified}
                onChange={e => setForm({ ...form, hazmatCertified: e.target.checked })}
              />
              Hazmat Certified
            </label>
          </div>
        </div>

        {/* Actions */}
        <div className="vn-form-actions" style={{ marginTop: '1.5rem' }}>
          <button type="button" className="vn-btn vn-btn-outline" onClick={() => navigate('/wms/zones')}>
            Cancel
          </button>
          <button type="submit" className="vn-btn vn-btn-primary" disabled={saving}>
            {saving ? 'Saving...' : isEdit ? 'Update Zone' : 'Create Zone'}
          </button>
        </div>
      </form>
    </div>
  );
}
