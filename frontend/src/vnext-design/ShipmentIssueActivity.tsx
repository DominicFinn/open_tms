import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Activity, AlertTriangle, Lock } from 'lucide-react';
import { API_URL } from '../api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

// ─── Types ───────────────────────────────────────────────────────────────
interface Signal {
  id: string;
  issueType: string | null;
  eventType: string;
  priority: string;
  issueId: string | null;
  occurredAt: string;
}
interface IssueRow {
  id: string;
  issueType: string | null;
  title: string;
  priority: string;
  status: string;
  latched: boolean;
  createdAt: string;
  resolvedAt: string | null;
  closedAt: string | null;
}

// Priority → theme fill class (no hardcoded colours — see theme.css).
const PRIORITY_FILL: Record<string, string> = {
  low: 'fill-muted-foreground',
  medium: 'fill-primary',
  high: 'fill-warning',
  critical: 'fill-destructive',
};
const PRIORITY_ORDER = ['low', 'medium', 'high', 'critical'];
const PRIORITY_CHIP: Record<string, string> = {
  low: 'vn-chip-secondary',
  medium: 'vn-chip-info',
  high: 'vn-chip-warning',
  critical: 'vn-chip-error',
};

function bucketLabel(t: number, spanMs: number): string {
  const d = new Date(t);
  if (spanMs <= 48 * 60 * 60 * 1000) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

// ─── Signals-over-time bar chart ───────────────────────────────────────────
function SignalsBarChart({ signals }: { signals: Signal[] }) {
  const chart = useMemo(() => {
    if (signals.length === 0) return null;
    const times = signals.map(s => new Date(s.occurredAt).getTime()).sort((a, b) => a - b);
    const min = times[0];
    const max = times[times.length - 1];
    const span = Math.max(max - min, 1);
    // Adaptive bucketing: hourly within 2 days, else daily.
    const bucketMs = span <= 48 * 60 * 60 * 1000 ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
    const bucketCount = Math.min(48, Math.max(1, Math.ceil(span / bucketMs) + 1));
    const buckets = Array.from({ length: bucketCount }, (_, i) => ({
      t: min + i * bucketMs,
      counts: { low: 0, medium: 0, high: 0, critical: 0 } as Record<string, number>,
      total: 0,
    }));
    for (const s of signals) {
      const idx = Math.min(bucketCount - 1, Math.floor((new Date(s.occurredAt).getTime() - min) / bucketMs));
      const p = PRIORITY_ORDER.includes(s.priority) ? s.priority : 'medium';
      buckets[idx].counts[p] += 1;
      buckets[idx].total += 1;
    }
    const maxTotal = Math.max(1, ...buckets.map(b => b.total));
    return { buckets, maxTotal, span };
  }, [signals]);

  if (!chart) {
    return <p className="py-6 text-center text-sm text-muted-foreground">No exception signals recorded yet.</p>;
  }

  const w = 640, h = 200, padL = 28, padR = 12, padT = 12, padB = 28;
  const plotW = w - padL - padR;
  const plotH = h - padT - padB;
  const { buckets, maxTotal, span } = chart;
  const bw = Math.max(2, (plotW / buckets.length) * 0.7);
  const xFor = (i: number) => padL + (i + 0.5) * (plotW / buckets.length);
  const yTicks = Array.from({ length: 3 }, (_, i) => Math.round((maxTotal * (i + 1)) / 3));
  const tickEvery = Math.ceil(buckets.length / 6);

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-auto w-full">
      {yTicks.map((v, i) => {
        const y = padT + (1 - v / maxTotal) * plotH;
        return (
          <g key={i}>
            <line x1={padL} y1={y} x2={w - padR} y2={y} className="stroke-border" strokeDasharray="2,3" strokeWidth="1" />
            <text x={padL - 4} y={y + 3} textAnchor="end" className="fill-muted-foreground text-[10px]">{v}</text>
          </g>
        );
      })}
      {buckets.map((b, i) => {
        let yCursor = padT + plotH;
        return (
          <g key={i}>
            {PRIORITY_ORDER.map(p => {
              const c = b.counts[p];
              if (!c) return null;
              const segH = (c / maxTotal) * plotH;
              yCursor -= segH;
              return (
                <rect key={p} x={xFor(i) - bw / 2} y={yCursor} width={bw} height={segH} className={PRIORITY_FILL[p]}>
                  <title>{`${bucketLabel(b.t, span)}: ${c} ${p}`}</title>
                </rect>
              );
            })}
            {i % tickEvery === 0 && (
              <text x={xFor(i)} y={h - padB + 14} textAnchor="middle" className="fill-muted-foreground text-[10px]">
                {bucketLabel(b.t, span)}
              </text>
            )}
          </g>
        );
      })}
      <line x1={padL} y1={padT} x2={padL} y2={h - padB} className="stroke-border" strokeWidth="1" />
      <line x1={padL} y1={h - padB} x2={w - padR} y2={h - padB} className="stroke-border" strokeWidth="1" />
    </svg>
  );
}

// ─── Issues-over-time timeline ─────────────────────────────────────────────
function IssuesTimeline({ issues }: { issues: IssueRow[] }) {
  const span = useMemo(() => {
    if (issues.length === 0) return null;
    const starts = issues.map(i => new Date(i.createdAt).getTime());
    const ends = issues.map(i => new Date(i.resolvedAt || i.closedAt || Date.now()).getTime());
    const min = Math.min(...starts);
    const max = Math.max(...ends, Date.now());
    return { min, max: Math.max(max, min + 1) };
  }, [issues]);

  if (!span) {
    return <p className="py-6 text-center text-sm text-muted-foreground">No issues raised for this shipment.</p>;
  }

  const total = span.max - span.min || 1;
  return (
    <div className="space-y-2">
      {issues.map(issue => {
        const start = new Date(issue.createdAt).getTime();
        const endRaw = issue.resolvedAt || issue.closedAt;
        const end = endRaw ? new Date(endRaw).getTime() : Date.now();
        const left = ((start - span.min) / total) * 100;
        const width = Math.max(1.5, ((end - start) / total) * 100);
        const openEnded = !endRaw;
        return (
          <div key={issue.id} className="flex items-center gap-3">
            <div className="w-40 shrink-0 truncate text-xs">
              <Link to={`/issues/${issue.id}`} className="hover:underline">{issue.title}</Link>
            </div>
            <div className="relative h-4 flex-1 rounded bg-muted/30">
              <div
                className="absolute top-0 h-4 rounded"
                style={{
                  left: `${left}%`,
                  width: `${Math.min(width, 100 - left)}%`,
                  background: `var(--${priorityVar(issue.priority)})`,
                  opacity: openEnded ? 0.9 : 0.55,
                }}
                title={`${issue.priority} · ${issue.status}${openEnded ? ' (open)' : ''}`}
              />
            </div>
            <span className={`vn-chip ${PRIORITY_CHIP[issue.priority] || 'vn-chip-secondary'} shrink-0`}>{issue.status}</span>
            {issue.latched && <Lock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-label="Latched" />}
          </div>
        );
      })}
    </div>
  );
}

// Priority → CSS custom property (for inline timeline bars).
function priorityVar(p: string): string {
  switch (p) {
    case 'critical': return 'color-error';
    case 'high': return 'color-warning';
    case 'low': return 'muted-foreground';
    default: return 'color-info';
  }
}

// ─── Container ─────────────────────────────────────────────────────────────
export default function ShipmentIssueActivity({ shipmentId }: { shipmentId: string }) {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [issues, setIssues] = useState<IssueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetch(`${API_URL}/api/v1/shipments/${shipmentId}/issue-activity`)
      .then(r => r.json())
      .then(json => {
        if (!alive) return;
        if (json.error) { setError(json.error); return; }
        setSignals(json.data?.signals || []);
        setIssues(json.data?.issues || []);
      })
      .catch(() => alive && setError('Failed to load issue activity'))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [shipmentId]);

  if (loading) return <p className="py-8 text-center text-sm text-muted-foreground">Loading activity…</p>;
  if (error) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
        <AlertTriangle className="h-4 w-4" /> {error}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="h-4 w-4 text-primary" /> Exception signals over time
          </CardTitle>
          <span className="text-xs text-muted-foreground">{signals.length} signal{signals.length === 1 ? '' : 's'}</span>
        </CardHeader>
        <CardContent>
          <SignalsBarChart signals={signals} />
          <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-muted-foreground">
            {PRIORITY_ORDER.map(p => (
              <span key={p} className="flex items-center gap-1">
                <svg width="10" height="10"><rect width="10" height="10" className={PRIORITY_FILL[p]} /></svg>
                {p}
              </span>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="h-4 w-4 text-primary" /> Issues over time
          </CardTitle>
          <span className="text-xs text-muted-foreground">{issues.length} issue{issues.length === 1 ? '' : 's'}</span>
        </CardHeader>
        <CardContent>
          <IssuesTimeline issues={issues} />
        </CardContent>
      </Card>
    </div>
  );
}
