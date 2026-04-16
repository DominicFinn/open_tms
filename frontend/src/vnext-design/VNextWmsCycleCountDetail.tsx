import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { API_URL } from '../api';

interface CycleCountLine {
  id: string;
  binId: string;
  sku: string;
  uomCode: string;
  expectedQuantity: number;
  countedQuantity: number | null;
  variance: number | null;
  status: string;
  countedAt: string | null;
  notes: string | null;
}

interface CycleCountDetail {
  id: string;
  countType: string;
  status: string;
  totalBins: number;
  countedBins: number;
  varianceCount: number;
  lines: CycleCountLine[];
  createdAt: string;
}

function statusChip(s: string): string {
  switch (s) { case 'pending': return 'vn-chip-secondary'; case 'counted': return 'vn-chip-info'; case 'adjusted': return 'vn-chip-success'; case 'variance_confirmed': return 'vn-chip-warning'; default: return 'vn-chip-secondary'; }
}

function formatStatus(s: string): string {
  return s.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

export default function VNextWmsCycleCountDetail() {
  const { id } = useParams<{ id: string }>();
  const [count, setCount] = useState<CycleCountDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [countingLineId, setCountingLineId] = useState<string | null>(null);
  const [countForm, setCountForm] = useState({ countedQuantity: '', notes: '' });
  const [counting, setCounting] = useState(false);

  const loadCount = () => {
    if (!id) return;
    fetch(`${API_URL}/api/v1/cycle-counts/${id}`)
      .then(r => r.json())
      .then(res => { if (res.error) setError(res.error); else setCount(res.data); })
      .catch(() => setError('Failed to load'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadCount(); }, [id]);

  const handleRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!countingLineId) return;
    setError('');
    setCounting(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/cycle-count-lines/${countingLineId}/record`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          countedQuantity: parseInt(countForm.countedQuantity) || 0,
          notes: countForm.notes || undefined,
        }),
      });
      const data = await res.json();
      if (data.error) setError(data.error);
      else { setCountingLineId(null); loadCount(); }
    } catch { setError('Failed to record'); }
    finally { setCounting(false); }
  };

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}><div className="vn-loading-spinner" /></div>;
  if (!count) return <div className="vn-alert vn-alert-error">{error || 'Not found'}</div>;

  const isActive = count.status !== 'completed' && count.status !== 'cancelled';

  return (
    <div>
      <div className="vn-page-header">
        <div>
          <h1>Cycle Count</h1>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <span className="vn-table-id">{count.id.slice(0, 8)}</span>
            <span className={`vn-chip ${count.status === 'completed' ? 'vn-chip-success' : count.status === 'in_progress' ? 'vn-chip-warning' : 'vn-chip-secondary'}`}>{formatStatus(count.status)}</span>
            <span className="vn-chip vn-chip-primary">{formatStatus(count.countType)}</span>
          </div>
        </div>
      </div>

      {error && <div className="vn-alert vn-alert-error" style={{ marginBottom: '1rem' }}>{error}</div>}

      {/* Stats */}
      <div className="vn-stats" style={{ marginBottom: '1.5rem' }}>
        <div className="vn-stat"><div className="vn-stat-icon vn-stat-icon-primary"><span className="material-icons">list</span></div><div className="vn-stat-value">{count.totalBins}</div><div className="vn-stat-label">Total Lines</div></div>
        <div className="vn-stat"><div className="vn-stat-icon vn-stat-icon-success"><span className="material-icons">check_circle</span></div><div className="vn-stat-value">{count.countedBins}</div><div className="vn-stat-label">Counted</div></div>
        <div className="vn-stat"><div className={`vn-stat-icon ${count.varianceCount > 0 ? 'vn-stat-icon-error' : 'vn-stat-icon-secondary'}`}><span className="material-icons">warning</span></div><div className="vn-stat-value">{count.varianceCount}</div><div className="vn-stat-label">Variances</div></div>
      </div>

      {/* Progress bar */}
      <div className="vn-card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
          <span style={{ fontWeight: 600 }}>Progress</span>
          <span style={{ color: 'var(--text-secondary)' }}>{count.countedBins}/{count.totalBins}</span>
        </div>
        <div style={{ height: '8px', background: 'var(--border)', borderRadius: '4px', overflow: 'hidden' }}>
          <div style={{ width: `${count.totalBins > 0 ? (count.countedBins / count.totalBins) * 100 : 0}%`, height: '100%', background: 'var(--color-success)', borderRadius: '4px' }} />
        </div>
      </div>

      {/* Inline count form */}
      {countingLineId && (
        <div className="vn-card" style={{ marginBottom: '1rem', borderLeft: '3px solid var(--color-primary)' }}>
          <h3 style={{ margin: '0 0 0.75rem' }}>Record Count</h3>
          <form onSubmit={handleRecord} style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div className="vn-field" style={{ flex: '0 0 120px' }}>
              <label className="vn-field-label">Counted Qty</label>
              <input className="vn-input" type="number" min="0" value={countForm.countedQuantity} onChange={e => setCountForm({ ...countForm, countedQuantity: e.target.value })} autoFocus required />
            </div>
            <div className="vn-field" style={{ flex: 1 }}>
              <label className="vn-field-label">Notes</label>
              <input className="vn-input" value={countForm.notes} onChange={e => setCountForm({ ...countForm, notes: e.target.value })} placeholder="Optional" />
            </div>
            <button type="submit" className="vn-btn vn-btn-primary" disabled={counting}>{counting ? 'Saving...' : 'Record'}</button>
            <button type="button" className="vn-btn vn-btn-outline" onClick={() => setCountingLineId(null)}>Cancel</button>
          </form>
        </div>
      )}

      {/* Lines table */}
      <div className="vn-card">
        <h3 style={{ margin: '0 0 1rem' }}>Count Lines</h3>
        <div className="vn-table-wrap">
          <table className="vn-table">
            <thead>
              <tr><th>SKU</th><th>UOM</th><th>Expected</th><th>Counted</th><th>Variance</th><th>Status</th>{isActive && <th></th>}</tr>
            </thead>
            <tbody>
              {count.lines.map(line => (
                <tr key={line.id} style={{ background: line.id === countingLineId ? 'var(--surface-secondary)' : undefined }}>
                  <td><strong>{line.sku}</strong></td>
                  <td>{line.uomCode}</td>
                  <td>{line.expectedQuantity}</td>
                  <td style={{ fontWeight: line.countedQuantity !== null ? 600 : undefined }}>{line.countedQuantity ?? '--'}</td>
                  <td>
                    {line.variance !== null && line.variance !== 0 ? (
                      <span style={{ fontWeight: 600, color: line.variance > 0 ? 'var(--color-info)' : 'var(--color-error)' }}>
                        {line.variance > 0 ? '+' : ''}{line.variance}
                      </span>
                    ) : line.variance === 0 ? (
                      <span style={{ color: 'var(--color-success)' }}>OK</span>
                    ) : '--'}
                  </td>
                  <td><span className={`vn-chip ${statusChip(line.status)}`}>{formatStatus(line.status)}</span></td>
                  {isActive && (
                    <td>
                      {line.status === 'pending' && (
                        <button className="vn-btn vn-btn-outline" style={{ fontSize: '0.8rem', padding: '0.15rem 0.5rem' }}
                          onClick={() => { setCountingLineId(line.id); setCountForm({ countedQuantity: '', notes: '' }); }}>
                          Count
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
