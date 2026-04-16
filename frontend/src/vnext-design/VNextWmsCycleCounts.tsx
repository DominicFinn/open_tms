import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_URL } from '../api';

interface CycleCount {
  id: string;
  countType: string;
  status: string;
  totalBins: number;
  countedBins: number;
  varianceCount: number;
  assignedToUserId: string | null;
  plannedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

function statusChip(s: string): string {
  switch (s) { case 'planned': return 'vn-chip-secondary'; case 'in_progress': return 'vn-chip-warning'; case 'completed': return 'vn-chip-success'; case 'cancelled': return 'vn-chip-error'; default: return 'vn-chip-secondary'; }
}

function formatStatus(s: string): string {
  return s.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

export default function VNextWmsCycleCounts() {
  const navigate = useNavigate();
  const [counts, setCounts] = useState<CycleCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLocation, setSelectedLocation] = useState('');
  const [locations, setLocations] = useState<Array<{ id: string; name: string }>>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ countType: 'full', zoneId: '' });
  const [zones, setZones] = useState<Array<{ id: string; name: string }>>([]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`${API_URL}/api/v1/locations`)
      .then(r => r.json())
      .then(res => {
        const locs = (res.data || []).filter((l: any) => !l.locationType || ['warehouse', 'distribution_centre', 'cross_dock'].includes(l.locationType));
        setLocations(locs);
        if (locs.length > 0) setSelectedLocation(locs[0].id);
        else setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedLocation) return;
    setLoading(true);
    fetch(`${API_URL}/api/v1/cycle-counts?locationId=${selectedLocation}`)
      .then(r => r.json())
      .then(res => setCounts(res.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));

    fetch(`${API_URL}/api/v1/warehouse/zones?locationId=${selectedLocation}`)
      .then(r => r.json())
      .then(res => setZones((res.data || []).map((z: any) => ({ id: z.id, name: z.name }))))
      .catch(() => {});
  }, [selectedLocation]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setCreating(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/cycle-counts`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          locationId: selectedLocation,
          countType: createForm.countType,
          zoneId: createForm.countType === 'zone' ? createForm.zoneId : null,
        }),
      });
      const data = await res.json();
      if (data.error) setError(data.error);
      else { setShowCreate(false); navigate(`/wms/cycle-counts/${data.data.id}`); }
    } catch { setError('Failed to create'); }
    finally { setCreating(false); }
  };

  return (
    <div>
      <div className="vn-page-header">
        <div>
          <h1>Cycle Counts</h1>
          <p className="vn-page-subtitle">Inventory accuracy verification</p>
        </div>
        <button className="vn-btn vn-btn-primary" onClick={() => setShowCreate(true)}>
          <span className="material-icons" style={{ fontSize: '18px', marginRight: '0.5rem' }}>add</span>
          New Count
        </button>
      </div>

      {error && <div className="vn-alert vn-alert-error" style={{ marginBottom: '1rem' }}>{error}</div>}

      {/* Create modal */}
      {showCreate && (
        <div className="vn-modal-backdrop" onClick={() => setShowCreate(false)}>
          <div className="vn-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <div className="vn-modal-header"><h3>New Cycle Count</h3><button onClick={() => setShowCreate(false)}><span className="material-icons">close</span></button></div>
            <form onSubmit={handleCreate}>
              <div className="vn-modal-body">
                <div className="vn-field" style={{ marginBottom: '1rem' }}>
                  <label className="vn-field-label">Count Type</label>
                  <select className="vn-input" value={createForm.countType} onChange={e => setCreateForm({ ...createForm, countType: e.target.value })}>
                    <option value="full">Full (all bins)</option>
                    <option value="zone">Zone (specific zone)</option>
                    <option value="random_sample">Random Sample (~20%)</option>
                  </select>
                </div>
                {createForm.countType === 'zone' && (
                  <div className="vn-field">
                    <label className="vn-field-label">Zone</label>
                    <select className="vn-input" value={createForm.zoneId} onChange={e => setCreateForm({ ...createForm, zoneId: e.target.value })} required>
                      <option value="">Select zone...</option>
                      {zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
                    </select>
                  </div>
                )}
              </div>
              <div className="vn-modal-footer">
                <button type="button" className="vn-btn vn-btn-outline" onClick={() => setShowCreate(false)}>Cancel</button>
                <button type="submit" className="vn-btn vn-btn-primary" disabled={creating}>{creating ? 'Creating...' : 'Create'}</button>
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
      ) : counts.length === 0 ? (
        <div className="vn-card" style={{ textAlign: 'center', padding: '3rem' }}>
          <span className="material-icons" style={{ fontSize: '48px', color: 'var(--text-secondary)', marginBottom: '1rem', display: 'block' }}>fact_check</span>
          <h3>No cycle counts</h3>
          <p style={{ color: 'var(--text-secondary)' }}>Create a cycle count to verify inventory accuracy.</p>
        </div>
      ) : (
        <div className="vn-table-wrap">
          <table className="vn-table">
            <thead>
              <tr><th>Type</th><th>Progress</th><th>Variances</th><th>Status</th><th>Created</th><th></th></tr>
            </thead>
            <tbody>
              {counts.map(c => (
                <tr key={c.id}>
                  <td><span className="vn-chip vn-chip-primary">{formatStatus(c.countType)}</span></td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <div style={{ flex: 1, height: '6px', background: 'var(--border)', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{ width: `${c.totalBins > 0 ? (c.countedBins / c.totalBins) * 100 : 0}%`, height: '100%', background: 'var(--color-success)', borderRadius: '3px' }} />
                      </div>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{c.countedBins}/{c.totalBins}</span>
                    </div>
                  </td>
                  <td>{c.varianceCount > 0 ? <span style={{ color: 'var(--color-error)', fontWeight: 600 }}>{c.varianceCount}</span> : '0'}</td>
                  <td><span className={`vn-chip ${statusChip(c.status)}`}>{formatStatus(c.status)}</span></td>
                  <td>{new Date(c.createdAt).toLocaleDateString()}</td>
                  <td><button className="vn-btn vn-btn-outline" style={{ fontSize: '0.8rem', padding: '0.15rem 0.5rem' }} onClick={() => navigate(`/wms/cycle-counts/${c.id}`)}>View</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
