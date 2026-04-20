import { useEffect, useState } from 'react';
import { API_URL } from '../api';

interface Carrier { id: string; name: string; }
interface Cutoff {
  id: string;
  carrierId: string;
  locationId: string | null;
  dayOfWeek: number;
  cutoffLocalTime: string;
  timezone: string;
  serviceLevel: string | null;
  notes: string | null;
  active: boolean;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function VNextCarrierCutoffs() {
  const [carriers, setCarriers] = useState<Carrier[]>([]);
  const [selectedCarrier, setSelectedCarrier] = useState('');
  const [cutoffs, setCutoffs] = useState<Cutoff[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ dayOfWeek: 1, cutoffLocalTime: '16:30', timezone: 'UTC', serviceLevel: '', notes: '' });
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`${API_URL}/api/v1/carriers`).then(r => r.json()).then(json => setCarriers(json.data || []));
  }, []);

  const loadCutoffs = (id: string) => {
    setLoading(true);
    fetch(`${API_URL}/api/v1/carriers/${id}/cutoffs`)
      .then(r => r.json())
      .then(json => setCutoffs(json.data || []))
      .finally(() => setLoading(false));
  };

  useEffect(() => { if (selectedCarrier) loadCutoffs(selectedCarrier); else setCutoffs([]); }, [selectedCarrier]);

  const handleCreate = async () => {
    if (!selectedCarrier) return;
    setError('');
    const res = await fetch(`${API_URL}/api/v1/carriers/${selectedCarrier}/cutoffs`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dayOfWeek: form.dayOfWeek,
        cutoffLocalTime: form.cutoffLocalTime,
        timezone: form.timezone,
        serviceLevel: form.serviceLevel || undefined,
        notes: form.notes || undefined,
      }),
    });
    const data = await res.json();
    if (data.error) setError(data.error);
    else { setShowCreate(false); loadCutoffs(selectedCarrier); }
  };

  const handleToggle = async (c: Cutoff) => {
    await fetch(`${API_URL}/api/v1/carrier-cutoffs/${c.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !c.active }),
    });
    loadCutoffs(selectedCarrier);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this cutoff row?')) return;
    await fetch(`${API_URL}/api/v1/carrier-cutoffs/${id}`, { method: 'DELETE' });
    loadCutoffs(selectedCarrier);
  };

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Carrier Cutoffs</h1>
      <p style={{ color: 'var(--text-secondary)', margin: '0 0 16px' }}>
        Configure the latest handoff time per day for each carrier. The cutoff monitor compares projected warehouse-ready time against these rows and raises an issue when shipments are at risk.
      </p>

      <div className="vn-card" style={{ marginBottom: 16 }}>
        <div className="vn-filters" style={{ padding: '8px 16px' }}>
          <select className="vn-filter-select" value={selectedCarrier} onChange={e => setSelectedCarrier(e.target.value)}>
            <option value="">Select a carrier...</option>
            {carriers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          {selectedCarrier && (
            <button className="vn-btn vn-btn-primary" style={{ marginLeft: 'auto' }} onClick={() => setShowCreate(v => !v)}>
              <span className="material-icons">add</span> New cutoff
            </button>
          )}
        </div>
      </div>

      {error && <div className="vn-alert vn-alert-error" style={{ marginBottom: 16 }}>{error}</div>}

      {selectedCarrier && showCreate && (
        <div className="vn-card" style={{ padding: 16, marginBottom: 16 }}>
          <h3 style={{ margin: '0 0 12px' }}>New cutoff row</h3>
          <div className="vn-form-grid" style={{ gap: 8 }}>
            <div className="vn-field">
              <label className="vn-field-label">Day of week</label>
              <select className="vn-input" value={form.dayOfWeek} onChange={e => setForm(f => ({ ...f, dayOfWeek: parseInt(e.target.value) }))}>
                {DAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
              </select>
            </div>
            <div className="vn-field">
              <label className="vn-field-label">Cutoff time (HH:mm, local)</label>
              <input className="vn-input" value={form.cutoffLocalTime} onChange={e => setForm(f => ({ ...f, cutoffLocalTime: e.target.value }))} placeholder="16:30" />
            </div>
            <div className="vn-field">
              <label className="vn-field-label">Timezone (IANA)</label>
              <input className="vn-input" value={form.timezone} onChange={e => setForm(f => ({ ...f, timezone: e.target.value }))} placeholder="America/New_York" />
            </div>
            <div className="vn-field">
              <label className="vn-field-label">Service level (optional)</label>
              <input className="vn-input" value={form.serviceLevel} onChange={e => setForm(f => ({ ...f, serviceLevel: e.target.value }))} placeholder="ground" />
            </div>
          </div>
          <div className="vn-field" style={{ marginTop: 8 }}>
            <label className="vn-field-label">Notes</label>
            <input className="vn-input" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          </div>
          <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
            <button className="vn-btn vn-btn-primary" onClick={handleCreate}>Create</button>
            <button className="vn-btn vn-btn-outline" onClick={() => setShowCreate(false)}>Cancel</button>
          </div>
        </div>
      )}

      {selectedCarrier && (
        <div className="vn-card">
          <div className="vn-table-wrap">
            <table className="vn-table">
              <thead>
                <tr>
                  <th>Day</th>
                  <th>Cutoff</th>
                  <th>Timezone</th>
                  <th>Service</th>
                  <th>Status</th>
                  <th>Notes</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {loading && <tr><td colSpan={7} style={{ textAlign: 'center', padding: 24 }}><div className="vn-loading-spinner" /></td></tr>}
                {!loading && cutoffs.length === 0 && (
                  <tr><td colSpan={7} style={{ textAlign: 'center', padding: 24, color: 'var(--text-secondary)' }}>
                    No cutoff rows configured for this carrier.
                  </td></tr>
                )}
                {cutoffs.map(c => (
                  <tr key={c.id}>
                    <td><strong>{DAYS[c.dayOfWeek]}</strong></td>
                    <td><code>{c.cutoffLocalTime}</code></td>
                    <td>{c.timezone}</td>
                    <td>{c.serviceLevel ?? '-'}</td>
                    <td><span className={`vn-chip ${c.active ? 'vn-chip-success' : 'vn-chip-secondary'}`}>{c.active ? 'Active' : 'Disabled'}</span></td>
                    <td><span className="vn-table-secondary">{c.notes ?? ''}</span></td>
                    <td style={{ textAlign: 'right' }}>
                      <button className="vn-btn vn-btn-outline vn-btn-sm" onClick={() => handleToggle(c)}>{c.active ? 'Disable' : 'Enable'}</button>
                      {' '}
                      <button className="vn-btn vn-btn-outline vn-btn-sm" style={{ color: 'var(--color-error)' }} onClick={() => handleDelete(c.id)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
