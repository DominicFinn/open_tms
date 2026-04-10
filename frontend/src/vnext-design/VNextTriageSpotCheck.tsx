import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_URL } from '../api';

function timeAgo(d: string): string {
  const diff = Date.now() - new Date(d).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function fmtDuration(mins?: number): string {
  if (mins == null) return '—';
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

export default function VNextTriageSpotCheck() {
  const navigate = useNavigate();
  const [issues, setIssues] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [timeline, setTimeline] = useState<Record<string, any[]>>({});
  const [days, setDays] = useState(7);

  useEffect(() => {
    const from = new Date(Date.now() - days * 86400000).toISOString();
    fetch(`${API_URL}/api/v1/issues/spot-check?dateFrom=${from}&limit=50`)
      .then(r => r.json())
      .then(res => {
        if (res.data) { setIssues(res.data.issues || []); setTotal(res.data.total || 0); }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [days]);

  const toggleExpand = async (id: string) => {
    if (expandedId === id) { setExpandedId(null); return; }
    setExpandedId(id);
    if (!timeline[id]) {
      const res = await fetch(`${API_URL}/api/v1/issues/${id}/timeline`).then(r => r.json());
      if (res.data) setTimeline(prev => ({ ...prev, [id]: res.data }));
    }
  };

  const avgResolution = issues.length > 0
    ? Math.round(issues.filter((i: any) => i.timeToResolution != null).reduce((s: number, i: any) => s + (i.timeToResolution || 0), 0) / Math.max(issues.filter((i: any) => i.timeToResolution != null).length, 1))
    : undefined;
  const breachCount = issues.filter(i => i.slaBreach).length;

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}><div className="loading-spinner" /></div>;

  return (
    <>
      <div className="vn-page-header">
        <div><h1>Spot Check</h1><p>Review how resolved issues were handled</p></div>
        <div className="vn-page-actions">
          <select className="vn-filter-select" value={days} onChange={e => setDays(Number(e.target.value))}>
            <option value={1}>Last 24 hours</option>
            <option value={7}>Last 7 days</option>
            <option value={14}>Last 14 days</option>
            <option value={30}>Last 30 days</option>
          </select>
        </div>
      </div>

      <div className="vn-stats">
        <div className="vn-stat">
          <div className="vn-stat-icon success"><span className="material-icons">check_circle</span></div>
          <div><div className="vn-stat-value">{total}</div><div className="vn-stat-label">Resolved</div></div>
        </div>
        <div className="vn-stat">
          <div className="vn-stat-icon info"><span className="material-icons">timer</span></div>
          <div><div className="vn-stat-value">{fmtDuration(avgResolution)}</div><div className="vn-stat-label">Avg Resolution</div></div>
        </div>
        <div className="vn-stat">
          <div className="vn-stat-icon error"><span className="material-icons">warning</span></div>
          <div><div className="vn-stat-value">{breachCount}</div><div className="vn-stat-label">SLA Breaches</div></div>
        </div>
      </div>

      {issues.length === 0 ? (
        <div className="vn-card" style={{ padding: 48, textAlign: 'center', color: 'var(--on-surface-variant)' }}>
          <span className="material-icons" style={{ fontSize: 48, color: 'var(--success)' }}>verified</span>
          <div style={{ marginTop: 8 }}>No resolved issues with activity in this period</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {issues.map(issue => (
            <div key={issue.id} className="vn-card" style={{ padding: 16, cursor: 'pointer' }} onClick={() => toggleExpand(issue.id)}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontWeight: 600, color: 'var(--primary)', fontSize: 13 }}>{issue.issueNumber}</span>
                  <span style={{ fontSize: 13 }}>{issue.title}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 12, color: 'var(--on-surface-variant)' }}>{issue.activityCount} activities</span>
                  <span style={{ fontSize: 12, color: 'var(--on-surface-variant)' }}>{fmtDuration(issue.timeToResolution)}</span>
                  {issue.slaBreach && <span className="vn-chip vn-chip-error" style={{ fontSize: 10 }}>SLA</span>}
                  <span className="material-icons" style={{ fontSize: 18, color: 'var(--on-surface-variant)' }}>{expandedId === issue.id ? 'expand_less' : 'expand_more'}</span>
                </div>
              </div>
              {issue.resolutionNotes && <div style={{ fontSize: 12, color: 'var(--on-surface-variant)', marginTop: 6 }}>Resolution: {issue.resolutionNotes}</div>}

              {expandedId === issue.id && (
                <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--outline-variant)' }}>
                  {timeline[issue.id] ? timeline[issue.id].map((act: any) => (
                    <div key={act.id} style={{ display: 'flex', gap: 8, padding: '6px 0', fontSize: 12 }}>
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--primary)', marginTop: 5, flexShrink: 0 }} />
                      <div>
                        <strong>{act.actorName}</strong> — <span style={{ textTransform: 'capitalize' }}>{act.action.replace(/_/g, ' ')}</span>
                        {act.details?.from && <> ({act.details.from} → {act.details.to})</>}
                        <span style={{ color: 'var(--on-surface-variant)', marginLeft: 8 }}>{timeAgo(act.createdAt)}</span>
                      </div>
                    </div>
                  )) : <div className="loading-spinner" style={{ margin: '8px auto' }} />}
                  <button className="vn-btn vn-btn-outline vn-btn-sm" style={{ marginTop: 8 }} onClick={e => { e.stopPropagation(); navigate(`/triage/issues/${issue.id}`); }}>View Full Detail</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
