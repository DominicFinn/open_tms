import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle2,
  Loader2,
  X,
} from 'lucide-react';

import { API_URL } from '../api';
import { useBarcodeScanner } from './useBarcodeScanner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface ReceivingLine {
  id: string;
  sku: string;
  expectedQuantity: number;
  receivedQuantity: number;
  damagedQuantity: number;
  inspectionStatus: string;
  uomCode: string;
}

interface ReceivingTask {
  id: string;
  status: string;
  receivingType: string;
  crossDock: boolean;
  dockBin: { label: string } | null;
  lines: ReceivingLine[];
}

const INSPECTION_VARIANT: Record<string, 'success' | 'destructive' | 'warning'> = {
  pass: 'success',
  fail: 'destructive',
  quarantine: 'warning',
};

export default function WarehouseReceive() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [task, setTask] = useState<ReceivingTask | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeLineId, setActiveLineId] = useState<string | null>(null);
  const [receiveQty, setReceiveQty] = useState('');
  const [damagedQty, setDamagedQty] = useState('');
  const [busy, setBusy] = useState(false);
  const [blindScan, setBlindScan] = useState(false);
  const [blindSku, setBlindSku] = useState('');

  const load = () => {
    if (!id) return;
    setLoading(true);
    fetch(`${API_URL}/api/v1/receiving/tasks/${id}`)
      .then(r => r.json())
      .then(res => {
        if (res.error) setError(res.error);
        else setTask(res.data);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [id]);

  useBarcodeScanner((barcode) => {
    if (!task) return;
    const line = task.lines.find(l => l.sku === barcode || l.sku.endsWith(barcode));
    if (line) {
      const remaining = line.expectedQuantity - line.receivedQuantity;
      setActiveLineId(line.id);
      setReceiveQty(String(remaining > 0 ? remaining : 1));
      setDamagedQty('');
    } else if (task.receivingType === 'blind') {
      setBlindSku(barcode);
      setBlindScan(true);
      setReceiveQty('1');
    } else {
      setError(`Scanned "${barcode}" does not match any expected SKU on this receipt.`);
    }
  });

  const handleReceive = async (lineId: string | null) => {
    const qty = parseInt(receiveQty);
    if (!qty || qty < 1) {
      setError('Enter a valid quantity');
      return;
    }
    setError('');
    setBusy(true);
    try {
      const body: any = { receivedQuantity: qty };
      if (lineId) body.lineId = lineId;
      if (blindSku) body.sku = blindSku;
      if (damagedQty && parseInt(damagedQty) > 0) body.damagedQuantity = parseInt(damagedQty);

      const res = await fetch(`${API_URL}/api/v1/receiving/tasks/${id}/lines`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.error) setError(data.error);
      else {
        setActiveLineId(null);
        setBlindScan(false);
        setBlindSku('');
        setReceiveQty('');
        setDamagedQty('');
        load();
      }
    } finally {
      setBusy(false);
    }
  };

  const handleInspect = async (lineId: string, status: 'pass' | 'fail' | 'quarantine') => {
    setBusy(true);
    try {
      await fetch(`${API_URL}/api/v1/receiving/lines/${lineId}/inspect`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inspectionStatus: status }),
      });
      load();
    } finally {
      setBusy(false);
    }
  };

  const handleComplete = async () => {
    if (!confirm('Complete this receipt? Any expected lines with zero received will be flagged.')) return;
    setBusy(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/receiving/tasks/${id}/complete`, {
        method: 'POST',
      });
      const data = await res.json();
      if (data.error) setError(data.error);
      else navigate('/warehouse/tasks');
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
  if (!task) {
    return (
      <div className="rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
        {error || 'Not found'}
      </div>
    );
  }

  const linesToReceive = task.lines.filter(l => l.receivedQuantity < l.expectedQuantity);
  const allDone = linesToReceive.length === 0 && task.lines.length > 0;

  return (
    <div className="space-y-4 pb-24">
      <Button variant="ghost" size="sm" onClick={() => navigate('/warehouse/tasks')} className="-ml-2">
        <ArrowLeft className="h-5 w-5" />
        <span className="text-base">Tasks</span>
      </Button>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <Card>
        <CardContent className="space-y-1 p-5">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Receiving {task.receivingType === 'blind' ? '(blind)' : '(ASN)'} {task.crossDock && '- cross-dock'}
          </div>
          <div className="text-xl font-bold">{task.id.slice(0, 8)}</div>
          <div className="text-sm text-muted-foreground">
            Dock: <strong>{task.dockBin?.label ?? 'unassigned'}</strong>
          </div>
        </CardContent>
      </Card>

      {blindScan && (
        <Card className="border-warning/40">
          <CardContent className="space-y-3 p-5">
            <Label className="text-xs font-semibold uppercase tracking-wider text-warning">
              New SKU (blind receipt)
            </Label>
            <div className="text-base font-semibold">{blindSku}</div>
            <div className="flex gap-2">
              <Input
                type="number"
                inputMode="numeric"
                min={1}
                value={receiveQty}
                autoFocus
                onChange={e => setReceiveQty(e.target.value)}
                data-manual-input="true"
                className="h-12 flex-1 text-center text-lg"
              />
              <Button size="lg" variant="gradient" onClick={() => handleReceive(null)} disabled={busy}>
                {busy ? '...' : 'Confirm'}
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-12 w-12"
                onClick={() => { setBlindScan(false); setBlindSku(''); }}
                disabled={busy}
                aria-label="Cancel"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {allDone ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-success/15 text-success">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <div className="text-lg font-semibold">All lines received</div>
            <Button size="lg" variant="gradient" onClick={handleComplete} disabled={busy}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {busy ? 'Completing...' : 'Complete receipt'}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Scan SKU to receive{task.receivingType === 'blind' ? ' - new SKUs accepted' : ''}
          </Label>
          <div className="space-y-2">
            {task.lines.map(line => {
              const remaining = line.expectedQuantity - line.receivedQuantity;
              const done = remaining <= 0;
              const active = activeLineId === line.id;
              return (
                <Card key={line.id} className={cn(active && 'border-primary')}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="text-base font-semibold">{line.sku}</div>
                        <div className="text-sm text-muted-foreground">
                          {line.receivedQuantity} / {line.expectedQuantity} {line.uomCode}
                          {line.damagedQuantity > 0 && (
                            <span className="ml-2 text-warning">({line.damagedQuantity} damaged)</span>
                          )}
                          {done && <CheckCircle2 className="ml-2 inline h-4 w-4 text-success" />}
                        </div>
                      </div>
                      {!done && !active && (
                        <Button
                          size="sm"
                          onClick={() => {
                            setActiveLineId(line.id);
                            setReceiveQty(String(remaining));
                            setDamagedQty('');
                          }}
                        >
                          Receive
                        </Button>
                      )}
                    </div>

                    {active && (
                      <div className="mt-4 space-y-3">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label className="text-xs text-muted-foreground">Received</Label>
                            <Input
                              type="number"
                              inputMode="numeric"
                              min={0}
                              max={remaining}
                              value={receiveQty}
                              onChange={e => setReceiveQty(e.target.value)}
                              autoFocus
                              data-manual-input="true"
                              className="h-12 text-center text-lg"
                            />
                          </div>
                          <div>
                            <Label className="text-xs text-muted-foreground">Damaged</Label>
                            <Input
                              type="number"
                              inputMode="numeric"
                              min={0}
                              value={damagedQty}
                              onChange={e => setDamagedQty(e.target.value)}
                              data-manual-input="true"
                              className="h-12 text-center text-lg"
                            />
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="lg"
                            variant="gradient"
                            className="flex-[2] text-base"
                            onClick={() => handleReceive(line.id)}
                            disabled={busy}
                          >
                            {busy ? '...' : 'Confirm'}
                          </Button>
                          <Button
                            size="lg"
                            variant="outline"
                            className="flex-1"
                            onClick={() => {
                              setActiveLineId(null);
                              setReceiveQty('');
                              setDamagedQty('');
                            }}
                            disabled={busy}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    )}

                    {done && line.inspectionStatus === 'pending' && (
                      <div className="mt-3 grid grid-cols-3 gap-2">
                        {(['pass', 'fail', 'quarantine'] as const).map(s => {
                          const v = INSPECTION_VARIANT[s];
                          return (
                            <Button
                              key={s}
                              variant="outline"
                              size="sm"
                              className={cn(
                                'capitalize',
                                v === 'success' && 'border-success/40 text-success hover:bg-success/10',
                                v === 'destructive' && 'border-destructive/40 text-destructive hover:bg-destructive/10',
                                v === 'warning' && 'border-warning/40 text-warning hover:bg-warning/10',
                              )}
                              onClick={() => handleInspect(line.id, s)}
                              disabled={busy}
                            >
                              {s}
                            </Button>
                          );
                        })}
                      </div>
                    )}

                    {done && line.inspectionStatus !== 'pending' && (
                      <div className="mt-2 text-xs text-muted-foreground">
                        Inspection:{' '}
                        <Badge variant={INSPECTION_VARIANT[line.inspectionStatus] ?? 'muted'} className="ml-1 capitalize">
                          {line.inspectionStatus}
                        </Badge>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
