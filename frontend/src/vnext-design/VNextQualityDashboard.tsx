import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_URL } from '../api';

/* ── Type definitions ──────────────────────────────────────── */

interface DashboardData {
  issues: {
    total: number;
    open: number;
    critical: number;
    needsCapa: number;
    byCategory: { category: string; count: number }[];
    byPriority: { priority: string; count: number }[];
  };
  capa: {
    total: number;
    open: number;
    overdueFollowUps: number;
  };
  sop: {
    activeChecklists: number;
    overdueChecklists: number;
    recentAudits: number;
    failedAudits: number;
  };
}

interface TrendDay {
  date: string;
  total: number;
  byCategory: Record<string, number>;
  byPriority: Record<string, number>;
}

interface TrendsData {
  period: string;
  startDate: string;
  trends: TrendDay[];
}

interface DimensionSummary {
  dimensionType: string;
  dimensionId: string;
  dimensionName: string;
  totalIssues: number;
  criticalCount: number;
  damageCount: number;
  delayCount: number;
  exceptionCount: number;
  complianceCount: number;
  avgResolutionHours: number;
  lastIssueAt: string | null;
}

type Period = '7d' | '30d' | '90d';

/* ── Helpers ───────────────────────────────────────────────── */

function categoryChipClass(category: string): string {
  switch (category) {
    case 'damage': return 'vn-chip-error';
    case 'delay': return 'vn-chip-warning';
    case 'exception': return 'vn-chip-info';
    case 'compliance': return 'vn-chip-primary';
    case 'temperature': return 'vn-chip-error';
    case 'security': return 'vn-chip-warning';
    default: return 'vn-chip-secondary';
  }
}

function formatCategory(cat: string): string {
  return cat.charAt(0).toUpperCase() + cat.slice(1).replace(/_/g, ' ');
}

function formatHours(hours: number | null): string {
  if (hours === null || hours === undefined) return '--';
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  if (hours < 24) return `${hours.toFixed(1)}h`;
  return `${(hours / 24).toFixed(1)}d`;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '--';
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/* ── Component ─────────────────────────────────────────────── */

export default function VNextQualityDashboard() {
  const navigate = useNavigate();

  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [trends, setTrends] = useState<TrendsData | null>(null);
  const [topCarriers, setTopCarriers] = useState<DimensionSummary[]>([]);
  const [topLanes, setTopLanes] = useState<DimensionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [period, setPeriod] = useState<Period>('30d');

  /* Fetch dashboard + summaries on mount */
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [dashRes, carrierRes, laneRes] = await Promise.all([
          fetch(`${API_URL}/api/v1/quality/dashboard`),
          fetch(`${API_URL}/api/v1/quality/summaries?dimensionType=carrier&sortBy=totalIssues&sortOrder=desc&limit=5`),
          fetch(`${API_URL}/api/v1/quality/summaries?dimensionType=lane&sortBy=totalIssues&sortOrder=desc&limit=5`),
        ]);

        if (!dashRes.ok) throw new Error('Failed to load quality dashboard');

        const dashJson = await dashRes.json();
        const carrierJson = await carrierRes.json();
        const laneJson = await laneRes.json();

        if (!cancelled) {
          setDashboard(dashJson.data || null);
          setTopCarriers(carrierJson.data || []);
          setTopLanes(laneJson.data || []);
        }
      } catch (e: any) {
        if (!cancelled) setError(e.message || 'Failed to load data');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  /* Fetch trends when period changes */
  useEffect(() => {
    let cancelled = false;
    async function loadTrends() {
      try {
        const res = await fetch(`${API_URL}/api/v1/quality/trends?period=${period}`);
        if (res.ok) {
          const json = await res.json();
          if (!cancelled) setTrends(json.data || null);
        }
      } catch {
        // Non-critical — chart just stays empty
      }
    }
    loadTrends();
    return () => { cancelled = true; };
  }, [period]);

  /* ── Loading state ─────────────────────────────────────── */
  if (loading) {
    return (
      <div className="vn-empty">
        <span className="material-icons" style={{ animation: 'spin 1s linear infinite' }}>refresh</span>
        <h3>Loading...</h3>
      </div>
    );
  }

  /* ── Error state ───────────────────────────────────────── */
  if (error) {
    return <div className="vn-alert vn-alert-error">{error}</div>;
  }

  const d = dashboard!;

  /* ── Chart rendering (inline SVG bar chart) ────────────── */
  const renderTrendsChart = () => {
    const data = trends?.trends || [];
    if (data.length === 0) {
      return (
        <div style={{ padding: '32px', textAlign: 'center', color: 'var(--on-surface-variant)' }}>
          <span className="material-icons" style={{ fontSize: 40, display: 'block', marginBottom: 8, opacity: 0.5 }}>bar_chart</span>
          No trend data available
        </div>
      );
    }

    const maxVal = Math.max(...data.map(t => t.total), 1);
    const chartWidth = 800;
    const chartHeight = 200;
    const barPadding = 2;
    const barWidth = Math.max(4, (chartWidth / data.length) - barPadding);
    const labelInterval = Math.max(1, Math.floor(data.length / 8));

    return (
      <div style={{ overflowX: 'auto' }}>
        <svg
          viewBox={`0 0 ${chartWidth} ${chartHeight + 30}`}
          style={{ width: '100%', minWidth: 400, height: 'auto', maxHeight: 260 }}
          preserveAspectRatio="xMidYMid meet"
        >
          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map(frac => {
            const y = chartHeight - (frac * chartHeight);
            return (
              <g key={frac}>
                <line
                  x1={0} y1={y} x2={chartWidth} y2={y}
                  stroke="var(--outline-variant)" strokeWidth={0.5} strokeDasharray={frac === 0 ? '' : '4,4'}
                />
                <text x={0} y={y - 4} fontSize={10} fill="var(--on-surface-variant)">
                  {Math.round(maxVal * frac)}
                </text>
              </g>
            );
          })}

          {/* Bars */}
          {data.map((day, i) => {
            const barHeight = (day.total / maxVal) * chartHeight;
            const x = i * (barWidth + barPadding);
            const y = chartHeight - barHeight;
            return (
              <g key={day.date}>
                <rect
                  x={x}
                  y={y}
                  width={barWidth}
                  height={Math.max(barHeight, 1)}
                  rx={2}
                  fill="var(--primary)"
                  opacity={0.85}
                >
                  <title>{`${day.date}: ${day.total} issues`}</title>
                </rect>
                {i % labelInterval === 0 && (
                  <text
                    x={x + barWidth / 2}
                    y={chartHeight + 16}
                    textAnchor="middle"
                    fontSize={10}
                    fill="var(--on-surface-variant)"
                  >
                    {new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    );
  };

  /* ── Render ─────────────────────────────────────────────── */
  return (
    <>
      {/* Page Header */}
      <div className="vn-page-header">
        <div>
          <h1>Quality Centre</h1>
          <p>Quality management, CAPA tracking, and GDP compliance</p>
        </div>
        <div className="vn-page-actions">
          <button
            className="vn-btn vn-btn-outline"
            onClick={() => navigate('/quality/summaries')}
          >
            <span className="material-icons">analytics</span>
            Summaries
          </button>
          <button
            className="vn-btn vn-btn-primary"
            onClick={() => navigate('/issues')}
          >
            <span className="material-icons">bug_report</span>
            View Issues
          </button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="vn-stats">
        <div className="vn-stat" style={{ cursor: 'pointer' }} onClick={() => navigate('/issues')}>
          <div className="vn-stat-icon warning">
            <span className="material-icons">report_problem</span>
          </div>
          <div>
            <div className="vn-stat-value">{d.issues.open}</div>
            <div className="vn-stat-label">Open Issues</div>
          </div>
        </div>
        <div className="vn-stat" style={{ cursor: 'pointer' }} onClick={() => navigate('/issues')}>
          <div className="vn-stat-icon error">
            <span className="material-icons">error</span>
          </div>
          <div>
            <div className="vn-stat-value">{d.issues.critical}</div>
            <div className="vn-stat-label">Critical Issues</div>
          </div>
        </div>
        <div className="vn-stat" style={{ cursor: 'pointer' }} onClick={() => navigate('/quality/capa')}>
          <div className="vn-stat-icon primary">
            <span className="material-icons">assignment</span>
          </div>
          <div>
            <div className="vn-stat-value">{d.capa.open}</div>
            <div className="vn-stat-label">CAPA Reports Open</div>
          </div>
        </div>
        <div className="vn-stat" style={{ cursor: 'pointer' }} onClick={() => navigate('/quality/capa')}>
          <div className="vn-stat-icon error">
            <span className="material-icons">schedule</span>
          </div>
          <div>
            <div className="vn-stat-value">{d.capa.overdueFollowUps}</div>
            <div className="vn-stat-label">Overdue Follow-Ups</div>
          </div>
        </div>
      </div>

      {/* Category Breakdown Chips */}
      {d.issues.byCategory.length > 0 && (
        <div className="vn-card" style={{ padding: 20, marginTop: 24 }}>
          <h3 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 600, color: 'var(--on-surface)' }}>
            Issues by Category
          </h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {d.issues.byCategory.map(({ category, count }) => (
              <span key={category} className={`vn-chip ${categoryChipClass(category)}`}>
                {formatCategory(category)}: {count}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* SOP Compliance Summary */}
      <h3 style={{ margin: '24px 0 12px', color: 'var(--on-surface-variant)', fontSize: 14, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
        SOP Compliance
      </h3>
      <div className="vn-stats">
        <div className="vn-stat" style={{ cursor: 'pointer' }} onClick={() => navigate('/quality/sop-audits')}>
          <div className="vn-stat-icon success">
            <span className="material-icons">checklist</span>
          </div>
          <div>
            <div className="vn-stat-value">{d.sop.activeChecklists}</div>
            <div className="vn-stat-label">Active Checklists</div>
          </div>
        </div>
        <div className="vn-stat" style={{ cursor: 'pointer' }} onClick={() => navigate('/quality/sop-audits')}>
          <div className="vn-stat-icon warning">
            <span className="material-icons">pending_actions</span>
          </div>
          <div>
            <div className="vn-stat-value">{d.sop.overdueChecklists}</div>
            <div className="vn-stat-label">Overdue Checklists</div>
          </div>
        </div>
        <div className="vn-stat" style={{ cursor: 'pointer' }} onClick={() => navigate('/quality/sop-audits')}>
          <div className="vn-stat-icon info">
            <span className="material-icons">fact_check</span>
          </div>
          <div>
            <div className="vn-stat-value">{d.sop.recentAudits}</div>
            <div className="vn-stat-label">Recent Audits</div>
          </div>
        </div>
        <div className="vn-stat" style={{ cursor: 'pointer' }} onClick={() => navigate('/quality/sop-audits')}>
          <div className="vn-stat-icon error">
            <span className="material-icons">cancel</span>
          </div>
          <div>
            <div className="vn-stat-value">{d.sop.failedAudits}</div>
            <div className="vn-stat-label">Failed Audits</div>
          </div>
        </div>
      </div>

      {/* Trends Chart */}
      <div className="vn-card" style={{ padding: 0, overflow: 'hidden', marginTop: 24 }}>
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--outline-variant)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="material-icons" style={{ color: 'var(--primary)', fontSize: 20 }}>trending_up</span>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Issues Over Time</h2>
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            {(['7d', '30d', '90d'] as Period[]).map(p => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`vn-btn vn-btn-sm ${p === period ? 'vn-btn-primary' : 'vn-btn-ghost'}`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
        <div style={{ padding: '16px 20px' }}>
          {renderTrendsChart()}
        </div>
      </div>

      {/* Two side-by-side tables */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginTop: 24 }}>
        {/* Top Problem Carriers */}
        <div className="vn-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--outline-variant)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}>
            <span className="material-icons" style={{ color: 'var(--color-error)', fontSize: 20 }}>local_shipping</span>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Top Problem Carriers</h2>
          </div>
          {topCarriers.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--on-surface-variant)' }}>
              <span className="material-icons" style={{ fontSize: 40, display: 'block', marginBottom: 8, opacity: 0.5 }}>check_circle</span>
              No carrier issues found
            </div>
          ) : (
            <div className="vn-table-wrap">
              <table className="vn-table">
                <thead>
                  <tr>
                    <th>Carrier</th>
                    <th style={{ textAlign: 'right' }}>Issues</th>
                    <th style={{ textAlign: 'right' }}>Critical</th>
                    <th style={{ textAlign: 'right' }}>Avg Resolution</th>
                  </tr>
                </thead>
                <tbody>
                  {topCarriers.map(c => (
                    <tr key={c.dimensionId} onClick={() => navigate(`/carriers/${c.dimensionId}`)} style={{ cursor: 'pointer' }}>
                      <td>
                        <div className="vn-table-id">{c.dimensionName}</div>
                        <div className="vn-table-secondary">Last issue: {formatDate(c.lastIssueAt)}</div>
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>{c.totalIssues}</td>
                      <td style={{ textAlign: 'right' }}>
                        {c.criticalCount > 0 ? (
                          <span className="vn-chip vn-chip-error">{c.criticalCount}</span>
                        ) : (
                          <span style={{ color: 'var(--on-surface-variant)' }}>0</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right', color: 'var(--on-surface-variant)' }}>
                        {formatHours(c.avgResolutionHours)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Top Problem Lanes */}
        <div className="vn-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--outline-variant)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}>
            <span className="material-icons" style={{ color: 'var(--color-warning)', fontSize: 20 }}>route</span>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Top Problem Lanes</h2>
          </div>
          {topLanes.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--on-surface-variant)' }}>
              <span className="material-icons" style={{ fontSize: 40, display: 'block', marginBottom: 8, opacity: 0.5 }}>check_circle</span>
              No lane issues found
            </div>
          ) : (
            <div className="vn-table-wrap">
              <table className="vn-table">
                <thead>
                  <tr>
                    <th>Lane</th>
                    <th style={{ textAlign: 'right' }}>Issues</th>
                    <th style={{ textAlign: 'right' }}>Critical</th>
                    <th style={{ textAlign: 'right' }}>Avg Resolution</th>
                  </tr>
                </thead>
                <tbody>
                  {topLanes.map(l => (
                    <tr key={l.dimensionId} onClick={() => navigate(`/lanes/${l.dimensionId}`)} style={{ cursor: 'pointer' }}>
                      <td>
                        <div className="vn-table-id">{l.dimensionName}</div>
                        <div className="vn-table-secondary">Last issue: {formatDate(l.lastIssueAt)}</div>
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>{l.totalIssues}</td>
                      <td style={{ textAlign: 'right' }}>
                        {l.criticalCount > 0 ? (
                          <span className="vn-chip vn-chip-error">{l.criticalCount}</span>
                        ) : (
                          <span style={{ color: 'var(--on-surface-variant)' }}>0</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right', color: 'var(--on-surface-variant)' }}>
                        {formatHours(l.avgResolutionHours)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Quick Links */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16, marginTop: 24 }}>
        <div
          className="vn-card"
          style={{ padding: 20, cursor: 'pointer' }}
          onClick={() => navigate('/quality/capa')}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <span className="material-icons" style={{ fontSize: 28, color: 'var(--primary)' }}>assignment</span>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>CAPA Reports</h3>
          </div>
          <p style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--on-surface-variant)' }}>
            Corrective and Preventive Action reports for quality events.
          </p>
          <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
            <div>
              <span style={{ fontWeight: 600, fontSize: 20 }}>{d.capa.total}</span>
              <br />
              <small style={{ color: 'var(--on-surface-variant)' }}>Total</small>
            </div>
            <div>
              <span style={{ fontWeight: 600, fontSize: 20 }}>{d.capa.open}</span>
              <br />
              <small style={{ color: 'var(--on-surface-variant)' }}>Open</small>
            </div>
          </div>
          <span className="vn-btn vn-btn-secondary" style={{ width: '100%', justifyContent: 'center', textDecoration: 'none' }}>
            View CAPA Reports
          </span>
        </div>

        <div
          className="vn-card"
          style={{ padding: 20, cursor: 'pointer' }}
          onClick={() => navigate('/quality/sop-audits')}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <span className="material-icons" style={{ fontSize: 28, color: 'var(--primary)' }}>fact_check</span>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>SOP Audits</h3>
          </div>
          <p style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--on-surface-variant)' }}>
            Standard Operating Procedure checklists and audit records.
          </p>
          <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
            <div>
              <span style={{ fontWeight: 600, fontSize: 20 }}>{d.sop.recentAudits}</span>
              <br />
              <small style={{ color: 'var(--on-surface-variant)' }}>Recent</small>
            </div>
            <div>
              <span style={{ fontWeight: 600, fontSize: 20 }}>{d.sop.failedAudits}</span>
              <br />
              <small style={{ color: 'var(--on-surface-variant)' }}>Failed</small>
            </div>
          </div>
          <span className="vn-btn vn-btn-secondary" style={{ width: '100%', justifyContent: 'center', textDecoration: 'none' }}>
            View SOP Audits
          </span>
        </div>

        <div
          className="vn-card"
          style={{ padding: 20, cursor: 'pointer' }}
          onClick={() => navigate('/quality/summaries')}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <span className="material-icons" style={{ fontSize: 28, color: 'var(--primary)' }}>analytics</span>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Issue Summaries</h3>
          </div>
          <p style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--on-surface-variant)' }}>
            Aggregated quality metrics by carrier, lane, and customer.
          </p>
          <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
            <div>
              <span style={{ fontWeight: 600, fontSize: 20 }}>{d.issues.total}</span>
              <br />
              <small style={{ color: 'var(--on-surface-variant)' }}>Total Issues</small>
            </div>
            <div>
              <span style={{ fontWeight: 600, fontSize: 20 }}>{d.issues.needsCapa}</span>
              <br />
              <small style={{ color: 'var(--on-surface-variant)' }}>Needs CAPA</small>
            </div>
          </div>
          <span className="vn-btn vn-btn-secondary" style={{ width: '100%', justifyContent: 'center', textDecoration: 'none' }}>
            View Summaries
          </span>
        </div>
      </div>
    </>
  );
}
