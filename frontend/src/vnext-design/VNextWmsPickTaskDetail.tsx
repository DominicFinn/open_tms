import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { API_URL } from '../api';

interface PickLineDetail {
  id: string;
  orderId: string;
  sku: string;
  uomCode: string;
  requestedQuantity: number;
  pickedQuantity: number;
  status: string;
  walkSequence: number;
  lotNumber: string | null;
  shortPickAction: string | null;
  bin: { label: string; zone: { name: string } };
}

interface PickTaskDetail {
  id: string;
  status: string;
  pickType: string;
  orderId: string | null;
  totalLines: number;
  completedLines: number;
  assignedToUserId: string | null;
  wave: { waveNumber: string; pickStrategy: string } | null;
  pickLines: PickLineDetail[];
  createdAt: string;
}

function statusChip(s: string): string {
  switch (s) { case 'pending': return 'vn-chip-secondary'; case 'assigned': return 'vn-chip-info'; case 'in_progress': return 'vn-chip-warning'; case 'picked': case 'completed': return 'vn-chip-success'; case 'short': case 'short_pick': return 'vn-chip-error'; case 'skipped': return 'vn-chip-secondary'; default: return 'vn-chip-secondary'; }
}

function formatStatus(s: string): string {
  return s.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

export default function VNextWmsPickTaskDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [task, setTask] = useState<PickTaskDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Inline pick form
  const [pickingLineId, setPickingLineId] = useState<string | null>(null);
  const [pickForm, setPickForm] = useState({ pickedQuantity: '', shortPickAction: 'backorder' });
  const [picking, setPicking] = useState(false);

  const loadTask = () => {
    if (!id) return;
    fetch(`${API_URL}/api/v1/pick-tasks/${id}`)
      .then(r => r.json())
      .then(res => { if (res.error) setError(res.error); else setTask(res.data); })
      .catch(() => setError('Failed to load'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadTask(); }, [id]);

  const startPick = (line: PickLineDetail) => {
    setPickingLineId(line.id);
    setPickForm({ pickedQuantity: String(line.requestedQuantity), shortPickAction: 'backorder' });
    setError('');
  };

  const handlePick = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pickingLineId) return;
    setError('');
    setPicking(true);

    const qty = parseInt(pickForm.pickedQuantity) || 0;
    const line = task?.pickLines.find(l => l.id === pickingLineId);
    const payload: Record<string, unknown> = { pickedQuantity: qty };
    if (line && qty < line.requestedQuantity) {
      payload.shortPickAction = pickForm.shortPickAction;
    }

    try {
      const res = await fetch(`${API_URL}/api/v1/pick-lines/${pickingLineId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.error) setError(data.error);
      else { setPickingLineId(null); loadTask(); }
    } catch { setError('Failed to complete pick'); }
    finally { setPicking(false); }
  };

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}><div className="vn-loading-spinner" /></div>;
  if (!task) return <div className="vn-alert vn-alert-error">{error || 'Not found'}</div>;

  const isActive = task.status !== 'completed' && task.status !== 'cancelled' && task.status !== 'short_pick';
  const nextLine = task.pickLines.find(l => l.status === 'pending');

  return (
    <div>
      <div className="vn-page-header">
        <div>
          <h1>Pick Task</h1>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <span className="vn-table-id">{task.id.slice(0, 8)}</span>
            <span className={`vn-chip ${statusChip(task.status)}`}>{formatStatus(task.status)}</span>
            <span className="vn-chip vn-chip-primary">{formatStatus(task.pickType)}</span>
            {task.wave && <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Wave: {task.wave.waveNumber}</span>}
          </div>
        </div>
      </div>

      {error && <div className="vn-alert vn-alert-error" style={{ marginBottom: '1rem' }}>{error}</div>}

      {/* Progress bar */}
      <div className="vn-card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
          <span style={{ fontWeight: 600 }}>Progress</span>
          <span style={{ color: 'var(--text-secondary)' }}>{task.completedLines}/{task.totalLines} lines</span>
        </div>
        <div style={{ height: '8px', background: 'var(--border)', borderRadius: '4px', overflow: 'hidden' }}>
          <div style={{ width: `${task.totalLines > 0 ? (task.completedLines / task.totalLines) * 100 : 0}%`, height: '100%', background: 'var(--color-success)', borderRadius: '4px', transition: 'width 0.3s' }} />
        </div>
      </div>

      {/* Next pick highlight */}
      {isActive && nextLine && (
        <div className="vn-card" style={{ marginBottom: '1.5rem', borderLeft: '3px solid var(--color-primary)' }}>
          <h3 style={{ margin: '0 0 0.5rem' }}>Next Pick</h3>
          <div style={{ display: 'flex', gap: '2rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Bin</div>
              <div style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--color-primary)' }}>{nextLine.bin.label}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{nextLine.bin.zone.name}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>SKU</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>{nextLine.sku}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Qty</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>{nextLine.requestedQuantity} {nextLine.uomCode}</div>
            </div>
            {nextLine.lotNumber && (
              <div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Lot</div>
                <div>{nextLine.lotNumber}</div>
              </div>
            )}
            <button className="vn-btn vn-btn-primary" onClick={() => startPick(nextLine)}>
              <span className="material-icons" style={{ fontSize: '18px', marginRight: '0.5rem' }}>check</span>
              Confirm Pick
            </button>
          </div>
        </div>
      )}

      {/* Inline pick form */}
      {pickingLineId && (
        <div className="vn-card" style={{ marginBottom: '1rem', borderLeft: '3px solid var(--color-success)' }}>
          <h3 style={{ margin: '0 0 0.75rem' }}>Record Pick</h3>
          <form onSubmit={handlePick} style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div className="vn-field" style={{ flex: '0 0 120px' }}>
              <label className="vn-field-label">Picked Qty</label>
              <input className="vn-input" type="number" min="0" value={pickForm.pickedQuantity}
                onChange={e => setPickForm({ ...pickForm, pickedQuantity: e.target.value })} autoFocus required />
            </div>
            {parseInt(pickForm.pickedQuantity) < (task.pickLines.find(l => l.id === pickingLineId)?.requestedQuantity ?? 0) && (
              <div className="vn-field" style={{ flex: '0 0 150px' }}>
                <label className="vn-field-label">Short Pick Action</label>
                <select className="vn-input" value={pickForm.shortPickAction} onChange={e => setPickForm({ ...pickForm, shortPickAction: e.target.value })}>
                  <option value="backorder">Backorder</option>
                  <option value="cancel_line">Cancel Line</option>
                </select>
              </div>
            )}
            <button type="submit" className="vn-btn vn-btn-primary" disabled={picking}>{picking ? 'Saving...' : 'Confirm'}</button>
            <button type="button" className="vn-btn vn-btn-outline" onClick={() => setPickingLineId(null)}>Cancel</button>
          </form>
        </div>
      )}

      {/* Pick lines table */}
      <div className="vn-card">
        <h3 style={{ margin: '0 0 1rem' }}>Pick Lines (walk order)</h3>
        <div className="vn-table-wrap">
          <table className="vn-table">
            <thead>
              <tr><th>Seq</th><th>Bin</th><th>Zone</th><th>SKU</th><th>Requested</th><th>Picked</th><th>Lot</th><th>Status</th>{isActive && <th></th>}</tr>
            </thead>
            <tbody>
              {task.pickLines.map(line => (
                <tr key={line.id} style={{ background: line.id === pickingLineId ? 'var(--surface-secondary)' : undefined }}>
                  <td>{line.walkSequence}</td>
                  <td><strong>{line.bin.label}</strong></td>
                  <td style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{line.bin.zone.name}</td>
                  <td>{line.sku}</td>
                  <td>{line.requestedQuantity}</td>
                  <td style={{ fontWeight: 600, color: line.pickedQuantity > 0 ? (line.pickedQuantity < line.requestedQuantity ? 'var(--color-warning)' : 'var(--color-success)') : undefined }}>
                    {line.pickedQuantity}
                  </td>
                  <td>{line.lotNumber || '--'}</td>
                  <td><span className={`vn-chip ${statusChip(line.status)}`}>{formatStatus(line.status)}</span></td>
                  {isActive && (
                    <td>
                      {line.status === 'pending' && (
                        <button className="vn-btn vn-btn-outline" style={{ fontSize: '0.8rem', padding: '0.15rem 0.5rem' }} onClick={() => startPick(line)}>
                          Pick
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
