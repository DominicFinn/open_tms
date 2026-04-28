import React, { useEffect, useState, useMemo } from 'react';
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  CircleAlert,
  ClipboardList,
  Clock,
  Loader2,
} from 'lucide-react';

import { API_URL } from '../api';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

interface CapaRow {
  id: string;
  reportNumber: string;
  title: string;
  status: string;
  priority: string;
  rootCauseCategory: string | null;
  issue: {
    title: string;
    category: string;
    priority: string;
  } | null;
  followUpStats: {
    total: number;
    completed: number;
    overdue: number;
    effective: number;
    completionRate: number;
  };
  createdAt: string;
}

type SortField =
  | 'reportNumber'
  | 'title'
  | 'status'
  | 'priority'
  | 'completionRate'
  | 'overdue'
  | 'createdAt';

type SortOrder = 'asc' | 'desc';

type BadgeVariant = 'success' | 'destructive' | 'warning' | 'info' | 'secondary' | 'muted' | 'default';

function statusVariant(status: string): BadgeVariant {
  switch (status) {
    case 'closed': return 'success';
    case 'open': return 'info';
    case 'in_progress': return 'default';
    case 'draft': return 'secondary';
    default: return 'secondary';
  }
}

function priorityVariant(priority: string): BadgeVariant {
  switch (priority) {
    case 'critical': return 'destructive';
    case 'high': return 'warning';
    case 'medium': return 'info';
    case 'low': return 'secondary';
    default: return 'secondary';
  }
}

function formatLabel(str: string | null): string {
  if (!str) return '--';
  return str.charAt(0).toUpperCase() + str.slice(1).replace(/_/g, ' ');
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function getSortValue(row: CapaRow, field: SortField): number | string {
  switch (field) {
    case 'reportNumber': return row.reportNumber.toLowerCase();
    case 'title': return row.title.toLowerCase();
    case 'status': return row.status;
    case 'priority': {
      const order: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
      return order[row.priority] ?? 4;
    }
    case 'completionRate': return row.followUpStats.completionRate;
    case 'overdue': return row.followUpStats.overdue;
    case 'createdAt': return new Date(row.createdAt).getTime();
    default: return 0;
  }
}

export default function VNextQualityCapaEffectiveness() {
  const [data, setData] = useState<CapaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sortBy, setSortBy] = useState<SortField>('createdAt');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError('');
        const res = await fetch(`${API_URL}/api/v1/quality/reports/capa-effectiveness`);
        if (!res.ok) throw new Error(`Failed to load CAPA effectiveness report (${res.status})`);
        const json = await res.json();
        if (!cancelled) setData(json.data || []);
      } catch (err: any) {
        if (!cancelled) setError(err.message || 'Failed to load data');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const sorted = useMemo(() => {
    const copy = [...data];
    copy.sort((a, b) => {
      const aVal = getSortValue(a, sortBy);
      const bVal = getSortValue(b, sortBy);
      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
    return copy;
  }, [data, sortBy, sortOrder]);

  function handleSort(field: SortField) {
    if (sortBy === field) {
      setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  }

  function SortIndicator({ field }: { field: SortField }) {
    if (sortBy !== field) return null;
    return sortOrder === 'asc' ? <ArrowUp className="ml-1 inline h-3 w-3" /> : <ArrowDown className="ml-1 inline h-3 w-3" />;
  }

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

  const totalCapas = data.length;
  const avgCompletionRate = totalCapas > 0
    ? data.reduce((s, r) => s + r.followUpStats.completionRate, 0) / totalCapas
    : 0;
  const totalOverdue = data.reduce((s, r) => s + r.followUpStats.overdue, 0);

  const stats = [
    { label: 'Total CAPAs', value: totalCapas, icon: ClipboardList, tone: 'bg-primary/10 text-primary' },
    { label: 'Avg completion rate', value: `${avgCompletionRate.toFixed(0)}%`, icon: CheckCircle2, tone: 'bg-success/15 text-success' },
    { label: 'Overdue follow-ups', value: totalOverdue, icon: Clock, tone: 'bg-destructive/10 text-destructive' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">CAPA effectiveness report</h1>
        <p className="mt-1 text-sm text-muted-foreground">Corrective and preventive action completion and effectiveness tracking</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {stats.map(stat => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label}>
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

      <Card>
        {sorted.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-12 text-muted-foreground">
            <ClipboardList className="h-10 w-10 opacity-40" />
            <h3 className="text-base font-medium">No CAPA data</h3>
            <p className="text-sm">No CAPA reports are available yet.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="cursor-pointer" onClick={() => handleSort('reportNumber')}>Report #<SortIndicator field="reportNumber" /></TableHead>
                <TableHead className="cursor-pointer" onClick={() => handleSort('title')}>Title<SortIndicator field="title" /></TableHead>
                <TableHead className="cursor-pointer text-center" onClick={() => handleSort('status')}>Status<SortIndicator field="status" /></TableHead>
                <TableHead className="cursor-pointer text-center" onClick={() => handleSort('priority')}>Priority<SortIndicator field="priority" /></TableHead>
                <TableHead>Root cause</TableHead>
                <TableHead>Issue category</TableHead>
                <TableHead className="text-right">Follow-ups</TableHead>
                <TableHead className="cursor-pointer text-right" onClick={() => handleSort('completionRate')}>Completion rate<SortIndicator field="completionRate" /></TableHead>
                <TableHead className="cursor-pointer text-right" onClick={() => handleSort('overdue')}>Overdue<SortIndicator field="overdue" /></TableHead>
                <TableHead className="cursor-pointer text-right" onClick={() => handleSort('createdAt')}>Created<SortIndicator field="createdAt" /></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map(row => {
                const hasOverdue = row.followUpStats.overdue > 0;
                const lowCompletion = row.followUpStats.completionRate < 50;
                const rowWarning = hasOverdue || lowCompletion;
                const completionTone = row.followUpStats.completionRate >= 80
                  ? 'bg-success'
                  : row.followUpStats.completionRate >= 50
                    ? 'bg-warning'
                    : 'bg-destructive';

                return (
                  <TableRow key={row.id} className={cn(rowWarning && 'bg-warning/5')}>
                    <TableCell><span className="font-mono text-sm font-semibold">{row.reportNumber}</span></TableCell>
                    <TableCell><span className="font-medium">{row.title}</span></TableCell>
                    <TableCell className="text-center">
                      <Badge variant={statusVariant(row.status)}>{formatLabel(row.status)}</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={priorityVariant(row.priority)}>{formatLabel(row.priority)}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatLabel(row.rootCauseCategory)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{row.issue ? formatLabel(row.issue.category) : '--'}</TableCell>
                    <TableCell className="text-right text-sm">
                      <span className="font-semibold">{row.followUpStats.completed}</span>
                      <span className="text-muted-foreground"> / {row.followUpStats.total}</span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="h-1.5 w-14 overflow-hidden rounded-full bg-muted">
                          <div
                            className={cn('h-full rounded-full', completionTone)}
                            style={{ width: `${Math.min(row.followUpStats.completionRate, 100)}%` }}
                          />
                        </div>
                        <span className={cn(
                          'min-w-[36px] text-right text-sm font-semibold',
                          row.followUpStats.completionRate < 50 && 'text-destructive',
                        )}>
                          {row.followUpStats.completionRate.toFixed(0)}%
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      {row.followUpStats.overdue > 0
                        ? <Badge variant="warning">{row.followUpStats.overdue}</Badge>
                        : <span className="text-sm text-muted-foreground">0</span>}
                    </TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">
                      {formatDate(row.createdAt)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
