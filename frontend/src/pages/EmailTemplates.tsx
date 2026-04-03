import React, { useState, useEffect } from 'react';
import { API_URL } from '../api';

interface EmailTemplate {
  id: string;
  name: string;
  eventType: string;
  description: string | null;
  subject: string;
  htmlBody: string;
  textBody: string | null;
  active: boolean;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

const EVENT_TYPE_LABELS: Record<string, string> = {
  'shipment.status_changed': 'Shipment Status Changed',
  'shipment.created': 'Shipment Created',
  'shipment.delivered': 'Shipment Delivered',
  'shipment.exception': 'Shipment Exception',
  'order.status_changed': 'Order Status Changed',
  'order.delivered': 'Order Delivered',
  'order.exception': 'Order Exception',
};

const PLACEHOLDER_DOCS: Record<string, string[]> = {
  'shipment.status_changed': ['{{shipmentReference}}', '{{previousStatus}}', '{{newStatus}}'],
  'shipment.created': ['{{shipmentReference}}', '{{status}}'],
  'shipment.delivered': ['{{shipmentReference}}', '{{deliveredAt}}'],
  'shipment.exception': ['{{shipmentReference}}', '{{exceptionType}}', '{{description}}'],
  'order.status_changed': ['{{orderReference}}', '{{previousStatus}}', '{{newStatus}}'],
  'order.delivered': ['{{orderReference}}'],
  'order.exception': ['{{orderReference}}', '{{exceptionType}}', '{{description}}'],
};

export default function EmailTemplatesPage() {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [supportedTypes, setSupportedTypes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<EmailTemplate | null>(null);
  const [creating, setCreating] = useState(false);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [alert, setAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Form state
  const [formName, setFormName] = useState('');
  const [formEventType, setFormEventType] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formSubject, setFormSubject] = useState('');
  const [formHtmlBody, setFormHtmlBody] = useState('');
  const [formTextBody, setFormTextBody] = useState('');
  const [formActive, setFormActive] = useState(true);

  const fetchTemplates = async () => {
    try {
      const res = await fetch(`${API_URL}/api/v1/email/templates`);
      const data = await res.json();
      if (data.data) {
        setTemplates(data.data.templates || []);
        setSupportedTypes(data.data.supportedEventTypes || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchTemplates(); }, []);

  const openCreate = (eventType?: string) => {
    setEditing(null);
    setCreating(true);
    setFormName(eventType ? (EVENT_TYPE_LABELS[eventType] || eventType) : '');
    setFormEventType(eventType || '');
    setFormDescription('');
    setFormSubject('');
    setFormHtmlBody('');
    setFormTextBody('');
    setFormActive(true);
    setPreviewHtml(null);
    setAlert(null);
  };

  const openEdit = (tpl: EmailTemplate) => {
    setCreating(false);
    setEditing(tpl);
    setFormName(tpl.name);
    setFormEventType(tpl.eventType);
    setFormDescription(tpl.description || '');
    setFormSubject(tpl.subject);
    setFormHtmlBody(tpl.htmlBody);
    setFormTextBody(tpl.textBody || '');
    setFormActive(tpl.active);
    setPreviewHtml(null);
    setAlert(null);
  };

  const closeEditor = () => {
    setEditing(null);
    setCreating(false);
    setPreviewHtml(null);
    setAlert(null);
  };

  const handleSave = async () => {
    setSaving(true);
    setAlert(null);
    try {
      const body: any = {
        name: formName,
        description: formDescription || undefined,
        subject: formSubject,
        htmlBody: formHtmlBody,
        textBody: formTextBody || undefined,
        active: formActive,
      };

      let res: Response;
      if (creating) {
        body.eventType = formEventType;
        res = await fetch(`${API_URL}/api/v1/email/templates`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      } else {
        res = await fetch(`${API_URL}/api/v1/email/templates/${editing!.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      }

      const data = await res.json();
      if (data.error) {
        setAlert({ type: 'error', message: data.error });
      } else {
        setAlert({ type: 'success', message: creating ? 'Template created.' : 'Template updated.' });
        await fetchTemplates();
        if (creating) {
          setCreating(false);
          setEditing(data.data);
        }
      }
    } catch (err) {
      setAlert({ type: 'error', message: (err as Error).message });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this email template?')) return;
    try {
      await fetch(`${API_URL}/api/v1/email/templates/${id}`, { method: 'DELETE' });
      await fetchTemplates();
      closeEditor();
    } catch (err) {
      console.error(err);
    }
  };

  const handlePreview = async () => {
    try {
      const res = await fetch(`${API_URL}/api/v1/email/templates/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: formSubject,
          htmlBody: formHtmlBody,
          textBody: formTextBody || undefined,
          eventType: formEventType || (editing?.eventType),
        }),
      });
      const data = await res.json();
      if (data.data?.html) {
        setPreviewHtml(data.data.html);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Which event types don't have templates yet?
  const existingTypes = new Set(templates.map((t) => t.eventType));
  const missingTypes = supportedTypes.filter((t) => !existingTypes.has(t));

  if (loading) {
    return <div className="loading-spinner-page"><div className="loading-spinner" /></div>;
  }

  // Editor view
  if (editing || creating) {
    const placeholders = PLACEHOLDER_DOCS[formEventType] || [];

    return (
      <div style={{ padding: '24px', maxWidth: '960px' }}>
        <div className="page-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button className="icon-btn" onClick={closeEditor} title="Back">
              <span className="material-icons">arrow_back</span>
            </button>
            <h1>{creating ? 'Create Email Template' : 'Edit Email Template'}</h1>
          </div>
        </div>

        {alert && (
          <div className={`alert alert-${alert.type}`} style={{ marginBottom: '16px' }}>
            {alert.message}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          {/* Left: Editor */}
          <div>
            <div className="card" style={{ marginBottom: '16px' }}>
              <h3 style={{ margin: '0 0 16px' }}>Template Details</h3>
              <div className="form-grid" style={{ gridTemplateColumns: '1fr' }}>
                <div>
                  <label className="field-label">Name</label>
                  <input
                    type="text"
                    className="text-field"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="Shipment Status Update"
                  />
                </div>
                {creating && (
                  <div>
                    <label className="field-label">Event Type</label>
                    <select
                      className="text-field"
                      value={formEventType}
                      onChange={(e) => setFormEventType(e.target.value)}
                    >
                      <option value="">Select event type...</option>
                      {supportedTypes.map((t) => (
                        <option key={t} value={t} disabled={existingTypes.has(t)}>
                          {EVENT_TYPE_LABELS[t] || t} {existingTypes.has(t) ? '(exists)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                {!creating && (
                  <div>
                    <label className="field-label">Event Type</label>
                    <input type="text" className="text-field" value={EVENT_TYPE_LABELS[formEventType] || formEventType} disabled />
                  </div>
                )}
                <div>
                  <label className="field-label">Description</label>
                  <input
                    type="text"
                    className="text-field"
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    placeholder="Optional description"
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <label className="switch">
                    <input
                      type="checkbox"
                      checked={formActive}
                      onChange={(e) => setFormActive(e.target.checked)}
                    />
                    <span className="switch-slider"></span>
                  </label>
                  <span>Active</span>
                </div>
              </div>
            </div>

            <div className="card" style={{ marginBottom: '16px' }}>
              <h3 style={{ margin: '0 0 16px' }}>Content</h3>
              {placeholders.length > 0 && (
                <div style={{
                  padding: '8px 12px',
                  background: 'var(--surface-container)',
                  borderRadius: '6px',
                  marginBottom: '12px',
                  fontSize: '13px',
                  color: 'var(--on-surface-variant)',
                }}>
                  <strong>Available placeholders:</strong> {placeholders.join(', ')}
                </div>
              )}
              <div className="form-grid" style={{ gridTemplateColumns: '1fr' }}>
                <div>
                  <label className="field-label">Subject Line</label>
                  <input
                    type="text"
                    className="text-field"
                    value={formSubject}
                    onChange={(e) => setFormSubject(e.target.value)}
                    placeholder='Shipment {{shipmentReference}} — {{newStatus}}'
                  />
                </div>
                <div>
                  <label className="field-label">HTML Body</label>
                  <textarea
                    className="text-field"
                    value={formHtmlBody}
                    onChange={(e) => setFormHtmlBody(e.target.value)}
                    rows={12}
                    style={{ fontFamily: 'monospace', fontSize: '13px' }}
                    placeholder="<h2>Status Update</h2><p>Shipment {{shipmentReference}} changed to {{newStatus}}</p>"
                  />
                  <span className="field-hint">Use Handlebars syntax. The body is wrapped in your org's branded email layout.</span>
                </div>
                <div>
                  <label className="field-label">Plain Text (optional)</label>
                  <textarea
                    className="text-field"
                    value={formTextBody}
                    onChange={(e) => setFormTextBody(e.target.value)}
                    rows={4}
                    style={{ fontFamily: 'monospace', fontSize: '13px' }}
                    placeholder="Auto-generated from HTML if left empty"
                  />
                </div>
              </div>
            </div>

            <div className="form-actions">
              <button className="button" onClick={handleSave} disabled={saving || !formName || !formSubject || !formHtmlBody}>
                {saving ? 'Saving...' : (creating ? 'Create Template' : 'Save Changes')}
              </button>
              <button className="button-outline" onClick={handlePreview} disabled={!formHtmlBody}>
                Preview
              </button>
              {editing && (
                <button className="button-danger" onClick={() => handleDelete(editing.id)} style={{ marginLeft: 'auto' }}>
                  Delete
                </button>
              )}
            </div>
          </div>

          {/* Right: Preview */}
          <div>
            <div className="card" style={{ height: '100%' }}>
              <h3 style={{ margin: '0 0 16px' }}>Preview</h3>
              {previewHtml ? (
                <div style={{
                  border: '1px solid var(--outline-variant)',
                  borderRadius: '6px',
                  overflow: 'hidden',
                  background: 'var(--surface-container-lowest)',
                }}>
                  <iframe
                    srcDoc={previewHtml}
                    style={{ width: '100%', height: '500px', border: 'none' }}
                    title="Email Preview"
                    sandbox=""
                  />
                </div>
              ) : (
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '300px',
                  color: 'var(--on-surface-variant)',
                  textAlign: 'center',
                }}>
                  <span className="material-icons" style={{ fontSize: '48px', marginBottom: '12px', opacity: 0.3 }}>
                    email
                  </span>
                  <p>Click "Preview" to see the rendered email with sample data.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // List view
  return (
    <div style={{ padding: '24px', maxWidth: '960px' }}>
      <div className="page-header">
        <h1>Email Templates</h1>
        <p style={{ color: 'var(--on-surface-variant)', margin: '4px 0 0' }}>
          Customize the emails sent for each event type. Templates use Handlebars syntax.
        </p>
      </div>

      {/* Existing templates */}
      {templates.length > 0 && (
        <div className="card" style={{ marginBottom: '16px' }}>
          <h3 style={{ margin: '0 0 12px' }}>Custom Templates</h3>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Event Type</th>
                  <th>Subject</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {templates.map((tpl) => (
                  <tr key={tpl.id}>
                    <td><strong>{tpl.name}</strong></td>
                    <td>
                      <span className="chip chip-info" style={{ fontSize: '12px' }}>
                        {EVENT_TYPE_LABELS[tpl.eventType] || tpl.eventType}
                      </span>
                    </td>
                    <td style={{ color: 'var(--on-surface-variant)', fontSize: '13px' }}>{tpl.subject}</td>
                    <td>
                      <span className={`chip chip-${tpl.active ? 'success' : 'secondary'}`}>
                        {tpl.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <button className="icon-btn" onClick={() => openEdit(tpl)} title="Edit">
                        <span className="material-icons">edit</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Missing event types — can create templates for these */}
      {missingTypes.length > 0 && (
        <div className="card">
          <h3 style={{ margin: '0 0 8px' }}>Available Event Types</h3>
          <p style={{ color: 'var(--on-surface-variant)', fontSize: '14px', marginBottom: '16px' }}>
            These event types use default templates. Create a custom template to override.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {missingTypes.map((eventType) => (
              <div
                key={eventType}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 16px',
                  background: 'var(--surface-container)',
                  borderRadius: '8px',
                }}
              >
                <div>
                  <strong>{EVENT_TYPE_LABELS[eventType] || eventType}</strong>
                  <div style={{ fontSize: '13px', color: 'var(--on-surface-variant)' }}>
                    {eventType} — using default template
                  </div>
                </div>
                <button className="button-outline" onClick={() => openCreate(eventType)}>
                  Customize
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {templates.length === 0 && missingTypes.length === 0 && (
        <div className="alert alert-info">
          No event types configured for email templates.
        </div>
      )}
    </div>
  );
}
