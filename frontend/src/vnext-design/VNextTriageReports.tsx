import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_URL } from '../api';

/* ── Helpers ──────────────────────────────────────────────── */

function fmtDuration(mins?: number | null): string {
  if (mins == null || isNaN(mins)) return '\u2014';
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function isoDate(d: Date): string {
  return d.toISOString().split('T')[0];
}

const SEVERITY_CHIP: Record<string, string> = { high: 'error', medium: 'warning', low: 'secondary' };

const BAR_COLORS = [
  'var(--primary)',
  'var(--error)',
  'var(--warning)',
  'var(--info)',
  'var(--success)',
  'var(--tertiary)',
];

/* ── Main Component ───────────────────────────────────────── */

export default function VNextTriageReports() {
  const navigate = useNavigate();

  const [dateFrom, setDateFrom] = useState(() => isoDate(new Date(Date.now() - 30 * 86400000)));
  const [dateTo, setDateTo] = useState(() => isoDate(new Date()));

  const [signal, setSignal] = useState<any>(null);
  const [stats, setStats] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');

    const params = new URLSearchParams({ dateFrom, dateTo });

    Promise.all([
      fetch(`${API_URL}/api/v1/issues/signal?${params}`).then(r => r.json()),
      fetch(`${API_URL}/api/v1/issues/stats?${params}`).then(r => r.json()),
    ])
      .then(([sig, st]) => {
        if (cancelled) return;
        if (sig.data) setSignal(sig.data);
        if (st.data) setStats(st.data);
      })
      .catch((e: any) => {
        if (!cancelled) setError(e.message || 'Failed to load report data');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [dateFrom, dateTo]);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
        <div className="loading-spinner" />
      </div>
    );
  }

  const totalAll = Object.values(stats).reduce((a, b) => a + b, 0);
  const resolvedCount = (stats.resolved || 0) + (stats.closed || 0);
  const signalCount = signal?.signalCount || 0;
  const noiseCount = signal?.noiseCount || 0;

  // Category data
  const categories: any[] = signal?.byCategory || [];
  const maxCategoryCount = categories.length > 0
    ? Math.max(...categories.map((c: any) => c._count?.id || c.count || 0))
    : 1;

  // Severity resolution data
  const bySeverity: any[] = signal?.bySeverity || [];

  // Per-assignee data
  const byAssignee: any[] = signal?.byAssignee || [];

  return (
    <>
      {/* Page Header with Date Range */}
      <div className="vn-page-header">
        <div>
          <h1>Triage Reports</h1>
          <p>Metrics and analytics for issue resolution</p>
        </div>
        <div className="vn-page-actions">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="date"
              className="vn-input"
              style={{ width: 150 }}
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
            />
            <span style={{ color: 'var(--on-surface-variant)', fontSize: 13 }}>to</span>
            <input
              type="date"
              className="vn-input"
              style={{ width: 150 }}
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
            />
          </div>
        </div>
      </div>

      {error && (
        <div className="vn-alert vn-alert-warning" style={{ marginBottom: 16 }}>
          <span className="material-icons">warning</span>
          <div className="vn-alert-content">{error}</div>
        </div>
      )}

      {/* Stats Cards */}
      <div className="vn-stats">
        <div className="vn-stat">
          <div className="vn-stat-icon primary"><span className="material-icons">confirmation_number</span></div>
          <div><div className="vn-stat-value">{totalAll}</div><div className="vn-stat-label">Total Issues</div></div>
        </div>
        <div className="vn-stat">
          <div className="vn-stat-icon success"><span className="material-icons">check_circle</span></div>
          <div><div className="vn-stat-value">{resolvedCount}</div><div className="vn-stat-label">Resolved</div></div>
        </div>
        <div className="vn-stat">
          <div className="vn-stat-icon info"><span className="material-icons">timer</span></div>
          <div><div className="vn-stat-value">{fmtDuration(signal?.avgTimeToResolution)}</div><div className="vn-stat-label">Avg Resolution</div></div>
        </div>
        <div className="vn-stat">
          <div className="vn-stat-icon error"><span className="material-icons">gpp_bad</span></div>
          <div>
            <div className="vn-stat-value">
              {signal?.slaBreachRate != null
                ? `${(signal.slaBreachRate * 100).toFixed(1)}%`
                : signal?.slaBreachCount != null
                  ? String(signal.slaBreachCount)
                  : '\u2014'}
            </div>
            <div className="vn-stat-label">SLA Breach Rate</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
        {/* Category Breakdown */}
        <div className="vn-card">
          <div className="vn-card-header"><h2>Category Breakdown</h2></div>
          <div className="vn-card-body">
            {categories.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {categories.map((cat: any, i: number) => {
                  const count = cat._count?.id || cat.count || 0;
                  return (
                    <div key={cat.category || cat.name || i}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontSize: 13 }}>{cat.category || cat.name || 'Uncategorized'}</span>
                        <span style={{ fontSize: 12, fontWeight: 600 }}>{count}</span>
                      </div>
                      <div style={{ height: 8, borderRadius: 4, background: 'var(--surface-container-high)', overflow: 'hidden' }}>
                        <div style={{
                          width: `${(count / maxCategoryCount) * 100}%`,
                          height: '100%', borderRadius: 4,
                          background: BAR_COLORS[i % BAR_COLORS.length],
                          minWidth: 4,
                        }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ textAlign: 'center', color: 'var(--on-surface-variant)', padding: 24 }}>No data</div>
            )}
          </div>
        </div>

        {/* Resolution by Severity */}
        <div className="vn-card">
          <div className="vn-card-header"><h2>Resolution by Severity</h2></div>
          <div className="vn-card-body">
            {bySeverity.length > 0 ? (
              <div className="vn-table-wrap">
                <table className="vn-table">
                  <thead>
                    <tr>
                      <th>Severity</th>
                      <th>Count</th>
                      <th>Avg Resolution Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bySeverity.map((sev: any) => (
                      <tr key={sev.severity} style={{ cursor: 'default' }}>
                        <td>
                          <span className={`vn-chip vn-chip-${SEVERITY_CHIP[sev.severity] || 'secondary'}`} style={{ textTransform: 'capitalize' }}>
                            {sev.severity}
                          </span>
                        </td>
                        <td>{sev._count?.id || sev.count || 0}</td>
                        <td>{fmtDuration(sev.avgResolution || sev._avg?.timeToResolution)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ textAlign: 'center', color: 'var(--on-surface-variant)', padding: 24 }}>No data</div>
            )}
          </div>
        </div>
      </div>

      {/* Per-Assignee Metrics */}
      <div className="vn-card" style={{ marginBottom: 20 }}>
        <div className="vn-card-header"><h2>Per-Assignee Metrics</h2></div>
        <div className="vn-card-body">
          {byAssignee.length > 0 ? (
            <div className="vn-table-wrap">
              <table className="vn-table">
                <thead>
                  <tr>
                    <th>Assignee</th>
                    <th>Issues Handled</th>
                    <th>Avg Resolution Time</th>
                  </tr>
                </thead>
                <tbody>
                  {byAssignee.map((row: any) => {
                    const name = row.assigneeName || row.assignee || 'Unassigned';
                    const count = row._count?.id || row.count || 0;
                    const avgRes = row.avgResolution || row._avg?.timeToResolution;
                    return (
                      <tr key={name} style={{ cursor: 'default' }}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{
                              width: 28, height: 28, borderRadius: '50%',
                              background: 'var(--primary)', color: 'var(--on-primary)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: 12, fontWeight: 600,
                            }}>
                              {name.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2)}
                            </div>
                            <span style={{ fontWeight: 500 }}>{name}</span>
                          </div>
                        </td>
                        <td>{count}</td>
                        <td>{fmtDuration(avgRes)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ textAlign: 'center', color: 'var(--on-surface-variant)', padding: 24 }}>No assignee data</div>
          )}
        </div>
      </div>

      {/* Signal vs Noise */}
      <div className="vn-card" style={{ marginBottom: 20 }}>
        <div className="vn-card-header"><h2>Signal vs Noise Analysis</h2></div>
        <div className="vn-card-body">
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
      </div>

      {/* Priority Breakdown */}
      {signal?.byPriority && signal.byPriority.length > 0 && (
        <div className="vn-card" style={{ marginBottom: 20 }}>
          <div className="vn-card-header"><h2>Issues by Priority</h2></div>
          <div className="vn-card-body">
            <div className="vn-table-wrap">
              <table className="vn-table">
                <thead><tr><th>Priority</th><th>Count</th><th>Distribution</th></tr></thead>
                <tbody>
                  {signal.byPriority.map((p: any) => {
                    const labels: Record<number, string> = { 1: 'P1 Critical', 2: 'P2 Urgent', 3: 'P3 Normal', 4: 'P4 Low', 5: 'P5 Trivial' };
                    const colors: Record<number, string> = { 1: 'var(--error)', 2: 'var(--warning)', 3: 'var(--info)', 4: 'var(--outline)', 5: 'var(--outline-variant)' };
                    const max = Math.max(...signal.byPriority.map((x: any) => x._count.id));
                    return (
                      <tr key={p.priority} style={{ cursor: 'default' }}>
                        <td>
                          <span style={{
                            fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4,
                            background: colors[p.priority],
                            color: p.priority <= 2 ? 'var(--on-error)' : 'var(--on-surface)',
                          }}>
                            {labels[p.priority] || `P${p.priority}`}
                          </span>
                        </td>
                        <td>{p._count.id}</td>
                        <td>
                          <div style={{
                            width: `${(p._count.id / max) * 100}%`, height: 6,
                            borderRadius: 3, background: colors[p.priority], minWidth: 4,
                          }} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Volume Over Time (placeholder) */}
      <div className="vn-card">
        <div className="vn-card-header"><h2>Volume Over Time</h2></div>
        <div className="vn-card-body" style={{ textAlign: 'center', padding: 48 }}>
          <span className="material-icons" style={{ fontSize: 48, color: 'var(--on-surface-variant)' }}>
            show_chart
          </span>
          <p style={{ color: 'var(--on-surface-variant)', marginTop: 8, fontSize: 14 }}>
            Issue volume chart &mdash; coming soon
          </p>
        </div>
      </div>
    </>
  );
}
