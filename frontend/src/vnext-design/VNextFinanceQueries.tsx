import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircle2,
  CircleAlert,
  Clock,
  DollarSign,
  HelpCircle,
  Loader2,
} from 'lucide-react';

import { API_URL } from '../api';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

interface FinancialQuery {
  id: string;
  queryNumber: string;
  queryType: string;
  reason: string;
  description: string;
  status: string;
  disputedAmountCents: number | null;
  shipmentId: string | null;
  invoiceId: string | null;
  carrierInvoiceId: string | null;
  assigneeId: string | null;
  createdBy: string | null;
  createdAt: string;
  resolvedAt: string | null;
  adjustmentCents: number | null;
}

function formatMoney(cents: number): string {
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' | 'info' | 'muted';

function statusVariant(status: string): BadgeVariant {
  switch (status) {
    case 'raised': return 'warning';
    case 'investigating': return 'info';
    case 'resolved_adjusted': return 'success';
    case 'resolved_upheld': return 'secondary';
    case 'closed': return 'secondary';
    default: return 'secondary';
  }
}

function reasonLabel(reason: string): string {
  const map: Record<string, string> = {
    overcharge: 'Overcharge',
    service_failure: 'Service Failure',
    missing_pod: 'Missing POD',
    wrong_rate: 'Wrong Rate',
    damage_claim: 'Damage Claim',
    missing_items: 'Missing Items',
    temperature_excursion: 'Temp Excursion',
  };
  return map[reason] || reason;
}

const TONES = {
  primary: 'bg-primary/10 text-primary',
  warning: 'bg-warning/15 text-warning',
  success: 'bg-success/15 text-success',
  destructive: 'bg-destructive/10 text-destructive',
} as const;

export default function VNextFinanceQueries() {
  const navigate = useNavigate();
  const [queries, setQueries] = useState<FinancialQuery[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');

  useEffect(() => {
    fetch(`${API_URL}/api/v1/financial-queries`)
      .then(r => r.json())
      .then(j => setQueries(j.data || []))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const stats = {
    total: queries.length,
    open: queries.filter(q => ['raised', 'investigating'].includes(q.status)).length,
    adjusted: queries.filter(q => q.status === 'resolved_adjusted').length,
    totalDisputed: queries.filter(q => ['raised', 'investigating'].includes(q.status)).reduce((s, q) => s + (q.disputedAmountCents || 0), 0),
  };

  const filtered = queries.filter(q => {
    if (statusFilter !== 'all' && q.status !== statusFilter) return false;
    if (typeFilter !== 'all' && q.queryType !== typeFilter) return false;
    return true;
  });

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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Queries &amp; Disputes</h1>
          <p className="mt-1 text-sm text-muted-foreground">{stats.open} open queries</p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-5">
            <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg', TONES.primary)}>
              <HelpCircle className="h-5 w-5" />
            </div>
            <div className="mt-3 text-2xl font-bold tracking-tight">{stats.total}</div>
            <div className="mt-1 text-sm text-muted-foreground">Total</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg', TONES.warning)}>
              <Clock className="h-5 w-5" />
            </div>
            <div className="mt-3 text-2xl font-bold tracking-tight">{stats.open}</div>
            <div className="mt-1 text-sm text-muted-foreground">Open</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg', TONES.success)}>
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div className="mt-3 text-2xl font-bold tracking-tight">{stats.adjusted}</div>
            <div className="mt-1 text-sm text-muted-foreground">Adjusted</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg', TONES.destructive)}>
              <DollarSign className="h-5 w-5" />
            </div>
            <div className="mt-3 text-2xl font-bold tracking-tight font-mono tabular-nums">{formatMoney(stats.totalDisputed)}</div>
            <div className="mt-1 text-sm text-muted-foreground">Amount Disputed</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <div className="flex flex-wrap items-center gap-3 p-4">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[220px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="raised">Raised</SelectItem>
              <SelectItem value="investigating">Investigating</SelectItem>
              <SelectItem value="resolved_adjusted">Resolved (Adjusted)</SelectItem>
              <SelectItem value="resolved_upheld">Resolved (Upheld)</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="customer_dispute">Customer Disputes</SelectItem>
              <SelectItem value="carrier_dispute">Carrier Disputes</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-12 text-muted-foreground">
            <HelpCircle className="h-8 w-8" />
            <h3 className="text-base font-medium">No queries found</h3>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Query #</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Disputed</TableHead>
                <TableHead className="text-right">Adjustment</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(q => (
                <TableRow key={q.id} className="cursor-pointer" onClick={() => navigate(`/finance/queries/${q.id}`)}>
                  <TableCell>
                    <span className="font-mono text-sm font-semibold">{q.queryNumber}</span>
                  </TableCell>
                  <TableCell>
                    <Badge variant={q.queryType === 'customer_dispute' ? 'default' : 'warning'}>
                      {q.queryType === 'customer_dispute' ? 'Customer' : 'Carrier'}
                    </Badge>
                  </TableCell>
                  <TableCell>{reasonLabel(q.reason)}</TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(q.status)}>{q.status.replace(/_/g, ' ')}</Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums">
                    {q.disputedAmountCents ? formatMoney(q.disputedAmountCents) : '-'}
                  </TableCell>
                  <TableCell className={cn('text-right font-mono tabular-nums', q.adjustmentCents ? 'text-success' : 'text-muted-foreground')}>
                    {q.adjustmentCents ? formatMoney(q.adjustmentCents) : '-'}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(q.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
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
