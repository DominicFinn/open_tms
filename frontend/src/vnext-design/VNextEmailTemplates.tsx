import React, { useState, useEffect } from 'react';
import { Loader2, Plus, Mail, Pencil, Trash2, Eye, Save } from 'lucide-react';

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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';

interface EmailTemplate {
  id: string;
  name: string;
  eventType: string;
  subject: string;
  htmlBody: string;
  textBody: string;
  active: boolean;
  isDefault: boolean;
  description: string;
}

interface TemplateFormData {
  name: string;
  eventType: string;
  subject: string;
  htmlBody: string;
  textBody: string;
  active: boolean;
  description: string;
}

const EMPTY_FORM: TemplateFormData = {
  name: '',
  eventType: '',
  subject: '',
  htmlBody: '',
  textBody: '',
  active: true,
  description: '',
};

function Switch({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={e => onChange(e.target.checked)}
        className="h-4 w-4 rounded border border-input bg-background accent-primary"
      />
      {label}
    </label>
  );
}

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

export default function VNextEmailTemplates() {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [supportedEventTypes, setSupportedEventTypes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [alert, setAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<TemplateFormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const [showPreview, setShowPreview] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');
  const [previewing, setPreviewing] = useState(false);

  useEffect(() => {
    loadTemplates();
  }, []);

  async function loadTemplates() {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/email/templates`);
      if (!res.ok) throw new Error('Failed to load email templates');
      const json = await res.json();
      setTemplates(json.data?.templates || []);
      setSupportedEventTypes(json.data?.supportedEventTypes || []);
    } catch (e: any) {
      setAlert({ type: 'error', message: e.message || 'Failed to load templates' });
    } finally {
      setLoading(false);
    }
  }

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowModal(true);
  }

  function openEdit(template: EmailTemplate) {
    setEditingId(template.id);
    setForm({
      name: template.name,
      eventType: template.eventType,
      subject: template.subject,
      htmlBody: template.htmlBody,
      textBody: template.textBody,
      active: template.active,
      description: template.description || '',
    });
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  }

  function handleFormChange<K extends keyof TemplateFormData>(key: K, value: TemplateFormData[K]) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    setSaving(true);
    setAlert(null);
    try {
      const url = editingId ? `${API_URL}/api/v1/email/templates/${editingId}` : `${API_URL}/api/v1/email/templates`;
      const method = editingId ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || `Failed to ${editingId ? 'update' : 'create'} template`);
      }
      setAlert({ type: 'success', message: `Template ${editingId ? 'updated' : 'created'} successfully.` });
      closeModal();
      await loadTemplates();
    } catch (e: any) {
      setAlert({ type: 'error', message: e.message || 'Failed to save template' });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this template?')) return;
    setAlert(null);
    try {
      const res = await fetch(`${API_URL}/api/v1/email/templates/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete template');
      setAlert({ type: 'success', message: 'Template deleted successfully.' });
      await loadTemplates();
    } catch (e: any) {
      setAlert({ type: 'error', message: e.message || 'Failed to delete template' });
    }
  }

  async function handlePreview() {
    setPreviewing(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/email/templates/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventType: form.eventType,
          subject: form.subject,
          htmlBody: form.htmlBody,
        }),
      });
      if (!res.ok) throw new Error('Failed to generate preview');
      const json = await res.json();
      setPreviewHtml(json.data?.html || json.data?.htmlBody || form.htmlBody);
      setShowPreview(true);
    } catch (e: any) {
      setAlert({ type: 'error', message: e.message || 'Failed to generate preview' });
    } finally {
      setPreviewing(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Email templates</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage email templates for system notifications</p>
        </div>
        <Button variant="gradient" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          New template
        </Button>
      </div>

      {alert && <Banner variant={alert.type} message={alert.message} onClose={() => setAlert(null)} />}

      <Card>
        <CardContent className="p-0">
          {templates.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
              <Mail className="h-8 w-8" />
              <h3 className="text-base font-medium">No email templates</h3>
              <p className="text-sm">Create your first email template to get started.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Event type</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead>Default</TableHead>
                  <TableHead className="w-32">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates.map(t => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">{t.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{t.eventType}</TableCell>
                    <TableCell className="max-w-[200px] truncate text-sm">{t.subject}</TableCell>
                    <TableCell>
                      <Badge variant={t.active ? 'success' : 'secondary'}>{t.active ? 'Active' : 'Inactive'}</Badge>
                    </TableCell>
                    <TableCell>
                      {t.isDefault ? <Badge variant="info">Default</Badge> : <span className="text-muted-foreground">--</span>}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(t)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(t.id)}>
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

      <Dialog open={showModal} onOpenChange={open => !open && closeModal()}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit template' : 'New template'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input value={form.name} onChange={e => handleFormChange('name', e.target.value)} placeholder="e.g. Shipment Confirmation" />
              </div>
              <div className="space-y-2">
                <Label>Event type</Label>
                <Select value={form.eventType} onValueChange={v => handleFormChange('eventType', v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select event type..." />
                  </SelectTrigger>
                  <SelectContent>
                    {supportedEventTypes.map(et => (
                      <SelectItem key={et} value={et}>{et}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Input value={form.description} onChange={e => handleFormChange('description', e.target.value)} placeholder="Brief description of when this template is used" />
            </div>

            <div className="space-y-2">
              <Label>Subject</Label>
              <Input value={form.subject} onChange={e => handleFormChange('subject', e.target.value)} placeholder="Email subject line" />
            </div>

            <div className="space-y-2">
              <Label>HTML body</Label>
              <textarea
                value={form.htmlBody}
                onChange={e => handleFormChange('htmlBody', e.target.value)}
                placeholder="<html>...</html>"
                rows={10}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              />
            </div>

            <div className="space-y-2">
              <Label>Text body</Label>
              <textarea
                value={form.textBody}
                onChange={e => handleFormChange('textBody', e.target.value)}
                placeholder="Plain text version of the email"
                rows={5}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              />
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <Switch label="Template is active" checked={form.active} onChange={v => handleFormChange('active', v)} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handlePreview} disabled={previewing || !form.htmlBody}>
              <Eye className="h-4 w-4" />
              {previewing ? 'Loading...' : 'Preview'}
            </Button>
            <Button variant="outline" onClick={closeModal}>Cancel</Button>
            <Button variant="gradient" onClick={handleSave} disabled={saving}>
              <Save className="h-4 w-4" />
              {saving ? 'Saving...' : editingId ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Email preview</DialogTitle>
          </DialogHeader>
          <div
            className="min-h-[300px] rounded-md border bg-background p-4"
            dangerouslySetInnerHTML={{ __html: previewHtml }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
