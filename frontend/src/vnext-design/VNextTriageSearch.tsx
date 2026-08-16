/**
 * Triage search — faceted lookup across every issue, including settled and
 * suppressed ones. The board is for working the queue; this is for finding a
 * specific thing, or answering "has this happened before?".
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Search as SearchIcon } from 'lucide-react';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

import {
  triageApi, TriageIssue, IssueTypeDef, TriageFilterState, STATUS_LABEL, timeAgo, fmtDuration,
} from './triage/api';
import { cn } from '@/lib/utils';
import {
  TriageLoading, TriageError, TriageEmpty, TriageFilterBar, ConfidenceMeter, SlaPill, PlainSelect,
} from './triage/components';

const PER_PAGE = 50;
const SORTS = [
  { value: 'createdAt', label: 'Newest' },
  { value: 'signalScore', label: 'Confidence' },
  { value: 'slaDeadline', label: 'SLA deadline' },
  { value: 'lastActivityAt', label: 'Last activity' },
];

export default function VNextTriageSearch() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Search defaults to everything, unlike the board — a search that silently
  // hid resolved and suppressed issues would answer the wrong question.
  const [filters, setFilters] = useState<TriageFilterState>(() => ({
    showNoise: true,
    sourceEntityId: undefined,
  }));
  const [sortBy, setSortBy] = useState('createdAt');
  const [page, setPage] = useState(1);
  const [issues, setIssues] = useState<TriageIssue[]>([]);
  const [total, setTotal] = useState(0);
  const [types, setTypes] = useState<IssueTypeDef[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const entityId = searchParams.get('sourceEntityId') ?? undefined;

  const typeNames = useMemo(
    () => Object.fromEntries(types.map((t) => [t.key, t.name])),
    [types],
  );

  useEffect(() => {
    triageApi.issueTypes().then(setTypes).catch(() => setTypes([]));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await triageApi.issues(
        { ...filters, ...(entityId ? { sourceEntityId: entityId } as never : {}) },
        { page, perPage: PER_PAGE, sortBy, sortOrder: 'desc' },
      );
      setIssues(res.items);
      setTotal(res.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [filters, page, sortBy, entityId]);

  useEffect(() => { void load(); }, [load]);

  return (
    <div className="grid gap-4">
      <header className="flex flex-wrap items-center gap-3">
        <SearchIcon className="h-5 w-5" aria-hidden="true" />
        <h1 className="m-0 text-xl font-semibold">Search</h1>
        <Badge variant="secondary">{total} match{total === 1 ? '' : 'es'}</Badge>
        <div className="flex-1" />
        <label className="flex items-center gap-1.5 text-sm">
          Sort
          <PlainSelect
            label="Sort results"
            value={sortBy}
            onChange={(v) => { setSortBy(v); setPage(1); }}
          >
            {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </PlainSelect>
        </label>
      </header>

      {entityId && (
        <Card className="flex items-center gap-2 p-3">
          <span className="text-sm">Filtered to entity <code>{entityId}</code></span>
          <Button size="sm" variant="ghost" onClick={() => navigate('/triage/search')}>Clear</Button>
        </Card>
      )}

      <TriageFilterBar
        filters={filters}
        onChange={(f) => { setFilters(f); setPage(1); }}
        issueTypes={types}
      />

      {loading && <TriageLoading label="Searching" />}
      {error && !loading && <TriageError message={error} onRetry={load} />}
      {!loading && !error && issues.length === 0 && (
        <TriageEmpty title="Nothing matched" hint="Try removing a filter or widening the window." />
      )}

      {!loading && !error && issues.length > 0 && (
        <Card className="overflow-x-auto p-0">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="p-2.5">Issue</th>
                <th className="p-2.5">Type</th>
                <th className="p-2.5">Status</th>
                <th className="p-2.5">Confidence</th>
                <th className="p-2.5">SLA</th>
                <th className="p-2.5">Resolved in</th>
                <th className="p-2.5">Raised</th>
              </tr>
            </thead>
            <tbody>
              {issues.map((i) => (
                <tr
                  key={i.id}
                  onClick={() => navigate(`/triage/issues/${i.id}`)}
                  className={cn('cursor-pointer border-b border-border', i.isNoise && 'opacity-65')}
                >
                  <td className="p-2.5 font-medium">{i.title}</td>
                  <td className="p-2.5 text-muted-foreground">
                    {i.issueType ? typeNames[i.issueType] ?? i.issueType : i.category}
                  </td>
                  <td className="p-2.5">{STATUS_LABEL[i.status] ?? i.status}</td>
                  <td className="min-w-[120px] p-2.5">
                    <ConfidenceMeter score={i.signalScore} signalCount={i.signalCount} compact />
                  </td>
                  <td className="p-2.5">
                    <SlaPill deadline={i.slaDeadline} breached={i.slaBreach} />
                  </td>
                  <td className="p-2.5 text-muted-foreground">{fmtDuration(i.timeToResolutionMins)}</td>
                  <td className="p-2.5 text-muted-foreground">{timeAgo(i.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {total > PER_PAGE && (
        <div className="flex items-center justify-center gap-2">
          <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {Math.ceil(total / PER_PAGE)}
          </span>
          <Button
            size="sm" variant="outline"
            disabled={page >= Math.ceil(total / PER_PAGE)}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
