import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_URL } from '../api';

/* ── Types ────────────────────────────────────────────────── */

interface SignalData {
  byCategory: { category: string; count: number }[];
  byStatus: Record<string, number>;
  recurringByCarrier: { carrierName: string; category: string; count: number }[];
  recurringByCustomer: { customerName: string; category: string; count: number }[];
  slaBreaches: number;
  noiseCount: number;
  signalCount: number;
  avgSignalScore: number;
}

interface Stats {
  new: number;
  investigating: number;
  escalated: number;
  resolved: number;
  closed: number;
}

interface Issue {
  id: string;
  issueNumber: string;
  title: string;
  severity: string;
  signalScore?: number;
  assigneeName?: string;
  createdAt: string;
  lastActivityAt?: string;
  status: string;
  category?: string;
}

/* ── Helpers ──────────────────────────────────────────────── */

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  return `${weeks}w ago`;
}

function formatDuration(ms: number): string {
  const totalMins = Math.floor(ms / 60000);
  if (totalMins < 60) return `${totalMins}m`;
  const hrs = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  if (hrs < 24) return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
  const days = Math.floor(hrs / 24);
  const remHrs = hrs % 24;
  return remHrs > 0 ? `${days}d ${remHrs}h` : `${days}d`;
}

function stuckDuration(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  return formatDuration(diff);
}

function severityColor(severity: string): string {
  switch (severity) {
    case 'high': return 'error';
    case 'medium': return 'warning';
    case 'low': return 'info';
    default: return 'secondary';
  }
}

function barColor(count: number, max: number): string {
  const ratio = count / (max || 1);
  if (ratio > 0.6) return 'var(--error)';
  if (ratio > 0.3) return 'var(--warning)';
  return 'var(--info)';
}

/* ── Main Component ───────────────────────────────────────── */

export default function VNextTriageDashboard() {
  const navigate = useNavigate();

  const [signal, setSignal] = useState<SignalData | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [attentionIssues, setAttentionIssues] = useState<Issue[]>([]);
  const [stuckIssues, setStuckIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchAll() {
      try {
        const [signalRes, statsRes, attentionRes, stuckRes] = await Promise.all([
          fetch(`${API_URL}/api/v1/issues/signal`),
          fetch(`${API_URL}/api/v1/issues/stats`),
          fetch(`${API_URL}/api/v1/issues?status=new&severity=high&sortBy=signalScore&sortOrder=desc&limit=5`),
          fetch(`${API_URL}/api/v1/issues?status=investigating&sortBy=lastActivityAt&sortOrder=asc&limit=5`),
        ]);

        if (!signalRes.ok) throw new Error('Failed to load signal data');
        if (!statsRes.ok) throw new Error('Failed to load stats');
        if (!attentionRes.ok) throw new Error('Failed to load attention issues');
        if (!stuckRes.ok) throw new Error('Failed to load stuck issues');

        const [signalJson, statsJson, attentionJson, stuckJson] = await Promise.all([
          signalRes.json(),
          statsRes.json(),
          attentionRes.json(),
          stuckRes.json(),
        ]);

        if (!cancelled) {
          setSignal(signalJson.data);
          setStats(statsJson.data);
          setAttentionIssues(attentionJson.data || []);
          setStuckIssues(stuckJson.data || []);
        }
      } catch (e: any) {
        if (!cancelled) setError(e.message || 'Failed to load dashboard data');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchAll();
    return () => { cancelled = true; };
  }, []);

  /* ── Loading State ──────────────────────────────────────── */

  if (loading) {
    return (
      <div className="vn-empty">
        <span className="material-icons" style={{ animation: 'spin 1s linear infinite' }}>refresh</span>
        <h3>Loading Triage Dashboard...</h3>
      </div>
    );
  }

  /* ── Error State ────────────────────────────────────────── */

  if (error) {
    return (
      <div className="vn-empty">
        <span className="material-icons" style={{ color: 'var(--error)' }}>error</span>
        <h3>Error</h3>
        <p>{error}</p>
      </div>
    );
  }

  /* ── Derived data ───────────────────────────────────────── */

  const openIssueCount = (stats?.new || 0) + (stats?.investigating || 0) + (stats?.escalated || 0);
  const slaBreaches = signal?.slaBreaches || 0;
  const signalCount = signal?.signalCount || 0;
  const noiseCount = signal?.noiseCount || 0;
  const totalIssues = signalCount + noiseCount;
  const signalRate = totalIssues > 0 ? Math.round((signalCount / totalIssues) * 100) : 0;
  const avgScore = signal?.avgSignalScore || 0;

  const categories = (signal?.byCategory || []).slice().sort((a, b) => b.count - a.count);
  const maxCategoryCount = categories.length > 0 ? categories[0].count : 1;

  const recurringPatterns = [
    ...(signal?.recurringByCarrier || []).map(r => ({
      type: 'Carrier' as const,
      name: r.carrierName,
      category: r.category,
      count: r.count,
    })),
    ...(signal?.recurringByCustomer || []).map(r => ({
      type: 'Customer' as const,
      name: r.customerName,
      category: r.category,
      count: r.count,
    })),
  ].sort((a, b) => b.count - a.count).slice(0, 8);

  const signalBarPercent = totalIssues > 0 ? (signalCount / totalIssues) * 100 : 50;

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  /* ── Render ─────────────────────────────────────────────── */

  return (
    <>
      {/* Page Header */}
      <div className="vn-page-header">
        <div>
          <h1>Triage Centre</h1>
          <p>{today} &mdash; Signal vs Noise Dashboard</p>
        </div>
        <div className="vn-page-actions">
          <button className="vn-btn vn-btn-outline" onClick={() => navigate('/triage/board')}>
            <span className="material-icons">view_kanban</span>
            Issue Board
          </button>
          <button className="vn-btn vn-btn-primary" onClick={() => navigate('/triage/board')}>
            <span className="material-icons">add</span>
            New Issue
          </button>
        </div>
      </div>

      {/* ── Top Stats Row ─────────────────────────────────── */}
      <div className="vn-stats">
        <div className="vn-stat" style={{ cursor: 'pointer' }} onClick={() => navigate('/triage/board')}>
          <div className="vn-stat-icon info">
            <span className="material-icons">bug_report</span>
          </div>
          <div>
            <div className="vn-stat-value">{openIssueCount}</div>
            <div className="vn-stat-label">Open Issues</div>
          </div>
        </div>

        <div className="vn-stat" style={{ cursor: 'pointer' }} onClick={() => navigate('/triage/board')}>
          <div className="vn-stat-icon error">
            <span className="material-icons">schedule</span>
          </div>
          <div>
            <div className="vn-stat-value" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              {slaBreaches}
              {slaBreaches > 0 && (
                <span className="material-icons" style={{ fontSize: 18, color: 'var(--error)' }}>priority_high</span>
              )}
            </div>
            <div className="vn-stat-label">SLA Breaches</div>
          </div>
        </div>

        <div className="vn-stat">
          <div className="vn-stat-icon success">
            <span className="material-icons">speed</span>
          </div>
          <div>
            <div className="vn-stat-value">{avgScore > 0 ? avgScore.toFixed(1) : '--'}</div>
            <div className="vn-stat-label">Avg Signal Score</div>
          </div>
        </div>

        <div className="vn-stat">
          <div className="vn-stat-icon primary">
            <span className="material-icons">filter_alt</span>
          </div>
          <div>
            <div className="vn-stat-value">{signalRate}% signal</div>
            <div className="vn-stat-label">Signal Rate</div>
          </div>
        </div>
      </div>

      {/* ── Signal vs Noise Bar ───────────────────────────── */}
      <div className="vn-card" style={{ marginBottom: 24 }}>
        <div className="vn-card-header">
          <h2>
            <span className="material-icons" style={{ fontSize: 20, verticalAlign: 'middle', marginRight: 8, color: 'var(--success)' }}>
              tune
            </span>
            Signal vs Noise
          </h2>
          <span style={{ fontSize: 13, color: 'var(--on-surface-variant)' }}>
            {totalIssues} total issues processed
          </span>
        </div>
        <div className="vn-card-body">
          {/* Stacked bar */}
          <div style={{
            display: 'flex',
            height: 36,
            borderRadius: 'var(--border-radius-sm)',
            overflow: 'hidden',
            background: 'var(--outline-variant)',
          }}>
            {signalCount > 0 && (
              <div style={{
                width: `${signalBarPercent}%`,
                background: 'var(--success)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--on-success)',
                fontSize: 13,
                fontWeight: 600,
                transition: 'width 0.5s ease',
                minWidth: signalBarPercent > 10 ? undefined : 40,
              }}>
                {signalBarPercent > 15 ? `${signalCount} signal` : signalCount}
              </div>
            )}
            {noiseCount > 0 && (
              <div style={{
                width: `${100 - signalBarPercent}%`,
                background: 'var(--outline-variant)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--on-surface-variant)',
                fontSize: 13,
                fontWeight: 500,
                transition: 'width 0.5s ease',
                minWidth: (100 - signalBarPercent) > 10 ? undefined : 40,
              }}>
                {(100 - signalBarPercent) > 15 ? `${noiseCount} noise` : noiseCount}
              </div>
            )}
          </div>

          {/* Legend */}
          <div style={{ display: 'flex', gap: 24, marginTop: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 12, height: 12, borderRadius: 2, background: 'var(--success)' }} />
              <span style={{ fontSize: 13, color: 'var(--on-surface)' }}>
                <strong>{signalCount}</strong> signal issues &mdash; actionable exceptions
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 12, height: 12, borderRadius: 2, background: 'var(--outline-variant)' }} />
              <span style={{ fontSize: 13, color: 'var(--on-surface-variant)' }}>
                <strong>{noiseCount}</strong> auto-dismissed as noise
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Two-Column Layout: Categories + Attention ─────── */}
      <div className="vn-grid-2" style={{ marginBottom: 24 }}>

        {/* Exception Category Breakdown */}
        <div className="vn-card">
          <div className="vn-card-header" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
            <h2>
              <span className="material-icons" style={{ fontSize: 20, verticalAlign: 'middle', marginRight: 8, color: 'var(--warning)' }}>
                category
              </span>
              Exception Categories
            </h2>
            <span style={{ fontSize: 12, color: 'var(--on-surface-variant)', fontWeight: 400 }}>
              What's generating the most issues
            </span>
          </div>
          <div className="vn-card-body vn-card-flush">
            {categories.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', color: 'var(--on-surface-variant)' }}>
                No category data available
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {categories.map((cat, idx) => {
                  const barWidth = Math.max((cat.count / maxCategoryCount) * 100, 4);
                  const color = barColor(cat.count, maxCategoryCount);
                  return (
                    <div
                      key={cat.category}
                      onClick={() => navigate(`/triage/board?category=${encodeURIComponent(cat.category)}`)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        padding: '12px 16px',
                        cursor: 'pointer',
                        borderBottom: idx < categories.length - 1 ? '1px solid var(--outline-variant)' : 'none',
                        transition: 'background 0.15s',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-container)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      {/* Rank */}
                      <span style={{
                        width: 24,
                        height: 24,
                        borderRadius: '50%',
                        background: idx < 3 ? 'var(--primary)' : 'var(--surface-container)',
                        color: idx < 3 ? 'var(--on-primary)' : 'var(--on-surface-variant)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 12,
                        fontWeight: 700,
                        flexShrink: 0,
                      }}>
                        {idx + 1}
                      </span>

                      {/* Category + bar */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--on-surface)', marginBottom: 4 }}>
                          {cat.category}
                        </div>
                        <div style={{
                          height: 6,
                          borderRadius: 3,
                          background: 'var(--surface-container)',
                          overflow: 'hidden',
                        }}>
                          <div style={{
                            height: '100%',
                            width: `${barWidth}%`,
                            borderRadius: 3,
                            background: color,
                            transition: 'width 0.4s ease',
                          }} />
                        </div>
                      </div>

                      {/* Count badge */}
                      <span style={{
                        padding: '2px 10px',
                        borderRadius: 12,
                        fontSize: 12,
                        fontWeight: 700,
                        background: color,
                        color: 'var(--on-error)',
                        flexShrink: 0,
                      }}>
                        {cat.count}
                      </span>

                      <span className="material-icons" style={{ fontSize: 18, color: 'var(--on-surface-variant)', flexShrink: 0 }}>
                        chevron_right
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* What Needs Attention */}
        <div className="vn-card" style={{ borderLeft: '4px solid var(--error)' }}>
          <div className="vn-card-header">
            <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="material-icons" style={{ fontSize: 20, color: 'var(--error)' }}>
                notification_important
              </span>
              Needs Attention
            </h2>
          </div>
          <div className="vn-card-body" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {attentionIssues.length === 0 ? (
              <div className="vn-alert vn-alert-success" style={{ margin: 0 }}>
                <span className="material-icons">check_circle</span>
                <div className="vn-alert-content">
                  All clear &mdash; no critical unassigned issues
                </div>
              </div>
            ) : (
              attentionIssues.map(issue => (
                <div
                  key={issue.id}
                  onClick={() => navigate(`/triage/issues/${issue.id}`)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 12px',
                    borderRadius: 'var(--border-radius-sm)',
                    border: '1px solid var(--outline-variant)',
                    cursor: 'pointer',
                    transition: 'background 0.15s, border-color 0.15s',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = 'var(--surface-container)';
                    e.currentTarget.style.borderColor = 'var(--error)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.borderColor = 'var(--outline-variant)';
                  }}
                >
                  {/* Issue number */}
                  <span style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: 'var(--primary)',
                    whiteSpace: 'nowrap',
                  }}>
                    {issue.issueNumber}
                  </span>

                  {/* Title */}
                  <div style={{
                    flex: 1,
                    fontSize: 13,
                    fontWeight: 500,
                    color: 'var(--on-surface)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {issue.title}
                  </div>

                  {/* Severity chip */}
                  <span className={`vn-chip vn-chip-${severityColor(issue.severity)}`} style={{ textTransform: 'capitalize', flexShrink: 0 }}>
                    {issue.severity}
                  </span>

                  {/* Signal score badge */}
                  {issue.signalScore != null && (
                    <span style={{
                      padding: '2px 8px',
                      borderRadius: 10,
                      fontSize: 11,
                      fontWeight: 700,
                      background: 'var(--primary)',
                      color: 'var(--on-primary)',
                      flexShrink: 0,
                    }}>
                      {issue.signalScore}
                    </span>
                  )}

                  {/* Time ago */}
                  <span style={{ fontSize: 11, color: 'var(--on-surface-variant)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                    {timeAgo(issue.createdAt)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ── Two-Column Layout: Stuck + Recurring ──────────── */}
      <div className="vn-grid-2" style={{ marginBottom: 24 }}>

        {/* Stuck Issues */}
        <div className="vn-card" style={{ borderLeft: '4px solid var(--warning)' }}>
          <div className="vn-card-header">
            <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="material-icons" style={{ fontSize: 20, color: 'var(--warning)' }}>
                hourglass_top
              </span>
              Stuck Issues
            </h2>
          </div>
          <div className="vn-card-body" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {stuckIssues.length === 0 ? (
              <div className="vn-alert vn-alert-success" style={{ margin: 0 }}>
                <span className="material-icons">check_circle</span>
                <div className="vn-alert-content">
                  No stuck issues &mdash; everything is moving
                </div>
              </div>
            ) : (
              stuckIssues.map(issue => (
                <div
                  key={issue.id}
                  onClick={() => navigate(`/triage/issues/${issue.id}`)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 12px',
                    borderRadius: 'var(--border-radius-sm)',
                    border: '1px solid var(--outline-variant)',
                    cursor: 'pointer',
                    transition: 'background 0.15s, border-color 0.15s',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = 'var(--surface-container)';
                    e.currentTarget.style.borderColor = 'var(--warning)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.borderColor = 'var(--outline-variant)';
                  }}
                >
                  {/* Issue number */}
                  <span style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: 'var(--primary)',
                    whiteSpace: 'nowrap',
                  }}>
                    {issue.issueNumber}
                  </span>

                  {/* Title */}
                  <div style={{
                    flex: 1,
                    fontSize: 13,
                    fontWeight: 500,
                    color: 'var(--on-surface)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {issue.title}
                  </div>

                  {/* Assignee */}
                  {issue.assigneeName ? (
                    <span style={{
                      fontSize: 11,
                      fontWeight: 600,
                      padding: '2px 8px',
                      borderRadius: 10,
                      background: 'var(--surface-container-high)',
                      color: 'var(--on-surface-variant)',
                      whiteSpace: 'nowrap',
                      flexShrink: 0,
                    }}>
                      {issue.assigneeName}
                    </span>
                  ) : (
                    <span style={{
                      fontSize: 11,
                      fontStyle: 'italic',
                      color: 'var(--on-surface-variant)',
                      flexShrink: 0,
                    }}>
                      Unassigned
                    </span>
                  )}

                  {/* Stuck duration */}
                  <span style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    fontSize: 11,
                    fontWeight: 600,
                    color: 'var(--warning)',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                  }}>
                    <span className="material-icons" style={{ fontSize: 14 }}>schedule</span>
                    {stuckDuration(issue.lastActivityAt || issue.createdAt)} stuck
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recurring Patterns */}
        <div className="vn-card" style={{ borderLeft: '4px solid var(--tertiary)' }}>
          <div className="vn-card-header">
            <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="material-icons" style={{ fontSize: 20, color: 'var(--tertiary)' }}>
                replay
              </span>
              Recurring Patterns
            </h2>
          </div>
          <div className="vn-card-body" style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {recurringPatterns.length === 0 ? (
              <div style={{ padding: 16, textAlign: 'center', color: 'var(--on-surface-variant)', fontSize: 13 }}>
                No recurring patterns detected
              </div>
            ) : (
              recurringPatterns.map((pattern, idx) => (
                <div
                  key={`${pattern.type}-${pattern.name}-${pattern.category}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 12px',
                    borderBottom: idx < recurringPatterns.length - 1 ? '1px solid var(--outline-variant)' : 'none',
                  }}
                >
                  {/* Type icon */}
                  <span className="material-icons" style={{
                    fontSize: 18,
                    color: 'var(--tertiary)',
                    flexShrink: 0,
                  }}>
                    {pattern.type === 'Carrier' ? 'local_shipping' : 'business'}
                  </span>

                  {/* Name + Category */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--on-surface)' }}>
                      {pattern.name}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--on-surface-variant)' }}>
                      {pattern.category}
                    </div>
                  </div>

                  {/* Count */}
                  <span style={{
                    padding: '2px 10px',
                    borderRadius: 10,
                    fontSize: 12,
                    fontWeight: 700,
                    background: 'var(--tertiary-container)',
                    color: 'var(--on-tertiary-container)',
                    flexShrink: 0,
                  }}>
                    {pattern.count} issues
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ── Status Breakdown Bar ──────────────────────────── */}
      {stats && (
        <div className="vn-card">
          <div className="vn-card-header">
            <h2>
              <span className="material-icons" style={{ fontSize: 20, verticalAlign: 'middle', marginRight: 8, color: 'var(--info)' }}>
                bar_chart
              </span>
              Issue Pipeline
            </h2>
          </div>
          <div className="vn-card-body">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {([
                { label: 'New', count: stats.new, variant: 'info' },
                { label: 'Investigating', count: stats.investigating, variant: 'warning' },
                { label: 'Escalated', count: stats.escalated, variant: 'error' },
                { label: 'Resolved', count: stats.resolved, variant: 'success' },
                { label: 'Closed', count: stats.closed, variant: 'primary' },
              ] as const).map(row => {
                const total = (stats.new + stats.investigating + stats.escalated + stats.resolved + stats.closed) || 1;
                const pct = ((row.count / total) * 100).toFixed(1);
                return (
                  <div key={row.label}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 14 }}>
                      <span style={{ fontWeight: 500, color: 'var(--on-surface)' }}>{row.label}</span>
                      <span style={{ color: 'var(--on-surface-variant)' }}>
                        {row.count} ({pct}%)
                      </span>
                    </div>
                    <div className="vn-progress">
                      <div className={`vn-progress-bar ${row.variant}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
