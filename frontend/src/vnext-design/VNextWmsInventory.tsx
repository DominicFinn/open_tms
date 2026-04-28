import React, { useState, useEffect } from 'react';
import { Boxes, CircleAlert, Loader2 } from 'lucide-react';

import { API_URL } from '../api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

interface InventoryRecord {
  id: string;
  sku: string;
  uomCode: string;
  quantityOnHand: number;
  quantityAllocated: number;
  quantityAvailable: number;
  quantityOnHold: number;
  lotNumber: string | null;
  expiryDate: string | null;
  lastCountedAt: string | null;
  bin: { id: string; label: string; binType: string; zone: { id: string; name: string; zoneType: string } };
  ownerCustomer: { id: string; name: string } | null;
}

interface SkuSummary {
  sku: string;
  uomCode: string;
  totalOnHand: number;
  totalAllocated: number;
  totalAvailable: number;
  totalOnHold: number;
  binCount: number;
}

const REASON_CODES = ['damage', 'expired', 'recount', 'scrap', 'found', 'return', 'other'];

export default function VNextWmsInventory() {
  const [records, setRecords] = useState<InventoryRecord[]>([]);
  const [summary, setSummary] = useState<SkuSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [view, setView] = useState<'detail' | 'summary'>('detail');

  const [selectedLocation, setSelectedLocation] = useState('');
  const [locations, setLocations] = useState<Array<{ id: string; name: string }>>([]);

  const [adjustRecord, setAdjustRecord] = useState<InventoryRecord | null>(null);
  const [adjustForm, setAdjustForm] = useState({ quantityChange: '', reasonCode: 'recount' });
  const [adjusting, setAdjusting] = useState(false);
  const [adjustError, setAdjustError] = useState('');

  const [transferRecord, setTransferRecord] = useState<InventoryRecord | null>(null);
  const [transferForm, setTransferForm] = useState({ targetBinId: '', quantity: '' });
  const [transferring, setTransferring] = useState(false);
  const [transferError, setTransferError] = useState('');
  const [bins, setBins] = useState<Array<{ id: string; label: string }>>([]);

  useEffect(() => {
    fetch(`${API_URL}/api/v1/locations`)
      .then(r => r.json())
      .then(res => {
        const locs = (res.data || []).filter(
          (l: any) => !l.locationType || ['warehouse', 'distribution_centre', 'cross_dock'].includes(l.locationType)
        );
        setLocations(locs);
        if (locs.length > 0) setSelectedLocation(locs[0].id);
        else setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const loadData = () => {
    if (!selectedLocation) return;
    setLoading(true);
    const detailP = fetch(`${API_URL}/api/v1/inventory?locationId=${selectedLocation}&hasStock=true`)
      .then(r => r.json())
      .then(res => setRecords(res.data || []));
    const summaryP = fetch(`${API_URL}/api/v1/inventory/summary?locationId=${selectedLocation}`)
      .then(r => r.json())
      .then(res => setSummary(res.data || []));
    Promise.all([detailP, summaryP]).finally(() => setLoading(false));
  };

  useEffect(() => { loadData(); }, [selectedLocation]);

  useEffect(() => {
    if (!selectedLocation) return;
    fetch(`${API_URL}/api/v1/warehouse/bins?locationId=${selectedLocation}`)
      .then(r => r.json())
      .then(res => setBins((res.data || []).filter((b: any) => b.active)));
  }, [selectedLocation]);

  const handleAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustRecord) return;
    setAdjustError('');
    setAdjusting(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/inventory/${adjustRecord.id}/adjust`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quantityChange: parseInt(adjustForm.quantityChange),
          reasonCode: adjustForm.reasonCode,
        }),
      });
      const data = await res.json();
      if (data.error) { setAdjustError(data.error); }
      else { setAdjustRecord(null); loadData(); }
    } catch { setAdjustError('Failed to adjust'); }
    finally { setAdjusting(false); }
  };

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferRecord) return;
    setTransferError('');
    setTransferring(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/inventory/${transferRecord.id}/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetBinId: transferForm.targetBinId,
          quantity: parseInt(transferForm.quantity),
        }),
      });
      const data = await res.json();
      if (data.error) { setTransferError(data.error); }
      else { setTransferRecord(null); loadData(); }
    } catch { setTransferError('Failed to transfer'); }
    finally { setTransferring(false); }
  };

  const filtered = records.filter(r =>
    r.sku.toLowerCase().includes(search.toLowerCase()) ||
    r.bin.label.toLowerCase().includes(search.toLowerCase())
  );

  const filteredSummary = summary.filter(s =>
    s.sku.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Inventory</h1>
        <p className="mt-1 text-sm text-muted-foreground">Real-time stock levels across all warehouse bins</p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs value={view} onValueChange={(v) => setView(v as 'detail' | 'summary')}>
          <TabsList>
            <TabsTrigger value="detail">By Bin</TabsTrigger>
            <TabsTrigger value="summary">By SKU</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={selectedLocation} onValueChange={setSelectedLocation}>
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="Select location" />
            </SelectTrigger>
            <SelectContent>
              {locations.map(l => (
                <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            placeholder="Search SKU or bin..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-[260px]"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center gap-3 py-24 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : view === 'summary' ? (
        filteredSummary.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
              <Boxes className="h-12 w-12 text-muted-foreground" />
              <h3 className="text-base font-medium">No inventory</h3>
              <p className="text-sm text-muted-foreground">Stock appears here after goods are received and put away.</p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SKU</TableHead>
                  <TableHead>UOM</TableHead>
                  <TableHead>On Hand</TableHead>
                  <TableHead>Allocated</TableHead>
                  <TableHead>Available</TableHead>
                  <TableHead>On Hold</TableHead>
                  <TableHead>Bins</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSummary.map(s => (
                  <TableRow key={`${s.sku}-${s.uomCode}`}>
                    <TableCell className="font-mono text-sm font-semibold">{s.sku}</TableCell>
                    <TableCell>{s.uomCode}</TableCell>
                    <TableCell>{s.totalOnHand}</TableCell>
                    <TableCell>{s.totalAllocated}</TableCell>
                    <TableCell className={cn('font-semibold', s.totalAvailable > 0 ? 'text-success' : 'text-destructive')}>
                      {s.totalAvailable}
                    </TableCell>
                    <TableCell>{s.totalOnHold > 0 ? <span className="text-warning">{s.totalOnHold}</span> : 0}</TableCell>
                    <TableCell>{s.binCount}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )
      ) : (
        filtered.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
              <Boxes className="h-12 w-12 text-muted-foreground" />
              <h3 className="text-base font-medium">No inventory records</h3>
              <p className="text-sm text-muted-foreground">Stock appears here after goods are received and put away.</p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SKU</TableHead>
                  <TableHead>Bin</TableHead>
                  <TableHead>Zone</TableHead>
                  <TableHead>UOM</TableHead>
                  <TableHead>On Hand</TableHead>
                  <TableHead>Allocated</TableHead>
                  <TableHead>Available</TableHead>
                  <TableHead>On Hold</TableHead>
                  <TableHead>Lot</TableHead>
                  <TableHead>Expiry</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(r => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-sm font-semibold">{r.sku}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{r.bin.label}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{r.bin.zone.name}</TableCell>
                    <TableCell>{r.uomCode}</TableCell>
                    <TableCell>{r.quantityOnHand}</TableCell>
                    <TableCell>{r.quantityAllocated}</TableCell>
                    <TableCell className={cn('font-semibold', r.quantityAvailable > 0 ? 'text-success' : 'text-destructive')}>
                      {r.quantityAvailable}
                    </TableCell>
                    <TableCell>{r.quantityOnHold > 0 ? <span className="text-warning">{r.quantityOnHold}</span> : 0}</TableCell>
                    <TableCell>{r.lotNumber || '-'}</TableCell>
                    <TableCell>{r.expiryDate ? new Date(r.expiryDate).toLocaleDateString() : '-'}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => { setAdjustRecord(r); setAdjustForm({ quantityChange: '', reasonCode: 'recount' }); setAdjustError(''); }}
                        >
                          Adjust
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => { setTransferRecord(r); setTransferForm({ targetBinId: '', quantity: String(r.quantityAvailable) }); setTransferError(''); }}
                        >
                          Transfer
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )
      )}

      <Dialog open={!!adjustRecord} onOpenChange={(o) => !o && setAdjustRecord(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adjust Stock</DialogTitle>
          </DialogHeader>
          {adjustRecord && (
            <form onSubmit={handleAdjust} className="space-y-4">
              {adjustError && (
                <div className="flex items-center gap-3 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                  <CircleAlert className="h-4 w-4" />
                  {adjustError}
                </div>
              )}
              <p className="text-sm text-muted-foreground">
                <strong>{adjustRecord.sku}</strong> at <strong>{adjustRecord.bin.label}</strong> - current: {adjustRecord.quantityOnHand}
              </p>
              <div className="space-y-2">
                <Label>Quantity Change *</Label>
                <Input
                  type="number"
                  value={adjustForm.quantityChange}
                  onChange={e => setAdjustForm({ ...adjustForm, quantityChange: e.target.value })}
                  placeholder="e.g. -5 to remove, +3 to add"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Reason *</Label>
                <Select value={adjustForm.reasonCode} onValueChange={v => setAdjustForm({ ...adjustForm, reasonCode: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {REASON_CODES.map(r => (
                      <SelectItem key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button variant="outline" type="button" onClick={() => setAdjustRecord(null)}>Cancel</Button>
                <Button variant="gradient" type="submit" disabled={adjusting}>{adjusting ? 'Saving...' : 'Apply Adjustment'}</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!transferRecord} onOpenChange={(o) => !o && setTransferRecord(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Transfer Stock</DialogTitle>
          </DialogHeader>
          {transferRecord && (
            <form onSubmit={handleTransfer} className="space-y-4">
              {transferError && (
                <div className="flex items-center gap-3 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                  <CircleAlert className="h-4 w-4" />
                  {transferError}
                </div>
              )}
              <p className="text-sm text-muted-foreground">
                <strong>{transferRecord.sku}</strong> from <strong>{transferRecord.bin.label}</strong> - available: {transferRecord.quantityAvailable}
              </p>
              <div className="space-y-2">
                <Label>Target Bin *</Label>
                <Select value={transferForm.targetBinId} onValueChange={v => setTransferForm({ ...transferForm, targetBinId: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select bin..." />
                  </SelectTrigger>
                  <SelectContent>
                    {bins.filter(b => b.id !== transferRecord.bin.id).map(b => (
                      <SelectItem key={b.id} value={b.id}>{b.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Quantity *</Label>
                <Input
                  type="number"
                  min="1"
                  max={transferRecord.quantityAvailable}
                  value={transferForm.quantity}
                  onChange={e => setTransferForm({ ...transferForm, quantity: e.target.value })}
                  required
                />
              </div>
              <DialogFooter>
                <Button variant="outline" type="button" onClick={() => setTransferRecord(null)}>Cancel</Button>
                <Button variant="gradient" type="submit" disabled={transferring}>{transferring ? 'Transferring...' : 'Transfer'}</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
