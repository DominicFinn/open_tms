import { useState, useEffect } from 'react';
import { API_URL } from '../api';

interface ColdChainProfile {
  id: string;
  orgId: string;
  name: string;
  description: string | null;
  minTemperature: number;
  maxTemperature: number;
  alertMinTemperature: number;
  alertMaxTemperature: number;
  minHumidity: number | null;
  maxHumidity: number | null;
  alertMinHumidity: number | null;
  alertMaxHumidity: number | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

interface FormData {
  name: string;
  description: string;
  minTemperature: string;
  maxTemperature: string;
  alertMinTemperature: string;
  alertMaxTemperature: string;
  minHumidity: string;
  maxHumidity: string;
  alertMinHumidity: string;
  alertMaxHumidity: string;
  active: boolean;
}

const emptyForm: FormData = {
  name: '',
  description: '',
  minTemperature: '',
  maxTemperature: '',
  alertMinTemperature: '',
  alertMaxTemperature: '',
  minHumidity: '',
  maxHumidity: '',
  alertMinHumidity: '',
  alertMaxHumidity: '',
  active: true,
};

function profileToForm(p: ColdChainProfile): FormData {
  return {
    name: p.name,
    description: p.description || '',
    minTemperature: String(p.minTemperature),
    maxTemperature: String(p.maxTemperature),
    alertMinTemperature: String(p.alertMinTemperature),
    alertMaxTemperature: String(p.alertMaxTemperature),
    minHumidity: p.minHumidity != null ? String(p.minHumidity) : '',
    maxHumidity: p.maxHumidity != null ? String(p.maxHumidity) : '',
    alertMinHumidity: p.alertMinHumidity != null ? String(p.alertMinHumidity) : '',
    alertMaxHumidity: p.alertMaxHumidity != null ? String(p.alertMaxHumidity) : '',
    active: p.active,
  };
}

export default function VNextColdChainProfiles() {
  const [profiles, setProfiles] = useState<ColdChainProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const [showModal, setShowModal] = useState(false);
  const [editingProfile, setEditingProfile] = useState<ColdChainProfile | null>(null);
  const [form, setForm] = useState<FormData>({ ...emptyForm });
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadProfiles();
  }, []);

  async function loadProfiles() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/api/v1/cold-chain/profiles`);
      if (!res.ok) throw new Error('Failed to load cold chain profiles');
      const json = await res.json();
      setProfiles(json.data || []);
    } catch (e: any) {
      setError(e.message || 'Failed to load cold chain profiles');
    } finally {
      setLoading(false);
    }
  }

  function openCreate() {
    setEditingProfile(null);
    setForm({ ...emptyForm });
    setFormError('');
    setShowModal(true);
  }

  function openEdit(profile: ColdChainProfile) {
    setEditingProfile(profile);
    setForm(profileToForm(profile));
    setFormError('');
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditingProfile(null);
    setFormError('');
  }

  function validateForm(): string | null {
    if (!form.name.trim()) return 'Name is required.';
    if (form.minTemperature === '' || form.maxTemperature === '') return 'Min and Max Temperature are required.';
    if (form.alertMinTemperature === '' || form.alertMaxTemperature === '') return 'Alert Min and Alert Max Temperature are required.';

    const minTemp = Number(form.minTemperature);
    const maxTemp = Number(form.maxTemperature);
    const alertMin = Number(form.alertMinTemperature);
    const alertMax = Number(form.alertMaxTemperature);

    if (isNaN(minTemp) || isNaN(maxTemp)) return 'Temperature values must be valid numbers.';
    if (isNaN(alertMin) || isNaN(alertMax)) return 'Alert temperature values must be valid numbers.';
    if (minTemp > maxTemp) return 'Min Temperature must be less than or equal to Max Temperature.';
    if (alertMin > alertMax) return 'Alert Min Temperature must be less than or equal to Alert Max Temperature.';
    if (alertMin < minTemp) return 'Alert Min Temperature must be greater than or equal to Min Temperature.';
    if (alertMax > maxTemp) return 'Alert Max Temperature must be less than or equal to Max Temperature.';

    // Validate humidity if any humidity field is provided
    const hasHumidity = form.minHumidity !== '' || form.maxHumidity !== '' || form.alertMinHumidity !== '' || form.alertMaxHumidity !== '';
    if (hasHumidity) {
      const minH = form.minHumidity !== '' ? Number(form.minHumidity) : null;
      const maxH = form.maxHumidity !== '' ? Number(form.maxHumidity) : null;
      const alertMinH = form.alertMinHumidity !== '' ? Number(form.alertMinHumidity) : null;
      const alertMaxH = form.alertMaxHumidity !== '' ? Number(form.alertMaxHumidity) : null;

      if (minH != null && isNaN(minH)) return 'Min Humidity must be a valid number.';
      if (maxH != null && isNaN(maxH)) return 'Max Humidity must be a valid number.';
      if (alertMinH != null && isNaN(alertMinH)) return 'Alert Min Humidity must be a valid number.';
      if (alertMaxH != null && isNaN(alertMaxH)) return 'Alert Max Humidity must be a valid number.';
      if (minH != null && maxH != null && minH > maxH) return 'Min Humidity must be less than or equal to Max Humidity.';
      if (alertMinH != null && alertMaxH != null && alertMinH > alertMaxH) return 'Alert Min Humidity must be less than or equal to Alert Max Humidity.';
      if (alertMinH != null && minH != null && alertMinH < minH) return 'Alert Min Humidity must be greater than or equal to Min Humidity.';
      if (alertMaxH != null && maxH != null && alertMaxH > maxH) return 'Alert Max Humidity must be less than or equal to Max Humidity.';
    }

    return null;
  }

  async function handleSave() {
    const validationError = validateForm();
    if (validationError) {
      setFormError(validationError);
      return;
    }

    setSaving(true);
    setFormError('');

    const body = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      minTemperature: Number(form.minTemperature),
      maxTemperature: Number(form.maxTemperature),
      alertMinTemperature: Number(form.alertMinTemperature),
      alertMaxTemperature: Number(form.alertMaxTemperature),
      minHumidity: form.minHumidity !== '' ? Number(form.minHumidity) : null,
      maxHumidity: form.maxHumidity !== '' ? Number(form.maxHumidity) : null,
      alertMinHumidity: form.alertMinHumidity !== '' ? Number(form.alertMinHumidity) : null,
      alertMaxHumidity: form.alertMaxHumidity !== '' ? Number(form.alertMaxHumidity) : null,
      active: form.active,
    };

    try {
      const url = editingProfile
        ? `${API_URL}/api/v1/cold-chain/profiles/${editingProfile.id}`
        : `${API_URL}/api/v1/cold-chain/profiles`;
      const method = editingProfile ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || `Failed to ${editingProfile ? 'update' : 'create'} profile`);
      }

      closeModal();
      await loadProfiles();
    } catch (e: any) {
      setFormError(e.message || 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  }

  // Filtered profiles
  const filtered = profiles.filter(p => {
    if (statusFilter === 'active' && !p.active) return false;
    if (statusFilter === 'inactive' && p.active) return false;
    if (search) {
      return p.name.toLowerCase().includes(search.toLowerCase());
    }
    return true;
  });

  // Stats
  const totalCount = profiles.length;
  const activeCount = profiles.filter(p => p.active).length;
  const frozenCount = profiles.filter(p => p.minTemperature < -10).length;
  const refrigeratedCount = profiles.filter(p => p.minTemperature >= -10 && p.maxTemperature <= 15).length;

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '48px' }}>
        <div className="loading-spinner" />
      </div>
    );
  }

  return (
    <>
      {/* Page Header */}
      <div className="vn-page-header">
        <div>
          <h1>Cold Chain Profiles</h1>
        </div>
        <div className="vn-page-actions">
          <button className="vn-btn vn-btn-primary" onClick={openCreate}>
            <span className="material-icons">add</span>
            New Profile
          </button>
        </div>
      </div>

      {error && (
        <div className="vn-alert vn-alert-error" style={{ marginBottom: 16 }}>
          <span className="material-icons">error</span>
          <div>{error}</div>
        </div>
      )}

      {/* Stats */}
      <div className="vn-stats">
        <div className="vn-stat">
          <div className="vn-stat-icon primary">
            <span className="material-icons">thermostat</span>
          </div>
          <div>
            <div className="vn-stat-value">{totalCount}</div>
            <div className="vn-stat-label">Total Profiles</div>
          </div>
        </div>
        <div className="vn-stat">
          <div className="vn-stat-icon success">
            <span className="material-icons">check_circle</span>
          </div>
          <div>
            <div className="vn-stat-value">{activeCount}</div>
            <div className="vn-stat-label">Active Profiles</div>
          </div>
        </div>
        <div className="vn-stat">
          <div className="vn-stat-icon info">
            <span className="material-icons">ac_unit</span>
          </div>
          <div>
            <div className="vn-stat-value">{frozenCount}</div>
            <div className="vn-stat-label">Frozen Profiles</div>
          </div>
        </div>
        <div className="vn-stat">
          <div className="vn-stat-icon warning">
            <span className="material-icons">kitchen</span>
          </div>
          <div>
            <div className="vn-stat-value">{refrigeratedCount}</div>
            <div className="vn-stat-label">Refrigerated Profiles</div>
          </div>
        </div>
      </div>

      {/* Filters + Table Card */}
      <div className="vn-card">
        <div className="vn-filters">
          <div className="vn-filter-group" style={{ flex: 1 }}>
            <span className="material-icons">search</span>
            <input
              className="vn-filter-input"
              placeholder="Search by name..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ width: '100%' }}
            />
          </div>
          <select
            className="vn-filter-select"
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>

        {filtered.length === 0 ? (
          <div className="vn-empty">
            <span className="material-icons">thermostat</span>
            <h3>No cold chain profiles found</h3>
            <p>Create a profile to define temperature and humidity requirements.</p>
          </div>
        ) : (
          <div className="vn-table-wrap">
            <table className="vn-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Temperature Range</th>
                  <th>Alert Range</th>
                  <th>Humidity Range</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(profile => (
                  <tr key={profile.id}>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--on-surface)' }}>{profile.name}</div>
                      {profile.description && (
                        <div style={{ fontSize: 12, color: 'var(--on-surface-variant)', marginTop: 2 }}>
                          {profile.description}
                        </div>
                      )}
                    </td>
                    <td style={{ fontSize: 13, color: 'var(--on-surface-variant)' }}>
                      {profile.minTemperature}&deg;C to {profile.maxTemperature}&deg;C
                    </td>
                    <td style={{ fontSize: 13, color: 'var(--on-surface-variant)' }}>
                      {profile.alertMinTemperature}&deg;C to {profile.alertMaxTemperature}&deg;C
                    </td>
                    <td style={{ fontSize: 13, color: 'var(--on-surface-variant)' }}>
                      {profile.minHumidity != null && profile.maxHumidity != null
                        ? `${profile.minHumidity}% to ${profile.maxHumidity}%`
                        : '\u2014'}
                    </td>
                    <td>
                      <span className={`vn-chip ${profile.active ? 'vn-chip-success' : 'vn-chip-secondary'}`}>
                        {profile.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button
                          className="vn-btn vn-btn-ghost vn-btn-sm"
                          title="Edit profile"
                          onClick={() => openEdit(profile)}
                        >
                          <span className="material-icons" style={{ fontSize: 18 }}>edit</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create / Edit Modal */}
      {showModal && (
        <div className="vn-modal-backdrop" onClick={e => { if (e.target === e.currentTarget) closeModal(); }}>
          <div className="vn-modal">
            <div className="vn-modal-header">
              <h2>{editingProfile ? 'Edit Profile' : 'New Profile'}</h2>
              <button className="vn-modal-close" onClick={closeModal}>
                <span className="material-icons">close</span>
              </button>
            </div>
            <div className="vn-modal-body">
              {formError && (
                <div className="vn-alert vn-alert-error" style={{ marginBottom: 16 }}>
                  <span className="material-icons">error</span>
                  <div>{formError}</div>
                </div>
              )}

              {/* Name & Description */}
              <div className="vn-form-grid">
                <div className="vn-field vn-col-span-2">
                  <label className="vn-field-label">Name *</label>
                  <input
                    className="vn-input"
                    type="text"
                    placeholder="Profile name"
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  />
                </div>
                <div className="vn-field vn-col-span-2">
                  <label className="vn-field-label">Description</label>
                  <textarea
                    className="vn-input"
                    placeholder="Optional description"
                    rows={3}
                    value={form.description}
                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    style={{ resize: 'vertical' }}
                  />
                </div>
              </div>

              {/* Temperature Range Section */}
              <div className="vn-form-section">
                <div className="vn-form-section-title">
                  <span className="material-icons">thermostat</span>
                  Temperature Range (&deg;C)
                </div>
                <div className="vn-form-grid">
                  <div className="vn-field">
                    <label className="vn-field-label">Min Temperature *</label>
                    <input
                      className="vn-input"
                      type="number"
                      step="any"
                      placeholder="-20"
                      value={form.minTemperature}
                      onChange={e => setForm(f => ({ ...f, minTemperature: e.target.value }))}
                    />
                  </div>
                  <div className="vn-field">
                    <label className="vn-field-label">Max Temperature *</label>
                    <input
                      className="vn-input"
                      type="number"
                      step="any"
                      placeholder="8"
                      value={form.maxTemperature}
                      onChange={e => setForm(f => ({ ...f, maxTemperature: e.target.value }))}
                    />
                  </div>
                  <div className="vn-field">
                    <label className="vn-field-label">Alert Min Temperature *</label>
                    <input
                      className="vn-input"
                      type="number"
                      step="any"
                      placeholder="-18"
                      value={form.alertMinTemperature}
                      onChange={e => setForm(f => ({ ...f, alertMinTemperature: e.target.value }))}
                    />
                  </div>
                  <div className="vn-field">
                    <label className="vn-field-label">Alert Max Temperature *</label>
                    <input
                      className="vn-input"
                      type="number"
                      step="any"
                      placeholder="6"
                      value={form.alertMaxTemperature}
                      onChange={e => setForm(f => ({ ...f, alertMaxTemperature: e.target.value }))}
                    />
                  </div>
                </div>
                <span className="vn-field-hint">Alert range should be tighter than acceptable range</span>
              </div>

              {/* Humidity Range Section */}
              <div className="vn-form-section">
                <div className="vn-form-section-title">
                  <span className="material-icons">water_drop</span>
                  Humidity Range (% RH)
                </div>
                <div className="vn-form-grid">
                  <div className="vn-field">
                    <label className="vn-field-label">Min Humidity</label>
                    <input
                      className="vn-input"
                      type="number"
                      step="any"
                      placeholder="30"
                      value={form.minHumidity}
                      onChange={e => setForm(f => ({ ...f, minHumidity: e.target.value }))}
                    />
                  </div>
                  <div className="vn-field">
                    <label className="vn-field-label">Max Humidity</label>
                    <input
                      className="vn-input"
                      type="number"
                      step="any"
                      placeholder="70"
                      value={form.maxHumidity}
                      onChange={e => setForm(f => ({ ...f, maxHumidity: e.target.value }))}
                    />
                  </div>
                  <div className="vn-field">
                    <label className="vn-field-label">Alert Min Humidity</label>
                    <input
                      className="vn-input"
                      type="number"
                      step="any"
                      placeholder="35"
                      value={form.alertMinHumidity}
                      onChange={e => setForm(f => ({ ...f, alertMinHumidity: e.target.value }))}
                    />
                  </div>
                  <div className="vn-field">
                    <label className="vn-field-label">Alert Max Humidity</label>
                    <input
                      className="vn-input"
                      type="number"
                      step="any"
                      placeholder="65"
                      value={form.alertMaxHumidity}
                      onChange={e => setForm(f => ({ ...f, alertMaxHumidity: e.target.value }))}
                    />
                  </div>
                </div>
              </div>

              {/* Active Toggle */}
              <div className="vn-field">
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 14, color: 'var(--on-surface)', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={form.active}
                    onChange={e => setForm(f => ({ ...f, active: e.target.checked }))}
                    style={{ accentColor: 'var(--primary)' }}
                  />
                  Active
                </label>
              </div>
            </div>
            <div className="vn-modal-footer">
              <button className="vn-btn vn-btn-outline" onClick={closeModal} disabled={saving}>
                Cancel
              </button>
              <button className="vn-btn vn-btn-primary" onClick={handleSave} disabled={saving}>
                <span className="material-icons">{editingProfile ? 'save' : 'add'}</span>
                {saving ? 'Saving...' : editingProfile ? 'Save Changes' : 'Create Profile'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
