import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { API_URL } from '../api';

interface PackLineDetail {
  id: string;
  sku: string;
  expectedQuantity: number;
  packedQuantity: number;
  status: string;
  trackableUnitId: string;
  orderLineItemId: string;
}

interface PackTaskDetail {
  id: string;
  status: string;
  orderId: string;
  locationId: string;
  packStationBin: { label: string } | null;
  pickTask: { id: string; wave: { waveNumber: string } | null } | null;
  packLines: PackLineDetail[];
  createdAt: string;
}

interface CartonRecommendation {
  cartonId: string;
  cartonName: string;
  lengthMm: number;
  widthMm: number;
  heightMm: number;
  volumeUtilization: number;
  weightUtilization: number;
  unitCostCents: number | null;
  fits: boolean;
}

interface CartonResult {
  recommended: CartonRecommendation | null;
  alternatives: CartonRecommendation[];
  totalItemVolumeMm3: number;
  totalItemWeightGrams: number;
  itemsMissingDimensions: string[];
}

function statusChip(s: string): string {
  switch (s) { case 'pending': return 'vn-chip-secondary'; case 'in_progress': return 'vn-chip-warning'; case 'verified': return 'vn-chip-info'; case 'packed': case 'completed': return 'vn-chip-success'; default: return 'vn-chip-secondary'; }
}

function formatStatus(s: string): string {
  return s.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

export default function VNextWmsPackTaskDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [task, setTask] = useState<PackTaskDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [packing, setPacking] = useState(false);
  const [cartonResult, setCartonResult] = useState<CartonResult | null>(null);
  const [cartonLoading, setCartonLoading] = useState(false);

  const loadTask = () => {
    if (!id) return;
    fetch(`${API_URL}/api/v1/pack-tasks/${id}`)
      .then(r => r.json())
      .then(res => { if (res.error) setError(res.error); else setTask(res.data); })
      .catch(() => setError('Failed to load'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadTask(); }, [id]);

  // Fetch carton recommendation when task loads
  useEffect(() => {
    if (!task || task.status === 'completed' || task.packLines.length === 0) return;
    setCartonLoading(true);
    const items = task.packLines.map(l => ({ sku: l.sku, quantity: l.expectedQuantity, orderLineItemId: l.orderLineItemId }));
    fetch(`${API_URL}/api/v1/cartonization/recommend`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locationId: task.locationId, items }),
    })
      .then(r => r.json())
      .then(res => { if (res.data) setCartonResult(res.data); })
      .catch(() => {})
      .finally(() => setCartonLoading(false));
  }, [task?.id, task?.status]);

  const handlePackLine = async (lineId: string, expectedQty: number) => {
    setError('');
    setPacking(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/pack-lines/${lineId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packedQuantity: expectedQty }),
      });
      const data = await res.json();
      if (data.error) setError(data.error);
      else loadTask();
    } catch { setError('Failed to verify'); }
    finally { setPacking(false); }
  };

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}><div className="vn-loading-spinner" /></div>;
  if (!task) return <div className="vn-alert vn-alert-error">{error || 'Not found'}</div>;

  const isActive = task.status !== 'completed' && task.status !== 'cancelled';
  const totalLines = task.packLines.length;
  const packedLines = task.packLines.filter(l => l.status === 'packed').length;

  return (
    <div>
      <div className="vn-page-header">
        <div>
          <h1>Pack Task</h1>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <span className="vn-table-id">{task.id.slice(0, 8)}</span>
            <span className={`vn-chip ${statusChip(task.status)}`}>{formatStatus(task.status)}</span>
            {task.packStationBin && <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Station: {task.packStationBin.label}</span>}
          </div>
        </div>
      </div>

      {error && <div className="vn-alert vn-alert-error" style={{ marginBottom: '1rem' }}>{error}</div>}

      {/* Progress */}
      <div className="vn-card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
          <span style={{ fontWeight: 600 }}>Verification Progress</span>
          <span style={{ color: 'var(--text-secondary)' }}>{packedLines}/{totalLines} items</span>
        </div>
        <div style={{ height: '8px', background: 'var(--border)', borderRadius: '4px', overflow: 'hidden' }}>
          <div style={{ width: `${totalLines > 0 ? (packedLines / totalLines) * 100 : 0}%`, height: '100%', background: 'var(--color-success)', borderRadius: '4px', transition: 'width 0.3s' }} />
        </div>
      </div>

      {/* Carton recommendation */}
      {isActive && cartonResult && (
        <div className="vn-card" style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ margin: '0 0 0.75rem' }}>
            <span className="material-icons" style={{ fontSize: '18px', verticalAlign: 'middle', marginRight: '0.5rem' }}>package_2</span>
            Carton Recommendation
          </h3>
          {cartonResult.recommended ? (
            <div>
              <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ padding: '12px 20px', background: 'var(--surface-secondary)', borderRadius: '8px', border: '2px solid var(--color-primary)' }}>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--color-primary)' }}>{cartonResult.recommended.cartonName}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    {cartonResult.recommended.lengthMm} x {cartonResult.recommended.widthMm} x {cartonResult.recommended.heightMm} mm
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Volume utilization</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '80px', height: '6px', background: 'var(--border)', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ width: `${Math.min(cartonResult.recommended.volumeUtilization, 100)}%`, height: '100%', background: cartonResult.recommended.volumeUtilization > 85 ? 'var(--color-warning)' : 'var(--color-success)', borderRadius: '3px' }} />
                    </div>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{cartonResult.recommended.volumeUtilization}%</span>
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Weight utilization</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '80px', height: '6px', background: 'var(--border)', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ width: `${Math.min(cartonResult.recommended.weightUtilization, 100)}%`, height: '100%', background: cartonResult.recommended.weightUtilization > 85 ? 'var(--color-warning)' : 'var(--color-success)', borderRadius: '3px' }} />
                    </div>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{cartonResult.recommended.weightUtilization}%</span>
                  </div>
                </div>
                {cartonResult.recommended.unitCostCents != null && (
                  <div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Cost</div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 500 }}>${(cartonResult.recommended.unitCostCents / 100).toFixed(2)}</div>
                  </div>
                )}
              </div>
              {cartonResult.alternatives.length > 0 && (
                <div style={{ marginTop: '0.75rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  Alternatives: {cartonResult.alternatives.map(a => `${a.cartonName} (${a.volumeUtilization}% vol)`).join(', ')}
                </div>
              )}
            </div>
          ) : cartonLoading ? (
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Loading recommendation...</div>
          ) : (
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              {cartonResult.itemsMissingDimensions.length > 0
                ? `Cannot recommend - missing dimensions for: ${cartonResult.itemsMissingDimensions.join(', ')}`
                : 'No suitable carton found in catalogue'}
            </div>
          )}
        </div>
      )}

      {/* Pack lines */}
      <div className="vn-card">
        <h3 style={{ margin: '0 0 1rem' }}>Items to Verify & Pack</h3>
        <div className="vn-table-wrap">
          <table className="vn-table">
            <thead>
              <tr><th>SKU</th><th>Expected</th><th>Packed</th><th>Status</th>{isActive && <th></th>}</tr>
            </thead>
            <tbody>
              {task.packLines.map(line => (
                <tr key={line.id}>
                  <td><strong>{line.sku}</strong></td>
                  <td>{line.expectedQuantity}</td>
                  <td style={{ fontWeight: 600, color: line.packedQuantity > 0 ? 'var(--color-success)' : undefined }}>{line.packedQuantity}</td>
                  <td><span className={`vn-chip ${statusChip(line.status)}`}>{formatStatus(line.status)}</span></td>
                  {isActive && (
                    <td>
                      {line.status === 'pending' && (
                        <button className="vn-btn vn-btn-primary" style={{ fontSize: '0.8rem', padding: '0.25rem 0.75rem' }}
                          disabled={packing} onClick={() => handlePackLine(line.id, line.expectedQuantity)}>
                          <span className="material-icons" style={{ fontSize: '16px', marginRight: '0.3rem' }}>check</span>
                          Verify & Pack
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
