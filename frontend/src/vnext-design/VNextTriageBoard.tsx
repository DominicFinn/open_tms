import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { API_URL } from '../api';

interface Issue {
  id: string;
  issueNumber: string;
  title: string;
  description?: string;
  status: string;
  severity: string;
  priority: number;
  category?: string;
  shipmentId?: string;
  orderId?: string;
  assigneeId?: string;
  assigneeName?: string;
  source?: string;
  signalScore: number;
  isNoise: boolean;
  slaBreach: boolean;
  activityCount: number;
  createdAt: string;
}

const COLUMNS = [
  { key: 'new', label: 'New', css: 'col-new' },
  { key: 'investigating', label: 'Investigating', css: 'col-investigating' },
  { key: 'escalated', label: 'Escalated', css: 'col-escalated' },
  { key: 'resolved', label: 'Resolved', css: 'col-resolved' },
];

const PRIORITY_COLORS: Record<number, string> = {
  1: 'var(--error)', 2: 'var(--warning)', 3: 'var(--info)', 4: 'var(--outline)', 5: 'var(--outline-variant)',
};
const PRIORITY_LABELS: Record<number, string> = {
  1: 'P1', 2: 'P2', 3: 'P3', 4: 'P4', 5: 'P5',
};
const SEVERITY_CHIP: Record<string, string> = { high: 'error', medium: 'warning', low: 'secondary' };
const CATEGORIES = ['Delivery Delay', 'Freight Damage', 'Delivery', 'Documentation', 'Equipment', 'Communication', 'Compliance', 'Billing', 'Weather', 'General'];

function timeAgo(d: string): string {
  const diff = Date.now() - new Date(d).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

function initials(name?: string): string {
  if (!name) return '??';
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

export default function VNextTriageBoard() {
  const navigate = useNavigate();
  const { boardId } = useParams();
  const [issues, setIssues] = useState<Issue[]>([]);
  const [stats, setStats] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'kanban' | 'list'>('kanban');
  const [boardName, setBoardName] = useState('All Issues');

  // Filters
  const [search, setSearch] = useState('');
  const [severity, setSeverity] = useState('all');
  const [priority, setPriority] = useState('all');
  const [category, setCategory] = useState('all');

  // Create modal
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ title: '', description: '', severity: 'medium', priority: 3, category: '' });
  const [createLoading, setCreateLoading] = useState(false);

  const fetchIssues = useCallback(async () => {
    const params = new URLSearchParams({ limit: '200' });
    if (search) params.set('search', search);
    if (severity !== 'all') params.set('severity', severity);
    if (priority !== 'all') params.set('priority', priority);
    if (category !== 'all') params.set('category', category);

    try {
      // If we have a boardId, fetch from board-specific endpoint
      const url = boardId
        ? `${API_URL}/api/v1/triage-boards/${boardId}/issues?${params}`
        : `${API_URL}/api/v1/issues?${params}`;
      const [issuesRes, statsRes] = await Promise.all([
        fetch(url).then(r => r.json()),
        fetch(`${API_URL}/api/v1/issues/stats`).then(r => r.json()),
      ]);
      if (issuesRes.data) setIssues(issuesRes.data.issues || []);
      if (statsRes.data) setStats(statsRes.data);

      // Load board name if applicable
      if (boardId) {
        const boardRes = await fetch(`${API_URL}/api/v1/triage-boards/${boardId}`).then(r => r.json());
        if (boardRes.data?.name) setBoardName(boardRes.data.name);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, [boardId, search, severity, priority, category]);

  useEffect(() => { fetchIssues(); }, [fetchIssues]);

  const handleCreate = async () => {
    if (!createForm.title.trim()) return;
    setCreateLoading(true);
    try {
      await fetch(`${API_URL}/api/v1/issues`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...createForm, orgId: 'default' }),
      });
      setShowCreate(false);
      setCreateForm({ title: '', description: '', severity: 'medium', priority: 3, category: '' });
      fetchIssues();
    } catch { /* ignore */ }
    setCreateLoading(false);
  };

  const transitionIssue = async (id: string, status: string) => {
    await fetch(`${API_URL}/api/v1/issues/${id}/transition`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    fetchIssues();
  };

  const filtered = issues.filter(i => {
    if (severity !== 'all' && i.severity !== severity) return false;
    if (priority !== 'all' && i.priority !== Number(priority)) return false;
    if (category !== 'all' && i.category !== category) return false;
    return true;
  });

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}><div className="loading-spinner" /></div>;

  return (
    <>
      <div className="vn-page-header">
        <div>
          <h1>{boardName}</h1>
          <p>{filtered.filter(i => !['resolved', 'closed'].includes(i.status)).length} open issues</p>
        </div>
        <div className="vn-page-actions">
          <div style={{ display: 'flex', border: '1px solid var(--outline-variant)', borderRadius: 'var(--border-radius-sm)', overflow: 'hidden' }}>
            <button className="vn-btn-icon" style={{ borderRadius: 0, background: view === 'kanban' ? 'var(--surface-container)' : 'transparent' }} onClick={() => setView('kanban')}>
              <span className="material-icons" style={{ fontSize: 20 }}>view_kanban</span>
            </button>
            <button className="vn-btn-icon" style={{ borderRadius: 0, background: view === 'list' ? 'var(--surface-container)' : 'transparent' }} onClick={() => setView('list')}>
              <span className="material-icons" style={{ fontSize: 20 }}>view_list</span>
            </button>
          </div>
          <button className="vn-btn vn-btn-primary" onClick={() => setShowCreate(true)}>
            <span className="material-icons">add</span> Create Issue
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="vn-filters" style={{ marginBottom: 16 }}>
        <div className="vn-filter-group">
          <span className="material-icons">search</span>
          <input className="vn-filter-input" placeholder="Search issues..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="vn-filter-select" value={severity} onChange={e => setSeverity(e.target.value)}>
          <option value="all">All Severities</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <select className="vn-filter-select" value={priority} onChange={e => setPriority(e.target.value)}>
          <option value="all">All Priorities</option>
          <option value="1">P1 Critical</option>
          <option value="2">P2 Urgent</option>
          <option value="3">P3 Normal</option>
          <option value="4">P4 Low</option>
          <option value="5">P5 Trivial</option>
        </select>
        <select className="vn-filter-select" value={category} onChange={e => setCategory(e.target.value)}>
          <option value="all">All Categories</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* Stats */}
      <div className="vn-stats" style={{ marginBottom: 20 }}>
        {COLUMNS.map(col => {
          const icons: Record<string, string> = { new: 'fiber_new', investigating: 'search', escalated: 'priority_high', resolved: 'check_circle' };
          const types: Record<string, string> = { new: 'info', investigating: 'warning', escalated: 'error', resolved: 'success' };
          return (
            <div className="vn-stat" key={col.key}>
              <div className={`vn-stat-icon ${types[col.key]}`}><span className="material-icons">{icons[col.key]}</span></div>
              <div><div className="vn-stat-value">{stats[col.key] || 0}</div><div className="vn-stat-label">{col.label}</div></div>
            </div>
          );
        })}
      </div>

      {/* Kanban View */}
      {view === 'kanban' ? (
        <div className="vn-kanban">
          {COLUMNS.map(col => {
            const colIssues = filtered.filter(i => i.status === col.key);
            return (
              <div key={col.key} className={`vn-kanban-col ${col.css}`}>
                <div className="vn-kanban-col-header">
                  <span>{col.label}</span>
                  <span className="vn-count">{colIssues.length}</span>
                </div>
                <div className="vn-kanban-cards">
                  {colIssues.map(issue => (
                    <div className={`vn-kanban-card ${issue.isNoise ? '' : ''}`} key={issue.id}
                      style={{ cursor: 'pointer', opacity: issue.isNoise ? 0.5 : 1 }}
                      onClick={() => navigate(`/triage/issues/${issue.id}`)}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--on-surface-variant)' }}>{issue.issueNumber}</span>
                          <span style={{
                            fontSize: 10, fontWeight: 700, padding: '1px 5px', borderRadius: 4,
                            background: PRIORITY_COLORS[issue.priority] || 'var(--outline)',
                            color: issue.priority <= 2 ? 'var(--on-error)' : 'var(--on-surface)',
                          }}>{PRIORITY_LABELS[issue.priority] || 'P3'}</span>
                        </div>
                        <span className={`vn-chip vn-chip-${SEVERITY_CHIP[issue.severity] || 'secondary'}`} style={{ textTransform: 'capitalize' }}>{issue.severity}</span>
                      </div>
                      <div className="vn-kanban-card-title">{issue.title}</div>
                      {issue.category && (
                        <div className="vn-kanban-card-meta"><span className="material-icons">category</span>{issue.category}</div>
                      )}
                      {/* Signal score bar */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                        <div style={{ width: 32, height: 4, borderRadius: 2, background: 'var(--outline-variant)', overflow: 'hidden' }}>
                          <div style={{
                            width: `${issue.signalScore}%`, height: '100%', borderRadius: 2,
                            background: issue.signalScore >= 70 ? 'var(--success)' : issue.signalScore >= 40 ? 'var(--warning)' : 'var(--error)',
                          }} />
                        </div>
                        <span style={{ fontSize: 10, color: 'var(--on-surface-variant)' }}>{issue.signalScore}</span>
                      </div>
                      {issue.slaBreach && (
                        <div className="vn-kanban-card-meta" style={{ color: 'var(--error)', fontWeight: 600 }}>
                          <span className="material-icons">warning</span>SLA Breached
                        </div>
                      )}
                      {issue.isNoise && (
                        <span className="vn-chip vn-chip-secondary" style={{ fontSize: 10, marginTop: 4 }}>Noise</span>
                      )}
                      <div className="vn-kanban-card-footer">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          {issue.assigneeName ? (
                            <><div className="vn-kanban-card-assignee">{initials(issue.assigneeName)}</div>
                            <span style={{ fontSize: 12, color: 'var(--on-surface-variant)' }}>{issue.assigneeName}</span></>
                          ) : (
                            <span style={{ fontSize: 12, color: 'var(--on-surface-variant)', fontStyle: 'italic' }}>Unassigned</span>
                          )}
                        </div>
                        <span style={{ fontSize: 11, color: 'var(--on-surface-variant)' }}>{timeAgo(issue.createdAt)}</span>
                      </div>
                    </div>
                  ))}
                  {colIssues.length === 0 && (
                    <div style={{ textAlign: 'center', padding: 24, color: 'var(--on-surface-variant)', fontSize: 13 }}>No issues</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* List View */
        <div className="vn-card">
          <div className="vn-table-wrap">
            <table className="vn-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>P</th>
                  <th>Issue</th>
                  <th>Category</th>
                  <th>Severity</th>
                  <th>Signal</th>
                  <th>Assignee</th>
                  <th>Status</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(issue => (
                  <tr key={issue.id} onClick={() => navigate(`/triage/issues/${issue.id}`)} style={{ cursor: 'pointer', opacity: issue.isNoise ? 0.5 : 1 }}>
                    <td><span className="vn-table-id">{issue.issueNumber}</span></td>
                    <td>
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
                        background: PRIORITY_COLORS[issue.priority], color: issue.priority <= 2 ? 'var(--on-error)' : 'var(--on-surface)',
                      }}>{PRIORITY_LABELS[issue.priority]}</span>
                    </td>
                    <td style={{ maxWidth: 300 }}>{issue.title}</td>
                    <td>{issue.category || '—'}</td>
                    <td><span className={`vn-chip vn-chip-${SEVERITY_CHIP[issue.severity] || 'secondary'}`}>{issue.severity}</span></td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <div style={{ width: 24, height: 4, borderRadius: 2, background: 'var(--outline-variant)', overflow: 'hidden' }}>
                          <div style={{ width: `${issue.signalScore}%`, height: '100%', borderRadius: 2, background: issue.signalScore >= 70 ? 'var(--success)' : issue.signalScore >= 40 ? 'var(--warning)' : 'var(--error)' }} />
                        </div>
                        <span style={{ fontSize: 11 }}>{issue.signalScore}</span>
                      </div>
                    </td>
                    <td>{issue.assigneeName || <span style={{ color: 'var(--on-surface-variant)' }}>—</span>}</td>
                    <td>
                      <span className={`vn-chip vn-chip-${issue.status === 'new' ? 'info' : issue.status === 'investigating' ? 'warning' : issue.status === 'escalated' ? 'error' : 'success'}`} style={{ textTransform: 'capitalize' }}>{issue.status}</span>
                    </td>
                    <td style={{ fontSize: 13, whiteSpace: 'nowrap' }}>{timeAgo(issue.createdAt)}</td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={9} style={{ textAlign: 'center', padding: 32, color: 'var(--on-surface-variant)' }}>No issues found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <div className="vn-modal-backdrop" onClick={() => setShowCreate(false)}>
          <div className="vn-modal" style={{ maxWidth: 500 }} onClick={e => e.stopPropagation()}>
            <div className="vn-modal-header">
              <h2 style={{ fontSize: 18, margin: 0 }}>Create Issue</h2>
              <button className="vn-btn-icon" onClick={() => setShowCreate(false)}><span className="material-icons">close</span></button>
            </div>
            <div className="vn-modal-body">
              <div className="vn-field" style={{ marginBottom: 16 }}>
                <label className="vn-field-label">Title *</label>
                <input className="vn-input" value={createForm.title} onChange={e => setCreateForm(f => ({ ...f, title: e.target.value }))} placeholder="Brief description" />
              </div>
              <div className="vn-field" style={{ marginBottom: 16 }}>
                <label className="vn-field-label">Description</label>
                <textarea className="vn-input" rows={3} value={createForm.description} onChange={e => setCreateForm(f => ({ ...f, description: e.target.value }))} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <div className="vn-field">
                  <label className="vn-field-label">Severity</label>
                  <select className="vn-filter-select" value={createForm.severity} onChange={e => setCreateForm(f => ({ ...f, severity: e.target.value }))}>
                    <option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option>
                  </select>
                </div>
                <div className="vn-field">
                  <label className="vn-field-label">Priority</label>
                  <select className="vn-filter-select" value={createForm.priority} onChange={e => setCreateForm(f => ({ ...f, priority: Number(e.target.value) }))}>
                    <option value="1">P1 Critical</option><option value="2">P2 Urgent</option><option value="3">P3 Normal</option><option value="4">P4 Low</option><option value="5">P5 Trivial</option>
                  </select>
                </div>
                <div className="vn-field">
                  <label className="vn-field-label">Category</label>
                  <select className="vn-filter-select" value={createForm.category} onChange={e => setCreateForm(f => ({ ...f, category: e.target.value }))}>
                    <option value="">Select...</option>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
            </div>
            <div className="vn-modal-footer">
              <button className="vn-btn vn-btn-outline" onClick={() => setShowCreate(false)}>Cancel</button>
              <button className="vn-btn vn-btn-primary" onClick={handleCreate} disabled={!createForm.title.trim() || createLoading}>
                {createLoading ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
