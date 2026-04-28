import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  useDroppable,
  useDraggable,
} from '@dnd-kit/core';
import {
  AlertOctagon,
  AlertTriangle,
  Building2,
  CheckCircle2,
  ClipboardList,
  CircleAlert,
  FilePlus,
  Inbox,
  LayoutList,
  Loader2,
  MessageSquare,
  Package,
  Plus,
  Search,
  Tags,
  Timer,
  Truck,
  Users,
  X,
  XCircle,
} from 'lucide-react';

import { API_URL } from '../api';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

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

interface KanbanViewDef { id: string; name: string; filters: any; groupBy: string; sortBy: string; isDefault: boolean; }

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

const COLUMNS: { key: Issue['status']; label: string }[] = [
  { key: 'open', label: 'Open' },
  { key: 'in_progress', label: 'In progress' },
  { key: 'resolved', label: 'Resolved' },
  { key: 'closed', label: 'Closed' },
];

type BadgeVariant = 'success' | 'destructive' | 'warning' | 'info' | 'secondary' | 'muted' | 'default';

function priorityVariant(priority: Issue['priority']): BadgeVariant {
  if (priority === 'critical' || priority === 'high') return 'destructive';
  if (priority === 'medium') return 'warning';
  return 'secondary';
}

function statusVariant(status: Issue['status']): BadgeVariant {
  if (status === 'open') return 'info';
  if (status === 'in_progress') return 'warning';
  if (status === 'resolved') return 'success';
  return 'secondary';
}

function entityIcon(entityType: string | null) {
  if (entityType === 'order') return Package;
  if (entityType === 'carrier') return Building2;
  return Truck;
}

function DraggableIssueCard({ issue, onClick }: { issue: Issue; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: issue.id });
  const style: React.CSSProperties = {
    opacity: isDragging ? 0.4 : 1,
    transform: transform ? `translate(${transform.x}px, ${transform.y}px)` : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className="cursor-grab rounded-md border border-border bg-card p-3 shadow-sm transition-colors hover:border-primary/40 active:cursor-grabbing"
      onClick={(e) => { e.stopPropagation(); onClick(); }}
    >
      <IssueCardContent issue={issue} />
    </div>
  );
}

function IssueCardContent({ issue }: { issue: Issue }) {
  const isSnoozed = issue.snoozedUntil && new Date(issue.snoozedUntil) > new Date();
  const SourceIcon = entityIcon(issue.sourceEntityType);
  return (
    <>
      <div className="mb-1.5 flex items-start justify-between gap-2">
        <span className="font-mono text-xs font-semibold text-muted-foreground">{issue.id.slice(0, 8)}</span>
        <div className="flex items-center gap-1">
          {issue.needsCapa && (
            <ClipboardList className="h-3.5 w-3.5 text-warning" />
          )}
          {isSnoozed && (
            <Timer className="h-3.5 w-3.5 text-muted-foreground" />
          )}
          <Badge variant={priorityVariant(issue.priority)} className="capitalize">{issue.priority}</Badge>
        </div>
      </div>
      <div className="text-sm font-medium">{issue.title}</div>
      {issue.sourceEntityId && (
        <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
          <SourceIcon className="h-3 w-3" />
          {issue.sourceEntityId.slice(0, 8)}
        </div>
      )}
      <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
        <Tags className="h-3 w-3" />
        {issue.category}
      </div>
      {issue.labels && issue.labels.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {issue.labels.map(l => (
            <span
              key={l.id}
              className="rounded px-1.5 py-0.5 text-[10px] font-semibold text-white"
              style={{ background: l.color }}
            >
              {l.name}
            </span>
          ))}
        </div>
      )}
      {issue._sla && (
        <div className={cn(
          'mt-1.5 inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-semibold text-white',
          issue._sla.status === 'breached' ? 'bg-destructive' : issue._sla.status === 'warning' ? 'bg-warning' : 'bg-info',
        )}>
          <Timer className="h-3 w-3" />
          {issue._sla.ruleName} - {issue._sla.status}
          {issue._sla.slaDueAt && issue._sla.status !== 'breached' && (() => {
            const mins = Math.round((new Date(issue._sla!.slaDueAt!).getTime() - Date.now()) / 60_000);
            return mins > 0 ? ` (${mins < 60 ? `${mins}m` : `${Math.floor(mins / 60)}h`})` : '';
          })()}
        </div>
      )}
      <div className="mt-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/15 text-[10px] font-semibold text-primary">
            {getInitials(issue.assigneeName)}
          </div>
          <span className="text-xs text-muted-foreground">{issue.assigneeName || 'Unassigned'}</span>
        </div>
        <div className="flex items-center gap-2">
          {issue.commentCount > 0 && (
            <span className="flex items-center gap-0.5 text-[11px] text-muted-foreground">
              <MessageSquare className="h-3 w-3" />
              {issue.commentCount}
            </span>
          )}
          <span className="text-[11px] text-muted-foreground">{timeAgo(issue.createdAt)}</span>
        </div>
      </div>
    </>
  );
}

function DroppableColumn({ colKey, label, issues, onCardClick }: {
  colKey: string; label: string; issues: Issue[]; onCardClick: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: colKey });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex h-full min-w-[280px] flex-1 flex-col rounded-lg border border-border bg-card transition-colors',
        isOver && 'bg-muted',
      )}
    >
      <div className="flex items-center justify-between border-b border-border p-3">
        <h3 className="text-sm font-semibold">{label}</h3>
        <Badge variant="muted">{issues.length}</Badge>
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto p-3">
        {issues.map(issue => (
          <DraggableIssueCard key={issue.id} issue={issue} onClick={() => onCardClick(issue.id)} />
        ))}
        {issues.length === 0 && (
          <div className="py-6 text-center text-sm text-muted-foreground">No issues</div>
        )}
      </div>
    </div>
  );
}

function EntitySearchField({ entityType, value, onSelect }: {
  entityType: string;
  value: string;
  onSelect: (id: string, label: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Array<{ id: string; label: string; sub: string }>>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedLabel, setSelectedLabel] = useState('');
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setShowDropdown(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    setQuery('');
    setResults([]);
    setSelectedLabel('');
  }, [entityType]);

  const search = useCallback((q: string) => {
    if (!entityType || q.length < 1) { setResults([]); return; }
    setLoading(true);
    const endpoint = entityType === 'shipment' ? 'shipments' : entityType === 'order' ? 'orders' : 'carriers';
    fetch(`${API_URL}/api/v1/${endpoint}`)
      .then(r => r.json())
      .then(json => {
        const items = json.data || [];
        const qLower = q.toLowerCase();
        const mapped = items
          .map((item: any) => {
            if (entityType === 'shipment') {
              return {
                id: item.id,
                label: item.reference || item.id.slice(0, 8),
                sub: `${item.status || ''} - ${item.customer?.name || item.origin?.name || ''}`.trim(),
              };
            }
            if (entityType === 'order') {
              return {
                id: item.id,
                label: item.reference || item.id.slice(0, 8),
                sub: `${item.status || ''} - ${item.customer?.name || ''}`.trim(),
              };
            }
            return {
              id: item.id,
              label: item.name || item.id.slice(0, 8),
              sub: item.contactEmail || '',
            };
          })
          .filter((r: any) =>
            r.label.toLowerCase().includes(qLower) ||
            r.sub.toLowerCase().includes(qLower) ||
            r.id.toLowerCase().includes(qLower)
          )
          .slice(0, 10);
        setResults(mapped);
      })
      .catch(() => setResults([]))
      .finally(() => setLoading(false));
  }, [entityType]);

  const handleInputChange = (val: string) => {
    setQuery(val);
    setShowDropdown(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(val), 250);
  };

  const handleSelect = (r: { id: string; label: string }) => {
    onSelect(r.id, r.label);
    setSelectedLabel(r.label);
    setQuery('');
    setShowDropdown(false);
  };

  if (!entityType) {
    return (
      <div className="space-y-1">
        <Input disabled placeholder="Select an entity type first" />
        <span className="text-xs text-muted-foreground">Select an entity type first</span>
      </div>
    );
  }

  const Icon = entityIcon(entityType);

  return (
    <div ref={wrapperRef} className="relative">
      {value && selectedLabel ? (
        <div className="flex items-center gap-2 rounded-md border border-input bg-muted px-3 py-2">
          <Icon className="h-4 w-4 text-primary" />
          <span className="flex-1 text-sm font-semibold">{selectedLabel}</span>
          <span className="text-xs text-muted-foreground">{value.slice(0, 8)}</span>
          <Button variant="ghost" size="icon" type="button" onClick={() => { onSelect('', ''); setSelectedLabel(''); }}>
            <X className="h-3 w-3" />
          </Button>
        </div>
      ) : (
        <Input
          placeholder={`Search ${entityType}s by reference, name, or ID...`}
          value={query}
          onChange={e => handleInputChange(e.target.value)}
          onFocus={() => { if (query.length >= 1 || results.length > 0) setShowDropdown(true); }}
        />
      )}
      {showDropdown && (query.length >= 1 || results.length > 0) && (
        <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-60 overflow-y-auto rounded-md border border-border bg-popover shadow-lg">
          {loading && <div className="p-3 text-center text-xs text-muted-foreground">Searching...</div>}
          {!loading && results.length === 0 && query.length >= 1 && (
            <div className="p-3 text-center text-xs text-muted-foreground">No results found</div>
          )}
          {results.map(r => (
            <button
              key={r.id}
              type="button"
              onClick={() => handleSelect(r)}
              className="flex w-full items-center gap-2 border-b border-border px-3 py-2 text-left transition-colors last:border-b-0 hover:bg-muted"
            >
              <Icon className="h-4 w-4 text-muted-foreground" />
              <div className="flex-1">
                <div className="text-sm font-semibold">{r.label}</div>
                {r.sub && <div className="text-xs text-muted-foreground">{r.sub}</div>}
              </div>
              <span className="font-mono text-[10px] text-muted-foreground">{r.id.slice(0, 8)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function CreateIssueModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    title: '',
    description: '',
    priority: 'medium',
    category: 'exception',
    sourceEntityType: '',
    sourceEntityId: '',
    sourceEntityLabel: '',
    assigneeName: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const update = (field: string, value: string) => setForm(prev => ({ ...prev, [field]: value }));

  const handleSubmit = async () => {
    if (!form.title.trim()) { setError('Title is required'); return; }
    setSubmitting(true);
    setError('');
    try {
      const body: Record<string, unknown> = {
        title: form.title,
        category: form.category,
        priority: form.priority,
      };
      if (form.description.trim()) body.description = form.description;
      if (form.sourceEntityType) body.sourceEntityType = form.sourceEntityType;
      if (form.sourceEntityId.trim()) body.sourceEntityId = form.sourceEntityId;
      if (form.assigneeName.trim()) {
        body.assigneeName = form.assigneeName;
        body.assigneeId = form.assigneeName.toLowerCase().replace(/\s+/g, '.');
      }

      const res = await fetch(`${API_URL}/api/v1/issues`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();

      if (!res.ok || json.error) {
        setError(json.error || 'Failed to create issue');
        setSubmitting(false);
        return;
      }

      const newId = json.data?.id;
      onClose();
      onCreated();
      if (newId) navigate(`/issues/${newId}`);
    } catch {
      setError('Network error');
    }
    setSubmitting(false);
  };

  useEffect(() => {
    if (open) {
      setForm({ title: '', description: '', priority: 'medium', category: 'exception', sourceEntityType: '', sourceEntityId: '', sourceEntityLabel: '', assigneeName: '' });
      setError('');
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>Report issue</DialogTitle>
        </DialogHeader>

        {error && (
          <div className="flex items-center gap-3 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            <CircleAlert className="h-4 w-4" />
            {error}
          </div>
        )}

        <div className="grid gap-3 md:grid-cols-2">
          <div className="md:col-span-2 space-y-2">
            <Label>Title *</Label>
            <Input placeholder="Brief description of the issue" value={form.title} onChange={e => update('title', e.target.value)} autoFocus />
          </div>
          <div className="md:col-span-2 space-y-2">
            <Label>Description</Label>
            <textarea
              rows={3}
              placeholder="Detailed description, context, impact..."
              value={form.description}
              onChange={e => update('description', e.target.value)}
              className="w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          <div className="space-y-2">
            <Label>Priority</Label>
            <Select value={form.priority} onValueChange={v => update('priority', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Category</Label>
            <Select value={form.category} onValueChange={v => update('category', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="exception">Exception</SelectItem>
                <SelectItem value="delay">Delay</SelectItem>
                <SelectItem value="damage">Damage</SelectItem>
                <SelectItem value="compliance">Compliance</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Linked entity type</Label>
            <Select
              value={form.sourceEntityType || 'none'}
              onValueChange={v => {
                const next = v === 'none' ? '' : v;
                update('sourceEntityType', next);
                update('sourceEntityId', '');
                update('sourceEntityLabel', '');
              }}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                <SelectItem value="shipment">Shipment</SelectItem>
                <SelectItem value="order">Order</SelectItem>
                <SelectItem value="carrier">Carrier</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Linked {form.sourceEntityType ? form.sourceEntityType.charAt(0).toUpperCase() + form.sourceEntityType.slice(1) : 'entity'}</Label>
            <EntitySearchField
              entityType={form.sourceEntityType}
              value={form.sourceEntityId}
              onSelect={(id, label) => { update('sourceEntityId', id); update('sourceEntityLabel', label); }}
            />
          </div>
          <div className="md:col-span-2 space-y-2">
            <Label>Assign to</Label>
            <Input placeholder="Assignee name (optional)" value={form.assigneeName} onChange={e => update('assigneeName', e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button variant="gradient" onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Creating...' : 'Create issue'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function VNextIssueKanban() {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [draggingIssue, setDraggingIssue] = useState<Issue | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const [filterPriority, setFilterPriority] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterSearch, setFilterSearch] = useState('');
  const [filterNeedsCapa, setFilterNeedsCapa] = useState(false);

  const [views, setViews] = useState<KanbanViewDef[]>([]);
  const [activeView, setActiveView] = useState('all');

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
    fetch(`${API_URL}/api/v1/kanban-views`).then(r => r.json()).then(json => setViews(json.data || [])).catch(() => {});
    refreshRef.current = setInterval(loadData, 30000);
    return () => { if (refreshRef.current) clearInterval(refreshRef.current); };
  }, [loadData]);

  const applyViewFilters = (viewId: string) => {
    setActiveView(viewId);
    if (viewId === 'all') { setFilterPriority('all'); setFilterCategory('all'); setFilterSearch(''); setFilterNeedsCapa(false); return; }
    const view = views.find(v => v.id === viewId);
    if (!view) return;
    const f = view.filters || {};
    if (f.priority) setFilterPriority(f.priority);
    if (f.category) setFilterCategory(f.category);
    if (f.search) setFilterSearch(f.search);
    if (f.needsCapa) setFilterNeedsCapa(true);
  };

  const filtered = issues.filter(issue => {
    if (filterPriority !== 'all' && issue.priority !== filterPriority) return false;
    if (filterCategory !== 'all' && issue.category !== filterCategory) return false;
    if (filterNeedsCapa && !issue.needsCapa) return false;
    if (filterSearch && !issue.title.toLowerCase().includes(filterSearch.toLowerCase())) return false;
    return true;
  });

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

    setIssues(prev => prev.map(i => i.id === issueId ? { ...i, status: newStatus as Issue['status'] } : i));

    try {
      const res = await fetch(`${API_URL}/api/v1/issues/${issueId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error('Failed');
    } catch {
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

  const statTiles = [
    { label: 'Open', value: stats.open, icon: Inbox, tone: 'bg-info/15 text-info' },
    { label: 'In progress', value: stats.inProgress, icon: Search, tone: 'bg-warning/15 text-warning' },
    { label: 'Resolved', value: stats.resolved, icon: CheckCircle2, tone: 'bg-success/15 text-success' },
    { label: 'Closed', value: stats.closed, icon: XCircle, tone: 'bg-muted text-muted-foreground' },
    ...(stats.critical > 0 ? [{ label: 'Critical', value: stats.critical, icon: AlertOctagon, tone: 'bg-destructive/10 text-destructive' }] : []),
    ...(stats.needsCapa > 0 ? [{ label: 'Needs CAPA', value: stats.needsCapa, icon: ClipboardList, tone: 'bg-warning/15 text-warning' }] : []),
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Triage centre</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {stats.open + stats.inProgress} open issues{stats.critical > 0 ? ` (${stats.critical} critical)` : ''}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {views.length > 0 && (
            <Select value={activeView} onValueChange={applyViewFilters}>
              <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All issues</SelectItem>
                {views.map(v => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          <div className="inline-flex rounded-md border border-input">
            <Button
              size="sm"
              variant={viewMode === 'kanban' ? 'secondary' : 'ghost'}
              className="rounded-r-none"
              onClick={() => setViewMode('kanban')}
            >
              <LayoutList className="h-4 w-4" />
              Kanban
            </Button>
            <Separator orientation="vertical" />
            <Button
              size="sm"
              variant={viewMode === 'list' ? 'secondary' : 'ghost'}
              className="rounded-l-none"
              onClick={() => setViewMode('list')}
            >
              <FilePlus className="h-4 w-4" />
              List
            </Button>
          </div>
          <Button variant="gradient" onClick={() => setShowCreateModal(true)}>
            <Plus className="h-4 w-4" />
            Report issue
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
        {statTiles.map(stat => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label}>
              <div className="p-5">
                <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg', stat.tone)}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="mt-3 text-2xl font-bold tracking-tight">{stat.value}</div>
                <div className="mt-1 text-sm text-muted-foreground">{stat.label}</div>
              </div>
            </Card>
          );
        })}
      </div>

      <Card>
        <div className="flex flex-wrap items-center gap-3 p-4">
          <div className="relative min-w-[240px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search issues by title, description, or assignee..."
              value={filterSearch}
              onChange={e => setFilterSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={filterPriority} onValueChange={setFilterPriority}>
            <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All priorities</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              <SelectItem value="exception">Exception</SelectItem>
              <SelectItem value="delay">Delay</SelectItem>
              <SelectItem value="damage">Damage</SelectItem>
              <SelectItem value="compliance">Compliance</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={filterNeedsCapa} onChange={e => setFilterNeedsCapa(e.target.checked)} />
            Needs CAPA
          </label>
        </div>
      </Card>

      {loading ? (
        <div className="flex flex-col items-center gap-3 py-24 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin" />
          <h3 className="text-lg font-medium">Loading...</h3>
        </div>
      ) : viewMode === 'kanban' ? (
        <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="flex gap-4 overflow-x-auto">
            {COLUMNS.map(col => (
              <DroppableColumn
                key={col.key}
                colKey={col.key}
                label={col.label}
                issues={filtered.filter(i => i.status === col.key)}
                onCardClick={(id) => navigate(`/issues/${id}`)}
              />
            ))}
          </div>
          <DragOverlay>
            {draggingIssue ? (
              <div className="w-72 rotate-3 rounded-md border border-border bg-card p-3 shadow-xl">
                <IssueCardContent issue={draggingIssue} />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Issue</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Labels</TableHead>
                <TableHead>Assignee</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>CAPA</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(issue => (
                <TableRow key={issue.id} onClick={() => navigate(`/issues/${issue.id}`)} className="cursor-pointer">
                  <TableCell><span className="font-mono text-sm font-semibold">{issue.id.slice(0, 8)}</span></TableCell>
                  <TableCell className="max-w-[280px]">{issue.title}</TableCell>
                  <TableCell><span className="font-mono text-sm">{issue.sourceEntityId?.slice(0, 8) || '-'}</span></TableCell>
                  <TableCell>{issue.category}</TableCell>
                  <TableCell><Badge variant={priorityVariant(issue.priority)} className="capitalize">{issue.priority}</Badge></TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {(issue.labels || []).map(l => (
                        <span
                          key={l.id}
                          className="rounded px-1.5 py-0.5 text-[10px] font-semibold text-white"
                          style={{ background: l.color }}
                        >
                          {l.name}
                        </span>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/15 text-[10px] font-semibold text-primary">
                        {getInitials(issue.assigneeName)}
                      </div>
                      <span className="text-sm">{issue.assigneeName || 'Unassigned'}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(issue.status)} className="capitalize">{issue.status.replace('_', ' ')}</Badge>
                  </TableCell>
                  <TableCell>{issue.needsCapa ? <ClipboardList className="h-4 w-4 text-warning" /> : '-'}</TableCell>
                  <TableCell className="whitespace-nowrap text-sm">{timeAgo(issue.createdAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <CreateIssueModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreated={loadData}
      />
    </div>
  );
}
