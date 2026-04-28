import { useState, useEffect } from 'react';
import {
  CheckCircle2,
  Edit,
  Loader2,
  Plus,
  Refrigerator,
  Save,
  Search,
  Snowflake,
  Thermometer,
  Droplets,
  XCircle,
} from 'lucide-react';

import { API_URL } from '../api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

interface ColdChainProfile {
  id: string;
  orgId: string;
  name: string;
  description: string | null;
  minTemperature: number;
  maxTemperature: number;
  alertMinTemperature: number;
  alertMaxTemperature: number;
  minHumidity: number | null;
  maxHumidity: number | null;
  alertMinHumidity: number | null;
  alertMaxHumidity: number | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

interface FormData {
  name: string;
  description: string;
  minTemperature: string;
  maxTemperature: string;
  alertMinTemperature: string;
  alertMaxTemperature: string;
  minHumidity: string;
  maxHumidity: string;
  alertMinHumidity: string;
  alertMaxHumidity: string;
  active: boolean;
}

const emptyForm: FormData = {
  name: '',
  description: '',
  minTemperature: '',
  maxTemperature: '',
  alertMinTemperature: '',
  alertMaxTemperature: '',
  minHumidity: '',
  maxHumidity: '',
  alertMinHumidity: '',
  alertMaxHumidity: '',
  active: true,
};

function profileToForm(p: ColdChainProfile): FormData {
  return {
    name: p.name,
    description: p.description || '',
    minTemperature: String(p.minTemperature),
    maxTemperature: String(p.maxTemperature),
    alertMinTemperature: String(p.alertMinTemperature),
    alertMaxTemperature: String(p.alertMaxTemperature),
    minHumidity: p.minHumidity != null ? String(p.minHumidity) : '',
    maxHumidity: p.maxHumidity != null ? String(p.maxHumidity) : '',
    alertMinHumidity: p.alertMinHumidity != null ? String(p.alertMinHumidity) : '',
    alertMaxHumidity: p.alertMaxHumidity != null ? String(p.alertMaxHumidity) : '',
    active: p.active,
  };
}

const STAT_TONES = {
  primary: 'bg-primary/10 text-primary',
  success: 'bg-success/15 text-success',
  info: 'bg-info/15 text-info',
  warning: 'bg-warning/15 text-warning',
} as const;

export default function VNextColdChainProfiles() {
  const [profiles, setProfiles] = useState<ColdChainProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const [showModal, setShowModal] = useState(false);
  const [editingProfile, setEditingProfile] = useState<ColdChainProfile | null>(null);
  const [form, setForm] = useState<FormData>({ ...emptyForm });
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadProfiles();
  }, []);

  async function loadProfiles() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/api/v1/cold-chain/profiles`);
      if (!res.ok) throw new Error('Failed to load cold chain profiles');
      const json = await res.json();
      setProfiles(json.data || []);
    } catch (e: any) {
      setError(e.message || 'Failed to load cold chain profiles');
    } finally {
      setLoading(false);
    }
  }

  function openCreate() {
    setEditingProfile(null);
    setForm({ ...emptyForm });
    setFormError('');
    setShowModal(true);
  }

  function openEdit(profile: ColdChainProfile) {
    setEditingProfile(profile);
    setForm(profileToForm(profile));
    setFormError('');
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditingProfile(null);
    setFormError('');
  }

  function validateForm(): string | null {
    if (!form.name.trim()) return 'Name is required.';
    if (form.minTemperature === '' || form.maxTemperature === '') return 'Min and Max Temperature are required.';
    if (form.alertMinTemperature === '' || form.alertMaxTemperature === '') return 'Alert Min and Alert Max Temperature are required.';

    const minTemp = Number(form.minTemperature);
    const maxTemp = Number(form.maxTemperature);
    const alertMin = Number(form.alertMinTemperature);
    const alertMax = Number(form.alertMaxTemperature);

    if (isNaN(minTemp) || isNaN(maxTemp)) return 'Temperature values must be valid numbers.';
    if (isNaN(alertMin) || isNaN(alertMax)) return 'Alert temperature values must be valid numbers.';
    if (minTemp > maxTemp) return 'Min Temperature must be less than or equal to Max Temperature.';
    if (alertMin > alertMax) return 'Alert Min Temperature must be less than or equal to Alert Max Temperature.';
    if (alertMin < minTemp) return 'Alert Min Temperature must be greater than or equal to Min Temperature.';
    if (alertMax > maxTemp) return 'Alert Max Temperature must be less than or equal to Max Temperature.';

    const hasHumidity = form.minHumidity !== '' || form.maxHumidity !== '' || form.alertMinHumidity !== '' || form.alertMaxHumidity !== '';
    if (hasHumidity) {
      const minH = form.minHumidity !== '' ? Number(form.minHumidity) : null;
      const maxH = form.maxHumidity !== '' ? Number(form.maxHumidity) : null;
      const alertMinH = form.alertMinHumidity !== '' ? Number(form.alertMinHumidity) : null;
      const alertMaxH = form.alertMaxHumidity !== '' ? Number(form.alertMaxHumidity) : null;

      if (minH != null && isNaN(minH)) return 'Min Humidity must be a valid number.';
      if (maxH != null && isNaN(maxH)) return 'Max Humidity must be a valid number.';
      if (alertMinH != null && isNaN(alertMinH)) return 'Alert Min Humidity must be a valid number.';
      if (alertMaxH != null && isNaN(alertMaxH)) return 'Alert Max Humidity must be a valid number.';
      if (minH != null && maxH != null && minH > maxH) return 'Min Humidity must be less than or equal to Max Humidity.';
      if (alertMinH != null && alertMaxH != null && alertMinH > alertMaxH) return 'Alert Min Humidity must be less than or equal to Alert Max Humidity.';
      if (alertMinH != null && minH != null && alertMinH < minH) return 'Alert Min Humidity must be greater than or equal to Min Humidity.';
      if (alertMaxH != null && maxH != null && alertMaxH > maxH) return 'Alert Max Humidity must be less than or equal to Max Humidity.';
    }

    return null;
  }

  async function handleSave() {
    const validationError = validateForm();
    if (validationError) {
      setFormError(validationError);
      return;
    }

    setSaving(true);
    setFormError('');

    const body = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      minTemperature: Number(form.minTemperature),
      maxTemperature: Number(form.maxTemperature),
      alertMinTemperature: Number(form.alertMinTemperature),
      alertMaxTemperature: Number(form.alertMaxTemperature),
      minHumidity: form.minHumidity !== '' ? Number(form.minHumidity) : null,
      maxHumidity: form.maxHumidity !== '' ? Number(form.maxHumidity) : null,
      alertMinHumidity: form.alertMinHumidity !== '' ? Number(form.alertMinHumidity) : null,
      alertMaxHumidity: form.alertMaxHumidity !== '' ? Number(form.alertMaxHumidity) : null,
      active: form.active,
    };

    try {
      const url = editingProfile
        ? `${API_URL}/api/v1/cold-chain/profiles/${editingProfile.id}`
        : `${API_URL}/api/v1/cold-chain/profiles`;
      const method = editingProfile ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || `Failed to ${editingProfile ? 'update' : 'create'} profile`);
      }

      closeModal();
      await loadProfiles();
    } catch (e: any) {
      setFormError(e.message || 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  }

  const filtered = profiles.filter(p => {
    if (statusFilter === 'active' && !p.active) return false;
    if (statusFilter === 'inactive' && p.active) return false;
    if (search) {
      return p.name.toLowerCase().includes(search.toLowerCase());
    }
    return true;
  });

  const totalCount = profiles.length;
  const activeCount = profiles.filter(p => p.active).length;
  const frozenCount = profiles.filter(p => p.minTemperature < -10).length;
  const refrigeratedCount = profiles.filter(p => p.minTemperature >= -10 && p.maxTemperature <= 15).length;

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-3 py-24 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const stats = [
    { tone: 'primary' as const, label: 'Total Profiles', value: totalCount, Icon: Thermometer },
    { tone: 'success' as const, label: 'Active Profiles', value: activeCount, Icon: CheckCircle2 },
    { tone: 'info' as const, label: 'Frozen Profiles', value: frozenCount, Icon: Snowflake },
    { tone: 'warning' as const, label: 'Refrigerated Profiles', value: refrigeratedCount, Icon: Refrigerator },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-3xl font-bold tracking-tight">Cold Chain Profiles</h1>
        <Button variant="gradient" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          New Profile
        </Button>
      </div>

      {error && (
        <div className="flex items-center gap-3 rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          <XCircle className="h-5 w-5" />
          {error}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map(stat => {
          const Icon = stat.Icon;
          return (
            <Card key={stat.label} className="p-5">
              <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg', STAT_TONES[stat.tone])}>
                <Icon className="h-5 w-5" />
              </div>
              <div className="mt-3 text-2xl font-bold tracking-tight">{stat.value}</div>
              <div className="mt-1 text-sm text-muted-foreground">{stat.label}</div>
            </Card>
          );
        })}
      </div>

      <Card>
        <div className="flex flex-wrap items-center gap-3 p-4">
          <div className="relative min-w-[260px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by name..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
            <Thermometer className="h-10 w-10" />
            <h3 className="text-base font-medium">No cold chain profiles found</h3>
            <p className="text-sm">Create a profile to define temperature and humidity requirements.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Temperature Range</TableHead>
                <TableHead>Alert Range</TableHead>
                <TableHead>Humidity Range</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(profile => (
                <TableRow key={profile.id}>
                  <TableCell>
                    <div className="font-semibold">{profile.name}</div>
                    {profile.description && (
                      <div className="mt-0.5 text-xs text-muted-foreground">{profile.description}</div>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {profile.minTemperature}&deg;C to {profile.maxTemperature}&deg;C
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {profile.alertMinTemperature}&deg;C to {profile.alertMaxTemperature}&deg;C
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {profile.minHumidity != null && profile.maxHumidity != null
                      ? `${profile.minHumidity}% to ${profile.maxHumidity}%`
                      : '-'}
                  </TableCell>
                  <TableCell>
                    <Badge variant={profile.active ? 'success' : 'muted'}>
                      {profile.active ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      title="Edit profile"
                      onClick={() => openEdit(profile)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <Dialog open={showModal} onOpenChange={open => !open && closeModal()}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingProfile ? 'Edit Profile' : 'New Profile'}</DialogTitle>
          </DialogHeader>
          {formError && (
            <div className="flex items-center gap-3 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              <XCircle className="h-4 w-4" />
              {formError}
            </div>
          )}

          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <Label>Name *</Label>
                <Input
                  placeholder="Profile name"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Description</Label>
                <textarea
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  rows={3}
                  placeholder="Optional description"
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-3 rounded-md border border-border bg-muted/20 p-4">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <Thermometer className="h-4 w-4" />
                Temperature Range (&deg;C)
              </h3>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Min Temperature *</Label>
                  <Input type="number" step="any" placeholder="-20" value={form.minTemperature} onChange={e => setForm(f => ({ ...f, minTemperature: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Max Temperature *</Label>
                  <Input type="number" step="any" placeholder="8" value={form.maxTemperature} onChange={e => setForm(f => ({ ...f, maxTemperature: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Alert Min Temperature *</Label>
                  <Input type="number" step="any" placeholder="-18" value={form.alertMinTemperature} onChange={e => setForm(f => ({ ...f, alertMinTemperature: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Alert Max Temperature *</Label>
                  <Input type="number" step="any" placeholder="6" value={form.alertMaxTemperature} onChange={e => setForm(f => ({ ...f, alertMaxTemperature: e.target.value }))} />
                </div>
              </div>
              <div className="text-xs text-muted-foreground">Alert range should be tighter than acceptable range</div>
            </div>

            <div className="space-y-3 rounded-md border border-border bg-muted/20 p-4">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <Droplets className="h-4 w-4" />
                Humidity Range (% RH)
              </h3>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Min Humidity</Label>
                  <Input type="number" step="any" placeholder="30" value={form.minHumidity} onChange={e => setForm(f => ({ ...f, minHumidity: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Max Humidity</Label>
                  <Input type="number" step="any" placeholder="70" value={form.maxHumidity} onChange={e => setForm(f => ({ ...f, maxHumidity: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Alert Min Humidity</Label>
                  <Input type="number" step="any" placeholder="35" value={form.alertMinHumidity} onChange={e => setForm(f => ({ ...f, alertMinHumidity: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Alert Max Humidity</Label>
                  <Input type="number" step="any" placeholder="65" value={form.alertMaxHumidity} onChange={e => setForm(f => ({ ...f, alertMaxHumidity: e.target.value }))} />
                </div>
              </div>
            </div>

            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.active}
                onChange={e => setForm(f => ({ ...f, active: e.target.checked }))}
                className="h-4 w-4 rounded border border-input bg-background accent-primary"
              />
              Active
            </label>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeModal} disabled={saving}>Cancel</Button>
            <Button variant="gradient" onClick={handleSave} disabled={saving}>
              <Save className="h-4 w-4" />
              {saving ? 'Saving...' : editingProfile ? 'Save Changes' : 'Create Profile'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
