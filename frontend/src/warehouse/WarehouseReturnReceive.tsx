import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { API_URL } from '../api';

interface RmaLine {
  id: string;
  sku: string;
  requestedQuantity: number;
  receivedQuantity: number;
  disposition: string;
  inspectionStatus: string;
}

interface RmaDetail {
  id: string;
  rmaNumber: string;
  status: string;
  returnReason: string;
  customerNotes: string | null;
  returnTrackingNumber: string | null;
  lines: RmaLine[];
}

export default function WarehouseReturnReceive() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [rma, setRma] = useState<RmaDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeLineId, setActiveLineId] = useState<string | null>(null);
  const [receiveQty, setReceiveQty] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () => {
    if (!id) return;
    setLoading(true);
    fetch(`${API_URL}/api/v1/rmas/${id}`)
      .then(r => r.json())
      .then(res => { if (res.error) setError(res.error); else setRma(res.data); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [id]);

  const handleReceive = async (lineId: string) => {
    const qty = parseInt(receiveQty);
    if (!qty || qty < 1) { setError('Enter a valid quantity'); return; }
    setError(''); setBusy(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/rma-lines/${lineId}/receive`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ receivedQuantity: qty }),
      });
      const data = await res.json();
      if (data.error) setError(data.error);
      else { setActiveLineId(null); setReceiveQty(''); load(); }
    } finally { setBusy(false); }
  };

  if (loading) return <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>Loading...</div>;
  if (!rma) return <div style={{ padding: '1rem', color: '#ef4444' }}>{error || 'Not found'}</div>;

  const linesToReceive = rma.lines.filter(l => l.receivedQuantity < l.requestedQuantity);
  const allReceived = linesToReceive.length === 0;

  return (
    <div>
      <button onClick={() => navigate('/warehouse/tasks')} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '16px' }}>
        <span className="material-icons" style={{ fontSize: '20px' }}>arrow_back</span> Tasks
      </button>

      {error && <div style={{ padding: '10px', background: '#7f1d1d', borderRadius: '8px', color: '#fca5a5', marginBottom: '12px', fontSize: '13px' }}>{error}</div>}

      {/* RMA summary */}
      <div style={{ background: '#1e293b', borderRadius: '16px', padding: '20px', marginBottom: '16px' }}>
        <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Return Receipt</div>
        <div style={{ fontSize: '20px', fontWeight: 700, marginBottom: '4px' }}>{rma.rmaNumber}</div>
        <div style={{ fontSize: '13px', color: '#94a3b8' }}>{rma.returnReason.replace(/_/g, ' ')}</div>
        {rma.returnTrackingNumber && (
          <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>Tracking: {rma.returnTrackingNumber}</div>
        )}
        {rma.customerNotes && (
          <div style={{ marginTop: '8px', padding: '8px', background: '#0f172a', borderRadius: '8px', fontSize: '12px', color: '#cbd5e1' }}>
            {rma.customerNotes}
          </div>
        )}
      </div>

      {allReceived ? (
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <span className="material-icons" style={{ fontSize: '48px', color: '#10b981', display: 'block', marginBottom: '8px' }}>check_circle</span>
          <div style={{ fontSize: '18px', fontWeight: 600, marginBottom: '4px' }}>All lines received</div>
          <div style={{ color: '#94a3b8', fontSize: '13px' }}>Ready for inspection</div>
          <button
            onClick={() => navigate(`/warehouse/tasks/return-inspect/${rma.id}`)}
            style={{ marginTop: '16px', padding: '12px 24px', borderRadius: '10px', border: 'none', background: '#3b82f6', color: 'white', fontWeight: 600, cursor: 'pointer' }}
          >
            Start Inspection
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {rma.lines.map(line => {
            const remaining = line.requestedQuantity - line.receivedQuantity;
            const done = remaining === 0;
            const active = activeLineId === line.id;
            return (
              <div key={line.id} style={{ background: '#1e293b', borderRadius: '12px', padding: '14px 16px', border: active ? '2px solid #3b82f6' : '1px solid #334155' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: '14px' }}>{line.sku}</div>
                    <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                      {line.receivedQuantity} / {line.requestedQuantity} received
                      {done && <span style={{ color: '#10b981', marginLeft: '6px' }}>✓</span>}
                    </div>
                  </div>
                  {!done && !active && (
                    <button
                      onClick={() => { setActiveLineId(line.id); setReceiveQty(String(remaining)); }}
                      style={{ padding: '8px 12px', borderRadius: '8px', border: 'none', background: '#3b82f6', color: 'white', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}
                    >
                      Receive
                    </button>
                  )}
                </div>

                {active && (
                  <div style={{ marginTop: '12px', display: 'flex', gap: '8px' }}>
                    <input
                      type="number" min={1} max={remaining}
                      value={receiveQty}
                      onChange={e => setReceiveQty(e.target.value)}
                      autoFocus
                      style={{ flex: 1, padding: '12px', borderRadius: '10px', border: '1px solid #475569', background: '#0f172a', color: 'white', fontSize: '16px', textAlign: 'center' }}
                    />
                    <button
                      onClick={() => handleReceive(line.id)}
                      disabled={busy}
                      style={{ padding: '12px 20px', borderRadius: '10px', border: 'none', background: '#10b981', color: 'white', fontWeight: 700, fontSize: '15px', cursor: 'pointer', opacity: busy ? 0.5 : 1 }}
                    >
                      {busy ? '...' : 'Confirm'}
                    </button>
                    <button
                      onClick={() => { setActiveLineId(null); setReceiveQty(''); }}
                      disabled={busy}
                      style={{ padding: '12px', borderRadius: '10px', border: '1px solid #475569', background: 'transparent', color: '#94a3b8', cursor: 'pointer' }}
                    >
                      <span className="material-icons">close</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
