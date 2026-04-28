import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  BadgeCheck,
  Calendar,
  CalendarClock,
  Check,
  CheckCircle2,
  ClipboardList,
  Hourglass,
  Info,
  Plus,
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

interface CAPAReport {
  id: string;
  reportNumber: string;
  title: string;
  status: string;
  priority: string;
  description: string;
  rootCauseCategory: string | null;
  issueId: string;
  shipmentId: string | null;
  createdAt: string;
}

interface FollowUp {
  id: string;
  followUpType: string;
  dueDate: string;
  completedAt: string | null;
  status: string;
  notes: string | null;
  outcome: string | null;
  actionItems: string | null;
  assigneeName: string | null;
  completedByName: string | null;
}

type BadgeVariant = 'success' | 'destructive' | 'warning' | 'info' | 'secondary' | 'muted' | 'default';

const STATUS_VARIANT: Record<string, BadgeVariant> = {
  draft: 'secondary',
  investigation: 'info',
  root_cause_identified: 'warning',
  action_plan: 'default',
  implementation: 'info',
  verification: 'warning',
  closed: 'success',
};

const PRIORITY_VARIANT: Record<string, BadgeVariant> = {
  critical: 'destructive',
  high: 'warning',
  medium: 'default',
  low: 'secondary',
};

const FOLLOW_UP_LABELS: Record<string, string> = {
  '30_day': '30-Day Review',
  '60_day': '60-Day Review',
  '90_day': '90-Day Review',
  ad_hoc: 'Ad-Hoc Note',
  effectiveness_check: 'Effectiveness Check',
};

const OUTCOME_LABELS: Record<string, string> = {
  on_track: 'On Track',
  needs_attention: 'Needs Attention',
  escalated: 'Escalated',
  closed_effective: 'Closed - Effective',
  closed_ineffective: 'Closed - Ineffective',
};

export default function VNextQualityCapa() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const createFromIssue = searchParams.get('createFromIssue');

  const [capas, setCapas] = useState<CAPAReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [search, setSearch] = useState('');

  const [selectedCapa, setSelectedCapa] = useState<CAPAReport | null>(null);
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [loadingFollowUps, setLoadingFollowUps] = useState(false);

  const [completingFollowUp, setCompletingFollowUp] = useState<FollowUp | null>(null);
  const [completeOutcome, setCompleteOutcome] = useState('on_track');
  const [completeNotes, setCompleteNotes] = useState('');

  const [showAddFollowUp, setShowAddFollowUp] = useState(false);
  const [newFollowUpType, setNewFollowUpType] = useState('ad_hoc');
  const [newFollowUpDue, setNewFollowUpDue] = useState('');
  const [newFollowUpNotes, setNewFollowUpNotes] = useState('');

  const [showCreateCapa, setShowCreateCapa] = useState(!!createFromIssue);
  const [createIssueId, setCreateIssueId] = useState(createFromIssue || '');
  const [createTitle, setCreateTitle] = useState('');
  const [createDescription, setCreateDescription] = useState('');
  const [createPriority, setCreatePriority] = useState('medium');

  const fetchCapas = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.set('status', statusFilter);
      const res = await fetch(`${API_URL}/api/v1/cold-chain/capa?${params}`);
      const json = await res.json();
      setCapas(json.data || []);
    } catch { /* ignore */ }
    setLoading(false);
  }, [statusFilter]);

  useEffect(() => { fetchCapas(); }, [fetchCapas]);

  const fetchFollowUps = async (capaId: string) => {
    setLoadingFollowUps(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/quality/capa-follow-ups?capaReportId=${capaId}`);
      const json = await res.json();
      setFollowUps(json.data || []);
    } catch { /* ignore */ }
    setLoadingFollowUps(false);
  };

  const selectCapa = (capa: CAPAReport) => {
    setSelectedCapa(capa);
    fetchFollowUps(capa.id);
  };

  const schedule30_60_90 = async () => {
    if (!selectedCapa) return;
    await fetch(`${API_URL}/api/v1/quality/capa-follow-ups/schedule`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ capaReportId: selectedCapa.id }),
    });
    fetchFollowUps(selectedCapa.id);
  };

  const addFollowUp = async () => {
    if (!selectedCapa || !newFollowUpDue) return;
    await fetch(`${API_URL}/api/v1/quality/capa-follow-ups`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        capaReportId: selectedCapa.id,
        followUpType: newFollowUpType,
        dueDate: new Date(newFollowUpDue).toISOString(),
        notes: newFollowUpNotes || undefined,
      }),
    });
    setShowAddFollowUp(false);
    setNewFollowUpNotes('');
    fetchFollowUps(selectedCapa.id);
  };

  const completeFollowUp = async () => {
    if (!completingFollowUp) return;
    await fetch(`${API_URL}/api/v1/quality/capa-follow-ups/${completingFollowUp.id}/complete`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ outcome: completeOutcome, notes: completeNotes || undefined }),
    });
    setCompletingFollowUp(null);
    setCompleteNotes('');
    if (selectedCapa) fetchFollowUps(selectedCapa.id);
  };

  const createCapa = async () => {
    if (!createIssueId || !createTitle || !createDescription) return;
    const res = await fetch(`${API_URL}/api/v1/cold-chain/capa`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        issueId: createIssueId,
        title: createTitle,
        description: createDescription,
        priority: createPriority,
      }),
    });
    if (res.ok) {
      setShowCreateCapa(false);
      setCreateIssueId('');
      setCreateTitle('');
      setCreateDescription('');
      fetchCapas();
    }
  };

  const filtered = capas.filter(c => {
    if (priorityFilter !== 'all' && c.priority !== priorityFilter) return false;
    if (search && !c.title.toLowerCase().includes(search.toLowerCase()) && !c.reportNumber.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const stats = {
    total: capas.length,
    open: capas.filter(c => !['closed', 'verification'].includes(c.status)).length,
    verification: capas.filter(c => c.status === 'verification').length,
    closed: capas.filter(c => c.status === 'closed').length,
  };

  const isOverdue = (fu: FollowUp) => fu.status === 'pending' && new Date(fu.dueDate) < new Date();
  const formatDate = (d: string) => new Date(d).toLocaleDateString();

  const statTiles = [
    { label: 'Total CAPAs', value: stats.total, icon: ClipboardList, tone: 'bg-primary/10 text-primary' },
    { label: 'Open', value: stats.open, icon: Hourglass, tone: 'bg-warning/15 text-warning' },
    { label: 'In verification', value: stats.verification, icon: BadgeCheck, tone: 'bg-info/15 text-info' },
    { label: 'Closed', value: stats.closed, icon: CheckCircle2, tone: 'bg-success/15 text-success' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">CAPA management</h1>
          <p className="mt-1 text-sm text-muted-foreground">Corrective and preventive action reports with follow-up tracking</p>
        </div>
        <Button variant="gradient" onClick={() => setShowCreateCapa(true)}>
          <Plus className="h-4 w-4" />
          Create CAPA
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {statTiles.map(stat => {
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
            <Input placeholder="Search by title or report number..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {Object.keys(STATUS_VARIANT).map(s => <SelectItem key={s} value={s}>{s.replace(/_/g, ' ')}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All priorities</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Separator />
      </Card>

      <div className={cn('grid gap-6', selectedCapa ? 'lg:grid-cols-2' : 'grid-cols-1')}>
        <Card>
          {loading ? (
            <div className="py-12 text-center text-muted-foreground">Loading...</div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">No CAPA reports found</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Report #</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Root cause</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(c => (
                  <TableRow
                    key={c.id}
                    onClick={() => selectCapa(c)}
                    className={cn('cursor-pointer', selectedCapa?.id === c.id && 'bg-muted')}
                  >
                    <TableCell><span className="font-mono text-sm font-semibold">{c.reportNumber}</span></TableCell>
                    <TableCell>{c.title}</TableCell>
                    <TableCell><Badge variant={STATUS_VARIANT[c.status] || 'muted'}>{c.status.replace(/_/g, ' ')}</Badge></TableCell>
                    <TableCell><Badge variant={PRIORITY_VARIANT[c.priority] || 'muted'}>{c.priority}</Badge></TableCell>
                    <TableCell className="text-sm text-muted-foreground">{c.rootCauseCategory || '-'}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDate(c.createdAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>

        {selectedCapa && (
          <Card className="p-5">
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h3 className="text-base font-semibold">{selectedCapa.reportNumber}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{selectedCapa.title}</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setSelectedCapa(null)}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="mb-4 flex gap-2">
              <Badge variant={STATUS_VARIANT[selectedCapa.status] || 'muted'}>{selectedCapa.status.replace(/_/g, ' ')}</Badge>
              <Badge variant={PRIORITY_VARIANT[selectedCapa.priority] || 'muted'}>{selectedCapa.priority}</Badge>
            </div>

            <div className="mb-4 flex flex-wrap gap-2">
              <Button size="sm" variant="default" onClick={schedule30_60_90}>
                <CalendarClock className="h-4 w-4" />
                Schedule 30/60/90
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShowAddFollowUp(true)}>
                <Plus className="h-4 w-4" />
                Add follow-up
              </Button>
            </div>

            <h4 className="mb-3 text-sm font-semibold">Follow-up timeline</h4>

            {loadingFollowUps ? (
              <div className="py-6 text-center text-muted-foreground">Loading...</div>
            ) : followUps.length === 0 ? (
              <div className="flex items-start gap-3 rounded-md border border-info/30 bg-info/10 p-3 text-sm text-info">
                <Info className="mt-0.5 h-4 w-4" />
                No follow-ups scheduled yet. Click "Schedule 30/60/90" to create automatic review checkpoints.
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {followUps.map(fu => {
                  const overdue = isOverdue(fu);
                  return (
                    <div
                      key={fu.id}
                      className={cn(
                        'rounded-md border p-3',
                        overdue ? 'border-warning/40 bg-warning/5' : 'border-border bg-muted/30',
                      )}
                    >
                      <div className="mb-2 flex items-center justify-between">
                        <div className="flex flex-wrap gap-1">
                          <Badge variant="default">{FOLLOW_UP_LABELS[fu.followUpType] || fu.followUpType}</Badge>
                          {fu.status === 'completed' && <Badge variant="success">Completed</Badge>}
                          {overdue && <Badge variant="destructive">Overdue</Badge>}
                          {fu.status === 'pending' && !overdue && <Badge variant="secondary">Pending</Badge>}
                        </div>
                        <span className="text-xs text-muted-foreground">Due: {formatDate(fu.dueDate)}</span>
                      </div>

                      {fu.notes && <p className="my-1 text-xs text-muted-foreground">{fu.notes}</p>}
                      {fu.outcome && <p className="my-1 text-xs">Outcome: <strong>{OUTCOME_LABELS[fu.outcome] || fu.outcome}</strong></p>}
                      {fu.actionItems && <p className="my-1 text-xs text-muted-foreground">Actions: {fu.actionItems}</p>}
                      {fu.completedAt && (
                        <p className="my-1 text-[11px] text-muted-foreground">
                          Completed: {formatDate(fu.completedAt)}{fu.completedByName ? ` by ${fu.completedByName}` : ''}
                        </p>
                      )}

                      {fu.status === 'pending' && (
                        <Button
                          size="sm"
                          variant="default"
                          className="mt-2"
                          onClick={() => {
                            setCompletingFollowUp(fu);
                            setCompleteOutcome('on_track');
                            setCompleteNotes('');
                          }}
                        >
                          <Check className="h-3 w-3" />
                          Complete review
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        )}
      </div>

      <Dialog open={!!completingFollowUp} onOpenChange={open => { if (!open) setCompletingFollowUp(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Complete follow-up</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Outcome</Label>
              <Select value={completeOutcome} onValueChange={setCompleteOutcome}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(OUTCOME_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <textarea
                rows={3}
                value={completeNotes}
                onChange={e => setCompleteNotes(e.target.value)}
                placeholder="Review notes..."
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCompletingFollowUp(null)}>Cancel</Button>
            <Button onClick={completeFollowUp}>Complete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showAddFollowUp} onOpenChange={setShowAddFollowUp}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Add follow-up</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={newFollowUpType} onValueChange={setNewFollowUpType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(FOLLOW_UP_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Due date</Label>
              <Input type="date" value={newFollowUpDue} onChange={e => setNewFollowUpDue(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <textarea
                rows={3}
                value={newFollowUpNotes}
                onChange={e => setNewFollowUpNotes(e.target.value)}
                placeholder="Optional notes..."
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddFollowUp(false)}>Cancel</Button>
            <Button variant="gradient" onClick={addFollowUp}>Add follow-up</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showCreateCapa} onOpenChange={setShowCreateCapa}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Create CAPA report</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Issue ID *</Label>
                <Input value={createIssueId} onChange={e => setCreateIssueId(e.target.value)} placeholder="Issue ID" />
              </div>
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select value={createPriority} onValueChange={setCreatePriority}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Title *</Label>
              <Input value={createTitle} onChange={e => setCreateTitle(e.target.value)} placeholder="CAPA report title" />
            </div>
            <div className="space-y-2">
              <Label>Description *</Label>
              <textarea
                rows={4}
                value={createDescription}
                onChange={e => setCreateDescription(e.target.value)}
                placeholder="Describe the issue..."
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateCapa(false)}>Cancel</Button>
            <Button variant="gradient" onClick={createCapa} disabled={!createIssueId || !createTitle || !createDescription}>
              Create CAPA
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
