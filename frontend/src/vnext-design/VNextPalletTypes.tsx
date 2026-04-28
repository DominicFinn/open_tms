import { useEffect, useState } from 'react';
import { CircleAlert, Loader2, Plus } from 'lucide-react';

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

interface PalletType {
  id: string;
  code: string;
  name: string;
  description: string | null;
  lengthMm: number;
  widthMm: number;
  heightMm: number;
  tareWeightGrams: number;
  maxLoadGrams: number;
  maxStackHeightMm: number | null;
  material: string;
  reusable: boolean;
  isoCertified: boolean;
  stackable: boolean;
  active: boolean;
}

const MATERIALS = ['wood', 'plastic', 'metal', 'cardboard', 'composite'];

function kg(g: number) { return (g / 1000).toFixed(1); }
function cm(mm: number) { return (mm / 10).toFixed(0); }

export default function VNextPalletTypes() {
  const [rows, setRows] = useState<PalletType[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<PalletType | null>(null);
  const [error, setError] = useState('');
  const [seeding, setSeeding] = useState(false);
  const emptyForm = {
    code: '', name: '', description: '',
    lengthMm: '1200', widthMm: '800', heightMm: '144',
    tareWeightGrams: '25000', maxLoadGrams: '1500000', maxStackHeightMm: '2400',
    material: 'wood', reusable: true, isoCertified: false, stackable: true, active: true,
  };
  const [form, setForm] = useState(emptyForm);

  const load = () => {
    setLoading(true);
    fetch(`${API_URL}/api/v1/pallet-types`)
      .then(r => r.json())
      .then(json => setRows(json.data || []))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setShowForm(true);
  };
  const openEdit = (p: PalletType) => {
    setEditing(p);
    setForm({
      code: p.code, name: p.name, description: p.description ?? '',
      lengthMm: String(p.lengthMm), widthMm: String(p.widthMm), heightMm: String(p.heightMm),
      tareWeightGrams: String(p.tareWeightGrams), maxLoadGrams: String(p.maxLoadGrams),
      maxStackHeightMm: p.maxStackHeightMm ? String(p.maxStackHeightMm) : '',
      material: p.material, reusable: p.reusable, isoCertified: p.isoCertified, stackable: p.stackable, active: p.active,
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    setError('');
    const payload: any = {
      code: form.code.trim(),
      name: form.name.trim(),
      description: form.description || undefined,
      lengthMm: parseInt(form.lengthMm),
      widthMm: parseInt(form.widthMm),
      heightMm: parseInt(form.heightMm),
      tareWeightGrams: parseInt(form.tareWeightGrams),
      maxLoadGrams: parseInt(form.maxLoadGrams),
      maxStackHeightMm: form.maxStackHeightMm ? parseInt(form.maxStackHeightMm) : null,
      material: form.material,
      reusable: form.reusable,
      isoCertified: form.isoCertified,
      stackable: form.stackable,
      active: form.active,
    };
    const url = editing ? `${API_URL}/api/v1/pallet-types/${editing.id}` : `${API_URL}/api/v1/pallet-types`;
    const method = editing ? 'PUT' : 'POST';
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const data = await res.json();
    if (data.error) setError(data.error);
    else { setShowForm(false); load(); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this pallet type? If it is referenced by any trackable units it will be deactivated instead.')) return;
    await fetch(`${API_URL}/api/v1/pallet-types/${id}`, { method: 'DELETE' });
    load();
  };

  const handleSeed = async () => {
    if (!confirm('Add any missing standard pallet types (EUR, US GMA, CHEP, etc.) to your catalogue?')) return;
    setSeeding(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/pallet-types/seed-standards`, { method: 'POST' });
      const data = await res.json();
      alert(`Seed complete. Created: ${data.data.created}, skipped (already exist): ${data.data.skipped}.`);
      load();
    } finally { setSeeding(false); }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Pallet Types</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Standard pallet specs used for palletization planning, load plans, and BOL weight totals.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleSeed} disabled={seeding}>
            {seeding ? 'Seeding...' : 'Load standard types'}
          </Button>
          <Button variant="gradient" onClick={openCreate}>
            <Plus className="h-4 w-4" />
            New type
          </Button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-3 rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          <CircleAlert className="h-5 w-5" />
          {error}
        </div>
      )}

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>{editing ? 'Edit pallet type' : 'New pallet type'}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Code</Label>
                <Input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} placeholder="EUR1" disabled={!!editing} />
              </div>
              <div className="space-y-2">
                <Label>Name</Label>
                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Description</Label>
                <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Length (mm)</Label>
                <Input type="number" value={form.lengthMm} onChange={e => setForm(f => ({ ...f, lengthMm: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Width (mm)</Label>
                <Input type="number" value={form.widthMm} onChange={e => setForm(f => ({ ...f, widthMm: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Deck height (mm)</Label>
                <Input type="number" value={form.heightMm} onChange={e => setForm(f => ({ ...f, heightMm: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Max stack height (mm, optional)</Label>
                <Input type="number" value={form.maxStackHeightMm} onChange={e => setForm(f => ({ ...f, maxStackHeightMm: e.target.value }))} placeholder="unlimited" />
              </div>
              <div className="space-y-2">
                <Label>Tare weight (g)</Label>
                <Input type="number" value={form.tareWeightGrams} onChange={e => setForm(f => ({ ...f, tareWeightGrams: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Max load (g, SWL)</Label>
                <Input type="number" value={form.maxLoadGrams} onChange={e => setForm(f => ({ ...f, maxLoadGrams: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Material</Label>
                <Select value={form.material} onValueChange={v => setForm(f => ({ ...f, material: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MATERIALS.map(m => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.reusable} onChange={e => setForm(f => ({ ...f, reusable: e.target.checked }))} className="h-4 w-4 rounded border border-input bg-background accent-primary" /> Reusable
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.isoCertified} onChange={e => setForm(f => ({ ...f, isoCertified: e.target.checked }))} className="h-4 w-4 rounded border border-input bg-background accent-primary" /> ISPM-15 certified
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.stackable} onChange={e => setForm(f => ({ ...f, stackable: e.target.checked }))} className="h-4 w-4 rounded border border-input bg-background accent-primary" /> Stackable
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.active} onChange={e => setForm(f => ({ ...f, active: e.target.checked }))} className="h-4 w-4 rounded border border-input bg-background accent-primary" /> Active
              </label>
            </div>
            <div className="mt-4 flex gap-2">
              <Button variant="gradient" onClick={handleSave}>{editing ? 'Save' : 'Create'}</Button>
              <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Size (L x W x H cm)</TableHead>
              <TableHead>Tare</TableHead>
              <TableHead>Max load</TableHead>
              <TableHead>Max stack</TableHead>
              <TableHead>Material</TableHead>
              <TableHead>Flags</TableHead>
              <TableHead>Status</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <TableRow>
                <TableCell colSpan={10} className="py-12 text-center">
                  <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                </TableCell>
              </TableRow>
            )}
            {!loading && rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={10} className="py-12 text-center text-sm text-muted-foreground">
                  No pallet types yet. Click <strong>Load standard types</strong> to seed EUR, US GMA, CHEP, and more.
                </TableCell>
              </TableRow>
            )}
            {rows.map(p => (
              <TableRow key={p.id}>
                <TableCell><code className="text-xs">{p.code}</code></TableCell>
                <TableCell>
                  <div className="font-semibold">{p.name}</div>
                  {p.description && <div className="text-xs text-muted-foreground">{p.description}</div>}
                </TableCell>
                <TableCell>{cm(p.lengthMm)}x{cm(p.widthMm)}x{cm(p.heightMm)}</TableCell>
                <TableCell>{kg(p.tareWeightGrams)} kg</TableCell>
                <TableCell>{kg(p.maxLoadGrams)} kg</TableCell>
                <TableCell>{p.maxStackHeightMm ? `${cm(p.maxStackHeightMm)} cm` : '-'}</TableCell>
                <TableCell>{p.material}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {p.reusable && <Badge variant="secondary">reusable</Badge>}
                    {p.isoCertified && <Badge variant="info">ISPM-15</Badge>}
                    {p.stackable && <Badge variant="secondary">stackable</Badge>}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={p.active ? 'success' : 'muted'}>{p.active ? 'Active' : 'Inactive'}</Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="inline-flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => openEdit(p)}>Edit</Button>
                    <Button variant="outline" size="sm" className="text-destructive" onClick={() => handleDelete(p.id)}>Delete</Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
