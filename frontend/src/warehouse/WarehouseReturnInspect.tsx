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
  inspectionNotes: string | null;
  requestedDisposition: string | null;
}

interface RmaDetail {
  id: string;
  rmaNumber: string;
  status: string;
  returnReason: string;
  lines: RmaLine[];
}

const DISPOSITIONS: { v: string; l: string; hint: string }[] = [
  { v: 'restock', l: 'Restock', hint: 'Item is sellable as-new. Route to putaway.' },
  { v: 'refurb', l: 'Refurbish', hint: 'Needs repair / refurb before resale.' },
  { v: 'scrap', l: 'Scrap', hint: 'Unusable. Dispose.' },
  { v: 'recycle', l: 'Recycle', hint: 'Dispose via recycling stream.' },
  { v: 'donate', l: 'Donate', hint: 'Donate to charity partner.' },
  { v: 'rtv', l: 'Return to Vendor', hint: 'Ship back to original supplier.' },
  { v: 'customer_keeps', l: 'Customer Keeps', hint: 'Item never received; refund only.' },
];

const INSPECTION_STATUSES = [
  { v: 'pass', l: 'Pass', color: '#10b981' },
  { v: 'fail', l: 'Fail', color: '#ef4444' },
  { v: 'partial_damage', l: 'Partial Damage', color: '#f59e0b' },
];

export default function WarehouseReturnInspect() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [rma, setRma] = useState<RmaDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeLineId, setActiveLineId] = useState<string | null>(null);
  const [inspectionStatus, setInspectionStatus] = useState('pass');
  const [disposition, setDisposition] = useState('');
  const [notes, setNotes] = useState('');
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

  const openLine = (line: RmaLine) => {
    setActiveLineId(line.id);
    setInspectionStatus('pass');
    setDisposition(line.requestedDisposition ?? '');
    setNotes('');
  };

  const handleInspect = async (lineId: string) => {
    if (!disposition) { setError('Choose a disposition'); return; }
    setError(''); setBusy(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/rma-lines/${lineId}/inspect`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inspectionStatus, disposition, inspectionNotes: notes || undefined }),
      });
      const data = await res.json();
      if (data.error) setError(data.error);
      else { setActiveLineId(null); setDisposition(''); setNotes(''); load(); }
    } finally { setBusy(false); }
  };

  if (loading) return <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>Loading...</div>;
  if (!rma) return <div style={{ padding: '1rem', color: '#ef4444' }}>{error || 'Not found'}</div>;

  const linesToInspect = rma.lines.filter(l => l.receivedQuantity > 0 && l.disposition === 'pending');
  const allInspected = linesToInspect.length === 0;

  return (
    <div>
      <button onClick={() => navigate('/warehouse/tasks')} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '16px' }}>
        <span className="material-icons" style={{ fontSize: '20px' }}>arrow_back</span> Tasks
      </button>

      {error && <div style={{ padding: '10px', background: '#7f1d1d', borderRadius: '8px', color: '#fca5a5', marginBottom: '12px', fontSize: '13px' }}>{error}</div>}

      <div style={{ background: '#1e293b', borderRadius: '16px', padding: '20px', marginBottom: '16px' }}>
        <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Return Inspection</div>
        <div style={{ fontSize: '20px', fontWeight: 700, marginBottom: '4px' }}>{rma.rmaNumber}</div>
        <div style={{ fontSize: '13px', color: '#94a3b8' }}>{rma.returnReason.replace(/_/g, ' ')}</div>
      </div>

      {allInspected ? (
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <span className="material-icons" style={{ fontSize: '48px', color: '#10b981', display: 'block', marginBottom: '8px' }}>check_circle</span>
          <div style={{ fontSize: '18px', fontWeight: 600, marginBottom: '4px' }}>All lines inspected</div>
          <div style={{ color: '#94a3b8', fontSize: '13px' }}>Finance will process the refund.</div>
          <button
            onClick={() => navigate('/warehouse/tasks')}
            style={{ marginTop: '16px', padding: '12px 24px', borderRadius: '10px', border: 'none', background: '#3b82f6', color: 'white', fontWeight: 600, cursor: 'pointer' }}
          >
            Back to Tasks
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {rma.lines.map(line => {
            const needsInspection = line.receivedQuantity > 0 && line.disposition === 'pending';
            const active = activeLineId === line.id;
            return (
              <div key={line.id} style={{ background: '#1e293b', borderRadius: '12px', padding: '14px 16px', border: active ? '2px solid #3b82f6' : '1px solid #334155' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: '14px' }}>{line.sku}</div>
                    <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                      {line.receivedQuantity} received
                      {line.disposition !== 'pending' && <span style={{ color: '#10b981', marginLeft: '6px' }}>✓ {line.disposition.replace(/_/g, ' ')}</span>}
                      {line.requestedDisposition && line.disposition === 'pending' && (
                        <span style={{ marginLeft: '6px', color: '#94a3b8' }}>(customer asked: {line.requestedDisposition.replace(/_/g, ' ')})</span>
                      )}
                    </div>
                  </div>
                  {needsInspection && !active && (
                    <button
                      onClick={() => openLine(line)}
                      style={{ padding: '8px 12px', borderRadius: '8px', border: 'none', background: '#3b82f6', color: 'white', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}
                    >
                      Inspect
                    </button>
                  )}
                </div>

                {active && (
                  <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div>
                      <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, marginBottom: '6px', textTransform: 'uppercase' }}>Condition</div>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        {INSPECTION_STATUSES.map(s => (
                          <button
                            key={s.v}
                            onClick={() => setInspectionStatus(s.v)}
                            style={{
                              flex: 1, padding: '10px', borderRadius: '8px',
                              border: `2px solid ${inspectionStatus === s.v ? s.color : '#334155'}`,
                              background: inspectionStatus === s.v ? `${s.color}22` : '#0f172a',
                              color: inspectionStatus === s.v ? s.color : '#94a3b8',
                              fontWeight: 600, fontSize: '13px', cursor: 'pointer',
                            }}
                          >
                            {s.l}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, marginBottom: '6px', textTransform: 'uppercase' }}>Disposition</div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px' }}>
                        {DISPOSITIONS.map(d => (
                          <button
                            key={d.v}
                            onClick={() => setDisposition(d.v)}
                            title={d.hint}
                            style={{
                              padding: '10px', borderRadius: '8px',
                              border: `2px solid ${disposition === d.v ? '#3b82f6' : '#334155'}`,
                              background: disposition === d.v ? '#3b82f622' : '#0f172a',
                              color: disposition === d.v ? '#3b82f6' : '#cbd5e1',
                              fontWeight: 600, fontSize: '13px', cursor: 'pointer', textAlign: 'left',
                            }}
                          >
                            {d.l}
                          </button>
                        ))}
                      </div>
                      {disposition && (
                        <div style={{ marginTop: '6px', fontSize: '12px', color: '#64748b' }}>
                          {DISPOSITIONS.find(d => d.v === disposition)?.hint}
                        </div>
                      )}
                    </div>

                    <div>
                      <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, marginBottom: '6px', textTransform: 'uppercase' }}>Notes (optional)</div>
                      <textarea
                        rows={2}
                        value={notes}
                        onChange={e => setNotes(e.target.value)}
                        placeholder="Observations, damage details, etc."
                        style={{ width: '100%', padding: '10px', borderRadius: '10px', border: '1px solid #475569', background: '#0f172a', color: 'white', fontSize: '13px' }}
                      />
                    </div>

                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={() => setActiveLineId(null)}
                        disabled={busy}
                        style={{ flex: 1, padding: '12px', borderRadius: '10px', border: '1px solid #475569', background: 'transparent', color: '#94a3b8', cursor: 'pointer', fontWeight: 600 }}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleInspect(line.id)}
                        disabled={busy || !disposition}
                        style={{ flex: 2, padding: '12px', borderRadius: '10px', border: 'none', background: '#10b981', color: 'white', fontWeight: 700, fontSize: '15px', cursor: 'pointer', opacity: busy || !disposition ? 0.5 : 1 }}
                      >
                        {busy ? '...' : 'Submit'}
                      </button>
                    </div>
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
