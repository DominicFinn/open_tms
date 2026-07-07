import { useEffect, useMemo, useState } from 'react';
import {
  Truck,
  Snowflake,
  AlertTriangle,
  Package,
  Plane,
  Ship,
  Train,
  Stethoscope,
  Siren,
  Dog,
  UtensilsCrossed,
  FlaskConical,
  Zap,
  Leaf,
  Flame,
  Droplet,
  Network,
  Construction,
  Plus,
  Pencil,
  Archive,
  Save,
  X,
  Sparkles,
  CheckSquare,
  Loader2,
  type LucideIcon,
} from 'lucide-react';

import { API_URL } from '../api';
import { SHIPMENT_FIELD_LABELS } from '@open-tms/shared';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

interface ShipmentType {
  id: string;
  name: string;
  icon: string;
  color: string;
  description: string | null;
  defaults: Record<string, unknown>;
  requiredFields: string[];
  isBuiltIn: boolean;
  archived: boolean;
}

const ICON_MAP: Record<string, LucideIcon> = {
  local_shipping: Truck,
  ac_unit: Snowflake,
  warning: AlertTriangle,
  inventory_2: Package,
  flight: Plane,
  directions_boat: Ship,
  train: Train,
  medical_services: Stethoscope,
  emergency: Siren,
  pets: Dog,
  restaurant: UtensilsCrossed,
  science: FlaskConical,
  bolt: Zap,
  eco: Leaf,
  local_fire_department: Flame,
  water_drop: Droplet,
  hub: Network,
  construction: Construction,
};

const ICON_CHOICES = Object.keys(ICON_MAP);

const COLOR_CHOICES = [
  '#6366F1', '#0EA5E9', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
  '#EC4899', '#14B8A6', '#F97316', '#64748B',
];

const SELECTABLE_FIELDS = [
  'customerId', 'originId', 'destinationId',
  'pickupDate', 'deliveryDate',
  'pickupWindowStart', 'pickupWindowEnd',
  'deliveryWindowStart', 'deliveryWindowEnd',
  'proNumber', 'reference', 'carrierId', 'laneId',
];

interface Option { id: string; name: string; }

function IconRender({ name, className, style }: { name: string; className?: string; style?: React.CSSProperties }) {
  const Icon = ICON_MAP[name] || Truck;
  return <Icon className={className} style={style} />;
}

export default function VNextShipmentTypes() {
  const [rows, setRows] = useState<ShipmentType[]>([]);
  const [customers, setCustomers] = useState<Option[]>([]);
  const [locations, setLocations] = useState<Option[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<ShipmentType | null>(null);
  const [error, setError] = useState('');

  const emptyForm = {
    name: '', icon: 'local_shipping', color: '#6366F1', description: '',
    defaultCustomerId: '', defaultOriginId: '', defaultDestinationId: '',
    requiredFields: ['customerId', 'originId', 'destinationId'] as string[],
  };
  const [form, setForm] = useState(emptyForm);

  const load = () => {
    setLoading(true);
    fetch(`${API_URL}/api/v1/shipment-types`)
      .then(r => r.json())
      .then(json => setRows(json.data || []))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    fetch(`${API_URL}/api/v1/customers`).then(r => r.json()).then(j => setCustomers(j.data || [])).catch(() => {});
    fetch(`${API_URL}/api/v1/locations`).then(r => r.json()).then(j => setLocations(j.data || [])).catch(() => {});
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setError('');
    setShowForm(true);
  };

  const openEdit = (t: ShipmentType) => {
    setEditing(t);
    const d = t.defaults || {};
    setForm({
      name: t.name,
      icon: t.icon,
      color: t.color,
      description: t.description ?? '',
      defaultCustomerId: (d.customerId as string) || '',
      defaultOriginId: (d.originId as string) || '',
      defaultDestinationId: (d.destinationId as string) || '',
      requiredFields: t.requiredFields,
    });
    setError('');
    setShowForm(true);
  };

  const toggleRequired = (field: string) => {
    setForm(f => ({
      ...f,
      requiredFields: f.requiredFields.includes(field)
        ? f.requiredFields.filter(x => x !== field)
        : [...f.requiredFields, field],
    }));
  };

  const handleSave = async () => {
    setError('');
    if (!form.name.trim()) { setError('Name is required'); return; }
    const defaults: Record<string, unknown> = {};
    if (form.defaultCustomerId) defaults.customerId = form.defaultCustomerId;
    if (form.defaultOriginId) defaults.originId = form.defaultOriginId;
    if (form.defaultDestinationId) defaults.destinationId = form.defaultDestinationId;

    const payload: any = {
      name: form.name.trim(),
      icon: form.icon,
      color: form.color,
      description: form.description || undefined,
      defaults,
      requiredFields: form.requiredFields,
    };
    const url = editing ? `${API_URL}/api/v1/shipment-types/${editing.id}` : `${API_URL}/api/v1/shipment-types`;
    const method = editing ? 'PUT' : 'POST';
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const data = await res.json();
    if (data.error) { setError(data.error); return; }
    setShowForm(false);
    load();
  };

  const handleDelete = async (t: ShipmentType) => {
    if (t.isBuiltIn) return;
    if (!confirm(`Archive shipment type "${t.name}"? Existing shipments that use it will keep their reference but new shipments will no longer see it.`)) return;
    const res = await fetch(`${API_URL}/api/v1/shipment-types/${t.id}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.error) { alert(data.error); return; }
    load();
  };

  const defaultsLabel = (d: Record<string, unknown>): string => {
    const keys = Object.keys(d || {});
    if (keys.length === 0) return '-';
    return keys.map(k => SHIPMENT_FIELD_LABELS[k] || k).join(', ');
  };

  const builtInCount = useMemo(() => rows.filter(r => r.isBuiltIn).length, [rows]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Shipment types</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Templates that pre-decide required fields, default values, and icon. {rows.length} total - {builtInCount} built-in.
          </p>
        </div>
        <Button variant="gradient" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          New type
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Icon</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Required fields</TableHead>
                  <TableHead>Pre-filled defaults</TableHead>
                  <TableHead className="w-24">Built-in</TableHead>
                  <TableHead className="w-28 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="py-6 text-center text-sm text-muted-foreground">
                      No shipment types yet.
                    </TableCell>
                  </TableRow>
                )}
                {rows.map(t => (
                  <TableRow key={t.id}>
                    <TableCell>
                      <IconRender name={t.icon} className="h-7 w-7" style={{ color: t.color }} />
                    </TableCell>
                    <TableCell><strong>{t.name}</strong></TableCell>
                    <TableCell className="text-sm text-muted-foreground">{t.description || '-'}</TableCell>
                    <TableCell className="text-sm">
                      {t.requiredFields.length === 0 ? '-' : t.requiredFields.map(f => SHIPMENT_FIELD_LABELS[f] || f).join(', ')}
                    </TableCell>
                    <TableCell className="text-sm">{defaultsLabel(t.defaults || {})}</TableCell>
                    <TableCell>{t.isBuiltIn ? <Badge variant="secondary">Built-in</Badge> : '-'}</TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(t)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        {!t.isBuiltIn && (
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(t)}>
                            <Archive className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit shipment type' : 'New shipment type'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {error && (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Weekly Dallas Reefer" />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Optional" />
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-semibold">Icon and color</h3>
              <div className="flex flex-wrap gap-2">
                {ICON_CHOICES.map(icon => (
                  <button
                    key={icon}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, icon }))}
                    title={icon}
                    className={cn(
                      'flex h-12 w-12 items-center justify-center rounded-md border-2',
                      form.icon === icon ? 'border-primary' : 'border-border bg-background',
                    )}
                    style={{
                      borderColor: form.icon === icon ? form.color : undefined,
                      background: form.icon === icon ? `${form.color}20` : undefined,
                    }}
                  >
                    <IconRender name={icon} className="h-6 w-6" style={{ color: form.icon === icon ? form.color : undefined }} />
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                {COLOR_CHOICES.map(color => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, color }))}
                    title={color}
                    className={cn('h-8 w-8 rounded-full border-2', form.color === color ? 'border-foreground' : 'border-border')}
                    style={{ background: color }}
                  />
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <Sparkles className="h-4 w-4" />
                Default values
              </h3>
              <p className="text-xs text-muted-foreground">
                Pre-fill the new shipment form with these values. The user can still change them.
              </p>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>Default customer</Label>
                  <Select value={form.defaultCustomerId || 'none'} onValueChange={v => setForm(f => ({ ...f, defaultCustomerId: v === 'none' ? '' : v }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {customers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Default origin</Label>
                  <Select value={form.defaultOriginId || 'none'} onValueChange={v => setForm(f => ({ ...f, defaultOriginId: v === 'none' ? '' : v }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {locations.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Default destination</Label>
                  <Select value={form.defaultDestinationId || 'none'} onValueChange={v => setForm(f => ({ ...f, defaultDestinationId: v === 'none' ? '' : v }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {locations.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <CheckSquare className="h-4 w-4" />
                Required fields
              </h3>
              <p className="text-xs text-muted-foreground">
                These must be filled for a shipment of this type to leave draft. Users can still save drafts with missing fields.
              </p>
              <div className="flex flex-wrap gap-3">
                {SELECTABLE_FIELDS.map(field => (
                  <label key={field} className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={form.requiredFields.includes(field)}
                      onChange={() => toggleRequired(field)}
                      className="h-4 w-4 rounded border border-input bg-background accent-primary"
                    />
                    {SHIPMENT_FIELD_LABELS[field] || field}
                  </label>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>
              <X className="h-4 w-4" />
              Cancel
            </Button>
            <Button variant="gradient" onClick={handleSave}>
              <Save className="h-4 w-4" />
              {editing ? 'Save changes' : 'Create type'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
