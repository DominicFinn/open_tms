import React, { useState, useEffect } from 'react';
import { CircleAlert, Loader2, Plus, Ruler } from 'lucide-react';

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

interface ProductUom {
  id: string;
  sku: string;
  uomCode: string;
  parentUomCode: string | null;
  conversionFactor: number;
  lengthMm: number | null;
  widthMm: number | null;
  heightMm: number | null;
  weightGrams: number | null;
  barcodeGtin: string | null;
  isDefault: boolean;
}

export default function VNextWmsProductUom() {
  const [records, setRecords] = useState<ProductUom[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ sku: '', uomCode: 'EA', lengthMm: '', widthMm: '', heightMm: '', weightGrams: '', barcodeGtin: '', isDefault: true });

  const loadData = () => {
    setLoading(true);
    const url = search ? `${API_URL}/api/v1/product-uom?search=${encodeURIComponent(search)}` : `${API_URL}/api/v1/product-uom`;
    fetch(url).then(r => r.json()).then(res => setRecords(res.data || [])).finally(() => setLoading(false));
  };

  useEffect(() => { loadData(); }, [search]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setCreating(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/product-uom`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sku: form.sku.trim(), uomCode: form.uomCode,
          lengthMm: form.lengthMm ? parseInt(form.lengthMm) : null,
          widthMm: form.widthMm ? parseInt(form.widthMm) : null,
          heightMm: form.heightMm ? parseInt(form.heightMm) : null,
          weightGrams: form.weightGrams ? parseInt(form.weightGrams) : null,
          barcodeGtin: form.barcodeGtin || null,
          isDefault: form.isDefault,
        }),
      });
      const data = await res.json();
      if (data.error) setError(data.error);
      else { setShowCreate(false); setForm({ sku: '', uomCode: 'EA', lengthMm: '', widthMm: '', heightMm: '', weightGrams: '', barcodeGtin: '', isDefault: true }); loadData(); }
    } catch { setError('Failed to save'); }
    finally { setCreating(false); }
  };

  const handleDelete = async (id: string) => {
    await fetch(`${API_URL}/api/v1/product-uom/${id}`, { method: 'DELETE' });
    loadData();
  };

  const hasDims = (r: ProductUom) => r.lengthMm && r.widthMm && r.heightMm && r.weightGrams;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Product Dimensions</h1>
          <p className="mt-1 text-sm text-muted-foreground">SKU dimensions and weights for cartonization</p>
        </div>
        <Button variant="gradient" onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4" />
          Add Product
        </Button>
      </div>

      {error && (
        <div className="flex items-center gap-3 rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          <CircleAlert className="h-5 w-5" />
          {error}
        </div>
      )}

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Product Dimensions</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>SKU *</Label>
                <Input value={form.sku} onChange={e => setForm({ ...form, sku: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label>UOM Code</Label>
                <Select value={form.uomCode} onValueChange={v => setForm({ ...form, uomCode: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EA">EA</SelectItem>
                    <SelectItem value="INNER">INNER</SelectItem>
                    <SelectItem value="CASE">CASE</SelectItem>
                    <SelectItem value="PALLET">PALLET</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Length (mm)</Label>
                <Input type="number" min="1" value={form.lengthMm} onChange={e => setForm({ ...form, lengthMm: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Width (mm)</Label>
                <Input type="number" min="1" value={form.widthMm} onChange={e => setForm({ ...form, widthMm: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Height (mm)</Label>
                <Input type="number" min="1" value={form.heightMm} onChange={e => setForm({ ...form, heightMm: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Weight (g)</Label>
                <Input type="number" min="1" value={form.weightGrams} onChange={e => setForm({ ...form, weightGrams: e.target.value })} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Barcode / GTIN</Label>
                <Input value={form.barcodeGtin} onChange={e => setForm({ ...form, barcodeGtin: e.target.value })} placeholder="Optional" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" type="button" onClick={() => setShowCreate(false)}>Cancel</Button>
              <Button variant="gradient" type="submit" disabled={creating}>{creating ? 'Saving...' : 'Save'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <div className="flex flex-wrap items-center gap-2">
        <Input placeholder="Search by SKU..." value={search} onChange={e => setSearch(e.target.value)} className="max-w-md" />
      </div>

      {loading ? (
        <div className="flex flex-col items-center gap-3 py-24 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : records.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <Ruler className="h-12 w-12 text-muted-foreground" />
            <h3 className="text-base font-medium">No product dimensions</h3>
            <p className="text-sm text-muted-foreground">Add SKU dimensions and weights to enable carton recommendations at packing.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SKU</TableHead>
                <TableHead>UOM</TableHead>
                <TableHead>L (mm)</TableHead>
                <TableHead>W (mm)</TableHead>
                <TableHead>H (mm)</TableHead>
                <TableHead>Weight (g)</TableHead>
                <TableHead>GTIN</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.map(r => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-sm font-semibold">{r.sku}</TableCell>
                  <TableCell>{r.uomCode}</TableCell>
                  <TableCell>{r.lengthMm ?? '-'}</TableCell>
                  <TableCell>{r.widthMm ?? '-'}</TableCell>
                  <TableCell>{r.heightMm ?? '-'}</TableCell>
                  <TableCell>{r.weightGrams ?? '-'}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{r.barcodeGtin || '-'}</TableCell>
                  <TableCell>
                    {hasDims(r) ? <Badge variant="success">Complete</Badge> : <Badge variant="warning">Partial</Badge>}
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
