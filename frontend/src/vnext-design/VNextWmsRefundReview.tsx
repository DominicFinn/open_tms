import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Banknote, CheckCircle2, CircleAlert, Loader2, Receipt } from 'lucide-react';

import { API_URL } from '../api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface RmaLine {
  id: string;
  sku: string;
  disposition: string;
  receivedQuantity: number;
  refundAmountCents: number;
}

interface RmaInQueue {
  id: string;
  rmaNumber: string;
  customerId: string;
  orderId: string;
  returnReason: string;
  suggestedRefundCents: number;
  requestedAt: string;
  lines: RmaLine[];
}

type BadgeVariant = 'success' | 'info' | 'warning' | 'destructive' | 'muted' | 'secondary' | 'default';

function formatStr(s: string): string {
  return s.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function dispositionVariant(d: string): BadgeVariant {
  switch (d) {
    case 'restock': return 'success';
    case 'refurb': return 'info';
    case 'scrap': case 'recycle': return 'destructive';
    case 'donate': return 'default';
    case 'rtv': return 'warning';
    case 'customer_keeps': return 'secondary';
    default: return 'secondary';
  }
}

export default function VNextWmsRefundReview() {
  const navigate = useNavigate();
  const [rmas, setRmas] = useState<RmaInQueue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = () => {
    setLoading(true);
    fetch(`${API_URL}/api/v1/rmas/refund-review/queue`)
      .then(r => r.json())
      .then(res => setRmas(res.data || []))
      .catch(() => setError('Failed to load queue'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const totalPendingRefund = rmas.reduce((sum, r) => sum + r.suggestedRefundCents, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Refund Review Queue</h1>
          <p className="mt-1 text-sm text-muted-foreground">RMAs awaiting finance approval before refund is issued</p>
        </div>
        <Button variant="outline" onClick={() => navigate('/wms/returns')}>
          <ArrowLeft className="h-4 w-4" />
          Back to Returns
        </Button>
      </div>

      {error && (
        <div className="flex items-center gap-3 rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          <CircleAlert className="h-5 w-5" />
          {error}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <Card>
          <CardContent className="p-5">
            <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg', 'bg-primary/10 text-primary')}>
              <Receipt className="h-5 w-5" />
            </div>
            <div className="mt-3 text-2xl font-bold tracking-tight">{rmas.length}</div>
            <div className="mt-1 text-sm text-muted-foreground">Pending Refunds</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg', 'bg-warning/15 text-warning')}>
              <Banknote className="h-5 w-5" />
            </div>
            <div className="mt-3 text-2xl font-bold tracking-tight">${(totalPendingRefund / 100).toFixed(2)}</div>
            <div className="mt-1 text-sm text-muted-foreground">Total Refund Value</div>
          </CardContent>
        </Card>
      </div>

      {loading ? (
        <div className="flex flex-col items-center gap-3 py-24 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : rmas.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <CheckCircle2 className="h-12 w-12 text-success" />
            <h3 className="text-base font-medium">Queue is empty</h3>
            <p className="text-sm text-muted-foreground">No RMAs currently awaiting refund review.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {rmas.map(r => (
            <Card key={r.id}>
              <CardContent className="space-y-4 p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-semibold">{r.rmaNumber}</h3>
                      <Badge variant="warning">Dispositioning</Badge>
                      <Badge variant="secondary">{formatStr(r.returnReason)}</Badge>
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      Requested {new Date(r.requestedAt).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-muted-foreground">Suggested refund</div>
                    <div className="text-2xl font-bold text-primary">${(r.suggestedRefundCents / 100).toFixed(2)}</div>
                  </div>
                </div>

                <div>
                  <div className="mb-2 text-sm font-semibold">Line Dispositions</div>
                  <div className="flex flex-wrap gap-2">
                    {r.lines.map(l => (
                      <Badge key={l.id} variant={dispositionVariant(l.disposition)}>
                        {l.sku} x{l.receivedQuantity} -&gt; {formatStr(l.disposition)}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button variant="gradient" onClick={() => navigate(`/wms/returns/${r.id}`)}>
                    Review &amp; Complete
                  </Button>
                  <Button variant="outline" onClick={() => navigate(`/wms/returns/${r.id}`)}>
                    View Detail
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
