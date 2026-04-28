import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CircleAlert } from 'lucide-react';

import { API_URL } from '../api';
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

const BIN_TYPES = [
  { value: 'pallet', label: 'Pallet' }, { value: 'shelf', label: 'Shelf' },
  { value: 'floor', label: 'Floor' }, { value: 'dock_door', label: 'Dock Door' },
  { value: 'staging', label: 'Staging' }, { value: 'pack_station', label: 'Pack Station' },
];
const TEMP_ZONES = [
  { value: 'inherit', label: 'Inherit from zone' }, { value: 'ambient', label: 'Ambient' },
  { value: 'refrigerated', label: 'Refrigerated' }, { value: 'frozen', label: 'Frozen' },
];

export default function VNextWmsCreateBin() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const presetZone = searchParams.get('zoneId') || '';
  const presetLocation = searchParams.get('locationId') || '';

  const [zones, setZones] = useState<Array<{ id: string; name: string; locationId: string }>>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    zoneId: presetZone,
    locationId: presetLocation,
    label: '',
    binType: 'pallet',
    temperatureZone: 'inherit',
    hazmatCertified: false,
    level: '',
    walkSequence: '0',
    maxWeightKg: '',
    maxVolumeCbm: '',
    maxPalletPositions: '',
  });

  useEffect(() => {
    if (!presetLocation) return;
    fetch(`${API_URL}/api/v1/warehouse/zones?locationId=${presetLocation}`)
      .then(r => r.json())
      .then(res => setZones(res.data || []))
      .catch(() => {});
  }, [presetLocation]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/warehouse/bins`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          zoneId: form.zoneId,
          locationId: form.locationId,
          label: form.label.trim(),
          binType: form.binType,
          temperatureZone: form.temperatureZone === 'inherit' ? null : form.temperatureZone,
          hazmatCertified: form.hazmatCertified,
          level: form.level ? parseInt(form.level) : null,
          walkSequence: parseInt(form.walkSequence) || 0,
          maxWeightKg: form.maxWeightKg ? parseFloat(form.maxWeightKg) : null,
          maxVolumeCbm: form.maxVolumeCbm ? parseFloat(form.maxVolumeCbm) : null,
          maxPalletPositions: form.maxPalletPositions ? parseInt(form.maxPalletPositions) : null,
        }),
      });
      const data = await res.json();
      if (data.error) setError(data.error);
      else navigate(`/wms/zones/${form.zoneId}`);
    } catch { setError('Failed to create bin'); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Create Bin</h1>
        <p className="mt-1 text-sm text-muted-foreground">Add a single storage location</p>
      </div>

      {error && (
        <div className="flex items-center gap-3 rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          <CircleAlert className="h-5 w-5" />
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <Card className="max-w-3xl">
          <CardContent className="grid gap-4 p-6 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Zone *</Label>
              <Select value={form.zoneId} onValueChange={v => setForm({ ...form, zoneId: v })}>
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

            <div className="space-y-2">
              <Label>Label *</Label>
              <Input
                value={form.label}
                onChange={e => setForm({ ...form, label: e.target.value })}
                placeholder="e.g. BULK-A-01-01"
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Bin Type *</Label>
              <Select value={form.binType} onValueChange={v => setForm({ ...form, binType: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BIN_TYPES.map(t => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Temperature Zone</Label>
              <Select value={form.temperatureZone} onValueChange={v => setForm({ ...form, temperatureZone: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TEMP_ZONES.map(t => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Level</Label>
              <Input type="number" value={form.level} onChange={e => setForm({ ...form, level: e.target.value })} placeholder="Vertical position" />
            </div>
            <div className="space-y-2">
              <Label>Walk Sequence</Label>
              <Input type="number" value={form.walkSequence} onChange={e => setForm({ ...form, walkSequence: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Max Weight (kg)</Label>
              <Input type="number" step="0.1" value={form.maxWeightKg} onChange={e => setForm({ ...form, maxWeightKg: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Max Pallet Positions</Label>
              <Input type="number" value={form.maxPalletPositions} onChange={e => setForm({ ...form, maxPalletPositions: e.target.value })} />
            </div>

            <div className="md:col-span-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.hazmatCertified}
                  onChange={e => setForm({ ...form, hazmatCertified: e.target.checked })}
                  className="h-4 w-4 rounded border border-input bg-background accent-primary"
                />
                Hazmat Certified
              </label>
            </div>
          </CardContent>
        </Card>

        <div className="mt-6 flex flex-wrap items-center justify-end gap-2">
          <Button variant="outline" type="button" onClick={() => navigate(-1)}>Cancel</Button>
          <Button variant="gradient" type="submit" disabled={saving}>{saving ? 'Creating...' : 'Create Bin'}</Button>
        </div>
      </form>
    </div>
  );
}
