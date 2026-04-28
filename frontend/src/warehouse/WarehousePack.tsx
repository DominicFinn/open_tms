import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Loader2, X } from 'lucide-react';

import { API_URL } from '../api';
import { useBarcodeScanner } from './useBarcodeScanner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

interface PackLine {
  id: string;
  sku: string;
  expectedQuantity: number;
  packedQuantity: number;
  status: string;
  trackableUnitId: string;
}

interface PackTask {
  id: string;
  status: string;
  orderId: string;
  packStationBin: { label: string } | null;
  packLines: PackLine[];
}

interface Carton {
  id: string;
  name: string;
  lengthMm: number;
  widthMm: number;
  heightMm: number;
  maxWeightGrams: number;
  temperatureZone: string;
}

export default function WarehousePack() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [task, setTask] = useState<PackTask | null>(null);
  const [cartons, setCartons] = useState<Carton[]>([]);
  const [selectedCartonId, setSelectedCartonId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeLineId, setActiveLineId] = useState<string | null>(null);
  const [packQty, setPackQty] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () => {
    if (!id) return;
    setLoading(true);
    fetch(`${API_URL}/api/v1/pack-tasks/${id}`)
      .then(r => r.json())
      .then(res => {
        if (res.error) setError(res.error);
        else setTask(res.data);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [id]);

  useEffect(() => {
    fetch(`${API_URL}/api/v1/carton-catalogue`)
      .then(r => r.json())
      .then(res => setCartons((res.data || []).filter((c: any) => c.active)))
      .catch(() => {});
  }, []);

  useBarcodeScanner((barcode) => {
    if (!task) return;
    const line = task.packLines.find(l => l.sku === barcode || l.sku.endsWith(barcode));
    if (line) {
      const remaining = line.expectedQuantity - line.packedQuantity;
      if (remaining <= 0) {
        setError(`${line.sku} is already fully packed.`);
        return;
      }
      setActiveLineId(line.id);
      setPackQty(String(remaining));
      setError('');
    } else {
      setError(`Scanned "${barcode}" does not match any item on this pack task.`);
    }
  });

  const handlePack = async (lineId: string) => {
    const qty = parseInt(packQty);
    if (!qty || qty < 1) {
      setError('Enter a valid quantity');
      return;
    }
    setError('');
    setBusy(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/pack-lines/${lineId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packedQuantity: qty }),
      });
      const data = await res.json();
      if (data.error) setError(data.error);
      else {
        setActiveLineId(null);
        setPackQty('');
        load();
      }
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

  const linesToPack = task.packLines.filter(l => l.packedQuantity < l.expectedQuantity);
  const allDone = linesToPack.length === 0 && task.packLines.length > 0;

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
            Pack task
          </div>
          <div className="text-xl font-bold">{task.id.slice(0, 8)}</div>
          <div className="text-sm text-muted-foreground">
            Station: <strong>{task.packStationBin?.label ?? 'any'}</strong> &middot; {task.packLines.length} line{task.packLines.length === 1 ? '' : 's'}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 p-5">
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Carton
          </Label>
          <Select value={selectedCartonId} onValueChange={setSelectedCartonId}>
            <SelectTrigger className="h-12 text-base">
              <SelectValue placeholder="Select a carton..." />
            </SelectTrigger>
            <SelectContent>
              {cartons.map(c => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name} - {(c.lengthMm / 10).toFixed(0)}x{(c.widthMm / 10).toFixed(0)}x{(c.heightMm / 10).toFixed(0)}cm,
                  {' '}max {(c.maxWeightGrams / 1000).toFixed(0)}kg
                  {c.temperatureZone !== 'any' ? ` (${c.temperatureZone})` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {allDone && (
            <Button
              size="lg"
              variant="gradient"
              className="w-full text-base"
              onClick={() => navigate(`/warehouse/tasks/pack-audit/${task.id}`)}
            >
              Run pack audit
            </Button>
          )}
        </CardContent>
      </Card>

      {allDone ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-success/15 text-success">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <div className="text-lg font-semibold">All items packed</div>
            <div className="text-sm text-muted-foreground">Run a pack audit to verify weight before ship.</div>
          </CardContent>
        </Card>
      ) : (
        <>
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Scan item to pack
          </Label>
          <div className="space-y-2">
            {task.packLines.map(line => {
              const remaining = line.expectedQuantity - line.packedQuantity;
              const done = remaining <= 0;
              const active = activeLineId === line.id;
              return (
                <Card key={line.id} className={cn(active && 'border-primary')}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex-1">
                        <div className="text-base font-semibold">{line.sku}</div>
                        <div className="text-sm text-muted-foreground">
                          {line.packedQuantity} / {line.expectedQuantity} packed
                          {done && <CheckCircle2 className="ml-2 inline h-4 w-4 text-success" />}
                        </div>
                      </div>
                      {!done && !active && (
                        <Button
                          size="sm"
                          onClick={() => {
                            setActiveLineId(line.id);
                            setPackQty(String(remaining));
                          }}
                        >
                          Pack
                        </Button>
                      )}
                    </div>

                    {active && (
                      <div className="mt-3 flex gap-2">
                        <Input
                          type="number"
                          inputMode="numeric"
                          min={1}
                          max={remaining}
                          value={packQty}
                          onChange={e => setPackQty(e.target.value)}
                          autoFocus
                          data-manual-input="true"
                          className="h-12 flex-1 text-center text-lg"
                        />
                        <Button
                          size="lg"
                          variant="gradient"
                          onClick={() => handlePack(line.id)}
                          disabled={busy}
                        >
                          {busy ? '...' : 'Confirm'}
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-12 w-12"
                          onClick={() => {
                            setActiveLineId(null);
                            setPackQty('');
                          }}
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
        </>
      )}
    </div>
  );
}
