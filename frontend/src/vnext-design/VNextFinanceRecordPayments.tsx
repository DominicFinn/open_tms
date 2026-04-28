import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle2,
  CircleAlert,
  CreditCard,
  Loader2,
  Search,
  XCircle,
} from 'lucide-react';

import { API_URL } from '../api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
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

interface OutstandingInvoice {
  id: string;
  invoiceNumber: string;
  customer: { name: string };
  status: string;
  totalCents: number;
  paidCents: number;
  balanceCents: number;
  dueDate: string;
}

function formatMoney(cents: number): string {
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function formatDate(d: string): string {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function VNextFinanceRecordPayments() {
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState<OutstandingInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const [payments, setPayments] = useState<Record<string, { amount: string; method: string; ref: string }>>({});
  const [processing, setProcessing] = useState(false);
  const [results, setResults] = useState<Array<{ invoiceNumber: string; success: boolean; message: string }>>([]);

  useEffect(() => {
    fetch(`${API_URL}/api/v1/invoices?status=sent`)
      .then(r => r.json())
      .then(j => {
        return Promise.all([
          j,
          fetch(`${API_URL}/api/v1/invoices?status=partial_paid`).then(r => r.json()),
          fetch(`${API_URL}/api/v1/invoices?status=overdue`).then(r => r.json()),
        ]);
      })
      .then(([sent, partial, overdue]) => {
        const all = [...(sent.data || []), ...(partial.data || []), ...(overdue.data || [])];
        const unique = [...new Map(all.map((i: any) => [i.id, i])).values()].filter((i: any) => i.balanceCents > 0);
        setInvoices(unique as OutstandingInvoice[]);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const filtered = invoices.filter(i => {
    if (!search) return true;
    const q = search.toLowerCase();
    return i.invoiceNumber.toLowerCase().includes(q) || i.customer.name.toLowerCase().includes(q);
  });

  const setPaymentField = (invoiceId: string, field: string, value: string) => {
    setPayments(prev => ({
      ...prev,
      [invoiceId]: { ...(prev[invoiceId] || { amount: '', method: 'ach', ref: '' }), [field]: value },
    }));
  };

  const payFullBalance = (inv: OutstandingInvoice) => {
    setPaymentField(inv.id, 'amount', (inv.balanceCents / 100).toFixed(2));
  };

  const entriesWithAmount = Object.entries(payments).filter(([_, p]) => p.amount && parseFloat(p.amount) > 0);
  const totalToApply = entriesWithAmount.reduce((s, [_, p]) => s + Math.round(parseFloat(p.amount) * 100), 0);

  const processPayments = async () => {
    if (entriesWithAmount.length === 0) return;
    setProcessing(true);
    setResults([]);
    const newResults: Array<{ invoiceNumber: string; success: boolean; message: string }> = [];

    for (const [invoiceId, payment] of entriesWithAmount) {
      const inv = invoices.find(i => i.id === invoiceId);
      if (!inv) continue;

      const amountCents = Math.round(parseFloat(payment.amount) * 100);
      try {
        const res = await fetch(`${API_URL}/api/v1/invoices/${invoiceId}/payments`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amountCents,
            paymentMethod: payment.method || 'ach',
            referenceNumber: payment.ref || undefined,
          }),
        });
        const json = await res.json();
        if (json.error) {
          newResults.push({ invoiceNumber: inv.invoiceNumber, success: false, message: json.error });
        } else {
          newResults.push({ invoiceNumber: inv.invoiceNumber, success: true, message: `${formatMoney(amountCents)} applied - ${json.data?.invoiceStatus}` });
        }
      } catch (e: any) {
        newResults.push({ invoiceNumber: inv.invoiceNumber, success: false, message: e.message });
      }
    }

    setResults(newResults);
    setPayments({});
    setProcessing(false);

    setLoading(true);
    fetch(`${API_URL}/api/v1/invoices?status=sent`)
      .then(r => r.json())
      .then(j => {
        return Promise.all([
          j,
          fetch(`${API_URL}/api/v1/invoices?status=partial_paid`).then(r => r.json()),
          fetch(`${API_URL}/api/v1/invoices?status=overdue`).then(r => r.json()),
        ]);
      })
      .then(([sent, partial, overdue]) => {
        const all = [...(sent.data || []), ...(partial.data || []), ...(overdue.data || [])];
        const unique = [...new Map(all.map((i: any) => [i.id, i])).values()].filter((i: any) => i.balanceCents > 0);
        setInvoices(unique as OutstandingInvoice[]);
      })
      .finally(() => setLoading(false));
  };

  if (loading && invoices.length === 0) {
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
      <div className="flex items-center gap-2 text-sm">
        <Button variant="ghost" size="sm" onClick={() => navigate('/finance/invoices')}>
          <ArrowLeft className="h-4 w-4" /> Invoices
        </Button>
        <span className="text-muted-foreground">/ Record Payments</span>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Record Payments</h1>
          <p className="mt-1 text-sm text-muted-foreground">Enter payment amounts against outstanding invoices. Process a bank statement in one go.</p>
        </div>
      </div>

      {results.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <h3 className="mb-2 text-base font-semibold">Payment Results</h3>
            <div className="space-y-1">
              {results.map((r, i) => (
                <div key={i} className="flex items-center gap-2 py-1 text-sm">
                  {r.success
                    ? <CheckCircle2 className="h-4 w-4 text-success" />
                    : <XCircle className="h-4 w-4 text-destructive" />}
                  <strong>{r.invoiceNumber}</strong>
                  <span className="text-muted-foreground">{r.message}</span>
                </div>
              ))}
            </div>
            <Button variant="ghost" size="sm" onClick={() => setResults([])} className="mt-2">Dismiss</Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <div className="flex flex-wrap items-center gap-3 p-4">
          <div className="relative min-w-[280px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search by invoice # or customer..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          {entriesWithAmount.length > 0 && (
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium">{entriesWithAmount.length} payment{entriesWithAmount.length > 1 ? 's' : ''} - {formatMoney(totalToApply)}</span>
              <Button onClick={processPayments} disabled={processing}>
                <CreditCard className="h-4 w-4" />
                {processing ? 'Processing...' : 'Apply All Payments'}
              </Button>
            </div>
          )}
        </div>

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-12 text-muted-foreground">
            <CheckCircle2 className="h-8 w-8" />
            <h3 className="text-base font-medium">No outstanding invoices</h3>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice #</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead className="text-right">Balance</TableHead>
                <TableHead className="w-[140px]">Amount ($)</TableHead>
                <TableHead className="w-[110px]">Method</TableHead>
                <TableHead className="w-[140px]">Reference</TableHead>
                <TableHead className="w-[60px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(inv => {
                const p = payments[inv.id] || { amount: '', method: 'ach', ref: '' };
                const isPastDue = new Date(inv.dueDate) < new Date();
                return (
                  <TableRow key={inv.id}>
                    <TableCell>
                      <span
                        className="font-mono text-sm font-semibold cursor-pointer hover:underline"
                        onClick={() => navigate(`/finance/invoices/${inv.id}`)}
                      >
                        {inv.invoiceNumber}
                      </span>
                    </TableCell>
                    <TableCell>{inv.customer.name}</TableCell>
                    <TableCell className={cn(isPastDue && 'text-destructive')}>
                      {formatDate(inv.dueDate)}{isPastDue && ' (overdue)'}
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums font-semibold">{formatMoney(inv.balanceCents)}</TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        max={inv.balanceCents / 100}
                        value={p.amount}
                        onChange={e => setPaymentField(inv.id, 'amount', e.target.value)}
                        placeholder="0.00"
                        className="text-right font-mono tabular-nums"
                      />
                    </TableCell>
                    <TableCell>
                      <Select value={p.method} onValueChange={v => setPaymentField(inv.id, 'method', v)}>
                        <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ach">ACH</SelectItem>
                          <SelectItem value="wire">Wire</SelectItem>
                          <SelectItem value="check">Check</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Input
                        value={p.ref}
                        onChange={e => setPaymentField(inv.id, 'ref', e.target.value)}
                        placeholder="Ref #"
                        className="text-xs"
                      />
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Pay full balance"
                        onClick={() => payFullBalance(inv)}
                      >
                        <CheckCircle2 className="h-4 w-4" />
                      </Button>
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
