import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { CheckCircle2, CircleAlert, Eye, Info } from 'lucide-react';

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

const BIN_TYPES = [
  { value: 'pallet', label: 'Pallet' },
  { value: 'shelf', label: 'Shelf' },
  { value: 'floor', label: 'Floor' },
  { value: 'dock_door', label: 'Dock Door' },
  { value: 'staging', label: 'Staging' },
  { value: 'pack_station', label: 'Pack Station' },
];

const TEMP_ZONES = [
  { value: 'inherit', label: 'Inherit from zone' },
  { value: 'ambient', label: 'Ambient' },
  { value: 'refrigerated', label: 'Refrigerated' },
  { value: 'frozen', label: 'Frozen' },
];

interface PreviewResult {
  count: number;
  labels: string[];
  truncated: boolean;
}

export default function VNextWmsBulkBins() {
  const { zoneId } = useParams<{ zoneId: string }>();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    labelPattern: '{aisle}-{row}-{level}',
    binType: 'pallet',
    aisles: 'A,B,C',
    rowStart: '1',
    rowEnd: '10',
    levelStart: '1',
    levelEnd: '4',
    maxWeightKg: '',
    maxVolumeCbm: '',
    maxPalletPositions: '',
    temperatureZone: 'inherit',
    hazmatCertified: false,
  });

  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const getPayload = () => ({
    labelPattern: form.labelPattern,
    aisles: form.aisles.split(',').map(a => a.trim()).filter(Boolean),
    rowStart: parseInt(form.rowStart) || 1,
    rowEnd: parseInt(form.rowEnd) || 1,
    levelStart: parseInt(form.levelStart) || 1,
    levelEnd: parseInt(form.levelEnd) || 1,
  });

  const handlePreview = async () => {
    setError('');
    setPreview(null);

    try {
      const res = await fetch(`${API_URL}/api/v1/warehouse/bins/bulk/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(getPayload()),
      });
      const data = await res.json();
      if (data.error) setError(data.error);
      else setPreview(data.data);
    } catch {
      setError('Failed to generate preview');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSaving(true);

    try {
      const zoneRes = await fetch(`${API_URL}/api/v1/warehouse/zones/${zoneId}`);
      const zoneData = await zoneRes.json();
      if (zoneData.error || !zoneData.data) {
        setError('Could not find zone');
        setSaving(false);
        return;
      }

      const payload = {
        zoneId,
        locationId: zoneData.data.locationId,
        ...getPayload(),
        binType: form.binType,
        maxWeightKg: form.maxWeightKg ? parseFloat(form.maxWeightKg) : null,
        maxVolumeCbm: form.maxVolumeCbm ? parseFloat(form.maxVolumeCbm) : null,
        maxPalletPositions: form.maxPalletPositions ? parseInt(form.maxPalletPositions) : null,
        temperatureZone: form.temperatureZone === 'inherit' ? null : form.temperatureZone,
        hazmatCertified: form.hazmatCertified,
      };

      const res = await fetch(`${API_URL}/api/v1/warehouse/bins/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (data.error) {
        setError(data.error);
      } else {
        setSuccess(`Created ${data.data.count} bins successfully`);
        setTimeout(() => navigate(`/wms/zones/${zoneId}`), 1500);
      }
    } catch {
      setError('Failed to create bins');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Bulk Create Bins</h1>
        <p className="mt-1 text-sm text-muted-foreground">Generate bins from a label pattern with aisle/row/level ranges</p>
      </div>

      {error && (
        <div className="flex items-center gap-3 rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          <CircleAlert className="h-5 w-5" />
          {error}
        </div>
      )}
      {success && (
        <div className="flex items-center gap-3 rounded-md border border-success/30 bg-success/10 p-4 text-sm text-success">
          <CheckCircle2 className="h-5 w-5" />
          {success}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <form onSubmit={handleSubmit}>
          <Card>
            <CardHeader>
              <CardTitle>Configuration</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <Label>Label Pattern *</Label>
                <Input
                  value={form.labelPattern}
                  onChange={e => setForm({ ...form, labelPattern: e.target.value })}
                  placeholder="e.g. BULK-{aisle}-{row}-{level}"
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Use {'{aisle}'}, {'{row}'}, {'{level}'} as placeholders. Rows and levels are zero-padded.
                </p>
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

              <div className="space-y-2 md:col-span-2">
                <Label>Aisles (comma-separated) *</Label>
                <Input
                  value={form.aisles}
                  onChange={e => setForm({ ...form, aisles: e.target.value })}
                  placeholder="A,B,C"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>Row Start</Label>
                <Input type="number" min="1" value={form.rowStart} onChange={e => setForm({ ...form, rowStart: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Row End</Label>
                <Input type="number" min="1" value={form.rowEnd} onChange={e => setForm({ ...form, rowEnd: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Level Start</Label>
                <Input type="number" min="1" value={form.levelStart} onChange={e => setForm({ ...form, levelStart: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Level End</Label>
                <Input type="number" min="1" value={form.levelEnd} onChange={e => setForm({ ...form, levelEnd: e.target.value })} />
              </div>

              <div className="space-y-2">
                <Label>Max Weight (kg)</Label>
                <Input type="number" step="0.1" value={form.maxWeightKg} onChange={e => setForm({ ...form, maxWeightKg: e.target.value })} placeholder="Optional" />
              </div>
              <div className="space-y-2">
                <Label>Max Pallet Positions</Label>
                <Input type="number" min="1" value={form.maxPalletPositions} onChange={e => setForm({ ...form, maxPalletPositions: e.target.value })} placeholder="Optional" />
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

              <div className="flex flex-wrap items-center justify-end gap-2 md:col-span-2">
                <Button variant="outline" type="button" onClick={() => navigate(-1)}>
                  Cancel
                </Button>
                <Button variant="outline" type="button" onClick={handlePreview}>
                  <Eye className="h-4 w-4" />
                  Preview Labels
                </Button>
                <Button variant="gradient" type="submit" disabled={saving}>
                  {saving ? 'Creating...' : 'Create Bins'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </form>

        <Card>
          <CardHeader>
            <CardTitle>Preview</CardTitle>
          </CardHeader>
          <CardContent>
            {preview ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 rounded-md border border-info/30 bg-info/10 p-3 text-sm text-info">
                  <Info className="h-4 w-4" />
                  Will create <strong>{preview.count}</strong> bins
                </div>
                <div className="max-h-96 overflow-auto font-mono text-sm">
                  {preview.labels.map((label, i) => (
                    <div key={i} className="border-b border-border py-1">
                      {label}
                    </div>
                  ))}
                  {preview.truncated && (
                    <div className="py-2 italic text-muted-foreground">
                      ...and {preview.count - preview.labels.length} more
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 py-12 text-center text-muted-foreground">
                <Eye className="h-10 w-10" />
                <p className="text-sm">Click "Preview Labels" to see what will be generated</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
