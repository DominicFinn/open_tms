import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Camera, CheckCircle2, ChevronLeft, Loader2, Search } from 'lucide-react';

import { API_URL } from '../api';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useBarcodeScanner } from '../warehouse/useBarcodeScanner';
import { CameraScannerModal } from '../warehouse/CameraScannerModal';

interface Bin {
  id: string;
  label: string;
  zone?: { name: string } | null;
}

interface Observation {
  id: string;
  sku: string;
  uomCode: string;
  observedQuantity: number | null;
  observedAt: string;
  bin: { label: string } | null;
}

function currentLocationId(): string | null {
  try {
    return JSON.parse(localStorage.getItem('inventory_app_location') || '{}').id ?? null;
  } catch {
    return null;
  }
}

export default function InventoryAppScan() {
  const locationId = useMemo(currentLocationId, []);
  const [bins, setBins] = useState<Bin[]>([]);
  const [binSearch, setBinSearch] = useState('');
  const [selectedBin, setSelectedBin] = useState<Bin | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);

  const [sku, setSku] = useState('');
  const [quantity, setQuantity] = useState('');
  const [lotNumber, setLotNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [success, setSuccess] = useState(false);

  const [recent, setRecent] = useState<Observation[]>([]);
  const [recentLoading, setRecentLoading] = useState(true);

  useEffect(() => {
    if (!locationId) return;
    fetch(`${API_URL}/api/v1/warehouse/bins?locationId=${locationId}`)
      .then(r => r.json())
      .then(json => setBins(json.error ? [] : (json.data || [])));
    loadRecent();
  }, [locationId]);

  function loadRecent() {
    if (!locationId) return;
    setRecentLoading(true);
    fetch(`${API_URL}/api/v1/inventory/observations?locationId=${locationId}`)
      .then(r => r.json())
      .then(json => setRecent(json.error ? [] : (json.data || [])))
      .finally(() => setRecentLoading(false));
  }

  // HID hardware scanner: active only while picking a bin, so it never steals keystrokes
  // once the SKU/quantity form is focused.
  useBarcodeScanner((barcode) => {
    const match = bins.find(b => b.label.toLowerCase() === barcode.toLowerCase());
    if (match) setSelectedBin(match);
    else setBinSearch(barcode);
  }, { enabled: !selectedBin });

  const filteredBins = bins.filter(b => b.label.toLowerCase().includes(binSearch.toLowerCase()));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedBin || !locationId || !sku.trim()) return;
    setSubmitting(true);
    setFormError('');

    try {
      const res = await fetch(`${API_URL}/api/v1/inventory/observations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          locationId,
          binId: selectedBin.id,
          sku: sku.trim(),
          observedQuantity: quantity.trim() === '' ? undefined : Number(quantity),
          lotNumber: lotNumber.trim() || undefined,
          notes: notes.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        setFormError(json.error || 'Could not record observation');
        setSubmitting(false);
        return;
      }
      setSuccess(true);
      setSku(''); setQuantity(''); setLotNumber(''); setNotes('');
      loadRecent();
    } catch {
      setFormError('Network error. Check your connection.');
    } finally {
      setSubmitting(false);
    }
  }

  if (!locationId) {
    return (
      <Card className="flex flex-col items-center gap-3 p-8 text-center">
        <AlertTriangle className="h-10 w-10 text-muted-foreground" />
        <p className="text-base font-semibold">No site selected</p>
      </Card>
    );
  }

  if (!selectedBin) {
    return (
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-bold tracking-tight">Scan a bin</h2>
          <p className="text-sm text-muted-foreground">
            Scan a bin label with a handheld scanner, or search and pick one below.
          </p>
        </div>

        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={binSearch}
              onChange={e => setBinSearch(e.target.value)}
              placeholder="Bin label..."
              className="h-12 pl-9 text-base"
              data-manual-input="true"
            />
          </div>
          <Button type="button" variant="outline" size="icon" className="h-12 w-12 shrink-0" onClick={() => setCameraOpen(true)} aria-label="Scan with camera">
            <Camera className="h-5 w-5" />
          </Button>
        </div>

        {bins.length === 0 ? (
          <Card className="p-6 text-center text-sm text-muted-foreground">No bins set up at this site yet.</Card>
        ) : (
          <div className="space-y-2">
            {filteredBins.slice(0, 50).map(bin => (
              <Card
                key={bin.id}
                onClick={() => setSelectedBin(bin)}
                className="cursor-pointer p-3 transition-colors hover:bg-muted/30 active:bg-muted/50"
              >
                <div className="text-sm font-semibold">{bin.label}</div>
                {bin.zone?.name && <div className="text-xs text-muted-foreground">{bin.zone.name}</div>}
              </Card>
            ))}
          </div>
        )}

        <CameraScannerModal
          open={cameraOpen}
          onClose={() => setCameraOpen(false)}
          onScan={(code) => {
            const match = bins.find(b => b.label.toLowerCase() === code.toLowerCase());
            if (match) setSelectedBin(match);
            else setBinSearch(code);
          }}
          title="Scan Bin"
          hint="Point the camera at the bin label"
        />

        <RecentObservations items={recent} loading={recentLoading} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={() => { setSelectedBin(null); setSuccess(false); setFormError(''); }}
        className="flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" /> Change bin
      </button>

      <Card className="p-3">
        <div className="text-sm font-semibold">{selectedBin.label}</div>
        {selectedBin.zone?.name && <div className="text-xs text-muted-foreground">{selectedBin.zone.name}</div>}
      </Card>

      {success && (
        <div className="flex items-start gap-2 rounded-md border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <span>Observation recorded.</span>
        </div>
      )}
      {formError && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{formError}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="obs-sku" className="text-base">SKU</Label>
          <Input
            id="obs-sku"
            value={sku}
            onChange={e => setSku(e.target.value)}
            placeholder="Scan or type SKU"
            required
            className="h-12 text-base"
            data-manual-input="true"
            autoFocus
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="obs-qty" className="text-base">Quantity observed (optional)</Label>
          <Input
            id="obs-qty"
            type="number"
            min={0}
            value={quantity}
            onChange={e => setQuantity(e.target.value)}
            placeholder="Leave blank if just spotting the SKU"
            className="h-12 text-base"
            data-manual-input="true"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="obs-lot" className="text-base">Lot number (optional)</Label>
          <Input
            id="obs-lot"
            value={lotNumber}
            onChange={e => setLotNumber(e.target.value)}
            className="h-12 text-base"
            data-manual-input="true"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="obs-notes" className="text-base">Notes (optional)</Label>
          <Input
            id="obs-notes"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            className="h-12 text-base"
            data-manual-input="true"
          />
        </div>
        <Button type="submit" variant="gradient" size="lg" className="w-full text-base" disabled={submitting || !sku.trim()}>
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          {submitting ? 'Recording...' : 'Record observation'}
        </Button>
      </form>
    </div>
  );
}

function RecentObservations({ items, loading }: { items: Observation[]; loading: boolean }) {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-muted-foreground">Recent observations</h3>
      {loading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No observations recorded yet at this site.</p>
      ) : (
        <div className="space-y-2">
          {items.slice(0, 20).map(o => (
            <Card key={o.id} className="p-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold">{o.sku}</div>
                  <div className="text-xs text-muted-foreground">
                    {o.bin?.label ?? 'Unknown bin'} · {new Date(o.observedAt).toLocaleString()}
                  </div>
                </div>
                <div className="text-sm font-medium">
                  {o.observedQuantity != null ? `${o.observedQuantity} ${o.uomCode}` : 'Seen'}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
