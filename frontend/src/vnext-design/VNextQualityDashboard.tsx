import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  BarChart3,
  Bug,
  CheckCircle2,
  CircleAlert,
  ClipboardList,
  FileCheck,
  ListChecks,
  Loader2,
  Route,
  Truck,
  XCircle,
} from 'lucide-react';

import { API_URL } from '../api';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

interface DashboardData {
  issues: {
    total: number;
    open: number;
    critical: number;
    needsCapa: number;
    byCategory: { category: string; count: number }[];
    byPriority: { priority: string; count: number }[];
  };
  capa: {
    total: number;
    open: number;
    overdueFollowUps: number;
  };
  sop: {
    activeChecklists: number;
    overdueChecklists: number;
    recentAudits: number;
    failedAudits: number;
  };
}

interface TrendDay {
  date: string;
  total: number;
  byCategory: Record<string, number>;
  byPriority: Record<string, number>;
}

interface TrendsData {
  period: string;
  startDate: string;
  trends: TrendDay[];
}

interface DimensionSummary {
  dimensionType: string;
  dimensionId: string;
  dimensionName: string;
  totalIssues: number;
  criticalCount: number;
  damageCount: number;
  delayCount: number;
  exceptionCount: number;
  complianceCount: number;
  avgResolutionHours: number;
  lastIssueAt: string | null;
}

type Period = '7d' | '30d' | '90d';

type BadgeVariant = 'success' | 'destructive' | 'warning' | 'info' | 'secondary' | 'muted' | 'default';

function categoryVariant(category: string): BadgeVariant {
  switch (category) {
    case 'damage': return 'destructive';
    case 'delay': return 'warning';
    case 'exception': return 'info';
    case 'compliance': return 'default';
    case 'temperature': return 'destructive';
    case 'security': return 'warning';
    default: return 'secondary';
  }
}

function formatCategory(cat: string): string {
  return cat.charAt(0).toUpperCase() + cat.slice(1).replace(/_/g, ' ');
}

function formatHours(hours: number | null): string {
  if (hours === null || hours === undefined) return '--';
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  if (hours < 24) return `${hours.toFixed(1)}h`;
  return `${(hours / 24).toFixed(1)}d`;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '--';
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function VNextQualityDashboard() {
  const navigate = useNavigate();

  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [trends, setTrends] = useState<TrendsData | null>(null);
  const [topCarriers, setTopCarriers] = useState<DimensionSummary[]>([]);
  const [topLanes, setTopLanes] = useState<DimensionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [period, setPeriod] = useState<Period>('30d');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [dashRes, carrierRes, laneRes] = await Promise.all([
          fetch(`${API_URL}/api/v1/quality/dashboard`),
          fetch(`${API_URL}/api/v1/quality/summaries?dimensionType=carrier&sortBy=totalIssues&sortOrder=desc&limit=5`),
          fetch(`${API_URL}/api/v1/quality/summaries?dimensionType=lane&sortBy=totalIssues&sortOrder=desc&limit=5`),
        ]);

        if (!dashRes.ok) throw new Error('Failed to load quality dashboard');

        const dashJson = await dashRes.json();
        const carrierJson = await carrierRes.json();
        const laneJson = await laneRes.json();

        if (!cancelled) {
          setDashboard(dashJson.data || null);
          setTopCarriers(carrierJson.data || []);
          setTopLanes(laneJson.data || []);
        }
      } catch (e: any) {
        if (!cancelled) setError(e.message || 'Failed to load data');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadTrends() {
      try {
        const res = await fetch(`${API_URL}/api/v1/quality/trends?period=${period}`);
        if (res.ok) {
          const json = await res.json();
          if (!cancelled) setTrends(json.data || null);
        }
      } catch {
        // non-critical
      }
    }
    loadTrends();
    return () => { cancelled = true; };
  }, [period]);

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-3 py-24 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin" />
        <h3 className="text-lg font-medium">Loading...</h3>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-3 rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
        <CircleAlert className="h-5 w-5" />
        {error}
      </div>
    );
  }

  const d = dashboard!;

  const renderTrendsChart = () => {
    const data = trends?.trends || [];
    if (data.length === 0) {
      return (
        <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
          <BarChart3 className="h-10 w-10 opacity-50" />
          No trend data available
        </div>
      );
    }

    const maxVal = Math.max(...data.map(t => t.total), 1);
    return (
      <div className="flex h-48 items-end gap-0.5">
        {data.map(day => {
          const heightPct = Math.max(2, (day.total / maxVal) * 100);
          return (
            <div
              key={day.date}
              className="min-w-[4px] flex-1 rounded-t bg-primary/85"
              style={{ height: `${heightPct}%` }}
              title={`${day.date}: ${day.total} issues`}
            />
          );
        })}
      </div>
    );
  };

  const issueStats = [
    { label: 'Open issues', value: d.issues.open, icon: AlertTriangle, tone: 'bg-warning/15 text-warning', onClick: () => navigate('/issues') },
    { label: 'Critical issues', value: d.issues.critical, icon: CircleAlert, tone: 'bg-destructive/10 text-destructive', onClick: () => navigate('/issues') },
    { label: 'CAPA reports open', value: d.capa.open, icon: ClipboardList, tone: 'bg-primary/10 text-primary', onClick: () => navigate('/quality/capa') },
    { label: 'Overdue follow-ups', value: d.capa.overdueFollowUps, icon: AlertTriangle, tone: 'bg-destructive/10 text-destructive', onClick: () => navigate('/quality/capa') },
  ];

  const sopStats = [
    { label: 'Active checklists', value: d.sop.activeChecklists, icon: ListChecks, tone: 'bg-success/15 text-success' },
    { label: 'Overdue checklists', value: d.sop.overdueChecklists, icon: AlertTriangle, tone: 'bg-warning/15 text-warning' },
    { label: 'Recent audits', value: d.sop.recentAudits, icon: FileCheck, tone: 'bg-info/15 text-info' },
    { label: 'Failed audits', value: d.sop.failedAudits, icon: XCircle, tone: 'bg-destructive/10 text-destructive' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Quality centre</h1>
          <p className="mt-1 text-sm text-muted-foreground">Quality management, CAPA tracking, and GDP compliance</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate('/quality/summaries')}>
            <BarChart3 className="h-4 w-4" />
            Summaries
          </Button>
          <Button variant="gradient" onClick={() => navigate('/issues')}>
            <Bug className="h-4 w-4" />
            View issues
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {issueStats.map(stat => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label} className="cursor-pointer transition-colors hover:border-primary/40">
              <button type="button" onClick={stat.onClick} className="block w-full p-5 text-left">
                <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg', stat.tone)}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="mt-3 text-2xl font-bold tracking-tight">{stat.value}</div>
                <div className="mt-1 text-sm text-muted-foreground">{stat.label}</div>
              </button>
            </Card>
          );
        })}
      </div>

      {d.issues.byCategory.length > 0 && (
        <Card className="p-5">
          <h3 className="mb-3 text-base font-semibold">Issues by category</h3>
          <div className="flex flex-wrap gap-2">
            {d.issues.byCategory.map(({ category, count }) => (
              <Badge key={category} variant={categoryVariant(category)}>
                {formatCategory(category)}: {count}
              </Badge>
            ))}
          </div>
        </Card>
      )}

      <div>
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">SOP compliance</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {sopStats.map(stat => {
            const Icon = stat.icon;
            return (
              <Card key={stat.label} className="cursor-pointer transition-colors hover:border-primary/40" onClick={() => navigate('/quality/sop-audits')}>
                <div className="p-5">
                  <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg', stat.tone)}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="mt-3 text-2xl font-bold tracking-tight">{stat.value}</div>
                  <div className="mt-1 text-sm text-muted-foreground">{stat.label}</div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      <Card>
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            <h2 className="text-base font-semibold">Issues over time</h2>
          </div>
          <div className="flex gap-1">
            {(['7d', '30d', '90d'] as Period[]).map(p => (
              <Button
                key={p}
                size="sm"
                variant={p === period ? 'default' : 'ghost'}
                onClick={() => setPeriod(p)}
              >
                {p}
              </Button>
            ))}
          </div>
        </div>
        <Separator />
        <div className="p-5">{renderTrendsChart()}</div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <div className="flex items-center gap-2 p-4">
            <Truck className="h-5 w-5 text-destructive" />
            <h2 className="text-base font-semibold">Top problem carriers</h2>
          </div>
          <Separator />
          {topCarriers.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
              <CheckCircle2 className="h-10 w-10 opacity-50" />
              No carrier issues found
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Carrier</TableHead>
                  <TableHead className="text-right">Issues</TableHead>
                  <TableHead className="text-right">Critical</TableHead>
                  <TableHead className="text-right">Avg resolution</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topCarriers.map(c => (
                  <TableRow key={c.dimensionId} onClick={() => navigate(`/carriers/${c.dimensionId}`)} className="cursor-pointer">
                    <TableCell>
                      <div className="font-medium">{c.dimensionName}</div>
                      <div className="text-xs text-muted-foreground">Last issue: {formatDate(c.lastIssueAt)}</div>
                    </TableCell>
                    <TableCell className="text-right font-semibold">{c.totalIssues}</TableCell>
                    <TableCell className="text-right">
                      {c.criticalCount > 0 ? (
                        <Badge variant="destructive">{c.criticalCount}</Badge>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">{formatHours(c.avgResolutionHours)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>

        <Card>
          <div className="flex items-center gap-2 p-4">
            <Route className="h-5 w-5 text-warning" />
            <h2 className="text-base font-semibold">Top problem lanes</h2>
          </div>
          <Separator />
          {topLanes.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
              <CheckCircle2 className="h-10 w-10 opacity-50" />
              No lane issues found
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lane</TableHead>
                  <TableHead className="text-right">Issues</TableHead>
                  <TableHead className="text-right">Critical</TableHead>
                  <TableHead className="text-right">Avg resolution</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topLanes.map(l => (
                  <TableRow key={l.dimensionId} onClick={() => navigate(`/lanes/${l.dimensionId}`)} className="cursor-pointer">
                    <TableCell>
                      <div className="font-medium">{l.dimensionName}</div>
                      <div className="text-xs text-muted-foreground">Last issue: {formatDate(l.lastIssueAt)}</div>
                    </TableCell>
                    <TableCell className="text-right font-semibold">{l.totalIssues}</TableCell>
                    <TableCell className="text-right">
                      {l.criticalCount > 0 ? (
                        <Badge variant="destructive">{l.criticalCount}</Badge>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">{formatHours(l.avgResolutionHours)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="cursor-pointer p-5 transition-colors hover:border-primary/40" onClick={() => navigate('/quality/capa')}>
          <div className="flex items-center gap-3">
            <ClipboardList className="h-7 w-7 text-primary" />
            <h3 className="text-base font-semibold">CAPA reports</h3>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">Corrective and Preventive Action reports for quality events.</p>
          <div className="mt-3 flex gap-6">
            <div>
              <div className="text-xl font-bold">{d.capa.total}</div>
              <div className="text-xs text-muted-foreground">Total</div>
            </div>
            <div>
              <div className="text-xl font-bold">{d.capa.open}</div>
              <div className="text-xs text-muted-foreground">Open</div>
            </div>
          </div>
          <Button variant="secondary" className="mt-4 w-full">View CAPA reports</Button>
        </Card>

        <Card className="cursor-pointer p-5 transition-colors hover:border-primary/40" onClick={() => navigate('/quality/sop-audits')}>
          <div className="flex items-center gap-3">
            <FileCheck className="h-7 w-7 text-primary" />
            <h3 className="text-base font-semibold">SOP audits</h3>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">Standard operating procedure checklists and audit records.</p>
          <div className="mt-3 flex gap-6">
            <div>
              <div className="text-xl font-bold">{d.sop.recentAudits}</div>
              <div className="text-xs text-muted-foreground">Recent</div>
            </div>
            <div>
              <div className="text-xl font-bold">{d.sop.failedAudits}</div>
              <div className="text-xs text-muted-foreground">Failed</div>
            </div>
          </div>
          <Button variant="secondary" className="mt-4 w-full">View SOP audits</Button>
        </Card>

        <Card className="cursor-pointer p-5 transition-colors hover:border-primary/40" onClick={() => navigate('/quality/summaries')}>
          <div className="flex items-center gap-3">
            <BarChart3 className="h-7 w-7 text-primary" />
            <h3 className="text-base font-semibold">Issue summaries</h3>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">Aggregated quality metrics by carrier, lane, and customer.</p>
          <div className="mt-3 flex gap-6">
            <div>
              <div className="text-xl font-bold">{d.issues.total}</div>
              <div className="text-xs text-muted-foreground">Total issues</div>
            </div>
            <div>
              <div className="text-xl font-bold">{d.issues.needsCapa}</div>
              <div className="text-xs text-muted-foreground">Needs CAPA</div>
            </div>
          </div>
          <Button variant="secondary" className="mt-4 w-full">View summaries</Button>
        </Card>
      </div>
    </div>
  );
}
