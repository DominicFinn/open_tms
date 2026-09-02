/**
 * Triage board — the main working surface.
 *
 * Kanban and list views over the same filtered query, multi-select with batch
 * actions, and saving the current filter set as a reusable board (backed by
 * KanbanView, the saved-view model the rest of the app already uses).
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams, useParams } from 'react-router-dom';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
  DragStartEvent,
  DragEndEvent,
} from '@dnd-kit/core';
import { Bug, LayoutList, Columns3, Save, Users, EyeOff, CheckCheck, X, Plus } from 'lucide-react';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

import { API_URL } from '../api';
import {
  triageApi, boardsApi, TriageIssue, IssueTypeDef, TriageFilterState, SavedBoard, BatchResult,
  BOARD_COLUMNS, STATUS_LABEL, timeAgo,
} from './triage/api';
import {
  TriageLoading, TriageError, TriageEmpty, TriageFilterBar, IssueCard, ConfidenceMeter, SlaPill,
} from './triage/components';
import { CreateIssueDialog } from './triage/CreateIssueDialog';

const PER_PAGE = 100;

export default function VNextTriageBoard() {
  const navigate = useNavigate();
  const { boardId } = useParams();
  const [searchParams] = useSearchParams();

  const [filters, setFilters] = useState<TriageFilterState>(() => ({
    status: ['open', 'in_progress'],
    issueType: searchParams.get('issueType') ? [searchParams.get('issueType')!] : undefined,
  }));
  const [view, setView] = useState<'kanban' | 'list'>('kanban');
  const [issues, setIssues] = useState<TriageIssue[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [types, setTypes] = useState<IssueTypeDef[]>([]);
  const [boards, setBoards] = useState<SavedBoard[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [savingBoard, setSavingBoard] = useState(false);
  const [creating, setCreating] = useState(false);
  const [boardName, setBoardName] = useState('');

  const typeNames = useMemo(
    () => Object.fromEntries(types.map((t) => [t.key, t.name])),
    [types],
  );

  /* Load the reference data once. */
  useEffect(() => {
    triageApi.issueTypes().then(setTypes).catch(() => setTypes([]));
    boardsApi.list().then(setBoards).catch(() => setBoards([]));
  }, []);

  /* Applying a saved board replaces the working filter set. */
  useEffect(() => {
    if (!boardId || !boards.length) return;
    const board = boards.find((b) => b.id === boardId);
    if (board) {
      setFilters(board.filters ?? {});
      setView(board.viewMode === 'list' ? 'list' : 'kanban');
    }
  }, [boardId, boards]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await triageApi.issues(filters, { page, perPage: PER_PAGE, sortBy: 'createdAt' });
      setIssues(res.items);
      setTotal(res.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [filters, page]);

  useEffect(() => { void load(); }, [load]);

  /* Changing filters returns to the first page — otherwise you can land on an
     empty page 4 of a result set that now has one page. */
  const changeFilters = (next: TriageFilterState) => {
    setFilters(next);
    setPage(1);
    setSelected(new Set());
  };

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // The list reads an async read-model projection that can lag a write by a beat, so an
  // immediate refetch after a batch action can still show the pre-change status. Patch the
  // affected issues locally from the batch result (which id's actually succeeded) instead of
  // waiting on `load()` alone — `load()` still runs after, as a background reconciliation.
  const applyLocalStatusChange = (
    successIds: string[],
    changes: Partial<TriageIssue> & { status: string },
  ) => {
    if (successIds.length === 0) return;
    const activeStatuses = filters.status;
    const stillVisible = !activeStatuses || activeStatuses.includes(changes.status);
    setIssues((prev) => (
      stillVisible
        ? prev.map((i) => (successIds.includes(i.id) ? { ...i, ...changes } : i))
        : prev.filter((i) => !successIds.includes(i.id))
    ));
    if (!stillVisible) setTotal((t) => Math.max(0, t - successIds.length));
  };

  const runBatch = async (
    ids: string[],
    fn: () => Promise<BatchResult>,
    verb: string,
    changes: Partial<TriageIssue> & { status: string },
  ) => {
    setBanner(null);
    try {
      const res = await fn();
      const failedIds = new Set(res.failed.map((f) => f.id));
      const successIds = ids.filter((id) => !failedIds.has(id));
      const failedCount = res.failed.length;
      setBanner(
        failedCount
          ? `${verb} ${res.updated} issue${res.updated === 1 ? '' : 's'}; ${failedCount} failed.`
          : `${verb} ${res.updated} issue${res.updated === 1 ? '' : 's'}.`,
      );
      // Patch locally from the batch result rather than refetching: `load()` reads the same
      // async read-model projection the batch write feeds, and an immediate refetch would race
      // it and overwrite this patch with the pre-batch status.
      applyLocalStatusChange(successIds, changes);
      setSelected(new Set());
    } catch (e) {
      setBanner(e instanceof Error ? e.message : 'Batch action failed');
    }
  };

  const saveBoard = async () => {
    if (!boardName.trim()) return;
    try {
      const board = await boardsApi.create({
        name: boardName.trim(),
        filters,
        viewMode: view,
        groupBy: 'status',
        sortBy: 'createdAt',
      });
      setBoards((b) => [...b, board]);
      setSavingBoard(false);
      setBoardName('');
      setBanner(`Saved board "${board.name}".`);
    } catch (e) {
      setBanner(e instanceof Error ? e.message : 'Could not save board');
    }
  };

  /* ── Drag and drop ────────────────────────────────────────────────── */

  // A card is both draggable and clickable. Without a distance constraint
  // dnd-kit claims every pointerdown as the start of a drag and the click to
  // open the issue never fires — 8px is far enough to distinguish a click from
  // a deliberate drag, close enough that dragging still feels immediate.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor),
  );
  const [dragging, setDragging] = useState<TriageIssue | null>(null);

  const handleDragStart = (e: DragStartEvent) => {
    setDragging(issues.find((i) => i.id === e.active.id) ?? null);
  };

  /**
   * Optimistic status move with rollback. The card jumps immediately so the
   * board feels responsive; if the write fails we put it back and say so
   * rather than leaving the UI lying about the server state.
   */
  const handleDragEnd = async (e: DragEndEvent) => {
    setDragging(null);
    const { active, over } = e;
    if (!over) return;

    const issueId = String(active.id);
    const newStatus = String(over.id);
    const issue = issues.find((i) => i.id === issueId);
    if (!issue || issue.status === newStatus) return;

    const previousStatus = issue.status;
    setIssues((prev) => prev.map((i) => (i.id === issueId ? { ...i, status: newStatus } : i)));

    try {
      const res = await fetch(`${API_URL}/api/v1/issues/${issueId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error(`Status change failed (${res.status})`);
    } catch (err) {
      setIssues((prev) => prev.map((i) => (i.id === issueId ? { ...i, status: previousStatus } : i)));
      setBanner(err instanceof Error ? err.message : 'Could not move that issue');
    }
  };

  const ids = [...selected];
  const columns = useMemo(() => {
    const map: Record<string, TriageIssue[]> = {};
    for (const c of BOARD_COLUMNS) map[c] = [];
    for (const i of issues) (map[i.status] ??= []).push(i);
    return map;
  }, [issues]);

  return (
    <div className="grid gap-4">
      <header className="flex flex-wrap items-center gap-3">
        <Bug className="h-5 w-5" aria-hidden="true" />
        <h1 className="m-0 text-xl font-semibold">All Issues</h1>
        <Badge variant="secondary">{total}</Badge>
        <div className="flex-1" />

        <div className="flex gap-1" role="group" aria-label="View mode">
          <Button
            size="sm"
            variant={view === 'kanban' ? 'default' : 'outline'}
            onClick={() => setView('kanban')}
          >
            <Columns3 className="h-3.5 w-3.5" aria-hidden="true" /> Board
          </Button>
          <Button
            size="sm"
            variant={view === 'list' ? 'default' : 'outline'}
            onClick={() => setView('list')}
          >
            <LayoutList className="h-3.5 w-3.5" aria-hidden="true" /> List
          </Button>
        </div>

        <Button size="sm" onClick={() => setCreating(true)}>
          <Plus className="h-3.5 w-3.5" aria-hidden="true" /> Report issue
        </Button>

        <Button size="sm" variant="outline" onClick={() => setSavingBoard((v) => !v)}>
          <Save className="h-3.5 w-3.5" aria-hidden="true" /> Save as board
        </Button>
      </header>

      {boards.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Saved boards:</span>
          {boards.map((b) => (
            <Button
              key={b.id}
              size="sm"
              variant={boardId === b.id ? 'default' : 'outline'}
              onClick={() => navigate(`/triage/board/${b.id}`)}
            >
              {b.name}
            </Button>
          ))}
          {boardId && (
            <Button size="sm" variant="ghost" onClick={() => navigate('/triage/board')}>
              <X className="h-3.5 w-3.5" aria-hidden="true" /> Clear
            </Button>
          )}
        </div>
      )}

      {savingBoard && (
        <Card className="flex flex-wrap items-center gap-2 p-3">
          <Input
            placeholder="Board name, e.g. Cold chain critical"
            value={boardName}
            aria-label="Board name"
            onChange={(e) => setBoardName(e.target.value)}
            className="max-w-xs"
          />
          <Button size="sm" onClick={saveBoard} disabled={!boardName.trim()}>Save</Button>
          <Button size="sm" variant="ghost" onClick={() => setSavingBoard(false)}>Cancel</Button>
          <span className="text-xs text-muted-foreground">
            Saves the current filters and view mode.
          </span>
        </Card>
      )}

      <TriageFilterBar filters={filters} onChange={changeFilters} issueTypes={types} />

      {banner && (
        <Card className="border-info p-3" role="status" aria-live="polite">
          {banner}
        </Card>
      )}

      {selected.size > 0 && (
        <Card className="flex flex-wrap items-center gap-2 p-3">
          <strong className="text-sm">{selected.size} selected</strong>
          <Button size="sm" variant="outline"
            onClick={() => runBatch(ids, () => triageApi.batchTransition(ids, 'in_progress'), 'Started', { status: 'in_progress' })}>
            <Users className="h-3.5 w-3.5" aria-hidden="true" /> Start
          </Button>
          <Button size="sm" variant="outline"
            onClick={() => runBatch(ids, () => triageApi.batchTransition(ids, 'resolved', 'Bulk resolved from the triage board'), 'Resolved', { status: 'resolved' })}>
            <CheckCheck className="h-3.5 w-3.5" aria-hidden="true" /> Resolve
          </Button>
          <Button size="sm" variant="outline"
            onClick={() => runBatch(ids, () => triageApi.batchDismissNoise(ids), 'Dismissed', { status: 'closed', isNoise: true })}>
            <EyeOff className="h-3.5 w-3.5" aria-hidden="true" /> Dismiss as noise
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Clear</Button>
          <span className="text-xs text-muted-foreground">
            Latched safety issues cannot be dismissed as noise.
          </span>
        </Card>
      )}

      {loading && <TriageLoading label="Loading issues" />}
      {error && !loading && <TriageError message={error} onRetry={load} />}

      {!loading && !error && issues.length === 0 && (
        <TriageEmpty
          title="No issues match these filters"
          hint="Try widening the window, or tick 'Show suppressed' to include noise."
        />
      )}

      {!loading && !error && issues.length > 0 && view === 'kanban' && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="grid items-start gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {BOARD_COLUMNS.map((col) => (
              <DroppableColumn key={col} status={col} count={columns[col]?.length ?? 0}>
                {(columns[col] ?? []).map((i) => (
                  <DraggableCard key={i.id} id={i.id}>
                    <IssueCard
                      issue={i}
                      typeName={i.issueType ? typeNames[i.issueType] : undefined}
                      onOpen={(id) => navigate(`/triage/issues/${id}`)}
                      selected={selected.has(i.id)}
                      onToggleSelect={toggle}
                      dragHandle
                    />
                  </DraggableCard>
                ))}
                {(columns[col] ?? []).length === 0 && (
                  <div className="rounded-md border border-dashed border-border/60 p-3 text-center text-xs text-muted-foreground">
                    Drop an issue here
                  </div>
                )}
              </DroppableColumn>
            ))}
          </div>

          {/* The lifted card: scaled and tilted slightly with a deep shadow, so it
              reads as picked up off the board rather than outlined on it. */}
          <DragOverlay dropAnimation={{ duration: 180, easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)' }}>
            {dragging && (
              <div className="rotate-2 scale-[1.04] cursor-grabbing shadow-2xl drop-shadow-2xl">
                <IssueCard
                  issue={dragging}
                  typeName={dragging.issueType ? typeNames[dragging.issueType] : undefined}
                  onOpen={() => {}}
                  dragHandle
                />
              </div>
            )}
          </DragOverlay>
        </DndContext>
      )}

      {!loading && !error && issues.length > 0 && view === 'list' && (
        <Card className="overflow-x-auto p-0">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="w-8 p-2.5">
                  <input
                    type="checkbox"
                    aria-label="Select all on this page"
                    checked={selected.size === issues.length && issues.length > 0}
                    onChange={(e) => setSelected(e.target.checked ? new Set(issues.map((i) => i.id)) : new Set())}
                  />
                </th>
                <th className="p-2.5">Issue</th>
                <th className="p-2.5">Type</th>
                <th className="p-2.5">Status</th>
                <th className="p-2.5">Priority</th>
                <th className="p-2.5">Confidence</th>
                <th className="p-2.5">SLA</th>
                <th className="p-2.5">Assignee</th>
                <th className="p-2.5">Age</th>
              </tr>
            </thead>
            <tbody>
              {issues.map((i) => (
                <tr
                  key={i.id}
                  className={cn('cursor-pointer border-b border-border', i.isNoise && 'opacity-65')}
                  onClick={() => navigate(`/triage/issues/${i.id}`)}
                >
                  <td className="p-2.5" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      aria-label={`Select ${i.title}`}
                      checked={selected.has(i.id)}
                      onChange={() => toggle(i.id)}
                    />
                  </td>
                  <td className="p-2.5 font-medium">{i.title}</td>
                  <td className="p-2.5 text-muted-foreground">
                    {i.issueType ? typeNames[i.issueType] ?? i.issueType : i.category}
                  </td>
                  <td className="p-2.5">{STATUS_LABEL[i.status] ?? i.status}</td>
                  <td className="p-2.5">{i.priority}</td>
                  <td className="min-w-[120px] p-2.5">
                    <ConfidenceMeter score={i.signalScore} signalCount={i.signalCount} compact />
                  </td>
                  <td className="p-2.5">
                    <SlaPill deadline={i.slaDeadline} breached={i.slaBreach} />
                  </td>
                  <td className="p-2.5 text-muted-foreground">{i.assigneeName ?? 'unassigned'}</td>
                  <td className="p-2.5 text-muted-foreground">{timeAgo(i.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {total > PER_PAGE && (
        <div className="flex items-center justify-center gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={page <= 1}
            onClick={() => { setPage((p) => p - 1); setSelected(new Set()); }}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {Math.ceil(total / PER_PAGE)}
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={page >= Math.ceil(total / PER_PAGE)}
            onClick={() => { setPage((p) => p + 1); setSelected(new Set()); }}
          >
            Next
          </Button>
        </div>
      )}

      <CreateIssueDialog
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={() => { void load(); }}
      />
    </div>
  );
}

/* ── Drag and drop primitives ──────────────────────────────────────────── */

function DroppableColumn({
  status, count, children,
}: { status: string; count: number; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    // The lane carries its own surface and border so the board reads as four
    // columns rather than a loose grid of cards.
    <section
      aria-label={`${STATUS_LABEL[status] ?? status} column`}
      className={cn(
        'flex flex-col rounded-lg border border-border bg-muted/20 transition-colors',
        isOver && 'border-primary/40 bg-primary/5',
      )}
    >
      <header className="flex items-center gap-2 border-b border-border px-3 py-2 text-sm font-semibold">
        {STATUS_LABEL[status] ?? status}
        <Badge variant="secondary">{count}</Badge>
      </header>
      <div ref={setNodeRef} className="grid min-h-[96px] content-start gap-2 p-2">
        {children}
      </div>
    </section>
  );
}

function DraggableCard({ id, children }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      // The card follows the cursor via DragOverlay, so the original stays put
      // and only dims — moving it as well produces two cards in flight.
      className={cn(
        'cursor-grab rounded-lg outline-none active:cursor-grabbing',
        'focus-visible:ring-2 focus-visible:ring-ring',
        isDragging && 'opacity-30',
      )}
    >
      {children}
    </div>
  );
}
