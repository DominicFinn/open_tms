import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, CheckCircle2, Loader2, XCircle } from 'lucide-react';

import { API_URL } from '../api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface AuditLine {
  sku: string;
  expectedQuantity: number;
  weightGramsPerUnit: number;
  lineWeightGrams: number;
}

interface PastAudit {
  id: string;
  verdict: string;
  actualWeightGrams: number;
  expectedWeightGrams: number;
  weightVariancePercent: string | number | null;
  createdAt: string;
}

interface AuditContext {
  packTaskId: string;
  orderId: string;
  status: string;
  expectedWeightGrams: number;
  lines: AuditLine[];
  existingAudits: PastAudit[];
}

const VERDICT_TONE: Record<string, { variant: 'success' | 'warning' | 'destructive'; icon: typeof CheckCircle2 }> = {
  pass: { variant: 'success', icon: CheckCircle2 },
  warning: { variant: 'warning', icon: AlertTriangle },
  fail: { variant: 'destructive', icon: XCircle },
};

export default function WarehousePackAudit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [ctx, setCtx] = useState<AuditContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [weight, setWeight] = useState('');
  const [length, setLength] = useState('');
  const [width, setWidth] = useState('');
  const [height, setHeight] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<any>(null);

  const load = () => {
    if (!id) return;
    setLoading(true);
    fetch(`${API_URL}/api/v1/warehouse/pack-tasks/${id}/audit-context`)
      .then(r => r.json())
      .then(res => {
        if (res.error) setError(res.error);
        else setCtx(res.data);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [id]);

  const handleSubmit = async () => {
    const w = parseInt(weight);
    if (!w || w < 1) {
      setError('Enter a valid weight in grams');
      return;
    }
    setError('');
    setBusy(true);
    try {
      const payload: any = { packTaskId: id, actualWeightGrams: w };
      const l = parseInt(length);
      const wd = parseInt(width);
      const h = parseInt(height);
      if (l) payload.actualLengthMm = l;
      if (wd) payload.actualWidthMm = wd;
      if (h) payload.actualHeightMm = h;
      if (notes.trim()) payload.notes = notes.trim();

      const res = await fetch(`${API_URL}/api/v1/pack-audits`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.error) setError(data.error);
      else setResult(data.data);
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!ctx) {
    return (
      <div className="rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
        {error || 'Not found'}
      </div>
    );
  }

  const verdictTone = result ? VERDICT_TONE[result.verdict] : null;
  const VerdictIcon = verdictTone?.icon ?? CheckCircle2;

  return (
    <div className="space-y-4 pb-24">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigate('/warehouse/tasks')}
        className="-ml-2"
      >
        <ArrowLeft className="h-5 w-5" />
        <span className="text-base">Tasks</span>
      </Button>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {result ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <div
              className={cn(
                'flex h-16 w-16 items-center justify-center rounded-full',
                verdictTone?.variant === 'success' && 'bg-success/15 text-success',
                verdictTone?.variant === 'warning' && 'bg-warning/15 text-warning',
                verdictTone?.variant === 'destructive' && 'bg-destructive/15 text-destructive',
              )}
            >
              <VerdictIcon className="h-8 w-8" />
            </div>
            <div className="text-2xl font-bold capitalize">{result.verdict}</div>
            <div className="text-sm text-muted-foreground">
              {result.weightVariancePercent > 0 ? '+' : ''}
              {result.weightVariancePercent}% weight variance
            </div>
            <div className="text-sm text-muted-foreground">
              Expected: {(result.expectedWeightGrams / 1000).toFixed(2)} kg
            </div>
            {result.issueId && (
              <div className="rounded-md border border-warning/30 bg-warning/10 px-4 py-2 text-sm text-warning">
                A quality issue has been raised for follow-up.
              </div>
            )}
            <Button
              size="lg"
              variant="gradient"
              className="mt-2 w-full text-base"
              onClick={() => navigate('/warehouse/tasks')}
            >
              Back to tasks
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardContent className="space-y-1 p-5">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Pack audit
              </div>
              <div className="text-sm text-muted-foreground">
                Pack task <code className="font-mono">{ctx.packTaskId.slice(0, 8)}</code> - {ctx.lines.length} line{ctx.lines.length === 1 ? '' : 's'}
              </div>
              <div className="pt-2 text-3xl font-bold tabular-nums text-primary">
                {(ctx.expectedWeightGrams / 1000).toFixed(2)} kg
              </div>
              <div className="text-xs text-muted-foreground">expected weight</div>
            </CardContent>
          </Card>

          <Card className="border-primary/40">
            <CardContent className="space-y-3 p-5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-primary">
                Actual weight (grams)
              </Label>
              <Input
                type="number"
                inputMode="numeric"
                value={weight}
                onChange={e => setWeight(e.target.value)}
                autoFocus
                placeholder={String(ctx.expectedWeightGrams)}
                className="h-14 text-center text-2xl font-bold tabular-nums"
              />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-3 p-5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Dimensions (mm, optional)
              </Label>
              <div className="grid grid-cols-3 gap-2">
                <Input type="number" inputMode="numeric" value={length} onChange={e => setLength(e.target.value)} placeholder="L" className="h-12 text-center text-base" />
                <Input type="number" inputMode="numeric" value={width} onChange={e => setWidth(e.target.value)} placeholder="W" className="h-12 text-center text-base" />
                <Input type="number" inputMode="numeric" value={height} onChange={e => setHeight(e.target.value)} placeholder="H" className="h-12 text-center text-base" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-2 p-5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Notes (optional)
              </Label>
              <textarea
                rows={2}
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Observation, damage, etc."
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              />
            </CardContent>
          </Card>

          {ctx.existingAudits.length > 0 && (
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Previous audits for this pack
              </Label>
              {ctx.existingAudits.map(a => {
                const tone = VERDICT_TONE[a.verdict];
                return (
                  <Card key={a.id}>
                    <CardContent className="flex items-center justify-between p-3 text-sm">
                      <Badge variant={tone?.variant ?? 'muted'} className="capitalize">
                        {a.verdict}
                      </Badge>
                      <span className="text-muted-foreground">
                        {Number(a.weightVariancePercent ?? 0).toFixed(1)}% - {(a.actualWeightGrams / 1000).toFixed(2)} kg
                      </span>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}

      {!result && (
        <div className="fixed inset-x-0 bottom-16 z-20 border-t border-border bg-background/95 p-4 backdrop-blur">
          <Button
            size="lg"
            variant="gradient"
            className="w-full text-base"
            onClick={handleSubmit}
            disabled={busy || !weight}
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {busy ? 'Recording...' : 'Record audit'}
          </Button>
        </div>
      )}
    </div>
  );
}
