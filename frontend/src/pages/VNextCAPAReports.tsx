import { useState, useEffect } from 'react';
import { API_URL } from '../api';

interface CAPAReport {
  id: string;
  orgId: string;
  issueId: string;
  shipmentId: string | null;
  reportNumber: string;
  title: string;
  status: string;
  priority: string;
  description: string;
  immediateAction: string | null;
  containmentAction: string | null;
  investigationDetails: string | null;
  rootCause: string | null;
  rootCauseCategory: string | null;
  correctiveAction: string | null;
  correctiveActionDueDate: string | null;
  correctiveActionCompletedDate: string | null;
  preventiveAction: string | null;
  preventiveActionDueDate: string | null;
  preventiveActionCompletedDate: string | null;
  investigatorId: string | null;
  investigatorName: string | null;
  approverId: string | null;
  approverName: string | null;
  approvedAt: string | null;
  affectedProducts: string[] | null;
  affectedShipmentIds: string[] | null;
  affectedLocationIds: string[] | null;
  eventTimeline: any | null;
  temperatureData: any | null;
  verificationMethod: string | null;
  verifiedById: string | null;
  verifiedByName: string | null;
  verifiedAt: string | null;
  effectivenessCheck: string | null;
  lessonsLearned: string | null;
  createdAt: string;
  updatedAt: string;
  issue?: { id: string; title: string; status: string; category: string };
  shipment?: { id: string; reference: string; status: string };
}

interface FormData {
  title: string;
  issueId: string;
  shipmentId: string;
  priority: string;
  description: string;
  immediateAction: string;
  containmentAction: string;
  investigationDetails: string;
  rootCause: string;
  rootCauseCategory: string;
  correctiveAction: string;
  correctiveActionDueDate: string;
  preventiveAction: string;
  preventiveActionDueDate: string;
  investigatorName: string;
  approverName: string;
  verificationMethod: string;
  verifiedByName: string;
  effectivenessCheck: string;
  lessonsLearned: string;
}

const EMPTY_FORM: FormData = {
  title: '',
  issueId: '',
  shipmentId: '',
  priority: 'medium',
  description: '',
  immediateAction: '',
  containmentAction: '',
  investigationDetails: '',
  rootCause: '',
  rootCauseCategory: '',
  correctiveAction: '',
  correctiveActionDueDate: '',
  preventiveAction: '',
  preventiveActionDueDate: '',
  investigatorName: '',
  approverName: '',
  verificationMethod: '',
  verifiedByName: '',
  effectivenessCheck: '',
  lessonsLearned: '',
};

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft' },
  { value: 'investigation', label: 'Investigation' },
  { value: 'root_cause_identified', label: 'Root Cause Identified' },
  { value: 'action_plan', label: 'Action Plan' },
  { value: 'implementation', label: 'Implementation' },
  { value: 'verification', label: 'Verification' },
  { value: 'closed', label: 'Closed' },
];

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' },
];

const ROOT_CAUSE_CATEGORIES = [
  { value: '', label: 'Select category...' },
  { value: 'equipment', label: 'Equipment' },
  { value: 'process', label: 'Process' },
  { value: 'personnel', label: 'Personnel' },
  { value: 'environmental', label: 'Environmental' },
  { value: 'material', label: 'Material' },
  { value: 'other', label: 'Other' },
];

function statusChipClass(status: string): string {
  switch (status) {
    case 'draft': return 'vn-chip-secondary';
    case 'investigation': return 'vn-chip-info';
    case 'root_cause_identified': return 'vn-chip-warning';
    case 'action_plan': return 'vn-chip-primary';
    case 'implementation': return 'vn-chip-primary';
    case 'verification': return 'vn-chip-info';
    case 'closed': return 'vn-chip-success';
    default: return 'vn-chip-secondary';
  }
}

function priorityChipClass(priority: string): string {
  switch (priority) {
    case 'low': return 'vn-chip-secondary';
    case 'medium': return 'vn-chip-info';
    case 'high': return 'vn-chip-warning';
    case 'critical': return 'vn-chip-error';
    default: return 'vn-chip-secondary';
  }
}

function formatStatusLabel(status: string): string {
  return STATUS_OPTIONS.find(s => s.value === status)?.label || status;
}

function formatPriorityLabel(priority: string): string {
  return PRIORITY_OPTIONS.find(p => p.value === priority)?.label || priority;
}

function formatDate(d: string | null): string {
  if (!d) return '\u2014';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function isOverdue(report: CAPAReport): boolean {
  if (report.status === 'closed') return false;
  if (!report.correctiveActionDueDate) return false;
  if (report.correctiveActionCompletedDate) return false;
  return new Date(report.correctiveActionDueDate) < new Date();
}

export default function VNextCAPAReports() {
  const [reports, setReports] = useState<CAPAReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingReport, setEditingReport] = useState<CAPAReport | null>(null);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    loadReports();
  }, []);

  async function loadReports() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/api/v1/cold-chain/capa`);
      if (!res.ok) throw new Error(`Failed to load CAPA reports (${res.status})`);
      const json = await res.json();
      setReports(json.data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load CAPA reports');
    } finally {
      setLoading(false);
    }
  }

  function openCreate() {
    setEditingReport(null);
    setForm(EMPTY_FORM);
    setSubmitError('');
    setShowModal(true);
  }

  async function openEdit(id: string) {
    setSubmitError('');
    try {
      const res = await fetch(`${API_URL}/api/v1/cold-chain/capa/${id}`);
      if (!res.ok) throw new Error('Failed to load report');
      const json = await res.json();
      const r: CAPAReport = json.data;
      setEditingReport(r);
      setForm({
        title: r.title || '',
        issueId: r.issueId || '',
        shipmentId: r.shipmentId || '',
        priority: r.priority || 'medium',
        description: r.description || '',
        immediateAction: r.immediateAction || '',
        containmentAction: r.containmentAction || '',
        investigationDetails: r.investigationDetails || '',
        rootCause: r.rootCause || '',
        rootCauseCategory: r.rootCauseCategory || '',
        correctiveAction: r.correctiveAction || '',
        correctiveActionDueDate: r.correctiveActionDueDate ? r.correctiveActionDueDate.slice(0, 10) : '',
        preventiveAction: r.preventiveAction || '',
        preventiveActionDueDate: r.preventiveActionDueDate ? r.preventiveActionDueDate.slice(0, 10) : '',
        investigatorName: r.investigatorName || '',
        approverName: r.approverName || '',
        verificationMethod: r.verificationMethod || '',
        verifiedByName: r.verifiedByName || '',
        effectivenessCheck: r.effectivenessCheck || '',
        lessonsLearned: r.lessonsLearned || '',
      });
      setShowModal(true);
    } catch (err: any) {
      setError(err.message || 'Failed to load report for editing');
    }
  }

  async function handleSubmit() {
    if (!form.title.trim() || !form.issueId.trim() || !form.description.trim()) {
      setSubmitError('Title, Issue ID, and Description are required.');
      return;
    }
    setSubmitting(true);
    setSubmitError('');
    try {
      const body: Record<string, any> = {
        title: form.title.trim(),
        issueId: form.issueId.trim(),
        shipmentId: form.shipmentId.trim() || null,
        priority: form.priority,
        description: form.description.trim(),
        immediateAction: form.immediateAction.trim() || null,
        containmentAction: form.containmentAction.trim() || null,
        investigationDetails: form.investigationDetails.trim() || null,
        rootCause: form.rootCause.trim() || null,
        rootCauseCategory: form.rootCauseCategory || null,
        correctiveAction: form.correctiveAction.trim() || null,
        correctiveActionDueDate: form.correctiveActionDueDate || null,
        preventiveAction: form.preventiveAction.trim() || null,
        preventiveActionDueDate: form.preventiveActionDueDate || null,
        investigatorName: form.investigatorName.trim() || null,
        approverName: form.approverName.trim() || null,
        verificationMethod: form.verificationMethod.trim() || null,
        verifiedByName: form.verifiedByName.trim() || null,
        effectivenessCheck: form.effectivenessCheck.trim() || null,
        lessonsLearned: form.lessonsLearned.trim() || null,
      };

      const isEdit = !!editingReport;
      const url = isEdit
        ? `${API_URL}/api/v1/cold-chain/capa/${editingReport!.id}`
        : `${API_URL}/api/v1/cold-chain/capa`;
      const res = await fetch(url, {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`Failed to ${isEdit ? 'update' : 'create'} CAPA report`);
      const json = await res.json();
      if (json.error) throw new Error(json.error);

      setShowModal(false);
      setEditingReport(null);
      setForm(EMPTY_FORM);
      await loadReports();
    } catch (err: any) {
      setSubmitError(err.message || 'Failed to save CAPA report');
    } finally {
      setSubmitting(false);
    }
  }

  function closeModal() {
    setShowModal(false);
    setEditingReport(null);
    setForm(EMPTY_FORM);
    setSubmitError('');
  }

  function updateField(field: keyof FormData, value: string) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  // Filtering
  const filtered = reports.filter(r => {
    if (statusFilter !== 'all' && r.status !== statusFilter) return false;
    if (priorityFilter !== 'all' && r.priority !== priorityFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        r.reportNumber.toLowerCase().includes(q) ||
        r.title.toLowerCase().includes(q)
      );
    }
    return true;
  });

  // Stats
  const totalCount = reports.length;
  const openCount = reports.filter(r => r.status !== 'closed').length;
  const overdueCount = reports.filter(r => isOverdue(r)).length;
  const closedCount = reports.filter(r => r.status === 'closed').length;

  // Keyboard escape for modal
  useEffect(() => {
    if (!showModal) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') closeModal(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [showModal]);

  if (loading) {
    return (
      <div className="vn-empty">
        <span className="material-icons" style={{ animation: 'spin 1s linear infinite' }}>refresh</span>
        <h3>Loading...</h3>
      </div>
    );
  }

  if (error && reports.length === 0) {
    return (
      <div className="vn-alert vn-alert-error">
        <span className="material-icons">error</span>
        <div className="vn-alert-content">{error}</div>
      </div>
    );
  }

  const isEdit = !!editingReport;

  return (
    <>
      {/* Page Header */}
      <div className="vn-page-header">
        <div>
          <h1>CAPA Reports</h1>
          <p>Corrective and preventive action tracking for quality management</p>
        </div>
        <div className="vn-page-actions">
          <button className="vn-btn vn-btn-primary" onClick={openCreate}>
            <span className="material-icons">add</span>
            New CAPA Report
          </button>
        </div>
      </div>

      {error && (
        <div className="vn-alert vn-alert-error" style={{ marginBottom: 16 }}>
          <span className="material-icons">error</span>
          <div className="vn-alert-content">{error}</div>
        </div>
      )}

      {/* Stats */}
      <div className="vn-stats">
        <div className="vn-stat">
          <div className="vn-stat-icon primary">
            <span className="material-icons">assignment</span>
          </div>
          <div>
            <div className="vn-stat-value">{totalCount}</div>
            <div className="vn-stat-label">Total Reports</div>
          </div>
        </div>
        <div className="vn-stat">
          <div className="vn-stat-icon info">
            <span className="material-icons">pending_actions</span>
          </div>
          <div>
            <div className="vn-stat-value">{openCount}</div>
            <div className="vn-stat-label">Open</div>
          </div>
        </div>
        <div className="vn-stat">
          <div className="vn-stat-icon error">
            <span className="material-icons">schedule</span>
          </div>
          <div>
            <div className="vn-stat-value">{overdueCount}</div>
            <div className="vn-stat-label">Overdue</div>
          </div>
        </div>
        <div className="vn-stat">
          <div className="vn-stat-icon success">
            <span className="material-icons">check_circle</span>
          </div>
          <div>
            <div className="vn-stat-value">{closedCount}</div>
            <div className="vn-stat-label">Closed</div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="vn-filter-bar" style={{ marginBottom: 16 }}>
        <div className="vn-search">
          <span className="material-icons">search</span>
          <input
            type="text"
            placeholder="Search by report number or title..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select
          className="vn-select"
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
        >
          <option value="all">All Statuses</option>
          {STATUS_OPTIONS.map(s => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
        <select
          className="vn-select"
          value={priorityFilter}
          onChange={e => setPriorityFilter(e.target.value)}
        >
          <option value="all">All Priorities</option>
          {PRIORITY_OPTIONS.map(p => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="vn-empty">
          <span className="material-icons">assignment</span>
          <h3>No CAPA reports found</h3>
          <p>Create a new CAPA report to begin tracking corrective and preventive actions.</p>
        </div>
      ) : (
        <div className="vn-card">
          <div className="vn-card-body vn-card-flush">
            <div className="vn-table-wrap">
              <table className="vn-table">
                <thead>
                  <tr>
                    <th>Report #</th>
                    <th>Title</th>
                    <th>Issue</th>
                    <th>Status</th>
                    <th>Priority</th>
                    <th>Investigator</th>
                    <th>Due Date</th>
                    <th>Created</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(report => (
                    <tr key={report.id}>
                      <td>
                        <span className="vn-table-id">{report.reportNumber}</span>
                      </td>
                      <td style={{ fontWeight: 500, color: 'var(--on-surface)' }}>
                        {report.title}
                      </td>
                      <td>
                        {report.issue ? (
                          <span className="vn-table-secondary">{report.issue.title}</span>
                        ) : (
                          <span style={{ color: 'var(--on-surface-variant)', fontSize: 13 }}>{report.issueId.slice(0, 8)}...</span>
                        )}
                      </td>
                      <td>
                        <span className={`vn-chip ${statusChipClass(report.status)}`}>
                          {formatStatusLabel(report.status)}
                        </span>
                      </td>
                      <td>
                        <span className={`vn-chip ${priorityChipClass(report.priority)}`}>
                          {formatPriorityLabel(report.priority)}
                        </span>
                      </td>
                      <td style={{ fontSize: 13, color: 'var(--on-surface-variant)' }}>
                        {report.investigatorName || '\u2014'}
                      </td>
                      <td>
                        {report.correctiveActionDueDate ? (
                          <span style={{
                            fontSize: 13,
                            color: isOverdue(report) ? 'var(--error)' : 'var(--on-surface-variant)',
                            fontWeight: isOverdue(report) ? 600 : 400,
                          }}>
                            {formatDate(report.correctiveActionDueDate)}
                            {isOverdue(report) && (
                              <span className="material-icons" style={{ fontSize: 14, marginLeft: 4, verticalAlign: 'middle' }}>warning</span>
                            )}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--on-surface-variant)', fontSize: 13 }}>{'\u2014'}</span>
                        )}
                      </td>
                      <td style={{ fontSize: 13, color: 'var(--on-surface-variant)' }}>
                        {formatDate(report.createdAt)}
                      </td>
                      <td>
                        <button
                          className="vn-btn-icon"
                          title="Edit report"
                          onClick={() => openEdit(report.id)}
                        >
                          <span className="material-icons" style={{ fontSize: 18 }}>edit</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Create / Edit Modal */}
      {showModal && (
        <div
          className="vn-modal-backdrop"
          onClick={e => { if (e.target === e.currentTarget) closeModal(); }}
        >
          <div className="vn-modal vn-modal-xl" style={{ maxWidth: 960 }}>
            <div className="vn-modal-header">
              <h2>{isEdit ? 'Edit CAPA Report' : 'New CAPA Report'}</h2>
              <button className="vn-modal-close" onClick={closeModal}>
                <span className="material-icons">close</span>
              </button>
            </div>
            <div className="vn-modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>

              {submitError && (
                <div className="vn-alert vn-alert-error" style={{ marginBottom: 16 }}>
                  <span className="material-icons">error</span>
                  <div className="vn-alert-content">{submitError}</div>
                </div>
              )}

              {/* Section 1: Problem Identification */}
              <div className="vn-form-section">
                <h3 className="vn-form-section-title">
                  <span className="material-icons">report_problem</span>
                  Problem Identification
                </h3>
                <div className="vn-form-grid">
                  <div className="vn-field vn-col-span-2">
                    <label className="vn-field-label">
                      Title <span className="required">*</span>
                    </label>
                    <input
                      className="vn-input"
                      type="text"
                      placeholder="Brief title for the CAPA report"
                      value={form.title}
                      onChange={e => updateField('title', e.target.value)}
                    />
                  </div>
                  <div className="vn-field">
                    <label className="vn-field-label">
                      Issue ID <span className="required">*</span>
                    </label>
                    <input
                      className="vn-input"
                      type="text"
                      placeholder="Linked issue ID"
                      value={form.issueId}
                      onChange={e => updateField('issueId', e.target.value)}
                    />
                  </div>
                  <div className="vn-field">
                    <label className="vn-field-label">Shipment ID</label>
                    <input
                      className="vn-input"
                      type="text"
                      placeholder="Optional shipment ID"
                      value={form.shipmentId}
                      onChange={e => updateField('shipmentId', e.target.value)}
                    />
                  </div>
                  <div className="vn-field">
                    <label className="vn-field-label">Priority</label>
                    <select
                      className="vn-select"
                      value={form.priority}
                      onChange={e => updateField('priority', e.target.value)}
                    >
                      {PRIORITY_OPTIONS.map(p => (
                        <option key={p.value} value={p.value}>{p.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="vn-field vn-col-span-2">
                    <label className="vn-field-label">
                      Description <span className="required">*</span>
                    </label>
                    <textarea
                      className="vn-textarea"
                      rows={4}
                      placeholder="Detailed description of the issue..."
                      value={form.description}
                      onChange={e => updateField('description', e.target.value)}
                    />
                  </div>
                  <div className="vn-field vn-col-span-2">
                    <label className="vn-field-label">Immediate Action</label>
                    <textarea
                      className="vn-textarea"
                      rows={3}
                      placeholder="Actions taken immediately to address the issue..."
                      value={form.immediateAction}
                      onChange={e => updateField('immediateAction', e.target.value)}
                    />
                  </div>
                  <div className="vn-field vn-col-span-2">
                    <label className="vn-field-label">Containment Action</label>
                    <textarea
                      className="vn-textarea"
                      rows={3}
                      placeholder="Short-term containment measures..."
                      value={form.containmentAction}
                      onChange={e => updateField('containmentAction', e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* Section 2: Investigation */}
              <div className="vn-form-section">
                <h3 className="vn-form-section-title">
                  <span className="material-icons">search</span>
                  Investigation
                </h3>
                <div className="vn-form-grid">
                  <div className="vn-field vn-col-span-2">
                    <label className="vn-field-label">Investigation Details</label>
                    <textarea
                      className="vn-textarea"
                      rows={4}
                      placeholder="Details of the investigation conducted..."
                      value={form.investigationDetails}
                      onChange={e => updateField('investigationDetails', e.target.value)}
                    />
                  </div>
                  <div className="vn-field vn-col-span-2">
                    <label className="vn-field-label">Root Cause</label>
                    <textarea
                      className="vn-textarea"
                      rows={3}
                      placeholder="Identified root cause of the issue..."
                      value={form.rootCause}
                      onChange={e => updateField('rootCause', e.target.value)}
                    />
                  </div>
                  <div className="vn-field">
                    <label className="vn-field-label">Root Cause Category</label>
                    <select
                      className="vn-select"
                      value={form.rootCauseCategory}
                      onChange={e => updateField('rootCauseCategory', e.target.value)}
                    >
                      {ROOT_CAUSE_CATEGORIES.map(c => (
                        <option key={c.value} value={c.value}>{c.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Section 3: Corrective & Preventive Actions */}
              <div className="vn-form-section">
                <h3 className="vn-form-section-title">
                  <span className="material-icons">build</span>
                  Corrective &amp; Preventive Actions
                </h3>
                <div className="vn-form-grid">
                  <div className="vn-field vn-col-span-2">
                    <label className="vn-field-label">Corrective Action</label>
                    <textarea
                      className="vn-textarea"
                      rows={3}
                      placeholder="Actions to correct the identified issue..."
                      value={form.correctiveAction}
                      onChange={e => updateField('correctiveAction', e.target.value)}
                    />
                  </div>
                  <div className="vn-field">
                    <label className="vn-field-label">Corrective Action Due Date</label>
                    <input
                      className="vn-input"
                      type="date"
                      value={form.correctiveActionDueDate}
                      onChange={e => updateField('correctiveActionDueDate', e.target.value)}
                    />
                  </div>
                  <div className="vn-field vn-col-span-2">
                    <label className="vn-field-label">Preventive Action</label>
                    <textarea
                      className="vn-textarea"
                      rows={3}
                      placeholder="Actions to prevent recurrence..."
                      value={form.preventiveAction}
                      onChange={e => updateField('preventiveAction', e.target.value)}
                    />
                  </div>
                  <div className="vn-field">
                    <label className="vn-field-label">Preventive Action Due Date</label>
                    <input
                      className="vn-input"
                      type="date"
                      value={form.preventiveActionDueDate}
                      onChange={e => updateField('preventiveActionDueDate', e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* Section 4: People */}
              <div className="vn-form-section">
                <h3 className="vn-form-section-title">
                  <span className="material-icons">people</span>
                  People
                </h3>
                <div className="vn-form-grid">
                  <div className="vn-field">
                    <label className="vn-field-label">Investigator Name</label>
                    <input
                      className="vn-input"
                      type="text"
                      placeholder="Person leading the investigation"
                      value={form.investigatorName}
                      onChange={e => updateField('investigatorName', e.target.value)}
                    />
                  </div>
                  <div className="vn-field">
                    <label className="vn-field-label">Approver Name</label>
                    <input
                      className="vn-input"
                      type="text"
                      placeholder="Person responsible for approval"
                      value={form.approverName}
                      onChange={e => updateField('approverName', e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* Section 5: Verification & Closure (edit only) */}
              {isEdit && (
                <div className="vn-form-section">
                  <h3 className="vn-form-section-title">
                    <span className="material-icons">verified</span>
                    Verification &amp; Closure
                  </h3>
                  <div className="vn-form-grid">
                    <div className="vn-field vn-col-span-2">
                      <label className="vn-field-label">Verification Method</label>
                      <textarea
                        className="vn-textarea"
                        rows={3}
                        placeholder="Method used to verify the corrective action was effective..."
                        value={form.verificationMethod}
                        onChange={e => updateField('verificationMethod', e.target.value)}
                      />
                    </div>
                    <div className="vn-field">
                      <label className="vn-field-label">Verified By</label>
                      <input
                        className="vn-input"
                        type="text"
                        placeholder="Person who verified"
                        value={form.verifiedByName}
                        onChange={e => updateField('verifiedByName', e.target.value)}
                      />
                    </div>
                    <div className="vn-field vn-col-span-2">
                      <label className="vn-field-label">Effectiveness Check</label>
                      <textarea
                        className="vn-textarea"
                        rows={3}
                        placeholder="Results of the effectiveness check..."
                        value={form.effectivenessCheck}
                        onChange={e => updateField('effectivenessCheck', e.target.value)}
                      />
                    </div>
                    <div className="vn-field vn-col-span-2">
                      <label className="vn-field-label">Lessons Learned</label>
                      <textarea
                        className="vn-textarea"
                        rows={3}
                        placeholder="Key takeaways and lessons learned..."
                        value={form.lessonsLearned}
                        onChange={e => updateField('lessonsLearned', e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              )}

            </div>
            <div className="vn-modal-footer">
              <button className="vn-btn vn-btn-outline" onClick={closeModal} disabled={submitting}>
                Cancel
              </button>
              <button className="vn-btn vn-btn-primary" onClick={handleSubmit} disabled={submitting}>
                <span className="material-icons">save</span>
                {submitting ? 'Saving...' : isEdit ? 'Update Report' : 'Create Report'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
