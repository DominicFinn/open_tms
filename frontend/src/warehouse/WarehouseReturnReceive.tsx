import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCircle2,
  Loader2,
  X,
} from 'lucide-react';

import { API_URL } from '../api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface RmaLine {
  id: string;
  sku: string;
  requestedQuantity: number;
  receivedQuantity: number;
  disposition: string;
  inspectionStatus: string;
}

interface RmaDetail {
  id: string;
  rmaNumber: string;
  status: string;
  returnReason: string;
  customerNotes: string | null;
  returnTrackingNumber: string | null;
  lines: RmaLine[];
}

export default function WarehouseReturnReceive() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [rma, setRma] = useState<RmaDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeLineId, setActiveLineId] = useState<string | null>(null);
  const [receiveQty, setReceiveQty] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () => {
    if (!id) return;
    setLoading(true);
    fetch(`${API_URL}/api/v1/rmas/${id}`)
      .then(r => r.json())
      .then(res => { if (res.error) setError(res.error); else setRma(res.data); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [id]);

  const handleReceive = async (lineId: string) => {
    const qty = parseInt(receiveQty);
    if (!qty || qty < 1) { setError('Enter a valid quantity'); return; }
    setError(''); setBusy(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/rma-lines/${lineId}/receive`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ receivedQuantity: qty }),
      });
      const data = await res.json();
      if (data.error) setError(data.error);
      else { setActiveLineId(null); setReceiveQty(''); load(); }
    } finally { setBusy(false); }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  if (!rma) {
    return (
      <Card className="mx-auto mt-4 max-w-2xl p-6 text-center">
        <p className="text-base text-destructive">{error || 'Not found'}</p>
      </Card>
    );
  }

  const linesToReceive = rma.lines.filter(l => l.receivedQuantity < l.requestedQuantity);
  const allReceived = linesToReceive.length === 0;

  return (
    <div className="mx-auto max-w-2xl space-y-4 px-1 py-2 pb-24">
      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-12 w-12 shrink-0"
          onClick={() => navigate('/warehouse/tasks')}
          aria-label="Back to tasks"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* RMA summary */}
      <Card>
        <CardContent className="pt-6">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Return Receipt
          </div>
          <div className="mt-1 text-xl font-bold">{rma.rmaNumber}</div>
          <div className="text-sm text-muted-foreground capitalize">
            {rma.returnReason.replace(/_/g, ' ')}
          </div>
          {rma.returnTrackingNumber && (
            <div className="mt-1 text-sm text-muted-foreground">
              Tracking: {rma.returnTrackingNumber}
            </div>
          )}
          {rma.customerNotes && (
            <div className="mt-3 rounded-md bg-muted/40 px-3 py-2 text-sm">
              {rma.customerNotes}
            </div>
          )}
        </CardContent>
      </Card>

      {allReceived ? (
        <Card className="text-center">
          <CardContent className="flex flex-col items-center gap-2 py-10">
            <CheckCircle2 className="h-12 w-12 text-success" />
            <p className="text-lg font-semibold">All lines received</p>
            <p className="text-sm text-muted-foreground">Ready for inspection</p>
            <Button
              type="button"
              variant="gradient"
              size="lg"
              className="mt-4"
              onClick={() => navigate(`/warehouse/tasks/return-inspect/${rma.id}`)}
            >
              Start Inspection
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {rma.lines.map(line => {
            const remaining = line.requestedQuantity - line.receivedQuantity;
            const done = remaining === 0;
            const active = activeLineId === line.id;
            return (
              <Card
                key={line.id}
                className={cn(active && 'border-2 border-primary')}
              >
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-base font-semibold">{line.sku}</div>
                      <div className="text-sm text-muted-foreground">
                        <span className="tabular-nums">{line.receivedQuantity} / {line.requestedQuantity}</span> received
                        {done && <Check className="ml-1 inline h-4 w-4 text-success" />}
                      </div>
                    </div>
                    {!done && !active && (
                      <Button
                        type="button"
                        size="lg"
                        onClick={() => { setActiveLineId(line.id); setReceiveQty(String(remaining)); }}
                      >
                        Receive
                      </Button>
                    )}
                  </div>

                  {active && (
                    <div className="mt-3 flex items-center gap-2">
                      <Input
                        type="number"
                        inputMode="numeric"
                        min={1}
                        max={remaining}
                        value={receiveQty}
                        onChange={e => setReceiveQty(e.target.value)}
                        autoFocus
                        data-manual-input="true"
                        className="h-14 flex-1 text-center text-2xl font-bold tabular-nums"
                      />
                      <Button
                        type="button"
                        variant="gradient"
                        size="lg"
                        onClick={() => handleReceive(line.id)}
                        disabled={busy}
                      >
                        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                        {busy ? '...' : 'Confirm'}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-12 w-12"
                        onClick={() => { setActiveLineId(null); setReceiveQty(''); }}
                        disabled={busy}
                        aria-label="Cancel"
                      >
                        <X className="h-5 w-5" />
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
