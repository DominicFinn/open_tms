import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CircleAlert, Plus, X } from 'lucide-react';

import { API_URL } from '../api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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

interface LocationOption { id: string; name: string; }
interface BinOption { id: string; label: string; binType: string; }

export default function VNextWmsCreateReceiving() {
  const navigate = useNavigate();
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [dockBins, setDockBins] = useState<BinOption[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    locationId: '',
    receivingType: 'blind' as 'asn' | 'blind',
    dockBinId: 'none',
    crossDock: false,
    inboundShipmentId: '',
    carrierName: '',
    trailerNumber: '',
    sealNumber: '',
  });

  const [lines, setLines] = useState<Array<{ sku: string; expectedQuantity: string; lotNumber: string }>>([]);

  useEffect(() => {
    fetch(`${API_URL}/api/v1/locations`)
      .then(r => r.json())
      .then(res => {
        const locs = (res.data || []).filter(
          (l: any) => !l.locationType || ['warehouse', 'distribution_centre', 'cross_dock'].includes(l.locationType)
        );
        setLocations(locs);
        if (locs.length === 1) setForm(f => ({ ...f, locationId: locs[0].id }));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!form.locationId) { setDockBins([]); return; }
    fetch(`${API_URL}/api/v1/warehouse/bins?locationId=${form.locationId}`)
      .then(r => r.json())
      .then(res => {
        const docks = (res.data || []).filter((b: any) => b.binType === 'dock_door');
        setDockBins(docks);
      })
      .catch(() => {});
  }, [form.locationId]);

  const addLine = () => {
    setLines([...lines, { sku: '', expectedQuantity: '1', lotNumber: '' }]);
  };

  const removeLine = (i: number) => {
    setLines(lines.filter((_, idx) => idx !== i));
  };

  const updateLine = (i: number, field: string, value: string) => {
    setLines(lines.map((l, idx) => idx === i ? { ...l, [field]: value } : l));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);

    const payload: Record<string, unknown> = {
      locationId: form.locationId,
      receivingType: form.receivingType,
      dockBinId: form.dockBinId === 'none' ? null : form.dockBinId,
      crossDock: form.crossDock,
      inboundShipmentId: form.inboundShipmentId || null,
    };

    if (form.receivingType === 'asn' && lines.length > 0) {
      payload.expectedLines = lines
        .filter(l => l.sku.trim())
        .map(l => ({
          sku: l.sku.trim(),
          expectedQuantity: parseInt(l.expectedQuantity) || 1,
          lotNumber: l.lotNumber || null,
        }));
    }

    try {
      const res = await fetch(`${API_URL}/api/v1/receiving/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        navigate(`/wms/receiving/${data.data.id}`);
      }
    } catch {
      setError('Failed to create receiving task');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">New Receiving Task</h1>
        <p className="mt-1 text-sm text-muted-foreground">Receive inbound goods at a warehouse dock</p>
      </div>

      {error && (
        <div className="flex items-center gap-3 rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          <CircleAlert className="h-5 w-5" />
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <Card className="max-w-4xl">
          <CardContent className="grid gap-4 p-6 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Location *</Label>
              <Select value={form.locationId} onValueChange={v => setForm({ ...form, locationId: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select warehouse..." />
                </SelectTrigger>
                <SelectContent>
                  {locations.map(l => (
                    <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Receiving Type *</Label>
              <Select value={form.receivingType} onValueChange={v => setForm({ ...form, receivingType: v as 'asn' | 'blind' })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="blind">Blind Receiving</SelectItem>
                  <SelectItem value="asn">ASN-Based (Expected Items)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Dock Door</Label>
              <Select value={form.dockBinId} onValueChange={v => setForm({ ...form, dockBinId: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No dock assigned</SelectItem>
                  {dockBins.map(b => (
                    <SelectItem key={b.id} value={b.id}>{b.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Inbound Shipment ID</Label>
              <Input value={form.inboundShipmentId} onChange={e => setForm({ ...form, inboundShipmentId: e.target.value })} placeholder="Optional" />
            </div>

            <div className="space-y-2">
              <Label>Carrier Name</Label>
              <Input value={form.carrierName} onChange={e => setForm({ ...form, carrierName: e.target.value })} placeholder="Optional" />
            </div>

            <div className="space-y-2">
              <Label>Trailer #</Label>
              <Input value={form.trailerNumber} onChange={e => setForm({ ...form, trailerNumber: e.target.value })} placeholder="Optional" />
            </div>

            <div className="md:col-span-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.crossDock}
                  onChange={e => setForm({ ...form, crossDock: e.target.checked })}
                  className="h-4 w-4 rounded border border-input bg-background accent-primary"
                />
                Cross-Dock (skip putaway to storage)
              </label>
            </div>
          </CardContent>
        </Card>

        {form.receivingType === 'asn' && (
          <Card className="mt-6 max-w-4xl">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Expected Items</CardTitle>
              <Button type="button" variant="outline" size="sm" onClick={addLine}>
                <Plus className="h-4 w-4" />
                Add Line
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              {lines.length === 0 ? (
                <p className="px-6 py-4 text-sm text-muted-foreground">
                  No expected items. Add lines to pre-populate what you expect to receive.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>SKU</TableHead>
                      <TableHead>Expected Qty</TableHead>
                      <TableHead>Lot #</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lines.map((line, i) => (
                      <TableRow key={i}>
                        <TableCell>
                          <Input value={line.sku} onChange={e => updateLine(i, 'sku', e.target.value)} placeholder="SKU" />
                        </TableCell>
                        <TableCell>
                          <Input type="number" min="1" value={line.expectedQuantity} onChange={e => updateLine(i, 'expectedQuantity', e.target.value)} className="w-24" />
                        </TableCell>
                        <TableCell>
                          <Input value={line.lotNumber} onChange={e => updateLine(i, 'lotNumber', e.target.value)} placeholder="Optional" />
                        </TableCell>
                        <TableCell>
                          <Button type="button" variant="ghost" size="icon" onClick={() => removeLine(i)}>
                            <X className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        )}

        <div className="mt-6 flex flex-wrap items-center justify-end gap-2">
          <Button variant="outline" type="button" onClick={() => navigate('/wms/receiving')}>Cancel</Button>
          <Button variant="gradient" type="submit" disabled={saving}>
            {saving ? 'Creating...' : 'Create Task'}
          </Button>
        </div>
      </form>
    </div>
  );
}
