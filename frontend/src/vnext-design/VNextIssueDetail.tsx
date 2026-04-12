import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { API_URL } from '../api';

// ─── Helpers ────────────────────────────────────────────────────────────────

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function getInitials(name: string | null): string {
  if (!name) return '?';
  return name.split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

function eventDescription(evt: any): string {
  const t = evt.eventType || '';
  const p = evt.payload || {};
  if (t === 'issue.created') return 'Issue created';
  if (t === 'issue.status_changed') return `Status changed from ${p.previousStatus} to ${p.newStatus}`;
  if (t === 'issue.assigned') return `Assigned to ${p.assigneeName || p.assigneeId || 'someone'}`;
  if (t === 'issue.escalated') return `Escalated to ${p.escalatedTo || 'someone'}`;
  if (t === 'issue.resolved') return 'Issue resolved';
  if (t === 'issue.closed') return 'Issue closed';
  if (t === 'issue.reopened') return 'Issue reopened';
  if (t === 'issue.snoozed') return `Snoozed until ${p.snoozedUntil ? new Date(p.snoozedUntil).toLocaleString() : 'later'}`;
  if (t === 'issue.unsnoozed') return 'Snooze cleared';
  if (t === 'issue.needs_capa_marked') return p.needsCapa ? 'Marked as needs CAPA' : 'CAPA requirement cleared';
  if (t === 'issue.label_added') return 'Label added';
  if (t === 'issue.label_removed') return 'Label removed';
  if (t === 'issue.updated') return `Updated: ${(p.changes || []).join(', ')}`;
  return t.replace('issue.', '').replace(/_/g, ' ');
}

// ─── Types ──────────────────────────────────────────────────────────────────

interface IssueDetail {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  category: string;
  sourceEntityType: string | null;
  sourceEntityId: string | null;
  sourceEventId: string | null;
  assigneeId: string | null;
  assigneeName: string | null;
  escalatedTo: string | null;
  escalatedAt: string | null;
  resolvedAt: string | null;
  resolvedBy: string | null;
  resolution: string | null;
  snoozedUntil: string | null;
  snoozedBy: string | null;
  snoozedReason: string | null;
  needsCapa: boolean;
  closedAt: string | null;
  closedBy: string | null;
  createdAt: string;
  updatedAt: string;
  labelAssignments?: Array<{ label: { id: string; name: string; color: string } }>;
  capaReports?: any[];
  slaEvaluations?: any[];
  commentCount?: number;
}

// ─── Source Entity Sidebar ──────────────────────────────────────────────────

function SourceEntityCard({ entityType, entityId }: { entityType: string | null; entityId: string | null }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!entityType || !entityId) { setLoading(false); return; }
    const url = entityType === 'shipment' ? `${API_URL}/api/v1/shipments/${entityId}` : entityType === 'order' ? `${API_URL}/api/v1/orders/${entityId}` : null;
    if (!url) { setLoading(false); return; }
    fetch(url).then(r => r.json()).then(json => setData(json.data)).catch(() => {}).finally(() => setLoading(false));
  }, [entityType, entityId]);

  if (!entityType || !entityId) return <div className="vn-card"><div className="vn-card-body" style={{ padding: 16, color: 'var(--on-surface-variant)', fontSize: 13 }}>No linked entity</div></div>;
  if (loading) return <div className="vn-card"><div className="vn-card-body" style={{ padding: 16 }}><div className="loading-spinner" /></div></div>;
  if (!data) return <div className="vn-card"><div className="vn-card-body" style={{ padding: 16, color: 'var(--on-surface-variant)', fontSize: 13 }}>Entity not found</div></div>;

  if (entityType === 'shipment') {
    const driver = data.loads?.[0]?.driver;
    return (
      <div className="vn-card">
        <div className="vn-card-header" style={{ padding: '12px 16px' }}><h3 style={{ margin: 0, fontSize: 14 }}><span className="material-icons" style={{ fontSize: 16, verticalAlign: 'middle', marginRight: 4 }}>local_shipping</span>Shipment</h3></div>
        <div className="vn-card-body" style={{ padding: '8px 16px 16px', fontSize: 13 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontWeight: 600 }}>{data.reference || data.id?.slice(0, 8)}</span>
            <span className={`vn-chip vn-chip-${data.status === 'delivered' ? 'success' : data.status === 'in_transit' ? 'warning' : 'info'}`} style={{ fontSize: 11 }}>{data.status}</span>
          </div>
          {data.origin && <div style={{ marginBottom: 4 }}><span className="material-icons" style={{ fontSize: 13, color: 'var(--color-success)', verticalAlign: 'middle' }}>trip_origin</span> {data.origin.name || data.origin.city}</div>}
          {data.destination && <div style={{ marginBottom: 4 }}><span className="material-icons" style={{ fontSize: 13, color: 'var(--color-error)', verticalAlign: 'middle' }}>place</span> {data.destination.name || data.destination.city}</div>}
          {data.carrier && <div style={{ marginBottom: 4 }}><span className="material-icons" style={{ fontSize: 13, verticalAlign: 'middle' }}>business</span> {data.carrier.name}</div>}
          {driver && (
            <div style={{ marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
              <span className="material-icons" style={{ fontSize: 13, verticalAlign: 'middle' }}>person</span>
              {driver.name}
              {driver.phone && <span style={{ color: 'var(--primary)', marginLeft: 4 }}>{driver.phone}</span>}
            </div>
          )}
          {!driver && <div style={{ fontSize: 12, color: 'var(--color-warning)', marginBottom: 4 }}><span className="material-icons" style={{ fontSize: 13, verticalAlign: 'middle' }}>warning</span> No driver assigned</div>}
          <Link to={`/shipments/${entityId}`} style={{ color: 'var(--primary)', fontSize: 12, textDecoration: 'none' }}>View Shipment &rarr;</Link>
        </div>
      </div>
    );
  }

  // Order
  return (
    <div className="vn-card">
      <div className="vn-card-header" style={{ padding: '12px 16px' }}><h3 style={{ margin: 0, fontSize: 14 }}><span className="material-icons" style={{ fontSize: 16, verticalAlign: 'middle', marginRight: 4 }}>receipt_long</span>Order</h3></div>
      <div className="vn-card-body" style={{ padding: '8px 16px 16px', fontSize: 13 }}>
        <div style={{ fontWeight: 600, marginBottom: 4 }}>{data.reference || data.id?.slice(0, 8)}</div>
        <div style={{ marginBottom: 4 }}>Status: <span className="vn-chip vn-chip-info" style={{ fontSize: 11 }}>{data.status}</span></div>
        {data.customer && <div style={{ marginBottom: 4 }}>Customer: {data.customer.name}</div>}
        <Link to={`/orders/${entityId}`} style={{ color: 'var(--primary)', fontSize: 12, textDecoration: 'none' }}>View Order &rarr;</Link>
      </div>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

function IssueReportSection({ issueId }: { issueId: string }) {
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    fetch(`${API_URL}/api/v1/issues/${issueId}/report`)
      .then(r => r.json())
      .then(json => { if (json.data) setReport(json.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [issueId]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/issues/${issueId}/report`, { method: 'POST' });
      const json = await res.json();
      if (json.data) {
        // Re-fetch to get file info
        const docRes = await fetch(`${API_URL}/api/v1/issues/${issueId}/report`);
        const docJson = await docRes.json();
        if (docJson.data) setReport(docJson.data);
      }
    } catch { /* ignore */ }
    setGenerating(false);
  };

  if (loading) return <div className="loading-spinner" />;

  if (report) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span className="material-icons" style={{ fontSize: 32, color: 'var(--color-error)' }}>picture_as_pdf</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 13 }}>{report.fileName}</div>
          <div style={{ fontSize: 11, color: 'var(--on-surface-variant)' }}>Generated {new Date(report.createdAt).toLocaleString()}</div>
        </div>
        <a href={`${API_URL}/api/v1/documents/${report.id}/download`} className="vn-btn vn-btn-primary" style={{ textDecoration: 'none', fontSize: 12 }}>
          <span className="material-icons" style={{ fontSize: 16 }}>download</span> Download
        </a>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <span style={{ fontSize: 13, color: 'var(--on-surface-variant)' }}>No closure report generated yet.</span>
      <button className="vn-btn vn-btn-primary" onClick={handleGenerate} disabled={generating} style={{ fontSize: 12 }}>
        <span className="material-icons" style={{ fontSize: 16 }}>description</span>
        {generating ? 'Generating...' : 'Generate Report'}
      </button>
    </div>
  );
}

export default function VNextIssueDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [issue, setIssue] = useState<IssueDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'activity' | 'details' | 'resolution'>('activity');

  // Activity
  const [activity, setActivity] = useState<any[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);

  // Comments
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Labels
  const [allLabels, setAllLabels] = useState<any[]>([]);
  const [showLabelPicker, setShowLabelPicker] = useState(false);

  // Edit states
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [editingDesc, setEditingDesc] = useState(false);
  const [descDraft, setDescDraft] = useState('');

  // Snooze
  const [showSnooze, setShowSnooze] = useState(false);
  const [snoozeDate, setSnoozeDate] = useState('');

  // Assign
  const [showAssign, setShowAssign] = useState(false);
  const [assignName, setAssignName] = useState('');

  const loadIssue = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/v1/issues/${id}`);
      const json = await res.json();
      if (json.data) setIssue(json.data);
      else setError('Issue not found');
    } catch { setError('Failed to load issue'); }
    setLoading(false);
  }, [id]);

  const loadActivity = useCallback(async () => {
    setActivityLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/issues/${id}/activity`);
      const json = await res.json();
      setActivity(json.data || []);
    } catch { /* ignore */ }
    setActivityLoading(false);
  }, [id]);

  useEffect(() => {
    loadIssue();
    loadActivity();
    fetch(`${API_URL}/api/v1/issue-labels`).then(r => r.json()).then(j => setAllLabels(j.data || [])).catch(() => {});
  }, [loadIssue, loadActivity]);

  // ─── Actions ──────────────────────────────────────────────────────────────

  const doAction = async (path: string, body?: any) => {
    await fetch(`${API_URL}/api/v1/issues/${id}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    loadIssue();
    loadActivity();
  };

  const doUpdate = async (data: any) => {
    await fetch(`${API_URL}/api/v1/issues/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    loadIssue();
    loadActivity();
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) return;
    setSubmitting(true);
    await fetch(`${API_URL}/api/v1/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entityType: 'issue', entityId: id, body: newComment }),
    });
    setNewComment('');
    setSubmitting(false);
    loadActivity();
  };

  const handleAddLabel = async (labelId: string) => {
    await fetch(`${API_URL}/api/v1/issues/${id}/labels`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ labelId }),
    });
    setShowLabelPicker(false);
    loadIssue();
  };

  const handleRemoveLabel = async (labelId: string) => {
    await fetch(`${API_URL}/api/v1/issues/${id}/labels/${labelId}`, { method: 'DELETE' });
    loadIssue();
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 64 }}><div className="loading-spinner" /></div>;
  if (error || !issue) return <div className="vn-alert vn-alert-error">{error || 'Issue not found'}</div>;

  const labels = (issue.labelAssignments || []).map((a: any) => a.label);
  const isSnoozed = issue.snoozedUntil && new Date(issue.snoozedUntil) > new Date();
  const statusMap: Record<string, string> = { open: 'info', in_progress: 'warning', resolved: 'success', closed: 'secondary' };
  const priorityMap: Record<string, string> = { critical: 'error', high: 'error', medium: 'warning', low: 'secondary' };

  return (
    <>
      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        <button className="vn-btn" onClick={() => navigate('/issues')} style={{ marginBottom: 12 }}>
          <span className="material-icons" style={{ fontSize: 18 }}>arrow_back</span> Back to Issues
        </button>

        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
          {/* Title */}
          {editingTitle ? (
            <input className="vn-input" value={titleDraft} onChange={e => setTitleDraft(e.target.value)} autoFocus
              onBlur={() => { if (titleDraft.trim() && titleDraft !== issue.title) doUpdate({ title: titleDraft }); setEditingTitle(false); }}
              onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
              style={{ fontSize: 22, fontWeight: 700, flex: 1, minWidth: 300 }} />
          ) : (
            <h1 style={{ margin: 0, cursor: 'pointer', flex: 1 }} onClick={() => { setTitleDraft(issue.title); setEditingTitle(true); }}>{issue.title}</h1>
          )}

          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <span className={`vn-chip vn-chip-${priorityMap[issue.priority] || 'info'}`} style={{ textTransform: 'capitalize' }}>{issue.priority}</span>
            <span className={`vn-chip vn-chip-${statusMap[issue.status] || 'info'}`} style={{ textTransform: 'capitalize' }}>{issue.status.replace('_', ' ')}</span>
            <span className="vn-chip" style={{ textTransform: 'capitalize' }}>{issue.category}</span>
            {issue.needsCapa && <span className="vn-chip vn-chip-warning"><span className="material-icons" style={{ fontSize: 14, verticalAlign: 'middle' }}>assignment_late</span> Needs CAPA</span>}
            {isSnoozed && <span className="vn-chip"><span className="material-icons" style={{ fontSize: 14, verticalAlign: 'middle' }}>alarm</span> Snoozed</span>}
          </div>
        </div>

        {/* Labels */}
        <div style={{ display: 'flex', gap: 6, marginTop: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {labels.map((l: any) => (
            <span key={l.id} style={{ fontSize: 12, padding: '2px 8px', borderRadius: 10, background: l.color, color: '#fff', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
              {l.name}
              <span style={{ cursor: 'pointer', fontSize: 14 }} onClick={() => handleRemoveLabel(l.id)}>&times;</span>
            </span>
          ))}
          <div style={{ position: 'relative' }}>
            <button className="vn-btn" style={{ fontSize: 12, padding: '2px 8px' }} onClick={() => setShowLabelPicker(!showLabelPicker)}>+ Label</button>
            {showLabelPicker && (
              <div style={{ position: 'absolute', top: '100%', left: 0, zIndex: 10, background: 'var(--surface)', border: '1px solid var(--outline-variant)', borderRadius: 8, padding: 8, minWidth: 160, boxShadow: 'var(--modal-shadow)' }}>
                {allLabels.filter(l => !labels.find((el: any) => el.id === l.id)).map((l: any) => (
                  <div key={l.id} style={{ padding: '6px 8px', cursor: 'pointer', borderRadius: 4, display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}
                    onClick={() => handleAddLabel(l.id)}
                    onMouseOver={e => (e.currentTarget.style.background = 'var(--surface-container)')}
                    onMouseOut={e => (e.currentTarget.style.background = 'transparent')}>
                    <span style={{ width: 12, height: 12, borderRadius: '50%', background: l.color, flexShrink: 0 }} />
                    {l.name}
                  </div>
                ))}
                {allLabels.filter(l => !labels.find((el: any) => el.id === l.id)).length === 0 && <div style={{ fontSize: 12, color: 'var(--on-surface-variant)', padding: 4 }}>No more labels</div>}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Action Bar */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {issue.status === 'open' && <button className="vn-btn vn-btn-primary" onClick={() => doAction('/status', { status: 'in_progress' })}><span className="material-icons" style={{ fontSize: 16 }}>play_arrow</span> Start Working</button>}
        {(issue.status === 'open' || issue.status === 'in_progress') && <button className="vn-btn vn-btn-success" onClick={() => { const r = prompt('Resolution notes (optional):'); doAction('/status', { status: 'resolved', resolution: r || undefined }); }}><span className="material-icons" style={{ fontSize: 16 }}>check</span> Resolve</button>}
        {(issue.status === 'open' || issue.status === 'in_progress' || issue.status === 'resolved') && <button className="vn-btn" onClick={() => doAction('/close')}><span className="material-icons" style={{ fontSize: 16 }}>cancel</span> Close</button>}
        {(issue.status === 'resolved' || issue.status === 'closed') && <button className="vn-btn" onClick={() => doAction('/reopen')}><span className="material-icons" style={{ fontSize: 16 }}>refresh</span> Reopen</button>}

        <button className="vn-btn" onClick={() => setShowAssign(!showAssign)}><span className="material-icons" style={{ fontSize: 16 }}>person_add</span> Assign</button>
        <button className="vn-btn" onClick={() => { const to = prompt('Escalate to:'); const reason = prompt('Reason:'); if (to) doAction('/escalate', { escalatedTo: to, reason }); }}><span className="material-icons" style={{ fontSize: 16 }}>arrow_upward</span> Escalate</button>

        {!isSnoozed ? (
          <button className="vn-btn" onClick={() => setShowSnooze(!showSnooze)}><span className="material-icons" style={{ fontSize: 16 }}>alarm</span> Snooze</button>
        ) : (
          <button className="vn-btn" onClick={() => doAction('/unsnooze')}><span className="material-icons" style={{ fontSize: 16 }}>alarm_off</span> Unsnooze</button>
        )}

        <button className={`vn-btn ${issue.needsCapa ? 'vn-btn-warning' : ''}`} onClick={() => doAction('/needs-capa', { needsCapa: !issue.needsCapa })}>
          <span className="material-icons" style={{ fontSize: 16 }}>assignment_late</span> {issue.needsCapa ? 'Clear CAPA' : 'Needs CAPA'}
        </button>
      </div>

      {/* Assign popover */}
      {showAssign && (
        <div className="vn-card" style={{ padding: 12, marginBottom: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
          <input className="vn-input" placeholder="Assignee name" value={assignName} onChange={e => setAssignName(e.target.value)} style={{ flex: 1 }} />
          <button className="vn-btn vn-btn-primary" onClick={() => { if (assignName.trim()) { doAction('/assign', { assigneeId: assignName.toLowerCase().replace(/\s/g, '.'), assigneeName: assignName }); setShowAssign(false); setAssignName(''); } }}>Assign</button>
          <button className="vn-btn" onClick={() => setShowAssign(false)}>Cancel</button>
        </div>
      )}

      {/* Snooze popover */}
      {showSnooze && (
        <div className="vn-card" style={{ padding: 12, marginBottom: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
          <input type="datetime-local" className="vn-input" value={snoozeDate} onChange={e => setSnoozeDate(e.target.value)} />
          <button className="vn-btn vn-btn-primary" onClick={() => { if (snoozeDate) { doAction('/snooze', { until: new Date(snoozeDate).toISOString() }); setShowSnooze(false); setSnoozeDate(''); } }}>Snooze</button>
          <button className="vn-btn" onClick={() => setShowSnooze(false)}>Cancel</button>
        </div>
      )}

      {/* Main + Sidebar Grid */}
      <div className="vn-detail-grid">
        {/* Main Panel */}
        <div className="vn-detail-main">
          {/* Tabs */}
          <div className="vn-tabs" style={{ marginBottom: 16 }}>
            <button className={`vn-tab ${activeTab === 'activity' ? 'active' : ''}`} onClick={() => setActiveTab('activity')}>Activity</button>
            <button className={`vn-tab ${activeTab === 'details' ? 'active' : ''}`} onClick={() => setActiveTab('details')}>Details</button>
            {(issue.status === 'resolved' || issue.status === 'closed') && (
              <button className={`vn-tab ${activeTab === 'resolution' ? 'active' : ''}`} onClick={() => setActiveTab('resolution')}>Resolution</button>
            )}
          </div>

          {/* Activity Tab */}
          {activeTab === 'activity' && (
            <div className="vn-card">
              <div className="vn-card-body">
                {activityLoading ? <div className="loading-spinner" /> : activity.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 24, color: 'var(--on-surface-variant)' }}>No activity yet</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                    {activity.map((item, idx) => (
                      item.type === 'comment' ? (
                        <div key={item.id} style={{ display: 'flex', gap: 12, padding: '12px 0', borderBottom: idx < activity.length - 1 ? '1px solid var(--outline-variant)' : 'none' }}>
                          <div style={{
                            width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            background: item.authorType === 'agent' ? 'var(--color-info)' : 'var(--primary)', color: '#fff', fontSize: 12, fontWeight: 600, flexShrink: 0
                          }}>
                            {item.authorType === 'agent' ? <span className="material-icons" style={{ fontSize: 16 }}>smart_toy</span> : getInitials(item.authorName)}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                              <span style={{ fontWeight: 600, fontSize: 13 }}>{item.authorName}</span>
                              <span style={{ fontSize: 11, color: 'var(--on-surface-variant)' }}>{new Date(item.timestamp).toLocaleString()}</span>
                            </div>
                            <p style={{ fontSize: 13, lineHeight: 1.5, margin: 0 }}>{item.body}</p>
                          </div>
                        </div>
                      ) : (
                        <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: idx < activity.length - 1 ? '1px solid var(--outline-variant)' : 'none', fontSize: 12, color: 'var(--on-surface-variant)' }}>
                          <span className="material-icons" style={{ fontSize: 16 }}>info</span>
                          <span>{eventDescription(item)}</span>
                          <span style={{ marginLeft: 'auto', fontSize: 11 }}>{new Date(item.timestamp).toLocaleString()}</span>
                        </div>
                      )
                    ))}
                  </div>
                )}
                {/* Add comment form */}
                <div style={{ display: 'flex', gap: 8, marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--outline-variant)' }}>
                  <textarea className="vn-input" placeholder="Add a comment..." value={newComment} onChange={e => setNewComment(e.target.value)} rows={2} style={{ flex: 1, resize: 'vertical' }} />
                  <button className="vn-btn vn-btn-primary" onClick={handleAddComment} disabled={submitting || !newComment.trim()} style={{ alignSelf: 'flex-end' }}>
                    {submitting ? '...' : 'Post'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Details Tab */}
          {activeTab === 'details' && (
            <div className="vn-card">
              <div className="vn-card-body">
                <div className="vn-form-grid">
                  <div className="vn-field">
                    <label className="vn-field-label">Description</label>
                    {editingDesc ? (
                      <div style={{ display: 'flex', gap: 8 }}>
                        <textarea className="vn-input" value={descDraft} onChange={e => setDescDraft(e.target.value)} rows={4} style={{ flex: 1 }} />
                        <button className="vn-btn vn-btn-primary" onClick={() => { doUpdate({ description: descDraft }); setEditingDesc(false); }}>Save</button>
                        <button className="vn-btn" onClick={() => setEditingDesc(false)}>Cancel</button>
                      </div>
                    ) : (
                      <div onClick={() => { setDescDraft(issue.description || ''); setEditingDesc(true); }} style={{ cursor: 'pointer', minHeight: 40, padding: 8, border: '1px solid var(--outline-variant)', borderRadius: 'var(--border-radius-sm)', fontSize: 13 }}>
                        {issue.description || <span style={{ color: 'var(--on-surface-variant)' }}>Click to add description...</span>}
                      </div>
                    )}
                  </div>
                  <div className="vn-field"><label className="vn-field-label">Category</label><div style={{ fontSize: 13 }}>{issue.category}</div></div>
                  <div className="vn-field"><label className="vn-field-label">Source Type</label><div style={{ fontSize: 13 }}>{issue.sourceEntityType || '-'}</div></div>
                  <div className="vn-field"><label className="vn-field-label">Source Entity</label><div style={{ fontSize: 13 }}>{issue.sourceEntityId?.slice(0, 12) || '-'}</div></div>
                  <div className="vn-field"><label className="vn-field-label">Created</label><div style={{ fontSize: 13 }}>{new Date(issue.createdAt).toLocaleString()}</div></div>
                  <div className="vn-field"><label className="vn-field-label">Updated</label><div style={{ fontSize: 13 }}>{new Date(issue.updatedAt).toLocaleString()}</div></div>
                  {issue.escalatedTo && <div className="vn-field"><label className="vn-field-label">Escalated To</label><div style={{ fontSize: 13 }}>{issue.escalatedTo}</div></div>}
                  {issue.escalatedAt && <div className="vn-field"><label className="vn-field-label">Escalated At</label><div style={{ fontSize: 13 }}>{new Date(issue.escalatedAt).toLocaleString()}</div></div>}
                </div>
              </div>
            </div>
          )}

          {/* Resolution Tab */}
          {activeTab === 'resolution' && (
            <div className="vn-card">
              <div className="vn-card-body">
                <div className="vn-form-grid">
                  <div className="vn-field"><label className="vn-field-label">Resolution</label><div style={{ fontSize: 13 }}>{issue.resolution || <span style={{ color: 'var(--on-surface-variant)' }}>No resolution notes</span>}</div></div>
                  {issue.resolvedBy && <div className="vn-field"><label className="vn-field-label">Resolved By</label><div style={{ fontSize: 13 }}>{issue.resolvedBy}</div></div>}
                  {issue.resolvedAt && <div className="vn-field"><label className="vn-field-label">Resolved At</label><div style={{ fontSize: 13 }}>{new Date(issue.resolvedAt).toLocaleString()}</div></div>}
                  {issue.closedBy && <div className="vn-field"><label className="vn-field-label">Closed By</label><div style={{ fontSize: 13 }}>{issue.closedBy}</div></div>}
                  {issue.closedAt && <div className="vn-field"><label className="vn-field-label">Closed At</label><div style={{ fontSize: 13 }}>{new Date(issue.closedAt).toLocaleString()}</div></div>}
                </div>
                {/* Closure Report */}
                <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--outline-variant)' }}>
                  <h3 style={{ fontSize: 14, margin: '0 0 12px 0' }}><span className="material-icons" style={{ fontSize: 16, verticalAlign: 'middle', marginRight: 4 }}>description</span>Closure Report</h3>
                  <IssueReportSection issueId={id!} />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="vn-detail-sidebar">
          {/* Source Entity */}
          <SourceEntityCard entityType={issue.sourceEntityType} entityId={issue.sourceEntityId} />

          {/* SLA Status */}
          <div className="vn-card">
            <div className="vn-card-header" style={{ padding: '12px 16px' }}><h3 style={{ margin: 0, fontSize: 14 }}><span className="material-icons" style={{ fontSize: 16, verticalAlign: 'middle', marginRight: 4 }}>timer</span>SLA Status</h3></div>
            <div className="vn-card-body" style={{ padding: '8px 16px 16px' }}>
              {(issue.slaEvaluations || []).length === 0 ? (
                <div style={{ fontSize: 13, color: 'var(--on-surface-variant)' }}>No SLA rules active</div>
              ) : (
                (issue.slaEvaluations || []).map((sla: any, idx: number) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: idx < (issue.slaEvaluations || []).length - 1 ? '1px solid var(--outline-variant)' : 'none' }}>
                    <span style={{ fontSize: 12 }}>{sla.ruleName || sla.ruleType}</span>
                    <span className={`vn-chip vn-chip-${sla.status === 'breached' ? 'error' : sla.status === 'warning' ? 'warning' : 'info'}`} style={{ fontSize: 10 }}>{sla.status}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Assignment */}
          <div className="vn-card">
            <div className="vn-card-header" style={{ padding: '12px 16px' }}><h3 style={{ margin: 0, fontSize: 14 }}><span className="material-icons" style={{ fontSize: 16, verticalAlign: 'middle', marginRight: 4 }}>person</span>Assignment</h3></div>
            <div className="vn-card-body" style={{ padding: '8px 16px 16px', fontSize: 13 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600 }}>
                  {getInitials(issue.assigneeName)}
                </div>
                <span>{issue.assigneeName || 'Unassigned'}</span>
              </div>
              {issue.escalatedTo && <div style={{ fontSize: 12, color: 'var(--color-error)' }}>Escalated to: {issue.escalatedTo}</div>}
            </div>
          </div>

          {/* CAPA Reports */}
          <div className="vn-card">
            <div className="vn-card-header" style={{ padding: '12px 16px' }}><h3 style={{ margin: 0, fontSize: 14 }}><span className="material-icons" style={{ fontSize: 16, verticalAlign: 'middle', marginRight: 4 }}>assignment_late</span>CAPA Reports</h3></div>
            <div className="vn-card-body" style={{ padding: '8px 16px 16px', fontSize: 13 }}>
              {(issue.capaReports || []).length === 0 ? (
                <div style={{ color: 'var(--on-surface-variant)', marginBottom: 8 }}>No CAPA reports linked</div>
              ) : (
                (issue.capaReports || []).map((capa: any) => (
                  <div key={capa.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                    <Link to={`/cold-chain/capa`} style={{ color: 'var(--primary)', textDecoration: 'none', fontSize: 12 }}>{capa.reportNumber}</Link>
                    <span className="vn-chip" style={{ fontSize: 10 }}>{capa.status}</span>
                  </div>
                ))
              )}
              {issue.needsCapa && (
                <div className="vn-alert vn-alert-warning" style={{ marginTop: 8, padding: '8px 12px', fontSize: 12 }}>
                  <span className="material-icons" style={{ fontSize: 14, verticalAlign: 'middle' }}>assignment_late</span> CAPA required for this issue
                </div>
              )}
              <Link to={`/cold-chain/capa?issueId=${id}`} className="vn-btn" style={{ marginTop: 8, fontSize: 12, width: '100%', textAlign: 'center', textDecoration: 'none', display: 'block' }}>
                Create CAPA Report
              </Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
