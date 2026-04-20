import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { API_URL } from '../api';
import { useBarcodeScanner } from './useBarcodeScanner';

interface PackLine {
  id: string;
  sku: string;
  expectedQuantity: number;
  packedQuantity: number;
  status: string;
  trackableUnitId: string;
}

interface PackTask {
  id: string;
  status: string;
  orderId: string;
  packStationBin: { label: string } | null;
  packLines: PackLine[];
}

interface Carton {
  id: string;
  name: string;
  lengthMm: number;
  widthMm: number;
  heightMm: number;
  maxWeightGrams: number;
  temperatureZone: string;
}

export default function WarehousePack() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [task, setTask] = useState<PackTask | null>(null);
  const [cartons, setCartons] = useState<Carton[]>([]);
  const [selectedCartonId, setSelectedCartonId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeLineId, setActiveLineId] = useState<string | null>(null);
  const [packQty, setPackQty] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () => {
    if (!id) return;
    setLoading(true);
    fetch(`${API_URL}/api/v1/pack-tasks/${id}`)
      .then(r => r.json())
      .then(res => { if (res.error) setError(res.error); else setTask(res.data); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [id]);

  useEffect(() => {
    fetch(`${API_URL}/api/v1/carton-catalogue`)
      .then(r => r.json())
      .then(res => setCartons((res.data || []).filter((c: any) => c.active)))
      .catch(() => {});
  }, []);

  useBarcodeScanner((barcode) => {
    if (!task) return;
    const line = task.packLines.find(l => l.sku === barcode || l.sku.endsWith(barcode));
    if (line) {
      const remaining = line.expectedQuantity - line.packedQuantity;
      if (remaining <= 0) {
        setError(`${line.sku} is already fully packed.`);
        return;
      }
      setActiveLineId(line.id);
      setPackQty(String(remaining));
      setError('');
    } else {
      setError(`Scanned "${barcode}" does not match any item on this pack task.`);
    }
  });

  const handlePack = async (lineId: string) => {
    const qty = parseInt(packQty);
    if (!qty || qty < 1) { setError('Enter a valid quantity'); return; }
    setError(''); setBusy(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/pack-lines/${lineId}/complete`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packedQuantity: qty }),
      });
      const data = await res.json();
      if (data.error) setError(data.error);
      else { setActiveLineId(null); setPackQty(''); load(); }
    } finally { setBusy(false); }
  };

  if (loading) return <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>Loading...</div>;
  if (!task) return <div style={{ padding: '1rem', color: '#ef4444' }}>{error || 'Not found'}</div>;

  const linesToPack = task.packLines.filter(l => l.packedQuantity < l.expectedQuantity);
  const allDone = linesToPack.length === 0 && task.packLines.length > 0;

  return (
    <div>
      <button onClick={() => navigate('/warehouse/tasks')} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '16px' }}>
        <span className="material-icons" style={{ fontSize: '20px' }}>arrow_back</span> Tasks
      </button>

      {error && <div style={{ padding: '10px', background: '#7f1d1d', borderRadius: '8px', color: '#fca5a5', marginBottom: '12px', fontSize: '13px' }}>{error}</div>}

      <div style={{ background: '#1e293b', borderRadius: '16px', padding: '20px', marginBottom: '16px' }}>
        <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Pack Task</div>
        <div style={{ fontSize: '20px', fontWeight: 700 }}>{task.id.slice(0, 8)}</div>
        <div style={{ fontSize: '13px', color: '#94a3b8' }}>
          Station: <strong>{task.packStationBin?.label ?? 'any'}</strong> &middot; {task.packLines.length} line{task.packLines.length === 1 ? '' : 's'}
        </div>
      </div>

      <div style={{ background: '#1e293b', borderRadius: '16px', padding: '16px', marginBottom: '12px' }}>
        <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, marginBottom: '8px', textTransform: 'uppercase' }}>Carton</div>
        <select value={selectedCartonId} onChange={e => setSelectedCartonId(e.target.value)}
          style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #475569', background: '#0f172a', color: 'white', fontSize: '14px' }}>
          <option value="">Select a carton...</option>
          {cartons.map(c => (
            <option key={c.id} value={c.id}>
              {c.name} - {(c.lengthMm / 10).toFixed(0)}x{(c.widthMm / 10).toFixed(0)}x{(c.heightMm / 10).toFixed(0)}cm, max {(c.maxWeightGrams / 1000).toFixed(0)}kg{c.temperatureZone !== 'any' ? ` (${c.temperatureZone})` : ''}
            </option>
          ))}
        </select>
        {allDone && (
          <button onClick={() => navigate(`/warehouse/tasks/pack-audit/${task.id}`)}
            style={{ marginTop: 10, width: '100%', padding: '12px', borderRadius: '10px', border: 'none', background: '#3b82f6', color: 'white', fontWeight: 600, fontSize: '14px', cursor: 'pointer' }}>
            Run Pack Audit
          </button>
        )}
      </div>

      {allDone ? (
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <span className="material-icons" style={{ fontSize: '48px', color: '#10b981', display: 'block', marginBottom: '8px' }}>check_circle</span>
          <div style={{ fontSize: '18px', fontWeight: 600, marginBottom: '4px' }}>All items packed</div>
          <div style={{ color: '#94a3b8', fontSize: '13px' }}>Run a pack audit to verify weight before ship.</div>
        </div>
      ) : (
        <>
          <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, marginBottom: '8px', textTransform: 'uppercase' }}>
            Scan item to pack
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {task.packLines.map(line => {
              const remaining = line.expectedQuantity - line.packedQuantity;
              const done = remaining <= 0;
              const active = activeLineId === line.id;
              return (
                <div key={line.id} style={{ background: '#1e293b', borderRadius: '12px', padding: '14px 16px', border: active ? '2px solid #3b82f6' : '1px solid #334155' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: '14px' }}>{line.sku}</div>
                      <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                        {line.packedQuantity} / {line.expectedQuantity} packed
                        {done && <span style={{ color: '#10b981', marginLeft: 6 }}>✓</span>}
                      </div>
                    </div>
                    {!done && !active && (
                      <button onClick={() => { setActiveLineId(line.id); setPackQty(String(remaining)); }}
                        style={{ padding: '8px 12px', borderRadius: '8px', border: 'none', background: '#3b82f6', color: 'white', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}>
                        Pack
                      </button>
                    )}
                  </div>

                  {active && (
                    <div style={{ marginTop: '12px', display: 'flex', gap: '8px' }}>
                      <input type="number" inputMode="numeric" min={1} max={remaining}
                        value={packQty} onChange={e => setPackQty(e.target.value)} autoFocus data-manual-input="true"
                        style={{ flex: 1, padding: '12px', borderRadius: '10px', border: '1px solid #475569', background: '#0f172a', color: 'white', fontSize: '18px', textAlign: 'center' }}/>
                      <button onClick={() => handlePack(line.id)} disabled={busy}
                        style={{ padding: '12px 20px', borderRadius: '10px', border: 'none', background: '#10b981', color: 'white', fontWeight: 700, fontSize: '15px', cursor: 'pointer', opacity: busy ? 0.5 : 1 }}>
                        {busy ? '...' : 'Confirm'}
                      </button>
                      <button onClick={() => { setActiveLineId(null); setPackQty(''); }} disabled={busy}
                        style={{ padding: '12px', borderRadius: '10px', border: '1px solid #475569', background: 'transparent', color: '#94a3b8', cursor: 'pointer' }}>
                        <span className="material-icons">close</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
