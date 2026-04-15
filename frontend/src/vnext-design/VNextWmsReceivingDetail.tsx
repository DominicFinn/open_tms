import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { API_URL } from '../api';

/* ── Types ────────────────────────────────────────────────── */

interface ReceivingLine {
  id: string;
  sku: string;
  uomCode: string;
  expectedQuantity: number | null;
  receivedQuantity: number;
  damagedQuantity: number;
  inspectionStatus: string;
  lotNumber: string | null;
  expiryDate: string | null;
  trackableUnitId: string | null;
}

interface ReceivingTaskDetail {
  id: string;
  locationId: string;
  status: string;
  receivingType: string;
  crossDock: boolean;
  inboundShipmentId: string | null;
  dockBinId: string | null;
  assignedToUserId: string | null;
  appointmentId: string | null;
  lines: ReceivingLine[];
  createdAt: string;
}

/* ── Helpers ──────────────────────────────────────────────── */

function statusChip(s: string): string {
  switch (s) {
    case 'pending': return 'vn-chip-secondary';
    case 'in_progress': return 'vn-chip-info';
    case 'inspection': return 'vn-chip-warning';
    case 'completed': return 'vn-chip-success';
    case 'cancelled': return 'vn-chip-error';
    default: return 'vn-chip-secondary';
  }
}

function inspectionChip(s: string): string {
  switch (s) {
    case 'pass': return 'vn-chip-success';
    case 'fail': return 'vn-chip-error';
    case 'quarantine': return 'vn-chip-warning';
    default: return 'vn-chip-secondary';
  }
}

function formatStatus(s: string): string {
  return s.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

/* ── Component ────────────────────────────────────────────── */

export default function VNextWmsReceivingDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [task, setTask] = useState<ReceivingTaskDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [completing, setCompleting] = useState(false);

  // Inline line recording form
  const [showRecordForm, setShowRecordForm] = useState(false);
  const [recordForm, setRecordForm] = useState({ sku: '', receivedQuantity: '1', damagedQuantity: '0', lotNumber: '', lineId: '' });
  const [recording, setRecording] = useState(false);

  const loadTask = () => {
    if (!id) return;
    fetch(`${API_URL}/api/v1/receiving/tasks/${id}`)
      .then(r => r.json())
      .then(res => {
        if (res.error) setError(res.error);
        else setTask(res.data);
      })
      .catch(() => setError('Failed to load task'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadTask(); }, [id]);

  const handleRecordLine = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError('');
    setRecording(true);

    const payload: Record<string, unknown> = {
      receivedQuantity: parseInt(recordForm.receivedQuantity) || 0,
      damagedQuantity: parseInt(recordForm.damagedQuantity) || 0,
      lotNumber: recordForm.lotNumber || null,
    };

    if (recordForm.lineId) {
      payload.lineId = recordForm.lineId;
    } else {
      payload.sku = recordForm.sku;
    }

    try {
      const res = await fetch(`${API_URL}/api/v1/receiving/tasks/${id}/lines`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.error) {
        setActionError(data.error);
      } else {
        setRecordForm({ sku: '', receivedQuantity: '1', damagedQuantity: '0', lotNumber: '', lineId: '' });
        setShowRecordForm(false);
        loadTask();
      }
    } catch {
      setActionError('Failed to record line');
    } finally {
      setRecording(false);
    }
  };

  const handleComplete = async () => {
    setActionError('');
    setCompleting(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/receiving/tasks/${id}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (data.error) {
        setActionError(data.error);
      } else {
        loadTask();
      }
    } catch {
      setActionError('Failed to complete task');
    } finally {
      setCompleting(false);
    }
  };

  const handleInspect = async (lineId: string, status: string) => {
    try {
      await fetch(`${API_URL}/api/v1/receiving/lines/${lineId}/inspect`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inspectionStatus: status }),
      });
      loadTask();
    } catch {
      setActionError('Failed to update inspection');
    }
  };

  const recordAgainstLine = (line: ReceivingLine) => {
    setRecordForm({
      sku: line.sku,
      receivedQuantity: String(line.expectedQuantity ?? 0),
      damagedQuantity: '0',
      lotNumber: line.lotNumber || '',
      lineId: line.id,
    });
    setShowRecordForm(true);
  };

  if (loading) {
    return <div style={{ padding: '2rem', textAlign: 'center' }}><div className="vn-loading-spinner" /></div>;
  }
  if (error || !task) {
    return <div className="vn-alert vn-alert-error">{error || 'Task not found'}</div>;
  }

  const totalExpected = task.lines.reduce((s, l) => s + (l.expectedQuantity ?? 0), 0);
  const totalReceived = task.lines.reduce((s, l) => s + l.receivedQuantity, 0);
  const totalDamaged = task.lines.reduce((s, l) => s + l.damagedQuantity, 0);
  const isActive = task.status === 'pending' || task.status === 'in_progress';

  return (
    <div>
      <div className="vn-page-header">
        <div>
          <h1>Receiving Task</h1>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <span className="vn-table-id">{task.id.slice(0, 8)}</span>
            <span className={`vn-chip ${statusChip(task.status)}`}>{formatStatus(task.status)}</span>
            <span className="vn-chip vn-chip-secondary">{task.receivingType === 'asn' ? 'ASN' : 'Blind'}</span>
            {task.crossDock && <span className="vn-chip vn-chip-warning">Cross-Dock</span>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {isActive && (
            <>
              <button className="vn-btn vn-btn-outline" onClick={() => { setShowRecordForm(true); setRecordForm({ sku: '', receivedQuantity: '1', damagedQuantity: '0', lotNumber: '', lineId: '' }); }}>
                <span className="material-icons" style={{ fontSize: '18px', marginRight: '0.5rem' }}>qr_code_scanner</span>
                Record Item
              </button>
              <button className="vn-btn vn-btn-primary" onClick={handleComplete} disabled={completing}>
                {completing ? 'Completing...' : 'Complete Receiving'}
              </button>
            </>
          )}
        </div>
      </div>

      {actionError && <div className="vn-alert vn-alert-error" style={{ marginBottom: '1rem' }}>{actionError}</div>}

      {/* Stats */}
      <div className="vn-stats" style={{ marginBottom: '1.5rem' }}>
        <div className="vn-stat">
          <div className="vn-stat-icon vn-stat-icon-info"><span className="material-icons">list</span></div>
          <div className="vn-stat-value">{task.lines.length}</div>
          <div className="vn-stat-label">Lines</div>
        </div>
        {totalExpected > 0 && (
          <div className="vn-stat">
            <div className="vn-stat-icon vn-stat-icon-secondary"><span className="material-icons">pending</span></div>
            <div className="vn-stat-value">{totalExpected}</div>
            <div className="vn-stat-label">Expected</div>
          </div>
        )}
        <div className="vn-stat">
          <div className="vn-stat-icon vn-stat-icon-success"><span className="material-icons">check_circle</span></div>
          <div className="vn-stat-value">{totalReceived}</div>
          <div className="vn-stat-label">Received</div>
        </div>
        <div className="vn-stat">
          <div className={`vn-stat-icon ${totalDamaged > 0 ? 'vn-stat-icon-error' : 'vn-stat-icon-secondary'}`}><span className="material-icons">report_problem</span></div>
          <div className="vn-stat-value">{totalDamaged}</div>
          <div className="vn-stat-label">Damaged</div>
        </div>
      </div>

      {/* Inline record form */}
      {showRecordForm && (
        <div className="vn-card" style={{ marginBottom: '1rem', borderLeft: '3px solid var(--color-primary)' }}>
          <h3 style={{ margin: '0 0 0.75rem' }}>{recordForm.lineId ? `Record against ${recordForm.sku}` : 'Record New Item'}</h3>
          <form onSubmit={handleRecordLine} style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            {!recordForm.lineId && (
              <div className="vn-field" style={{ flex: '1 1 150px' }}>
                <label className="vn-field-label">SKU *</label>
                <input className="vn-input" value={recordForm.sku} onChange={e => setRecordForm({ ...recordForm, sku: e.target.value })} required />
              </div>
            )}
            <div className="vn-field" style={{ flex: '0 0 100px' }}>
              <label className="vn-field-label">Received Qty *</label>
              <input className="vn-input" type="number" min="0" value={recordForm.receivedQuantity} onChange={e => setRecordForm({ ...recordForm, receivedQuantity: e.target.value })} required />
            </div>
            <div className="vn-field" style={{ flex: '0 0 100px' }}>
              <label className="vn-field-label">Damaged</label>
              <input className="vn-input" type="number" min="0" value={recordForm.damagedQuantity} onChange={e => setRecordForm({ ...recordForm, damagedQuantity: e.target.value })} />
            </div>
            <div className="vn-field" style={{ flex: '0 0 120px' }}>
              <label className="vn-field-label">Lot #</label>
              <input className="vn-input" value={recordForm.lotNumber} onChange={e => setRecordForm({ ...recordForm, lotNumber: e.target.value })} />
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button type="submit" className="vn-btn vn-btn-primary" disabled={recording}>{recording ? 'Saving...' : 'Save'}</button>
              <button type="button" className="vn-btn vn-btn-outline" onClick={() => setShowRecordForm(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Lines table */}
      <div className="vn-card">
        <h3 style={{ margin: '0 0 1rem' }}>Receiving Lines</h3>
        {task.lines.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
            No items recorded yet. Click "Record Item" to start receiving.
          </div>
        ) : (
          <div className="vn-table-wrap">
            <table className="vn-table">
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>UOM</th>
                  <th>Expected</th>
                  <th>Received</th>
                  <th>Damaged</th>
                  <th>Lot</th>
                  <th>Inspection</th>
                  {isActive && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {task.lines.map(line => {
                  const variance = line.expectedQuantity != null ? line.receivedQuantity - line.expectedQuantity : null;
                  return (
                    <tr key={line.id}>
                      <td><strong>{line.sku}</strong></td>
                      <td>{line.uomCode}</td>
                      <td>{line.expectedQuantity ?? '--'}</td>
                      <td style={{ fontWeight: 600, color: line.receivedQuantity > 0 ? 'var(--color-success)' : undefined }}>
                        {line.receivedQuantity}
                        {variance !== null && variance !== 0 && (
                          <span style={{ fontSize: '0.8rem', marginLeft: '0.3rem', color: variance > 0 ? 'var(--color-warning)' : 'var(--color-error)' }}>
                            ({variance > 0 ? '+' : ''}{variance})
                          </span>
                        )}
                      </td>
                      <td>{line.damagedQuantity > 0 ? <span style={{ color: 'var(--color-error)', fontWeight: 600 }}>{line.damagedQuantity}</span> : 0}</td>
                      <td>{line.lotNumber || '--'}</td>
                      <td>
                        {isActive ? (
                          <select
                            className="vn-input"
                            style={{ width: 'auto', padding: '0.2rem 0.5rem', fontSize: '0.85rem' }}
                            value={line.inspectionStatus}
                            onChange={e => handleInspect(line.id, e.target.value)}
                          >
                            <option value="pending">Pending</option>
                            <option value="pass">Pass</option>
                            <option value="fail">Fail</option>
                            <option value="quarantine">Quarantine</option>
                          </select>
                        ) : (
                          <span className={`vn-chip ${inspectionChip(line.inspectionStatus)}`}>{formatStatus(line.inspectionStatus)}</span>
                        )}
                      </td>
                      {isActive && (
                        <td>
                          {line.receivedQuantity === 0 && line.expectedQuantity != null && (
                            <button className="vn-btn vn-btn-outline" style={{ fontSize: '0.8rem', padding: '0.2rem 0.5rem' }} onClick={() => recordAgainstLine(line)}>
                              Receive
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
