import { useState, useEffect } from 'react';
import { FileText, CheckCircle2, Star, Plus, Pencil, Trash2, Save, Loader2 } from 'lucide-react';

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

interface DocumentTemplate {
  id: string;
  name: string;
  documentType: string;
  description: string | null;
  htmlTemplate: string | null;
  config: any;
  isDefault: boolean;
  active: boolean;
  createdAt: string;
}

const DOCUMENT_TYPES = [
  { value: 'bol', label: 'Bill of Lading' },
  { value: 'label', label: 'Label' },
  { value: 'customs', label: 'Customs' },
  { value: 'daily_report', label: 'Daily Report' },
];

const typeLabel = (t: string) => DOCUMENT_TYPES.find(d => d.value === t)?.label || t;

const emptyForm = {
  name: '',
  documentType: 'bol',
  description: '',
  htmlTemplate: '',
  config: '{}',
  isDefault: false,
  active: true,
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

export default function VNextDocumentTemplates() {
  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [editing, setEditing] = useState<DocumentTemplate | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadTemplates();
  }, []);

  async function loadTemplates() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/api/v1/document-templates`);
      if (!res.ok) throw new Error('Failed to load document templates');
      const json = await res.json();
      setTemplates(json.data || []);
    } catch (e: any) {
      setError(e.message || 'Failed to load document templates');
    } finally {
      setLoading(false);
    }
  }

  function openCreate() {
    setEditing(null);
    setForm({ ...emptyForm });
    setShowForm(true);
    setSuccess('');
  }

  function openEdit(t: DocumentTemplate) {
    setEditing(t);
    setForm({
      name: t.name,
      documentType: t.documentType,
      description: t.description || '',
      htmlTemplate: t.htmlTemplate || '',
      config: t.config ? JSON.stringify(t.config, null, 2) : '{}',
      isDefault: t.isDefault,
      active: t.active,
    });
    setShowForm(true);
    setSuccess('');
  }

  function cancelForm() {
    setShowForm(false);
    setEditing(null);
    setForm({ ...emptyForm });
  }

  async function saveTemplate() {
    if (!form.name.trim()) {
      setError('Name is required');
      return;
    }
    let parsedConfig: any;
    try {
      parsedConfig = JSON.parse(form.config);
    } catch {
      setError('Config must be valid JSON');
      return;
    }
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const body = {
        name: form.name.trim(),
        documentType: form.documentType,
        description: form.description.trim() || null,
        htmlTemplate: form.htmlTemplate || null,
        config: parsedConfig,
        isDefault: form.isDefault,
        active: form.active,
      };
      const url = editing ? `${API_URL}/api/v1/document-templates/${editing.id}` : `${API_URL}/api/v1/document-templates`;
      const res = await fetch(url, {
        method: editing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || 'Failed to save template');
      }
      setSuccess(editing ? 'Template updated successfully' : 'Template created successfully');
      cancelForm();
      await loadTemplates();
    } catch (e: any) {
      setError(e.message || 'Failed to save template');
    } finally {
      setSaving(false);
    }
  }

  async function deleteTemplate(id: string) {
    if (!confirm('Are you sure you want to delete this template?')) return;
    setError('');
    setSuccess('');
    try {
      const res = await fetch(`${API_URL}/api/v1/document-templates/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete template');
      setSuccess('Template deleted successfully');
      await loadTemplates();
    } catch (e: any) {
      setError(e.message || 'Failed to delete template');
    }
  }

  function truncate(s: string | null, max: number) {
    if (!s) return '';
    return s.length > max ? s.slice(0, max) + '...' : s;
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const stats = [
    { label: 'Total templates', value: templates.length, icon: FileText, tone: 'bg-primary/10 text-primary' },
    { label: 'Active', value: templates.filter(t => t.active).length, icon: CheckCircle2, tone: 'bg-success/15 text-success' },
    { label: 'Default', value: templates.filter(t => t.isDefault).length, icon: Star, tone: 'bg-info/15 text-info' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Document templates</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage templates for BOLs, labels, customs forms, and reports
          </p>
        </div>
        <Button variant="gradient" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          New template
        </Button>
      </div>

      {error && <Banner variant="error" message={error} onClose={() => setError('')} />}
      {success && <Banner variant="success" message={success} onClose={() => setSuccess('')} />}

      <div className="grid gap-4 sm:grid-cols-3">
        {stats.map(s => {
          const Icon = s.icon;
          return (
            <Card key={s.label}>
              <CardContent className="flex items-center gap-3 p-4">
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${s.tone}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-2xl font-semibold">{s.value}</div>
                  <div className="text-xs text-muted-foreground">{s.label}</div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>{editing ? 'Edit template' : 'Create template'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Name *</Label>
                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Template name" />
              </div>
              <div className="space-y-2">
                <Label>Document type</Label>
                <Select value={form.documentType} onValueChange={v => setForm(f => ({ ...f, documentType: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DOCUMENT_TYPES.map(dt => (
                      <SelectItem key={dt.value} value={dt.value}>{dt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <textarea
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Brief description of this template"
                rows={2}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              />
            </div>

            <div className="space-y-2">
              <Label>HTML template</Label>
              <textarea
                value={form.htmlTemplate}
                onChange={e => setForm(f => ({ ...f, htmlTemplate: e.target.value }))}
                placeholder="<html>...</html>"
                rows={10}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              />
            </div>

            <div className="space-y-2">
              <Label>Config (JSON)</Label>
              <textarea
                value={form.config}
                onChange={e => setForm(f => ({ ...f, config: e.target.value }))}
                placeholder="{}"
                rows={4}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              />
            </div>

            <div className="flex flex-wrap items-center gap-6">
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.isDefault}
                  onChange={e => setForm(f => ({ ...f, isDefault: e.target.checked }))}
                  className="h-4 w-4 rounded border border-input bg-background accent-primary"
                />
                Default template
              </label>
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

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={cancelForm}>Cancel</Button>
              <Button variant="gradient" onClick={saveTemplate} disabled={saving}>
                <Save className="h-4 w-4" />
                {saving ? 'Saving...' : editing ? 'Update template' : 'Create template'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Templates</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {templates.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
              <FileText className="h-8 w-8" />
              <h3 className="text-base font-medium">No document templates</h3>
              <p className="text-sm">Create your first template to get started.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Default</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-32">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates.map(t => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">{t.name}</TableCell>
                    <TableCell><Badge variant="info">{typeLabel(t.documentType)}</Badge></TableCell>
                    <TableCell className="text-sm text-muted-foreground">{truncate(t.description, 60)}</TableCell>
                    <TableCell>
                      {t.isDefault && <CheckCircle2 className="h-4 w-4 text-primary" />}
                    </TableCell>
                    <TableCell>
                      <Badge variant={t.active ? 'success' : 'destructive'}>{t.active ? 'Active' : 'Inactive'}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {t.createdAt ? new Date(t.createdAt).toLocaleDateString() : ''}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(t)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => deleteTemplate(t.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
