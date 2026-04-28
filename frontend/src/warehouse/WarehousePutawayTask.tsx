import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Loader2,
} from 'lucide-react';

import { API_URL } from '../api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

interface PutawayTaskDetail {
  id: string;
  status: string;
  putawayType: string;
  trackableUnit: { identifier: string; unitType: string; barcode: string | null };
  sourceBin: { label: string } | null;
  targetBin: { label: string; zone: { name: string } };
}

export default function WarehousePutawayTask() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [task, setTask] = useState<PutawayTaskDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [scannedBin, setScannedBin] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [result, setResult] = useState<any>(null);

  // Wire barcode scanner to auto-fill the bin label
  // useBarcodeScanner((barcode) => setScannedBin(barcode));

  useEffect(() => {
    fetch(`${API_URL}/api/v1/putaway/tasks/${id}`)
      .then(r => r.json())
      .then(res => { if (res.data) setTask(res.data); else setError('Not found'); })
      .catch(() => setError('Failed to load'))
      .finally(() => setLoading(false));
  }, [id]);

  const handleConfirm = async () => {
    if (!scannedBin.trim()) return;
    setError('');
    setConfirming(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/putaway/tasks/${id}/complete`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scannedBinLabel: scannedBin.trim() }),
      });
      const data = await res.json();
      if (data.error) setError(data.error);
      else setResult(data.data);
    } catch { setError('Failed'); }
    finally { setConfirming(false); }
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

  return (
    <div className="mx-auto max-w-2xl space-y-4 px-1 py-2 pb-32">
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

      {result ? (
        <Card className="text-center">
          <CardContent className="flex flex-col items-center gap-2 py-10">
            {result.deviation ? (
              <AlertTriangle className="h-14 w-14 text-warning" />
            ) : (
              <CheckCircle2 className="h-14 w-14 text-success" />
            )}
            <p className="text-lg font-semibold">
              {result.deviation ? 'Putaway Complete (Deviation)' : 'Putaway Complete'}
            </p>
            <p className="text-sm text-muted-foreground">
              Placed at <strong className="text-foreground">{result.actualBinLabel}</strong>
            </p>
            {result.deviation && (
              <div className="mt-2 w-full rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-warning">
                {result.deviationReason}
              </div>
            )}
            {result.constraintWarnings?.length > 0 && (
              <div className="mt-1 w-full rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-warning">
                {result.constraintWarnings.join('; ')}
              </div>
            )}
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
        <>
          {/* Direction */}
          <Card>
            <CardContent className="pt-6">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {task.putawayType === 'replenishment' ? 'Replenishment' : 'Putaway'}
              </div>
              <div className="mt-3 text-center">
                <div className="text-sm text-muted-foreground">Unit</div>
                <div className="mb-4 text-lg font-semibold">
                  {task.trackableUnit.identifier}
                </div>

                <div className="flex items-center justify-center gap-4">
                  <div>
                    <div className="text-xs text-muted-foreground">From</div>
                    <div className="text-base font-semibold">
                      {task.sourceBin?.label ?? 'Dock'}
                    </div>
                  </div>
                  <ArrowRight className="h-7 w-7 text-primary" />
                  <div>
                    <div className="text-xs text-muted-foreground">To</div>
                    <div className="text-2xl font-bold tabular-nums text-primary">
                      {task.targetBin.label}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {task.targetBin.zone.name}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Scan to confirm */}
          <Card className="border-2 border-primary">
            <CardContent className="pt-6">
              <div className="text-xs font-semibold uppercase tracking-wider text-primary">
                Scan Destination Bin
              </div>
              <Input
                value={scannedBin}
                onChange={e => setScannedBin(e.target.value)}
                placeholder={task.targetBin.label}
                autoFocus
                data-manual-input="true"
                className="mt-3 h-14 text-center text-2xl font-bold tabular-nums"
              />
            </CardContent>
          </Card>
        </>
      )}

      {/* Fixed bottom action bar */}
      {!result && (
        <div className="fixed inset-x-0 bottom-16 z-20 border-t border-border bg-background/95 p-4 backdrop-blur">
          <Button
            type="button"
            variant="gradient"
            size="lg"
            className="w-full text-base"
            onClick={handleConfirm}
            disabled={confirming || !scannedBin.trim()}
          >
            {confirming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {confirming ? 'Confirming...' : 'Confirm putaway'}
          </Button>
        </div>
      )}
    </div>
  );
}
