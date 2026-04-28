import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  CircleAlert,
  FileEdit,
  Loader2,
  Plus,
  Receipt,
  Search,
  Wallet,
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

interface Invoice {
  id: string;
  invoiceNumber: string;
  customerId: string;
  customer: { name: string };
  status: string;
  totalCents: number;
  paidCents: number;
  balanceCents: number;
  currency: string;
  issueDate: string;
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
    case 'draft': return 'secondary';
    case 'approved': return 'info';
    case 'sent': return 'default';
    case 'partial_paid': return 'warning';
    case 'paid': return 'success';
    case 'overdue': return 'destructive';
    case 'void': return 'secondary';
    case 'disputed': return 'destructive';
    default: return 'secondary';
  }
}

const TONES = {
  primary: 'bg-primary/10 text-primary',
  warning: 'bg-warning/15 text-warning',
  destructive: 'bg-destructive/10 text-destructive',
  info: 'bg-info/15 text-info',
} as const;

export default function VNextFinanceInvoices() {
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    fetch(`${API_URL}/api/v1/invoices`)
      .then(r => r.json())
      .then(j => setInvoices(j.data || []))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const stats = {
    total: invoices.length,
    outstanding: invoices.filter(i => ['sent', 'partial_paid', 'overdue'].includes(i.status)).reduce((s, i) => s + i.balanceCents, 0),
    overdue: invoices.filter(i => i.status === 'sent' && new Date(i.dueDate) < new Date()).length,
    draft: invoices.filter(i => i.status === 'draft').length,
  };

  const filtered = invoices.filter(i => {
    if (statusFilter !== 'all' && i.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return i.invoiceNumber.toLowerCase().includes(q) || i.customer.name.toLowerCase().includes(q);
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
          <h1 className="text-3xl font-bold tracking-tight">Invoices</h1>
          <p className="mt-1 text-sm text-muted-foreground">{invoices.length} invoices</p>
        </div>
        <div className="flex gap-2">
          <Button variant="gradient" asChild>
            <Link to="/finance/invoices/create">
              <Plus className="h-4 w-4" />
              New Invoice
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-5">
            <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg', TONES.primary)}>
              <Receipt className="h-5 w-5" />
            </div>
            <div className="mt-3 text-2xl font-bold tracking-tight">{stats.total}</div>
            <div className="mt-1 text-sm text-muted-foreground">Total</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg', TONES.warning)}>
              <Wallet className="h-5 w-5" />
            </div>
            <div className="mt-3 text-2xl font-bold tracking-tight font-mono tabular-nums">{formatMoney(stats.outstanding)}</div>
            <div className="mt-1 text-sm text-muted-foreground">Outstanding</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg', TONES.destructive)}>
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div className="mt-3 text-2xl font-bold tracking-tight">{stats.overdue}</div>
            <div className="mt-1 text-sm text-muted-foreground">Overdue</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg', TONES.info)}>
              <FileEdit className="h-5 w-5" />
            </div>
            <div className="mt-3 text-2xl font-bold tracking-tight">{stats.draft}</div>
            <div className="mt-1 text-sm text-muted-foreground">Drafts</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <div className="flex flex-wrap items-center gap-3 p-4">
          <div className="relative min-w-[280px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search invoices..."
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
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="sent">Sent</SelectItem>
              <SelectItem value="partial_paid">Partial Paid</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="overdue">Overdue</SelectItem>
              <SelectItem value="void">Void</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-12 text-muted-foreground">
            <Receipt className="h-8 w-8" />
            <h3 className="text-base font-medium">No invoices found</h3>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice #</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Balance</TableHead>
                <TableHead>Issue Date</TableHead>
                <TableHead>Due Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(inv => (
                <TableRow key={inv.id} className="cursor-pointer" onClick={() => navigate(`/finance/invoices/${inv.id}`)}>
                  <TableCell>
                    <span className="font-mono text-sm font-semibold">{inv.invoiceNumber}</span>
                  </TableCell>
                  <TableCell>{inv.customer.name}</TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(inv.status)}>{inv.status.replace(/_/g, ' ')}</Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums font-medium">{formatMoney(inv.totalCents)}</TableCell>
                  <TableCell className={cn('text-right font-mono tabular-nums font-medium', inv.balanceCents > 0 ? 'text-destructive' : 'text-success')}>
                    {formatMoney(inv.balanceCents)}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{formatDate(inv.issueDate)}</TableCell>
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
