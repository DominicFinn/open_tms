import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { API_URL } from '../api';
import { useBarcodeScanner } from './useBarcodeScanner';

interface ReceivingLine {
  id: string;
  sku: string;
  expectedQuantity: number;
  receivedQuantity: number;
  damagedQuantity: number;
  inspectionStatus: string;
  uomCode: string;
}

interface ReceivingTask {
  id: string;
  status: string;
  receivingType: string;
  crossDock: boolean;
  dockBin: { label: string } | null;
  lines: ReceivingLine[];
}

export default function WarehouseReceive() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [task, setTask] = useState<ReceivingTask | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeLineId, setActiveLineId] = useState<string | null>(null);
  const [receiveQty, setReceiveQty] = useState('');
  const [damagedQty, setDamagedQty] = useState('');
  const [busy, setBusy] = useState(false);
  const [blindScan, setBlindScan] = useState(false);
  const [blindSku, setBlindSku] = useState('');

  const load = () => {
    if (!id) return;
    setLoading(true);
    fetch(`${API_URL}/api/v1/receiving/tasks/${id}`)
      .then(r => r.json())
      .then(res => { if (res.error) setError(res.error); else setTask(res.data); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [id]);

  // Barcode scanner: match scan against expected SKUs
  useBarcodeScanner((barcode) => {
    if (!task) return;
    const line = task.lines.find(l => l.sku === barcode || l.sku.endsWith(barcode));
    if (line) {
      const remaining = line.expectedQuantity - line.receivedQuantity;
      setActiveLineId(line.id);
      setReceiveQty(String(remaining > 0 ? remaining : 1));
      setDamagedQty('');
    } else if (task.receivingType === 'blind') {
      setBlindSku(barcode);
      setBlindScan(true);
      setReceiveQty('1');
    } else {
      setError(`Scanned "${barcode}" does not match any expected SKU on this receipt.`);
    }
  });

  const handleReceive = async (lineId: string | null) => {
    const qty = parseInt(receiveQty);
    if (!qty || qty < 1) { setError('Enter a valid quantity'); return; }
    setError(''); setBusy(true);
    try {
      const body: any = { receivedQuantity: qty };
      if (lineId) body.lineId = lineId;
      if (blindSku) body.sku = blindSku;
      if (damagedQty && parseInt(damagedQty) > 0) body.damagedQuantity = parseInt(damagedQty);

      const res = await fetch(`${API_URL}/api/v1/receiving/tasks/${id}/lines`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.error) setError(data.error);
      else {
        setActiveLineId(null);
        setBlindScan(false); setBlindSku('');
        setReceiveQty(''); setDamagedQty('');
        load();
      }
    } finally { setBusy(false); }
  };

  const handleInspect = async (lineId: string, status: 'pass' | 'fail' | 'quarantine') => {
    setBusy(true);
    try {
      await fetch(`${API_URL}/api/v1/receiving/lines/${lineId}/inspect`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inspectionStatus: status }),
      });
      load();
    } finally { setBusy(false); }
  };

  const handleComplete = async () => {
    if (!confirm('Complete this receipt? Any expected lines with zero received will be flagged.')) return;
    setBusy(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/receiving/tasks/${id}/complete`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (data.error) setError(data.error);
      else navigate('/warehouse/tasks');
    } finally { setBusy(false); }
  };

  if (loading) return <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>Loading...</div>;
  if (!task) return <div style={{ padding: '1rem', color: '#ef4444' }}>{error || 'Not found'}</div>;

  const linesToReceive = task.lines.filter(l => l.receivedQuantity < l.expectedQuantity);
  const allDone = linesToReceive.length === 0 && task.lines.length > 0;

  return (
    <div>
      <button onClick={() => navigate('/warehouse/tasks')} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '16px' }}>
        <span className="material-icons" style={{ fontSize: '20px' }}>arrow_back</span> Tasks
      </button>

      {error && <div style={{ padding: '10px', background: '#7f1d1d', borderRadius: '8px', color: '#fca5a5', marginBottom: '12px', fontSize: '13px' }}>{error}</div>}

      <div style={{ background: '#1e293b', borderRadius: '16px', padding: '20px', marginBottom: '16px' }}>
        <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Receiving {task.receivingType === 'blind' ? '(blind)' : '(ASN)'} {task.crossDock && '- cross-dock'}
        </div>
        <div style={{ fontSize: '20px', fontWeight: 700 }}>{task.id.slice(0, 8)}</div>
        <div style={{ fontSize: '13px', color: '#94a3b8' }}>
          Dock: <strong>{task.dockBin?.label ?? 'unassigned'}</strong>
        </div>
      </div>

      {blindScan && (
        <div style={{ background: '#1e293b', borderRadius: '16px', padding: '20px', marginBottom: '12px', border: '2px solid #f59e0b' }}>
          <div style={{ fontSize: '11px', color: '#f59e0b', fontWeight: 600, marginBottom: '12px', textTransform: 'uppercase' }}>New SKU (blind receipt)</div>
          <div style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px' }}>{blindSku}</div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type="number" inputMode="numeric" min={1} value={receiveQty} autoFocus
              onChange={e => setReceiveQty(e.target.value)}
              data-manual-input="true"
              style={{ flex: 1, padding: '12px', borderRadius: '10px', border: '1px solid #475569', background: '#0f172a', color: 'white', fontSize: '18px', textAlign: 'center' }}
            />
            <button onClick={() => handleReceive(null)} disabled={busy}
              style={{ padding: '12px 20px', borderRadius: '10px', border: 'none', background: '#10b981', color: 'white', fontWeight: 700, fontSize: '15px', cursor: 'pointer', opacity: busy ? 0.5 : 1 }}>
              {busy ? '...' : 'Confirm'}
            </button>
            <button onClick={() => { setBlindScan(false); setBlindSku(''); }} disabled={busy}
              style={{ padding: '12px', borderRadius: '10px', border: '1px solid #475569', background: 'transparent', color: '#94a3b8', cursor: 'pointer' }}>
              <span className="material-icons">close</span>
            </button>
          </div>
        </div>
      )}

      {allDone ? (
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <span className="material-icons" style={{ fontSize: '48px', color: '#10b981', display: 'block', marginBottom: '8px' }}>check_circle</span>
          <div style={{ fontSize: '18px', fontWeight: 600, marginBottom: '4px' }}>All lines received</div>
          <button onClick={handleComplete} disabled={busy}
            style={{ marginTop: '16px', padding: '12px 24px', borderRadius: '10px', border: 'none', background: '#3b82f6', color: 'white', fontWeight: 600, cursor: 'pointer' }}>
            {busy ? 'Completing...' : 'Complete Receipt'}
          </button>
        </div>
      ) : (
        <>
          <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, marginBottom: '8px', textTransform: 'uppercase' }}>
            Scan SKU to receive{task.receivingType === 'blind' ? ' - new SKUs accepted' : ''}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {task.lines.map(line => {
              const remaining = line.expectedQuantity - line.receivedQuantity;
              const done = remaining <= 0;
              const active = activeLineId === line.id;
              return (
                <div key={line.id} style={{ background: '#1e293b', borderRadius: '12px', padding: '14px 16px', border: active ? '2px solid #3b82f6' : '1px solid #334155' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: '14px' }}>{line.sku}</div>
                      <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                        {line.receivedQuantity} / {line.expectedQuantity} {line.uomCode}
                        {line.damagedQuantity > 0 && <span style={{ color: '#f59e0b', marginLeft: 6 }}>({line.damagedQuantity} damaged)</span>}
                        {done && <span style={{ color: '#10b981', marginLeft: 6 }}>✓</span>}
                      </div>
                    </div>
                    {!done && !active && (
                      <button
                        onClick={() => { setActiveLineId(line.id); setReceiveQty(String(remaining)); setDamagedQty(''); }}
                        style={{ padding: '8px 12px', borderRadius: '8px', border: 'none', background: '#3b82f6', color: 'white', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}>
                        Receive
                      </button>
                    )}
                  </div>

                  {active && (
                    <div style={{ marginTop: '12px' }}>
                      <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '11px', color: '#64748b', marginBottom: 4 }}>Received</div>
                          <input type="number" inputMode="numeric" min={0} max={remaining} value={receiveQty}
                            onChange={e => setReceiveQty(e.target.value)} autoFocus data-manual-input="true"
                            style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #475569', background: '#0f172a', color: 'white', fontSize: '18px', textAlign: 'center' }}/>
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '11px', color: '#64748b', marginBottom: 4 }}>Damaged</div>
                          <input type="number" inputMode="numeric" min={0} value={damagedQty}
                            onChange={e => setDamagedQty(e.target.value)} data-manual-input="true"
                            style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #475569', background: '#0f172a', color: 'white', fontSize: '18px', textAlign: 'center' }}/>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button onClick={() => handleReceive(line.id)} disabled={busy}
                          style={{ flex: 2, padding: '12px', borderRadius: '10px', border: 'none', background: '#10b981', color: 'white', fontWeight: 700, fontSize: '15px', cursor: 'pointer', opacity: busy ? 0.5 : 1 }}>
                          {busy ? '...' : 'Confirm'}
                        </button>
                        <button onClick={() => { setActiveLineId(null); setReceiveQty(''); setDamagedQty(''); }} disabled={busy}
                          style={{ flex: 1, padding: '12px', borderRadius: '10px', border: '1px solid #475569', background: 'transparent', color: '#94a3b8', cursor: 'pointer', fontWeight: 600 }}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {done && line.inspectionStatus === 'pending' && (
                    <div style={{ marginTop: '8px', display: 'flex', gap: '6px' }}>
                      {(['pass', 'fail', 'quarantine'] as const).map(s => (
                        <button key={s} onClick={() => handleInspect(line.id, s)} disabled={busy}
                          style={{
                            flex: 1, padding: '8px', borderRadius: '8px',
                            border: `1px solid ${s === 'pass' ? '#10b981' : s === 'fail' ? '#ef4444' : '#f59e0b'}`,
                            background: 'transparent',
                            color: s === 'pass' ? '#10b981' : s === 'fail' ? '#ef4444' : '#f59e0b',
                            fontWeight: 600, fontSize: '12px', cursor: 'pointer', textTransform: 'capitalize',
                          }}>
                          {s}
                        </button>
                      ))}
                    </div>
                  )}
                  {done && line.inspectionStatus !== 'pending' && (
                    <div style={{ marginTop: '6px', fontSize: '11px', color: '#94a3b8' }}>
                      Inspection: <span style={{ textTransform: 'capitalize', fontWeight: 600, color:
                        line.inspectionStatus === 'pass' ? '#10b981' :
                        line.inspectionStatus === 'fail' ? '#ef4444' : '#f59e0b' }}>
                        {line.inspectionStatus}
                      </span>
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
