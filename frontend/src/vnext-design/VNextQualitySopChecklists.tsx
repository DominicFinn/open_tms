/**
 * VNextQualitySopChecklists - SOP/GDP checklist management page.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Calendar,
  CheckCircle2,
  CircleAlert,
  ClipboardCheck,
  Folder,
  ListChecks,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  X,
} from 'lucide-react';

import { API_URL } from '../api';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

interface ChecklistItem {
  id?: string;
  question: string;
  section: string;
  guidance: string;
  evidenceRequired: boolean;
  isCritical: boolean;
  sortOrder: number;
}

interface SopChecklist {
  id: string;
  title: string;
  description: string | null;
  sopReference: string | null;
  category: string;
  frequency: string;
  status: string;
  nextDueDate: string | null;
  lastCompletedAt: string | null;
  items: ChecklistItem[];
  _count?: { audits: number };
  createdAt: string;
  updatedAt: string;
}

const CATEGORIES = [
  { value: 'gdp', label: 'GDP' },
  { value: 'cold_chain', label: 'Cold Chain' },
  { value: 'warehouse', label: 'Warehouse' },
  { value: 'transport', label: 'Transport' },
  { value: 'general', label: 'General' },
];

const FREQUENCIES = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'annual', label: 'Annual' },
  { value: 'one_off', label: 'One Off' },
];

const STATUSES = [
  { value: 'draft', label: 'Draft' },
  { value: 'active', label: 'Active' },
  { value: 'archived', label: 'Archived' },
];

type BadgeVariant = 'success' | 'destructive' | 'warning' | 'info' | 'secondary' | 'muted' | 'default';

function categoryLabel(val: string): string {
  return CATEGORIES.find((c) => c.value === val)?.label || val;
}

function categoryVariant(cat: string): BadgeVariant {
  switch (cat) {
    case 'gdp': return 'default';
    case 'cold_chain': return 'info';
    case 'warehouse': return 'warning';
    case 'transport': return 'success';
    case 'general': return 'secondary';
    default: return 'secondary';
  }
}

function statusVariant(status: string): BadgeVariant {
  switch (status) {
    case 'active': return 'success';
    case 'draft': return 'warning';
    case 'archived': return 'secondary';
    default: return 'secondary';
  }
}

function frequencyLabel(val: string): string {
  return FREQUENCIES.find((f) => f.value === val)?.label || val;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString();
}

function isOverdue(nextDueDate: string | null, status: string): boolean {
  if (!nextDueDate || status !== 'active') return false;
  return new Date(nextDueDate) < new Date();
}

function emptyItem(sortOrder: number): ChecklistItem {
  return {
    question: '',
    section: '',
    guidance: '',
    evidenceRequired: false,
    isCritical: false,
    sortOrder,
  };
}

interface ChecklistFormProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  editChecklist: SopChecklist | null;
}

function ChecklistFormModal({ open, onClose, onSaved, editChecklist }: ChecklistFormProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [sopReference, setSopReference] = useState('');
  const [category, setCategory] = useState('general');
  const [frequency, setFrequency] = useState('quarterly');
  const [nextDueDate, setNextDueDate] = useState('');
  const [items, setItems] = useState<ChecklistItem[]>([emptyItem(0)]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (editChecklist) {
      setTitle(editChecklist.title);
      setDescription(editChecklist.description || '');
      setSopReference(editChecklist.sopReference || '');
      setCategory(editChecklist.category);
      setFrequency(editChecklist.frequency);
      setNextDueDate(editChecklist.nextDueDate ? editChecklist.nextDueDate.slice(0, 10) : '');
      setItems(
        editChecklist.items.length > 0
          ? [...editChecklist.items].sort((a, b) => a.sortOrder - b.sortOrder)
          : [emptyItem(0)],
      );
    } else {
      setTitle('');
      setDescription('');
      setSopReference('');
      setCategory('general');
      setFrequency('quarterly');
      setNextDueDate('');
      setItems([emptyItem(0)]);
    }
    setError('');
  }, [editChecklist, open]);

  const updateItem = (idx: number, field: keyof ChecklistItem, value: any) => {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, [field]: value } : it)));
  };

  const addItem = () => {
    setItems((prev) => [...prev, emptyItem(prev.length)]);
  };

  const removeItem = (idx: number) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((_, i) => i !== idx).map((it, i) => ({ ...it, sortOrder: i })));
  };

  const moveItem = (idx: number, direction: -1 | 1) => {
    const target = idx + direction;
    if (target < 0 || target >= items.length) return;
    setItems((prev) => {
      const arr = [...prev];
      [arr[idx], arr[target]] = [arr[target], arr[idx]];
      return arr.map((it, i) => ({ ...it, sortOrder: i }));
    });
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      setError('Title is required');
      return;
    }
    const validItems = items.filter((it) => it.question.trim());
    if (validItems.length === 0) {
      setError('At least one checklist item with a question is required');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const payload = {
        title: title.trim(),
        description: description.trim() || null,
        sopReference: sopReference.trim() || null,
        category,
        frequency,
        nextDueDate: nextDueDate || null,
        items: validItems.map((it, i) => ({
          question: it.question.trim(),
          section: it.section.trim() || null,
          guidance: it.guidance.trim() || null,
          evidenceRequired: it.evidenceRequired,
          isCritical: it.isCritical,
          sortOrder: i,
        })),
      };

      const url = editChecklist
        ? `${API_URL}/api/v1/quality/sop-checklists/${editChecklist.id}`
        : `${API_URL}/api/v1/quality/sop-checklists`;
      const method = editChecklist ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to save checklist');

      onSaved();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const sections = Array.from(new Set(items.map((it) => it.section || '').filter(Boolean)));

  return (
    <Dialog open={open} onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>{editChecklist ? 'Edit checklist' : 'Create checklist'}</DialogTitle>
        </DialogHeader>

        {error && (
          <div className="flex items-center gap-3 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            <CircleAlert className="h-4 w-4" />
            <span className="flex-1">{error}</span>
            <Button variant="ghost" size="icon" onClick={() => setError('')}><X className="h-4 w-4" /></Button>
          </div>
        )}

        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Title <span className="text-destructive">*</span></Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. GDP Warehouse Compliance" />
            </div>
            <div className="space-y-2">
              <Label>SOP reference</Label>
              <Input value={sopReference} onChange={(e) => setSopReference(e.target.value)} placeholder="e.g. SOP-WH-001" />
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Frequency</Label>
              <Select value={frequency} onValueChange={setFrequency}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FREQUENCIES.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Next due date</Label>
              <Input type="date" value={nextDueDate} onChange={(e) => setNextDueDate(e.target.value)} />
            </div>
            <div className="md:col-span-2 space-y-2">
              <Label>Description</Label>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional description of this checklist"
                className="w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold">
                Checklist items ({items.filter((it) => it.question.trim()).length})
              </h3>
              <Button variant="ghost" size="sm" onClick={addItem}>
                <Plus className="h-4 w-4" />
                Add item
              </Button>
            </div>

            {sections.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span>Sections:</span>
                {sections.map(s => <Badge key={s} variant="secondary">{s}</Badge>)}
              </div>
            )}

            {items.map((item, idx) => {
              const prevSection = idx > 0 ? items[idx - 1].section : null;
              const showSectionHeader = item.section && item.section !== prevSection;

              return (
                <React.Fragment key={idx}>
                  {showSectionHeader && (
                    <div className={cn(
                      'flex items-center gap-2 border-b border-border pb-1 pt-2 text-sm font-semibold text-primary',
                      idx > 0 && 'mt-3',
                    )}>
                      <Folder className="h-4 w-4" />
                      {item.section}
                    </div>
                  )}
                  <div
                    className={cn(
                      'rounded-md border bg-muted/30 p-3',
                      item.isCritical ? 'border-l-4 border-l-destructive' : 'border-l-4 border-l-border',
                    )}
                  >
                    <div className="flex items-start gap-2">
                      <span className="min-w-[24px] pt-2 text-sm font-semibold text-muted-foreground">{idx + 1}.</span>
                      <div className="flex-1 space-y-2">
                        <div className="space-y-2">
                          <Label>Question <span className="text-destructive">*</span></Label>
                          <Input
                            value={item.question}
                            onChange={(e) => updateItem(idx, 'question', e.target.value)}
                            placeholder="e.g. Are temperature records maintained for the last 30 days?"
                          />
                        </div>
                        <div className="grid gap-2 md:grid-cols-2">
                          <div className="space-y-2">
                            <Label>Section</Label>
                            <Input
                              value={item.section}
                              onChange={(e) => updateItem(idx, 'section', e.target.value)}
                              placeholder="e.g. Documentation"
                              list="section-suggestions"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Guidance</Label>
                            <Input
                              value={item.guidance}
                              onChange={(e) => updateItem(idx, 'guidance', e.target.value)}
                              placeholder="Hint or reference for the auditor"
                            />
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-4 text-sm">
                          <label className="flex items-center gap-2 cursor-pointer text-muted-foreground">
                            <input
                              type="checkbox"
                              checked={item.evidenceRequired}
                              onChange={(e) => updateItem(idx, 'evidenceRequired', e.target.checked)}
                            />
                            Evidence required
                          </label>
                          <label className={cn('flex items-center gap-2 cursor-pointer', item.isCritical ? 'text-destructive' : 'text-muted-foreground')}>
                            <input
                              type="checkbox"
                              checked={item.isCritical}
                              onChange={(e) => updateItem(idx, 'isCritical', e.target.checked)}
                            />
                            Critical item
                          </label>
                        </div>
                      </div>
                      <div className="flex flex-col gap-1">
                        <Button variant="ghost" size="icon" onClick={() => moveItem(idx, -1)} disabled={idx === 0} title="Move up">
                          <ArrowUp className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => moveItem(idx, 1)} disabled={idx === items.length - 1} title="Move down">
                          <ArrowDown className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeItem(idx)}
                          disabled={items.length <= 1}
                          title="Remove item"
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </React.Fragment>
              );
            })}

            <datalist id="section-suggestions">
              {sections.map(s => <option key={s} value={s} />)}
            </datalist>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="gradient" onClick={handleSubmit} disabled={saving || !title.trim()}>
            {saving ? 'Saving...' : editChecklist ? 'Save changes' : 'Create checklist'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function VNextQualitySopChecklists() {
  const [checklists, setChecklists] = useState<SopChecklist[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [editChecklist, setEditChecklist] = useState<SopChecklist | null>(null);

  const loadChecklists = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterCategory !== 'all') params.set('category', filterCategory);
      if (filterStatus !== 'all') params.set('status', filterStatus);
      const qs = params.toString();
      const res = await fetch(`${API_URL}/api/v1/quality/sop-checklists${qs ? `?${qs}` : ''}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load checklists');
      setChecklists(json.data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [filterCategory, filterStatus]);

  useEffect(() => { loadChecklists(); }, [loadChecklists]);

  const openCreate = () => {
    setEditChecklist(null);
    setShowModal(true);
  };

  const openEdit = async (id: string) => {
    try {
      const res = await fetch(`${API_URL}/api/v1/quality/sop-checklists/${id}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load checklist');
      setEditChecklist(json.data);
      setShowModal(true);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleSaved = () => {
    setSuccessMsg(editChecklist ? 'Checklist updated' : 'Checklist created');
    setTimeout(() => setSuccessMsg(''), 3000);
    loadChecklists();
  };

  const filtered = checklists.filter((cl) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      cl.title.toLowerCase().includes(q) ||
      (cl.sopReference || '').toLowerCase().includes(q) ||
      cl.category.toLowerCase().includes(q)
    );
  });

  const totalActive = checklists.filter((c) => c.status === 'active').length;
  const now = new Date();
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const dueThisMonth = checklists.filter((c) => {
    if (c.status !== 'active' || !c.nextDueDate) return false;
    const d = new Date(c.nextDueDate);
    return d <= endOfMonth && d >= now;
  }).length;
  const overdue = checklists.filter((c) => isOverdue(c.nextDueDate, c.status)).length;

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-3 py-24 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin" />
        <h3 className="text-lg font-medium">Loading checklists...</h3>
      </div>
    );
  }

  const stats = [
    { label: 'Total active', value: totalActive, icon: ListChecks, tone: 'bg-primary/10 text-primary' },
    { label: 'Due this month', value: dueThisMonth, icon: Calendar, tone: 'bg-warning/15 text-warning' },
    { label: 'Overdue', value: overdue, icon: AlertTriangle, tone: 'bg-destructive/10 text-destructive' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">SOP checklists</h1>
          <p className="mt-1 text-sm text-muted-foreground">{checklists.length} checklists</p>
        </div>
        <Button variant="gradient" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Create checklist
        </Button>
      </div>

      {successMsg && (
        <div className="flex items-center gap-3 rounded-md border border-success/30 bg-success/10 p-4 text-sm text-success">
          <CheckCircle2 className="h-5 w-5" />
          <span className="flex-1">{successMsg}</span>
          <Button variant="ghost" size="icon" onClick={() => setSuccessMsg('')}><X className="h-4 w-4" /></Button>
        </div>
      )}
      {error && (
        <div className="flex items-center gap-3 rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          <CircleAlert className="h-5 w-5" />
          <span className="flex-1">{error}</span>
          <Button variant="ghost" size="icon" onClick={() => setError('')}><X className="h-4 w-4" /></Button>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        {stats.map(stat => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label}>
              <div className="p-5">
                <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg', stat.tone)}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="mt-3 text-2xl font-bold tracking-tight">{stat.value}</div>
                <div className="mt-1 text-sm text-muted-foreground">{stat.label}</div>
              </div>
            </Card>
          );
        })}
      </div>

      <Card>
        <div className="flex flex-wrap items-center gap-3 p-4">
          <div className="min-w-[240px] flex-1">
            <Input placeholder="Search checklists..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <Separator />

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-12 text-muted-foreground">
            <ClipboardCheck className="h-10 w-10 opacity-40" />
            <h3 className="text-base font-medium">No checklists found</h3>
            <p className="text-sm">Create your first SOP checklist to start tracking compliance audits.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>SOP ref</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Frequency</TableHead>
                <TableHead>Next due</TableHead>
                <TableHead>Last completed</TableHead>
                <TableHead>Audits</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[60px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(cl => {
                const overdueRow = isOverdue(cl.nextDueDate, cl.status);
                return (
                  <TableRow
                    key={cl.id}
                    className={cn('cursor-pointer', overdueRow && 'bg-destructive/5')}
                    onClick={() => openEdit(cl.id)}
                  >
                    <TableCell>
                      <div className="font-medium">{cl.title}</div>
                      {cl.description && (
                        <div className="max-w-[240px] truncate text-xs text-muted-foreground">
                          {cl.description}
                        </div>
                      )}
                    </TableCell>
                    <TableCell><span className="font-mono text-sm">{cl.sopReference || '-'}</span></TableCell>
                    <TableCell><Badge variant={categoryVariant(cl.category)}>{categoryLabel(cl.category)}</Badge></TableCell>
                    <TableCell className="text-sm">{frequencyLabel(cl.frequency)}</TableCell>
                    <TableCell>
                      <span className={cn('text-sm', overdueRow && 'font-semibold text-destructive')}>
                        {formatDate(cl.nextDueDate)}
                      </span>
                      {overdueRow && <div className="text-[10px] font-semibold text-destructive">OVERDUE</div>}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDate(cl.lastCompletedAt)}</TableCell>
                    <TableCell className="font-semibold">{cl._count?.audits ?? 0}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(cl.status)}>
                        {cl.status.charAt(0).toUpperCase() + cl.status.slice(1)}
                      </Badge>
                    </TableCell>
                    <TableCell onClick={e => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" onClick={() => openEdit(cl.id)} title="Edit checklist">
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>

      <ChecklistFormModal
        open={showModal}
        onClose={() => { setShowModal(false); setEditChecklist(null); }}
        onSaved={handleSaved}
        editChecklist={editChecklist}
      />
    </div>
  );
}
