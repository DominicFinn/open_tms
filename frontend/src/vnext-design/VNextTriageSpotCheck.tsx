/**
 * Spot check — QA on the triage process itself.
 *
 * Samples recently settled issues so a supervisor can review whether they were
 * handled correctly. The sample is spread across the window rather than random,
 * so it cannot cluster on one bad afternoon and misrepresent the week.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileSearch, ChevronRight, ChevronDown } from 'lucide-react';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

import {
  triageApi, SpotCheckResult, IssueTypeDef, fmtDuration, timeAgo, STATUS_LABEL,
} from './triage/api';
import {
  TriageLoading, TriageError, TriageEmpty, StatTile, StatGrid, ConfidenceMeter, SlaPill,
} from './triage/components';

const RANGES = [
  { value: '24h', label: '24 hours' },
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
];
const SAMPLE_SIZES = [10, 20, 50];

export default function VNextTriageSpotCheck() {
  const navigate = useNavigate();
  const [range, setRange] = useState('7d');
  const [sampleSize, setSampleSize] = useState(20);
  const [includeNoise, setIncludeNoise] = useState(false);
  const [result, setResult] = useState<SpotCheckResult | null>(null);
  const [types, setTypes] = useState<IssueTypeDef[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      setResult(await triageApi.spotCheck(range, sampleSize, includeNoise));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [range, sampleSize, includeNoise]);

  useEffect(() => { void load(); }, [load]);

  return (
    <div className="grid gap-4">
      <header className="flex flex-wrap items-center gap-3">
        <FileSearch className="h-5 w-5" aria-hidden="true" />
        <h1 className="m-0 flex-1 text-xl font-semibold">Spot Check</h1>
      </header>

      <Card className="flex flex-wrap items-center gap-5 p-3">
        <div className="flex items-center gap-1" role="group" aria-label="Window">
          <span className="text-xs text-muted-foreground">Window</span>
          {RANGES.map((r) => (
            <Button
              key={r.value} size="sm"
              variant={range === r.value ? 'default' : 'outline'}
              onClick={() => setRange(r.value)}
            >
              {r.label}
            </Button>
          ))}
        </div>

        <div className="flex items-center gap-1" role="group" aria-label="Sample size">
          <span className="text-xs text-muted-foreground">Sample</span>
          {SAMPLE_SIZES.map((n) => (
            <Button
              key={n} size="sm"
              variant={sampleSize === n ? 'default' : 'outline'}
              onClick={() => setSampleSize(n)}
            >
              {n}
            </Button>
          ))}
        </div>

        <label className="flex cursor-pointer items-center gap-1.5 text-sm">
          <input
            type="checkbox"
            checked={includeNoise}
            onChange={(e) => setIncludeNoise(e.target.checked)}
          />
          Include suppressed issues
        </label>
      </Card>

      {loading && <TriageLoading label="Sampling" />}
      {error && !loading && <TriageError message={error} onRetry={load} />}

      {result && !loading && !error && (
        <>
          <StatGrid>
            <StatTile label="Settled in window" value={result.total} />
            <StatTile label="Sampled" value={result.sampled} sub="spread across the window" />
            <StatTile
              label="SLA breach rate"
              value={`${result.breachRate}%`}
              tone={result.breachRate > 20 ? 'error' : result.breachRate > 5 ? 'warning' : 'success'}
            />
            <StatTile
              label="Mean time to resolve"
              value={fmtDuration(result.avgTimeToResolutionMins)}
            />
          </StatGrid>

          {result.items.length === 0 ? (
            <TriageEmpty
              title="Nothing settled in this window"
              hint="Widen the window, or check that issues are being resolved at all."
            />
          ) : (
            <Card className="p-0">
              {result.items.map((i) => {
                const open = expanded === i.id;
                return (
                  <div key={i.id} className="border-b border-border">
                    <button
                      type="button"
                      aria-expanded={open}
                      onClick={() => setExpanded(open ? null : i.id)}
                      className="flex w-full cursor-pointer items-center gap-2.5 border-none bg-transparent p-3 text-left text-foreground hover:bg-primary/10"
                    >
                      {open
                        ? <ChevronDown className="h-4 w-4" aria-hidden="true" />
                        : <ChevronRight className="h-4 w-4" aria-hidden="true" />}
                      <span className="flex-1 text-sm font-medium">{i.title}</span>
                      <Badge variant="secondary">{STATUS_LABEL[i.status] ?? i.status}</Badge>
                      <SlaPill deadline={i.slaDeadline} breached={i.slaBreach} />
                      <span className="min-w-[70px] text-right text-xs text-muted-foreground">
                        {fmtDuration(i.timeToResolutionMins)}
                      </span>
                    </button>

                    {open && (
                      <div className="grid gap-2.5 pb-4 pl-[38px] pr-3">
                        <dl className="m-0 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
                          <Field label="Type">
                            {i.issueType ? typeNames[i.issueType] ?? i.issueType : i.category}
                          </Field>
                          <Field label="Priority">{i.priority}</Field>
                          <Field label="Assignee">{i.assigneeName ?? 'unassigned'}</Field>
                          <Field label="Raised">{timeAgo(i.createdAt)}</Field>
                          <Field label="First response">{fmtDuration(i.timeToFirstResponseMins)}</Field>
                          <Field label="Signals">{i.signalCount}</Field>
                        </dl>

                        <div className="max-w-[220px]">
                          <div className="mb-1 text-xs text-muted-foreground">Confidence</div>
                          <ConfidenceMeter score={i.signalScore} signalCount={i.signalCount} />
                        </div>

                        {i.isNoise && i.noiseReason && (
                          <div className="text-sm text-muted-foreground">
                            <strong>Suppressed:</strong> {i.noiseReason}
                          </div>
                        )}

                        {i.description && (
                          <div className="text-sm text-muted-foreground">{i.description}</div>
                        )}

                        <div>
                          <Button size="sm" variant="outline" onClick={() => navigate(`/triage/issues/${i.id}`)}>
                            Open issue
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="m-0">{children}</dd>
    </div>
  );
}
