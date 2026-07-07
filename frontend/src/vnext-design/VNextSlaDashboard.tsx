/**
 * VNextSlaDashboard - SLA health dashboard for control centres.
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  Clock,
  TimerOff,
  CheckCircle2,
  ShieldCheck,
  RefreshCw,
  Pause,
  Play,
  Download,
} from 'lucide-react';

import { API_URL } from '../api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DatePicker } from '@/components/ui/date-picker';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

interface SlaSummary {
  active: number;
  warning: number;
  breached: number;
  met: number;
  total: number;
}

interface SlaEvaluation {
  id: string;
  ruleType: string;
  ruleName: string;
  entityType: string;
  entityId: string;
  entityReference: string | null;
  status: string;
  slaDueAt: string | null;
  slaStartedAt: string;
  breachedAt: string | null;
  breachDurationMinutes: number | null;
  remainingMinutes: number | null;
  customerId: string | null;
}

function formatMinutes(minutes: number | null): string {
  if (minutes === null) return '--';
  if (minutes < 0) return `${Math.abs(minutes)}m overdue`;
  if (minutes < 60) return `${minutes}m`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
  return `${Math.floor(minutes / 1440)}d ${Math.floor((minutes % 1440) / 60)}h`;
}

function statusVariant(status: string): 'success' | 'warning' | 'destructive' | 'info' | 'secondary' {
  switch (status) {
    case 'breached': return 'destructive';
    case 'warning': return 'warning';
    case 'active': return 'info';
    case 'met': return 'success';
    default: return 'secondary';
  }
}

function getRuleTypeLabel(ruleType: string): string {
  const labels: Record<string, string> = {
    eta_delivery: 'ETA Delivery',
    issue_response: 'Issue Response',
    issue_resolution: 'Issue Resolution',
    dwell_time: 'Dwell Time',
    light_event: 'Light Event',
    seal_event: 'Seal Event',
    temperature_excursion: 'Temp Excursion',
    temperature_out_of_range: 'Out of Range',
  };
  return labels[ruleType] || ruleType;
}

export default function VNextSlaDashboard() {
  const [summary, setSummary] = useState<SlaSummary>({ active: 0, warning: 0, breached: 0, met: 0, total: 0 });
  const [atRisk, setAtRisk] = useState<SlaEvaluation[]>([]);
  const [breached, setBreached] = useState<SlaEvaluation[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [reportFrom, setReportFrom] = useState(() => new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10));
  const [reportTo, setReportTo] = useState(() => new Date().toISOString().slice(0, 10));

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [sumRes, riskRes, breachRes] = await Promise.all([
        fetch(`${API_URL}/api/v1/sla/evaluations/summary`),
        fetch(`${API_URL}/api/v1/sla/evaluations?status=active,warning&limit=20`),
        fetch(`${API_URL}/api/v1/sla/evaluations?status=breached&limit=20`),
      ]);

      if (sumRes.ok) {
        const d = await sumRes.json();
        setSummary(d.data || { active: 0, warning: 0, breached: 0, met: 0, total: 0 });
      }
      if (riskRes.ok) {
        const d = await riskRes.json();
        setAtRisk(d.data?.items || []);
      }
      if (breachRes.ok) {
        const d = await breachRes.json();
        setBreached(d.data?.items || []);
      }
      setLastRefresh(new Date());
    } catch (err) {
      console.error('[SlaDashboard] Fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(fetchAll, 30_000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchAll]);

  const complianceRate = summary.total > 0
    ? Math.round((summary.met / (summary.met + summary.breached || 1)) * 100)
    : 100;

  const stats = [
    { label: 'Compliance rate', value: `${complianceRate}%`, color: 'text-success', border: 'border-l-success' },
    { label: 'Active SLAs', value: summary.active, color: 'text-info', border: 'border-l-info' },
    { label: 'At risk', value: summary.warning, color: 'text-warning', border: 'border-l-warning' },
    { label: 'Breached', value: summary.breached, color: 'text-destructive', border: 'border-l-destructive' },
    { label: 'Met', value: summary.met, color: 'text-success', border: 'border-l-success' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">SLA dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">Service level agreement monitoring</p>
        </div>
        <div className="flex items-center gap-2">
          {lastRefresh && (
            <span className="text-xs text-muted-foreground">
              Updated {lastRefresh.toLocaleTimeString()}
            </span>
          )}
          <Button
            variant={autoRefresh ? 'default' : 'outline'}
            onClick={() => setAutoRefresh(prev => !prev)}
          >
            {autoRefresh ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            {autoRefresh ? 'Live' : 'Paused'}
          </Button>
          <Button variant="outline" onClick={fetchAll}>
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-5">
        {stats.map(s => (
          <Card key={s.label} className={cn('border-l-4', s.border)}>
            <CardContent className="p-4">
              <div className={cn('text-3xl font-bold tracking-tight', s.color)}>{s.value}</div>
              <div className="mt-1 text-xs text-muted-foreground">{s.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-warning" />
              At risk ({atRisk.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {atRisk.length === 0 && !loading ? (
              <div className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
                <CheckCircle2 className="h-8 w-8" />
                <p className="text-sm">No SLAs at risk</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Entity</TableHead>
                    <TableHead>Rule</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Time left</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {atRisk.map(e => (
                    <TableRow key={e.id}>
                      <TableCell>
                        <a
                          href={`/${e.entityType === 'shipment' ? 'shipments' : 'issues'}/${e.entityId}`}
                          className="font-medium text-primary hover:underline"
                        >
                          {e.entityReference || e.entityId.slice(0, 8)}
                        </a>
                        <div className="text-xs text-muted-foreground">{e.entityType}</div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{e.ruleName}</div>
                        <div className="text-xs text-muted-foreground">{getRuleTypeLabel(e.ruleType)}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusVariant(e.status)}>{e.status}</Badge>
                      </TableCell>
                      <TableCell className={cn('font-semibold', e.status === 'warning' && 'text-warning')}>
                        {e.slaDueAt
                          ? formatMinutes(Math.round((new Date(e.slaDueAt).getTime() - Date.now()) / 60_000))
                          : '--'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TimerOff className="h-5 w-5 text-destructive" />
              Breached ({breached.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {breached.length === 0 && !loading ? (
              <div className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
                <ShieldCheck className="h-8 w-8" />
                <p className="text-sm">No SLA breaches</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Entity</TableHead>
                    <TableHead>Rule</TableHead>
                    <TableHead>Breached</TableHead>
                    <TableHead>Overdue</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {breached.map(e => (
                    <TableRow key={e.id}>
                      <TableCell>
                        <a
                          href={`/${e.entityType === 'shipment' ? 'shipments' : 'issues'}/${e.entityId}`}
                          className="font-medium text-primary hover:underline"
                        >
                          {e.entityReference || e.entityId.slice(0, 8)}
                        </a>
                        <div className="text-xs text-muted-foreground">{e.entityType}</div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{e.ruleName}</div>
                        <div className="text-xs text-muted-foreground">{getRuleTypeLabel(e.ruleType)}</div>
                      </TableCell>
                      <TableCell className="text-xs">
                        {e.breachedAt ? new Date(e.breachedAt).toLocaleString() : '--'}
                      </TableCell>
                      <TableCell className="font-semibold text-destructive">
                        {formatMinutes(e.breachDurationMinutes)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Export compliance report</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Download a CSV report of SLA evaluations for sharing with customers or internal review.
          </p>
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label>From</Label>
              <DatePicker
                type="date"
                id="report-from"
                value={reportFrom}
                onChange={e => setReportFrom(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>To</Label>
              <DatePicker
                type="date"
                id="report-to"
                value={reportTo}
                onChange={e => setReportTo(e.target.value)}
              />
            </div>
            <Button
              variant="outline"
              onClick={() => {
                const params = new URLSearchParams();
                if (reportFrom) params.set('from', reportFrom);
                if (reportTo) params.set('to', reportTo);
                window.open(`${API_URL}/api/v1/reports/sla-compliance?${params}`, '_blank');
              }}
            >
              <Download className="h-4 w-4" />
              Download CSV
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

