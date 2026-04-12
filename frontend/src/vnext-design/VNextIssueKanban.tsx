import React, { useState, useEffect } from 'react';
import { API_URL } from '../api';

interface Issue {
  id: string;
  orgId: string;
  title: string;
  description: string | null;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'critical';
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
  createdAt: string;
  updatedAt: string;
  // SLA data (attached after fetch)
  _sla?: { status: string; ruleName: string; slaDueAt: string | null; remainingMinutes?: number } | null;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function getInitials(name: string | null): string {
  if (!name) return '?';
  return name.split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

const COLUMNS: { key: Issue['status']; label: string; cssClass: string }[] = [
  { key: 'open', label: 'Open', cssClass: 'col-new' },
  { key: 'in_progress', label: 'In Progress', cssClass: 'col-investigating' },
  { key: 'resolved', label: 'Resolved', cssClass: 'col-escalated' },
  { key: 'closed', label: 'Closed', cssClass: 'col-resolved' },
];

function SeverityChip({ priority }: { priority: Issue['priority'] }) {
  const map = { critical: 'error', high: 'error', medium: 'warning', low: 'secondary' } as const;
  return <span className={`vn-chip vn-chip-${map[priority]}`} style={{ textTransform: 'capitalize' }}>{priority}</span>;
}

export default function VNextIssueKanban() {
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');
  const [filterSeverity, setFilterSeverity] = useState('all');
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(`${API_URL}/api/v1/issues`).then(r => r.json()),
      fetch(`${API_URL}/api/v1/sla/evaluations?status=active,warning,breached&entityType=issue&limit=200`).then(r => r.json()).catch(() => ({ data: { items: [] } })),
    ]).then(([issueJson, slaJson]) => {
      const slaItems = slaJson.data?.items || [];
      // Build a map of issue ID → worst SLA evaluation
      const slaMap = new Map<string, any>();
      for (const sla of slaItems) {
        const existing = slaMap.get(sla.entityId);
        const order: Record<string, number> = { breached: 0, warning: 1, active: 2 };
        if (!existing || (order[sla.status] ?? 3) < (order[existing.status] ?? 3)) {
          slaMap.set(sla.entityId, sla);
        }
      }
      const issues = (issueJson.data || []).map((i: Issue) => ({
        ...i,
        _sla: slaMap.get(i.id) || null,
      }));
      setIssues(issues);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const filtered = issues.filter(issue => {
    if (filterSeverity === 'all') return true;
    return issue.priority === filterSeverity;
  });

  return (
    <>
      <div className="vn-page-header">
        <div>
          <h1>Issues</h1>
          <p>{issues.filter(i => i.status !== 'resolved' && i.status !== 'closed').length} open issues across {new Set(issues.map(i => i.sourceEntityId).filter(Boolean)).size} shipments</p>
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
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          <button className="vn-btn vn-btn-primary">
            <span className="material-icons">add</span>
            Report Issue
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="vn-stats">
        <div className="vn-stat">
          <div className="vn-stat-icon info"><span className="material-icons">fiber_new</span></div>
          <div>
            <div className="vn-stat-value">{issues.filter(i => i.status === 'open').length}</div>
            <div className="vn-stat-label">Open</div>
          </div>
        </div>
        <div className="vn-stat">
          <div className="vn-stat-icon warning"><span className="material-icons">search</span></div>
          <div>
            <div className="vn-stat-value">{issues.filter(i => i.status === 'in_progress').length}</div>
            <div className="vn-stat-label">In Progress</div>
          </div>
        </div>
        <div className="vn-stat">
          <div className="vn-stat-icon success"><span className="material-icons">check_circle</span></div>
          <div>
            <div className="vn-stat-value">{issues.filter(i => i.status === 'resolved').length}</div>
            <div className="vn-stat-label">Resolved</div>
          </div>
        </div>
        <div className="vn-stat">
          <div className="vn-stat-icon error"><span className="material-icons">cancel</span></div>
          <div>
            <div className="vn-stat-value">{issues.filter(i => i.status === 'closed').length}</div>
            <div className="vn-stat-label">Closed</div>
          </div>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
          <div className="loading-spinner" />
        </div>
      ) : viewMode === 'kanban' ? (
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
                    <div className="vn-kanban-card" key={issue.id}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--on-surface-variant)' }}>{issue.id.slice(0, 8)}</span>
                        <SeverityChip priority={issue.priority} />
                      </div>
                      <div className="vn-kanban-card-title">{issue.title}</div>
                      {issue.sourceEntityId && (
                        <div className="vn-kanban-card-meta">
                          <span className="material-icons">local_shipping</span>
                          {issue.sourceEntityId}
                        </div>
                      )}
                      <div className="vn-kanban-card-meta">
                        <span className="material-icons">category</span>
                        {issue.category}
                      </div>
                      {issue._sla && (
                        <div style={{
                          display: 'flex', alignItems: 'center', gap: '4px',
                          padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600, marginBottom: '6px',
                          background: issue._sla.status === 'breached' ? 'var(--color-error)' : issue._sla.status === 'warning' ? 'var(--color-warning)' : 'var(--color-info)',
                          color: '#fff',
                        }}>
                          <span className="material-icons" style={{ fontSize: '13px' }}>timer</span>
                          {issue._sla.ruleName} — {issue._sla.status}
                          {issue._sla.slaDueAt && issue._sla.status !== 'breached' && (() => {
                            const mins = Math.round((new Date(issue._sla!.slaDueAt!).getTime() - Date.now()) / 60_000);
                            return mins > 0 ? ` (${mins < 60 ? `${mins}m` : `${Math.floor(mins / 60)}h`})` : '';
                          })()}
                        </div>
                      )}
                      <div className="vn-kanban-card-footer">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div className="vn-kanban-card-assignee">{getInitials(issue.assigneeName)}</div>
                          <span style={{ fontSize: 12, color: 'var(--on-surface-variant)' }}>{issue.assigneeName || 'Unassigned'}</span>
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
                  <th>Reference</th>
                  <th>Category</th>
                  <th>Priority</th>
                  <th>Assignee</th>
                  <th>Status</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(issue => (
                  <tr key={issue.id}>
                    <td><span className="vn-table-id">{issue.id.slice(0, 8)}</span></td>
                    <td style={{ maxWidth: 280 }}>{issue.title}</td>
                    <td><span className="vn-table-id">{issue.sourceEntityId || '—'}</span></td>
                    <td>{issue.category}</td>
                    <td><SeverityChip priority={issue.priority} /></td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div className="vn-kanban-card-assignee">{getInitials(issue.assigneeName)}</div>
                        {issue.assigneeName || 'Unassigned'}
                      </div>
                    </td>
                    <td>
                      <span className={`vn-chip vn-chip-${issue.status === 'open' ? 'info' : issue.status === 'in_progress' ? 'warning' : issue.status === 'resolved' ? 'success' : 'secondary'}`} style={{ textTransform: 'capitalize' }}>
                        {issue.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td style={{ fontSize: 13, whiteSpace: 'nowrap' }}>{timeAgo(issue.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
