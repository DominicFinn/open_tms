/**
 * Shared triage presentation pieces: the confidence meter, SLA pill, issue
 * card, filter bar, and the loading / error / empty states every page needs.
 *
 * Tailwind utilities and shadcn primitives only — no hardcoded colours. The one
 * inline style permitted is a computed percentage width on the meter bar, which
 * the class system cannot express.
 */

import React from 'react';
import { AlertTriangle, Loader2, Inbox, Lock, EyeOff, Clock, GripVertical } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

import {
  TriageIssue, IssueTypeDef, TriageFilterState,
  fmtDuration, timeAgo, scoreTone, PRIORITY_VARIANT, STATUS_LABEL,
} from './api';

/* ── State surfaces ──────────────────────────────────────────────────── */

export function TriageLoading({ label = 'Loading' }: { label?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center justify-center gap-2 px-4 py-12 text-muted-foreground"
    >
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      <span>{label}…</span>
    </div>
  );
}

export function TriageError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <Card className="border-destructive p-6">
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 shrink-0 text-destructive" aria-hidden="true" />
        <div className="flex-1">
          <div className="mb-1 font-semibold">Could not load this view</div>
          <div className="text-sm text-muted-foreground">{message}</div>
          {onRetry && (
            <Button variant="outline" size="sm" onClick={onRetry} className="mt-3">
              Try again
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}

export function TriageEmpty({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="px-4 py-12 text-center text-muted-foreground">
      <Inbox className="mx-auto mb-3 h-8 w-8 opacity-50" aria-hidden="true" />
      <div className="mb-1 font-semibold">{title}</div>
      {hint && <div className="text-sm">{hint}</div>}
    </div>
  );
}

/* ── Confidence meter ────────────────────────────────────────────────── */

const TONE_BAR: Record<string, string> = {
  strong: 'bg-success',
  moderate: 'bg-warning',
  weak: 'bg-muted-foreground',
};
const TONE_TEXT: Record<string, string> = {
  strong: 'text-success',
  moderate: 'text-warning',
  weak: 'text-muted-foreground',
};

/**
 * Signal confidence, 0-100. A weak score is shown muted rather than red: it
 * means "not yet corroborated", not "this is wrong".
 */
export function ConfidenceMeter({
  score, signalCount, compact,
}: { score: number; signalCount?: number; compact?: boolean }) {
  const tone = scoreTone(score);
  const label = `Confidence ${score} of 100${signalCount ? `, from ${signalCount} signal${signalCount === 1 ? '' : 's'}` : ''}`;

  return (
    <div
      title={label}
      aria-label={label}
      className={cn('flex items-center gap-1.5', compact ? 'min-w-0' : 'min-w-[90px]')}
    >
      <div
        aria-hidden="true"
        className="relative h-1 min-w-[32px] flex-1 overflow-hidden rounded-full bg-border"
      >
        {/* Computed width from data — the one thing utilities cannot express. */}
        <div className={cn('h-full', TONE_BAR[tone])} style={{ width: `${score}%` }} />
      </div>
      <span className={cn('text-xs tabular-nums', TONE_TEXT[tone])}>{score}</span>
    </div>
  );
}

/* ── SLA pill ────────────────────────────────────────────────────────── */

export function SlaPill({
  deadline, breached, minutesToDeadline,
}: { deadline: string | null; breached: boolean; minutesToDeadline?: number | null }) {
  if (breached) {
    return (
      <Badge variant="destructive" className="gap-1">
        <Clock className="h-3 w-3" aria-hidden="true" />SLA breached
      </Badge>
    );
  }
  if (!deadline) return null;

  const mins = minutesToDeadline ?? Math.round((new Date(deadline).getTime() - Date.now()) / 60_000);
  if (mins < 0) {
    return (
      <Badge variant="destructive" className="gap-1">
        <Clock className="h-3 w-3" aria-hidden="true" />Overdue {fmtDuration(-mins)}
      </Badge>
    );
  }
  // Under an hour left is worth flagging visually.
  return (
    <Badge variant={mins <= 60 ? 'destructive' : 'secondary'} className="gap-1">
      <Clock className="h-3 w-3" aria-hidden="true" />{fmtDuration(mins)} left
    </Badge>
  );
}

/* ── Issue card ──────────────────────────────────────────────────────── */

export function IssueCard({
  issue, onOpen, selected, onToggleSelect, typeName, dragHandle,
}: {
  issue: TriageIssue & { minutesToDeadline?: number | null };
  onOpen: (id: string) => void;
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
  typeName?: string;
  /** Show the grab affordance. Set on the board, where cards are draggable. */
  dragHandle?: boolean;
}) {
  return (
    <Card
      className={cn(
        'cursor-pointer p-3 transition-shadow hover:shadow-md',
        selected && 'border-primary',
        issue.isNoise && 'opacity-65',
      )}
      onClick={() => onOpen(issue.id)}
    >
      <div className="flex items-start gap-2">
        {dragHandle && (
          <GripVertical
            className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/50"
            aria-hidden="true"
          />
        )}
        {onToggleSelect && (
          <input
            type="checkbox"
            checked={!!selected}
            aria-label={`Select ${issue.title}`}
            onClick={(e) => e.stopPropagation()}
            onChange={() => onToggleSelect(issue.id)}
            className="mt-1"
          />
        )}
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
            <Badge variant={(PRIORITY_VARIANT[issue.priority] ?? 'secondary') as never}>
              {issue.priority}
            </Badge>
            {issue.latched && (
              <Badge
                variant="outline"
                className="gap-1"
                title="Latched: cannot be auto-resolved or dismissed as noise"
              >
                <Lock className="h-2.5 w-2.5" aria-hidden="true" />latched
              </Badge>
            )}
            {issue.isNoise && (
              <Badge variant="outline" className="gap-1" title={issue.noiseReason ?? 'Suppressed as noise'}>
                <EyeOff className="h-2.5 w-2.5" aria-hidden="true" />noise
              </Badge>
            )}
            <SlaPill
              deadline={issue.slaDeadline}
              breached={issue.slaBreach}
              minutesToDeadline={issue.minutesToDeadline}
            />
          </div>

          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onOpen(issue.id); }}
            className="mb-1 block break-words text-left text-sm font-semibold hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {issue.title}
          </button>

          <div className="mb-2 text-xs text-muted-foreground">
            {typeName ?? issue.issueType ?? issue.category} · {timeAgo(issue.createdAt)}
            {issue.assigneeName ? ` · ${issue.assigneeName}` : ' · unassigned'}
          </div>

          <ConfidenceMeter score={issue.signalScore} signalCount={issue.signalCount} />
        </div>
      </div>
    </Card>
  );
}

/* ── Filter bar ──────────────────────────────────────────────────────── */

const PRIORITIES = ['critical', 'high', 'medium', 'low'];
const STATUSES = ['open', 'in_progress', 'resolved', 'closed'];

function Chips({
  options, selected, onChange, labels,
}: {
  options: string[];
  selected: string[] | undefined;
  onChange: (next: string[] | undefined) => void;
  labels?: Record<string, string>;
}) {
  const set = new Set(selected ?? []);
  return (
    <div className="flex flex-wrap gap-1">
      {options.map((o) => {
        const on = set.has(o);
        return (
          <button
            key={o}
            type="button"
            aria-pressed={on}
            onClick={() => {
              const next = new Set(set);
              if (on) next.delete(o); else next.add(o);
              onChange(next.size ? [...next] : undefined);
            }}
            className={cn(
              'cursor-pointer rounded-full border px-2.5 py-0.5 text-xs transition-colors',
              on
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-transparent text-muted-foreground hover:bg-primary/10',
            )}
          >
            {labels?.[o] ?? o}
          </button>
        );
      })}
    </div>
  );
}

/** Native select styled to match the shadcn input. */
function PlainSelect({
  value, onChange, label, children,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <select
      value={value}
      aria-label={label}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-md border border-input bg-background px-2 py-1 text-sm text-foreground"
    >
      {children}
    </select>
  );
}

export function TriageFilterBar({
  filters, onChange, issueTypes, showQuery = true,
}: {
  filters: TriageFilterState;
  onChange: (next: TriageFilterState) => void;
  issueTypes: IssueTypeDef[];
  showQuery?: boolean;
}) {
  const set = (patch: Partial<TriageFilterState>) => onChange({ ...filters, ...patch });

  return (
    <Card className="grid gap-2.5 p-3">
      {showQuery && (
        <Input
          placeholder="Search titles and descriptions…"
          value={filters.query ?? ''}
          aria-label="Search issues"
          onChange={(e) => set({ query: e.target.value || undefined })}
        />
      )}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="text-xs text-muted-foreground">Status</span>
        <Chips
          options={STATUSES}
          selected={filters.status}
          onChange={(v) => set({ status: v })}
          labels={STATUS_LABEL}
        />
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="text-xs text-muted-foreground">Priority</span>
        <Chips options={PRIORITIES} selected={filters.priority} onChange={(v) => set({ priority: v })} />
      </div>

      {issueTypes.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <span className="text-xs text-muted-foreground">Type</span>
          <Chips
            options={issueTypes.map((t) => t.key)}
            selected={filters.issueType}
            onChange={(v) => set({ issueType: v })}
            labels={Object.fromEntries(issueTypes.map((t) => [t.key, t.name]))}
          />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
        <label className="flex cursor-pointer items-center gap-1.5">
          <input
            type="checkbox"
            checked={!!filters.showNoise}
            onChange={(e) => set({ showNoise: e.target.checked || undefined })}
          />
          Show suppressed (noise)
        </label>

        <label className="flex cursor-pointer items-center gap-1.5">
          <input
            type="checkbox"
            checked={filters.slaBreach === true}
            onChange={(e) => set({ slaBreach: e.target.checked ? true : undefined })}
          />
          SLA breached only
        </label>

        <label className="flex items-center gap-1.5">
          Min confidence
          <Input
            type="number"
            min={0}
            max={100}
            value={filters.signalScoreMin ?? ''}
            aria-label="Minimum confidence score"
            onChange={(e) => set({
              signalScoreMin: e.target.value ? Number(e.target.value) : undefined,
            })}
            className="w-20"
          />
        </label>

        <label className="flex items-center gap-1.5">
          Window
          <PlainSelect
            label="Date range"
            value={filters.dateRange ?? ''}
            onChange={(v) => set({ dateRange: v || undefined })}
          >
            <option value="">All time</option>
            <option value="24h">Last 24h</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
          </PlainSelect>
        </label>
      </div>
    </Card>
  );
}

export { PlainSelect };

/* ── Stat tile ───────────────────────────────────────────────────────── */

const TONE_VALUE: Record<string, string> = {
  error: 'text-destructive',
  warning: 'text-warning',
  success: 'text-success',
};

export function StatTile({
  label, value, sub, tone,
}: { label: string; value: string | number; sub?: string; tone?: 'error' | 'warning' | 'success' }) {
  return (
    <Card className="p-4">
      <div className="mb-1.5 text-xs text-muted-foreground">{label}</div>
      <div className={cn('text-2xl font-semibold tabular-nums', tone ? TONE_VALUE[tone] : 'text-foreground')}>
        {value}
      </div>
      {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
    </Card>
  );
}

export function StatGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {children}
    </div>
  );
}

/* ── Bar list (shared by dashboard panels) ───────────────────────────── */

export function BarList({
  rows, onSelect,
}: { rows: { label: string; count: number }[]; onSelect?: (index: number) => void }) {
  const max = Math.max(...rows.map((r) => r.count), 1);
  return (
    <div className="grid gap-2">
      {rows.map((r, i) => (
        <div
          key={r.label}
          onClick={onSelect ? () => onSelect(i) : undefined}
          className={cn(onSelect && 'cursor-pointer')}
        >
          <div className="mb-1 flex text-sm">
            <span className="flex-1">{r.label}</span>
            <span className="tabular-nums">{r.count}</span>
          </div>
          <div aria-hidden="true" className="h-1.5 overflow-hidden rounded-full bg-border">
            {/* Computed width from data. */}
            <div className="h-full bg-primary" style={{ width: `${(r.count / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}
