import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { API_URL } from '../api';

/* ── Types ─────────────────────────────────────────────────── */

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

interface Stats {
  new: number;
  investigating: number;
  escalated: number;
  resolved: number;
}

interface BoardConfig {
  id: string;
  name: string;
  filters?: Record<string, string>;
}

type SortField = 'issueNumber' | 'title' | 'severity' | 'priority' | 'category' | 'assigneeName' | 'status' | 'createdAt' | 'signalScore';
type SortDir = 'asc' | 'desc';

/* ── Constants ─────────────────────────────────────────────── */

const COLUMNS: { key: string; label: string; cssClass: string; icon: string; variant: string }[] = [
  { key: 'new',           label: 'New',           cssClass: 'col-new',           icon: 'fiber_new',     variant: 'info' },
  { key: 'investigating', label: 'Investigating', cssClass: 'col-investigating', icon: 'search',        variant: 'warning' },
  { key: 'escalated',     label: 'Escalated',     cssClass: 'col-escalated',     icon: 'priority_high', variant: 'error' },
  { key: 'resolved',      label: 'Resolved',      cssClass: 'col-resolved',      icon: 'check_circle',  variant: 'success' },
];

const CATEGORIES = [
  'Pickup Delay', 'Delivery Delay', 'Delivery', 'Documentation',
  'Equipment', 'Communication', 'Compliance', 'Freight Damage',
  'Billing', 'Weather', 'Capacity', 'Customs', 'General',
];

/* ── Helpers ───────────────────────────────────────────────── */

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
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

/* ── Sub-components ────────────────────────────────────────── */

function SeverityChip({ severity }: { severity: string }) {
  const map: Record<string, string> = { high: 'error', medium: 'warning', low: 'secondary' };
  return (
    <span className={`vn-chip vn-chip-${map[severity] || 'secondary'}`} style={{ textTransform: 'capitalize' }}>
      {severity}
    </span>
  );
}

function StatusChip({ status }: { status: string }) {
  const map: Record<string, string> = { new: 'info', investigating: 'warning', escalated: 'error', resolved: 'success' };
  return (
    <span className={`vn-chip vn-chip-${map[status] || 'secondary'}`} style={{ textTransform: 'capitalize' }}>
      {status}
    </span>
  );
}

function PriorityBadge({ priority }: { priority: number }) {
  let bg = 'var(--surface-container-high)';
  let color = 'var(--on-surface-variant)';
  if (priority === 1) { bg = 'var(--error)'; color = 'var(--on-error)'; }
  else if (priority === 2) { bg = 'var(--warning)'; color = 'var(--on-warning)'; }
  else if (priority === 3) { bg = 'var(--primary)'; color = 'var(--on-primary)'; }
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      background: bg, color, fontWeight: 700, fontSize: 11,
      width: 28, height: 20, borderRadius: 4, letterSpacing: 0.5,
    }}>
      P{priority}
    </span>
  );
}

function SignalScoreBar({ score }: { score: number }) {
  let color = 'var(--error)';
  if (score >= 70) color = 'var(--success)';
  else if (score >= 40) color = 'var(--warning)';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{
        width: 40, height: 6, borderRadius: 3,
        background: 'var(--surface-container-high)', overflow: 'hidden',
      }}>
        <div style={{
          width: `${Math.min(100, Math.max(0, score))}%`, height: '100%',
          borderRadius: 3, background: color,
          transition: 'width 0.3s ease',
        }} />
      </div>
      <span style={{ fontSize: 11, fontWeight: 600, color }}>{score}</span>
    </div>
  );
}

/* ── Kanban Card ───────────────────────────────────────────── */

function KanbanCard({ issue, onClick }: { issue: Issue; onClick: () => void }) {
  const isNoise = issue.isNoise;

  return (
    <div
      className="vn-kanban-card"
      onClick={onClick}
      style={{
        cursor: 'pointer',
        opacity: isNoise ? 0.55 : 1,
        position: 'relative',
        borderLeft: issue.slaBreach ? '3px solid var(--error)' : undefined,
      }}
    >
      {/* SLA pulsing badge */}
      {issue.slaBreach && (
        <span style={{
          position: 'absolute', top: 8, right: 8,
          background: 'var(--error)', color: 'var(--on-error)',
          fontSize: 10, fontWeight: 700, padding: '2px 6px',
          borderRadius: 4, letterSpacing: 0.5,
          animation: 'triage-sla-pulse 1.5s ease-in-out infinite',
        }}>
          SLA
        </span>
      )}

      {/* Row 1: issue number + severity + priority */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, gap: 4 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--on-surface-variant)' }}>
          {issue.issueNumber}
        </span>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <PriorityBadge priority={issue.priority} />
          <SeverityChip severity={issue.severity} />
        </div>
      </div>

      {/* Title */}
      <div className="vn-kanban-card-title">{issue.title}</div>

      {/* Noise chip */}
      {isNoise && (
        <div style={{ marginBottom: 4 }}>
          <span className="vn-chip vn-chip-secondary" style={{ fontSize: 10 }}>
            <span className="material-icons" style={{ fontSize: 12 }}>volume_off</span>
            Noise
          </span>
        </div>
      )}

      {/* Category */}
      {issue.category && (
        <div className="vn-kanban-card-meta">
          <span className="material-icons">category</span>
          {issue.category}
        </div>
      )}

      {/* Signal score */}
      <div style={{ marginTop: 4, marginBottom: 2 }}>
        <SignalScoreBar score={issue.signalScore} />
      </div>

      {/* Footer: assignee + time */}
      <div className="vn-kanban-card-footer">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {issue.assigneeName ? (
            <>
              <div className="vn-kanban-card-assignee">{initials(issue.assigneeName)}</div>
              <span style={{ fontSize: 12, color: 'var(--on-surface-variant)' }}>{issue.assigneeName}</span>
            </>
          ) : (
            <span style={{ fontSize: 12, color: 'var(--on-surface-variant)', fontStyle: 'italic' }}>
              Unassigned
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {issue.activityCount > 0 && (
            <span style={{ fontSize: 11, color: 'var(--on-surface-variant)', display: 'flex', alignItems: 'center', gap: 2 }}>
              <span className="material-icons" style={{ fontSize: 13 }}>chat_bubble_outline</span>
              {issue.activityCount}
            </span>
          )}
          <span style={{ fontSize: 11, color: 'var(--on-surface-variant)' }}>{timeAgo(issue.createdAt)}</span>
        </div>
      </div>
    </div>
  );
}

/* ── Main Component ────────────────────────────────────────── */

export default function VNextTriageBoard() {
  const { boardId } = useParams<{ boardId?: string }>();
  const navigate = useNavigate();

  /* state */
  const [issues, setIssues] = useState<Issue[]>([]);
  const [stats, setStats] = useState<Stats>({ new: 0, investigating: 0, escalated: 0, resolved: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [boardConfig, setBoardConfig] = useState<BoardConfig | null>(null);

  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');

  /* filters */
  const [searchText, setSearchText] = useState('');
  const [filterSeverity, setFilterSeverity] = useState('all');
  const [filterPriority, setFilterPriority] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterAssignee, setFilterAssignee] = useState('all');
  const [filterSource, setFilterSource] = useState('all');

  /* sort (list view) */
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  /* create modal */
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ title: '', description: '', severity: 'medium', priority: 3, category: '' });
  const [createLoading, setCreateLoading] = useState(false);

  /* save-board modal */
  const [showSaveBoard, setShowSaveBoard] = useState(false);
  const [boardName, setBoardName] = useState('');
  const [savingBoard, setSavingBoard] = useState(false);

  /* ── Fetchers ────────────────────────────────────────────── */

  const buildQueryString = useCallback(() => {
    const params = new URLSearchParams();
    params.set('limit', '500');
    if (filterSeverity !== 'all') params.set('severity', filterSeverity);
    if (filterPriority !== 'all') params.set('priority', filterPriority);
    if (filterCategory !== 'all') params.set('category', filterCategory);
    if (filterSource !== 'all') params.set('source', filterSource);
    if (searchText.trim()) params.set('search', searchText.trim());
    return params.toString();
  }, [filterSeverity, filterPriority, filterCategory, filterSource, searchText]);

  const fetchIssues = useCallback(async () => {
    try {
      const qs = buildQueryString();
      const res = await fetch(`${API_URL}/api/v1/issues?${qs}`);
      const json = await res.json();
      if (json.data) setIssues(json.data.issues || json.data || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [buildQueryString]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/v1/issues/stats`);
      const json = await res.json();
      if (json.data) setStats(json.data);
    } catch {
      /* stats are decorative */
    }
  }, []);

  const fetchBoard = useCallback(async (id: string) => {
    try {
      const res = await fetch(`${API_URL}/api/v1/triage-boards/${id}`);
      const json = await res.json();
      if (json.data) {
        setBoardConfig(json.data);
        const f = json.data.filters || {};
        if (f.severity) setFilterSeverity(f.severity);
        if (f.priority) setFilterPriority(f.priority);
        if (f.category) setFilterCategory(f.category);
        if (f.source) setFilterSource(f.source);
        if (f.search) setSearchText(f.search);
      }
    } catch {
      /* board not found, show all */
    }
  }, []);

  useEffect(() => {
    if (boardId) fetchBoard(boardId);
  }, [boardId, fetchBoard]);

  useEffect(() => {
    fetchIssues();
    fetchStats();
  }, [fetchIssues, fetchStats]);

  /* ── Transition ──────────────────────────────────────────── */

  const transitionIssue = async (issueId: string, newStatus: string) => {
    try {
      await fetch(`${API_URL}/api/v1/issues/${issueId}/transition`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      await Promise.all([fetchIssues(), fetchStats()]);
    } catch {
      /* ignore */
    }
  };

  /* ── Create ──────────────────────────────────────────────── */

  const handleCreate = async () => {
    if (!createForm.title.trim()) return;
    setCreateLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/issues`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...createForm, orgId: 'default' }),
      });
      const json = await res.json();
      if (json.data) {
        setShowCreate(false);
        setCreateForm({ title: '', description: '', severity: 'medium', priority: 3, category: '' });
        await Promise.all([fetchIssues(), fetchStats()]);
      }
    } catch {
      /* ignore */
    } finally {
      setCreateLoading(false);
    }
  };

  /* ── Save Board ──────────────────────────────────────────── */

  const hasActiveFilters = filterSeverity !== 'all' || filterPriority !== 'all'
    || filterCategory !== 'all' || filterAssignee !== 'all'
    || filterSource !== 'all' || searchText.trim() !== '';

  const handleSaveBoard = async () => {
    if (!boardName.trim()) return;
    setSavingBoard(true);
    try {
      const filters: Record<string, string> = {};
      if (filterSeverity !== 'all') filters.severity = filterSeverity;
      if (filterPriority !== 'all') filters.priority = filterPriority;
      if (filterCategory !== 'all') filters.category = filterCategory;
      if (filterSource !== 'all') filters.source = filterSource;
      if (searchText.trim()) filters.search = searchText.trim();

      await fetch(`${API_URL}/api/v1/triage-boards`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: boardName.trim(), filters }),
      });
      setShowSaveBoard(false);
      setBoardName('');
    } catch {
      /* ignore */
    } finally {
      setSavingBoard(false);
    }
  };

  /* ── Filtering & Sorting ─────────────────────────────────── */

  const filtered = useMemo(() => {
    let result = [...issues];

    if (filterAssignee === 'unassigned') {
      result = result.filter(i => !i.assigneeName);
    } else if (filterAssignee !== 'all') {
      result = result.filter(i => i.assigneeName === filterAssignee);
    }

    return result;
  }, [issues, filterAssignee]);

  const sorted = useMemo(() => {
    if (viewMode !== 'list') return filtered;
    const arr = [...filtered];
    arr.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'issueNumber': cmp = a.issueNumber.localeCompare(b.issueNumber); break;
        case 'title': cmp = a.title.localeCompare(b.title); break;
        case 'severity': {
          const order: Record<string, number> = { high: 0, medium: 1, low: 2 };
          cmp = (order[a.severity] ?? 9) - (order[b.severity] ?? 9);
          break;
        }
        case 'priority': cmp = a.priority - b.priority; break;
        case 'category': cmp = (a.category || '').localeCompare(b.category || ''); break;
        case 'assigneeName': cmp = (a.assigneeName || 'zzz').localeCompare(b.assigneeName || 'zzz'); break;
        case 'status': cmp = a.status.localeCompare(b.status); break;
        case 'signalScore': cmp = a.signalScore - b.signalScore; break;
        case 'createdAt': cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(); break;
        default: cmp = 0;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return arr;
  }, [filtered, sortField, sortDir, viewMode]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const sortIcon = (field: SortField) => {
    if (sortField !== field) return 'unfold_more';
    return sortDir === 'asc' ? 'arrow_upward' : 'arrow_downward';
  };

  /* unique assignees for filter dropdown */
  const assigneeOptions = useMemo(() => {
    const names = new Set(issues.filter(i => i.assigneeName).map(i => i.assigneeName!));
    return Array.from(names).sort();
  }, [issues]);

  /* ── Render ──────────────────────────────────────────────── */

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 80 }}>
        <div className="loading-spinner" />
      </div>
    );
  }

  return (
    <>
      {/* inline keyframes for SLA pulse */}
      <style>{`
        @keyframes triage-sla-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(1.08); }
        }
      `}</style>

      {/* ── Page Header ────────────────────────────────────── */}
      <div className="vn-page-header">
        <div>
          <h1>{boardConfig ? boardConfig.name : 'Triage Centre'}</h1>
          <p>{filtered.length} issue{filtered.length !== 1 ? 's' : ''}{boardConfig ? ' — saved board' : ''}</p>
        </div>
        <div className="vn-page-actions">
          {/* View mode toggle */}
          <div style={{
            display: 'flex',
            border: '1px solid var(--outline-variant)',
            borderRadius: 'var(--border-radius-sm)',
            overflow: 'hidden',
          }}>
            <button
              className="vn-btn-icon"
              style={{
                borderRadius: 0,
                background: viewMode === 'kanban' ? 'var(--primary)' : 'transparent',
                color: viewMode === 'kanban' ? 'var(--on-primary)' : 'var(--on-surface-variant)',
              }}
              onClick={() => setViewMode('kanban')}
              title="Kanban view"
            >
              <span className="material-icons" style={{ fontSize: 20 }}>view_kanban</span>
            </button>
            <button
              className="vn-btn-icon"
              style={{
                borderRadius: 0,
                background: viewMode === 'list' ? 'var(--primary)' : 'transparent',
                color: viewMode === 'list' ? 'var(--on-primary)' : 'var(--on-surface-variant)',
              }}
              onClick={() => setViewMode('list')}
              title="List view"
            >
              <span className="material-icons" style={{ fontSize: 20 }}>view_list</span>
            </button>
          </div>

          {hasActiveFilters && (
            <button className="vn-btn vn-btn-outline" onClick={() => setShowSaveBoard(true)}>
              <span className="material-icons">bookmark_add</span>
              Save as Board
            </button>
          )}

          <button className="vn-btn vn-btn-primary" onClick={() => setShowCreate(true)}>
            <span className="material-icons">add</span>
            Create Issue
          </button>
        </div>
      </div>

      {error && (
        <div className="vn-alert vn-alert-warning" style={{ marginBottom: 16 }}>
          <span className="material-icons">warning</span>
          Unable to load issues — check backend connection.
        </div>
      )}

      {/* ── Stats Row ──────────────────────────────────────── */}
      <div className="vn-stats">
        {COLUMNS.map(col => (
          <div className="vn-stat" key={col.key}>
            <div className={`vn-stat-icon ${col.variant}`}>
              <span className="material-icons">{col.icon}</span>
            </div>
            <div>
              <div className="vn-stat-value">{stats[col.key as keyof Stats] ?? 0}</div>
              <div className="vn-stat-label">{col.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Filter Bar ─────────────────────────────────────── */}
      <div className="vn-card" style={{ marginBottom: 20 }}>
        <div className="vn-filters">
          <div className="vn-filter-group">
            <span className="material-icons">search</span>
            <input
              className="vn-filter-input"
              placeholder="Search issues..."
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
            />
          </div>
          <select className="vn-filter-select" value={filterSeverity} onChange={e => setFilterSeverity(e.target.value)}>
            <option value="all">All Severities</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          <select className="vn-filter-select" value={filterPriority} onChange={e => setFilterPriority(e.target.value)}>
            <option value="all">All Priorities</option>
            <option value="1">P1 — Critical</option>
            <option value="2">P2 — High</option>
            <option value="3">P3 — Medium</option>
            <option value="4">P4 — Low</option>
            <option value="5">P5 — Minimal</option>
          </select>
          <select className="vn-filter-select" value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
            <option value="all">All Categories</option>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select className="vn-filter-select" value={filterAssignee} onChange={e => setFilterAssignee(e.target.value)}>
            <option value="all">All Assignees</option>
            <option value="unassigned">Unassigned</option>
            {assigneeOptions.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          <select className="vn-filter-select" value={filterSource} onChange={e => setFilterSource(e.target.value)}>
            <option value="all">All Sources</option>
            <option value="manual">Manual</option>
            <option value="auto">Auto</option>
          </select>

          {hasActiveFilters && (
            <button
              className="vn-btn vn-btn-sm vn-btn-ghost"
              onClick={() => {
                setSearchText(''); setFilterSeverity('all'); setFilterPriority('all');
                setFilterCategory('all'); setFilterAssignee('all'); setFilterSource('all');
              }}
              style={{ marginLeft: 'auto' }}
            >
              <span className="material-icons" style={{ fontSize: 16 }}>close</span>
              Clear
            </button>
          )}
        </div>
      </div>

      {/* ── Kanban View ────────────────────────────────────── */}
      {viewMode === 'kanban' && (
        <div className="vn-kanban">
          {COLUMNS.map(col => {
            const colIssues = sorted.filter(i => i.status === col.key);
            return (
              <div key={col.key} className={`vn-kanban-col ${col.cssClass}`}>
                <div className="vn-kanban-col-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="material-icons" style={{ fontSize: 18, color: `var(--${col.variant})` }}>
                      {col.icon}
                    </span>
                    <span>{col.label}</span>
                  </div>
                  <span className="vn-count">{colIssues.length}</span>
                </div>
                <div className="vn-kanban-cards">
                  {colIssues.map(issue => (
                    <KanbanCard
                      key={issue.id}
                      issue={issue}
                      onClick={() => navigate(`/triage/issues/${issue.id}`)}
                    />
                  ))}
                  {colIssues.length === 0 && (
                    <div style={{
                      textAlign: 'center', padding: 32,
                      color: 'var(--on-surface-variant)', fontSize: 13,
                    }}>
                      <span className="material-icons" style={{ fontSize: 32, display: 'block', marginBottom: 8, opacity: 0.4 }}>
                        inbox
                      </span>
                      No issues
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── List View ──────────────────────────────────────── */}
      {viewMode === 'list' && (
        <div className="vn-card">
          <div className="vn-table-wrap">
            <table className="vn-table">
              <thead>
                <tr>
                  {([
                    ['issueNumber', 'ID'],
                    ['title', 'Issue'],
                    ['severity', 'Severity'],
                    ['priority', 'Priority'],
                    ['category', 'Category'],
                    ['signalScore', 'Signal'],
                    ['assigneeName', 'Assignee'],
                    ['status', 'Status'],
                    ['createdAt', 'Created'],
                  ] as [SortField, string][]).map(([field, label]) => (
                    <th
                      key={field}
                      onClick={() => handleSort(field)}
                      style={{ cursor: 'pointer', userSelect: 'none' }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        {label}
                        <span className="material-icons" style={{ fontSize: 14, opacity: sortField === field ? 1 : 0.3 }}>
                          {sortIcon(field)}
                        </span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.map(issue => (
                  <tr
                    key={issue.id}
                    onClick={() => navigate(`/triage/issues/${issue.id}`)}
                    style={{
                      cursor: 'pointer',
                      opacity: issue.isNoise ? 0.55 : 1,
                    }}
                  >
                    <td>
                      <span className="vn-table-id">{issue.issueNumber}</span>
                      {issue.slaBreach && (
                        <span style={{
                          marginLeft: 6,
                          background: 'var(--error)', color: 'var(--on-error)',
                          fontSize: 9, fontWeight: 700, padding: '1px 5px',
                          borderRadius: 3, verticalAlign: 'middle',
                          animation: 'triage-sla-pulse 1.5s ease-in-out infinite',
                        }}>
                          SLA
                        </span>
                      )}
                    </td>
                    <td style={{ maxWidth: 260 }}>
                      <div style={{ fontWeight: 500 }}>{issue.title}</div>
                      {issue.isNoise && (
                        <span className="vn-chip vn-chip-secondary" style={{ fontSize: 10, marginTop: 2 }}>
                          Noise
                        </span>
                      )}
                    </td>
                    <td><SeverityChip severity={issue.severity} /></td>
                    <td><PriorityBadge priority={issue.priority} /></td>
                    <td>
                      {issue.category ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13 }}>
                          <span className="material-icons" style={{ fontSize: 15, color: 'var(--on-surface-variant)' }}>
                            category
                          </span>
                          {issue.category}
                        </div>
                      ) : (
                        <span style={{ color: 'var(--on-surface-variant)' }}>--</span>
                      )}
                    </td>
                    <td><SignalScoreBar score={issue.signalScore} /></td>
                    <td>
                      {issue.assigneeName ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div className="vn-kanban-card-assignee">{initials(issue.assigneeName)}</div>
                          <span style={{ fontSize: 13 }}>{issue.assigneeName}</span>
                        </div>
                      ) : (
                        <span style={{ color: 'var(--on-surface-variant)', fontStyle: 'italic', fontSize: 13 }}>
                          Unassigned
                        </span>
                      )}
                    </td>
                    <td><StatusChip status={issue.status} /></td>
                    <td style={{ fontSize: 13, whiteSpace: 'nowrap' }}>{timeAgo(issue.createdAt)}</td>
                  </tr>
                ))}
                {sorted.length === 0 && (
                  <tr>
                    <td colSpan={9} style={{ textAlign: 'center', padding: 48, color: 'var(--on-surface-variant)' }}>
                      <span className="material-icons" style={{ fontSize: 40, display: 'block', marginBottom: 8, opacity: 0.3 }}>
                        search_off
                      </span>
                      No issues match your filters
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Create Issue Modal ─────────────────────────────── */}
      {showCreate && (
        <div className="vn-modal-backdrop" onClick={() => setShowCreate(false)}>
          <div className="vn-modal" style={{ maxWidth: 540 }} onClick={e => e.stopPropagation()}>
            <div className="vn-modal-header">
              <h2 style={{ fontSize: 18, margin: 0 }}>Create Issue</h2>
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
                      style={{ width: '100%' }}
                      value={createForm.severity}
                      onChange={e => setCreateForm(f => ({ ...f, severity: e.target.value }))}
                    >
                      <option value="high">High</option>
                      <option value="medium">Medium</option>
                      <option value="low">Low</option>
                    </select>
                  </div>
                  <div className="vn-field">
                    <label className="vn-field-label">Priority</label>
                    <select
                      className="vn-filter-select"
                      style={{ width: '100%' }}
                      value={createForm.priority}
                      onChange={e => setCreateForm(f => ({ ...f, priority: parseInt(e.target.value) }))}
                    >
                      <option value={1}>P1 — Critical</option>
                      <option value={2}>P2 — High</option>
                      <option value={3}>P3 — Medium</option>
                      <option value={4}>P4 — Low</option>
                      <option value={5}>P5 — Minimal</option>
                    </select>
                  </div>
                </div>
                <div className="vn-field">
                  <label className="vn-field-label">Category</label>
                  <select
                    className="vn-filter-select"
                    style={{ width: '100%' }}
                    value={createForm.category}
                    onChange={e => setCreateForm(f => ({ ...f, category: e.target.value }))}
                  >
                    <option value="">Select category...</option>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
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

      {/* ── Save Board Modal ───────────────────────────────── */}
      {showSaveBoard && (
        <div className="vn-modal-backdrop" onClick={() => setShowSaveBoard(false)}>
          <div className="vn-modal vn-modal-sm" onClick={e => e.stopPropagation()}>
            <div className="vn-modal-header">
              <h2 style={{ fontSize: 18, margin: 0 }}>Save as Board</h2>
              <button className="vn-btn-icon" onClick={() => setShowSaveBoard(false)}>
                <span className="material-icons">close</span>
              </button>
            </div>
            <div className="vn-modal-body">
              <div className="vn-field">
                <label className="vn-field-label">Board Name *</label>
                <input
                  className="vn-input"
                  value={boardName}
                  onChange={e => setBoardName(e.target.value)}
                  placeholder="e.g. High Priority Freight Damage"
                />
              </div>
              <div style={{ marginTop: 12, fontSize: 13, color: 'var(--on-surface-variant)' }}>
                <strong>Active filters:</strong>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
                  {filterSeverity !== 'all' && <span className="vn-chip vn-chip-secondary">Severity: {filterSeverity}</span>}
                  {filterPriority !== 'all' && <span className="vn-chip vn-chip-secondary">Priority: P{filterPriority}</span>}
                  {filterCategory !== 'all' && <span className="vn-chip vn-chip-secondary">Category: {filterCategory}</span>}
                  {filterSource !== 'all' && <span className="vn-chip vn-chip-secondary">Source: {filterSource}</span>}
                  {searchText.trim() && <span className="vn-chip vn-chip-secondary">Search: {searchText}</span>}
                </div>
              </div>
            </div>
            <div className="vn-modal-footer">
              <button className="vn-btn vn-btn-outline" onClick={() => setShowSaveBoard(false)}>Cancel</button>
              <button
                className="vn-btn vn-btn-primary"
                onClick={handleSaveBoard}
                disabled={!boardName.trim() || savingBoard}
              >
                {savingBoard ? 'Saving...' : 'Save Board'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
