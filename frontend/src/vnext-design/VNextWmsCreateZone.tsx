import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { ArrowLeft, ChevronRight, CircleAlert, Loader2, Save } from 'lucide-react';

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

const ZONE_TYPES = [
  { value: 'receiving', label: 'Receiving' },
  { value: 'bulk_storage', label: 'Bulk Storage' },
  { value: 'pick_face', label: 'Pick Face' },
  { value: 'staging', label: 'Staging' },
  { value: 'packing', label: 'Packing' },
  { value: 'shipping_dock', label: 'Shipping Dock' },
  { value: 'quarantine', label: 'Quarantine' },
  { value: 'returns', label: 'Returns' },
  { value: 'cross_dock', label: 'Cross Dock' },
];

const TEMP_ZONES = [
  { value: 'none', label: 'None' },
  { value: 'ambient', label: 'Ambient' },
  { value: 'refrigerated', label: 'Refrigerated' },
  { value: 'frozen', label: 'Frozen' },
];

interface LocationOption {
  id: string;
  name: string;
  locationType: string | null;
}

export default function VNextWmsCreateZone() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;

  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    locationId: '',
    name: '',
    zoneType: 'bulk_storage',
    temperatureZone: 'none',
    hazmatCertified: false,
    maxWeightKg: '',
    maxVolumeCbm: '',
    sortOrder: '0',
  });

  useEffect(() => {
    fetch(`${API_URL}/api/v1/locations`)
      .then(r => r.json())
      .then(res => {
        const warehouseLocations = (res.data || []).filter(
          (l: LocationOption) => !l.locationType || ['warehouse', 'distribution_centre', 'cross_dock'].includes(l.locationType)
        );
        setLocations(warehouseLocations);
        if (warehouseLocations.length === 1 && !isEdit) {
          setForm(f => ({ ...f, locationId: warehouseLocations[0].id }));
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!isEdit) return;
    setLoading(true);
    fetch(`${API_URL}/api/v1/warehouse/zones/${id}`)
      .then(r => r.json())
      .then(res => {
        if (res.data) {
          const z = res.data;
          setForm({
            locationId: z.locationId,
            name: z.name,
            zoneType: z.zoneType,
            temperatureZone: z.temperatureZone || 'none',
            hazmatCertified: z.hazmatCertified,
            maxWeightKg: z.maxWeightKg != null ? String(z.maxWeightKg) : '',
            maxVolumeCbm: z.maxVolumeCbm != null ? String(z.maxVolumeCbm) : '',
            sortOrder: String(z.sortOrder ?? 0),
          });
        }
      })
      .finally(() => setLoading(false));
  }, [id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);

    const payload: Record<string, unknown> = {
      locationId: form.locationId,
      name: form.name.trim(),
      zoneType: form.zoneType,
      temperatureZone: form.temperatureZone === 'none' ? null : form.temperatureZone,
      hazmatCertified: form.hazmatCertified,
      maxWeightKg: form.maxWeightKg ? parseFloat(form.maxWeightKg) : null,
      maxVolumeCbm: form.maxVolumeCbm ? parseFloat(form.maxVolumeCbm) : null,
      sortOrder: parseInt(form.sortOrder) || 0,
    };

    try {
      const url = isEdit
        ? `${API_URL}/api/v1/warehouse/zones/${id}`
        : `${API_URL}/api/v1/warehouse/zones`;
      const res = await fetch(url, {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        navigate('/wms/zones');
      }
    } catch (err) {
      setError('Failed to save zone');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-3 py-24 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link to="/wms/zones" className="hover:text-foreground">
          <ArrowLeft className="inline h-4 w-4" /> Zones
        </Link>
        <ChevronRight className="h-3 w-3" />
        <span>{isEdit ? 'Edit zone' : 'New zone'}</span>
      </div>

      <div>
        <h1 className="text-3xl font-bold tracking-tight">{isEdit ? 'Edit Zone' : 'Create Zone'}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {isEdit ? 'Update zone configuration' : 'Define a new warehouse zone'}
        </p>
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
            <div className="space-y-2 md:col-span-2">
              <Label>Location *</Label>
              <Select
                value={form.locationId}
                onValueChange={(v) => setForm({ ...form, locationId: v })}
                disabled={isEdit}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a warehouse location..." />
                </SelectTrigger>
                <SelectContent>
                  {locations.map(l => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.name}{l.locationType ? ` (${l.locationType})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Zone Name *</Label>
              <Input
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Bulk A, Dock 3, Cold Store"
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Zone Type *</Label>
              <Select value={form.zoneType} onValueChange={v => setForm({ ...form, zoneType: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ZONE_TYPES.map(t => (
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
              <Label>Sort Order</Label>
              <Input
                type="number"
                value={form.sortOrder}
                onChange={e => setForm({ ...form, sortOrder: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Max Weight (kg)</Label>
              <Input
                type="number"
                step="0.1"
                value={form.maxWeightKg}
                onChange={e => setForm({ ...form, maxWeightKg: e.target.value })}
                placeholder="Optional"
              />
            </div>

            <div className="space-y-2">
              <Label>Max Volume (cbm)</Label>
              <Input
                type="number"
                step="0.01"
                value={form.maxVolumeCbm}
                onChange={e => setForm({ ...form, maxVolumeCbm: e.target.value })}
                placeholder="Optional"
              />
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
          <Button variant="outline" type="button" onClick={() => navigate('/wms/zones')}>
            Cancel
          </Button>
          <Button variant="gradient" type="submit" disabled={saving}>
            <Save className="h-4 w-4" />
            {saving ? 'Saving...' : isEdit ? 'Update Zone' : 'Create Zone'}
          </Button>
        </div>
      </form>
    </div>
  );
}
