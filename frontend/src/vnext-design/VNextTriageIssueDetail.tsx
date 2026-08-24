/**
 * Triage issue detail — the context view.
 *
 * The existing VNextIssueDetail owns the full lifecycle (comments, labels,
 * snooze, CAPA, closure report). This page answers the triage-specific
 * question instead: why do we believe this, what else is wrong with the same
 * entity, and is it worth acting on. It links out to the full detail page for
 * everything else rather than duplicating it.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Lock, EyeOff, ExternalLink, Radio } from 'lucide-react';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

import {
  triageApi, TriageContext, fmtDuration, timeAgo, STATUS_LABEL, PRIORITY_VARIANT,
} from './triage/api';
import {
  TriageLoading, TriageError, TriageEmpty, ConfidenceMeter, SlaPill, StatTile, StatGrid,
} from './triage/components';

export default function VNextTriageIssueDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [ctx, setCtx] = useState<TriageContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [acting, setActing] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      setCtx(await triageApi.context(id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  const act = async (fn: () => Promise<unknown>) => {
    setActing(true);
    try {
      await fn();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setActing(false);
    }
  };

  const issue = ctx?.issue as (Record<string, unknown> & {
    id: string; title: string; description?: string | null; status: string; priority: string;
    category: string; issueType?: string | null; latched?: boolean;
    signalScore?: number; signalCount?: number; isNoise?: boolean; noiseReason?: string | null;
    slaDeadline?: string | null; slaBreach?: boolean;
    timeToFirstResponseMins?: number | null; timeToResolutionMins?: number | null;
    assigneeName?: string | null; createdAt?: string;
    sourceEntityType?: string | null; sourceEntityId?: string | null;
  }) | undefined;

  return (
    <div className="grid gap-4">
      <header className="flex flex-wrap items-center gap-3">
        <Button size="sm" variant="ghost" onClick={() => navigate('/triage/board')}>
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Board
        </Button>
        <h1 className="m-0 flex-1 text-lg font-semibold">{issue?.title ?? 'Issue'}</h1>
        {issue && (
          <Button size="sm" variant="outline" onClick={() => navigate(`/issues/${issue.id}`)}>
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" /> Full detail
          </Button>
        )}
      </header>

      {loading && <TriageLoading label="Loading issue" />}
      {error && !loading && <TriageError message={error} onRetry={load} />}

      {issue && !loading && !error && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={(PRIORITY_VARIANT[issue.priority] ?? 'secondary') as never}>
              {issue.priority}
            </Badge>
            <Badge variant="secondary">{STATUS_LABEL[issue.status] ?? issue.status}</Badge>
            {issue.latched && (
              <Badge variant="outline" className="gap-1">
                <Lock className="h-3 w-3" aria-hidden="true" /> latched
              </Badge>
            )}
            {issue.isNoise && (
              <Badge variant="outline" className="gap-1">
                <EyeOff className="h-3 w-3" aria-hidden="true" /> suppressed
              </Badge>
            )}
            <SlaPill
              deadline={issue.slaDeadline ?? null}
              breached={!!issue.slaBreach}
            />
            <span className="text-sm text-muted-foreground">
              raised {timeAgo(issue.createdAt)}
              {issue.assigneeName ? ` · ${issue.assigneeName}` : ' · unassigned'}
            </span>
          </div>

          {issue.description && (
            <Card className="p-4 text-sm">{issue.description}</Card>
          )}

          {issue.isNoise && issue.noiseReason && (
            <Card className="border-warning p-3 text-sm">
              <strong>Suppressed as noise.</strong> {issue.noiseReason}
            </Card>
          )}

          <StatGrid>
            <StatTile
              label="Confidence"
              value={`${issue.signalScore ?? 0}/100`}
              sub={`${issue.signalCount ?? 0} signal${issue.signalCount === 1 ? '' : 's'}`}
            />
            <StatTile label="First response" value={fmtDuration(issue.timeToFirstResponseMins)} />
            <StatTile label="Time to resolve" value={fmtDuration(issue.timeToResolutionMins)} />
            <StatTile label="Open siblings" value={ctx!.siblingIssues.length} />
          </StatGrid>

          {ctx!.issueTypeDef && (
            <Card className="p-4">
              <h2 className="mb-2 mt-0 text-[15px] font-semibold">Why this was raised</h2>
              <p className="mb-3 mt-0 text-sm text-muted-foreground">
                <strong>{ctx!.issueTypeDef.name}</strong> starts at{' '}
                {ctx!.issueTypeDef.baseConfidence}/100 confidence for a single signal, and gains
                confidence as corroborating signals arrive.
                {ctx!.issueTypeDef.latched
                  ? ' It is latched: it describes something that already happened, so it never auto-resolves and cannot be dismissed as noise.'
                  : ' It is unlatched: it auto-resolves when the underlying condition clears.'}
                {ctx!.issueTypeDef.slaMinutes
                  ? ` Target resolution: ${fmtDuration(ctx!.issueTypeDef.slaMinutes)}.`
                  : ''}
              </p>
              <div className="max-w-[260px]">
                <ConfidenceMeter score={issue.signalScore ?? 0} signalCount={issue.signalCount} />
              </div>
            </Card>
          )}

          <Card className="p-4">
            <h2 className="mb-3 mt-0 flex items-center gap-2 text-[15px] font-semibold">
              <Radio className="h-4 w-4" aria-hidden="true" /> Contributing signals
            </h2>
            {ctx!.signals.length === 0
              ? <TriageEmpty title="No signals attached" hint="This issue was created manually." />
              : (
                <div className="grid gap-1.5">
                  {ctx!.signals.map((s) => (
                    <div
                      key={s.id}
                      className="flex items-center gap-2.5 rounded-md border border-border px-2.5 py-1.5 text-sm"
                    >
                      <Badge variant="outline">{s.priority}</Badge>
                      <code className="flex-1 text-xs">{s.eventType}</code>
                      <span className="text-xs text-muted-foreground">{timeAgo(s.occurredAt)}</span>
                    </div>
                  ))}
                </div>
              )}
          </Card>

          <Card className="p-4">
            <h2 className="mb-1 mt-0 text-[15px] font-semibold">
              Other open issues on this {issue.sourceEntityType ?? 'entity'}
            </h2>
            <p className="mb-3 mt-0 text-sm text-muted-foreground">
              Is this the only thing wrong, or one of several?
            </p>
            {ctx!.siblingIssues.length === 0
              ? <TriageEmpty title="Nothing else open" hint="This is the only open issue on this entity." />
              : (
                <div className="grid gap-1.5">
                  {ctx!.siblingIssues.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => navigate(`/triage/issues/${s.id}`)}
                      className="flex cursor-pointer items-center gap-2.5 rounded-md border border-border bg-transparent px-2.5 py-2 text-left text-foreground hover:bg-primary/10"
                    >
                      <Badge variant={(PRIORITY_VARIANT[s.priority] ?? 'secondary') as never}>
                        {s.priority}
                      </Badge>
                      <span className="flex-1 text-sm">{s.title}</span>
                      <span className="text-xs text-muted-foreground">{timeAgo(s.createdAt)}</span>
                    </button>
                  ))}
                </div>
              )}
          </Card>

          <Card className="flex flex-wrap gap-2 p-3">
            <Button
              size="sm" disabled={acting || issue.status === 'in_progress'}
              onClick={() => act(() => triageApi.batchTransition([issue.id], 'in_progress'))}
            >
              Start work
            </Button>
            <Button
              size="sm" variant="outline" disabled={acting || issue.status === 'resolved'}
              onClick={() => act(() => triageApi.batchTransition([issue.id], 'resolved', 'Resolved from the triage detail view'))}
            >
              Resolve
            </Button>
            <Button
              size="sm" variant="outline"
              disabled={acting || !!issue.latched}
              title={issue.latched ? 'Latched safety issues cannot be dismissed as noise' : undefined}
              onClick={() => act(() => triageApi.batchDismissNoise([issue.id]))}
            >
              Dismiss as noise
            </Button>
          </Card>
        </>
      )}
    </div>
  );
}
