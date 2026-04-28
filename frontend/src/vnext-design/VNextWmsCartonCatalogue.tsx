import React, { useState, useEffect } from 'react';
import { Archive, ArchiveRestore, CircleAlert, Edit, Info, Loader2, Package, Plus, Trash2 } from 'lucide-react';

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
import { cn } from '@/lib/utils';

interface Carton {
  id: string; name: string;
  lengthMm: number; widthMm: number; heightMm: number;
  maxWeightGrams: number; unitCostCents: number | null; active: boolean;
  temperatureZone: string; insulated: boolean; insulationHours: number | null;
  tamperEvident: boolean; valueClass: string;
  hazmatRated: boolean; hazmatClasses: string[];
  materialType: string;
}

type FormState = {
  name: string;
  lengthMm: string;
  widthMm: string;
  heightMm: string;
  maxWeightGrams: string;
  unitCostCents: string;
  temperatureZone: string;
  insulated: boolean;
  insulationHours: string;
  tamperEvident: boolean;
  valueClass: string;
  hazmatRated: boolean;
  hazmatClasses: string;
  materialType: string;
};

const emptyForm: FormState = {
  name: '', lengthMm: '', widthMm: '', heightMm: '', maxWeightGrams: '', unitCostCents: '',
  temperatureZone: 'any', insulated: false, insulationHours: '',
  tamperEvident: false, valueClass: 'any',
  hazmatRated: false, hazmatClasses: '',
  materialType: 'corrugated',
};

function cartonToForm(c: Carton): FormState {
  return {
    name: c.name,
    lengthMm: String(c.lengthMm),
    widthMm: String(c.widthMm),
    heightMm: String(c.heightMm),
    maxWeightGrams: String(c.maxWeightGrams),
    unitCostCents: c.unitCostCents != null ? String(c.unitCostCents) : '',
    temperatureZone: c.temperatureZone || 'any',
    insulated: !!c.insulated,
    insulationHours: c.insulationHours != null ? String(c.insulationHours) : '',
    tamperEvident: !!c.tamperEvident,
    valueClass: c.valueClass || 'any',
    hazmatRated: !!c.hazmatRated,
    hazmatClasses: (c.hazmatClasses || []).join(', '),
    materialType: c.materialType || 'corrugated',
  };
}

export default function VNextWmsCartonCatalogue() {
  const [cartons, setCartons] = useState<Carton[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLocation, setSelectedLocation] = useState('');
  const [locations, setLocations] = useState<Array<{ id: string; name: string }>>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);

  useEffect(() => {
    fetch(`${API_URL}/api/v1/locations`).then(r => r.json()).then(res => {
      const locs = (res.data || []).filter((l: any) => !l.locationType || ['warehouse', 'distribution_centre', 'cross_dock'].includes(l.locationType));
      setLocations(locs);
      if (locs.length > 0) setSelectedLocation(locs[0].id);
      else setLoading(false);
    });
  }, []);

  const loadData = () => {
    if (!selectedLocation) return;
    setLoading(true);
    const params = new URLSearchParams({ locationId: selectedLocation });
    if (showArchived) params.set('includeArchived', 'true');
    fetch(`${API_URL}/api/v1/carton-catalogue?${params}`)
      .then(r => r.json())
      .then(res => setCartons(res.data || []))
      .finally(() => setLoading(false));
  };
  useEffect(() => { loadData(); }, [selectedLocation, showArchived]);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setError('');
    setShowModal(true);
  };

  const openEdit = (c: Carton) => {
    setEditingId(c.id);
    setForm(cartonToForm(c));
    setError('');
    setShowModal(true);
  };

  const buildBody = () => ({
    name: form.name.trim(),
    lengthMm: parseInt(form.lengthMm),
    widthMm: parseInt(form.widthMm),
    heightMm: parseInt(form.heightMm),
    maxWeightGrams: parseInt(form.maxWeightGrams),
    unitCostCents: form.unitCostCents ? parseInt(form.unitCostCents) : null,
    temperatureZone: form.temperatureZone,
    insulated: form.insulated,
    insulationHours: form.insulationHours ? parseInt(form.insulationHours) : null,
    tamperEvident: form.tamperEvident,
    valueClass: form.valueClass,
    hazmatRated: form.hazmatRated,
    hazmatClasses: form.hazmatClasses.split(',').map(s => s.trim()).filter(Boolean),
    materialType: form.materialType,
  });

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const body = buildBody();
      let res: Response;
      if (editingId) {
        res = await fetch(`${API_URL}/api/v1/carton-catalogue/${editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      } else {
        res = await fetch(`${API_URL}/api/v1/carton-catalogue`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...body, locationId: selectedLocation }),
        });
      }
      const json = await res.json();
      if (json.error) {
        setError(json.error);
      } else {
        setShowModal(false);
        setEditingId(null);
        setForm(emptyForm);
        loadData();
      }
    } catch {
      setError('Save failed');
    } finally {
      setBusy(false);
    }
  };

  const handleArchive = async (c: Carton) => {
    setNotice('');
    if (!confirm(`Archive "${c.name}"? It will be hidden from packing recommendations but audit history is preserved.`)) return;
    const res = await fetch(`${API_URL}/api/v1/carton-catalogue/${c.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: false }),
    });
    const json = await res.json();
    if (json.error) setError(json.error);
    else { setNotice(`Archived "${c.name}".`); loadData(); }
  };

  const handleRestore = async (c: Carton) => {
    const res = await fetch(`${API_URL}/api/v1/carton-catalogue/${c.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: true }),
    });
    const json = await res.json();
    if (json.error) setError(json.error);
    else { setNotice(`Restored "${c.name}".`); loadData(); }
  };

  const handleDelete = async (c: Carton) => {
    setNotice('');
    if (!confirm(`Delete "${c.name}" permanently? This cannot be undone. If the carton has been used in any pack audit, it will be archived instead.`)) return;
    const res = await fetch(`${API_URL}/api/v1/carton-catalogue/${c.id}`, { method: 'DELETE' });
    const json = await res.json();
    if (json.error) {
      setError(json.error);
      return;
    }
    if (json.data?.archived) {
      setNotice(`"${c.name}" is referenced by ${json.data.referencedCount} pack audit(s), so it was archived instead of deleted.`);
    } else {
      setNotice(`Deleted "${c.name}".`);
    }
    loadData();
  };

  const volumeLitres = (c: Carton) => ((c.lengthMm * c.widthMm * c.heightMm) / 1e6).toFixed(1);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Carton Catalogue</h1>
          <p className="mt-1 text-sm text-muted-foreground">Available carton sizes for packing recommendations</p>
        </div>
        <Button variant="gradient" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Add Carton
        </Button>
      </div>

      {error && (
        <div className="flex items-center gap-3 rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          <CircleAlert className="h-5 w-5" />
          {error}
        </div>
      )}
      {notice && (
        <div className="flex items-center gap-3 rounded-md border border-info/30 bg-info/10 p-4 text-sm text-info">
          <Info className="h-5 w-5" />
          {notice}
        </div>
      )}

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Carton' : 'Add Carton Size'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <Label>Name *</Label>
                <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder='e.g. "Small Mailer", "Medium Box"' required />
              </div>
              <div className="space-y-2">
                <Label>Length (mm) *</Label>
                <Input type="number" min="1" value={form.lengthMm} onChange={e => setForm({ ...form, lengthMm: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label>Width (mm) *</Label>
                <Input type="number" min="1" value={form.widthMm} onChange={e => setForm({ ...form, widthMm: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label>Height (mm) *</Label>
                <Input type="number" min="1" value={form.heightMm} onChange={e => setForm({ ...form, heightMm: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label>Max Weight (g) *</Label>
                <Input type="number" min="1" value={form.maxWeightGrams} onChange={e => setForm({ ...form, maxWeightGrams: e.target.value })} required />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Unit Cost (cents)</Label>
                <Input type="number" min="0" value={form.unitCostCents} onChange={e => setForm({ ...form, unitCostCents: e.target.value })} placeholder="Optional" />
              </div>
            </div>

            <h4 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Container intelligence</h4>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Temperature zone</Label>
                <Select value={form.temperatureZone} onValueChange={v => setForm({ ...form, temperatureZone: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Any (ambient)</SelectItem>
                    <SelectItem value="ambient">Ambient</SelectItem>
                    <SelectItem value="refrigerated">Refrigerated</SelectItem>
                    <SelectItem value="frozen">Frozen</SelectItem>
                    <SelectItem value="dry_ice">Dry ice</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Value class</Label>
                <Select value={form.valueClass} onValueChange={v => setForm({ ...form, valueClass: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Any</SelectItem>
                    <SelectItem value="standard">Standard</SelectItem>
                    <SelectItem value="high_value">High-value</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Material</Label>
                <Select value={form.materialType} onValueChange={v => setForm({ ...form, materialType: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="corrugated">Corrugated</SelectItem>
                    <SelectItem value="plastic">Plastic</SelectItem>
                    <SelectItem value="metal">Metal</SelectItem>
                    <SelectItem value="foam">Foam</SelectItem>
                    <SelectItem value="composite">Composite</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Insulation hours (optional)</Label>
                <Input type="number" min="0" value={form.insulationHours} onChange={e => setForm({ ...form, insulationHours: e.target.value })} placeholder="e.g. 24" />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Hazmat UN classes (comma-separated, e.g. "3, 5.1")</Label>
                <Input value={form.hazmatClasses} onChange={e => setForm({ ...form, hazmatClasses: e.target.value })} placeholder="Leave blank for non-hazmat" />
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.insulated} onChange={e => setForm({ ...form, insulated: e.target.checked })} className="h-4 w-4 rounded border border-input bg-background accent-primary" /> Insulated
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.tamperEvident} onChange={e => setForm({ ...form, tamperEvident: e.target.checked })} className="h-4 w-4 rounded border border-input bg-background accent-primary" /> Tamper-evident
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.hazmatRated} onChange={e => setForm({ ...form, hazmatRated: e.target.checked })} className="h-4 w-4 rounded border border-input bg-background accent-primary" /> Hazmat-rated
              </label>
            </div>

            <DialogFooter>
              <Button variant="outline" type="button" onClick={() => setShowModal(false)}>Cancel</Button>
              <Button variant="gradient" type="submit" disabled={busy}>{busy ? 'Saving...' : editingId ? 'Save changes' : 'Create carton'}</Button>
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
        <label className="ml-auto flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={e => setShowArchived(e.target.checked)}
            className="h-4 w-4 rounded border border-input bg-background accent-primary"
          />
          Show archived
        </label>
      </div>

      {loading ? (
        <div className="flex flex-col items-center gap-3 py-24 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : cartons.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <Package className="h-12 w-12 text-muted-foreground" />
            <h3 className="text-base font-medium">No carton sizes defined</h3>
            <p className="text-sm text-muted-foreground">Add your available box sizes to enable automatic carton recommendations at packing.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>L x W x H (mm)</TableHead>
                <TableHead>Volume (L)</TableHead>
                <TableHead>Max Weight (g)</TableHead>
                <TableHead>Temp</TableHead>
                <TableHead>Value</TableHead>
                <TableHead>Hazmat</TableHead>
                <TableHead>Material</TableHead>
                <TableHead>Cost</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cartons.map(c => (
                <TableRow key={c.id} className={cn(!c.active && 'opacity-55')}>
                  <TableCell>
                    <span className="font-semibold">{c.name}</span>
                    {!c.active && <Badge variant="muted" className="ml-2">archived</Badge>}
                    {c.insulated && <Badge variant="info" className="ml-2">insulated{c.insulationHours ? ` ${c.insulationHours}h` : ''}</Badge>}
                    {c.tamperEvident && <Badge variant="warning" className="ml-2">tamper-evident</Badge>}
                  </TableCell>
                  <TableCell>{c.lengthMm} x {c.widthMm} x {c.heightMm}</TableCell>
                  <TableCell>{volumeLitres(c)}</TableCell>
                  <TableCell>{c.maxWeightGrams.toLocaleString()}</TableCell>
                  <TableCell><Badge variant="secondary">{c.temperatureZone}</Badge></TableCell>
                  <TableCell><Badge variant="secondary">{c.valueClass}</Badge></TableCell>
                  <TableCell>
                    {c.hazmatRated
                      ? <Badge variant="destructive">{(c.hazmatClasses ?? []).join(', ') || 'yes'}</Badge>
                      : <span className="text-muted-foreground">-</span>}
                  </TableCell>
                  <TableCell>{c.materialType}</TableCell>
                  <TableCell>{c.unitCostCents != null ? `$${(c.unitCostCents / 100).toFixed(2)}` : '-'}</TableCell>
                  <TableCell className="text-right">
                    <div className="inline-flex justify-end gap-1">
                      {c.active ? (
                        <>
                          <Button variant="ghost" size="icon" onClick={() => openEdit(c)} title="Edit">
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleArchive(c)} title="Archive">
                            <Archive className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(c)} title="Delete">
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </>
                      ) : (
                        <Button variant="outline" size="sm" onClick={() => handleRestore(c)} title="Restore">
                          <ArchiveRestore className="h-4 w-4" />
                          Restore
                        </Button>
                      )}
                    </div>
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
