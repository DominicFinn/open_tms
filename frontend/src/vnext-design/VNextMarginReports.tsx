import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';

import { API_URL } from '../api';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

type ReportView = 'customer' | 'carrier' | 'lane' | 'time';

interface MarginRow {
  customerId?: string;
  customerName?: string;
  carrierId?: string;
  carrierName?: string;
  laneId?: string;
  laneName?: string;
  period?: string;
  targetMarginPercent?: number | null;
  varianceFromTarget?: number | null;
  shipmentCount: number;
  totalRevenueCents: number;
  totalCostCents: number;
  totalMarginCents: number;
  marginPercent: number;
  revenueCents?: number;
  costCents?: number;
  marginCents?: number;
}

function formatCents(cents: number): string {
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function marginColorClass(pct: number): string {
  if (pct >= 15) return 'text-success';
  if (pct >= 5) return 'text-warning';
  return 'text-destructive';
}

export default function VNextMarginReports() {
  const [view, setView] = useState<ReportView>('customer');
  const [data, setData] = useState<MarginRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);
      const endpoint = view === 'time' ? 'over-time' : `by-${view}`;
      const res = await fetch(`${API_URL}/api/v1/reports/margin/${endpoint}?${params}`);
      const json = await res.json();
      setData(json.data || []);
    } catch { setData([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, [view, dateFrom, dateTo]);

  const totals = data.reduce((acc, r) => ({
    revenue: acc.revenue + (r.totalRevenueCents || r.revenueCents || 0),
    cost: acc.cost + (r.totalCostCents || r.costCents || 0),
    margin: acc.margin + (r.totalMarginCents || r.marginCents || 0),
    count: acc.count + (r.shipmentCount || 0),
  }), { revenue: 0, cost: 0, margin: 0, count: 0 });

  const totalMarginPct = totals.revenue > 0 ? (totals.margin / totals.revenue) * 100 : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Margin Reports</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Analyze profitability by customer, carrier, lane, or time period
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardContent className="p-5">
            <div className="text-sm text-muted-foreground">Total Revenue</div>
            <div className="mt-1 text-2xl font-bold tracking-tight font-mono tabular-nums">{formatCents(totals.revenue)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="text-sm text-muted-foreground">Total Cost</div>
            <div className="mt-1 text-2xl font-bold tracking-tight font-mono tabular-nums">{formatCents(totals.cost)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="text-sm text-muted-foreground">Total Margin</div>
            <div className={cn('mt-1 text-2xl font-bold tracking-tight font-mono tabular-nums', marginColorClass(totalMarginPct))}>
              {formatCents(totals.margin)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="text-sm text-muted-foreground">Margin %</div>
            <div className={cn('mt-1 text-2xl font-bold tracking-tight font-mono tabular-nums', marginColorClass(totalMarginPct))}>
              {totalMarginPct.toFixed(1)}%
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="text-sm text-muted-foreground">Shipments</div>
            <div className="mt-1 text-2xl font-bold tracking-tight font-mono tabular-nums">{totals.count}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <div className="flex flex-wrap items-center gap-3 p-4">
          <Tabs value={view} onValueChange={v => setView(v as ReportView)} className="flex-1">
            <TabsList>
              <TabsTrigger value="customer">By Customer</TabsTrigger>
              <TabsTrigger value="carrier">By Carrier</TabsTrigger>
              <TabsTrigger value="lane">By Lane</TabsTrigger>
              <TabsTrigger value="time">Over Time</TabsTrigger>
            </TabsList>
          </Tabs>
          <Input
            type="date"
            value={dateFrom}
            onChange={e => setDateFrom(e.target.value)}
            className="w-[150px]"
          />
          <span className="text-sm text-muted-foreground">to</span>
          <Input
            type="date"
            value={dateTo}
            onChange={e => setDateTo(e.target.value)}
            className="w-[150px]"
          />
        </div>
      </Card>

      <Card>
        {loading ? (
          <div className="flex flex-col items-center gap-3 py-12 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin" />
            <h3 className="text-base font-medium">Loading...</h3>
          </div>
        ) : data.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            No data for the selected period
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{view === 'customer' ? 'Customer' : view === 'carrier' ? 'Carrier' : view === 'lane' ? 'Lane' : 'Period'}</TableHead>
                <TableHead className="text-right">Shipments</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
                <TableHead className="text-right">Cost</TableHead>
                <TableHead className="text-right">Margin</TableHead>
                <TableHead className="text-right">Margin %</TableHead>
                {view === 'customer' && <TableHead className="text-right">Target</TableHead>}
                {view === 'customer' && <TableHead className="text-right">Variance</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((r, i) => {
                const name = r.customerName || r.carrierName || r.laneName || r.period || '-';
                const revenue = r.totalRevenueCents || r.revenueCents || 0;
                const cost = r.totalCostCents || r.costCents || 0;
                const margin = r.totalMarginCents || r.marginCents || 0;
                const pct = r.marginPercent;
                return (
                  <TableRow key={i}>
                    <TableCell className="font-semibold">{name}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums">{r.shipmentCount}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums">{formatCents(revenue)}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums">{formatCents(cost)}</TableCell>
                    <TableCell className={cn('text-right font-mono tabular-nums font-semibold', marginColorClass(pct))}>{formatCents(margin)}</TableCell>
                    <TableCell className={cn('text-right font-mono tabular-nums font-semibold', marginColorClass(pct))}>{pct.toFixed(1)}%</TableCell>
                    {view === 'customer' && (
                      <TableCell className="text-right font-mono tabular-nums">
                        {r.targetMarginPercent != null ? `${r.targetMarginPercent}%` : '-'}
                      </TableCell>
                    )}
                    {view === 'customer' && (
                      <TableCell
                        className={cn(
                          'text-right font-mono tabular-nums font-semibold',
                          r.varianceFromTarget != null
                            ? (r.varianceFromTarget >= 0 ? 'text-success' : 'text-destructive')
                            : 'text-muted-foreground',
                        )}
                      >
                        {r.varianceFromTarget != null ? `${r.varianceFromTarget > 0 ? '+' : ''}${r.varianceFromTarget.toFixed(1)}%` : '-'}
                      </TableCell>
                    )}
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
