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

type PackagingKind = 'pallet' | 'carton' | 'crate' | 'drum' | 'roll' | 'bag' | 'tote' | 'loose' | 'custom';

interface PackagingType {
  id: string;
  code: string;
  name: string;
  description: string | null;
  kind: PackagingKind;
  lengthMm: number;
  widthMm: number;
  heightMm: number;
  tareWeightGrams: number | null;
  maxLoadGrams: number | null;
  maxStackHeightMm: number | null;
  material: string | null;
  reusable: boolean;
  isoCertified: boolean;
  stackable: boolean;
  active: boolean;
}

const KINDS: PackagingKind[] = ['pallet', 'carton', 'crate', 'drum', 'roll', 'bag', 'tote', 'loose', 'custom'];
const MATERIALS = ['wood', 'plastic', 'metal', 'cardboard', 'composite', 'fiber', 'textile'];

function kg(g: number | null) { return g == null ? '-' : (g / 1000).toFixed(1) + ' kg'; }
function cm(mm: number) { return (mm / 10).toFixed(0); }

export default function VNextPackagingTypes() {
  const [rows, setRows] = useState<PackagingType[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<PackagingType | null>(null);
  const [error, setError] = useState('');
  const [seeding, setSeeding] = useState(false);
  const [kindFilter, setKindFilter] = useState<PackagingKind | 'all'>('all');

  const emptyForm = {
    code: '', name: '', description: '', kind: 'pallet' as PackagingKind,
    lengthMm: '1200', widthMm: '800', heightMm: '144',
    tareWeightGrams: '25000', maxLoadGrams: '1500000', maxStackHeightMm: '2400',
    material: 'wood', reusable: true, isoCertified: false, stackable: true, active: true,
  };
  const [form, setForm] = useState(emptyForm);

  const load = () => {
    setLoading(true);
    fetch(`${API_URL}/api/v1/packaging-types`)
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
  const openEdit = (p: PackagingType) => {
    setEditing(p);
    setForm({
      code: p.code, name: p.name, description: p.description ?? '', kind: p.kind,
      lengthMm: String(p.lengthMm), widthMm: String(p.widthMm), heightMm: String(p.heightMm),
      tareWeightGrams: p.tareWeightGrams != null ? String(p.tareWeightGrams) : '',
      maxLoadGrams: p.maxLoadGrams != null ? String(p.maxLoadGrams) : '',
      maxStackHeightMm: p.maxStackHeightMm ? String(p.maxStackHeightMm) : '',
      material: p.material ?? '',
      reusable: p.reusable, isoCertified: p.isoCertified, stackable: p.stackable, active: p.active,
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    setError('');
    const payload: any = {
      code: form.code.trim(),
      name: form.name.trim(),
      description: form.description || undefined,
      kind: form.kind,
      lengthMm: parseInt(form.lengthMm),
      widthMm: parseInt(form.widthMm),
      heightMm: parseInt(form.heightMm),
      tareWeightGrams: form.tareWeightGrams ? parseInt(form.tareWeightGrams) : null,
      maxLoadGrams: form.maxLoadGrams ? parseInt(form.maxLoadGrams) : null,
      maxStackHeightMm: form.maxStackHeightMm ? parseInt(form.maxStackHeightMm) : null,
      material: form.material || null,
      reusable: form.reusable,
      isoCertified: form.isoCertified,
      stackable: form.stackable,
      active: form.active,
    };
    const url = editing ? `${API_URL}/api/v1/packaging-types/${editing.id}` : `${API_URL}/api/v1/packaging-types`;
    const method = editing ? 'PUT' : 'POST';
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const data = await res.json();
    if (data.error) setError(data.error);
    else { setShowForm(false); load(); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this packaging type? If it is referenced by any trackable units it will be deactivated instead.')) return;
    await fetch(`${API_URL}/api/v1/packaging-types/${id}`, { method: 'DELETE' });
    load();
  };

  const handleSeed = async () => {
    if (!confirm('Add any missing standard packaging types (pallets + cartons + crates + drums + ...) to your catalogue?')) return;
    setSeeding(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/packaging-types/seed-standards`, { method: 'POST' });
      const data = await res.json();
      alert(`Seed complete. Created: ${data.data.created}, skipped (already exist): ${data.data.skipped}.`);
      load();
    } finally { setSeeding(false); }
  };

  const filteredRows = kindFilter === 'all' ? rows : rows.filter(r => r.kind === kindFilter);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Packaging Types</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Catalogue of pallets, cartons, crates, drums, totes, and more. Used for cartonization, palletization planning, and BOL totals.
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

      <div className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground">Filter by kind:</span>
        <Select value={kindFilter} onValueChange={v => setKindFilter(v as any)}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All kinds</SelectItem>
            {KINDS.map(k => (<SelectItem key={k} value={k}>{k}</SelectItem>))}
          </SelectContent>
        </Select>
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
            <CardTitle>{editing ? 'Edit packaging type' : 'New packaging type'}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Kind</Label>
                <Select value={form.kind} onValueChange={v => setForm(f => ({ ...f, kind: v as PackagingKind }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {KINDS.map(k => (<SelectItem key={k} value={k}>{k}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Code</Label>
                <Input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} placeholder="EUR1, CARTON_M, DRUM_55GAL..." disabled={!!editing} />
              </div>
              <div className="space-y-2 md:col-span-2">
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
                <Label>Height (mm)</Label>
                <Input type="number" value={form.heightMm} onChange={e => setForm(f => ({ ...f, heightMm: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Max stack height (mm, optional)</Label>
                <Input type="number" value={form.maxStackHeightMm} onChange={e => setForm(f => ({ ...f, maxStackHeightMm: e.target.value }))} placeholder="unlimited" />
              </div>
              <div className="space-y-2">
                <Label>Tare weight (g, optional)</Label>
                <Input type="number" value={form.tareWeightGrams} onChange={e => setForm(f => ({ ...f, tareWeightGrams: e.target.value }))} placeholder="n/a" />
              </div>
              <div className="space-y-2">
                <Label>Max load (g, SWL, optional)</Label>
                <Input type="number" value={form.maxLoadGrams} onChange={e => setForm(f => ({ ...f, maxLoadGrams: e.target.value }))} placeholder="n/a" />
              </div>
              <div className="space-y-2">
                <Label>Material (optional)</Label>
                <Select value={form.material || 'none'} onValueChange={v => setForm(f => ({ ...f, material: v === 'none' ? '' : v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">- none -</SelectItem>
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
              <TableHead>Kind</TableHead>
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
                <TableCell colSpan={11} className="py-12 text-center">
                  <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                </TableCell>
              </TableRow>
            )}
            {!loading && filteredRows.length === 0 && (
              <TableRow>
                <TableCell colSpan={11} className="py-12 text-center text-sm text-muted-foreground">
                  No packaging types yet. Click <strong>Load standard types</strong> to seed EUR pallets, cartons, drums, totes, and more.
                </TableCell>
              </TableRow>
            )}
            {filteredRows.map(p => (
              <TableRow key={p.id}>
                <TableCell><Badge variant="secondary">{p.kind}</Badge></TableCell>
                <TableCell><code className="text-xs">{p.code}</code></TableCell>
                <TableCell>
                  <div className="font-semibold">{p.name}</div>
                  {p.description && <div className="text-xs text-muted-foreground">{p.description}</div>}
                </TableCell>
                <TableCell>{cm(p.lengthMm)}x{cm(p.widthMm)}x{cm(p.heightMm)}</TableCell>
                <TableCell>{kg(p.tareWeightGrams)}</TableCell>
                <TableCell>{kg(p.maxLoadGrams)}</TableCell>
                <TableCell>{p.maxStackHeightMm ? `${cm(p.maxStackHeightMm)} cm` : '-'}</TableCell>
                <TableCell>{p.material ?? '-'}</TableCell>
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
