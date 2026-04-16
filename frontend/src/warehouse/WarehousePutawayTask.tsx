import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { API_URL } from '../api';
interface PutawayTaskDetail {
  id: string;
  status: string;
  putawayType: string;
  trackableUnit: { identifier: string; unitType: string; barcode: string | null };
  sourceBin: { label: string } | null;
  targetBin: { label: string; zone: { name: string } };
}

export default function WarehousePutawayTask() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [task, setTask] = useState<PutawayTaskDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [scannedBin, setScannedBin] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [result, setResult] = useState<any>(null);

  // Wire barcode scanner to auto-fill the bin label
  // useBarcodeScanner((barcode) => setScannedBin(barcode));

  useEffect(() => {
    fetch(`${API_URL}/api/v1/putaway/tasks/${id}`)
      .then(r => r.json())
      .then(res => { if (res.data) setTask(res.data); else setError('Not found'); })
      .catch(() => setError('Failed to load'))
      .finally(() => setLoading(false));
  }, [id]);

  const handleConfirm = async () => {
    if (!scannedBin.trim()) return;
    setError('');
    setConfirming(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/putaway/tasks/${id}/complete`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scannedBinLabel: scannedBin.trim() }),
      });
      const data = await res.json();
      if (data.error) setError(data.error);
      else setResult(data.data);
    } catch { setError('Failed'); }
    finally { setConfirming(false); }
  };

  if (loading) return <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>Loading...</div>;
  if (!task) return <div style={{ padding: '1rem', color: '#ef4444' }}>{error}</div>;

  return (
    <div>
      <button onClick={() => navigate('/warehouse/tasks')} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '16px' }}>
        <span className="material-icons" style={{ fontSize: '20px' }}>arrow_back</span> Tasks
      </button>

      {error && <div style={{ padding: '10px', background: '#7f1d1d', borderRadius: '8px', color: '#fca5a5', marginBottom: '12px', fontSize: '13px' }}>{error}</div>}

      {result ? (
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <span className="material-icons" style={{ fontSize: '48px', color: result.deviation ? '#f59e0b' : '#10b981', display: 'block', marginBottom: '8px' }}>
            {result.deviation ? 'warning' : 'check_circle'}
          </span>
          <div style={{ fontSize: '18px', fontWeight: 600, marginBottom: '4px' }}>
            {result.deviation ? 'Putaway Complete (Deviation)' : 'Putaway Complete'}
          </div>
          <div style={{ color: '#94a3b8', fontSize: '13px' }}>
            Placed at <strong>{result.actualBinLabel}</strong>
          </div>
          {result.deviation && (
            <div style={{ marginTop: '8px', padding: '8px', background: '#78350f', borderRadius: '8px', fontSize: '12px', color: '#fde68a' }}>
              {result.deviationReason}
            </div>
          )}
          {result.constraintWarnings?.length > 0 && (
            <div style={{ marginTop: '8px', padding: '8px', background: '#78350f', borderRadius: '8px', fontSize: '12px', color: '#fde68a' }}>
              {result.constraintWarnings.join('; ')}
            </div>
          )}
          <button onClick={() => navigate('/warehouse/tasks')} style={{ marginTop: '16px', padding: '12px 24px', borderRadius: '10px', border: 'none', background: '#3b82f6', color: 'white', fontWeight: 600, cursor: 'pointer' }}>
            Back to Tasks
          </button>
        </div>
      ) : (
        <>
          {/* Direction */}
          <div style={{ background: '#1e293b', borderRadius: '16px', padding: '20px', marginBottom: '16px' }}>
            <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              {task.putawayType === 'replenishment' ? 'Replenishment' : 'Putaway'}
            </div>

            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '14px', color: '#64748b' }}>Unit</div>
              <div style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px' }}>{task.trackableUnit.identifier}</div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px' }}>
                <div>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>From</div>
                  <div style={{ fontSize: '16px', fontWeight: 600 }}>{task.sourceBin?.label ?? 'Dock'}</div>
                </div>
                <span className="material-icons" style={{ fontSize: '28px', color: '#3b82f6' }}>arrow_forward</span>
                <div>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>To</div>
                  <div style={{ fontSize: '20px', fontWeight: 700, color: '#3b82f6' }}>{task.targetBin.label}</div>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>{task.targetBin.zone.name}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Scan to confirm */}
          <div style={{ background: '#1e293b', borderRadius: '16px', padding: '20px', border: '2px solid #3b82f6' }}>
            <div style={{ fontSize: '11px', color: '#3b82f6', fontWeight: 600, marginBottom: '12px', textTransform: 'uppercase' }}>Scan Destination Bin</div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                value={scannedBin}
                onChange={e => setScannedBin(e.target.value)}
                placeholder={task.targetBin.label}
                autoFocus
                style={{ flex: 1, padding: '14px', borderRadius: '10px', border: '1px solid #475569', background: '#0f172a', color: 'white', fontSize: '18px', textAlign: 'center' }}
              />
              <button onClick={handleConfirm} disabled={confirming || !scannedBin.trim()}
                style={{ padding: '14px 24px', borderRadius: '10px', border: 'none', background: '#10b981', color: 'white', fontWeight: 700, fontSize: '16px', cursor: 'pointer', opacity: confirming ? 0.5 : 1 }}>
                {confirming ? '...' : 'Confirm'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
