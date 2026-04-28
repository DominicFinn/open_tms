import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CircleAlert, Loader2 } from 'lucide-react';

import { API_URL } from '../api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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
import { cn } from '@/lib/utils';

interface OrderOption {
  id: string;
  orderNumber: string;
  customerName: string;
  status: string;
  lineItemCount: number;
}

export default function VNextWmsCreateWave() {
  const navigate = useNavigate();
  const [locations, setLocations] = useState<Array<{ id: string; name: string }>>([]);
  const [orders, setOrders] = useState<OrderOption[]>([]);
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState<{ locationId: string; pickStrategy: string; cutoffAt: string; zonePickMode?: string }>({
    locationId: '',
    pickStrategy: 'discrete',
    cutoffAt: '',
  });

  useEffect(() => {
    fetch(`${API_URL}/api/v1/locations`)
      .then(r => r.json())
      .then(res => {
        const locs = (res.data || []).filter(
          (l: any) => !l.locationType || ['warehouse', 'distribution_centre', 'cross_dock'].includes(l.locationType)
        );
        setLocations(locs);
        if (locs.length === 1) setForm(f => ({ ...f, locationId: locs[0].id }));
      });
  }, []);

  useEffect(() => {
    setLoading(true);
    fetch(`${API_URL}/api/v1/orders`)
      .then(r => r.json())
      .then(res => {
        const eligible = (res.data || []).filter(
          (o: any) => o.status === 'accepted' || o.status === 'ready_to_pick' || o.status === 'processing'
        );
        setOrders(eligible.map((o: any) => ({
          id: o.id,
          orderNumber: o.orderNumber || o.id.slice(0, 8),
          customerName: o.customerName || o.customer?.name || '-',
          status: o.status,
          lineItemCount: o.lineItemCount ?? o._count?.lineItems ?? 0,
        })));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const toggleOrder = (id: string) => {
    const next = new Set(selectedOrders);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedOrders(next);
  };

  const selectAll = () => {
    if (selectedOrders.size === orders.length) setSelectedOrders(new Set());
    else setSelectedOrders(new Set(orders.map(o => o.id)));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedOrders.size === 0) { setError('Select at least one order'); return; }
    if (!form.locationId) { setError('Select a location'); return; }
    setError('');
    setSaving(true);

    try {
      const res = await fetch(`${API_URL}/api/v1/waves`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          locationId: form.locationId,
          pickStrategy: form.pickStrategy,
          orderIds: [...selectedOrders],
          cutoffAt: form.cutoffAt || null,
        }),
      });
      const data = await res.json();
      if (data.error) setError(data.error);
      else navigate(`/wms/waves/${data.data.id}`);
    } catch { setError('Failed to create wave'); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Create Wave</h1>
        <p className="mt-1 text-sm text-muted-foreground">Group orders into a pick wave for efficient fulfillment</p>
      </div>

      {error && (
        <div className="flex items-center gap-3 rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          <CircleAlert className="h-5 w-5" />
          {error}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <form onSubmit={handleSubmit}>
          <Card>
            <CardHeader>
              <CardTitle>Wave Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Location *</Label>
                <Select value={form.locationId} onValueChange={v => setForm({ ...form, locationId: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    {locations.map(l => (
                      <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Pick Strategy *</Label>
                <Select value={form.pickStrategy} onValueChange={v => setForm({ ...form, pickStrategy: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="discrete">Discrete (one picker per order)</SelectItem>
                    <SelectItem value="batch">Batch (combine all orders)</SelectItem>
                    <SelectItem value="zone">Zone (split by zone)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {form.pickStrategy === 'zone' && (
                <div className="space-y-2">
                  <Label>Zone Pick Mode *</Label>
                  <Select value={form.zonePickMode || 'parallel'} onValueChange={v => setForm({ ...form, zonePickMode: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="parallel">Parallel (all zones simultaneously)</SelectItem>
                      <SelectItem value="sequential">Sequential (pick-and-pass)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-2">
                <Label>Cutoff Time</Label>
                <Input type="datetime-local" value={form.cutoffAt} onChange={e => setForm({ ...form, cutoffAt: e.target.value })} />
              </div>

              <div className="rounded-md bg-muted p-3">
                <div className="text-xs text-muted-foreground">Selected Orders</div>
                <div className="text-2xl font-bold">{selectedOrders.size}</div>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2">
                <Button variant="outline" type="button" onClick={() => navigate('/wms/waves')}>Cancel</Button>
                <Button variant="gradient" type="submit" disabled={saving || selectedOrders.size === 0}>
                  {saving ? 'Creating...' : 'Create Wave'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </form>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Select Orders</CardTitle>
            <Button variant="outline" size="sm" onClick={selectAll}>
              {selectedOrders.size === orders.length ? 'Deselect All' : 'Select All'}
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex flex-col items-center gap-3 py-12 text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : orders.length === 0 ? (
              <div className="px-6 py-8 text-center text-sm text-muted-foreground">
                No eligible orders found. Orders must be in accepted/processing status.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10"></TableHead>
                    <TableHead>Order</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Lines</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map(o => (
                    <TableRow
                      key={o.id}
                      onClick={() => toggleOrder(o.id)}
                      className={cn('cursor-pointer', selectedOrders.has(o.id) && 'bg-muted')}
                    >
                      <TableCell>
                        <input
                          type="checkbox"
                          checked={selectedOrders.has(o.id)}
                          onChange={() => toggleOrder(o.id)}
                          className="h-4 w-4 rounded border border-input bg-background accent-primary"
                        />
                      </TableCell>
                      <TableCell className="font-mono text-sm font-semibold">{o.orderNumber}</TableCell>
                      <TableCell>{o.customerName}</TableCell>
                      <TableCell>
                        <Badge variant="info">{o.status}</Badge>
                      </TableCell>
                      <TableCell>{o.lineItemCount}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
