import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { API_URL } from '../api';

const CATEGORIES = ['Delivery Delay', 'Freight Damage', 'Delivery', 'Documentation', 'Equipment', 'Communication', 'Compliance', 'Billing', 'Weather', 'General'];
const STATUSES = ['new', 'investigating', 'escalated', 'resolved', 'closed'];

export default function VNextTriageBoardEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = !!id;
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    name: '',
    description: '',
    icon: 'dashboard',
    filterStatus: [] as string[],
    filterSeverity: [] as string[],
    filterCategory: [] as string[],
    filterCustomerId: '',
    filterCarrierId: '',
    filterLaneId: '',
    filterTempControlled: false,
    filterHazmat: false,
    filterSignalScoreMin: '',
    filterShowNoise: false,
    viewMode: 'kanban',
    sortBy: 'createdAt',
    sortOrder: 'desc',
    isShared: true,
  });

  useEffect(() => {
    if (isEdit) {
      fetch(`${API_URL}/api/v1/triage-boards/${id}`).then(r => r.json()).then(res => {
        if (res.data) {
          const b = res.data;
          setForm({
            name: b.name || '', description: b.description || '', icon: b.icon || 'dashboard',
            filterStatus: b.filterStatus || [], filterSeverity: b.filterSeverity || [],
            filterCategory: b.filterCategory || [], filterCustomerId: b.filterCustomerId || '',
            filterCarrierId: b.filterCarrierId || '', filterLaneId: b.filterLaneId || '',
            filterTempControlled: !!b.filterTempControlled, filterHazmat: !!b.filterHazmat,
            filterSignalScoreMin: b.filterSignalScoreMin != null ? String(b.filterSignalScoreMin) : '',
            filterShowNoise: !!b.filterShowNoise, viewMode: b.viewMode || 'kanban',
            sortBy: b.sortBy || 'createdAt', sortOrder: b.sortOrder || 'desc', isShared: b.isShared !== false,
          });
        }
      }).finally(() => setLoading(false));
    }
  }, [id, isEdit]);

  const toggleArray = (arr: string[], val: string) =>
    arr.includes(val) ? arr.filter(v => v !== val) : [...arr, val];

  const save = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    const body = {
      ...form, orgId: 'default',
      filterStatus: form.filterStatus.length > 0 ? form.filterStatus : null,
      filterSeverity: form.filterSeverity.length > 0 ? form.filterSeverity : null,
      filterCategory: form.filterCategory.length > 0 ? form.filterCategory : null,
      filterCustomerId: form.filterCustomerId || null,
      filterCarrierId: form.filterCarrierId || null,
      filterLaneId: form.filterLaneId || null,
      filterTempControlled: form.filterTempControlled || null,
      filterHazmat: form.filterHazmat || null,
      filterSignalScoreMin: form.filterSignalScoreMin ? Number(form.filterSignalScoreMin) : null,
    };
    try {
      const res = await fetch(
        isEdit ? `${API_URL}/api/v1/triage-boards/${id}` : `${API_URL}/api/v1/triage-boards`,
        { method: isEdit ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
      ).then(r => r.json());
      if (res.data) navigate(`/triage/board/${res.data.id}`);
    } catch { /* ignore */ }
    setSaving(false);
  };

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}><div className="loading-spinner" /></div>;

  return (
    <>
      <div className="vn-page-header">
        <div><h1>{isEdit ? 'Edit Board' : 'Create Board'}</h1><p>Configure a saved filter board for your triage workflow</p></div>
      </div>

      <div className="vn-card" style={{ padding: 24, maxWidth: 720 }}>
        {/* Name & description */}
        <div className="vn-form-grid" style={{ marginBottom: 24 }}>
          <div className="vn-field">
            <label className="vn-field-label">Board Name *</label>
            <input className="vn-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g., Walmart Issues" />
          </div>
          <div className="vn-field">
            <label className="vn-field-label">Icon</label>
            <input className="vn-input" value={form.icon} onChange={e => setForm(f => ({ ...f, icon: e.target.value }))} placeholder="Material icon name" />
          </div>
          <div className="vn-field" style={{ gridColumn: 'span 2' }}>
            <label className="vn-field-label">Description</label>
            <input className="vn-input" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="What this board focuses on" />
          </div>
        </div>

        {/* Filter: Status */}
        <div style={{ marginBottom: 20 }}>
          <label className="vn-field-label" style={{ marginBottom: 8, display: 'block' }}>Filter by Status</label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {STATUSES.map(s => (
              <label key={s} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, cursor: 'pointer' }}>
                <input type="checkbox" checked={form.filterStatus.includes(s)} onChange={() => setForm(f => ({ ...f, filterStatus: toggleArray(f.filterStatus, s) }))} />
                <span style={{ textTransform: 'capitalize' }}>{s}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Filter: Severity */}
        <div style={{ marginBottom: 20 }}>
          <label className="vn-field-label" style={{ marginBottom: 8, display: 'block' }}>Filter by Severity</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {['high', 'medium', 'low'].map(s => (
              <label key={s} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, cursor: 'pointer' }}>
                <input type="checkbox" checked={form.filterSeverity.includes(s)} onChange={() => setForm(f => ({ ...f, filterSeverity: toggleArray(f.filterSeverity, s) }))} />
                <span style={{ textTransform: 'capitalize' }}>{s}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Filter: Category */}
        <div style={{ marginBottom: 20 }}>
          <label className="vn-field-label" style={{ marginBottom: 8, display: 'block' }}>Filter by Category</label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {CATEGORIES.map(c => (
              <label key={c} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, cursor: 'pointer' }}>
                <input type="checkbox" checked={form.filterCategory.includes(c)} onChange={() => setForm(f => ({ ...f, filterCategory: toggleArray(f.filterCategory, c) }))} />
                {c}
              </label>
            ))}
          </div>
        </div>

        {/* Entity filters */}
        <div className="vn-form-grid" style={{ marginBottom: 20 }}>
          <div className="vn-field">
            <label className="vn-field-label">Customer ID</label>
            <input className="vn-input" value={form.filterCustomerId} onChange={e => setForm(f => ({ ...f, filterCustomerId: e.target.value }))} placeholder="Specific customer" />
          </div>
          <div className="vn-field">
            <label className="vn-field-label">Carrier ID</label>
            <input className="vn-input" value={form.filterCarrierId} onChange={e => setForm(f => ({ ...f, filterCarrierId: e.target.value }))} placeholder="Specific carrier" />
          </div>
          <div className="vn-field">
            <label className="vn-field-label">Lane ID</label>
            <input className="vn-input" value={form.filterLaneId} onChange={e => setForm(f => ({ ...f, filterLaneId: e.target.value }))} placeholder="Specific lane" />
          </div>
          <div className="vn-field">
            <label className="vn-field-label">Min Signal Score</label>
            <input className="vn-input" type="number" min="0" max="100" value={form.filterSignalScoreMin} onChange={e => setForm(f => ({ ...f, filterSignalScoreMin: e.target.value }))} placeholder="0-100" />
          </div>
        </div>

        {/* Toggles */}
        <div style={{ display: 'flex', gap: 24, marginBottom: 20, flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
            <input type="checkbox" checked={form.filterTempControlled} onChange={e => setForm(f => ({ ...f, filterTempControlled: e.target.checked }))} />
            Temperature controlled only
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
            <input type="checkbox" checked={form.filterHazmat} onChange={e => setForm(f => ({ ...f, filterHazmat: e.target.checked }))} />
            Hazmat only
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
            <input type="checkbox" checked={form.filterShowNoise} onChange={e => setForm(f => ({ ...f, filterShowNoise: e.target.checked }))} />
            Include noise issues
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
            <input type="checkbox" checked={form.isShared} onChange={e => setForm(f => ({ ...f, isShared: e.target.checked }))} />
            Shared with team
          </label>
        </div>

        {/* Display prefs */}
        <div className="vn-form-grid" style={{ marginBottom: 24 }}>
          <div className="vn-field">
            <label className="vn-field-label">Default View</label>
            <select className="vn-filter-select" value={form.viewMode} onChange={e => setForm(f => ({ ...f, viewMode: e.target.value }))}>
              <option value="kanban">Kanban</option><option value="list">List</option>
            </select>
          </div>
          <div className="vn-field">
            <label className="vn-field-label">Sort By</label>
            <select className="vn-filter-select" value={form.sortBy} onChange={e => setForm(f => ({ ...f, sortBy: e.target.value }))}>
              <option value="createdAt">Created Date</option><option value="priority">Priority</option>
              <option value="severity">Severity</option><option value="signalScore">Signal Score</option>
            </select>
          </div>
        </div>

        {/* Actions */}
        <div className="vn-form-actions">
          <button className="vn-btn vn-btn-outline" onClick={() => navigate('/triage/board')}>Cancel</button>
          <button className="vn-btn vn-btn-primary" onClick={save} disabled={!form.name.trim() || saving}>
            {saving ? 'Saving...' : isEdit ? 'Update Board' : 'Create Board'}
          </button>
        </div>
      </div>
    </>
  );
}
