import { useState, useEffect } from 'react';
import {
  Truck,
  ScrollText,
  Bus,
  Users,
  MapPin,
  Plus,
  Trash2,
  CheckCircle2,
  Save,
  History,
  Loader2,
  Box,
} from 'lucide-react';

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
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface CustomField {
  id?: string;
  fieldKey: string;
  label: string;
  description: string;
  fieldType: string;
  required: boolean;
  defaultValue: string;
  config: any;
  displayOrder: number;
}

interface CustomFieldVersion {
  id: string;
  entityType: string;
  version: number;
  active: boolean;
  description: string | null;
  fields: CustomField[];
  createdAt: string;
}

const ENTITY_TYPES = [
  { key: 'shipment', label: 'Shipment', Icon: Truck },
  { key: 'order', label: 'Order', Icon: ScrollText },
  { key: 'carrier', label: 'Carrier', Icon: Bus },
  { key: 'customer', label: 'Customer', Icon: Users },
  { key: 'location', label: 'Location', Icon: MapPin },
];

const FIELD_TYPES = [
  { value: 'text', label: 'Text' },
  { value: 'decimal', label: 'Decimal' },
  { value: 'integer', label: 'Integer' },
  { value: 'date', label: 'Date' },
  { value: 'boolean', label: 'Boolean' },
  { value: 'list', label: 'List' },
  { value: 'multi_list', label: 'Multi-List' },
];

const emptyField: CustomField = {
  fieldKey: '',
  label: '',
  description: '',
  fieldType: 'text',
  required: false,
  defaultValue: '',
  config: null,
  displayOrder: 0,
};

function Banner({ variant, message, onClose }: { variant: 'success' | 'error'; message: string; onClose?: () => void }) {
  const tone =
    variant === 'success'
      ? 'border-success/30 bg-success/10 text-success'
      : 'border-destructive/30 bg-destructive/10 text-destructive';
  return (
    <div className={`flex items-start justify-between gap-3 rounded-md border p-3 text-sm ${tone}`}>
      <span>{message}</span>
      {onClose && (
        <button onClick={onClose} className="text-xs underline opacity-70 hover:opacity-100">Dismiss</button>
      )}
    </div>
  );
}

export default function VNextCustomFields() {
  const [activeTab, setActiveTab] = useState('shipment');
  const [currentVersion, setCurrentVersion] = useState<CustomFieldVersion | null>(null);
  const [fields, setFields] = useState<CustomField[]>([]);
  const [versions, setVersions] = useState<CustomFieldVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showAddField, setShowAddField] = useState(false);
  const [newField, setNewField] = useState<CustomField>({ ...emptyField });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData(activeTab);
  }, [activeTab]);

  async function loadData(entityType: string) {
    setLoading(true);
    setError('');
    try {
      const [fieldsRes, versionsRes] = await Promise.all([
        fetch(`${API_URL}/api/v1/custom-fields/${entityType}`),
        fetch(`${API_URL}/api/v1/custom-fields/${entityType}/versions`),
      ]);
      if (!fieldsRes.ok) throw new Error('Failed to load custom fields');
      const fieldsJson = await fieldsRes.json();
      const current = fieldsJson.data || null;
      setCurrentVersion(current);
      setFields(current?.fields || []);

      if (versionsRes.ok) {
        const versionsJson = await versionsRes.json();
        setVersions(versionsJson.data || []);
      } else {
        setVersions([]);
      }
    } catch (e: any) {
      setError(e.message || 'Failed to load custom fields');
    } finally {
      setLoading(false);
    }
  }

  function addField() {
    if (!newField.fieldKey.trim() || !newField.label.trim()) {
      setError('Field key and label are required');
      return;
    }
    if (fields.some(f => f.fieldKey === newField.fieldKey.trim())) {
      setError('Field key must be unique');
      return;
    }
    setFields(prev => [
      ...prev,
      { ...newField, fieldKey: newField.fieldKey.trim(), label: newField.label.trim(), displayOrder: newField.displayOrder || prev.length + 1 },
    ]);
    setNewField({ ...emptyField });
    setShowAddField(false);
    setError('');
  }

  function removeField(idx: number) {
    setFields(prev => prev.filter((_, i) => i !== idx));
  }

  async function saveVersion() {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const body = {
        entityType: activeTab,
        description: 'Updated fields',
        fields: fields.map((f, i) => ({
          fieldKey: f.fieldKey,
          label: f.label,
          description: f.description || '',
          fieldType: f.fieldType,
          required: f.required,
          defaultValue: f.defaultValue || '',
          config: f.config || null,
          displayOrder: f.displayOrder || i + 1,
        })),
      };
      const res = await fetch(`${API_URL}/api/v1/custom-fields/versions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || 'Failed to save version');
      }
      setSuccess('Custom fields version saved successfully');
      await loadData(activeTab);
    } catch (e: any) {
      setError(e.message || 'Failed to save version');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Custom fields</h1>
          <p className="mt-1 text-sm text-muted-foreground">Define custom fields for each entity type</p>
        </div>
        <Button variant="gradient" onClick={saveVersion} disabled={saving}>
          <Save className="h-4 w-4" />
          {saving ? 'Saving...' : 'Save version'}
        </Button>
      </div>

      {error && <Banner variant="error" message={error} onClose={() => setError('')} />}
      {success && <Banner variant="success" message={success} onClose={() => setSuccess('')} />}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          {ENTITY_TYPES.map(({ key, label, Icon }) => (
            <TabsTrigger key={key} value={key}>
              <Icon className="mr-1 h-4 w-4" />
              {label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>
                {ENTITY_TYPES.find(e => e.key === activeTab)?.label} fields
                {currentVersion && (
                  <span className="ml-2 text-sm font-normal text-muted-foreground">
                    (Version {currentVersion.version})
                  </span>
                )}
              </CardTitle>
              <Button variant="outline" onClick={() => { setShowAddField(true); setNewField({ ...emptyField, displayOrder: fields.length + 1 }); }}>
                <Plus className="h-4 w-4" />
                Add field
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              {fields.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
                  <Box className="h-8 w-8" />
                  <h3 className="text-base font-medium">No custom fields defined</h3>
                  <p className="text-sm">Add fields to extend this entity type.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Field key</TableHead>
                      <TableHead>Label</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Required</TableHead>
                      <TableHead>Default value</TableHead>
                      <TableHead>Order</TableHead>
                      <TableHead className="w-20">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {fields.map((f, idx) => (
                      <TableRow key={f.fieldKey + idx}>
                        <TableCell>
                          <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{f.fieldKey}</code>
                        </TableCell>
                        <TableCell className="font-medium">{f.label}</TableCell>
                        <TableCell>
                          <Badge variant="info">
                            {FIELD_TYPES.find(ft => ft.value === f.fieldType)?.label || f.fieldType}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {f.required && <CheckCircle2 className="h-4 w-4 text-primary" />}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{f.defaultValue || ''}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{f.displayOrder}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" onClick={() => removeField(idx)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {showAddField && (
            <Card>
              <CardHeader>
                <CardTitle>Add field</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label>Field key *</Label>
                    <Input value={newField.fieldKey} onChange={e => setNewField(f => ({ ...f, fieldKey: e.target.value }))} placeholder="e.g. custom_weight" />
                  </div>
                  <div className="space-y-2">
                    <Label>Label *</Label>
                    <Input value={newField.label} onChange={e => setNewField(f => ({ ...f, label: e.target.value }))} placeholder="e.g. Custom Weight" />
                  </div>
                  <div className="space-y-2">
                    <Label>Field type</Label>
                    <Select value={newField.fieldType} onValueChange={v => setNewField(f => ({ ...f, fieldType: v }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {FIELD_TYPES.map(ft => (
                          <SelectItem key={ft.value} value={ft.value}>{ft.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Input value={newField.description} onChange={e => setNewField(f => ({ ...f, description: e.target.value }))} placeholder="Field description" />
                  </div>
                  <div className="space-y-2">
                    <Label>Default value</Label>
                    <Input value={newField.defaultValue} onChange={e => setNewField(f => ({ ...f, defaultValue: e.target.value }))} placeholder="Default value" />
                  </div>
                  <div className="space-y-2">
                    <Label>Display order</Label>
                    <Input
                      type="number"
                      value={newField.displayOrder}
                      onChange={e => setNewField(f => ({ ...f, displayOrder: parseInt(e.target.value) || 0 }))}
                    />
                  </div>
                  <div className="flex items-end">
                    <label className="flex cursor-pointer items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={newField.required}
                        onChange={e => setNewField(f => ({ ...f, required: e.target.checked }))}
                        className="h-4 w-4 rounded border border-input bg-background accent-primary"
                      />
                      Required
                    </label>
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setShowAddField(false)}>Cancel</Button>
                  <Button variant="gradient" onClick={addField}>
                    <Plus className="h-4 w-4" />
                    Add field
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Version history</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {versions.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
                  <History className="h-8 w-8" />
                  <h3 className="text-base font-medium">No version history</h3>
                  <p className="text-sm">Versions will appear here after saving custom fields.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Version</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Fields</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {versions.map(v => (
                      <TableRow key={v.id}>
                        <TableCell className="font-medium">v{v.version}</TableCell>
                        <TableCell>
                          <Badge variant={v.active ? 'success' : 'secondary'}>
                            {v.active ? 'Active' : 'Previous'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{v.fields?.length || 0} fields</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{v.description || ''}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {v.createdAt ? new Date(v.createdAt).toLocaleString() : ''}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
