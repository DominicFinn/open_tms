import { useState, useEffect } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Clock,
  Edit,
  Loader2,
  Plus,
  Save,
  Search,
  Users,
  Wrench,
  XCircle,
  ShieldCheck,
} from 'lucide-react';

import { API_URL } from '../api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { DatePicker } from '@/components/ui/date-picker';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

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

type ChipVariant = 'success' | 'warning' | 'destructive' | 'info' | 'muted' | 'default';

function statusVariant(status: string): ChipVariant {
  switch (status) {
    case 'draft': return 'muted';
    case 'investigation': return 'info';
    case 'root_cause_identified': return 'warning';
    case 'action_plan':
    case 'implementation': return 'default';
    case 'verification': return 'info';
    case 'closed': return 'success';
    default: return 'muted';
  }
}

function priorityVariant(priority: string): ChipVariant {
  switch (priority) {
    case 'low': return 'muted';
    case 'medium': return 'info';
    case 'high': return 'warning';
    case 'critical': return 'destructive';
    default: return 'muted';
  }
}

function formatStatusLabel(status: string): string {
  return STATUS_OPTIONS.find(s => s.value === status)?.label || status;
}

function formatPriorityLabel(priority: string): string {
  return PRIORITY_OPTIONS.find(p => p.value === priority)?.label || priority;
}

function formatDate(d: string | null): string {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function isOverdue(report: CAPAReport): boolean {
  if (report.status === 'closed') return false;
  if (!report.correctiveActionDueDate) return false;
  if (report.correctiveActionCompletedDate) return false;
  return new Date(report.correctiveActionDueDate) < new Date();
}

const STAT_TONES = {
  primary: 'bg-primary/10 text-primary',
  info: 'bg-info/15 text-info',
  destructive: 'bg-destructive/10 text-destructive',
  success: 'bg-success/15 text-success',
} as const;

export default function VNextCAPAReports() {
  const [reports, setReports] = useState<CAPAReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');

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

  const totalCount = reports.length;
  const openCount = reports.filter(r => r.status !== 'closed').length;
  const overdueCount = reports.filter(r => isOverdue(r)).length;
  const closedCount = reports.filter(r => r.status === 'closed').length;

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-3 py-24 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin" />
        <h3 className="text-lg font-medium">Loading...</h3>
      </div>
    );
  }

  if (error && reports.length === 0) {
    return (
      <div className="flex items-center gap-3 rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
        <XCircle className="h-5 w-5" />
        {error}
      </div>
    );
  }

  const isEdit = !!editingReport;

  const stats = [
    { tone: 'primary' as const, label: 'Total Reports', value: totalCount, Icon: ClipboardList },
    { tone: 'info' as const, label: 'Open', value: openCount, Icon: Clock },
    { tone: 'destructive' as const, label: 'Overdue', value: overdueCount, Icon: AlertTriangle },
    { tone: 'success' as const, label: 'Closed', value: closedCount, Icon: CheckCircle2 },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">CAPA Reports</h1>
          <p className="mt-1 text-sm text-muted-foreground">Corrective and preventive action tracking for quality management</p>
        </div>
        <Button variant="gradient" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          New CAPA Report
        </Button>
      </div>

      {error && (
        <div className="flex items-center gap-3 rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          <XCircle className="h-5 w-5" />
          {error}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map(stat => {
          const Icon = stat.Icon;
          return (
            <Card key={stat.label} className="p-5">
              <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg', STAT_TONES[stat.tone])}>
                <Icon className="h-5 w-5" />
              </div>
              <div className="mt-3 text-2xl font-bold tracking-tight">{stat.value}</div>
              <div className="mt-1 text-sm text-muted-foreground">{stat.label}</div>
            </Card>
          );
        })}
      </div>

      <Card>
        <div className="flex flex-wrap items-center gap-3 p-4">
          <div className="relative min-w-[260px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by report number or title..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {STATUS_OPTIONS.map(s => (
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Priorities</SelectItem>
              {PRIORITY_OPTIONS.map(p => (
                <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
            <ClipboardList className="h-10 w-10" />
            <h3 className="text-base font-medium">No CAPA reports found</h3>
            <p className="text-sm">Create a new CAPA report to begin tracking corrective and preventive actions.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Report #</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Issue</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Investigator</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(report => (
                <TableRow key={report.id}>
                  <TableCell className="font-mono text-sm font-semibold">{report.reportNumber}</TableCell>
                  <TableCell className="font-medium">{report.title}</TableCell>
                  <TableCell>
                    {report.issue ? (
                      <span className="text-sm text-muted-foreground">{report.issue.title}</span>
                    ) : (
                      <span className="text-sm text-muted-foreground">{report.issueId.slice(0, 8)}...</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(report.status)}>{formatStatusLabel(report.status)}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={priorityVariant(report.priority)}>{formatPriorityLabel(report.priority)}</Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{report.investigatorName || '-'}</TableCell>
                  <TableCell>
                    {report.correctiveActionDueDate ? (
                      <span
                        className={cn(
                          'flex items-center gap-1 text-sm',
                          isOverdue(report) ? 'font-semibold text-destructive' : 'text-muted-foreground',
                        )}
                      >
                        {formatDate(report.correctiveActionDueDate)}
                        {isOverdue(report) && <AlertTriangle className="h-3.5 w-3.5" />}
                      </span>
                    ) : (
                      <span className="text-sm text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{formatDate(report.createdAt)}</TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      title="Edit report"
                      onClick={() => openEdit(report.id)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <Dialog open={showModal} onOpenChange={open => !open && closeModal()}>
        <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isEdit ? 'Edit CAPA Report' : 'New CAPA Report'}</DialogTitle>
          </DialogHeader>

          {submitError && (
            <div className="flex items-center gap-3 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              <XCircle className="h-4 w-4" />
              {submitError}
            </div>
          )}

          <FormSection title="Problem Identification" Icon={AlertTriangle}>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <Label>Title <span className="text-destructive">*</span></Label>
                <Input
                  placeholder="Brief title for the CAPA report"
                  value={form.title}
                  onChange={e => updateField('title', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Issue ID <span className="text-destructive">*</span></Label>
                <Input
                  placeholder="Linked issue ID"
                  value={form.issueId}
                  onChange={e => updateField('issueId', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Shipment ID</Label>
                <Input
                  placeholder="Optional shipment ID"
                  value={form.shipmentId}
                  onChange={e => updateField('shipmentId', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select value={form.priority} onValueChange={v => updateField('priority', v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITY_OPTIONS.map(p => (
                      <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <FormTextarea label="Description" required value={form.description} onChange={v => updateField('description', v)} placeholder="Detailed description of the issue..." />
              <FormTextarea label="Immediate Action" value={form.immediateAction} onChange={v => updateField('immediateAction', v)} placeholder="Actions taken immediately to address the issue..." />
              <FormTextarea label="Containment Action" value={form.containmentAction} onChange={v => updateField('containmentAction', v)} placeholder="Short-term containment measures..." />
            </div>
          </FormSection>

          <FormSection title="Investigation" Icon={Search}>
            <div className="grid gap-4 md:grid-cols-2">
              <FormTextarea label="Investigation Details" value={form.investigationDetails} onChange={v => updateField('investigationDetails', v)} placeholder="Details of the investigation conducted..." />
              <FormTextarea label="Root Cause" value={form.rootCause} onChange={v => updateField('rootCause', v)} placeholder="Identified root cause of the issue..." />
              <div className="space-y-2">
                <Label>Root Cause Category</Label>
                <Select value={form.rootCauseCategory || '_none'} onValueChange={v => updateField('rootCauseCategory', v === '_none' ? '' : v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">Select category...</SelectItem>
                    {ROOT_CAUSE_CATEGORIES.filter(c => c.value).map(c => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </FormSection>

          <FormSection title="Corrective & Preventive Actions" Icon={Wrench}>
            <div className="grid gap-4 md:grid-cols-2">
              <FormTextarea label="Corrective Action" value={form.correctiveAction} onChange={v => updateField('correctiveAction', v)} placeholder="Actions to correct the identified issue..." />
              <div className="space-y-2">
                <Label>Corrective Action Due Date</Label>
                <DatePicker
                  type="date"
                  value={form.correctiveActionDueDate}
                  onChange={e => updateField('correctiveActionDueDate', e.target.value)}
                />
              </div>
              <FormTextarea label="Preventive Action" value={form.preventiveAction} onChange={v => updateField('preventiveAction', v)} placeholder="Actions to prevent recurrence..." />
              <div className="space-y-2">
                <Label>Preventive Action Due Date</Label>
                <DatePicker
                  type="date"
                  value={form.preventiveActionDueDate}
                  onChange={e => updateField('preventiveActionDueDate', e.target.value)}
                />
              </div>
            </div>
          </FormSection>

          <FormSection title="People" Icon={Users}>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Investigator Name</Label>
                <Input
                  placeholder="Person leading the investigation"
                  value={form.investigatorName}
                  onChange={e => updateField('investigatorName', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Approver Name</Label>
                <Input
                  placeholder="Person responsible for approval"
                  value={form.approverName}
                  onChange={e => updateField('approverName', e.target.value)}
                />
              </div>
            </div>
          </FormSection>

          {isEdit && (
            <FormSection title="Verification & Closure" Icon={ShieldCheck}>
              <div className="grid gap-4 md:grid-cols-2">
                <FormTextarea label="Verification Method" value={form.verificationMethod} onChange={v => updateField('verificationMethod', v)} placeholder="Method used to verify the corrective action was effective..." />
                <div className="space-y-2">
                  <Label>Verified By</Label>
                  <Input
                    placeholder="Person who verified"
                    value={form.verifiedByName}
                    onChange={e => updateField('verifiedByName', e.target.value)}
                  />
                </div>
                <FormTextarea label="Effectiveness Check" value={form.effectivenessCheck} onChange={v => updateField('effectivenessCheck', v)} placeholder="Results of the effectiveness check..." />
                <FormTextarea label="Lessons Learned" value={form.lessonsLearned} onChange={v => updateField('lessonsLearned', v)} placeholder="Key takeaways and lessons learned..." />
              </div>
            </FormSection>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={closeModal} disabled={submitting}>Cancel</Button>
            <Button variant="gradient" onClick={handleSubmit} disabled={submitting}>
              <Save className="h-4 w-4" />
              {submitting ? 'Saving...' : isEdit ? 'Update Report' : 'Create Report'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FormSection({
  title,
  Icon,
  children,
}: {
  title: string;
  Icon: typeof AlertTriangle;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3 rounded-md border border-border bg-muted/20 p-4">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <Icon className="h-4 w-4" />
        {title}
      </h3>
      {children}
    </div>
  );
}

function FormTextarea({
  label,
  value,
  onChange,
  placeholder,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <div className="space-y-2 md:col-span-2">
      <Label>
        {label} {required && <span className="text-destructive">*</span>}
      </Label>
      <textarea
        className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        rows={3}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}
