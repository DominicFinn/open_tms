import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle2,
  CircleAlert,
  Info,
  Loader2,
} from 'lucide-react';

import { API_URL } from '../api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

interface QueryData {
  id: string;
  queryNumber: string;
  queryType: string;
  reason: string;
  description: string;
  status: string;
  disputedAmountCents: number | null;
  adjustmentCents: number | null;
  shipmentId?: string;
  invoiceId?: string;
  carrierInvoiceId?: string;
  cargoDiscrepancyId?: string;
  coldChainExcursionId?: string;
  creditNoteId?: string;
  assigneeId?: string;
  createdBy?: string;
  createdAt: string;
  resolvedBy?: string;
  resolvedAt?: string;
  resolutionNotes?: string;
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
    raised: 'warning',
    investigating: 'info',
    resolved_adjusted: 'success',
    resolved_upheld: 'secondary',
    closed: 'secondary',
  };
  return m[s] || 'secondary';
}
function reasonLabel(r: string): string {
  const m: Record<string, string> = {
    overcharge: 'Overcharge',
    service_failure: 'Service Failure',
    missing_pod: 'Missing POD',
    wrong_rate: 'Wrong Rate',
    damage_claim: 'Damage Claim',
    missing_items: 'Missing Items',
    temperature_excursion: 'Temperature Excursion',
  };
  return m[r] || r;
}

export default function VNextFinanceQueryDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [query, setQuery] = useState<QueryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showResolve, setShowResolve] = useState(false);
  const [resolution, setResolution] = useState<'adjusted' | 'upheld'>('adjusted');
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [adjustmentAmount, setAdjustmentAmount] = useState('');
  const [createCreditNote, setCreateCreditNote] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/api/v1/financial-queries/${id}`);
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setQuery(json.data);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [id]);

  const resolve = async () => {
    if (!resolutionNotes.trim()) { alert('Resolution notes are required'); return; }
    setActionLoading(true);
    try {
      const adjustmentCents = resolution === 'adjusted' && adjustmentAmount
        ? Math.round(parseFloat(adjustmentAmount) * 100) : undefined;
      const res = await fetch(`${API_URL}/api/v1/financial-queries/${id}/resolve`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resolution, resolutionNotes, adjustmentCents, createCreditNote: resolution === 'adjusted' ? createCreditNote : undefined }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setShowResolve(false);
      await load();
    } catch (e: any) { alert(e.message); }
    finally { setActionLoading(false); }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-3 py-24 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin" />
        <h3 className="text-lg font-medium">Loading...</h3>
      </div>
    );
  }
  if (error || !query) {
    return (
      <div className="flex items-center gap-3 rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
        <CircleAlert className="h-5 w-5" />
        {error || 'Not found'}
      </div>
    );
  }

  const q = query;
  const isOpen = ['raised', 'investigating'].includes(q.status);
  const resolveTone = q.status === 'resolved_adjusted'
    ? 'border-success/30 bg-success/10 text-success'
    : 'border-info/30 bg-info/10 text-info';

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm">
        <Button variant="ghost" size="sm" onClick={() => navigate('/finance/queries')}>
          <ArrowLeft className="h-4 w-4" /> Queries
        </Button>
        <span className="text-muted-foreground">/ {q.queryNumber}</span>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{q.queryNumber}</h1>
          <div className="mt-2 flex items-center gap-2">
            <Badge variant={q.queryType === 'customer_dispute' ? 'default' : 'warning'}>
              {q.queryType === 'customer_dispute' ? 'Customer Dispute' : 'Carrier Dispute'}
            </Badge>
            <Badge variant={statusVariant(q.status)}>{q.status.replace(/_/g, ' ')}</Badge>
          </div>
        </div>
        <div className="flex gap-2">
          {isOpen && (
            <Button size="sm" onClick={() => setShowResolve(!showResolve)}>
              <CheckCircle2 className="h-4 w-4" /> Resolve
            </Button>
          )}
        </div>
      </div>

      {showResolve && (
        <Card>
          <CardContent className="p-5">
            <h3 className="mb-4 text-base font-semibold">Resolve Query</h3>
            <div className="flex flex-col gap-4">
              <div className="space-y-1.5">
                <Label>Resolution</Label>
                <Select value={resolution} onValueChange={v => setResolution(v as 'adjusted' | 'upheld')}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="adjusted">Adjusted (issue credit/adjustment)</SelectItem>
                    <SelectItem value="upheld">Upheld (original charge is correct)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {resolution === 'adjusted' && (
                <>
                  <div className="space-y-1.5">
                    <Label htmlFor="adjustment">Adjustment Amount ($)</Label>
                    <Input
                      id="adjustment"
                      type="number"
                      step="0.01"
                      value={adjustmentAmount}
                      onChange={e => setAdjustmentAmount(e.target.value)}
                      placeholder={q.disputedAmountCents ? (q.disputedAmountCents / 100).toFixed(2) : '0.00'}
                    />
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border border-input bg-background accent-primary"
                      checked={createCreditNote}
                      onChange={e => setCreateCreditNote(e.target.checked)}
                    />
                    Generate credit note automatically
                  </label>
                </>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="resolution-notes">Resolution Notes</Label>
                <textarea
                  id="resolution-notes"
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  rows={3}
                  value={resolutionNotes}
                  onChange={e => setResolutionNotes(e.target.value)}
                  placeholder="Describe the resolution..."
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={resolve} disabled={actionLoading}>
                  {actionLoading ? 'Resolving...' : 'Resolve Query'}
                </Button>
                <Button variant="ghost" onClick={() => setShowResolve(false)}>Cancel</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <Card>
            <CardContent className="p-5">
              <h3 className="mb-3 text-base font-semibold">Description</h3>
              <p className="text-sm leading-relaxed">{q.description}</p>
            </CardContent>
          </Card>

          {q.resolvedAt && (
            <div className={cn('flex items-start gap-3 rounded-md border p-4 text-sm', resolveTone)}>
              {q.status === 'resolved_adjusted' ? <CheckCircle2 className="h-5 w-5 shrink-0" /> : <Info className="h-5 w-5 shrink-0" />}
              <div>
                <strong>Resolved - {q.status === 'resolved_adjusted' ? 'Adjusted' : 'Upheld'}</strong>
                {q.adjustmentCents != null && <span> - Adjustment: {formatMoney(q.adjustmentCents)}</span>}
                {q.resolutionNotes && <p className="mt-2">{q.resolutionNotes}</p>}
              </div>
            </div>
          )}

          {q.creditNoteId && (
            <Card>
              <CardContent className="p-5">
                <h3 className="mb-2 text-base font-semibold">Credit Note</h3>
                <Link to={`/finance/credit-notes/${q.creditNoteId}`} className="text-primary hover:underline">
                  View Credit Note
                </Link>
              </CardContent>
            </Card>
          )}
        </div>

        <aside className="space-y-6 lg:sticky lg:top-20 lg:self-start">
          <Card>
            <CardContent className="p-5">
              <h3 className="mb-4 text-base font-semibold">Query Details</h3>
              <dl className="space-y-3 text-sm">
                <div>
                  <dt className="text-xs text-muted-foreground">Reason</dt>
                  <dd>{reasonLabel(q.reason)}</dd>
                </div>
                {q.disputedAmountCents != null && (
                  <div>
                    <dt className="text-xs text-muted-foreground">Disputed Amount</dt>
                    <dd className="font-semibold font-mono tabular-nums">{formatMoney(q.disputedAmountCents)}</dd>
                  </div>
                )}
                <div>
                  <dt className="text-xs text-muted-foreground">Created</dt>
                  <dd>{formatDate(q.createdAt)}</dd>
                </div>
                {q.resolvedAt && (
                  <div>
                    <dt className="text-xs text-muted-foreground">Resolved</dt>
                    <dd>{formatDate(q.resolvedAt)}</dd>
                  </div>
                )}
                {q.shipmentId && (
                  <div>
                    <dt className="text-xs text-muted-foreground">Shipment</dt>
                    <dd>
                      <Link to={`/shipments/${q.shipmentId}`} className="text-primary hover:underline">View</Link>
                    </dd>
                  </div>
                )}
                {q.invoiceId && (
                  <div>
                    <dt className="text-xs text-muted-foreground">Invoice</dt>
                    <dd>
                      <Link to={`/finance/invoices/${q.invoiceId}`} className="text-primary hover:underline">View</Link>
                    </dd>
                  </div>
                )}
                {q.carrierInvoiceId && (
                  <div>
                    <dt className="text-xs text-muted-foreground">Carrier Invoice</dt>
                    <dd>
                      <Link to={`/finance/carrier-invoices/${q.carrierInvoiceId}`} className="text-primary hover:underline">View</Link>
                    </dd>
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
