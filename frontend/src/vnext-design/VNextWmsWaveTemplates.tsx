import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_URL } from '../api';

interface WaveTemplate {
  id: string;
  name: string;
  pickStrategy: string;
  cutoffTime: string | null;
  minOrders: number | null;
  maxOrders: number | null;
  priority: number;
  releaseSchedule: string | null;
  autoRelease: boolean;
  active: boolean;
  groupingRules: Record<string, unknown> | null;
  _count: { waves: number };
}

function formatStatus(s: string): string {
  return s.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

export default function VNextWmsWaveTemplates() {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<WaveTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLocation, setSelectedLocation] = useState('');
  const [locations, setLocations] = useState<Array<{ id: string; name: string }>>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [applying, setApplying] = useState<string | null>(null);
  const [applyResult, setApplyResult] = useState<any>(null);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    name: '', pickStrategy: 'discrete', cutoffTime: '',
    minOrders: '', maxOrders: '', priority: '50',
    releaseSchedule: '', autoRelease: false,
  });

  useEffect(() => {
    fetch(`${API_URL}/api/v1/locations`).then(r => r.json()).then(res => {
      const locs = (res.data || []).filter((l: any) => !l.locationType || ['warehouse', 'distribution_centre', 'cross_dock'].includes(l.locationType));
      setLocations(locs);
      if (locs.length > 0) setSelectedLocation(locs[0].id);
      else setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const loadData = () => {
    if (!selectedLocation) return;
    setLoading(true);
    fetch(`${API_URL}/api/v1/wave-templates?locationId=${selectedLocation}`)
      .then(r => r.json())
      .then(res => setTemplates(res.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadData(); }, [selectedLocation]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setCreating(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/wave-templates`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          locationId: selectedLocation,
          name: form.name.trim(),
          pickStrategy: form.pickStrategy,
          cutoffTime: form.cutoffTime || null,
          minOrders: form.minOrders ? parseInt(form.minOrders) : null,
          maxOrders: form.maxOrders ? parseInt(form.maxOrders) : null,
          priority: parseInt(form.priority) || 50,
          releaseSchedule: form.releaseSchedule || null,
          autoRelease: form.autoRelease,
        }),
      });
      const data = await res.json();
      if (data.error) setError(data.error);
      else { setShowCreate(false); setForm({ name: '', pickStrategy: 'discrete', cutoffTime: '', minOrders: '', maxOrders: '', priority: '50', releaseSchedule: '', autoRelease: false }); loadData(); }
    } catch { setError('Failed to create'); }
    finally { setCreating(false); }
  };

  const handleApply = async (templateId: string) => {
    setError('');
    setApplying(templateId);
    setApplyResult(null);
    try {
      const res = await fetch(`${API_URL}/api/v1/wave-templates/${templateId}/apply`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (data.error) setError(data.error);
      else setApplyResult(data.data);
    } catch { setError('Failed to apply'); }
    finally { setApplying(null); }
  };

  const handleToggle = async (id: string, active: boolean) => {
    await fetch(`${API_URL}/api/v1/wave-templates/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !active }),
    });
    loadData();
  };

  return (
    <div>
      <div className="vn-page-header">
        <div>
          <h1>Wave Templates</h1>
          <p className="vn-page-subtitle">Automate wave creation with reusable templates</p>
        </div>
        <button className="vn-btn vn-btn-primary" onClick={() => setShowCreate(true)}>
          <span className="material-icons" style={{ fontSize: '18px', marginRight: '0.5rem' }}>add</span>
          New Template
        </button>
      </div>

      {error && <div className="vn-alert vn-alert-error" style={{ marginBottom: '1rem' }}>{error}</div>}
      {applyResult && (
        <div className={`vn-alert ${applyResult.skipped ? 'vn-alert-warning' : 'vn-alert-success'}`} style={{ marginBottom: '1rem' }}>
          {applyResult.skipped
            ? `Skipped: ${applyResult.skipReason}`
            : `Created wave ${applyResult.waveNumber} with ${applyResult.orderCount} orders`}
          {applyResult.waveId && (
            <button className="vn-btn vn-btn-outline" style={{ marginLeft: '1rem', fontSize: '0.85rem' }} onClick={() => navigate(`/wms/waves/${applyResult.waveId}`)}>
              View Wave
            </button>
          )}
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <div className="vn-modal-backdrop" onClick={() => setShowCreate(false)}>
          <div className="vn-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '550px' }}>
            <div className="vn-modal-header"><h3>New Wave Template</h3><button onClick={() => setShowCreate(false)}><span className="material-icons">close</span></button></div>
            <form onSubmit={handleCreate}>
              <div className="vn-modal-body">
                <div className="vn-form-grid">
                  <div className="vn-field" style={{ gridColumn: '1 / -1' }}>
                    <label className="vn-field-label">Template Name *</label>
                    <input className="vn-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder='e.g. "Daily FedEx 14:00 cutoff"' required />
                  </div>
                  <div className="vn-field">
                    <label className="vn-field-label">Pick Strategy *</label>
                    <select className="vn-input" value={form.pickStrategy} onChange={e => setForm({ ...form, pickStrategy: e.target.value })}>
                      <option value="discrete">Discrete</option>
                      <option value="batch">Batch</option>
                      <option value="zone">Zone</option>
                    </select>
                  </div>
                  <div className="vn-field">
                    <label className="vn-field-label">Cutoff Time</label>
                    <input className="vn-input" type="time" value={form.cutoffTime} onChange={e => setForm({ ...form, cutoffTime: e.target.value })} />
                  </div>
                  <div className="vn-field">
                    <label className="vn-field-label">Min Orders</label>
                    <input className="vn-input" type="number" min="1" value={form.minOrders} onChange={e => setForm({ ...form, minOrders: e.target.value })} placeholder="Optional" />
                  </div>
                  <div className="vn-field">
                    <label className="vn-field-label">Max Orders</label>
                    <input className="vn-input" type="number" min="1" value={form.maxOrders} onChange={e => setForm({ ...form, maxOrders: e.target.value })} placeholder="Optional" />
                  </div>
                  <div className="vn-field">
                    <label className="vn-field-label">Priority (1-100)</label>
                    <input className="vn-input" type="number" min="1" max="100" value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })} />
                  </div>
                  <div className="vn-field">
                    <label className="vn-field-label">Auto-Release Schedule</label>
                    <input className="vn-input" value={form.releaseSchedule} onChange={e => setForm({ ...form, releaseSchedule: e.target.value })} placeholder="Cron e.g. 0 14 * * *" />
                  </div>
                  <div className="vn-field" style={{ gridColumn: '1 / -1' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                      <input type="checkbox" checked={form.autoRelease} onChange={e => setForm({ ...form, autoRelease: e.target.checked })} />
                      Auto-release waves (allocate inventory + generate picks immediately)
                    </label>
                  </div>
                </div>
              </div>
              <div className="vn-modal-footer">
                <button type="button" className="vn-btn vn-btn-outline" onClick={() => setShowCreate(false)}>Cancel</button>
                <button type="submit" className="vn-btn vn-btn-primary" disabled={creating}>{creating ? 'Creating...' : 'Create Template'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="vn-filters" style={{ marginBottom: '1rem' }}>
        <select className="vn-filter-select" value={selectedLocation} onChange={e => setSelectedLocation(e.target.value)}>
          {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
      </div>

      {loading ? (
        <div style={{ padding: '2rem', textAlign: 'center' }}><div className="vn-loading-spinner" /></div>
      ) : templates.length === 0 ? (
        <div className="vn-card" style={{ textAlign: 'center', padding: '3rem' }}>
          <span className="material-icons" style={{ fontSize: '48px', color: 'var(--text-secondary)', marginBottom: '1rem', display: 'block' }}>description</span>
          <h3>No wave templates</h3>
          <p style={{ color: 'var(--text-secondary)' }}>Templates automate wave creation based on carrier cutoffs, order grouping, and schedules.</p>
        </div>
      ) : (
        <div className="vn-table-wrap">
          <table className="vn-table">
            <thead>
              <tr><th>Name</th><th>Strategy</th><th>Cutoff</th><th>Orders</th><th>Schedule</th><th>Waves</th><th>Active</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {templates.map(t => (
                <tr key={t.id}>
                  <td><strong>{t.name}</strong></td>
                  <td><span className="vn-chip vn-chip-primary">{formatStatus(t.pickStrategy)}</span></td>
                  <td>{t.cutoffTime || '--'}</td>
                  <td>{t.minOrders || '--'} - {t.maxOrders || '--'}</td>
                  <td style={{ fontFamily: t.releaseSchedule ? 'monospace' : undefined, fontSize: '0.85rem' }}>{t.releaseSchedule || 'Manual'}</td>
                  <td>{t._count.waves}</td>
                  <td>
                    <span className={`vn-chip ${t.active ? 'vn-chip-success' : 'vn-chip-secondary'}`} style={{ cursor: 'pointer' }} onClick={() => handleToggle(t.id, t.active)}>
                      {t.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.25rem' }}>
                      <button className="vn-btn vn-btn-primary" style={{ fontSize: '0.75rem', padding: '0.15rem 0.5rem' }}
                        disabled={applying === t.id || !t.active} onClick={() => handleApply(t.id)}>
                        {applying === t.id ? 'Running...' : 'Run Now'}
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
  );
}
