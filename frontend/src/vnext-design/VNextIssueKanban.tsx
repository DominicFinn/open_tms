import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { DndContext, DragOverlay, closestCorners, PointerSensor, KeyboardSensor, useSensor, useSensors, DragStartEvent, DragEndEvent, useDroppable } from '@dnd-kit/core';
import { useDraggable } from '@dnd-kit/core';
import { API_URL } from '../api';

// ─── Types ──────────────────────────────────────────────────────────────────

interface Issue {
  id: string;
  title: string;
  description: string | null;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'critical';
  category: string;
  sourceEntityType: string | null;
  sourceEntityId: string | null;
  assigneeId: string | null;
  assigneeName: string | null;
  snoozedUntil: string | null;
  needsCapa: boolean;
  labels: Array<{ id: string; name: string; color: string }> | null;
  commentCount: number;
  resolvedAt: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
  _sla?: { status: string; ruleName: string; slaDueAt: string | null } | null;
}

interface IssueLabel { id: string; name: string; color: string; }
interface KanbanViewDef { id: string; name: string; filters: any; groupBy: string; sortBy: string; isDefault: boolean; }

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

// ─── Draggable Card ─────────────────────────────────────────────────────────

function DraggableIssueCard({ issue, onClick }: { issue: Issue; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: issue.id });
  const style: React.CSSProperties = {
    opacity: isDragging ? 0.4 : 1,
    transform: transform ? `translate(${transform.x}px, ${transform.y}px)` : undefined,
    cursor: 'grab',
  };

  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes} className="vn-kanban-card" onClick={(e) => { e.stopPropagation(); onClick(); }}>
      <IssueCardContent issue={issue} />
    </div>
  );
}

function IssueCardContent({ issue }: { issue: Issue }) {
  const isSnoozed = issue.snoozedUntil && new Date(issue.snoozedUntil) > new Date();
  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--on-surface-variant)' }}>{issue.id.slice(0, 8)}</span>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          {issue.needsCapa && <span className="material-icons" style={{ fontSize: 14, color: 'var(--color-warning)' }} title="Needs CAPA">assignment_late</span>}
          {isSnoozed && <span className="material-icons" style={{ fontSize: 14, color: 'var(--on-surface-variant)' }} title={`Snoozed until ${new Date(issue.snoozedUntil!).toLocaleString()}`}>alarm</span>}
          <SeverityChip priority={issue.priority} />
        </div>
      </div>
      <div className="vn-kanban-card-title">{issue.title}</div>
      {issue.sourceEntityId && (
        <div className="vn-kanban-card-meta">
          <span className="material-icons">{issue.sourceEntityType === 'order' ? 'receipt_long' : 'local_shipping'}</span>
          {issue.sourceEntityId.slice(0, 8)}
        </div>
      )}
      <div className="vn-kanban-card-meta">
        <span className="material-icons">category</span>
        {issue.category}
      </div>
      {/* Labels */}
      {issue.labels && issue.labels.length > 0 && (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6 }}>
          {issue.labels.map(l => (
            <span key={l.id} style={{ fontSize: 10, padding: '1px 6px', borderRadius: 8, background: l.color, color: '#fff', fontWeight: 600 }}>{l.name}</span>
          ))}
        </div>
      )}
      {/* SLA badge */}
      {issue._sla && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '4px',
          padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600, marginBottom: '6px',
          background: issue._sla.status === 'breached' ? 'var(--color-error)' : issue._sla.status === 'warning' ? 'var(--color-warning)' : 'var(--color-info)',
          color: '#fff',
        }}>
          <span className="material-icons" style={{ fontSize: '13px' }}>timer</span>
          {issue._sla.ruleName} - {issue._sla.status}
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {issue.commentCount > 0 && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 2, fontSize: 11, color: 'var(--on-surface-variant)' }}>
              <span className="material-icons" style={{ fontSize: 13 }}>comment</span>{issue.commentCount}
            </span>
          )}
          <span style={{ fontSize: 11, color: 'var(--on-surface-variant)' }}>{timeAgo(issue.createdAt)}</span>
        </div>
      </div>
    </>
  );
}

// ─── Droppable Column ───────────────────────────────────────────────────────

function DroppableColumn({ colKey, label, cssClass, issues, onCardClick }: {
  colKey: string; label: string; cssClass: string; issues: Issue[]; onCardClick: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: colKey });
  return (
    <div ref={setNodeRef} className={`vn-kanban-col ${cssClass}`} style={{ background: isOver ? 'var(--surface-container-highest)' : undefined, transition: 'background 0.2s' }}>
      <div className="vn-kanban-col-header">
        <span>{label}</span>
        <span className="vn-count">{issues.length}</span>
      </div>
      <div className="vn-kanban-cards">
        {issues.map(issue => (
          <DraggableIssueCard key={issue.id} issue={issue} onClick={() => onCardClick(issue.id)} />
        ))}
        {issues.length === 0 && (
          <div style={{ textAlign: 'center', padding: 24, color: 'var(--on-surface-variant)', fontSize: 13 }}>No issues</div>
        )}
      </div>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function VNextIssueKanban() {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [draggingIssue, setDraggingIssue] = useState<Issue | null>(null);

  // Filters
  const [filterPriority, setFilterPriority] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterSearch, setFilterSearch] = useState('');
  const [filterNeedsCapa, setFilterNeedsCapa] = useState(false);

  // Saved views
  const [views, setViews] = useState<KanbanViewDef[]>([]);
  const [activeView, setActiveView] = useState('');

  // Auto-refresh
  const refreshRef = useRef<NodeJS.Timeout | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor)
  );

  const loadData = useCallback(async () => {
    try {
      const [issueRes, slaRes] = await Promise.all([
        fetch(`${API_URL}/api/v1/issues?limit=500`).then(r => r.json()),
        fetch(`${API_URL}/api/v1/sla/evaluations?status=active,warning,breached&entityType=issue&limit=200`).then(r => r.json()).catch(() => ({ data: { items: [] } })),
      ]);
      const slaItems = slaRes.data?.items || [];
      const slaMap = new Map<string, any>();
      for (const sla of slaItems) {
        const existing = slaMap.get(sla.entityId);
        const order: Record<string, number> = { breached: 0, warning: 1, active: 2 };
        if (!existing || (order[sla.status] ?? 3) < (order[existing.status] ?? 3)) {
          slaMap.set(sla.entityId, sla);
        }
      }
      const loaded = (issueRes.data || []).map((i: Issue) => ({
        ...i,
        labels: i.labels || [],
        commentCount: i.commentCount || 0,
        needsCapa: i.needsCapa || false,
        _sla: slaMap.get(i.id) || null,
      }));
      setIssues(loaded);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
    // Load saved views
    fetch(`${API_URL}/api/v1/kanban-views`).then(r => r.json()).then(json => setViews(json.data || [])).catch(() => {});
    // Auto-refresh
    refreshRef.current = setInterval(loadData, 30000);
    return () => { if (refreshRef.current) clearInterval(refreshRef.current); };
  }, [loadData]);

  // Apply view filters
  const applyViewFilters = (viewId: string) => {
    setActiveView(viewId);
    if (!viewId) { setFilterPriority('all'); setFilterCategory('all'); setFilterSearch(''); setFilterNeedsCapa(false); return; }
    const view = views.find(v => v.id === viewId);
    if (!view) return;
    const f = view.filters || {};
    if (f.priority) setFilterPriority(f.priority);
    if (f.category) setFilterCategory(f.category);
    if (f.search) setFilterSearch(f.search);
    if (f.needsCapa) setFilterNeedsCapa(true);
  };

  // Filter issues
  const filtered = issues.filter(issue => {
    if (filterPriority !== 'all' && issue.priority !== filterPriority) return false;
    if (filterCategory !== 'all' && issue.category !== filterCategory) return false;
    if (filterNeedsCapa && !issue.needsCapa) return false;
    if (filterSearch && !issue.title.toLowerCase().includes(filterSearch.toLowerCase())) return false;
    return true;
  });

  // DnD handlers
  const handleDragStart = (event: DragStartEvent) => {
    const issue = issues.find(i => i.id === event.active.id);
    setDraggingIssue(issue || null);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setDraggingIssue(null);
    const { active, over } = event;
    if (!over) return;
    const issueId = active.id as string;
    const newStatus = over.id as string;
    const issue = issues.find(i => i.id === issueId);
    if (!issue || issue.status === newStatus) return;

    // Optimistic update
    setIssues(prev => prev.map(i => i.id === issueId ? { ...i, status: newStatus as Issue['status'] } : i));

    try {
      const res = await fetch(`${API_URL}/api/v1/issues/${issueId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error('Failed');
    } catch {
      // Revert on error
      setIssues(prev => prev.map(i => i.id === issueId ? { ...i, status: issue.status } : i));
    }
  };

  const stats = {
    open: issues.filter(i => i.status === 'open').length,
    inProgress: issues.filter(i => i.status === 'in_progress').length,
    resolved: issues.filter(i => i.status === 'resolved').length,
    closed: issues.filter(i => i.status === 'closed').length,
    critical: issues.filter(i => i.priority === 'critical').length,
    needsCapa: issues.filter(i => i.needsCapa).length,
  };

  return (
    <>
      <div className="vn-page-header">
        <div>
          <h1>Triage Centre</h1>
          <p>{stats.open + stats.inProgress} open issues{stats.critical > 0 ? ` (${stats.critical} critical)` : ''}</p>
        </div>
        <div className="vn-page-actions">
          {/* View selector */}
          {views.length > 0 && (
            <select className="vn-filter-select" value={activeView} onChange={e => applyViewFilters(e.target.value)}>
              <option value="">All Issues</option>
              {views.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          )}
          {/* View mode toggle */}
          <div style={{ display: 'flex', border: '1px solid var(--outline-variant)', borderRadius: 'var(--border-radius-sm)', overflow: 'hidden' }}>
            <button className="vn-btn-icon" style={{ borderRadius: 0, background: viewMode === 'kanban' ? 'var(--surface-container)' : 'transparent' }} onClick={() => setViewMode('kanban')}>
              <span className="material-icons" style={{ fontSize: 20 }}>view_kanban</span>
            </button>
            <button className="vn-btn-icon" style={{ borderRadius: 0, background: viewMode === 'list' ? 'var(--surface-container)' : 'transparent' }} onClick={() => setViewMode('list')}>
              <span className="material-icons" style={{ fontSize: 20 }}>view_list</span>
            </button>
          </div>
          <button className="vn-btn vn-btn-primary" onClick={() => alert('Create issue modal coming soon')}>
            <span className="material-icons">add</span> Report Issue
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="vn-stats">
        <div className="vn-stat"><div className="vn-stat-icon info"><span className="material-icons">fiber_new</span></div><div><div className="vn-stat-value">{stats.open}</div><div className="vn-stat-label">Open</div></div></div>
        <div className="vn-stat"><div className="vn-stat-icon warning"><span className="material-icons">search</span></div><div><div className="vn-stat-value">{stats.inProgress}</div><div className="vn-stat-label">In Progress</div></div></div>
        <div className="vn-stat"><div className="vn-stat-icon success"><span className="material-icons">check_circle</span></div><div><div className="vn-stat-value">{stats.resolved}</div><div className="vn-stat-label">Resolved</div></div></div>
        <div className="vn-stat"><div className="vn-stat-icon error"><span className="material-icons">cancel</span></div><div><div className="vn-stat-value">{stats.closed}</div><div className="vn-stat-label">Closed</div></div></div>
        {stats.critical > 0 && <div className="vn-stat"><div className="vn-stat-icon error"><span className="material-icons">priority_high</span></div><div><div className="vn-stat-value">{stats.critical}</div><div className="vn-stat-label">Critical</div></div></div>}
        {stats.needsCapa > 0 && <div className="vn-stat"><div className="vn-stat-icon warning"><span className="material-icons">assignment_late</span></div><div><div className="vn-stat-value">{stats.needsCapa}</div><div className="vn-stat-label">Needs CAPA</div></div></div>}
      </div>

      {/* Filters */}
      <div className="vn-filters" style={{ marginBottom: 16 }}>
        <input className="vn-filter-input" placeholder="Search issues..." value={filterSearch} onChange={e => setFilterSearch(e.target.value)} style={{ minWidth: 200 }} />
        <select className="vn-filter-select" value={filterPriority} onChange={e => setFilterPriority(e.target.value)}>
          <option value="all">All Priorities</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <select className="vn-filter-select" value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
          <option value="all">All Categories</option>
          <option value="exception">Exception</option>
          <option value="delay">Delay</option>
          <option value="damage">Damage</option>
          <option value="compliance">Compliance</option>
          <option value="other">Other</option>
        </select>
        <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, cursor: 'pointer', color: 'var(--on-surface-variant)' }}>
          <input type="checkbox" checked={filterNeedsCapa} onChange={e => setFilterNeedsCapa(e.target.checked)} />
          Needs CAPA
        </label>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}><div className="loading-spinner" /></div>
      ) : viewMode === 'kanban' ? (
        <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="vn-kanban">
            {COLUMNS.map(col => (
              <DroppableColumn
                key={col.key}
                colKey={col.key}
                label={col.label}
                cssClass={col.cssClass}
                issues={filtered.filter(i => i.status === col.key)}
                onCardClick={(id) => navigate(`/issues/${id}`)}
              />
            ))}
          </div>
          <DragOverlay>
            {draggingIssue ? (
              <div className="vn-kanban-card" style={{ boxShadow: 'var(--modal-shadow)', transform: 'rotate(3deg)', width: 280 }}>
                <IssueCardContent issue={draggingIssue} />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      ) : (
        /* List view */
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
                  <th>Labels</th>
                  <th>Assignee</th>
                  <th>Status</th>
                  <th>CAPA</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(issue => (
                  <tr key={issue.id} onClick={() => navigate(`/issues/${issue.id}`)} style={{ cursor: 'pointer' }}>
                    <td><span className="vn-table-id">{issue.id.slice(0, 8)}</span></td>
                    <td style={{ maxWidth: 280 }}>{issue.title}</td>
                    <td><span className="vn-table-id">{issue.sourceEntityId?.slice(0, 8) || '-'}</span></td>
                    <td>{issue.category}</td>
                    <td><SeverityChip priority={issue.priority} /></td>
                    <td>
                      <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                        {(issue.labels || []).map(l => (
                          <span key={l.id} style={{ fontSize: 10, padding: '1px 5px', borderRadius: 8, background: l.color, color: '#fff' }}>{l.name}</span>
                        ))}
                      </div>
                    </td>
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
                    <td>{issue.needsCapa ? <span className="material-icons" style={{ fontSize: 16, color: 'var(--color-warning)' }}>assignment_late</span> : '-'}</td>
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
