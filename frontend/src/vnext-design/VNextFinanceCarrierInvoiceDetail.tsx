import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  CircleAlert,
  CreditCard,
  Loader2,
} from 'lucide-react';

import { API_URL } from '../api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

interface LineItem {
  id: string;
  chargeType: string;
  description: string;
  amountCents: number;
  expectedAmountCents: number | null;
  varianceCents: number | null;
  matchStatus: string;
  shipmentId?: string;
  freightClass?: string;
  billedWeight?: number;
  actualWeight?: number;
}

interface CarrierInvoiceData {
  id: string;
  invoiceNumber: string;
  status: string;
  carrier: { id: string; name: string; scacCode?: string };
  totalCents: number;
  approvedCents: number | null;
  paidCents: number;
  currency: string;
  matchStatus: string;
  varianceCents: number | null;
  variancePercent: number | null;
  autoApproved: boolean;
  receivedDate: string;
  dueDate: string;
  approvedBy?: string;
  approvedAt?: string;
  paidAt?: string;
  paymentReference?: string;
  notes?: string;
  lineItems: LineItem[];
}

function formatMoney(cents: number): string {
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function formatDate(d?: string): string {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' | 'info' | 'muted';

function statusVariant(s: string): BadgeVariant {
  const m: Record<string, BadgeVariant> = {
    received: 'info',
    matched: 'success',
    discrepancy: 'destructive',
    approved: 'success',
    scheduled: 'warning',
    paid: 'success',
    disputed: 'destructive',
  };
  return m[s] || 'secondary';
}
function matchVariant(s: string): BadgeVariant {
  const m: Record<string, BadgeVariant> = {
    matched: 'success',
    variance: 'warning',
    unmatched: 'destructive',
    pending: 'secondary',
    partial_match: 'warning',
    mismatch: 'destructive',
  };
  return m[s] || 'secondary';
}

export default function VNextFinanceCarrierInvoiceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [invoice, setInvoice] = useState<CarrierInvoiceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState('');

  const load = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/api/v1/carrier-invoices/${id}`);
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setInvoice(json.data);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [id]);

  const doAction = async (action: string, body?: any) => {
    setActionLoading(action);
    try {
      const res = await fetch(`${API_URL}/api/v1/carrier-invoices/${id}/${action}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : '{}',
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      await load();
    } catch (e: any) { alert(e.message); }
    finally { setActionLoading(''); }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-3 py-24 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin" />
        <h3 className="text-lg font-medium">Loading...</h3>
      </div>
    );
  }
  if (error || !invoice) {
    return (
      <div className="flex items-center gap-3 rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
        <CircleAlert className="h-5 w-5" />
        {error || 'Not found'}
      </div>
    );
  }

  const ci = invoice;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm">
        <Button variant="ghost" size="sm" onClick={() => navigate('/finance/carrier-invoices')}>
          <ArrowLeft className="h-4 w-4" /> Carrier Invoices
        </Button>
        <span className="text-muted-foreground">/ {ci.invoiceNumber}</span>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{ci.invoiceNumber}</h1>
          <div className="mt-2 flex items-center gap-2">
            <Badge variant={statusVariant(ci.status)}>{ci.status}</Badge>
            <Badge variant={matchVariant(ci.matchStatus)}>{ci.matchStatus.replace(/_/g, ' ')}</Badge>
            {ci.autoApproved && <Badge variant="info">auto-approved</Badge>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {['received', 'matched', 'discrepancy'].includes(ci.status) && (
            <Button size="sm" onClick={() => doAction('approve')} disabled={!!actionLoading}>
              {actionLoading === 'approve' ? 'Approving...' : 'Approve for Payment'}
            </Button>
          )}
          {['approved', 'scheduled'].includes(ci.status) && (
            <Button size="sm" onClick={() => doAction('pay', { amountCents: ci.approvedCents ?? ci.totalCents })} disabled={!!actionLoading}>
              <CreditCard className="h-4 w-4" />
              {actionLoading === 'pay' ? 'Recording...' : 'Record Payment'}
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <Card>
            <div className="p-5">
              <h2 className="text-lg font-semibold">Freight Audit - Line-by-Line Match</h2>
            </div>
            <Separator />
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Description</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Match</TableHead>
                  <TableHead className="text-right">Invoiced</TableHead>
                  <TableHead className="text-right">Expected</TableHead>
                  <TableHead className="text-right">Variance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ci.lineItems.map(li => (
                  <TableRow key={li.id}>
                    <TableCell>
                      {li.description}
                      {li.freightClass && <span className="ml-1 text-sm text-muted-foreground">(Class {li.freightClass})</span>}
                      {li.billedWeight && <span className="ml-1 text-sm text-muted-foreground">- {li.billedWeight} lbs</span>}
                    </TableCell>
                    <TableCell>
                      <Badge variant="muted">{li.chargeType.replace(/_/g, ' ')}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={matchVariant(li.matchStatus)}>{li.matchStatus}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums font-medium">{formatMoney(li.amountCents)}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums">{li.expectedAmountCents != null ? formatMoney(li.expectedAmountCents) : '-'}</TableCell>
                    <TableCell
                      className={cn(
                        'text-right font-mono tabular-nums',
                        li.varianceCents && li.varianceCents > 0 && 'text-destructive font-medium',
                        li.varianceCents && li.varianceCents < 0 && 'text-success font-medium',
                      )}
                    >
                      {li.varianceCents != null ? `${li.varianceCents > 0 ? '+' : ''}${formatMoney(li.varianceCents)}` : '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="border-t p-5">
              <div className="flex justify-between text-sm font-bold">
                <span>Total</span>
                <div className="flex items-center gap-6">
                  <span className="font-mono tabular-nums">{formatMoney(ci.totalCents)}</span>
                  <span className={cn('font-mono tabular-nums', ci.varianceCents && ci.varianceCents > 0 ? 'text-destructive' : 'text-muted-foreground')}>
                    {ci.varianceCents != null ? `${ci.varianceCents > 0 ? '+' : ''}${formatMoney(ci.varianceCents)} (${ci.variancePercent}%)` : '-'}
                  </span>
                </div>
              </div>
            </div>
          </Card>
        </div>

        <aside className="space-y-6 lg:sticky lg:top-20 lg:self-start">
          <Card>
            <CardContent className="p-5">
              <h3 className="mb-4 text-base font-semibold">Invoice Details</h3>
              <dl className="space-y-3 text-sm">
                <div>
                  <dt className="text-xs text-muted-foreground">Carrier</dt>
                  <dd>{ci.carrier.name}{ci.carrier.scacCode && ` (${ci.carrier.scacCode})`}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Invoice Total</dt>
                  <dd className="font-semibold font-mono tabular-nums">{formatMoney(ci.totalCents)}</dd>
                </div>
                {ci.approvedCents != null && (
                  <div>
                    <dt className="text-xs text-muted-foreground">Approved</dt>
                    <dd className="text-success font-mono tabular-nums">{formatMoney(ci.approvedCents)}</dd>
                  </div>
                )}
                <div>
                  <dt className="text-xs text-muted-foreground">Received</dt>
                  <dd>{formatDate(ci.receivedDate)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Due Date</dt>
                  <dd>{formatDate(ci.dueDate)}</dd>
                </div>
                {ci.approvedAt && (
                  <div>
                    <dt className="text-xs text-muted-foreground">Approved At</dt>
                    <dd>{formatDate(ci.approvedAt)}</dd>
                  </div>
                )}
                {ci.paidAt && (
                  <div>
                    <dt className="text-xs text-muted-foreground">Paid</dt>
                    <dd>{formatDate(ci.paidAt)}</dd>
                  </div>
                )}
                {ci.paymentReference && (
                  <div>
                    <dt className="text-xs text-muted-foreground">Payment Ref</dt>
                    <dd>{ci.paymentReference}</dd>
                  </div>
                )}
                {ci.notes && (
                  <div>
                    <dt className="text-xs text-muted-foreground">Notes</dt>
                    <dd>{ci.notes}</dd>
                  </div>
                )}
              </dl>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
