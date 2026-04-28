import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { API_URL } from '../api';
// Barcode scanner would be used for bin verification in production
// import { useBarcodeScanner } from './useBarcodeScanner';

interface PickLine {
  id: string;
  sku: string;
  requestedQuantity: number;
  pickedQuantity: number;
  status: string;
  walkSequence: number;
  bin: { label: string; zone: { name: string } };
}

interface PickTaskDetail {
  id: string;
  status: string;
  pickType: string;
  totalLines: number;
  completedLines: number;
  wave: { waveNumber: string } | null;
  zone: { name: string } | null;
  pickLines: PickLine[];
}

export default function WarehousePickTask() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [task, setTask] = useState<PickTaskDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [picking, setPicking] = useState(false);
  const [pickedQty, setPickedQty] = useState('');

  const loadTask = () => {
    fetch(`${API_URL}/api/v1/pick-tasks/${id}`)
      .then(r => r.json())
      .then(res => { if (res.data) setTask(res.data); else setError('Not found'); })
      .catch(() => setError('Failed to load'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadTask(); }, [id]);

  const nextLine = task?.pickLines.find(l => l.status === 'pending');

  const handlePick = async (lineId: string, qty: number) => {
    setError('');
    setPicking(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/pick-lines/${lineId}/complete`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pickedQuantity: qty }),
      });
      const data = await res.json();
      if (data.error) setError(data.error);
      else { setPickedQty(''); loadTask(); }
    } catch { setError('Failed'); }
    finally { setPicking(false); }
  };

  const handleConfirmNext = () => {
    if (!nextLine) return;
    const qty = parseInt(pickedQty) || nextLine.requestedQuantity;
    handlePick(nextLine.id, qty);
  };

  if (loading) return <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>Loading...</div>;
  if (!task) return <div style={{ padding: '1rem', color: '#ef4444' }}>{error}</div>;

  const isComplete = task.status === 'completed' || task.status === 'short_pick';
  const progress = task.totalLines > 0 ? (task.completedLines / task.totalLines) * 100 : 0;

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <button onClick={() => navigate('/warehouse/tasks')} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span className="material-icons" style={{ fontSize: '20px' }}>arrow_back</span> Tasks
        </button>
        <div style={{ fontSize: '12px', color: '#94a3b8' }}>
          {task.wave?.waveNumber}{task.zone ? ` | ${task.zone.name}` : ''}
        </div>
      </div>

      {error && <div style={{ padding: '10px', background: '#7f1d1d', borderRadius: '8px', color: '#fca5a5', marginBottom: '12px', fontSize: '13px' }}>{error}</div>}

      {/* Progress */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#94a3b8', marginBottom: '6px' }}>
          <span>Pick Progress</span>
          <span>{task.completedLines}/{task.totalLines}</span>
        </div>
        <div style={{ height: '8px', background: '#334155', borderRadius: '4px', overflow: 'hidden' }}>
          <div style={{ width: `${progress}%`, height: '100%', background: '#10b981', borderRadius: '4px', transition: 'width 0.3s' }} />
        </div>
      </div>

      {/* Current pick */}
      {!isComplete && nextLine ? (
        <div style={{ background: '#1e293b', borderRadius: '16px', padding: '20px', marginBottom: '16px', border: '2px solid #3b82f6' }}>
          <div style={{ fontSize: '11px', color: '#3b82f6', fontWeight: 600, marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Next Pick</div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
            <div>
              <div style={{ fontSize: '11px', color: '#64748b' }}>Bin</div>
              <div style={{ fontSize: '24px', fontWeight: 700, color: '#3b82f6' }}>{nextLine.bin.label}</div>
              <div style={{ fontSize: '11px', color: '#64748b' }}>{nextLine.bin.zone.name}</div>
            </div>
            <div>
              <div style={{ fontSize: '11px', color: '#64748b' }}>SKU</div>
              <div style={{ fontSize: '18px', fontWeight: 600 }}>{nextLine.sku}</div>
              <div style={{ fontSize: '14px', color: '#94a3b8' }}>Qty: <strong>{nextLine.requestedQuantity}</strong></div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type="number" min="0" value={pickedQty}
              onChange={e => setPickedQty(e.target.value)}
              placeholder={String(nextLine.requestedQuantity)}
              style={{ flex: 1, padding: '12px', borderRadius: '10px', border: '1px solid #475569', background: '#0f172a', color: 'white', fontSize: '18px', textAlign: 'center' }}
            />
            <button onClick={handleConfirmNext} disabled={picking}
              style={{ padding: '12px 24px', borderRadius: '10px', border: 'none', background: '#10b981', color: 'white', fontWeight: 700, fontSize: '16px', cursor: 'pointer', opacity: picking ? 0.5 : 1 }}>
              {picking ? '...' : 'Confirm'}
            </button>
          </div>
        </div>
      ) : isComplete ? (
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <span className="material-icons" style={{ fontSize: '48px', color: '#10b981', display: 'block', marginBottom: '8px' }}>check_circle</span>
          <div style={{ fontSize: '18px', fontWeight: 600, marginBottom: '4px' }}>Pick Complete</div>
          <div style={{ color: '#94a3b8', fontSize: '13px' }}>{task.completedLines} lines picked</div>
        </div>
      ) : null}

      {/* Lines list */}
      <div style={{ marginTop: '8px' }}>
        <div style={{ fontSize: '13px', color: '#64748b', fontWeight: 600, marginBottom: '8px' }}>All Lines</div>
        {task.pickLines.map(line => (
          <div key={line.id} style={{
            display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px',
            background: line.status === 'pending' && line.id === nextLine?.id ? '#1e3a5f' : '#0f172a',
            borderRadius: '8px', marginBottom: '4px', fontSize: '13px',
            borderLeft: line.status === 'picked' ? '3px solid #10b981' : line.status === 'short' ? '3px solid #f59e0b' : '3px solid transparent',
          }}>
            <div style={{ flex: 1 }}>
              <span style={{ fontWeight: 600 }}>{line.bin.label}</span>
              <span style={{ color: '#64748b', marginLeft: '8px' }}>{line.sku}</span>
            </div>
            <div style={{ color: line.pickedQuantity > 0 ? '#10b981' : '#64748b' }}>
              {line.pickedQuantity}/{line.requestedQuantity}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
