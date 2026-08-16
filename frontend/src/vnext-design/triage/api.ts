/**
 * Shared client for the Triage Centre API, plus the small formatters every
 * triage page needs. Keeping the fetch shapes in one place means the board,
 * search and saved boards all send the same filter params.
 */

import { API_URL } from '../../api';

/* ── Types (mirror the backend TriageRepository DTOs) ────────────────── */

export interface TriageIssue {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  category: string;
  issueType: string | null;
  latched: boolean;
  sourceEntityType: string | null;
  sourceEntityId: string | null;
  assigneeId: string | null;
  assigneeName: string | null;
  labels: string[] | null;
  commentCount: number;
  signalScore: number;
  signalCount: number;
  isNoise: boolean;
  noiseReason: string | null;
  slaDeadline: string | null;
  slaBreach: boolean;
  timeToFirstResponseMins: number | null;
  timeToResolutionMins: number | null;
  lastActivityAt: string | null;
  snoozedUntil: string | null;
  resolvedAt: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ActionableIssue extends TriageIssue {
  minutesToDeadline: number | null;
}

export interface IssueTypeDef {
  key: string;
  name: string;
  category: string;
  defaultPriority: string;
  latched: boolean;
  baseConfidence: number;
  slaMinutes: number | null;
}

export interface SignalSummary {
  total: number;
  signalCount: number;
  noiseCount: number;
  noiseRatio: number;
  avgSignalScore: number;
  avgTimeToResolutionMins: number | null;
  avgTimeToFirstResponseMins: number | null;
  slaBreaches: number;
  slaAtRisk: number;
  byCategory: { category: string; count: number }[];
  byStatus: Record<string, number>;
  byType: { issueType: string; name: string; count: number }[];
  recurring: { sourceEntityId: string | null; issueType: string | null; name: string | null; count: number }[];
}

export interface TriageReport {
  from: string;
  to: string;
  total: number;
  slaBreaches: number;
  breachRate: number;
  avgTimeToResolutionMins: number | null;
  avgTimeToFirstResponseMins: number | null;
  daily: { day: string; count: number }[];
  byType: {
    issueType: string; name: string; count: number;
    avgTimeToResolutionMins: number | null; avgSignalScore: number;
  }[];
  byAssignee: { assigneeName: string; count: number; avgTimeToResolutionMins: number | null }[];
  byPriority: { priority: string; count: number }[];
}

export interface SpotCheckResult {
  total: number;
  sampled: number;
  breachRate: number;
  avgTimeToResolutionMins: number | null;
  items: TriageIssue[];
}

export interface TriageContext {
  issue: Record<string, unknown> & { id: string; title: string };
  issueTypeDef: (Pick<IssueTypeDef, 'key' | 'name' | 'latched' | 'baseConfidence' | 'slaMinutes'>) | null;
  signals: { id: string; eventType: string; priority: string; occurredAt: string }[];
  siblingIssues: TriageIssue[];
  sourceEntity: Record<string, unknown> | null;
}

/** The filter shape the board, search page and saved boards all share. */
export interface TriageFilterState {
  status?: string[];
  priority?: string[];
  category?: string[];
  issueType?: string[];
  assigneeId?: string;
  signalScoreMin?: number;
  showNoise?: boolean;
  slaBreach?: boolean;
  dateRange?: string;
  query?: string;
}

/* ── Fetch helpers ───────────────────────────────────────────────────── */

class TriageApiError extends Error {}

async function get<T>(path: string, params?: Record<string, unknown>): Promise<T> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params ?? {})) {
    if (v == null || v === '' || (Array.isArray(v) && !v.length)) continue;
    qs.set(k, Array.isArray(v) ? v.join(',') : String(v));
  }
  const url = `${API_URL}/api/v1/triage${path}${qs.toString() ? `?${qs}` : ''}`;
  const res = await fetch(url);
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new TriageApiError(json?.error || `Request failed (${res.status})`);
  return json.data as T;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_URL}/api/v1/triage${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new TriageApiError(json?.error || `Request failed (${res.status})`);
  return json.data as T;
}

/** Turn the shared filter state into query params. */
function filterParams(f: TriageFilterState): Record<string, unknown> {
  return {
    status: f.status,
    priority: f.priority,
    category: f.category,
    issueType: f.issueType,
    assigneeId: f.assigneeId,
    signalScoreMin: f.signalScoreMin,
    showNoise: f.showNoise ? 'true' : undefined,
    slaBreach: f.slaBreach == null ? undefined : String(f.slaBreach),
    dateRange: f.dateRange,
    query: f.query,
  };
}

export const triageApi = {
  async issues(
    f: TriageFilterState,
    opts: { sortBy?: string; sortOrder?: string; page?: number; perPage?: number } = {},
  ): Promise<{ items: TriageIssue[]; total: number; page: number; perPage: number }> {
    const qs = new URLSearchParams();
    const all = { ...filterParams(f), ...opts };
    for (const [k, v] of Object.entries(all)) {
      if (v == null || v === '' || (Array.isArray(v) && !v.length)) continue;
      qs.set(k, Array.isArray(v) ? v.join(',') : String(v));
    }
    const res = await fetch(`${API_URL}/api/v1/triage/issues?${qs}`);
    const json = await res.json().catch(() => null);
    if (!res.ok) throw new TriageApiError(json?.error || `Request failed (${res.status})`);
    return {
      items: json.data as TriageIssue[],
      total: json.meta?.total ?? 0,
      page: json.meta?.page ?? 1,
      perPage: json.meta?.perPage ?? 50,
    };
  },

  signal: (dateRange?: string) => get<SignalSummary>('/signal', { dateRange }),
  actionable: (perPage = 25, assigneeId?: string) =>
    get<ActionableIssue[]>('/actionable', { perPage, assigneeId }),
  spotCheck: (dateRange: string, sampleSize: number, includeNoise: boolean) =>
    get<SpotCheckResult>('/spot-check', {
      dateRange, sampleSize, includeNoise: includeNoise ? 'true' : undefined,
    }),
  reports: (from?: string, to?: string) => get<TriageReport>('/reports', { from, to }),
  context: (id: string) => get<TriageContext>(`/issues/${id}/context`),
  issueTypes: () => get<IssueTypeDef[]>('/issue-types'),

  batchTransition: (ids: string[], status: string, resolution?: string) =>
    post<BatchResult>('/batch/transition', { ids, status, resolution }),
  batchAssign: (ids: string[], assigneeId?: string, assigneeName?: string) =>
    post<BatchResult>('/batch/assign', { ids, assigneeId, assigneeName }),
  batchDismissNoise: (ids: string[], reason?: string) =>
    post<BatchResult>('/batch/dismiss-noise', { ids, reason }),
};

export interface BatchResult {
  requested: number;
  updated: number;
  failed: { id: string; error: string | null }[];
}

/* ── Saved boards (KanbanView doubles as the triage board store) ─────── */

export interface SavedBoard {
  id: string;
  name: string;
  description?: string | null;
  icon?: string | null;
  filters: TriageFilterState;
  groupBy: string;
  sortBy: string;
  viewMode: string;
  isDefault: boolean;
  isShared: boolean;
}

export const boardsApi = {
  async list(): Promise<SavedBoard[]> {
    const res = await fetch(`${API_URL}/api/v1/kanban-views`);
    const json = await res.json().catch(() => null);
    if (!res.ok) throw new TriageApiError(json?.error || 'Could not load boards');
    return (json.data ?? []) as SavedBoard[];
  },
  async create(board: Partial<SavedBoard>): Promise<SavedBoard> {
    const res = await fetch(`${API_URL}/api/v1/kanban-views`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(board),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) throw new TriageApiError(json?.error || 'Could not save board');
    return json.data as SavedBoard;
  },
  async update(id: string, board: Partial<SavedBoard>): Promise<SavedBoard> {
    const res = await fetch(`${API_URL}/api/v1/kanban-views/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(board),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) throw new TriageApiError(json?.error || 'Could not save board');
    return json.data as SavedBoard;
  },
  async remove(id: string): Promise<void> {
    const res = await fetch(`${API_URL}/api/v1/kanban-views/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new TriageApiError('Could not delete board');
  },
};

/* ── Formatters ──────────────────────────────────────────────────────── */

export function fmtDuration(mins?: number | null): string {
  if (mins == null || Number.isNaN(mins)) return '-';
  const abs = Math.abs(mins);
  if (abs < 60) return `${Math.round(mins)}m`;
  const h = Math.floor(abs / 60);
  const m = Math.round(abs % 60);
  const sign = mins < 0 ? '-' : '';
  if (h < 24) return `${sign}${h}h${m ? ` ${m}m` : ''}`;
  const d = Math.floor(h / 24);
  return `${sign}${d}d${h % 24 ? ` ${h % 24}h` : ''}`;
}

export function timeAgo(iso?: string | null): string {
  if (!iso) return '-';
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return 'just now';
  return `${fmtDuration(mins)} ago`;
}

/**
 * Colour band for a confidence score. Deliberately not a red/green pass-fail:
 * a low score means "needs corroborating", not "wrong".
 */
export function scoreTone(score: number): 'strong' | 'moderate' | 'weak' {
  if (score >= 70) return 'strong';
  if (score >= 41) return 'moderate';
  return 'weak';
}

export const PRIORITY_VARIANT: Record<string, string> = {
  critical: 'destructive',
  high: 'destructive',
  medium: 'secondary',
  low: 'outline',
};

export const STATUS_LABEL: Record<string, string> = {
  open: 'Open',
  in_progress: 'In progress',
  resolved: 'Resolved',
  closed: 'Closed',
};

export const BOARD_COLUMNS = ['open', 'in_progress', 'resolved', 'closed'] as const;
