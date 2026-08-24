/**
 * Triage signal dashboard — the landing page of the Triage app.
 *
 * Answers three questions: how much is coming in, how much of it is real, and
 * what keeps coming back. The noise ratio is the headline number: a triage
 * queue that is mostly noise trains people to ignore it.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Radar, ArrowRight, Repeat } from 'lucide-react';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

import { triageApi, SignalSummary, ActionableIssue, fmtDuration, STATUS_LABEL } from './triage/api';
import {
  TriageLoading, TriageError, TriageEmpty, StatTile, StatGrid, IssueCard, BarList,
} from './triage/components';

const RANGES = [
  { value: '24h', label: '24 hours' },
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: '90d', label: '90 days' },
];

export default function VNextTriageDashboard() {
  const navigate = useNavigate();
  const [range, setRange] = useState('7d');
  const [summary, setSummary] = useState<SignalSummary | null>(null);
  const [actionable, setActionable] = useState<ActionableIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [s, a] = await Promise.all([triageApi.signal(range), triageApi.actionable(8)]);
      setSummary(s);
      setActionable(a);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => { void load(); }, [load]);

  return (
    <div className="grid gap-5">
      <header className="flex flex-wrap items-center gap-3">
        <Radar className="h-5 w-5" aria-hidden="true" />
        <h1 className="m-0 flex-1 text-xl font-semibold">Signal Dashboard</h1>
        <div className="flex gap-1" role="group" aria-label="Date range">
          {RANGES.map((r) => (
            <Button
              key={r.value}
              size="sm"
              variant={range === r.value ? 'default' : 'outline'}
              onClick={() => setRange(r.value)}
            >
              {r.label}
            </Button>
          ))}
        </div>
      </header>

      {loading && <TriageLoading label="Loading signal data" />}
      {error && !loading && <TriageError message={error} onRetry={load} />}

      {summary && !loading && !error && (
        <>
          <div aria-live="polite">
            <StatGrid>
              <StatTile label="Issues raised" value={summary.total} sub={`in the last ${range}`} />
              <StatTile
                label="Real signal"
                value={summary.signalCount}
                sub={`${100 - summary.noiseRatio}% of volume`}
                tone="success"
              />
              <StatTile
                label="Suppressed as noise"
                value={summary.noiseCount}
                sub={`${summary.noiseRatio}% of volume`}
                tone={summary.noiseRatio > 50 ? 'warning' : undefined}
              />
              <StatTile label="Mean confidence" value={`${summary.avgSignalScore}/100`} />
              <StatTile
                label="SLA breached"
                value={summary.slaBreaches}
                tone={summary.slaBreaches ? 'error' : undefined}
              />
              <StatTile
                label="At risk now"
                value={summary.slaAtRisk}
                sub="open and past deadline"
                tone={summary.slaAtRisk ? 'warning' : undefined}
              />
              <StatTile label="Mean time to resolve" value={fmtDuration(summary.avgTimeToResolutionMins)} />
              <StatTile label="Mean first response" value={fmtDuration(summary.avgTimeToFirstResponseMins)} />
            </StatGrid>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="p-4">
              <h2 className="mb-3 mt-0 text-[15px] font-semibold">By issue type</h2>
              {summary.byType.length === 0
                ? <TriageEmpty title="Nothing raised in this window" />
                : (
                  <BarList
                    rows={summary.byType.map((t) => ({ label: t.name, count: t.count }))}
                    onSelect={(i) => navigate(`/triage/board?issueType=${summary.byType[i].issueType}`)}
                  />
                )}
            </Card>

            <Card className="p-4">
              <h2 className="mb-3 mt-0 text-[15px] font-semibold">By status</h2>
              {Object.keys(summary.byStatus).length === 0
                ? <TriageEmpty title="Nothing raised in this window" />
                : (
                  <BarList
                    rows={Object.entries(summary.byStatus).map(([k, v]) => ({
                      label: STATUS_LABEL[k] ?? k, count: v,
                    }))}
                  />
                )}
            </Card>
          </div>

          <Card className="p-4">
            <h2 className="mb-1 mt-0 flex items-center gap-2 text-[15px] font-semibold">
              <Repeat className="h-4 w-4" aria-hidden="true" /> Recurring offenders
            </h2>
            <p className="mb-3 mt-0 text-sm text-muted-foreground">
              Entities raising the same issue type more than once. Repeats usually mean something
              systemic rather than a one-off.
            </p>
            {summary.recurring.length === 0
              ? <TriageEmpty title="No repeat offenders" hint="Every issue in this window is a one-off." />
              : (
                <div className="grid gap-1.5">
                  {summary.recurring.map((r) => (
                    <button
                      key={`${r.sourceEntityId}-${r.issueType}`}
                      type="button"
                      onClick={() => navigate(`/triage/search?sourceEntityId=${r.sourceEntityId}`)}
                      className="flex cursor-pointer items-center gap-2.5 rounded-md border border-border bg-transparent px-2.5 py-2 text-left text-foreground hover:bg-primary/10"
                    >
                      <Badge variant="destructive">{r.count}×</Badge>
                      <span className="flex-1 text-sm">{r.name ?? 'Unknown type'}</span>
                      <code className="text-xs text-muted-foreground">
                        {r.sourceEntityId?.slice(0, 8)}
                      </code>
                      <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  ))}
                </div>
              )}
          </Card>

          <Card className="p-4">
            <div className="mb-3 flex items-center gap-2">
              <h2 className="m-0 flex-1 text-[15px] font-semibold">Work next</h2>
              <Button size="sm" variant="outline" onClick={() => navigate('/triage/board')}>
                Open the board
              </Button>
            </div>
            {actionable.length === 0
              ? <TriageEmpty title="Nothing waiting" hint="No open, un-snoozed issues above the noise bar." />
              : (
                <div className="grid gap-2">
                  {actionable.map((i) => (
                    <IssueCard
                      key={i.id}
                      issue={i}
                      onOpen={(id) => navigate(`/triage/issues/${id}`)}
                    />
                  ))}
                </div>
              )}
          </Card>
        </>
      )}
    </div>
  );
}
