import React, { useState, useEffect } from 'react';
import { API_URL } from '../api';
import {
  VnPageHeader,
  VnCard,
  VnButton,
  VnChip,
  VnField,
  VnInput,
  VnSelect,
  VnTextarea,
  VnFormGrid,
  VnFormActions,
  VnDataTable,
  VnModal,
  VnAlert,
} from './components';

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

function Switch({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="vn-switch">
      <input
        type="checkbox"
        checked={checked}
        onChange={e => onChange(e.target.checked)}
      />
      <span className="vn-switch-track" />
      {label}
    </label>
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
      const url = editingId
        ? `${API_URL}/api/v1/email/templates/${editingId}`
        : `${API_URL}/api/v1/email/templates`;
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

  const columns: { key: string; label: string; render?: (row: any) => React.ReactNode }[] = [
    { key: 'name', label: 'Name' },
    { key: 'eventType', label: 'Event Type' },
    {
      key: 'subject',
      label: 'Subject',
      render: (row: EmailTemplate) => (
        <span style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'inline-block' }}>
          {row.subject}
        </span>
      ),
    },
    {
      key: 'active',
      label: 'Active',
      render: (row: EmailTemplate) => (
        <VnChip variant={row.active ? 'success' : 'secondary'}>
          {row.active ? 'Active' : 'Inactive'}
        </VnChip>
      ),
    },
    {
      key: 'isDefault',
      label: 'Default',
      render: (row: EmailTemplate) => (
        row.isDefault ? <VnChip variant="primary">Default</VnChip> : <span style={{ color: 'var(--on-surface-variant)' }}>--</span>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (row: EmailTemplate) => (
        <div style={{ display: 'flex', gap: '4px' }}>
          <VnButton variant="ghost" size="sm" icon="edit" iconOnly onClick={() => openEdit(row)} />
          <VnButton variant="ghost" size="sm" icon="delete" iconOnly onClick={() => handleDelete(row.id)} />
        </div>
      ),
    },
  ];

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '48px' }}>
        <div className="loading-spinner" />
      </div>
    );
  }

  return (
    <div className="vn-page">
      <VnPageHeader title="Email Templates" subtitle="Manage email templates for system notifications">
        <VnButton variant="primary" icon="add" onClick={openCreate}>
          New Template
        </VnButton>
      </VnPageHeader>

      {alert && (
        <div style={{ marginBottom: '16px' }}>
          <VnAlert variant={alert.type} onClose={() => setAlert(null)}>
            {alert.message}
          </VnAlert>
        </div>
      )}

      <VnCard>
        <VnDataTable
          columns={columns}
          data={templates as any}
          emptyIcon="mail"
          emptyTitle="No email templates"
          emptyMessage="Create your first email template to get started."
        />
      </VnCard>

      <VnModal
        open={showModal}
        onClose={closeModal}
        title={editingId ? 'Edit Template' : 'New Template'}
        size="lg"
        footer={
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', width: '100%' }}>
            <VnButton variant="outline" icon="visibility" onClick={handlePreview} disabled={previewing || !form.htmlBody}>
              {previewing ? 'Loading...' : 'Preview'}
            </VnButton>
            <VnButton variant="outline" onClick={closeModal}>Cancel</VnButton>
            <VnButton variant="primary" icon="save" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : editingId ? 'Update' : 'Create'}
            </VnButton>
          </div>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <VnFormGrid>
            <VnField label="Name" required>
              <VnInput
                value={form.name}
                onChange={e => handleFormChange('name', e.target.value)}
                placeholder="e.g. Shipment Confirmation"
              />
            </VnField>
            <VnField label="Event Type" required>
              <VnSelect
                value={form.eventType}
                onChange={e => handleFormChange('eventType', e.target.value)}
              >
                <option value="">Select event type...</option>
                {supportedEventTypes.map(et => (
                  <option key={et} value={et}>{et}</option>
                ))}
              </VnSelect>
            </VnField>
          </VnFormGrid>

          <VnField label="Description">
            <VnInput
              value={form.description}
              onChange={e => handleFormChange('description', e.target.value)}
              placeholder="Brief description of when this template is used"
            />
          </VnField>

          <VnField label="Subject" required>
            <VnInput
              value={form.subject}
              onChange={e => handleFormChange('subject', e.target.value)}
              placeholder="Email subject line"
            />
          </VnField>

          <VnField label="HTML Body">
            <VnTextarea
              value={form.htmlBody}
              onChange={e => handleFormChange('htmlBody', e.target.value)}
              placeholder="<html>...</html>"
              rows={10}
              style={{ fontFamily: 'monospace', fontSize: '13px' }}
            />
          </VnField>

          <VnField label="Text Body">
            <VnTextarea
              value={form.textBody}
              onChange={e => handleFormChange('textBody', e.target.value)}
              placeholder="Plain text version of the email"
              rows={5}
            />
          </VnField>

          <VnField label="Status">
            <div style={{ marginTop: '4px' }}>
              <Switch
                label="Template is active"
                checked={form.active}
                onChange={v => handleFormChange('active', v)}
              />
            </div>
          </VnField>
        </div>
      </VnModal>

      <VnModal
        open={showPreview}
        onClose={() => setShowPreview(false)}
        title="Email Preview"
        size="xl"
      >
        <div
          style={{
            border: '1px solid var(--outline-variant)',
            borderRadius: '8px',
            padding: '16px',
            background: 'var(--surface-container-lowest)',
            minHeight: '300px',
          }}
          dangerouslySetInnerHTML={{ __html: previewHtml }}
        />
      </VnModal>
    </div>
  );
}
