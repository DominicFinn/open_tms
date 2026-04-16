import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { API_URL } from '../api';

interface WaveDetail {
  id: string;
  waveNumber: string;
  status: string;
  pickStrategy: string;
  orderCount: number;
  lineCount: number;
  cutoffAt: string | null;
  createdAt: string;
  waveOrders: Array<{ orderId: string; priority: number }>;
  pickTasks: Array<{
    id: string;
    status: string;
    pickType: string;
    orderId: string | null;
    totalLines: number;
    completedLines: number;
    assignedToUserId: string | null;
  }>;
}

function statusChip(s: string): string {
  switch (s) {
    case 'planning': return 'vn-chip-secondary';
    case 'released': return 'vn-chip-info';
    case 'in_progress': return 'vn-chip-warning';
    case 'completed': return 'vn-chip-success';
    case 'cancelled': return 'vn-chip-error';
    case 'short_pick': return 'vn-chip-error';
    default: return 'vn-chip-secondary';
  }
}

function formatStatus(s: string): string {
  return s.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

export default function VNextWmsWaveDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [wave, setWave] = useState<WaveDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [releasing, setReleasing] = useState(false);
  const [releaseResult, setReleaseResult] = useState<any>(null);

  const loadWave = () => {
    if (!id) return;
    fetch(`${API_URL}/api/v1/waves/${id}`)
      .then(r => r.json())
      .then(res => { if (res.error) setError(res.error); else setWave(res.data); })
      .catch(() => setError('Failed to load wave'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadWave(); }, [id]);

  const handleRelease = async () => {
    setError('');
    setReleasing(true);
    setReleaseResult(null);
    try {
      const res = await fetch(`${API_URL}/api/v1/waves/${id}/release`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (data.error) setError(data.error);
      else { setReleaseResult(data.data); loadWave(); }
    } catch { setError('Failed to release wave'); }
    finally { setReleasing(false); }
  };

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}><div className="vn-loading-spinner" /></div>;
  if (error && !wave) return <div className="vn-alert vn-alert-error">{error}</div>;
  if (!wave) return null;

  const totalPickLines = wave.pickTasks.reduce((s, t) => s + t.totalLines, 0);
  const completedPickLines = wave.pickTasks.reduce((s, t) => s + t.completedLines, 0);

  return (
    <div>
      <div className="vn-page-header">
        <div>
          <h1>{wave.waveNumber}</h1>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <span className={`vn-chip ${statusChip(wave.status)}`}>{formatStatus(wave.status)}</span>
            <span className="vn-chip vn-chip-primary">{formatStatus(wave.pickStrategy)}</span>
            {wave.cutoffAt && (
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Cutoff: {new Date(wave.cutoffAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {wave.status === 'planning' && (
            <button className="vn-btn vn-btn-primary" onClick={handleRelease} disabled={releasing}>
              <span className="material-icons" style={{ fontSize: '18px', marginRight: '0.5rem' }}>play_arrow</span>
              {releasing ? 'Releasing...' : 'Release Wave'}
            </button>
          )}
        </div>
      </div>

      {error && <div className="vn-alert vn-alert-error" style={{ marginBottom: '1rem' }}>{error}</div>}

      {releaseResult && (
        <div style={{ marginBottom: '1rem' }}>
          <div className="vn-alert vn-alert-success">
            Wave released: {releaseResult.pickTasksCreated} pick task(s) created
          </div>
          {releaseResult.allocationFailures?.length > 0 && (
            <div className="vn-alert vn-alert-warning" style={{ marginTop: '0.5rem' }}>
              <strong>Allocation warnings:</strong>
              <ul style={{ margin: '0.5rem 0 0', paddingLeft: '1.2rem' }}>
                {releaseResult.allocationFailures.map((f: string, i: number) => <li key={i}>{f}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Stats */}
      <div className="vn-stats" style={{ marginBottom: '1.5rem' }}>
        <div className="vn-stat">
          <div className="vn-stat-icon vn-stat-icon-primary"><span className="material-icons">receipt_long</span></div>
          <div className="vn-stat-value">{wave.orderCount}</div>
          <div className="vn-stat-label">Orders</div>
        </div>
        <div className="vn-stat">
          <div className="vn-stat-icon vn-stat-icon-info"><span className="material-icons">list</span></div>
          <div className="vn-stat-value">{wave.lineCount}</div>
          <div className="vn-stat-label">Order Lines</div>
        </div>
        <div className="vn-stat">
          <div className="vn-stat-icon vn-stat-icon-warning"><span className="material-icons">assignment</span></div>
          <div className="vn-stat-value">{wave.pickTasks.length}</div>
          <div className="vn-stat-label">Pick Tasks</div>
        </div>
        {totalPickLines > 0 && (
          <div className="vn-stat">
            <div className="vn-stat-icon vn-stat-icon-success"><span className="material-icons">check_circle</span></div>
            <div className="vn-stat-value">{completedPickLines}/{totalPickLines}</div>
            <div className="vn-stat-label">Lines Picked</div>
          </div>
        )}
      </div>

      {/* Pick Tasks */}
      <div className="vn-card">
        <h3 style={{ margin: '0 0 1rem' }}>Pick Tasks</h3>
        {wave.pickTasks.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
            {wave.status === 'planning' ? 'Release the wave to generate pick tasks.' : 'No pick tasks.'}
          </div>
        ) : (
          <div className="vn-table-wrap">
            <table className="vn-table">
              <thead>
                <tr><th>Task</th><th>Type</th><th>Order</th><th>Progress</th><th>Assigned</th><th>Status</th><th></th></tr>
              </thead>
              <tbody>
                {wave.pickTasks.map(t => (
                  <tr key={t.id}>
                    <td><span className="vn-table-id">{t.id.slice(0, 8)}</span></td>
                    <td><span className="vn-chip vn-chip-primary">{formatStatus(t.pickType)}</span></td>
                    <td>{t.orderId?.slice(0, 8) ?? 'Batch'}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div style={{ flex: 1, height: '6px', background: 'var(--border)', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{ width: `${t.totalLines > 0 ? (t.completedLines / t.totalLines) * 100 : 0}%`, height: '100%', background: 'var(--color-success)', borderRadius: '3px' }} />
                        </div>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{t.completedLines}/{t.totalLines}</span>
                      </div>
                    </td>
                    <td>{t.assignedToUserId || 'Unassigned'}</td>
                    <td><span className={`vn-chip ${statusChip(t.status)}`}>{formatStatus(t.status)}</span></td>
                    <td>
                      <button className="vn-btn vn-btn-outline" style={{ fontSize: '0.8rem', padding: '0.15rem 0.5rem' }}
                        onClick={() => navigate(`/wms/picking/${t.id}`)}>
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
