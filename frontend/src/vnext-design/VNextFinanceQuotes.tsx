import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  CircleAlert,
  Clock,
  DollarSign,
  FileText,
  Handshake,
  Loader2,
  Plus,
  Search,
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

interface Quote {
  id: string;
  quoteNumber: string;
  customerId: string;
  customer: { name: string };
  status: string;
  serviceLevel: string;
  totalRevenueCents: number;
  totalCostCents: number;
  marginCents: number;
  marginPercent: string;
  currency: string;
  validUntil: string;
  createdAt: string;
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
    case 'draft': return 'secondary';
    case 'sent': return 'info';
    case 'accepted': return 'success';
    case 'declined': return 'destructive';
    case 'expired': return 'warning';
    case 'superseded': return 'secondary';
    default: return 'secondary';
  }
}

const TONES = {
  primary: 'bg-primary/10 text-primary',
  info: 'bg-info/15 text-info',
  success: 'bg-success/15 text-success',
} as const;

export default function VNextFinanceQuotes() {
  const navigate = useNavigate();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    fetch(`${API_URL}/api/v1/quotes`)
      .then(r => r.json())
      .then(j => setQuotes(j.data || []))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const stats = {
    total: quotes.length,
    active: quotes.filter(q => ['draft', 'sent'].includes(q.status)).length,
    accepted: quotes.filter(q => q.status === 'accepted').length,
    totalRevenue: quotes.filter(q => q.status === 'accepted').reduce((s, q) => s + q.totalRevenueCents, 0),
  };

  const filtered = quotes.filter(q => {
    if (statusFilter !== 'all' && q.status !== statusFilter) return false;
    if (search) {
      const s = search.toLowerCase();
      return q.quoteNumber.toLowerCase().includes(s) || q.customer.name.toLowerCase().includes(s);
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
          <h1 className="text-3xl font-bold tracking-tight">Quotes</h1>
          <p className="mt-1 text-sm text-muted-foreground">{quotes.length} quotes</p>
        </div>
        <div className="flex gap-2">
          <Button variant="gradient" asChild>
            <Link to="/finance/quotes/create">
              <Plus className="h-4 w-4" />
              New Quote
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-5">
            <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg', TONES.primary)}>
              <FileText className="h-5 w-5" />
            </div>
            <div className="mt-3 text-2xl font-bold tracking-tight">{stats.total}</div>
            <div className="mt-1 text-sm text-muted-foreground">Total</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg', TONES.info)}>
              <Clock className="h-5 w-5" />
            </div>
            <div className="mt-3 text-2xl font-bold tracking-tight">{stats.active}</div>
            <div className="mt-1 text-sm text-muted-foreground">Active</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg', TONES.success)}>
              <Handshake className="h-5 w-5" />
            </div>
            <div className="mt-3 text-2xl font-bold tracking-tight">{stats.accepted}</div>
            <div className="mt-1 text-sm text-muted-foreground">Accepted</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg', TONES.success)}>
              <DollarSign className="h-5 w-5" />
            </div>
            <div className="mt-3 text-2xl font-bold tracking-tight font-mono tabular-nums">{formatMoney(stats.totalRevenue)}</div>
            <div className="mt-1 text-sm text-muted-foreground">Won Revenue</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <div className="flex flex-wrap items-center gap-3 p-4">
          <div className="relative min-w-[280px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search quotes..."
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
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="sent">Sent</SelectItem>
              <SelectItem value="accepted">Accepted</SelectItem>
              <SelectItem value="declined">Declined</SelectItem>
              <SelectItem value="expired">Expired</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-12 text-muted-foreground">
            <FileText className="h-8 w-8" />
            <h3 className="text-base font-medium">No quotes found</h3>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Quote #</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Service</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
                <TableHead className="text-right">Cost</TableHead>
                <TableHead className="text-right">Margin</TableHead>
                <TableHead>Valid Until</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(q => (
                <TableRow key={q.id} className="cursor-pointer" onClick={() => navigate(`/finance/quotes/${q.id}`)}>
                  <TableCell>
                    <span className="font-mono text-sm font-semibold">{q.quoteNumber}</span>
                  </TableCell>
                  <TableCell>{q.customer.name}</TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(q.status)}>{q.status}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="muted">{q.serviceLevel}</Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums font-medium">{formatMoney(q.totalRevenueCents)}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums text-muted-foreground">{formatMoney(q.totalCostCents)}</TableCell>
                  <TableCell className={cn('text-right font-mono tabular-nums', q.marginCents >= 0 ? 'text-success' : 'text-destructive')}>
                    {formatMoney(q.marginCents)} <span className="text-xs">({q.marginPercent}%)</span>
                  </TableCell>
                  <TableCell className="text-sm">
                    {new Date(q.validUntil) < new Date() && q.status !== 'accepted'
                      ? <span className="text-destructive">Expired</span>
                      : <span className="text-muted-foreground">{formatDate(q.validUntil)}</span>}
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
