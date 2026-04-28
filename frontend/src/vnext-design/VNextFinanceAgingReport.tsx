import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  CircleAlert,
  Clock,
  Download,
  Loader2,
  Wallet,
} from 'lucide-react';

import { API_URL } from '../api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

interface AgingBucket {
  current: number;
  days1to30: number;
  days31to60: number;
  days61to90: number;
  days90plus: number;
  total: number;
}

interface CustomerAging {
  customerId: string;
  customerName: string;
  invoiceCount: number;
  buckets: AgingBucket;
}

interface AgingData {
  totals: AgingBucket;
  customers: CustomerAging[];
  generatedAt: string;
  asOfDate: string;
}

function formatMoney(cents: number): string {
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const TONES = {
  primary: 'bg-primary/10 text-primary',
  success: 'bg-success/15 text-success',
  warning: 'bg-warning/15 text-warning',
  destructive: 'bg-destructive/10 text-destructive',
} as const;

export default function VNextFinanceAgingReport() {
  const [data, setData] = useState<AgingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [asOfDate, setAsOfDate] = useState(new Date().toISOString().slice(0, 10));

  const load = () => {
    setLoading(true);
    fetch(`${API_URL}/api/v1/reports/ar-aging?asOfDate=${asOfDate}`)
      .then(r => r.json())
      .then(j => { setData(j.data); setError(''); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [asOfDate]);

  const downloadCsv = () => {
    window.open(`${API_URL}/api/v1/reports/ar-aging/csv?asOfDate=${asOfDate}`, '_blank');
  };

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
  if (!data) return null;

  const t = data.totals;
  const pastDueTotal = t.days1to30 + t.days31to60 + t.days61to90 + t.days90plus;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">AR Aging Report</h1>
          <p className="mt-1 text-sm text-muted-foreground">Outstanding invoices by days past due as of {data.asOfDate}</p>
        </div>
        <div className="flex items-center gap-2">
          <Input
            type="date"
            value={asOfDate}
            onChange={e => setAsOfDate(e.target.value)}
            className="w-[170px]"
          />
          <Button variant="outline" size="sm" onClick={downloadCsv}>
            <Download className="h-4 w-4" /> Export CSV
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-5">
            <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg', TONES.primary)}>
              <Wallet className="h-5 w-5" />
            </div>
            <div className="mt-3 text-2xl font-bold tracking-tight font-mono tabular-nums">{formatMoney(t.total)}</div>
            <div className="mt-1 text-sm text-muted-foreground">Total Outstanding</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg', TONES.success)}>
              <Clock className="h-5 w-5" />
            </div>
            <div className="mt-3 text-2xl font-bold tracking-tight font-mono tabular-nums">{formatMoney(t.current)}</div>
            <div className="mt-1 text-sm text-muted-foreground">Current (Not Due)</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg', TONES.warning)}>
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div className="mt-3 text-2xl font-bold tracking-tight font-mono tabular-nums">{formatMoney(pastDueTotal)}</div>
            <div className="mt-1 text-sm text-muted-foreground">Past Due Total</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg', TONES.destructive)}>
              <CircleAlert className="h-5 w-5" />
            </div>
            <div className="mt-3 text-2xl font-bold tracking-tight font-mono tabular-nums">{formatMoney(t.days90plus)}</div>
            <div className="mt-1 text-sm text-muted-foreground">90+ Days</div>
          </CardContent>
        </Card>
      </div>

      {t.total > 0 && (
        <Card>
          <CardContent className="p-5">
            <h3 className="mb-3 text-base font-semibold">Aging Distribution</h3>
            <div className="flex h-8 overflow-hidden rounded-md bg-muted">
              {t.current > 0 && (
                <div
                  className="flex items-center justify-center bg-success text-xs font-semibold text-white"
                  style={{ width: `${(t.current / t.total) * 100}%` }}
                  title={`Current: ${formatMoney(t.current)}`}
                >
                  {(t.current / t.total * 100) > 10 ? 'Current' : ''}
                </div>
              )}
              {t.days1to30 > 0 && (
                <div
                  className="flex items-center justify-center bg-info text-xs font-semibold text-white"
                  style={{ width: `${(t.days1to30 / t.total) * 100}%` }}
                  title={`1-30 Days: ${formatMoney(t.days1to30)}`}
                >
                  {(t.days1to30 / t.total * 100) > 10 ? '1-30' : ''}
                </div>
              )}
              {t.days31to60 > 0 && (
                <div
                  className="flex items-center justify-center bg-warning text-xs font-semibold text-white"
                  style={{ width: `${(t.days31to60 / t.total) * 100}%` }}
                  title={`31-60 Days: ${formatMoney(t.days31to60)}`}
                >
                  {(t.days31to60 / t.total * 100) > 10 ? '31-60' : ''}
                </div>
              )}
              {t.days61to90 > 0 && (
                <div
                  className="flex items-center justify-center bg-accent text-xs font-semibold text-white"
                  style={{ width: `${(t.days61to90 / t.total) * 100}%` }}
                  title={`61-90 Days: ${formatMoney(t.days61to90)}`}
                >
                  {(t.days61to90 / t.total * 100) > 10 ? '61-90' : ''}
                </div>
              )}
              {t.days90plus > 0 && (
                <div
                  className="flex items-center justify-center bg-destructive text-xs font-semibold text-white"
                  style={{ width: `${(t.days90plus / t.total) * 100}%` }}
                  title={`90+ Days: ${formatMoney(t.days90plus)}`}
                >
                  {(t.days90plus / t.total * 100) > 10 ? '90+' : ''}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <div className="p-5">
          <h2 className="text-lg font-semibold">By Customer ({data.customers.length})</h2>
        </div>
        {data.customers.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-12 text-muted-foreground">
            <CheckCircle2 className="h-8 w-8" />
            <h3 className="text-base font-medium">No outstanding invoices</h3>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead className="text-right">Invoices</TableHead>
                <TableHead className="text-right">Current</TableHead>
                <TableHead className="text-right">1-30 Days</TableHead>
                <TableHead className="text-right">31-60 Days</TableHead>
                <TableHead className="text-right">61-90 Days</TableHead>
                <TableHead className="text-right">90+ Days</TableHead>
                <TableHead className="text-right font-bold">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.customers.map(c => (
                <TableRow key={c.customerId}>
                  <TableCell className="font-medium">{c.customerName}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums">{c.invoiceCount}</TableCell>
                  <TableCell className={cn('text-right font-mono tabular-nums', c.buckets.current === 0 && 'text-muted-foreground')}>{formatMoney(c.buckets.current)}</TableCell>
                  <TableCell className={cn('text-right font-mono tabular-nums', c.buckets.days1to30 === 0 && 'text-muted-foreground')}>{formatMoney(c.buckets.days1to30)}</TableCell>
                  <TableCell className={cn('text-right font-mono tabular-nums', c.buckets.days31to60 > 0 ? 'text-warning' : 'text-muted-foreground')}>{formatMoney(c.buckets.days31to60)}</TableCell>
                  <TableCell className={cn('text-right font-mono tabular-nums', c.buckets.days61to90 > 0 ? 'text-warning' : 'text-muted-foreground')}>{formatMoney(c.buckets.days61to90)}</TableCell>
                  <TableCell className={cn('text-right font-mono tabular-nums', c.buckets.days90plus > 0 ? 'text-destructive font-semibold' : 'text-muted-foreground')}>{formatMoney(c.buckets.days90plus)}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums font-bold">{formatMoney(c.buckets.total)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow className="font-bold">
                <TableCell>TOTAL</TableCell>
                <TableCell className="text-right font-mono tabular-nums">{data.customers.reduce((s, c) => s + c.invoiceCount, 0)}</TableCell>
                <TableCell className="text-right font-mono tabular-nums">{formatMoney(t.current)}</TableCell>
                <TableCell className="text-right font-mono tabular-nums">{formatMoney(t.days1to30)}</TableCell>
                <TableCell className="text-right font-mono tabular-nums">{formatMoney(t.days31to60)}</TableCell>
                <TableCell className="text-right font-mono tabular-nums">{formatMoney(t.days61to90)}</TableCell>
                <TableCell className={cn('text-right font-mono tabular-nums', t.days90plus > 0 && 'text-destructive')}>{formatMoney(t.days90plus)}</TableCell>
                <TableCell className="text-right font-mono tabular-nums">{formatMoney(t.total)}</TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        )}
      </Card>
    </div>
  );
}
