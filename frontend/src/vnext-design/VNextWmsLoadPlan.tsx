import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_URL } from '../api';

interface LoadPlan {
  id: string;
  shipmentId: string | null;
  status: string;
  totalUnits: number;
  loadedUnits: number;
  sealNumber: string | null;
  trailerNumber: string | null;
  carrierId: string | null;
  bolDocumentId: string | null;
  completedAt: string | null;
  createdAt: string;
  _count: { lines: number };
}

interface StagingAssignment {
  id: string;
  orderId: string;
  trackableUnitId: string;
  status: string;
  stagingBin: { label: string } | null;
  trackableUnit: { identifier: string; unitType: string } | null;
}

function statusChip(s: string): string {
  switch (s) { case 'planning': return 'vn-chip-secondary'; case 'loading': return 'vn-chip-warning'; case 'completed': return 'vn-chip-success'; case 'cancelled': return 'vn-chip-error'; default: return 'vn-chip-secondary'; }
}

function formatStatus(s: string): string {
  return s.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

export default function VNextWmsLoadPlan() {
  const navigate = useNavigate();
  const [plans, setPlans] = useState<LoadPlan[]>([]);
  const [staged, setStaged] = useState<StagingAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLocation, setSelectedLocation] = useState('');
  const [locations, setLocations] = useState<Array<{ id: string; name: string }>>([]);

  // Create plan state
  const [showCreate, setShowCreate] = useState(false);
  const [selectedAssignments, setSelectedAssignments] = useState<Set<string>>(new Set());
  const [createForm, setCreateForm] = useState({ shipmentId: '', trailerNumber: '', dockBinId: '' });
  const [creating, setCreating] = useState(false);

  // Complete state
  const [completing, setCompleting] = useState<string | null>(null);
  const [sealNumber, setSealNumber] = useState('');

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [dockBins, setDockBins] = useState<Array<{ id: string; label: string }>>([]);

  useEffect(() => {
    fetch(`${API_URL}/api/v1/locations`).then(r => r.json()).then(res => {
      const locs = (res.data || []).filter((l: any) => !l.locationType || ['warehouse', 'distribution_centre', 'cross_dock'].includes(l.locationType));
      setLocations(locs);
      if (locs.length > 0) setSelectedLocation(locs[0].id);
      else setLoading(false);
    });
  }, []);

  const loadData = () => {
    if (!selectedLocation) return;
    setLoading(true);
    Promise.all([
      fetch(`${API_URL}/api/v1/load-plans?locationId=${selectedLocation}`).then(r => r.json()).then(res => setPlans(res.data || [])),
      fetch(`${API_URL}/api/v1/staging?locationId=${selectedLocation}&status=staged`).then(r => r.json()).then(res => setStaged(res.data || [])),
      fetch(`${API_URL}/api/v1/warehouse/bins?locationId=${selectedLocation}`).then(r => r.json()).then(res => setDockBins((res.data || []).filter((b: any) => b.binType === 'dock_door' && b.active))),
    ]).finally(() => setLoading(false));
  };
  useEffect(() => { loadData(); }, [selectedLocation]);

  const toggleAssignment = (id: string) => {
    const next = new Set(selectedAssignments);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedAssignments(next);
  };

  const handleCreate = async () => {
    if (selectedAssignments.size === 0) return;
    setError(''); setCreating(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/load-plans`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          locationId: selectedLocation,
          stagingAssignmentIds: [...selectedAssignments],
          shipmentId: createForm.shipmentId || null,
          trailerNumber: createForm.trailerNumber || null,
          dockBinId: createForm.dockBinId || null,
        }),
      });
      const data = await res.json();
      if (data.error) setError(data.error);
      else { setShowCreate(false); setSelectedAssignments(new Set()); loadData(); }
    } catch { setError('Failed to create'); }
    finally { setCreating(false); }
  };

  const handleComplete = async (planId: string) => {
    setError(''); setSuccess('');
    try {
      const res = await fetch(`${API_URL}/api/v1/load-plans/${planId}/complete`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sealNumber: sealNumber || null, generateBol: true }),
      });
      const data = await res.json();
      if (data.error) setError(data.error);
      else {
        const r = data.data;
        setSuccess(`Load plan completed. ${r.loadedUnits} units loaded.${r.bolGenerated ? ' BOL generated.' : ''}${r.bolError ? ` BOL warning: ${r.bolError}` : ''}`);
        setCompleting(null); setSealNumber(''); loadData();
      }
    } catch { setError('Failed'); }
  };

  return (
    <div>
      <div className="vn-page-header">
        <div><h1>Load Plans</h1><p className="vn-page-subtitle">Plan outbound loads with reverse load-sequence and auto BOL generation</p></div>
        <button className="vn-btn vn-btn-primary" onClick={() => setShowCreate(true)} disabled={staged.length === 0}>
          <span className="material-icons" style={{ fontSize: '18px', marginRight: '0.5rem' }}>add</span>New Load Plan
        </button>
      </div>

      {error && <div className="vn-alert vn-alert-error" style={{ marginBottom: '1rem' }}>{error}</div>}
      {success && <div className="vn-alert vn-alert-success" style={{ marginBottom: '1rem' }}>{success}</div>}

      <div className="vn-filters" style={{ marginBottom: '1rem' }}>
        <select className="vn-filter-select" value={selectedLocation} onChange={e => setSelectedLocation(e.target.value)}>
          {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="vn-modal-backdrop" onClick={() => setShowCreate(false)}>
          <div className="vn-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '700px' }}>
            <div className="vn-modal-header"><h3>New Load Plan</h3><button onClick={() => setShowCreate(false)}><span className="material-icons">close</span></button></div>
            <div className="vn-modal-body">
              <div className="vn-form-grid" style={{ marginBottom: '1rem' }}>
                <div className="vn-field"><label className="vn-field-label">Trailer #</label><input className="vn-input" value={createForm.trailerNumber} onChange={e => setCreateForm({ ...createForm, trailerNumber: e.target.value })} /></div>
                <div className="vn-field"><label className="vn-field-label">Dock Door</label><select className="vn-input" value={createForm.dockBinId} onChange={e => setCreateForm({ ...createForm, dockBinId: e.target.value })}><option value="">None</option>{dockBins.map(b => <option key={b.id} value={b.id}>{b.label}</option>)}</select></div>
              </div>
              <h4 style={{ margin: '0 0 0.5rem' }}>Select Staged Units ({selectedAssignments.size} selected)</h4>
              <div className="vn-table-wrap" style={{ maxHeight: '300px', overflow: 'auto' }}>
                <table className="vn-table">
                  <thead><tr><th></th><th>Unit</th><th>Order</th><th>Staging Bin</th></tr></thead>
                  <tbody>
                    {staged.map(a => (
                      <tr key={a.id} onClick={() => toggleAssignment(a.id)} style={{ cursor: 'pointer', background: selectedAssignments.has(a.id) ? 'var(--surface-secondary)' : undefined }}>
                        <td><input type="checkbox" checked={selectedAssignments.has(a.id)} onChange={() => toggleAssignment(a.id)} /></td>
                        <td><strong>{a.trackableUnit?.identifier ?? a.trackableUnitId.slice(0, 8)}</strong></td>
                        <td>{a.orderId.slice(0, 8)}</td>
                        <td>{a.stagingBin?.label ?? '--'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="vn-modal-footer">
              <button className="vn-btn vn-btn-outline" onClick={() => setShowCreate(false)}>Cancel</button>
              <button className="vn-btn vn-btn-primary" disabled={creating || selectedAssignments.size === 0} onClick={handleCreate}>
                {creating ? 'Creating...' : `Create Plan (${selectedAssignments.size} units)`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Complete modal */}
      {completing && (
        <div className="vn-modal-backdrop" onClick={() => setCompleting(null)}>
          <div className="vn-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <div className="vn-modal-header"><h3>Complete Load</h3><button onClick={() => setCompleting(null)}><span className="material-icons">close</span></button></div>
            <div className="vn-modal-body">
              <div className="vn-field" style={{ marginBottom: '1rem' }}>
                <label className="vn-field-label">Seal Number</label>
                <input className="vn-input" value={sealNumber} onChange={e => setSealNumber(e.target.value)} placeholder="Enter trailer seal number" autoFocus />
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>
                Completing the load will mark all units as loaded, clear their warehouse location, and auto-generate a Bill of Lading.
              </p>
            </div>
            <div className="vn-modal-footer">
              <button className="vn-btn vn-btn-outline" onClick={() => setCompleting(null)}>Cancel</button>
              <button className="vn-btn vn-btn-primary" onClick={() => handleComplete(completing)}>Complete & Generate BOL</button>
            </div>
          </div>
        </div>
      )}

      {loading ? <div style={{ padding: '2rem', textAlign: 'center' }}><div className="vn-loading-spinner" /></div> : (
        <>
          {/* Active plans */}
          {plans.length === 0 ? (
            <div className="vn-card" style={{ textAlign: 'center', padding: '3rem' }}>
              <span className="material-icons" style={{ fontSize: '48px', color: 'var(--text-secondary)', marginBottom: '1rem', display: 'block' }}>local_shipping</span>
              <h3>No load plans</h3>
              <p style={{ color: 'var(--text-secondary)' }}>
                {staged.length > 0 ? `${staged.length} units staged and ready. Create a load plan to sequence the load and generate a BOL.` : 'Stage packed units first, then create a load plan.'}
              </p>
            </div>
          ) : (
            <div className="vn-table-wrap">
              <table className="vn-table">
                <thead><tr><th>Plan</th><th>Shipment</th><th>Trailer</th><th>Units</th><th>Seal</th><th>BOL</th><th>Status</th><th>Actions</th></tr></thead>
                <tbody>
                  {plans.map(p => (
                    <tr key={p.id}>
                      <td><span className="vn-table-id">{p.id.slice(0, 8)}</span></td>
                      <td>{p.shipmentId?.slice(0, 8) ?? '--'}</td>
                      <td>{p.trailerNumber ?? '--'}</td>
                      <td>{p.loadedUnits}/{p.totalUnits}</td>
                      <td>{p.sealNumber ?? '--'}</td>
                      <td>{p.bolDocumentId ? <span className="vn-chip vn-chip-success">Generated</span> : '--'}</td>
                      <td><span className={`vn-chip ${statusChip(p.status)}`}>{formatStatus(p.status)}</span></td>
                      <td>
                        {p.status === 'planning' && (
                          <button className="vn-btn vn-btn-primary" style={{ fontSize: '0.8rem', padding: '0.2rem 0.6rem' }} onClick={() => { setCompleting(p.id); setSealNumber(''); }}>
                            Complete
                          </button>
                        )}
                        {p.bolDocumentId && (
                          <button className="vn-btn vn-btn-outline" style={{ fontSize: '0.8rem', padding: '0.2rem 0.6rem', marginLeft: '0.25rem' }} onClick={() => navigate(`/documents/${p.bolDocumentId}/view`)}>
                            BOL
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
