import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ChevronLeft, Loader2, PackageSearch, Search } from 'lucide-react';

import { API_URL } from '../api';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface SummaryRow {
  sku: string;
  uomCode: string;
  totalOnHand: number;
  totalAllocated: number;
  totalAvailable: number;
  totalOnHold: number;
  binCount: number;
}

interface RecordRow {
  id: string;
  sku: string;
  uomCode: string;
  quantityOnHand: number;
  quantityAvailable: number;
  lotNumber: string | null;
  bin: { label: string; zone?: { name: string } | null } | null;
}

function currentLocationId(): string | null {
  try {
    return JSON.parse(localStorage.getItem('inventory_app_location') || '{}').id ?? null;
  } catch {
    return null;
  }
}

export default function InventoryAppLevels() {
  const locationId = useMemo(currentLocationId, []);
  const [summary, setSummary] = useState<SummaryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [selectedSku, setSelectedSku] = useState<string | null>(null);
  const [records, setRecords] = useState<RecordRow[]>([]);
  const [recordsLoading, setRecordsLoading] = useState(false);

  useEffect(() => {
    if (!locationId) return;
    setLoading(true);
    fetch(`${API_URL}/api/v1/inventory/summary?locationId=${locationId}`)
      .then(r => r.json())
      .then(json => {
        if (json.error) { setError(json.error); return; }
        setSummary(json.data || []);
      })
      .catch(() => setError('Network error. Check your connection.'))
      .finally(() => setLoading(false));
  }, [locationId]);

  useEffect(() => {
    if (!locationId || !selectedSku) return;
    setRecordsLoading(true);
    fetch(`${API_URL}/api/v1/inventory?locationId=${locationId}&sku=${encodeURIComponent(selectedSku)}`)
      .then(r => r.json())
      .then(json => setRecords(json.error ? [] : (json.data || [])))
      .finally(() => setRecordsLoading(false));
  }, [locationId, selectedSku]);

  if (!locationId) {
    return (
      <Card className="flex flex-col items-center gap-3 p-8 text-center">
        <AlertTriangle className="h-10 w-10 text-muted-foreground" />
        <p className="text-base font-semibold">No site selected</p>
      </Card>
    );
  }

  if (selectedSku) {
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => setSelectedSku(null)}
          className="flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" /> Back to levels
        </button>
        <h2 className="text-lg font-bold tracking-tight">{selectedSku}</h2>

        {recordsLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : records.length === 0 ? (
          <Card className="p-6 text-center text-sm text-muted-foreground">No bin-level detail found.</Card>
        ) : (
          <div className="space-y-2">
            {records.map(r => (
              <Card key={r.id} className="p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold">{r.bin?.label ?? 'Unknown bin'}</div>
                    <div className="text-xs text-muted-foreground">
                      {r.bin?.zone?.name ?? ''}{r.lotNumber ? ` · Lot ${r.lotNumber}` : ''}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-base font-bold">{r.quantityOnHand} {r.uomCode}</div>
                    <div className="text-xs text-muted-foreground">{r.quantityAvailable} available</div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    );
  }

  const filtered = summary.filter(s => s.sku.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search SKU..."
          className="h-12 pl-9 text-base"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : error ? (
        <Card className="border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">{error}</Card>
      ) : filtered.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 p-8 text-center">
          <PackageSearch className="h-10 w-10 text-muted-foreground" />
          <p className="text-base font-semibold">No stock found</p>
          <p className="text-sm text-muted-foreground">
            {summary.length === 0 ? 'This site has no inventory on hand yet.' : 'No SKU matches your search.'}
          </p>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map(row => (
            <Button
              key={row.sku}
              variant="ghost"
              className="h-auto w-full justify-between p-0"
              onClick={() => setSelectedSku(row.sku)}
            >
              <Card className="flex w-full items-center justify-between p-3 active:bg-muted/50">
                <div className="text-left">
                  <div className="text-sm font-semibold">{row.sku}</div>
                  <div className="text-xs text-muted-foreground">{row.binCount} bin{row.binCount === 1 ? '' : 's'}</div>
                </div>
                <div className="text-right">
                  <div className="text-base font-bold">{row.totalOnHand} {row.uomCode}</div>
                  <div className="text-xs text-muted-foreground">{row.totalAvailable} available</div>
                </div>
              </Card>
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
