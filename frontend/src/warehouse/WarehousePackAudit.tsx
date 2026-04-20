import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { API_URL } from '../api';

interface AuditLine {
  sku: string;
  expectedQuantity: number;
  weightGramsPerUnit: number;
  lineWeightGrams: number;
}

interface PastAudit {
  id: string;
  verdict: string;
  actualWeightGrams: number;
  expectedWeightGrams: number;
  weightVariancePercent: string | number | null;
  createdAt: string;
}

interface AuditContext {
  packTaskId: string;
  orderId: string;
  status: string;
  expectedWeightGrams: number;
  lines: AuditLine[];
  existingAudits: PastAudit[];
}

export default function WarehousePackAudit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [ctx, setCtx] = useState<AuditContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [weight, setWeight] = useState('');
  const [length, setLength] = useState('');
  const [width, setWidth] = useState('');
  const [height, setHeight] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<any>(null);

  const load = () => {
    if (!id) return;
    setLoading(true);
    fetch(`${API_URL}/api/v1/warehouse/pack-tasks/${id}/audit-context`)
      .then(r => r.json())
      .then(res => { if (res.error) setError(res.error); else setCtx(res.data); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [id]);

  const handleSubmit = async () => {
    const w = parseInt(weight);
    if (!w || w < 1) { setError('Enter a valid weight in grams'); return; }
    setError(''); setBusy(true);
    try {
      const payload: any = { packTaskId: id, actualWeightGrams: w };
      const l = parseInt(length), wd = parseInt(width), h = parseInt(height);
      if (l) payload.actualLengthMm = l;
      if (wd) payload.actualWidthMm = wd;
      if (h) payload.actualHeightMm = h;
      if (notes.trim()) payload.notes = notes.trim();

      const res = await fetch(`${API_URL}/api/v1/pack-audits`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.error) setError(data.error);
      else setResult(data.data);
    } finally { setBusy(false); }
  };

  if (loading) return <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>Loading...</div>;
  if (!ctx) return <div style={{ padding: '1rem', color: '#ef4444' }}>{error || 'Not found'}</div>;

  const colorByVerdict: Record<string, string> = { pass: '#10b981', warning: '#f59e0b', fail: '#ef4444' };

  return (
    <div>
      <button onClick={() => navigate('/warehouse/tasks')} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '16px' }}>
        <span className="material-icons" style={{ fontSize: '20px' }}>arrow_back</span> Tasks
      </button>

      {error && <div style={{ padding: '10px', background: '#7f1d1d', borderRadius: '8px', color: '#fca5a5', marginBottom: '12px', fontSize: '13px' }}>{error}</div>}

      {result ? (
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <span className="material-icons" style={{ fontSize: '64px', color: colorByVerdict[result.verdict], display: 'block', marginBottom: '8px' }}>
            {result.verdict === 'pass' ? 'check_circle' : result.verdict === 'warning' ? 'warning' : 'error'}
          </span>
          <div style={{ fontSize: '22px', fontWeight: 700, marginBottom: '8px', textTransform: 'capitalize' }}>{result.verdict}</div>
          <div style={{ color: '#cbd5e1', fontSize: '14px', marginBottom: '16px' }}>
            {result.weightVariancePercent > 0 ? '+' : ''}{result.weightVariancePercent}% weight variance
          </div>
          <div style={{ fontSize: '13px', color: '#94a3b8' }}>
            Expected: {(result.expectedWeightGrams / 1000).toFixed(2)} kg
          </div>
          {result.issueId && (
            <div style={{ marginTop: '16px', padding: '12px', background: '#78350f', borderRadius: '8px', fontSize: '13px', color: '#fde68a' }}>
              A quality issue has been raised for follow-up.
            </div>
          )}
          <button onClick={() => navigate('/warehouse/tasks')}
            style={{ marginTop: '16px', padding: '12px 24px', borderRadius: '10px', border: 'none', background: '#3b82f6', color: 'white', fontWeight: 600, cursor: 'pointer' }}>
            Back to Tasks
          </button>
        </div>
      ) : (
        <>
          {/* Summary */}
          <div style={{ background: '#1e293b', borderRadius: '16px', padding: '20px', marginBottom: '16px' }}>
            <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Pack Audit</div>
            <div style={{ fontSize: '14px', color: '#94a3b8', marginBottom: '12px' }}>
              Pack task <code>{ctx.packTaskId.slice(0, 8)}</code> - {ctx.lines.length} line{ctx.lines.length === 1 ? '' : 's'}
            </div>
            <div style={{ fontSize: '28px', fontWeight: 700, color: '#3b82f6' }}>
              {(ctx.expectedWeightGrams / 1000).toFixed(2)} kg
            </div>
            <div style={{ fontSize: '12px', color: '#64748b' }}>expected weight</div>
          </div>

          {/* Scale input */}
          <div style={{ background: '#1e293b', borderRadius: '16px', padding: '20px', marginBottom: '12px', border: '2px solid #3b82f6' }}>
            <div style={{ fontSize: '11px', color: '#3b82f6', fontWeight: 600, marginBottom: '12px', textTransform: 'uppercase' }}>Actual Weight (grams)</div>
            <input
              type="number"
              inputMode="numeric"
              value={weight}
              onChange={e => setWeight(e.target.value)}
              autoFocus
              placeholder={String(ctx.expectedWeightGrams)}
              style={{ width: '100%', padding: '14px', borderRadius: '10px', border: '1px solid #475569', background: '#0f172a', color: 'white', fontSize: '24px', textAlign: 'center', fontWeight: 700 }}
            />
          </div>

          {/* Optional dims */}
          <div style={{ background: '#1e293b', borderRadius: '16px', padding: '20px', marginBottom: '12px' }}>
            <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, marginBottom: '12px', textTransform: 'uppercase' }}>Dimensions (mm, optional)</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
              <input type="number" inputMode="numeric" value={length} onChange={e => setLength(e.target.value)} placeholder="L" style={{ padding: '12px', borderRadius: '10px', border: '1px solid #475569', background: '#0f172a', color: 'white', fontSize: '16px', textAlign: 'center' }} />
              <input type="number" inputMode="numeric" value={width} onChange={e => setWidth(e.target.value)} placeholder="W" style={{ padding: '12px', borderRadius: '10px', border: '1px solid #475569', background: '#0f172a', color: 'white', fontSize: '16px', textAlign: 'center' }} />
              <input type="number" inputMode="numeric" value={height} onChange={e => setHeight(e.target.value)} placeholder="H" style={{ padding: '12px', borderRadius: '10px', border: '1px solid #475569', background: '#0f172a', color: 'white', fontSize: '16px', textAlign: 'center' }} />
            </div>
          </div>

          {/* Notes */}
          <div style={{ background: '#1e293b', borderRadius: '16px', padding: '20px', marginBottom: '12px' }}>
            <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, marginBottom: '8px', textTransform: 'uppercase' }}>Notes (optional)</div>
            <textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Observation, damage, etc."
              style={{ width: '100%', padding: '10px', borderRadius: '10px', border: '1px solid #475569', background: '#0f172a', color: 'white', fontSize: '13px' }}
            />
          </div>

          <button onClick={handleSubmit} disabled={busy || !weight}
            style={{ width: '100%', padding: '16px', borderRadius: '12px', border: 'none', background: '#10b981', color: 'white', fontWeight: 700, fontSize: '16px', cursor: 'pointer', opacity: busy || !weight ? 0.5 : 1 }}>
            {busy ? 'Recording...' : 'Record Audit'}
          </button>

          {ctx.existingAudits.length > 0 && (
            <div style={{ marginTop: '16px' }}>
              <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, marginBottom: '8px', textTransform: 'uppercase' }}>Previous audits for this pack</div>
              {ctx.existingAudits.map(a => (
                <div key={a.id} style={{ background: '#1e293b', borderRadius: '10px', padding: '10px 12px', marginBottom: '6px', fontSize: '13px', display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: colorByVerdict[a.verdict] || '#94a3b8', textTransform: 'capitalize', fontWeight: 600 }}>{a.verdict}</span>
                  <span style={{ color: '#94a3b8' }}>{Number(a.weightVariancePercent ?? 0).toFixed(1)}% - {(a.actualWeightGrams / 1000).toFixed(2)} kg</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
