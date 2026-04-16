import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { API_URL } from '../api';

/* ── Types ────────────────────────────────────────────────── */

interface PutawayTaskDetail {
  id: string;
  locationId: string;
  status: string;
  putawayType: string;
  assignedToUserId: string | null;
  trackableUnit: {
    id: string;
    identifier: string;
    unitType: string;
    barcode: string | null;
    lotNumber: string | null;
    expiryDate: string | null;
    qualityStatus: string;
    lineItems: Array<{
      sku: string;
      description: string | null;
      quantity: number;
      weight: number | null;
      temperature: string | null;
      hazmat: boolean;
    }>;
  };
  sourceBin: { id: string; label: string; binType: string } | null;
  targetBin: {
    id: string;
    label: string;
    binType: string;
    temperatureZone: string | null;
    hazmatCertified: boolean;
    zone: { name: string; zoneType: string; temperatureZone: string | null; hazmatCertified: boolean };
  };
  receivingTask: { id: string; receivingType: string } | null;
  createdAt: string;
}

/* ── Helpers ──────────────────────────────────────────────── */

function statusChip(s: string): string {
  switch (s) {
    case 'pending': return 'vn-chip-secondary';
    case 'assigned': return 'vn-chip-info';
    case 'in_progress': return 'vn-chip-warning';
    case 'completed': return 'vn-chip-success';
    case 'cancelled': return 'vn-chip-error';
    default: return 'vn-chip-secondary';
  }
}

function formatStatus(s: string): string {
  return s.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

/* ── Component ────────────────────────────────────────────── */

export default function VNextWmsPutawayDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [task, setTask] = useState<PutawayTaskDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Scan-to-confirm state
  const [scannedBinLabel, setScannedBinLabel] = useState('');
  const [completing, setCompleting] = useState(false);
  const [completionResult, setCompletionResult] = useState<any>(null);

  const loadTask = () => {
    if (!id) return;
    fetch(`${API_URL}/api/v1/putaway/tasks/${id}`)
      .then(r => r.json())
      .then(res => {
        if (res.error) setError(res.error);
        else setTask(res.data);
      })
      .catch(() => setError('Failed to load task'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadTask(); }, [id]);

  const handleComplete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scannedBinLabel.trim()) return;
    setError('');
    setCompleting(true);
    setCompletionResult(null);

    try {
      const res = await fetch(`${API_URL}/api/v1/putaway/tasks/${id}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scannedBinLabel: scannedBinLabel.trim() }),
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setCompletionResult(data.data);
        loadTask();
      }
    } catch {
      setError('Failed to complete putaway');
    } finally {
      setCompleting(false);
    }
  };

  if (loading) {
    return <div style={{ padding: '2rem', textAlign: 'center' }}><div className="vn-loading-spinner" /></div>;
  }
  if (error && !task) {
    return <div className="vn-alert vn-alert-error">{error}</div>;
  }
  if (!task) return null;

  const isActive = task.status !== 'completed' && task.status !== 'cancelled';
  const unit = task.trackableUnit;
  const hasTemp = unit.lineItems.some(li => li.temperature && li.temperature !== 'ambient');
  const hasHazmat = unit.lineItems.some(li => li.hazmat);

  return (
    <div>
      <div className="vn-page-header">
        <div>
          <h1>Putaway Task</h1>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <span className="vn-table-id">{task.id.slice(0, 8)}</span>
            <span className={`vn-chip ${statusChip(task.status)}`}>{formatStatus(task.status)}</span>
            <span className="vn-chip vn-chip-secondary">{formatStatus(task.putawayType)}</span>
          </div>
        </div>
      </div>

      {error && <div className="vn-alert vn-alert-error" style={{ marginBottom: '1rem' }}>{error}</div>}

      {/* Completion result feedback */}
      {completionResult && (
        <div style={{ marginBottom: '1rem' }}>
          {completionResult.deviation && (
            <div className="vn-alert vn-alert-warning" style={{ marginBottom: '0.5rem' }}>
              <strong>Deviation recorded:</strong> {completionResult.deviationReason}
            </div>
          )}
          {completionResult.constraintWarnings?.length > 0 && (
            <div className="vn-alert vn-alert-warning" style={{ marginBottom: '0.5rem' }}>
              <strong>Constraint warnings:</strong>
              <ul style={{ margin: '0.5rem 0 0', paddingLeft: '1.2rem' }}>
                {completionResult.constraintWarnings.map((w: string, i: number) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          )}
          {!completionResult.deviation && completionResult.constraintWarnings?.length === 0 && (
            <div className="vn-alert vn-alert-success">
              Putaway completed successfully at <strong>{completionResult.actualBinLabel}</strong>
            </div>
          )}
        </div>
      )}

      <div className="vn-detail-grid">
        <div className="vn-detail-main">
          {/* Direction card */}
          <div className="vn-card" style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ margin: '0 0 1rem' }}>Direction</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', fontSize: '1.1rem' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>From</div>
                <div style={{ fontWeight: 600, fontSize: '1.2rem' }}>
                  {task.sourceBin?.label || 'Dock'}
                </div>
              </div>
              <span className="material-icons" style={{ fontSize: '32px', color: 'var(--color-primary)' }}>arrow_forward</span>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>To</div>
                <div style={{ fontWeight: 600, fontSize: '1.2rem', color: 'var(--color-primary)' }}>
                  {task.targetBin.label}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  {task.targetBin.zone.name} ({formatStatus(task.targetBin.zone.zoneType)})
                </div>
              </div>
            </div>

            {/* Constraint indicators */}
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', flexWrap: 'wrap' }}>
              {task.targetBin.temperatureZone && (
                <span className="vn-chip vn-chip-info">
                  <span className="material-icons" style={{ fontSize: '14px', marginRight: '0.3rem' }}>thermostat</span>
                  {formatStatus(task.targetBin.temperatureZone)}
                </span>
              )}
              {task.targetBin.hazmatCertified && (
                <span className="vn-chip vn-chip-warning">
                  <span className="material-icons" style={{ fontSize: '14px', marginRight: '0.3rem' }}>warning</span>
                  Hazmat Certified
                </span>
              )}
              {hasTemp && (
                <span className="vn-chip vn-chip-error">
                  <span className="material-icons" style={{ fontSize: '14px', marginRight: '0.3rem' }}>ac_unit</span>
                  Temp Sensitive
                </span>
              )}
              {hasHazmat && (
                <span className="vn-chip vn-chip-error">
                  <span className="material-icons" style={{ fontSize: '14px', marginRight: '0.3rem' }}>science</span>
                  Hazmat
                </span>
              )}
            </div>
          </div>

          {/* Scan to confirm */}
          {isActive && (
            <div className="vn-card" style={{ marginBottom: '1.5rem', borderLeft: '3px solid var(--color-primary)' }}>
              <h3 style={{ margin: '0 0 0.75rem' }}>Scan to Confirm</h3>
              <p style={{ color: 'var(--text-secondary)', margin: '0 0 1rem', fontSize: '0.9rem' }}>
                Scan the bin barcode where you placed the unit. If different from the directed bin, a deviation will be recorded.
              </p>
              <form onSubmit={handleComplete} style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end' }}>
                <div className="vn-field" style={{ flex: 1 }}>
                  <label className="vn-field-label">Bin Label</label>
                  <input
                    className="vn-input"
                    value={scannedBinLabel}
                    onChange={e => setScannedBinLabel(e.target.value)}
                    placeholder={`Expected: ${task.targetBin.label}`}
                    autoFocus
                    required
                  />
                </div>
                <button type="submit" className="vn-btn vn-btn-primary" disabled={completing} style={{ whiteSpace: 'nowrap' }}>
                  {completing ? 'Confirming...' : 'Confirm Putaway'}
                </button>
              </form>
            </div>
          )}

          {/* Unit contents */}
          <div className="vn-card">
            <h3 style={{ margin: '0 0 1rem' }}>Unit Contents</h3>
            {unit.lineItems.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)' }}>No line items</p>
            ) : (
              <div className="vn-table-wrap">
                <table className="vn-table">
                  <thead>
                    <tr>
                      <th>SKU</th>
                      <th>Description</th>
                      <th>Qty</th>
                      <th>Weight</th>
                      <th>Temp</th>
                      <th>Hazmat</th>
                    </tr>
                  </thead>
                  <tbody>
                    {unit.lineItems.map((li, i) => (
                      <tr key={i}>
                        <td><strong>{li.sku}</strong></td>
                        <td>{li.description || '--'}</td>
                        <td>{li.quantity}</td>
                        <td>{li.weight != null ? `${li.weight} kg` : '--'}</td>
                        <td>{li.temperature || 'ambient'}</td>
                        <td>{li.hazmat ? <span className="vn-chip vn-chip-error">Yes</span> : 'No'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <div className="vn-detail-sidebar">
          {/* Unit info */}
          <div className="vn-card">
            <h3 style={{ margin: '0 0 0.75rem' }}>Unit</h3>
            <dl style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem 1rem', margin: 0 }}>
              <div>
                <dt style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Identifier</dt>
                <dd style={{ margin: 0, fontWeight: 500 }}>{unit.identifier}</dd>
              </div>
              <div>
                <dt style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Type</dt>
                <dd style={{ margin: 0 }}>{formatStatus(unit.unitType)}</dd>
              </div>
              {unit.barcode && (
                <div>
                  <dt style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Barcode</dt>
                  <dd style={{ margin: 0, fontFamily: 'monospace', fontSize: '0.85rem' }}>{unit.barcode}</dd>
                </div>
              )}
              {unit.lotNumber && (
                <div>
                  <dt style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Lot</dt>
                  <dd style={{ margin: 0 }}>{unit.lotNumber}</dd>
                </div>
              )}
              {unit.expiryDate && (
                <div>
                  <dt style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Expiry</dt>
                  <dd style={{ margin: 0 }}>{new Date(unit.expiryDate).toLocaleDateString()}</dd>
                </div>
              )}
              <div>
                <dt style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Quality</dt>
                <dd style={{ margin: 0 }}>
                  <span className={`vn-chip ${unit.qualityStatus === 'available' ? 'vn-chip-success' : 'vn-chip-warning'}`}>
                    {formatStatus(unit.qualityStatus)}
                  </span>
                </dd>
              </div>
            </dl>
          </div>

          {/* Task info */}
          <div className="vn-card">
            <h3 style={{ margin: '0 0 0.75rem' }}>Task Info</h3>
            <dl style={{ display: 'grid', gap: '0.5rem', margin: 0 }}>
              <div>
                <dt style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Type</dt>
                <dd style={{ margin: 0 }}>{formatStatus(task.putawayType)}</dd>
              </div>
              {task.assignedToUserId && (
                <div>
                  <dt style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Assigned To</dt>
                  <dd style={{ margin: 0 }}>{task.assignedToUserId}</dd>
                </div>
              )}
              {task.receivingTask && (
                <div>
                  <dt style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>From Receiving</dt>
                  <dd style={{ margin: 0 }}>
                    <button className="vn-btn vn-btn-outline" style={{ fontSize: '0.8rem', padding: '0.15rem 0.5rem' }}
                      onClick={() => navigate(`/wms/receiving/${task.receivingTask!.id}`)}>
                      {task.receivingTask.id.slice(0, 8)} ({task.receivingTask.receivingType})
                    </button>
                  </dd>
                </div>
              )}
              <div>
                <dt style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Created</dt>
                <dd style={{ margin: 0 }}>{new Date(task.createdAt).toLocaleString()}</dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}
