import React, { useState, useEffect } from 'react';
import {
  CircleAlert,
  DollarSign,
  Loader2,
  MinusCircle,
  PlusCircle,
  StickyNote,
} from 'lucide-react';

import { API_URL } from '../api';
import { Card, CardContent } from '@/components/ui/card';
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

interface CreditNote {
  id: string;
  creditNoteNumber: string;
  noteType: string;
  invoiceId: string | null;
  customerId: string | null;
  carrierId: string | null;
  amountCents: number;
  currency: string;
  reason: string;
  description: string;
  queryId: string | null;
  status: string;
  createdAt: string;
}

function formatMoney(cents: number): string {
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' | 'info' | 'muted';

function statusVariant(status: string): BadgeVariant {
  switch (status) {
    case 'draft': return 'secondary';
    case 'approved': return 'info';
    case 'applied': return 'success';
    default: return 'secondary';
  }
}

const TONES = {
  primary: 'bg-primary/10 text-primary',
  success: 'bg-success/15 text-success',
  warning: 'bg-warning/15 text-warning',
  info: 'bg-info/15 text-info',
} as const;

export default function VNextFinanceCreditNotes() {
  const [notes, setNotes] = useState<CreditNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`${API_URL}/api/v1/credit-notes`)
      .then(r => r.json())
      .then(j => setNotes(j.data || []))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const stats = {
    total: notes.length,
    credits: notes.filter(n => n.noteType === 'credit').length,
    debits: notes.filter(n => n.noteType === 'debit').length,
    totalAmount: notes.reduce((s, n) => s + n.amountCents, 0),
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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Credit &amp; Debit Notes</h1>
          <p className="mt-1 text-sm text-muted-foreground">{notes.length} notes</p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-5">
            <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg', TONES.primary)}>
              <StickyNote className="h-5 w-5" />
            </div>
            <div className="mt-3 text-2xl font-bold tracking-tight">{stats.total}</div>
            <div className="mt-1 text-sm text-muted-foreground">Total</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg', TONES.success)}>
              <MinusCircle className="h-5 w-5" />
            </div>
            <div className="mt-3 text-2xl font-bold tracking-tight">{stats.credits}</div>
            <div className="mt-1 text-sm text-muted-foreground">Credits</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg', TONES.warning)}>
              <PlusCircle className="h-5 w-5" />
            </div>
            <div className="mt-3 text-2xl font-bold tracking-tight">{stats.debits}</div>
            <div className="mt-1 text-sm text-muted-foreground">Debits</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg', TONES.info)}>
              <DollarSign className="h-5 w-5" />
            </div>
            <div className="mt-3 text-2xl font-bold tracking-tight font-mono tabular-nums">{formatMoney(stats.totalAmount)}</div>
            <div className="mt-1 text-sm text-muted-foreground">Total Value</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        {notes.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
            <StickyNote className="h-8 w-8" />
            <h3 className="text-base font-medium">No credit or debit notes yet</h3>
            <p className="text-sm">Notes are generated when financial queries are resolved with adjustments</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Note #</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {notes.map(n => (
                <TableRow key={n.id}>
                  <TableCell>
                    <span className="font-mono text-sm font-semibold">{n.creditNoteNumber}</span>
                  </TableCell>
                  <TableCell>
                    <Badge variant={n.noteType === 'credit' ? 'success' : 'warning'}>{n.noteType}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(n.status)}>{n.status}</Badge>
                  </TableCell>
                  <TableCell>{n.reason}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums font-medium">{formatMoney(n.amountCents)}</TableCell>
                  <TableCell className="max-w-[300px] truncate text-sm text-muted-foreground">{n.description}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(n.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
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
