import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  CheckCircle2,
  CircleAlert,
  FileEdit,
  HandCoins,
  Inbox,
  Loader2,
  Plus,
  Receipt,
  Send,
  Truck,
  Wallet,
} from 'lucide-react';

import { API_URL } from '../api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface FinancialSummary {
  invoices: { total: number; draft: number; sent: number; overdue: number; totalCents: number; paidCents: number; balanceCents: number };
  carrierInvoices: { total: number; received: number; discrepancy: number; approved: number; totalCents: number };
  quotes: { total: number; draft: number; sent: number; accepted: number };
  queries: { total: number; raised: number; investigating: number };
}

function formatMoney(cents: number): string {
  const abs = Math.abs(cents);
  if (abs >= 100000000) return `$${(cents / 100000000).toFixed(1)}M`;
  if (abs >= 100000) return `$${(cents / 100000).toFixed(0)}K`;
  return `$${(cents / 100).toFixed(2)}`;
}

const TONES = {
  primary: 'bg-primary/10 text-primary',
  success: 'bg-success/15 text-success',
  warning: 'bg-warning/15 text-warning',
  destructive: 'bg-destructive/10 text-destructive',
  info: 'bg-info/15 text-info',
} as const;

type Tone = keyof typeof TONES;

function StatCard({
  icon: Icon,
  tone,
  value,
  label,
}: {
  icon: React.ComponentType<{ className?: string }>;
  tone: Tone;
  value: string | number;
  label: string;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg', TONES[tone])}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="mt-3 text-2xl font-bold tracking-tight">{value}</div>
        <div className="mt-1 text-sm text-muted-foreground">{label}</div>
      </CardContent>
    </Card>
  );
}

export default function VNextFinanceDashboard() {
  const [summary, setSummary] = useState<FinancialSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [invRes, ciRes, qteRes, qryRes] = await Promise.all([
          fetch(`${API_URL}/api/v1/invoices`),
          fetch(`${API_URL}/api/v1/carrier-invoices`),
          fetch(`${API_URL}/api/v1/quotes`),
          fetch(`${API_URL}/api/v1/financial-queries`),
        ]);

        const invoices = (await invRes.json()).data || [];
        const carrierInvoices = (await ciRes.json()).data || [];
        const quotes = (await qteRes.json()).data || [];
        const queries = (await qryRes.json()).data || [];

        if (!cancelled) {
          setSummary({
            invoices: {
              total: invoices.length,
              draft: invoices.filter((i: any) => i.status === 'draft').length,
              sent: invoices.filter((i: any) => i.status === 'sent').length,
              overdue: invoices.filter((i: any) => i.status === 'overdue' || (i.status === 'sent' && new Date(i.dueDate) < new Date())).length,
              totalCents: invoices.reduce((s: number, i: any) => s + (i.totalCents || 0), 0),
              paidCents: invoices.reduce((s: number, i: any) => s + (i.paidCents || 0), 0),
              balanceCents: invoices.reduce((s: number, i: any) => s + (i.balanceCents || 0), 0),
            },
            carrierInvoices: {
              total: carrierInvoices.length,
              received: carrierInvoices.filter((i: any) => i.status === 'received').length,
              discrepancy: carrierInvoices.filter((i: any) => i.status === 'discrepancy').length,
              approved: carrierInvoices.filter((i: any) => i.status === 'approved').length,
              totalCents: carrierInvoices.reduce((s: number, i: any) => s + (i.totalCents || 0), 0),
            },
            quotes: {
              total: quotes.length,
              draft: quotes.filter((q: any) => q.status === 'draft').length,
              sent: quotes.filter((q: any) => q.status === 'sent').length,
              accepted: quotes.filter((q: any) => q.status === 'accepted').length,
            },
            queries: {
              total: queries.length,
              raised: queries.filter((q: any) => q.status === 'raised').length,
              investigating: queries.filter((q: any) => q.status === 'investigating').length,
            },
          });
        }
      } catch (e: any) {
        if (!cancelled) setError(e.message || 'Failed to load data');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

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

  const s = summary!;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Finance Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">Accounts receivable, payable, quotes, and disputes</p>
        </div>
        <div className="flex gap-2">
          <Button variant="gradient" asChild>
            <Link to="/finance/quotes">
              <Plus className="h-4 w-4" />
              New Quote
            </Link>
          </Button>
        </div>
      </div>

      <div>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Accounts Receivable
        </h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard icon={Receipt} tone="primary" value={formatMoney(s.invoices.balanceCents)} label="Outstanding Balance" />
          <StatCard icon={FileEdit} tone="warning" value={s.invoices.draft} label="Draft Invoices" />
          <StatCard icon={Send} tone="info" value={s.invoices.sent} label="Sent / Awaiting Payment" />
          <StatCard icon={AlertTriangle} tone="destructive" value={s.invoices.overdue} label="Overdue" />
        </div>
      </div>

      <div>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Accounts Payable
        </h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard icon={Truck} tone="primary" value={formatMoney(s.carrierInvoices.totalCents)} label="Total Carrier Invoices" />
          <StatCard icon={Inbox} tone="warning" value={s.carrierInvoices.received} label="Pending Review" />
          <StatCard icon={CircleAlert} tone="destructive" value={s.carrierInvoices.discrepancy} label="Discrepancies" />
          <StatCard icon={CheckCircle2} tone="success" value={s.carrierInvoices.approved} label="Approved for Payment" />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-1 lg:grid-cols-2">
        <Card>
          <CardContent className="p-5">
            <h3 className="text-base font-semibold">Quotes</h3>
            <div className="mt-4 flex gap-6">
              <div>
                <div className="text-2xl font-bold tracking-tight">{s.quotes.total}</div>
                <div className="text-xs text-muted-foreground">Total</div>
              </div>
              <div>
                <div className="text-2xl font-bold tracking-tight">{s.quotes.draft}</div>
                <div className="text-xs text-muted-foreground">Draft</div>
              </div>
              <div>
                <div className="text-2xl font-bold tracking-tight">{s.quotes.accepted}</div>
                <div className="text-xs text-muted-foreground">Accepted</div>
              </div>
            </div>
            <Button variant="outline" className="mt-4 w-full" asChild>
              <Link to="/finance/quotes">View Quotes</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <h3 className="text-base font-semibold">Queries &amp; Disputes</h3>
            <div className="mt-4 flex gap-6">
              <div>
                <div className="text-2xl font-bold tracking-tight">{s.queries.raised}</div>
                <div className="text-xs text-muted-foreground">Open</div>
              </div>
              <div>
                <div className="text-2xl font-bold tracking-tight">{s.queries.investigating}</div>
                <div className="text-xs text-muted-foreground">Investigating</div>
              </div>
            </div>
            <Button variant="outline" className="mt-4 w-full" asChild>
              <Link to="/finance/queries">
                <HandCoins className="h-4 w-4" />
                View Queries
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="hidden">
          <CardContent className="p-5">
            <Wallet className="h-5 w-5" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
