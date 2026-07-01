import React from 'react';
import { Thermometer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// ─── Time-series chart ──────────────────────────────────────────────────
// Renders sensor readings as a proper X/Y line chart: X = time (actual
// elapsed time between readings, not reading index), Y = value. Includes
// axis tick labels on both axes and gridlines so the mapping is legible.

export interface TimeSeriesPoint {
  t: number; // epoch ms
  v: number;
  alert?: boolean;
}

export function readingsToSeries(readings: any[], field: string): TimeSeriesPoint[] {
  return readings
    .filter(r => r[field] != null && r.eventTime)
    .map(r => ({ t: new Date(r.eventTime).getTime(), v: r[field], alert: !!r.isAlert }))
    .sort((a, b) => a.t - b.t);
}

function formatTick(t: number, spanMs: number): string {
  const d = new Date(t);
  if (spanMs <= 48 * 60 * 60 * 1000) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) +
    ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function TimeSeriesChart({
  points,
  unit = '',
  lineClassName = 'stroke-primary',
  pointClassName = 'fill-primary',
  band,
}: {
  points: TimeSeriesPoint[];
  unit?: string;
  lineClassName?: string;
  pointClassName?: string;
  band?: { min: number | null; max: number | null } | null;
}) {
  if (points.length < 2) {
    return (
      <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
        <Thermometer className="h-8 w-8" />
        <h3 className="text-sm font-medium">Not enough data in this period</h3>
      </div>
    );
  }

  const w = 640, h = 220, padL = 48, padR = 16, padT = 16, padB = 30;
  const plotW = w - padL - padR;
  const plotH = h - padT - padB;

  const minTime = points[0].t;
  const maxTime = points[points.length - 1].t;
  const timeSpan = maxTime - minTime || 1;

  let minV = Math.min(...points.map(p => p.v));
  let maxV = Math.max(...points.map(p => p.v));
  if (band?.min != null) minV = Math.min(minV, band.min);
  if (band?.max != null) maxV = Math.max(maxV, band.max);
  const rawSpan = maxV - minV || 1;
  const vPad = rawSpan * 0.15;
  minV -= vPad;
  maxV += vPad;
  const valueSpan = maxV - minV || 1;

  const xFor = (t: number) => padL + ((t - minTime) / timeSpan) * plotW;
  const yFor = (v: number) => padT + (1 - (v - minV) / valueSpan) * plotH;

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${xFor(p.t).toFixed(1)},${yFor(p.v).toFixed(1)}`).join(' ');

  const xTickCount = 5;
  const xTicks = Array.from({ length: xTickCount }, (_, i) => minTime + (timeSpan * i) / (xTickCount - 1));

  const yTickCount = 4;
  const yTicks = Array.from({ length: yTickCount }, (_, i) => minV + (valueSpan * i) / (yTickCount - 1));

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-auto w-full">
      {band?.min != null && band?.max != null && (
        <rect
          x={padL}
          y={yFor(band.max)}
          width={plotW}
          height={Math.max(0, yFor(band.min) - yFor(band.max))}
          className="fill-success/10"
        />
      )}

      {yTicks.map((v, i) => (
        <g key={`y-${i}`}>
          <line x1={padL} y1={yFor(v)} x2={w - padR} y2={yFor(v)} className="stroke-border" strokeDasharray="2,3" strokeWidth="1" />
          <text x={padL - 6} y={yFor(v) + 3} textAnchor="end" className="fill-muted-foreground text-[10px]">
            {v.toFixed(1)}{unit}
          </text>
        </g>
      ))}

      {xTicks.map((t, i) => (
        <text key={`x-${i}`} x={xFor(t)} y={h - padB + 16} textAnchor="middle" className="fill-muted-foreground text-[10px]">
          {formatTick(t, timeSpan)}
        </text>
      ))}

      <line x1={padL} y1={padT} x2={padL} y2={h - padB} className="stroke-border" strokeWidth="1" />
      <line x1={padL} y1={h - padB} x2={w - padR} y2={h - padB} className="stroke-border" strokeWidth="1" />

      <path d={linePath} fill="none" className={lineClassName} strokeWidth="2" />

      {points.map((p, i) => (
        <circle
          key={i}
          cx={xFor(p.t)}
          cy={yFor(p.v)}
          r={p.alert ? 5 : 2.5}
          className={p.alert ? 'fill-destructive' : pointClassName}
        >
          <title>{`${new Date(p.t).toLocaleString()}: ${p.v}${unit}${p.alert ? ' (alert)' : ''}`}</title>
        </circle>
      ))}
    </svg>
  );
}

// ─── Period filter ───────────────────────────────────────────────────────
// Quick presets plus a custom from/to range, all expressed as ISO
// since/until bounds the caller sends to the telemetry API.

export type TelemetryPeriodKey = '24h' | '3d' | '7d' | '30d' | 'all' | 'custom';

export const TELEMETRY_PERIODS: { key: TelemetryPeriodKey; label: string; hours?: number }[] = [
  { key: '24h', label: '24h', hours: 24 },
  { key: '3d', label: '3 days', hours: 72 },
  { key: '7d', label: '7 days', hours: 168 },
  { key: '30d', label: '30 days', hours: 720 },
  { key: 'all', label: 'All time' },
];

export function computeTelemetryRange(
  period: TelemetryPeriodKey,
  customFrom: string,
  customTo: string
): { since: string | null; until: string | null } {
  if (period === 'all') return { since: null, until: null };
  if (period === 'custom') {
    return {
      since: customFrom ? new Date(customFrom).toISOString() : null,
      until: customTo ? new Date(customTo).toISOString() : null,
    };
  }
  const hours = TELEMETRY_PERIODS.find(p => p.key === period)?.hours ?? 168;
  return { since: new Date(Date.now() - hours * 60 * 60 * 1000).toISOString(), until: null };
}

export function TelemetryPeriodFilter({
  period,
  onPeriodChange,
  customFrom,
  customTo,
  onCustomFromChange,
  onCustomToChange,
}: {
  period: TelemetryPeriodKey;
  onPeriodChange: (p: TelemetryPeriodKey) => void;
  customFrom: string;
  customTo: string;
  onCustomFromChange: (v: string) => void;
  onCustomToChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {TELEMETRY_PERIODS.map(p => (
        <Button
          key={p.key}
          size="sm"
          variant={period === p.key ? 'default' : 'outline'}
          onClick={() => onPeriodChange(p.key)}
        >
          {p.label}
        </Button>
      ))}
      <Button
        size="sm"
        variant={period === 'custom' ? 'default' : 'outline'}
        onClick={() => onPeriodChange('custom')}
      >
        Custom range
      </Button>

      {period === 'custom' && (
        <div className="flex flex-wrap items-center gap-2 pl-1">
          <label className="flex items-center gap-1 text-xs text-muted-foreground">
            From
            <input
              type="datetime-local"
              value={customFrom}
              onChange={e => onCustomFromChange(e.target.value)}
              className={cn('h-8 rounded-md border border-input bg-background px-2 text-xs')}
            />
          </label>
          <label className="flex items-center gap-1 text-xs text-muted-foreground">
            To
            <input
              type="datetime-local"
              value={customTo}
              onChange={e => onCustomToChange(e.target.value)}
              className={cn('h-8 rounded-md border border-input bg-background px-2 text-xs')}
            />
          </label>
        </div>
      )}
    </div>
  );
}
