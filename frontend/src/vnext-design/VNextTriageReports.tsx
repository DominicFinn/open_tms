import React, { useState, useEffect } from 'react';
import { API_URL } from '../api';

function fmtDuration(mins?: number | null): string {
  if (mins == null || isNaN(mins)) return '—';
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

export default function VNextTriageReports() {
  const [signal, setSignal] = useState<any>(null);
  const [stats, setStats] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(`${API_URL}/api/v1/issues/signal`).then(r => r.json()),
      fetch(`${API_URL}/api/v1/issues/stats`).then(r => r.json()),
    ]).then(([sig, st]) => {
      if (sig.data) setSignal(sig.data);
      if (st.data) setStats(st.data);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}><div className="loading-spinner" /></div>;

  const totalAll = Object.values(stats).reduce((a, b) => a + b, 0);
  const signalCount = signal?.signalCount || 0;
  const noiseCount = signal?.noiseCount || 0;

  return (
    <>
      <div className="vn-page-header">
        <div><h1>Triage Reports</h1><p>Metrics and analytics for issue resolution</p></div>
      </div>

      {/* Overview stats */}
      <div className="vn-stats">
        <div className="vn-stat">
          <div className="vn-stat-icon primary"><span className="material-icons">confirmation_number</span></div>
          <div><div className="vn-stat-value">{totalAll}</div><div className="vn-stat-label">Total Issues</div></div>
        </div>
        <div className="vn-stat">
          <div className="vn-stat-icon success"><span className="material-icons">check_circle</span></div>
          <div><div className="vn-stat-value">{stats.resolved || 0}</div><div className="vn-stat-label">Resolved</div></div>
        </div>
        <div className="vn-stat">
          <div className="vn-stat-icon info"><span className="material-icons">timer</span></div>
          <div><div className="vn-stat-value">{fmtDuration(signal?.avgTimeToResolution)}</div><div className="vn-stat-label">Avg Resolution</div></div>
        </div>
        <div className="vn-stat">
          <div className="vn-stat-icon error"><span className="material-icons">gpp_bad</span></div>
          <div><div className="vn-stat-value">{signal?.slaBreachCount || 0}</div><div className="vn-stat-label">SLA Breaches</div></div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
        {/* Category Breakdown */}
        <div className="vn-card" style={{ padding: 20 }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Issues by Category</h3>
          {signal?.byCategory && signal.byCategory.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {signal.byCategory.map((cat: any) => {
                const maxCount = signal.byCategory[0]?._count?.id || 1;
                return (
                  <div key={cat.category || 'none'}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 13 }}>{cat.category || 'Uncategorized'}</span>
                      <span style={{ fontSize: 12, fontWeight: 600 }}>{cat._count.id}</span>
                    </div>
                    <div style={{ height: 8, borderRadius: 4, background: 'var(--surface-container-high)', overflow: 'hidden' }}>
                      <div style={{ width: `${(cat._count.id / maxCount) * 100}%`, height: '100%', borderRadius: 4, background: 'var(--primary)' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : <div style={{ textAlign: 'center', color: 'var(--on-surface-variant)', padding: 24 }}>No data</div>}
        </div>

        {/* Severity Breakdown */}
        <div className="vn-card" style={{ padding: 20 }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Issues by Severity</h3>
          {signal?.bySeverity && signal.bySeverity.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {signal.bySeverity.map((sev: any) => {
                const colors: Record<string, string> = { high: 'var(--error)', medium: 'var(--warning)', low: 'var(--info)' };
                const maxCount = Math.max(...signal.bySeverity.map((s: any) => s._count.id));
                return (
                  <div key={sev.severity}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 13, textTransform: 'capitalize' }}>{sev.severity}</span>
                      <span style={{ fontSize: 12, fontWeight: 600 }}>{sev._count.id}</span>
                    </div>
                    <div style={{ height: 8, borderRadius: 4, background: 'var(--surface-container-high)', overflow: 'hidden' }}>
                      <div style={{ width: `${(sev._count.id / maxCount) * 100}%`, height: '100%', borderRadius: 4, background: colors[sev.severity] || 'var(--outline)' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : <div style={{ textAlign: 'center', color: 'var(--on-surface-variant)', padding: 24 }}>No data</div>}
        </div>
      </div>

      {/* Signal vs Noise */}
      <div className="vn-card" style={{ padding: 20, marginBottom: 20 }}>
        <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>Signal vs Noise Analysis</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20 }}>
          <div style={{ textAlign: 'center', padding: 16, borderRadius: 'var(--border-radius-sm)', background: 'var(--success-container)' }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--on-success-container)' }}>{signalCount}</div>
            <div style={{ fontSize: 12, color: 'var(--on-success-container)' }}>Signal Issues</div>
          </div>
          <div style={{ textAlign: 'center', padding: 16, borderRadius: 'var(--border-radius-sm)', background: 'var(--surface-container-high)' }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--on-surface-variant)' }}>{noiseCount}</div>
            <div style={{ fontSize: 12, color: 'var(--on-surface-variant)' }}>Noise (Dismissed)</div>
          </div>
          <div style={{ textAlign: 'center', padding: 16, borderRadius: 'var(--border-radius-sm)', background: 'var(--info-container)' }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--on-info-container)' }}>
              {signalCount + noiseCount > 0 ? Math.round((signalCount / (signalCount + noiseCount)) * 100) : 100}%
            </div>
            <div style={{ fontSize: 12, color: 'var(--on-info-container)' }}>Signal Rate</div>
          </div>
        </div>
      </div>

      {/* Priority Breakdown */}
      {signal?.byPriority && signal.byPriority.length > 0 && (
        <div className="vn-card" style={{ padding: 20 }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Issues by Priority</h3>
          <div className="vn-table-wrap">
            <table className="vn-table">
              <thead><tr><th>Priority</th><th>Count</th><th>Distribution</th></tr></thead>
              <tbody>
                {signal.byPriority.map((p: any) => {
                  const labels: Record<number, string> = { 1: 'P1 Critical', 2: 'P2 Urgent', 3: 'P3 Normal', 4: 'P4 Low', 5: 'P5 Trivial' };
                  const colors: Record<number, string> = { 1: 'var(--error)', 2: 'var(--warning)', 3: 'var(--info)', 4: 'var(--outline)', 5: 'var(--outline-variant)' };
                  const max = Math.max(...signal.byPriority.map((x: any) => x._count.id));
                  return (
                    <tr key={p.priority}>
                      <td><span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: colors[p.priority], color: p.priority <= 2 ? 'var(--on-error)' : 'var(--on-surface)' }}>{labels[p.priority] || `P${p.priority}`}</span></td>
                      <td>{p._count.id}</td>
                      <td>
                        <div style={{ width: `${(p._count.id / max) * 100}%`, height: 6, borderRadius: 3, background: colors[p.priority], minWidth: 4 }} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
