import React, { useState, useEffect } from 'react';
import { CheckCircle2, CircleAlert, Info, Loader2, Plus, RefreshCw, RotateCw } from 'lucide-react';

import { API_URL } from '../api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface ReplenishmentRule {
  id: string;
  sku: string;
  pickFaceBinId: string;
  bulkZoneId: string;
  minQuantity: number;
  maxQuantity: number;
  active: boolean;
}

export default function VNextWmsReplenishment() {
  const [rules, setRules] = useState<ReplenishmentRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLocation, setSelectedLocation] = useState('');
  const [locations, setLocations] = useState<Array<{ id: string; name: string }>>([]);
  const [bins, setBins] = useState<Array<{ id: string; label: string; binType: string }>>([]);
  const [zones, setZones] = useState<Array<{ id: string; name: string }>>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ sku: '', pickFaceBinId: '', bulkZoneId: '', minQuantity: '5', maxQuantity: '20' });
  const [creating, setCreating] = useState(false);
  const [checking, setChecking] = useState(false);
  const [checkResult, setCheckResult] = useState<any>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`${API_URL}/api/v1/locations`).then(r => r.json()).then(res => {
      const locs = (res.data || []).filter((l: any) => !l.locationType || ['warehouse', 'distribution_centre', 'cross_dock'].includes(l.locationType));
      setLocations(locs);
      if (locs.length > 0) setSelectedLocation(locs[0].id);
      else setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const loadData = () => {
    if (!selectedLocation) return;
    setLoading(true);
    Promise.all([
      fetch(`${API_URL}/api/v1/replenishment/rules?locationId=${selectedLocation}`).then(r => r.json()).then(res => setRules(res.data || [])),
      fetch(`${API_URL}/api/v1/warehouse/bins?locationId=${selectedLocation}`).then(r => r.json()).then(res => setBins((res.data || []).filter((b: any) => b.active))),
      fetch(`${API_URL}/api/v1/warehouse/zones?locationId=${selectedLocation}`).then(r => r.json()).then(res => setZones((res.data || []).map((z: any) => ({ id: z.id, name: z.name })))),
    ]).finally(() => setLoading(false));
  };

  useEffect(() => { loadData(); }, [selectedLocation]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setCreating(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/replenishment/rules`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          locationId: selectedLocation,
          sku: createForm.sku.trim(),
          pickFaceBinId: createForm.pickFaceBinId,
          bulkZoneId: createForm.bulkZoneId,
          minQuantity: parseInt(createForm.minQuantity),
          maxQuantity: parseInt(createForm.maxQuantity),
        }),
      });
      const data = await res.json();
      if (data.error) setError(data.error);
      else { setShowCreate(false); loadData(); }
    } catch { setError('Failed to create'); }
    finally { setCreating(false); }
  };

  const handleCheck = async () => {
    setError('');
    setChecking(true);
    setCheckResult(null);
    try {
      const res = await fetch(`${API_URL}/api/v1/replenishment/check`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locationId: selectedLocation }),
      });
      const data = await res.json();
      if (data.error) setError(data.error);
      else setCheckResult(data.data);
    } catch { setError('Failed to check'); }
    finally { setChecking(false); }
  };

  const handleToggle = async (id: string, active: boolean) => {
    await fetch(`${API_URL}/api/v1/replenishment/rules/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !active }),
    });
    loadData();
  };

  const handleDelete = async (id: string) => {
    await fetch(`${API_URL}/api/v1/replenishment/rules/${id}`, { method: 'DELETE' });
    loadData();
  };

  const pickFaceBins = bins.filter(b => b.binType === 'shelf' || b.binType === 'pallet' || b.binType === 'floor');

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Replenishment</h1>
          <p className="mt-1 text-sm text-muted-foreground">Auto-replenish pick faces from bulk storage when stock drops below minimum</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleCheck} disabled={checking}>
            <RefreshCw className={`h-4 w-4 ${checking ? 'animate-spin' : ''}`} />
            {checking ? 'Checking...' : 'Run Check'}
          </Button>
          <Button variant="gradient" onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4" />
            Add Rule
          </Button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-3 rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          <CircleAlert className="h-5 w-5" />
          {error}
        </div>
      )}

      {checkResult && (
        <div className={`flex items-center gap-3 rounded-md border p-4 text-sm ${checkResult.tasksCreated > 0 ? 'border-success/30 bg-success/10 text-success' : 'border-info/30 bg-info/10 text-info'}`}>
          {checkResult.tasksCreated > 0 ? <CheckCircle2 className="h-5 w-5" /> : <Info className="h-5 w-5" />}
          {checkResult.tasksCreated > 0
            ? `Created ${checkResult.tasksCreated} replenishment task(s): ${checkResult.details.map((d: any) => `${d.sku} to ${d.pickFaceBin} (qty ${d.quantity})`).join(', ')}`
            : 'All pick faces are above minimum levels. No replenishment needed.'}
        </div>
      )}

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Replenishment Rule</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-2">
              <Label>SKU *</Label>
              <Input value={createForm.sku} onChange={e => setCreateForm({ ...createForm, sku: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label>Pick Face Bin *</Label>
              <Select value={createForm.pickFaceBinId} onValueChange={v => setCreateForm({ ...createForm, pickFaceBinId: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select bin..." />
                </SelectTrigger>
                <SelectContent>
                  {pickFaceBins.map(b => (
                    <SelectItem key={b.id} value={b.id}>{b.label} ({b.binType})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Bulk Zone (pull from) *</Label>
              <Select value={createForm.bulkZoneId} onValueChange={v => setCreateForm({ ...createForm, bulkZoneId: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select zone..." />
                </SelectTrigger>
                <SelectContent>
                  {zones.map(z => (
                    <SelectItem key={z.id} value={z.id}>{z.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Min Qty (trigger) *</Label>
                <Input type="number" min="1" value={createForm.minQuantity} onChange={e => setCreateForm({ ...createForm, minQuantity: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label>Max Qty (replenish to) *</Label>
                <Input type="number" min="1" value={createForm.maxQuantity} onChange={e => setCreateForm({ ...createForm, maxQuantity: e.target.value })} required />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" type="button" onClick={() => setShowCreate(false)}>Cancel</Button>
              <Button variant="gradient" type="submit" disabled={creating}>{creating ? 'Creating...' : 'Create Rule'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <div className="flex flex-wrap items-center gap-2">
        <Select value={selectedLocation} onValueChange={setSelectedLocation}>
          <SelectTrigger className="w-[260px]">
            <SelectValue placeholder="Select location" />
          </SelectTrigger>
          <SelectContent>
            {locations.map(l => (
              <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex flex-col items-center gap-3 py-24 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : rules.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <RotateCw className="h-12 w-12 text-muted-foreground" />
            <h3 className="text-base font-medium">No replenishment rules</h3>
            <p className="text-sm text-muted-foreground">Set up rules to auto-replenish pick faces when stock drops below a threshold.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SKU</TableHead>
                <TableHead>Pick Face Bin</TableHead>
                <TableHead>Bulk Zone</TableHead>
                <TableHead>Min Qty</TableHead>
                <TableHead>Max Qty</TableHead>
                <TableHead>Active</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules.map(r => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-sm font-semibold">{r.sku}</TableCell>
                  <TableCell>{bins.find(b => b.id === r.pickFaceBinId)?.label ?? r.pickFaceBinId.slice(0, 8)}</TableCell>
                  <TableCell>{zones.find(z => z.id === r.bulkZoneId)?.name ?? r.bulkZoneId.slice(0, 8)}</TableCell>
                  <TableCell>{r.minQuantity}</TableCell>
                  <TableCell>{r.maxQuantity}</TableCell>
                  <TableCell>
                    <button type="button" onClick={() => handleToggle(r.id, r.active)}>
                      <Badge variant={r.active ? 'success' : 'muted'} className="cursor-pointer">
                        {r.active ? 'Active' : 'Inactive'}
                      </Badge>
                    </button>
                  </TableCell>
                  <TableCell>
                    <Button variant="outline" size="sm" className="text-destructive" onClick={() => handleDelete(r.id)}>Delete</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
