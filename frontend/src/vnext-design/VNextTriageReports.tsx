/**
 * Triage reports — performance of the triage operation over a date range:
 * volume trend, mean time to resolve, SLA breach rate, and the same broken
 * down by issue type, assignee and priority.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { BarChart3 } from 'lucide-react';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import { triageApi, TriageReport, fmtDuration } from './triage/api';
import { TriageLoading, TriageError, TriageEmpty, StatTile, StatGrid } from './triage/components';

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

const PRESETS = [
  { label: '7 days', days: 7 },
  { label: '30 days', days: 30 },
  { label: '90 days', days: 90 },
];

export default function VNextTriageReports() {
  const [from, setFrom] = useState(() => isoDay(new Date(Date.now() - 30 * 86_400_000)));
  const [to, setTo] = useState(() => isoDay(new Date()));
  const [report, setReport] = useState<TriageReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // `to` is exclusive server-side, so push it to the end of the chosen day
      // — otherwise picking today silently excludes today.
      const toExclusive = new Date(`${to}T00:00:00.000Z`);
      toExclusive.setUTCDate(toExclusive.getUTCDate() + 1);
      setReport(await triageApi.reports(`${from}T00:00:00.000Z`, toExclusive.toISOString()));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => { void load(); }, [load]);

  const applyPreset = (days: number) => {
    setFrom(isoDay(new Date(Date.now() - days * 86_400_000)));
    setTo(isoDay(new Date()));
  };

  const invalid = from > to;

  return (
    <div className="grid gap-4">
      <header className="flex flex-wrap items-center gap-3">
        <BarChart3 className="h-5 w-5" aria-hidden="true" />
        <h1 className="m-0 flex-1 text-xl font-semibold">Triage Reports</h1>
      </header>

      <Card className="flex flex-wrap items-end gap-3 p-3">
        <label className="grid gap-1 text-xs text-muted-foreground">
          From
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" />
        </label>
        <label className="grid gap-1 text-xs text-muted-foreground">
          To
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
        </label>
        <div className="flex gap-1">
          {PRESETS.map((p) => (
            <Button key={p.days} size="sm" variant="outline" onClick={() => applyPreset(p.days)}>
              {p.label}
            </Button>
          ))}
        </div>
        {invalid && (
          <span className="text-sm text-destructive" role="alert">
            The start date must be on or before the end date.
          </span>
        )}
      </Card>

      {loading && <TriageLoading label="Building report" />}
      {error && !loading && <TriageError message={error} onRetry={load} />}

      {report && !loading && !error && (
        <>
          <div aria-live="polite"><StatGrid>
            <StatTile label="Issues raised" value={report.total} />
            <StatTile
              label="SLA breaches"
              value={report.slaBreaches}
              tone={report.slaBreaches ? 'error' : 'success'}
            />
            <StatTile
              label="Breach rate"
              value={`${report.breachRate}%`}
              tone={report.breachRate > 20 ? 'error' : report.breachRate > 5 ? 'warning' : 'success'}
            />
            <StatTile label="Mean time to resolve" value={fmtDuration(report.avgTimeToResolutionMins)} />
            <StatTile label="Mean first response" value={fmtDuration(report.avgTimeToFirstResponseMins)} />
          </StatGrid></div>

          <Card className="p-4">
            <h2 className="mb-3 mt-0 text-[15px] font-semibold">Daily volume</h2>
            {report.daily.length === 0
              ? <TriageEmpty title="No issues in this range" />
              : <DailyChart data={report.daily} />}
          </Card>

          <div className="grid gap-4 xl:grid-cols-2">
            <Card className="overflow-x-auto p-4">
              <h2 className="mb-3 mt-0 text-[15px] font-semibold">By issue type</h2>
              {report.byType.length === 0 ? <TriageEmpty title="No data" /> : (
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-border text-left">
                      <th className="p-2">Type</th>
                      <th className="p-2">Count</th>
                      <th className="p-2">MTTR</th>
                      <th className="p-2">Mean confidence</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.byType.map((t) => (
                      <tr key={t.issueType} className="border-b border-border">
                        <td className="p-2">{t.name}</td>
                        <td className="p-2 tabular-nums">{t.count}</td>
                        <td className="p-2">{fmtDuration(t.avgTimeToResolutionMins)}</td>
                        <td className="p-2 tabular-nums">{t.avgSignalScore}/100</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>

            <Card className="overflow-x-auto p-4">
              <h2 className="mb-3 mt-0 text-[15px] font-semibold">By assignee</h2>
              {report.byAssignee.length === 0
                ? <TriageEmpty title="Nothing assigned in this range" />
                : (
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-border text-left">
                        <th className="p-2">Assignee</th>
                        <th className="p-2">Count</th>
                        <th className="p-2">MTTR</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.byAssignee.map((a) => (
                        <tr key={a.assigneeName} className="border-b border-border">
                          <td className="p-2">{a.assigneeName}</td>
                          <td className="p-2 tabular-nums">{a.count}</td>
                          <td className="p-2">{fmtDuration(a.avgTimeToResolutionMins)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
            </Card>
          </div>

          <Card className="p-4">
            <h2 className="mb-3 mt-0 text-[15px] font-semibold">By priority</h2>
            {report.byPriority.length === 0 ? <TriageEmpty title="No data" /> : (
              <div className="flex flex-wrap gap-3">
                {report.byPriority.map((p) => (
                  <div key={p.priority} className="rounded-md border border-border px-3.5 py-2">
                    <div className="text-xs text-muted-foreground">{p.priority}</div>
                    <div className="text-xl font-semibold tabular-nums">{p.count}</div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}

/**
 * Daily volume as a column chart. Deliberately plain SVG — the value is the
 * shape of the trend, and a chart library would be a dependency for one view.
 */
function DailyChart({ data }: { data: { day: string; count: number }[] }) {
  const max = Math.max(...data.map((d) => d.count), 1);
  const barW = 100 / data.length;

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox="0 0 100 40"
        preserveAspectRatio="none"
        role="img"
        aria-label={`Daily issue volume, peak ${max} on a single day`}
        className="h-40 w-full"
        // Computed minimum width so a long range stays readable and scrolls.
        style={{ minWidth: Math.max(280, data.length * 12) }}
      >
        {data.map((d, i) => {
          const h = (d.count / max) * 36;
          return (
            <rect
              key={d.day}
              x={i * barW + barW * 0.15}
              y={40 - h}
              width={barW * 0.7}
              height={h}
              className="fill-primary"
            >
              <title>{`${d.day}: ${d.count}`}</title>
            </rect>
          );
        })}
      </svg>
      <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
        <span>{data[0]?.day}</span>
        <span>peak {max}</span>
        <span>{data[data.length - 1]?.day}</span>
      </div>
    </div>
  );
}
