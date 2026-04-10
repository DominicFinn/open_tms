import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { API_URL } from '../api';

const PRIORITY_COLORS: Record<number, string> = { 1: 'var(--error)', 2: 'var(--warning)', 3: 'var(--info)', 4: 'var(--outline)', 5: 'var(--outline-variant)' };
const PRIORITY_LABELS: Record<number, string> = { 1: 'P1 Critical', 2: 'P2 Urgent', 3: 'P3 Normal', 4: 'P4 Low', 5: 'P5 Trivial' };
const STATUS_COLORS: Record<string, string> = { new: 'info', investigating: 'warning', escalated: 'error', resolved: 'success', closed: 'secondary' };
const SEVERITY_COLORS: Record<string, string> = { high: 'error', medium: 'warning', low: 'secondary' };
const STATUSES = ['new', 'investigating', 'escalated', 'resolved', 'closed'];
const ACTION_COLORS: Record<string, string> = {
  created: 'var(--info)', status_changed: 'var(--primary)', assigned: 'var(--tertiary)',
  commented: 'var(--on-surface)', escalated: 'var(--error)', resolved: 'var(--success)',
  priority_changed: 'var(--warning)', severity_changed: 'var(--warning)', signal_updated: 'var(--tertiary)',
  noise_dismissed: 'var(--outline)',
};

function timeAgo(d: string): string {
  const diff = Date.now() - new Date(d).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function VNextTriageIssueDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [issue, setIssue] = useState<any>(null);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [context, setContext] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'overview' | 'timeline' | 'context' | 'comments'>('overview');
  const [commentText, setCommentText] = useState('');
  const [commentLoading, setCommentLoading] = useState(false);
  const [resolveModal, setResolveModal] = useState(false);
  const [resolveNotes, setResolveNotes] = useState('');

  useEffect(() => {
    if (!id) return;
    Promise.all([
      fetch(`${API_URL}/api/v1/issues/${id}`).then(r => r.json()),
      fetch(`${API_URL}/api/v1/issues/${id}/timeline`).then(r => r.json()),
      fetch(`${API_URL}/api/v1/issues/${id}/context`).then(r => r.json()),
    ]).then(([issueRes, tlRes, ctxRes]) => {
      if (issueRes.data) setIssue(issueRes.data);
      if (tlRes.data) setTimeline(tlRes.data);
      if (ctxRes.data) setContext(ctxRes.data);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [id]);

  const transition = async (status: string) => {
    await fetch(`${API_URL}/api/v1/issues/${id}/transition`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    const res = await fetch(`${API_URL}/api/v1/issues/${id}`).then(r => r.json());
    if (res.data) setIssue(res.data);
    const tlRes = await fetch(`${API_URL}/api/v1/issues/${id}/timeline`).then(r => r.json());
    if (tlRes.data) setTimeline(tlRes.data);
  };

  const addComment = async () => {
    if (!commentText.trim()) return;
    setCommentLoading(true);
    await fetch(`${API_URL}/api/v1/issues/${id}/comments`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: commentText, authorName: 'Current User' }),
    });
    setCommentText('');
    const res = await fetch(`${API_URL}/api/v1/issues/${id}`).then(r => r.json());
    if (res.data) setIssue(res.data);
    setCommentLoading(false);
  };

  const resolveIssue = async () => {
    await fetch(`${API_URL}/api/v1/issues/${id}/resolve`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resolutionNotes: resolveNotes }),
    });
    setResolveModal(false);
    setResolveNotes('');
    const res = await fetch(`${API_URL}/api/v1/issues/${id}`).then(r => r.json());
    if (res.data) setIssue(res.data);
    const tlRes = await fetch(`${API_URL}/api/v1/issues/${id}/timeline`).then(r => r.json());
    if (tlRes.data) setTimeline(tlRes.data);
  };

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}><div className="loading-spinner" /></div>;
  if (!issue) return <div className="vn-alert vn-alert-error">Issue not found</div>;

  const signalColor = issue.signalScore >= 70 ? 'var(--success)' : issue.signalScore >= 40 ? 'var(--warning)' : 'var(--error)';

  return (
    <>
      {/* Back link + header */}
      <div style={{ marginBottom: 16 }}>
        <button className="vn-btn vn-btn-ghost vn-btn-sm" onClick={() => navigate('/triage/board')}>
          <span className="material-icons" style={{ fontSize: 18 }}>arrow_back</span> Back to Board
        </button>
      </div>

      <div className="vn-detail-grid">
        {/* Main */}
        <div className="vn-detail-main">
          <div className="vn-card" style={{ padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 600, color: 'var(--on-surface-variant)' }}>{issue.issueNumber}</span>
              <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: PRIORITY_COLORS[issue.priority], color: issue.priority <= 2 ? 'var(--on-error)' : 'var(--on-surface)' }}>{PRIORITY_LABELS[issue.priority]}</span>
              <span className={`vn-chip vn-chip-${SEVERITY_COLORS[issue.severity] || 'secondary'}`}>{issue.severity}</span>
              <span className={`vn-chip vn-chip-${STATUS_COLORS[issue.status] || 'secondary'}`} style={{ textTransform: 'capitalize' }}>{issue.status}</span>
              {issue.isNoise && <span className="vn-chip vn-chip-secondary">Noise</span>}
              {issue.source !== 'manual' && <span className="vn-chip vn-chip-primary" style={{ fontSize: 10 }}>{issue.source}</span>}
            </div>
            <h1 style={{ fontSize: 22, margin: '0 0 8px' }}>{issue.title}</h1>
            {issue.description && <p style={{ color: 'var(--on-surface-variant)', lineHeight: 1.6 }}>{issue.description}</p>}
          </div>

          {/* Tabs */}
          <div className="vn-tabs">
            {(['overview', 'timeline', 'context', 'comments'] as const).map(t => (
              <button key={t} className={`vn-tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)} style={{ textTransform: 'capitalize' }}>
                {t}{t === 'comments' && issue.comments ? ` (${issue.comments.length})` : ''}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="vn-card" style={{ padding: 20 }}>
            {tab === 'overview' && (
              <div>
                <div className="vn-info-grid" style={{ marginBottom: 20 }}>
                  <div className="vn-info-item"><label>Category</label><span>{issue.category || '—'}</span></div>
                  <div className="vn-info-item"><label>Assignee</label><span>{issue.assigneeName || 'Unassigned'}</span></div>
                  <div className="vn-info-item"><label>Region</label><span>{issue.region || '—'}</span></div>
                  <div className="vn-info-item"><label>Source</label><span>{issue.source}</span></div>
                  {issue.shipmentId && <div className="vn-info-item"><label>Shipment</label><span className="vn-table-id" style={{ cursor: 'pointer' }} onClick={() => navigate(`/shipments/${issue.shipmentId}`)}>{issue.shipmentId.slice(0, 8)}...</span></div>}
                  {issue.orderId && <div className="vn-info-item"><label>Order</label><span className="vn-table-id" style={{ cursor: 'pointer' }} onClick={() => navigate(`/orders/${issue.orderId}`)}>{issue.orderId.slice(0, 8)}...</span></div>}
                  {issue.resolvedBy && <div className="vn-info-item"><label>Resolved By</label><span>{issue.resolvedBy}</span></div>}
                  {issue.resolutionNotes && <div className="vn-info-item" style={{ gridColumn: 'span 2' }}><label>Resolution</label><span>{issue.resolutionNotes}</span></div>}
                </div>
                {/* Signal Score */}
                <div style={{ padding: 16, background: 'var(--surface-container)', borderRadius: 'var(--border-radius-sm)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontWeight: 600, fontSize: 13 }}>Signal Confidence</span>
                    <span style={{ fontWeight: 700, color: signalColor }}>{issue.signalScore}/100</span>
                  </div>
                  <div style={{ height: 8, borderRadius: 4, background: 'var(--outline-variant)', overflow: 'hidden' }}>
                    <div style={{ width: `${issue.signalScore}%`, height: '100%', borderRadius: 4, background: signalColor, transition: 'width 0.3s' }} />
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--on-surface-variant)', marginTop: 4 }}>{issue.correlatedEvents} corroborating event{issue.correlatedEvents !== 1 ? 's' : ''}</div>
                </div>
              </div>
            )}

            {tab === 'timeline' && (
              <div>
                {timeline.length > 0 ? timeline.map((act: any) => (
                  <div key={act.id} style={{ display: 'flex', gap: 12, padding: '12px 0', borderBottom: '1px solid var(--outline-variant)' }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: ACTION_COLORS[act.action] || 'var(--outline)', marginTop: 6, flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontWeight: 600, fontSize: 13 }}>{act.actorName}</span>
                        <span style={{ fontSize: 11, color: 'var(--on-surface-variant)' }}>{timeAgo(act.createdAt)}</span>
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--on-surface-variant)', marginTop: 2 }}>
                        <span style={{ textTransform: 'capitalize' }}>{act.action.replace(/_/g, ' ')}</span>
                        {act.details?.from && <> from <strong>{act.details.from}</strong> to <strong>{act.details.to}</strong></>}
                        {act.details?.comment && <> — "{act.details.comment.slice(0, 80)}{act.details.comment.length > 80 ? '...' : ''}"</>}
                        {act.details?.newScore !== undefined && <> — signal score: <strong>{act.details.newScore}</strong></>}
                      </div>
                    </div>
                  </div>
                )) : (
                  <div style={{ textAlign: 'center', padding: 32, color: 'var(--on-surface-variant)' }}>No activity yet</div>
                )}
              </div>
            )}

            {tab === 'context' && (
              <div>
                {context?.shipment && (
                  <div style={{ marginBottom: 20 }}>
                    <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Shipment</h3>
                    <div className="vn-info-grid">
                      <div className="vn-info-item"><label>Reference</label><span>{context.shipment.reference}</span></div>
                      <div className="vn-info-item"><label>Status</label><span>{context.shipment.status}</span></div>
                    </div>
                  </div>
                )}
                {context?.sensorReadings && context.sensorReadings.length > 0 && (
                  <div style={{ marginBottom: 20 }}>
                    <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
                      <span className="material-icons" style={{ fontSize: 16, verticalAlign: 'middle', marginRight: 4, color: 'var(--tertiary)' }}>sensors</span>
                      Sensor Data ({context.sensorReadings.length} readings)
                    </h3>
                    <div className="vn-table-wrap">
                      <table className="vn-table">
                        <thead><tr><th>Time</th><th>Temp</th><th>Humidity</th><th>Battery</th><th>Alert</th></tr></thead>
                        <tbody>
                          {context.sensorReadings.slice(0, 20).map((r: any) => (
                            <tr key={r.id} style={{ background: r.isAlert ? 'var(--error-container)' : undefined }}>
                              <td style={{ fontSize: 12 }}>{new Date(r.eventTime).toLocaleString()}</td>
                              <td>{r.temperature != null ? `${r.temperature}°` : '—'}</td>
                              <td>{r.humidity != null ? `${r.humidity}%` : '—'}</td>
                              <td>{r.batteryLevel != null ? `${r.batteryLevel}%` : '—'}</td>
                              <td>{r.isAlert ? <span className="vn-chip vn-chip-error" style={{ fontSize: 10 }}>{r.alertType}</span> : '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
                {context?.deviceEvents && context.deviceEvents.length > 0 && (
                  <div>
                    <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Device Events ({context.deviceEvents.length})</h3>
                    {context.deviceEvents.slice(0, 10).map((ev: any) => (
                      <div key={ev.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--outline-variant)', fontSize: 13 }}>
                        <span className={`vn-chip vn-chip-${ev.category === 'warning' ? 'warning' : 'info'}`} style={{ fontSize: 10, marginRight: 8 }}>{ev.eventType}</span>
                        {ev.message || ev.eventType} — {new Date(ev.startTime).toLocaleString()}
                      </div>
                    ))}
                  </div>
                )}
                {!context?.shipment && !context?.sensorReadings?.length && !context?.deviceEvents?.length && (
                  <div style={{ textAlign: 'center', padding: 32, color: 'var(--on-surface-variant)' }}>No context data available</div>
                )}
              </div>
            )}

            {tab === 'comments' && (
              <div>
                {issue.comments && issue.comments.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
                    {issue.comments.map((c: any) => (
                      <div key={c.id} style={{ padding: 12, background: 'var(--surface-container)', borderRadius: 'var(--border-radius-sm)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span style={{ fontWeight: 600, fontSize: 13 }}>{c.authorName}</span>
                          <span style={{ fontSize: 11, color: 'var(--on-surface-variant)' }}>{timeAgo(c.createdAt)}</span>
                        </div>
                        <div style={{ fontSize: 13, lineHeight: 1.5 }}>{c.body}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: 16, color: 'var(--on-surface-variant)', marginBottom: 16 }}>No comments yet</div>
                )}
                <div style={{ display: 'flex', gap: 8 }}>
                  <input className="vn-input" style={{ flex: 1 }} placeholder="Add a comment..." value={commentText} onChange={e => setCommentText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addComment(); }} />
                  <button className="vn-btn vn-btn-primary vn-btn-sm" onClick={addComment} disabled={!commentText.trim() || commentLoading}>{commentLoading ? '...' : 'Send'}</button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="vn-detail-sidebar">
          <div className="vn-card" style={{ padding: 16 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Status</h3>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
              {STATUSES.map(s => (
                <button key={s} className={`vn-btn vn-btn-sm ${s === issue.status ? `vn-btn-primary` : 'vn-btn-outline'}`}
                  onClick={() => s !== issue.status && transition(s)} style={{ textTransform: 'capitalize', fontSize: 11 }}>{s}</button>
              ))}
            </div>

            <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Priority</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16 }}>
              <span style={{ fontSize: 12, fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: PRIORITY_COLORS[issue.priority], color: issue.priority <= 2 ? 'var(--on-error)' : 'var(--on-surface)' }}>{PRIORITY_LABELS[issue.priority]}</span>
            </div>

            <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Signal Score</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <div style={{ flex: 1, height: 6, borderRadius: 3, background: 'var(--outline-variant)', overflow: 'hidden' }}>
                <div style={{ width: `${issue.signalScore}%`, height: '100%', borderRadius: 3, background: signalColor }} />
              </div>
              <span style={{ fontWeight: 600, fontSize: 12, color: signalColor }}>{issue.signalScore}</span>
            </div>

            {issue.category && <><h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Category</h3><p style={{ fontSize: 13, marginBottom: 16, color: 'var(--on-surface-variant)' }}>{issue.category}</p></>}

            <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Assignee</h3>
            <p style={{ fontSize: 13, marginBottom: 16, color: 'var(--on-surface-variant)' }}>{issue.assigneeName || 'Unassigned'}</p>

            {issue.slaDeadline && (
              <>
                <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>SLA Deadline</h3>
                <p style={{ fontSize: 13, marginBottom: 16, color: issue.slaBreach ? 'var(--error)' : 'var(--on-surface-variant)', fontWeight: issue.slaBreach ? 600 : 400 }}>
                  {new Date(issue.slaDeadline).toLocaleString()}{issue.slaBreach ? ' — BREACHED' : ''}
                </p>
              </>
            )}

            <div style={{ fontSize: 11, color: 'var(--on-surface-variant)', marginTop: 8 }}>
              <div>Created {new Date(issue.createdAt).toLocaleString()}</div>
              {issue.resolvedAt && <div>Resolved {new Date(issue.resolvedAt).toLocaleString()}</div>}
              {issue.timeToResolution != null && <div>Resolution time: {issue.timeToResolution}m</div>}
            </div>

            {/* Actions */}
            <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {issue.status !== 'resolved' && issue.status !== 'closed' && (
                <button className="vn-btn vn-btn-success vn-btn-sm" onClick={() => setResolveModal(true)} style={{ width: '100%' }}>
                  <span className="material-icons" style={{ fontSize: 16 }}>check_circle</span> Resolve
                </button>
              )}
              <button className="vn-btn vn-btn-outline vn-btn-sm" style={{ width: '100%' }}>
                <span className="material-icons" style={{ fontSize: 16 }}>summarize</span> Generate Report
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Resolve Modal */}
      {resolveModal && (
        <div className="vn-modal-backdrop" onClick={() => setResolveModal(false)}>
          <div className="vn-modal" style={{ maxWidth: 460 }} onClick={e => e.stopPropagation()}>
            <div className="vn-modal-header">
              <h2 style={{ fontSize: 18, margin: 0 }}>Resolve Issue</h2>
              <button className="vn-btn-icon" onClick={() => setResolveModal(false)}><span className="material-icons">close</span></button>
            </div>
            <div className="vn-modal-body">
              <div className="vn-field">
                <label className="vn-field-label">Resolution Notes</label>
                <textarea className="vn-input" rows={4} value={resolveNotes} onChange={e => setResolveNotes(e.target.value)} placeholder="How was this issue resolved?" />
              </div>
            </div>
            <div className="vn-modal-footer">
              <button className="vn-btn vn-btn-outline" onClick={() => setResolveModal(false)}>Cancel</button>
              <button className="vn-btn vn-btn-success" onClick={resolveIssue}>Resolve</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
