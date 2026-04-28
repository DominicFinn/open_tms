import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCircle2,
  Loader2,
  Minus,
  Plus,
} from 'lucide-react';

import { API_URL } from '../api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
// Barcode scanner would be used for bin verification in production
// import { useBarcodeScanner } from './useBarcodeScanner';

interface PickLine {
  id: string;
  sku: string;
  requestedQuantity: number;
  pickedQuantity: number;
  status: string;
  walkSequence: number;
  bin: { label: string; zone: { name: string } };
}

interface PickTaskDetail {
  id: string;
  status: string;
  pickType: string;
  totalLines: number;
  completedLines: number;
  wave: { waveNumber: string } | null;
  zone: { name: string } | null;
  pickLines: PickLine[];
}

export default function WarehousePickTask() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [task, setTask] = useState<PickTaskDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [picking, setPicking] = useState(false);
  const [pickedQty, setPickedQty] = useState('');

  const loadTask = () => {
    fetch(`${API_URL}/api/v1/pick-tasks/${id}`)
      .then(r => r.json())
      .then(res => { if (res.data) setTask(res.data); else setError('Not found'); })
      .catch(() => setError('Failed to load'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadTask(); }, [id]);

  const nextLine = task?.pickLines.find(l => l.status === 'pending');

  const handlePick = async (lineId: string, qty: number) => {
    setError('');
    setPicking(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/pick-lines/${lineId}/complete`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pickedQuantity: qty }),
      });
      const data = await res.json();
      if (data.error) setError(data.error);
      else { setPickedQty(''); loadTask(); }
    } catch { setError('Failed'); }
    finally { setPicking(false); }
  };

  const handleConfirmNext = () => {
    if (!nextLine) return;
    const qty = parseInt(pickedQty) || nextLine.requestedQuantity;
    handlePick(nextLine.id, qty);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  if (!task) {
    return (
      <Card className="mx-auto mt-4 max-w-2xl p-6 text-center">
        <p className="text-base text-destructive">{error || 'Not found'}</p>
      </Card>
    );
  }

  const isComplete = task.status === 'completed' || task.status === 'short_pick';
  const progress = task.totalLines > 0 ? (task.completedLines / task.totalLines) * 100 : 0;
  const currentQty = pickedQty
    ? parseInt(pickedQty) || 0
    : nextLine?.requestedQuantity ?? 0;

  return (
    <div className="mx-auto max-w-2xl space-y-4 px-1 py-2 pb-32">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
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
        <div className="flex-1 text-right text-sm text-muted-foreground">
          {task.wave?.waveNumber}
          {task.zone ? ` | ${task.zone.name}` : ''}
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Progress */}
      <div>
        <div className="mb-1.5 flex items-center justify-between text-sm text-muted-foreground">
          <span className="font-medium">Pick Progress</span>
          <span className="tabular-nums">{task.completedLines}/{task.totalLines}</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-success transition-[width]"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Current pick */}
      {!isComplete && nextLine ? (
        <Card className="border-2 border-primary">
          <CardContent className="pt-6">
            <div className="text-xs font-semibold uppercase tracking-wider text-primary">
              Next Pick
            </div>

            <div className="mt-4 grid grid-cols-2 gap-4">
              <div>
                <div className="text-xs text-muted-foreground">Bin</div>
                <div className="text-2xl font-bold tabular-nums text-primary">
                  {nextLine.bin.label}
                </div>
                <div className="text-xs text-muted-foreground">{nextLine.bin.zone.name}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">SKU</div>
                <div className="text-base font-semibold">{nextLine.sku}</div>
                <div className="text-sm text-muted-foreground">
                  Qty: <strong className="text-foreground">{nextLine.requestedQuantity}</strong>
                </div>
              </div>
            </div>

            <div className="mt-6 text-center">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Quantity to pick
              </div>
              <div className="mt-2 flex items-center justify-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-14 w-14"
                  onClick={() => setPickedQty(String(Math.max(0, currentQty - 1)))}
                  disabled={picking || currentQty <= 0}
                  aria-label="Decrement"
                >
                  <Minus className="h-6 w-6" />
                </Button>
                <Input
                  type="number"
                  min="0"
                  inputMode="numeric"
                  value={pickedQty}
                  onChange={e => setPickedQty(e.target.value)}
                  placeholder={String(nextLine.requestedQuantity)}
                  data-manual-input="true"
                  className="h-14 w-32 text-center text-3xl font-bold tabular-nums"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-14 w-14"
                  onClick={() => setPickedQty(String(currentQty + 1))}
                  disabled={picking}
                  aria-label="Increment"
                >
                  <Plus className="h-6 w-6" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : isComplete ? (
        <Card className="flex flex-col items-center gap-2 py-12 text-center">
          <CheckCircle2 className="h-12 w-12 text-success" />
          <p className="text-lg font-semibold">Pick Complete</p>
          <p className="text-sm text-muted-foreground">{task.completedLines} lines picked</p>
        </Card>
      ) : null}

      {/* Lines list */}
      <div>
        <div className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          All Lines
        </div>
        <div className="space-y-1.5">
          {task.pickLines.map(line => (
            <div
              key={line.id}
              className={cn(
                'flex items-center gap-3 rounded-md border-l-4 px-3 py-2.5 text-sm',
                line.status === 'picked' && 'border-l-success bg-card',
                line.status === 'short' && 'border-l-warning bg-card',
                line.status === 'pending' && line.id === nextLine?.id && 'border-l-primary bg-primary/5',
                line.status === 'pending' && line.id !== nextLine?.id && 'border-l-transparent bg-card',
              )}
            >
              <div className="flex-1 min-w-0">
                <span className="font-semibold">{line.bin.label}</span>
                <span className="ml-2 text-muted-foreground truncate">{line.sku}</span>
              </div>
              <div className={cn(
                'tabular-nums font-medium',
                line.pickedQuantity > 0 ? 'text-success' : 'text-muted-foreground',
              )}>
                {line.pickedQuantity}/{line.requestedQuantity}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Fixed bottom action bar */}
      {!isComplete && nextLine && (
        <div className="fixed inset-x-0 bottom-16 z-20 border-t border-border bg-background/95 p-4 backdrop-blur">
          <Button
            type="button"
            variant="gradient"
            size="lg"
            className="w-full text-base"
            onClick={handleConfirmNext}
            disabled={picking}
          >
            {picking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {picking ? 'Confirming...' : 'Confirm pick'}
          </Button>
        </div>
      )}
    </div>
  );
}
