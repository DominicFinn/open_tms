import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCircle2,
  Loader2,
} from 'lucide-react';

import { API_URL } from '../api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

interface RmaLine {
  id: string;
  sku: string;
  requestedQuantity: number;
  receivedQuantity: number;
  disposition: string;
  inspectionStatus: string;
  inspectionNotes: string | null;
  requestedDisposition: string | null;
}

interface RmaDetail {
  id: string;
  rmaNumber: string;
  status: string;
  returnReason: string;
  lines: RmaLine[];
}

const DISPOSITIONS: { v: string; l: string; hint: string }[] = [
  { v: 'restock', l: 'Restock', hint: 'Item is sellable as-new. Route to putaway.' },
  { v: 'refurb', l: 'Refurbish', hint: 'Needs repair / refurb before resale.' },
  { v: 'scrap', l: 'Scrap', hint: 'Unusable. Dispose.' },
  { v: 'recycle', l: 'Recycle', hint: 'Dispose via recycling stream.' },
  { v: 'donate', l: 'Donate', hint: 'Donate to charity partner.' },
  { v: 'rtv', l: 'Return to Vendor', hint: 'Ship back to original supplier.' },
  { v: 'customer_keeps', l: 'Customer Keeps', hint: 'Item never received; refund only.' },
];

type Inspection = 'pass' | 'fail' | 'partial_damage';

const INSPECTION_STATUSES: { v: Inspection; l: string; tone: 'success' | 'destructive' | 'warning' }[] = [
  { v: 'pass', l: 'Pass', tone: 'success' },
  { v: 'fail', l: 'Fail', tone: 'destructive' },
  { v: 'partial_damage', l: 'Partial Damage', tone: 'warning' },
];

export default function WarehouseReturnInspect() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [rma, setRma] = useState<RmaDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeLineId, setActiveLineId] = useState<string | null>(null);
  const [inspectionStatus, setInspectionStatus] = useState<Inspection>('pass');
  const [disposition, setDisposition] = useState('');
  const [notes, setNotes] = useState('');
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

  const openLine = (line: RmaLine) => {
    setActiveLineId(line.id);
    setInspectionStatus('pass');
    setDisposition(line.requestedDisposition ?? '');
    setNotes('');
  };

  const handleInspect = async (lineId: string) => {
    if (!disposition) { setError('Choose a disposition'); return; }
    setError(''); setBusy(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/rma-lines/${lineId}/inspect`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inspectionStatus, disposition, inspectionNotes: notes || undefined }),
      });
      const data = await res.json();
      if (data.error) setError(data.error);
      else { setActiveLineId(null); setDisposition(''); setNotes(''); load(); }
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

  const linesToInspect = rma.lines.filter(l => l.receivedQuantity > 0 && l.disposition === 'pending');
  const allInspected = linesToInspect.length === 0;

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

      <Card>
        <CardContent className="pt-6">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Return Inspection
          </div>
          <div className="mt-1 text-xl font-bold">{rma.rmaNumber}</div>
          <div className="text-sm text-muted-foreground capitalize">
            {rma.returnReason.replace(/_/g, ' ')}
          </div>
        </CardContent>
      </Card>

      {allInspected ? (
        <Card className="text-center">
          <CardContent className="flex flex-col items-center gap-2 py-10">
            <CheckCircle2 className="h-12 w-12 text-success" />
            <p className="text-lg font-semibold">All lines inspected</p>
            <p className="text-sm text-muted-foreground">Finance will process the refund.</p>
            <Button
              type="button"
              variant="gradient"
              size="lg"
              className="mt-4"
              onClick={() => navigate('/warehouse/tasks')}
            >
              Back to Tasks
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {rma.lines.map(line => {
            const needsInspection = line.receivedQuantity > 0 && line.disposition === 'pending';
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
                        <span className="tabular-nums">{line.receivedQuantity}</span> received
                        {line.disposition !== 'pending' && (
                          <span className="ml-1 text-success">
                            <Check className="inline h-4 w-4" /> {line.disposition.replace(/_/g, ' ')}
                          </span>
                        )}
                        {line.requestedDisposition && line.disposition === 'pending' && (
                          <span className="ml-2">
                            (customer asked: {line.requestedDisposition.replace(/_/g, ' ')})
                          </span>
                        )}
                      </div>
                    </div>
                    {needsInspection && !active && (
                      <Button
                        type="button"
                        size="lg"
                        onClick={() => openLine(line)}
                      >
                        Inspect
                      </Button>
                    )}
                  </div>

                  {active && (
                    <div className="mt-4 space-y-4">
                      <div>
                        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Condition
                        </Label>
                        <div className="mt-2 flex gap-2">
                          {INSPECTION_STATUSES.map(s => {
                            const isSelected = inspectionStatus === s.v;
                            const tone =
                              s.tone === 'success' ? 'border-success text-success bg-success/10' :
                              s.tone === 'destructive' ? 'border-destructive text-destructive bg-destructive/10' :
                              'border-warning text-warning bg-warning/10';
                            return (
                              <button
                                key={s.v}
                                type="button"
                                onClick={() => setInspectionStatus(s.v)}
                                className={cn(
                                  'flex-1 rounded-md border-2 px-3 py-3 text-sm font-semibold transition-colors',
                                  isSelected
                                    ? tone
                                    : 'border-border bg-card text-muted-foreground hover:bg-muted/40',
                                )}
                              >
                                {s.l}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div>
                        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Disposition
                        </Label>
                        <div className="mt-2 grid grid-cols-2 gap-2">
                          {DISPOSITIONS.map(d => {
                            const selected = disposition === d.v;
                            return (
                              <button
                                key={d.v}
                                type="button"
                                onClick={() => setDisposition(d.v)}
                                title={d.hint}
                                className={cn(
                                  'rounded-md border-2 px-3 py-3 text-left text-sm font-semibold transition-colors',
                                  selected
                                    ? 'border-primary bg-primary/10 text-primary'
                                    : 'border-border bg-card text-foreground hover:bg-muted/40',
                                )}
                              >
                                {d.l}
                              </button>
                            );
                          })}
                        </div>
                        {disposition && (
                          <p className="mt-2 text-sm text-muted-foreground">
                            {DISPOSITIONS.find(d => d.v === disposition)?.hint}
                          </p>
                        )}
                      </div>

                      <div>
                        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Notes (optional)
                        </Label>
                        <textarea
                          rows={2}
                          value={notes}
                          onChange={e => setNotes(e.target.value)}
                          placeholder="Observations, damage details, etc."
                          className="mt-2 flex w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        />
                      </div>

                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="lg"
                          className="flex-1"
                          onClick={() => setActiveLineId(null)}
                          disabled={busy}
                        >
                          Cancel
                        </Button>
                        <Button
                          type="button"
                          variant="gradient"
                          size="lg"
                          className="flex-[2]"
                          onClick={() => handleInspect(line.id)}
                          disabled={busy || !disposition}
                        >
                          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                          {busy ? '...' : 'Submit'}
                        </Button>
                      </div>
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
