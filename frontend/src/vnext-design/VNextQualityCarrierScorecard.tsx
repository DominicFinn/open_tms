import React, { useEffect, useState, useMemo } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  CircleAlert,
  Loader2,
  Truck,
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

interface CarrierScore {
  dimensionName: string;
  totalIssues: number;
  criticalCount: number;
  highCount: number;
  exceptionCount: number;
  delayCount: number;
  damageCount: number;
  complianceCount: number;
  capaCount: number;
  avgResolutionHours: number | null;
  lastIssueAt: string | null;
  openCount: number;
  closedCount: number;
}

type SortField =
  | 'dimensionName'
  | 'totalIssues'
  | 'criticalCount'
  | 'highCount'
  | 'exceptionCount'
  | 'delayCount'
  | 'damageCount'
  | 'capaRate'
  | 'avgResolutionHours'
  | 'openCount';

type SortOrder = 'asc' | 'desc';

function formatHours(hours: number | null): string {
  if (hours === null || hours === undefined) return '--';
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  if (hours < 24) return `${hours.toFixed(1)}h`;
  return `${(hours / 24).toFixed(1)}d`;
}

function capaRate(row: CarrierScore): number {
  if (row.totalIssues === 0) return 0;
  return (row.capaCount / row.totalIssues) * 100;
}

function getSortValue(row: CarrierScore, field: SortField): number | string {
  switch (field) {
    case 'dimensionName': return row.dimensionName.toLowerCase();
    case 'capaRate': return capaRate(row);
    case 'avgResolutionHours': return row.avgResolutionHours ?? -1;
    default: return (row as unknown as Record<string, unknown>)[field] as number;
  }
}

export default function VNextQualityCarrierScorecard() {
  const [data, setData] = useState<CarrierScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sortBy, setSortBy] = useState<SortField>('totalIssues');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError('');
        const res = await fetch(`${API_URL}/api/v1/quality/reports/carrier-scorecard`);
        if (!res.ok) throw new Error(`Failed to load carrier scorecard (${res.status})`);
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

  const totalCarriers = data.length;
  const totalIssuesAll = data.reduce((s, r) => s + r.totalIssues, 0);
  const carriersWithCritical = data.filter(r => r.criticalCount > 0).length;

  const stats = [
    { label: 'Carriers', value: totalCarriers, icon: Truck, tone: 'bg-primary/10 text-primary' },
    { label: 'Total issues', value: totalIssuesAll, icon: AlertTriangle, tone: 'bg-warning/15 text-warning' },
    { label: 'Carriers with critical', value: carriersWithCritical, icon: CircleAlert, tone: 'bg-destructive/10 text-destructive' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Carrier quality scorecard</h1>
        <p className="mt-1 text-sm text-muted-foreground">Quality performance metrics across all carriers</p>
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
            <Truck className="h-10 w-10 opacity-40" />
            <h3 className="text-base font-medium">No carrier data</h3>
            <p className="text-sm">No carrier quality data is available yet.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="cursor-pointer" onClick={() => handleSort('dimensionName')}>Carrier name<SortIndicator field="dimensionName" /></TableHead>
                <TableHead className="cursor-pointer text-right" onClick={() => handleSort('totalIssues')}>Total<SortIndicator field="totalIssues" /></TableHead>
                <TableHead className="cursor-pointer text-center" onClick={() => handleSort('criticalCount')}>Critical<SortIndicator field="criticalCount" /></TableHead>
                <TableHead className="cursor-pointer text-center" onClick={() => handleSort('highCount')}>High<SortIndicator field="highCount" /></TableHead>
                <TableHead className="cursor-pointer text-right" onClick={() => handleSort('exceptionCount')}>Exceptions<SortIndicator field="exceptionCount" /></TableHead>
                <TableHead className="cursor-pointer text-right" onClick={() => handleSort('delayCount')}>Delays<SortIndicator field="delayCount" /></TableHead>
                <TableHead className="cursor-pointer text-right" onClick={() => handleSort('damageCount')}>Damage<SortIndicator field="damageCount" /></TableHead>
                <TableHead className="cursor-pointer text-right" onClick={() => handleSort('capaRate')}>CAPA rate<SortIndicator field="capaRate" /></TableHead>
                <TableHead className="cursor-pointer text-right" onClick={() => handleSort('avgResolutionHours')}>Avg res.<SortIndicator field="avgResolutionHours" /></TableHead>
                <TableHead className="cursor-pointer text-right" onClick={() => handleSort('openCount')}>Open<SortIndicator field="openCount" /></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((row, idx) => (
                <TableRow key={idx}>
                  <TableCell>
                    <div className="font-semibold">{row.dimensionName}</div>
                    <div className="text-xs text-muted-foreground">{row.closedCount} closed</div>
                  </TableCell>
                  <TableCell className="text-right font-semibold">{row.totalIssues}</TableCell>
                  <TableCell className="text-center">
                    {row.criticalCount > 0
                      ? <Badge variant="destructive">{row.criticalCount}</Badge>
                      : <span className="text-sm text-muted-foreground">0</span>}
                  </TableCell>
                  <TableCell className="text-center">
                    {row.highCount > 3
                      ? <Badge variant="warning">{row.highCount}</Badge>
                      : <span className="text-sm text-muted-foreground">{row.highCount}</span>}
                  </TableCell>
                  <TableCell className="text-right text-sm">{row.exceptionCount}</TableCell>
                  <TableCell className="text-right text-sm">{row.delayCount}</TableCell>
                  <TableCell className="text-right text-sm">{row.damageCount}</TableCell>
                  <TableCell className="text-right text-sm">
                    {row.totalIssues > 0 ? `${capaRate(row).toFixed(1)}%` : '--'}
                  </TableCell>
                  <TableCell className="text-right text-sm text-muted-foreground">
                    {formatHours(row.avgResolutionHours)}
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    {row.openCount > 0
                      ? <span className="font-semibold text-destructive">{row.openCount}</span>
                      : <span className="text-muted-foreground">0</span>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
