import React, { useState, useEffect, useCallback } from 'react';
import { API_URL } from '../api';

/* ── Types ────────────────────────────────────────────────── */

interface Issue {
  id: string;
  issueNumber: string;
  title: string;
  description?: string;
  status: 'new' | 'investigating' | 'escalated' | 'resolved' | 'closed';
  severity: 'high' | 'medium' | 'low';
  category?: string;
  shipmentId?: string;
  orderId?: string;
  assigneeId?: string;
  assigneeName?: string;
  source?: string;
  slaBreach?: boolean;
  createdAt: string;
  comments?: IssueComment[];
}

interface IssueComment {
  id: string;
  authorName: string;
  body: string;
  createdAt: string;
}

interface Stats {
  new: number;
  investigating: number;
  escalated: number;
  resolved: number;
  closed: number;
}

/* ── Constants ────────────────────────────────────────────── */

const COLUMNS: { key: Issue['status']; label: string; cssClass: string }[] = [
  { key: 'new', label: 'New', cssClass: 'col-new' },
  { key: 'investigating', label: 'Investigating', cssClass: 'col-investigating' },
  { key: 'escalated', label: 'Escalated', cssClass: 'col-escalated' },
  { key: 'resolved', label: 'Resolved', cssClass: 'col-resolved' },
];

const STATUS_OPTIONS = ['new', 'investigating', 'escalated', 'resolved', 'closed'];

/* ── Helpers ──────────────────────────────────────────────── */

function SeverityChip({ severity }: { severity: Issue['severity'] }) {
  const map = { high: 'error', medium: 'warning', low: 'secondary' } as const;
  return <span className={`vn-chip vn-chip-${map[severity]}`} style={{ textTransform: 'capitalize' }}>{severity}</span>;
}

function StatusChip({ status }: { status: string }) {
  const map: Record<string, string> = { new: 'info', investigating: 'warning', escalated: 'error', resolved: 'success', closed: 'secondary' };
  return <span className={`vn-chip vn-chip-${map[status] || 'secondary'}`} style={{ textTransform: 'capitalize' }}>{status}</span>;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function initials(name?: string): string {
  if (!name) return '??';
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

/* ── Main Component ───────────────────────────────────────── */

export default function VNextIssueKanban() {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [stats, setStats] = useState<Stats>({ new: 0, investigating: 0, escalated: 0, resolved: 0, closed: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');
  const [filterSeverity, setFilterSeverity] = useState('all');

  // Detail modal state
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Create modal state
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ title: '', description: '', severity: 'medium', category: '' });
  const [createLoading, setCreateLoading] = useState(false);

  // Comment state
  const [commentText, setCommentText] = useState('');
  const [commentLoading, setCommentLoading] = useState(false);

  /* ── Fetch ────────────────────────────────────────────── */

  const fetchIssues = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/v1/issues?limit=200`);
      const json = await res.json();
      if (json.data) setIssues(json.data.issues || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/v1/issues/stats`);
      const json = await res.json();
      if (json.data) setStats(json.data);
    } catch {
      // stats are decorative, no error
    }
  }, []);

  useEffect(() => {
    fetchIssues();
    fetchStats();
  }, [fetchIssues, fetchStats]);

  /* ── Detail ───────────────────────────────────────────── */

  const openDetail = async (issue: Issue) => {
    setDetailLoading(true);
    setSelectedIssue(issue);
    try {
      const res = await fetch(`${API_URL}/api/v1/issues/${issue.id}`);
      const json = await res.json();
      if (json.data) setSelectedIssue(json.data);
    } catch {
      // use basic issue data
    } finally {
      setDetailLoading(false);
    }
  };

  const closeDetail = () => {
    setSelectedIssue(null);
    setCommentText('');
  };

  /* ── Transition ───────────────────────────────────────── */

  const transitionIssue = async (issueId: string, newStatus: string) => {
    try {
      await fetch(`${API_URL}/api/v1/issues/${issueId}/transition`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      // Refresh
      await fetchIssues();
      await fetchStats();
      // Update selected if open
      if (selectedIssue?.id === issueId) {
        setSelectedIssue(prev => prev ? { ...prev, status: newStatus as any } : null);
      }
    } catch {
      // ignore
    }
  };

  /* ── Create ───────────────────────────────────────────── */

  const handleCreate = async () => {
    if (!createForm.title.trim()) return;
    setCreateLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/issues`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...createForm,
          orgId: 'default',
        }),
      });
      const json = await res.json();
      if (json.data) {
        setShowCreate(false);
        setCreateForm({ title: '', description: '', severity: 'medium', category: '' });
        await fetchIssues();
        await fetchStats();
      }
    } catch {
      // ignore
    } finally {
      setCreateLoading(false);
    }
  };

  /* ── Comment ──────────────────────────────────────────── */

  const addComment = async () => {
    if (!commentText.trim() || !selectedIssue) return;
    setCommentLoading(true);
    try {
      await fetch(`${API_URL}/api/v1/issues/${selectedIssue.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: commentText, authorName: 'Current User' }),
      });
      setCommentText('');
      // Refresh detail
      const res = await fetch(`${API_URL}/api/v1/issues/${selectedIssue.id}`);
      const json = await res.json();
      if (json.data) setSelectedIssue(json.data);
    } catch {
      // ignore
    } finally {
      setCommentLoading(false);
    }
  };

  /* ── Filter ───────────────────────────────────────────── */

  const filtered = issues.filter(issue => {
    if (filterSeverity === 'all') return true;
    return issue.severity === filterSeverity;
  });

  const openCount = issues.filter(i => i.status !== 'resolved' && i.status !== 'closed').length;
  const shipmentCount = new Set(issues.filter(i => i.shipmentId).map(i => i.shipmentId)).size;

  /* ── Render ───────────────────────────────────────────── */

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
        <div className="loading-spinner" />
      </div>
    );
  }

  return (
    <>
      <div className="vn-page-header">
        <div>
          <h1>Issues</h1>
          <p>{openCount} open issues{shipmentCount > 0 ? ` across ${shipmentCount} shipments` : ''}</p>
        </div>
        <div className="vn-page-actions">
          <div style={{ display: 'flex', border: '1px solid var(--outline-variant)', borderRadius: 'var(--border-radius-sm)', overflow: 'hidden' }}>
            <button
              className="vn-btn-icon"
              style={{ borderRadius: 0, background: viewMode === 'kanban' ? 'var(--surface-container)' : 'transparent' }}
              onClick={() => setViewMode('kanban')}
            >
              <span className="material-icons" style={{ fontSize: 20 }}>view_kanban</span>
            </button>
            <button
              className="vn-btn-icon"
              style={{ borderRadius: 0, background: viewMode === 'list' ? 'var(--surface-container)' : 'transparent' }}
              onClick={() => setViewMode('list')}
            >
              <span className="material-icons" style={{ fontSize: 20 }}>view_list</span>
            </button>
          </div>
          <select className="vn-filter-select" value={filterSeverity} onChange={e => setFilterSeverity(e.target.value)}>
            <option value="all">All Severities</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          <button className="vn-btn vn-btn-primary" onClick={() => setShowCreate(true)}>
            <span className="material-icons">add</span>
            Report Issue
          </button>
        </div>
      </div>

      {error && (
        <div className="vn-alert vn-alert-warning" style={{ marginBottom: 16 }}>
          <span className="material-icons">info</span>
          Unable to load issues from API — check backend connection.
        </div>
      )}

      {/* Stats */}
      <div className="vn-stats">
        <div className="vn-stat">
          <div className="vn-stat-icon info"><span className="material-icons">fiber_new</span></div>
          <div>
            <div className="vn-stat-value">{stats.new}</div>
            <div className="vn-stat-label">New</div>
          </div>
        </div>
        <div className="vn-stat">
          <div className="vn-stat-icon warning"><span className="material-icons">search</span></div>
          <div>
            <div className="vn-stat-value">{stats.investigating}</div>
            <div className="vn-stat-label">Investigating</div>
          </div>
        </div>
        <div className="vn-stat">
          <div className="vn-stat-icon error"><span className="material-icons">priority_high</span></div>
          <div>
            <div className="vn-stat-value">{stats.escalated}</div>
            <div className="vn-stat-label">Escalated</div>
          </div>
        </div>
        <div className="vn-stat">
          <div className="vn-stat-icon success"><span className="material-icons">check_circle</span></div>
          <div>
            <div className="vn-stat-value">{stats.resolved}</div>
            <div className="vn-stat-label">Resolved</div>
          </div>
        </div>
      </div>

      {viewMode === 'kanban' ? (
        <div className="vn-kanban">
          {COLUMNS.map(col => {
            const colIssues = filtered.filter(i => i.status === col.key);
            return (
              <div key={col.key} className={`vn-kanban-col ${col.cssClass}`}>
                <div className="vn-kanban-col-header">
                  <span>{col.label}</span>
                  <span className="vn-count">{colIssues.length}</span>
                </div>
                <div className="vn-kanban-cards">
                  {colIssues.map(issue => (
                    <div className="vn-kanban-card" key={issue.id} onClick={() => openDetail(issue)} style={{ cursor: 'pointer' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--on-surface-variant)' }}>{issue.issueNumber}</span>
                        <SeverityChip severity={issue.severity} />
                      </div>
                      <div className="vn-kanban-card-title">{issue.title}</div>
                      {issue.shipmentId && (
                        <div className="vn-kanban-card-meta">
                          <span className="material-icons">local_shipping</span>
                          {issue.shipmentId.slice(0, 8)}...
                        </div>
                      )}
                      {issue.category && (
                        <div className="vn-kanban-card-meta">
                          <span className="material-icons">category</span>
                          {issue.category}
                        </div>
                      )}
                      {issue.slaBreach && (
                        <div className="vn-kanban-card-meta" style={{ color: 'var(--error)' }}>
                          <span className="material-icons">warning</span>
                          SLA Breached
                        </div>
                      )}
                      <div className="vn-kanban-card-footer">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          {issue.assigneeName && (
                            <>
                              <div className="vn-kanban-card-assignee">{initials(issue.assigneeName)}</div>
                              <span style={{ fontSize: 12, color: 'var(--on-surface-variant)' }}>{issue.assigneeName}</span>
                            </>
                          )}
                          {!issue.assigneeName && (
                            <span style={{ fontSize: 12, color: 'var(--on-surface-variant)', fontStyle: 'italic' }}>Unassigned</span>
                          )}
                        </div>
                        <span style={{ fontSize: 11, color: 'var(--on-surface-variant)' }}>{timeAgo(issue.createdAt)}</span>
                      </div>
                    </div>
                  ))}
                  {colIssues.length === 0 && (
                    <div style={{ textAlign: 'center', padding: 24, color: 'var(--on-surface-variant)', fontSize: 13 }}>
                      No issues
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="vn-card">
          <div className="vn-table-wrap">
            <table className="vn-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Issue</th>
                  <th>Category</th>
                  <th>Severity</th>
                  <th>Assignee</th>
                  <th>Status</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(issue => (
                  <tr key={issue.id} onClick={() => openDetail(issue)} style={{ cursor: 'pointer' }}>
                    <td><span className="vn-table-id">{issue.issueNumber}</span></td>
                    <td style={{ maxWidth: 280 }}>{issue.title}</td>
                    <td>{issue.category || '—'}</td>
                    <td><SeverityChip severity={issue.severity} /></td>
                    <td>
                      {issue.assigneeName ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div className="vn-kanban-card-assignee">{initials(issue.assigneeName)}</div>
                          {issue.assigneeName}
                        </div>
                      ) : (
                        <span style={{ color: 'var(--on-surface-variant)' }}>—</span>
                      )}
                    </td>
                    <td><StatusChip status={issue.status} /></td>
                    <td style={{ fontSize: 13, whiteSpace: 'nowrap' }}>{timeAgo(issue.createdAt)}</td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: 32, color: 'var(--on-surface-variant)' }}>
                      No issues found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Issue Detail Modal ────────────────────────────── */}
      {selectedIssue && (
        <div className="vn-modal-backdrop" onClick={closeDetail}>
          <div className="vn-modal" style={{ maxWidth: 640 }} onClick={e => e.stopPropagation()}>
            <div className="vn-modal-header">
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontWeight: 600, color: 'var(--on-surface-variant)' }}>{selectedIssue.issueNumber}</span>
                  <SeverityChip severity={selectedIssue.severity} />
                  <StatusChip status={selectedIssue.status} />
                  {selectedIssue.source === 'auto_exception' && (
                    <span className="vn-chip vn-chip-primary" style={{ fontSize: 11 }}>Auto</span>
                  )}
                </div>
                <h2 style={{ margin: '8px 0 0', fontSize: 18 }}>{selectedIssue.title}</h2>
              </div>
              <button className="vn-btn-icon" onClick={closeDetail}>
                <span className="material-icons">close</span>
              </button>
            </div>

            <div className="vn-modal-body">
              {/* Description */}
              {selectedIssue.description && (
                <div style={{ marginBottom: 16, color: 'var(--on-surface-variant)', lineHeight: 1.5 }}>
                  {selectedIssue.description}
                </div>
              )}

              {/* Metadata grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px', marginBottom: 20, fontSize: 13 }}>
                <div><strong>Category:</strong> {selectedIssue.category || '—'}</div>
                <div><strong>Assignee:</strong> {selectedIssue.assigneeName || 'Unassigned'}</div>
                {selectedIssue.shipmentId && (
                  <div><strong>Shipment:</strong> {selectedIssue.shipmentId.slice(0, 8)}...</div>
                )}
                {selectedIssue.orderId && (
                  <div><strong>Order:</strong> {selectedIssue.orderId.slice(0, 8)}...</div>
                )}
                <div><strong>Created:</strong> {new Date(selectedIssue.createdAt).toLocaleString()}</div>
                <div><strong>Source:</strong> {selectedIssue.source || 'manual'}</div>
              </div>

              {/* Status transition buttons */}
              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--on-surface-variant)', marginBottom: 6, display: 'block' }}>
                  Move to:
                </label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {STATUS_OPTIONS.filter(s => s !== selectedIssue.status).map(s => (
                    <button
                      key={s}
                      className="vn-btn vn-btn-sm vn-btn-outline"
                      onClick={() => transitionIssue(selectedIssue.id, s)}
                      style={{ textTransform: 'capitalize' }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* Comments section */}
              <div style={{ borderTop: '1px solid var(--outline-variant)', paddingTop: 16 }}>
                <h3 style={{ fontSize: 14, marginBottom: 12 }}>
                  Comments ({selectedIssue.comments?.length || 0})
                </h3>

                {detailLoading && <div className="loading-spinner" style={{ margin: '16px auto' }} />}

                {selectedIssue.comments && selectedIssue.comments.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16, maxHeight: 300, overflowY: 'auto' }}>
                    {selectedIssue.comments.map(comment => (
                      <div key={comment.id} style={{ padding: 12, background: 'var(--surface-container)', borderRadius: 'var(--border-radius-sm)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span style={{ fontWeight: 600, fontSize: 13 }}>{comment.authorName}</span>
                          <span style={{ fontSize: 11, color: 'var(--on-surface-variant)' }}>{timeAgo(comment.createdAt)}</span>
                        </div>
                        <div style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--on-surface)' }}>{comment.body}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  !detailLoading && (
                    <div style={{ padding: 16, textAlign: 'center', color: 'var(--on-surface-variant)', fontSize: 13, marginBottom: 16 }}>
                      No comments yet
                    </div>
                  )
                )}

                {/* Add comment */}
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    className="vn-input"
                    placeholder="Add a comment..."
                    value={commentText}
                    onChange={e => setCommentText(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addComment(); } }}
                    style={{ flex: 1 }}
                  />
                  <button
                    className="vn-btn vn-btn-primary vn-btn-sm"
                    onClick={addComment}
                    disabled={!commentText.trim() || commentLoading}
                  >
                    {commentLoading ? '...' : 'Send'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Create Issue Modal ────────────────────────────── */}
      {showCreate && (
        <div className="vn-modal-backdrop" onClick={() => setShowCreate(false)}>
          <div className="vn-modal" style={{ maxWidth: 500 }} onClick={e => e.stopPropagation()}>
            <div className="vn-modal-header">
              <h2 style={{ fontSize: 18, margin: 0 }}>Report Issue</h2>
              <button className="vn-btn-icon" onClick={() => setShowCreate(false)}>
                <span className="material-icons">close</span>
              </button>
            </div>
            <div className="vn-modal-body">
              <div className="vn-form-grid" style={{ gridTemplateColumns: '1fr' }}>
                <div className="vn-field">
                  <label className="vn-field-label">Title *</label>
                  <input
                    className="vn-input"
                    value={createForm.title}
                    onChange={e => setCreateForm(f => ({ ...f, title: e.target.value }))}
                    placeholder="Brief description of the issue"
                  />
                </div>
                <div className="vn-field">
                  <label className="vn-field-label">Description</label>
                  <textarea
                    className="vn-input"
                    rows={3}
                    value={createForm.description}
                    onChange={e => setCreateForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="Detailed description..."
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div className="vn-field">
                    <label className="vn-field-label">Severity</label>
                    <select
                      className="vn-filter-select"
                      value={createForm.severity}
                      onChange={e => setCreateForm(f => ({ ...f, severity: e.target.value }))}
                    >
                      <option value="high">High</option>
                      <option value="medium">Medium</option>
                      <option value="low">Low</option>
                    </select>
                  </div>
                  <div className="vn-field">
                    <label className="vn-field-label">Category</label>
                    <select
                      className="vn-filter-select"
                      value={createForm.category}
                      onChange={e => setCreateForm(f => ({ ...f, category: e.target.value }))}
                    >
                      <option value="">Select...</option>
                      <option value="Pickup Delay">Pickup Delay</option>
                      <option value="Delivery Delay">Delivery Delay</option>
                      <option value="Delivery">Delivery</option>
                      <option value="Documentation">Documentation</option>
                      <option value="Equipment">Equipment</option>
                      <option value="Communication">Communication</option>
                      <option value="Compliance">Compliance</option>
                      <option value="Freight Damage">Freight Damage</option>
                      <option value="Billing">Billing</option>
                      <option value="Weather">Weather</option>
                      <option value="General">General</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
            <div className="vn-modal-footer">
              <button className="vn-btn vn-btn-outline" onClick={() => setShowCreate(false)}>Cancel</button>
              <button
                className="vn-btn vn-btn-primary"
                onClick={handleCreate}
                disabled={!createForm.title.trim() || createLoading}
              >
                {createLoading ? 'Creating...' : 'Create Issue'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
