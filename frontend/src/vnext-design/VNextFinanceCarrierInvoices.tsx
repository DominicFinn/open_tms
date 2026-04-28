import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CircleAlert,
  ClipboardList,
  CreditCard,
  Loader2,
  Search,
  Truck,
} from 'lucide-react';

import { API_URL } from '../api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
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

interface CarrierInvoice {
  id: string;
  invoiceNumber: string;
  carrierId: string;
  carrier: { name: string; scacCode: string | null };
  status: string;
  totalCents: number;
  approvedCents: number | null;
  currency: string;
  matchStatus: string;
  varianceCents: number | null;
  variancePercent: number | null;
  autoApproved: boolean;
  receivedDate: string;
  dueDate: string;
  lineItems: any[];
}

function formatMoney(cents: number): string {
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' | 'info' | 'muted';

function statusVariant(status: string): BadgeVariant {
  switch (status) {
    case 'received': return 'info';
    case 'matched': return 'success';
    case 'discrepancy': return 'destructive';
    case 'approved': return 'success';
    case 'scheduled': return 'warning';
    case 'paid': return 'success';
    case 'disputed': return 'destructive';
    default: return 'secondary';
  }
}

function matchVariant(status: string): BadgeVariant {
  switch (status) {
    case 'matched': return 'success';
    case 'partial_match': return 'warning';
    case 'mismatch': return 'destructive';
    default: return 'secondary';
  }
}

const TONES = {
  primary: 'bg-primary/10 text-primary',
  warning: 'bg-warning/15 text-warning',
  destructive: 'bg-destructive/10 text-destructive',
  info: 'bg-info/15 text-info',
} as const;

export default function VNextFinanceCarrierInvoices() {
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState<CarrierInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    fetch(`${API_URL}/api/v1/carrier-invoices`)
      .then(r => r.json())
      .then(j => setInvoices(j.data || []))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const stats = {
    total: invoices.length,
    pendingReview: invoices.filter(i => ['received', 'discrepancy'].includes(i.status)).length,
    discrepancies: invoices.filter(i => i.status === 'discrepancy').length,
    totalDue: invoices.filter(i => ['approved', 'scheduled'].includes(i.status)).reduce((s, i) => s + (i.approvedCents ?? i.totalCents), 0),
  };

  const filtered = invoices.filter(i => {
    if (statusFilter !== 'all' && i.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return i.invoiceNumber.toLowerCase().includes(q) || i.carrier.name.toLowerCase().includes(q);
    }
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
          <h1 className="text-3xl font-bold tracking-tight">Carrier Invoices</h1>
          <p className="mt-1 text-sm text-muted-foreground">{invoices.length} carrier invoices</p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-5">
            <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg', TONES.primary)}>
              <Truck className="h-5 w-5" />
            </div>
            <div className="mt-3 text-2xl font-bold tracking-tight">{stats.total}</div>
            <div className="mt-1 text-sm text-muted-foreground">Total</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg', TONES.warning)}>
              <ClipboardList className="h-5 w-5" />
            </div>
            <div className="mt-3 text-2xl font-bold tracking-tight">{stats.pendingReview}</div>
            <div className="mt-1 text-sm text-muted-foreground">Pending Review</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg', TONES.destructive)}>
              <CircleAlert className="h-5 w-5" />
            </div>
            <div className="mt-3 text-2xl font-bold tracking-tight">{stats.discrepancies}</div>
            <div className="mt-1 text-sm text-muted-foreground">Discrepancies</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg', TONES.info)}>
              <CreditCard className="h-5 w-5" />
            </div>
            <div className="mt-3 text-2xl font-bold tracking-tight font-mono tabular-nums">{formatMoney(stats.totalDue)}</div>
            <div className="mt-1 text-sm text-muted-foreground">Due for Payment</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <div className="flex flex-wrap items-center gap-3 p-4">
          <div className="relative min-w-[280px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search carrier invoices..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="received">Received</SelectItem>
              <SelectItem value="matched">Matched</SelectItem>
              <SelectItem value="discrepancy">Discrepancy</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-12 text-muted-foreground">
            <Truck className="h-8 w-8" />
            <h3 className="text-base font-medium">No carrier invoices found</h3>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice #</TableHead>
                <TableHead>Carrier</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Match</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">Variance</TableHead>
                <TableHead>Received</TableHead>
                <TableHead>Due</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(inv => (
                <TableRow key={inv.id} className="cursor-pointer" onClick={() => navigate(`/finance/carrier-invoices/${inv.id}`)}>
                  <TableCell>
                    <span className="font-mono text-sm font-semibold">{inv.invoiceNumber}</span>
                  </TableCell>
                  <TableCell>
                    {inv.carrier.name}
                    {inv.carrier.scacCode && <span className="text-sm text-muted-foreground"> ({inv.carrier.scacCode})</span>}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Badge variant={statusVariant(inv.status)}>{inv.status}</Badge>
                      {inv.autoApproved && <Badge variant="info" className="text-[10px]">auto</Badge>}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={matchVariant(inv.matchStatus)}>{inv.matchStatus.replace(/_/g, ' ')}</Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums font-medium">{formatMoney(inv.totalCents)}</TableCell>
                  <TableCell
                    className={cn(
                      'text-right font-mono tabular-nums',
                      inv.varianceCents && inv.varianceCents > 0 && 'text-destructive',
                      inv.varianceCents && inv.varianceCents < 0 && 'text-success',
                      !inv.varianceCents && 'text-muted-foreground',
                    )}
                  >
                    {inv.varianceCents ? `${inv.varianceCents > 0 ? '+' : ''}${formatMoney(inv.varianceCents)}` : '-'}
                    {inv.variancePercent ? ` (${inv.variancePercent}%)` : ''}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{formatDate(inv.receivedDate)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{formatDate(inv.dueDate)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
