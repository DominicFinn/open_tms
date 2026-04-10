import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { API_URL } from '../api';

/* ── Constants ────────────────────────────────────────────── */

const CATEGORIES = [
  'Pickup Delay', 'Delivery Delay', 'Delivery', 'Documentation',
  'Equipment', 'Communication', 'Compliance', 'Freight Damage',
  'Billing', 'Weather', 'General',
];
const STATUSES = ['new', 'investigating', 'escalated', 'resolved', 'closed'];
const SEVERITIES = ['high', 'medium', 'low'];
const SORT_FIELDS = [
  { value: 'createdAt', label: 'Created Date' },
  { value: 'updatedAt', label: 'Updated Date' },
  { value: 'priority', label: 'Priority' },
  { value: 'severity', label: 'Severity' },
  { value: 'signalScore', label: 'Signal Score' },
  { value: 'slaDeadline', label: 'SLA Deadline' },
];

/* ── Main Component ───────────────────────────────────────── */

export default function VNextTriageBoardEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = !!id;
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    name: '',
    description: '',
    icon: 'dashboard',
    filterStatus: [] as string[],
    filterSeverity: [] as string[],
    filterCategory: [] as string[],
    filterPriorityMin: '',
    filterPriorityMax: '',
    filterCustomerId: '',
    filterCarrierId: '',
    filterLaneId: '',
    filterRegion: '',
    filterTempControlled: false,
    filterHazmat: false,
    filterSignalScoreMin: '',
    filterShowNoise: false,
    viewMode: 'kanban',
    sortBy: 'createdAt',
    sortOrder: 'desc',
    isShared: true,
  });

  /* ── Load existing board ──────────────────────────────── */

  useEffect(() => {
    if (!isEdit) return;
    let cancelled = false;
    fetch(`${API_URL}/api/v1/triage-boards/${id}`)
      .then(r => r.json())
      .then(res => {
        if (cancelled) return;
        if (res.data) {
          const b = res.data;
          setForm({
            name: b.name || '',
            description: b.description || '',
            icon: b.icon || 'dashboard',
            filterStatus: b.filterStatus || [],
            filterSeverity: b.filterSeverity || [],
            filterCategory: b.filterCategory || [],
            filterPriorityMin: b.filterPriorityMin != null ? String(b.filterPriorityMin) : '',
            filterPriorityMax: b.filterPriorityMax != null ? String(b.filterPriorityMax) : '',
            filterCustomerId: b.filterCustomerId || '',
            filterCarrierId: b.filterCarrierId || '',
            filterLaneId: b.filterLaneId || '',
            filterRegion: b.filterRegion || '',
            filterTempControlled: !!b.filterTempControlled,
            filterHazmat: !!b.filterHazmat,
            filterSignalScoreMin: b.filterSignalScoreMin != null ? String(b.filterSignalScoreMin) : '',
            filterShowNoise: !!b.filterShowNoise,
            viewMode: b.viewMode || 'kanban',
            sortBy: b.sortBy || 'createdAt',
            sortOrder: b.sortOrder || 'desc',
            isShared: b.isShared !== false,
          });
        }
      })
      .catch((e: any) => { if (!cancelled) setError(e.message || 'Failed to load board'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id, isEdit]);

  /* ── Helpers ──────────────────────────────────────────── */

  const toggleArray = (arr: string[], val: string) =>
    arr.includes(val) ? arr.filter(v => v !== val) : [...arr, val];

  /* ── Save ─────────────────────────────────────────────── */

  const save = async () => {
    if (!form.name.trim()) {
      setError('Board name is required');
      return;
    }
    setSaving(true);
    setError('');

    const body = {
      ...form,
      orgId: 'default',
      filterStatus: form.filterStatus.length > 0 ? form.filterStatus : null,
      filterSeverity: form.filterSeverity.length > 0 ? form.filterSeverity : null,
      filterCategory: form.filterCategory.length > 0 ? form.filterCategory : null,
      filterPriorityMin: form.filterPriorityMin ? Number(form.filterPriorityMin) : null,
      filterPriorityMax: form.filterPriorityMax ? Number(form.filterPriorityMax) : null,
      filterCustomerId: form.filterCustomerId || null,
      filterCarrierId: form.filterCarrierId || null,
      filterLaneId: form.filterLaneId || null,
      filterRegion: form.filterRegion || null,
      filterTempControlled: form.filterTempControlled || null,
      filterHazmat: form.filterHazmat || null,
      filterSignalScoreMin: form.filterSignalScoreMin ? Number(form.filterSignalScoreMin) : null,
    };
    try {
      const res = await fetch(
        isEdit ? `${API_URL}/api/v1/triage-boards/${id}` : `${API_URL}/api/v1/triage-boards`,
        { method: isEdit ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
      ).then(r => r.json());
      if (res.error) {
        setError(res.error);
      } else if (res.data) {
        navigate(`/triage/board/${res.data.id}`);
      }
    } catch (e: any) {
      setError(e.message || 'Failed to save board');
    }
    setSaving(false);
  };

  /* ── Render ──────────────────────────────────────────── */

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
        <div className="loading-spinner" />
      </div>
    );
  }

  return (
    <>
      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <button className="vn-btn vn-btn-ghost vn-btn-sm" onClick={() => navigate('/triage/board')}>
          <span className="material-icons">arrow_back</span>
          Triage Board
        </button>
        <span style={{ color: 'var(--on-surface-variant)', fontSize: 13 }}>
          / {isEdit ? 'Edit Board' : 'New Board'}
        </span>
      </div>

      <div className="vn-page-header">
        <div>
          <h1>{isEdit ? 'Edit Board' : 'Create Board'}</h1>
          <p>Configure a saved filter board for your triage workflow</p>
        </div>
      </div>

      {error && (
        <div className="vn-alert vn-alert-warning" style={{ marginBottom: 16 }}>
          <span className="material-icons">warning</span>
          <div className="vn-alert-content">{error}</div>
        </div>
      )}

      <div className="vn-card" style={{ maxWidth: 780 }}>
        <div className="vn-card-body">
          {/* ── Board Details ─────────────────────────────── */}
          <div className="vn-form-section">
            <div className="vn-form-section-title">
              <span className="material-icons">info</span>
              Board Details
            </div>
            <div className="vn-form-grid">
              <div className="vn-field">
                <label className="vn-field-label">
                  Name <span className="required">*</span>
                </label>
                <input
                  className="vn-input"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g., Walmart Issues"
                />
              </div>
              <div className="vn-field">
                <label className="vn-field-label">Icon</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input
                    className="vn-input"
                    value={form.icon}
                    onChange={e => setForm(f => ({ ...f, icon: e.target.value }))}
                    placeholder="Material icon name"
                  />
                  {form.icon && (
                    <span className="material-icons" style={{ fontSize: 24, color: 'var(--primary)' }}>
                      {form.icon}
                    </span>
                  )}
                </div>
                <span className="vn-field-hint">Material Icons name for the sidebar</span>
              </div>
              <div className="vn-field vn-col-span-2">
                <label className="vn-field-label">Description</label>
                <textarea
                  className="vn-textarea"
                  rows={2}
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="What this board focuses on"
                />
              </div>
            </div>
          </div>

          {/* ── Filter Configuration ─────────────────────── */}
          <div className="vn-form-section">
            <div className="vn-form-section-title">
              <span className="material-icons">filter_list</span>
              Filter Configuration
            </div>

            {/* Status checkboxes */}
            <div className="vn-field">
              <label className="vn-field-label">Statuses</label>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                {STATUSES.map(s => (
                  <label key={s} className="vn-checkbox">
                    <input
                      type="checkbox"
                      checked={form.filterStatus.includes(s)}
                      onChange={() => setForm(f => ({ ...f, filterStatus: toggleArray(f.filterStatus, s) }))}
                    />
                    <span style={{ textTransform: 'capitalize' }}>{s}</span>
                  </label>
                ))}
              </div>
              <span className="vn-field-hint">Leave empty to include all statuses</span>
            </div>

            {/* Severity checkboxes */}
            <div className="vn-field">
              <label className="vn-field-label">Severities</label>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                {SEVERITIES.map(s => (
                  <label key={s} className="vn-checkbox">
                    <input
                      type="checkbox"
                      checked={form.filterSeverity.includes(s)}
                      onChange={() => setForm(f => ({ ...f, filterSeverity: toggleArray(f.filterSeverity, s) }))}
                    />
                    <span style={{ textTransform: 'capitalize' }}>{s}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="vn-form-grid">
              {/* Priority range */}
              <div className="vn-field">
                <label className="vn-field-label">Priority Min</label>
                <input
                  className="vn-input"
                  type="number"
                  min={1}
                  max={5}
                  placeholder="1"
                  value={form.filterPriorityMin}
                  onChange={e => setForm(f => ({ ...f, filterPriorityMin: e.target.value }))}
                />
              </div>
              <div className="vn-field">
                <label className="vn-field-label">Priority Max</label>
                <input
                  className="vn-input"
                  type="number"
                  min={1}
                  max={5}
                  placeholder="5"
                  value={form.filterPriorityMax}
                  onChange={e => setForm(f => ({ ...f, filterPriorityMax: e.target.value }))}
                />
              </div>

              {/* Category */}
              <div className="vn-field">
                <label className="vn-field-label">Category</label>
                <select
                  className="vn-select"
                  value={form.filterCategory.length === 1 ? form.filterCategory[0] : ''}
                  onChange={e => setForm(f => ({ ...f, filterCategory: e.target.value ? [e.target.value] : [] }))}
                >
                  <option value="">All Categories</option>
                  {CATEGORIES.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              {/* Signal Score Min */}
              <div className="vn-field">
                <label className="vn-field-label">Signal Score Minimum</label>
                <input
                  className="vn-input"
                  type="number"
                  min={0}
                  max={100}
                  placeholder="0"
                  value={form.filterSignalScoreMin}
                  onChange={e => setForm(f => ({ ...f, filterSignalScoreMin: e.target.value }))}
                />
              </div>

              {/* Customer ID */}
              <div className="vn-field">
                <label className="vn-field-label">Customer ID</label>
                <input
                  className="vn-input"
                  value={form.filterCustomerId}
                  onChange={e => setForm(f => ({ ...f, filterCustomerId: e.target.value }))}
                  placeholder="Filter by customer"
                />
              </div>

              {/* Carrier ID */}
              <div className="vn-field">
                <label className="vn-field-label">Carrier ID</label>
                <input
                  className="vn-input"
                  value={form.filterCarrierId}
                  onChange={e => setForm(f => ({ ...f, filterCarrierId: e.target.value }))}
                  placeholder="Filter by carrier"
                />
              </div>

              {/* Lane ID */}
              <div className="vn-field">
                <label className="vn-field-label">Lane ID</label>
                <input
                  className="vn-input"
                  value={form.filterLaneId}
                  onChange={e => setForm(f => ({ ...f, filterLaneId: e.target.value }))}
                  placeholder="Filter by lane"
                />
              </div>

              {/* Region */}
              <div className="vn-field">
                <label className="vn-field-label">Region</label>
                <input
                  className="vn-input"
                  value={form.filterRegion}
                  onChange={e => setForm(f => ({ ...f, filterRegion: e.target.value }))}
                  placeholder="e.g. Northeast, West Coast"
                />
              </div>
            </div>

            {/* Toggles */}
            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginTop: 8 }}>
              <label className="vn-switch">
                <input
                  type="checkbox"
                  checked={form.filterTempControlled}
                  onChange={e => setForm(f => ({ ...f, filterTempControlled: e.target.checked }))}
                />
                <div className="vn-switch-track" />
                Temperature controlled
              </label>
              <label className="vn-switch">
                <input
                  type="checkbox"
                  checked={form.filterHazmat}
                  onChange={e => setForm(f => ({ ...f, filterHazmat: e.target.checked }))}
                />
                <div className="vn-switch-track" />
                Hazmat
              </label>
              <label className="vn-switch">
                <input
                  type="checkbox"
                  checked={form.filterShowNoise}
                  onChange={e => setForm(f => ({ ...f, filterShowNoise: e.target.checked }))}
                />
                <div className="vn-switch-track" />
                Show noise
              </label>
            </div>
          </div>

          {/* ── View Settings ────────────────────────────── */}
          <div className="vn-form-section">
            <div className="vn-form-section-title">
              <span className="material-icons">view_quilt</span>
              View Settings
            </div>
            <div className="vn-form-grid">
              <div className="vn-field">
                <label className="vn-field-label">View Mode</label>
                <select
                  className="vn-select"
                  value={form.viewMode}
                  onChange={e => setForm(f => ({ ...f, viewMode: e.target.value }))}
                >
                  <option value="kanban">Kanban Board</option>
                  <option value="list">List View</option>
                </select>
              </div>
              <div className="vn-field">
                <label className="vn-field-label">Sort By</label>
                <select
                  className="vn-select"
                  value={form.sortBy}
                  onChange={e => setForm(f => ({ ...f, sortBy: e.target.value }))}
                >
                  {SORT_FIELDS.map(f => (
                    <option key={f.value} value={f.value}>{f.label}</option>
                  ))}
                </select>
              </div>
              <div className="vn-field">
                <label className="vn-field-label">Sort Order</label>
                <select
                  className="vn-select"
                  value={form.sortOrder}
                  onChange={e => setForm(f => ({ ...f, sortOrder: e.target.value }))}
                >
                  <option value="desc">Descending (newest first)</option>
                  <option value="asc">Ascending (oldest first)</option>
                </select>
              </div>
              <div className="vn-field" style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 16 }}>
                <label className="vn-switch">
                  <input
                    type="checkbox"
                    checked={form.isShared}
                    onChange={e => setForm(f => ({ ...f, isShared: e.target.checked }))}
                  />
                  <div className="vn-switch-track" />
                  Shared with team
                </label>
              </div>
            </div>
          </div>

          {/* ── Actions ──────────────────────────────────── */}
          <div className="vn-form-actions">
            <button className="vn-btn vn-btn-outline" onClick={() => navigate('/triage/board')}>
              Cancel
            </button>
            <button
              className="vn-btn vn-btn-primary"
              onClick={save}
              disabled={!form.name.trim() || saving}
            >
              {saving ? 'Saving...' : isEdit ? 'Update Board' : 'Create Board'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
