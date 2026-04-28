import React, { useState, useEffect, useCallback } from 'react';
import {
  CheckCircle2,
  ClipboardCheck,
  FileCheck,
  Gauge,
  Plus,
  Upload,
  X,
  XCircle,
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

interface Checklist {
  id: string;
  title: string;
  category: string;
  sopReference: string | null;
}

interface Audit {
  id: string;
  auditNumber: string;
  status: string;
  score: number | null;
  passCount: number;
  failCount: number;
  naCount: number;
  auditorName: string | null;
  auditDate: string;
  findings: string | null;
  correctiveActions: string | null;
  completedAt: string | null;
  checklist: { title: string; category: string; sopReference: string | null };
}

interface AuditDetail extends Audit {
  checklist: {
    title: string;
    category: string;
    sopReference: string | null;
    items: ChecklistItem[];
  };
  responses: AuditResponse[];
}

interface ChecklistItem {
  id: string;
  sortOrder: number;
  section: string | null;
  question: string;
  guidance: string | null;
  evidenceRequired: boolean;
  isCritical: boolean;
}

interface AuditResponse {
  checklistItemId: string;
  result: string;
  notes: string | null;
  evidenceRef: string | null;
  correctiveAction: string | null;
}

interface EvidenceFile {
  id: string;
  fileName: string;
  storageKey: string;
  checklistItemId: string | null;
}

type BadgeVariant = 'success' | 'destructive' | 'warning' | 'info' | 'secondary' | 'muted' | 'default';

const STATUS_VARIANT: Record<string, BadgeVariant> = {
  in_progress: 'info',
  completed: 'success',
  failed: 'destructive',
};

const CATEGORY_VARIANT: Record<string, BadgeVariant> = {
  gdp: 'success',
  cold_chain: 'info',
  warehouse: 'default',
  transport: 'warning',
  general: 'secondary',
};

export default function VNextQualitySopAudits() {
  const [audits, setAudits] = useState<Audit[]>([]);
  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [checklistFilter, setChecklistFilter] = useState('all');

  const [showStart, setShowStart] = useState(false);
  const [startChecklistId, setStartChecklistId] = useState('');
  const [startAuditorName, setStartAuditorName] = useState('');

  const [detail, setDetail] = useState<AuditDetail | null>(null);
  const [responses, setResponses] = useState<Record<string, { result: string; notes: string; correctiveAction: string; evidenceRef: string }>>({});
  const [completingFindings, setCompletingFindings] = useState('');
  const [completingCorrectiveActions, setCompletingCorrectiveActions] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [evidenceFiles, setEvidenceFiles] = useState<Record<string, EvidenceFile>>({});
  const [uploadingItem, setUploadingItem] = useState<string | null>(null);

  const fetchAudits = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (checklistFilter !== 'all') params.set('checklistId', checklistFilter);
      const res = await fetch(`${API_URL}/api/v1/quality/sop-audits?${params}`);
      const json = await res.json();
      setAudits(json.data || []);
    } catch { /* ignore */ }
    setLoading(false);
  }, [statusFilter, checklistFilter]);

  const fetchChecklists = async () => {
    try {
      const res = await fetch(`${API_URL}/api/v1/quality/sop-checklists?status=active`);
      const json = await res.json();
      setChecklists(json.data || []);
    } catch { /* ignore */ }
  };

  useEffect(() => { fetchAudits(); fetchChecklists(); }, [fetchAudits]);

  const startAudit = async () => {
    if (!startChecklistId) return;
    const res = await fetch(`${API_URL}/api/v1/quality/sop-audits`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        checklistId: startChecklistId,
        auditorName: startAuditorName || undefined,
      }),
    });
    if (res.ok) {
      setShowStart(false);
      setStartChecklistId('');
      setStartAuditorName('');
      fetchAudits();
    }
  };

  const openDetail = async (auditId: string) => {
    try {
      const res = await fetch(`${API_URL}/api/v1/quality/sop-audits/${auditId}`);
      const json = await res.json();
      setDetail(json.data);
      const resps: Record<string, { result: string; notes: string; correctiveAction: string; evidenceRef: string }> = {};
      for (const r of (json.data?.responses || [])) {
        resps[r.checklistItemId] = {
          result: r.result,
          notes: r.notes || '',
          correctiveAction: r.correctiveAction || '',
          evidenceRef: r.evidenceRef || '',
        };
      }
      setResponses(resps);
      try {
        await fetch(`${API_URL}/api/v1/quality/sop-audits/${auditId}/evidence`);
      } catch { /* ignore */ }
    } catch { /* ignore */ }
  };

  const completeAudit = async () => {
    if (!detail) return;
    setSubmitting(true);
    const responseList = Object.entries(responses).map(([checklistItemId, r]) => ({
      checklistItemId,
      result: r.result,
      notes: r.notes || undefined,
      correctiveAction: r.correctiveAction || undefined,
      evidenceRef: r.evidenceRef || undefined,
    }));

    try {
      const res = await fetch(`${API_URL}/api/v1/quality/sop-audits/${detail.id}/complete`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          responses: responseList,
          findings: completingFindings || undefined,
          correctiveActions: completingCorrectiveActions || undefined,
        }),
      });
      const json = await res.json();
      if (json.data) {
        setDetail(null);
        fetchAudits();
      }
    } catch { /* ignore */ }
    setSubmitting(false);
  };

  const setResponse = (itemId: string, field: 'result' | 'notes' | 'correctiveAction' | 'evidenceRef', value: string) => {
    setResponses(prev => ({
      ...prev,
      [itemId]: {
        result: prev[itemId]?.result || '',
        notes: prev[itemId]?.notes || '',
        correctiveAction: prev[itemId]?.correctiveAction || '',
        evidenceRef: prev[itemId]?.evidenceRef || '',
        [field]: value,
      },
    }));
  };

  const uploadEvidence = async (itemId: string, file: File) => {
    if (!detail) return;
    setUploadingItem(itemId);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('checklistItemId', itemId);
      const res = await fetch(`${API_URL}/api/v1/quality/sop-audits/${detail.id}/evidence`, {
        method: 'POST',
        body: formData,
      });
      const json = await res.json();
      if (json.data) {
        setResponse(itemId, 'evidenceRef', json.data.storageKey);
        setEvidenceFiles(prev => ({
          ...prev,
          [itemId]: { id: json.data.id, fileName: json.data.fileName, storageKey: json.data.storageKey, checklistItemId: itemId },
        }));
      }
    } catch { /* ignore */ }
    setUploadingItem(null);
  };

  const stats = {
    total: audits.length,
    completed: audits.filter(a => a.status === 'completed').length,
    failed: audits.filter(a => a.status === 'failed').length,
    avgScore: audits.filter(a => a.score != null).length > 0
      ? Math.round(audits.filter(a => a.score != null).reduce((s, a) => s + (a.score || 0), 0) / audits.filter(a => a.score != null).length)
      : null,
  };

  const formatDate = (d: string) => new Date(d).toLocaleDateString();

  const groupedItems = detail?.checklist?.items?.reduce((acc, item) => {
    const section = item.section || 'General';
    if (!acc[section]) acc[section] = [];
    acc[section].push(item);
    return acc;
  }, {} as Record<string, ChecklistItem[]>) || {};

  const statTiles = [
    { label: 'Total audits', value: stats.total, icon: FileCheck, tone: 'bg-primary/10 text-primary' },
    { label: 'Completed', value: stats.completed, icon: CheckCircle2, tone: 'bg-success/15 text-success' },
    { label: 'Failed', value: stats.failed, icon: XCircle, tone: 'bg-destructive/10 text-destructive' },
    { label: 'Avg score', value: stats.avgScore != null ? `${stats.avgScore}%` : 'N/A', icon: Gauge, tone: 'bg-info/15 text-info' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">GDP audits</h1>
          <p className="mt-1 text-sm text-muted-foreground">SOP compliance audits and GDP reviews</p>
        </div>
        <Button variant="gradient" onClick={() => setShowStart(true)}>
          <Plus className="h-4 w-4" />
          Start new audit
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
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="in_progress">In progress</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
            </SelectContent>
          </Select>
          <Select value={checklistFilter} onValueChange={setChecklistFilter}>
            <SelectTrigger className="w-[240px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All checklists</SelectItem>
              {checklists.map(c => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Separator />
      </Card>

      {detail ? (
        <Card className="p-6">
          <div className="mb-5 flex items-start justify-between">
            <div>
              <h2 className="text-lg font-semibold">{detail.auditNumber} - {detail.checklist.title}</h2>
              <div className="mt-2 flex gap-2">
                <Badge variant={STATUS_VARIANT[detail.status] || 'muted'}>{detail.status.replace(/_/g, ' ')}</Badge>
                <Badge variant={CATEGORY_VARIANT[detail.checklist.category] || 'muted'}>{detail.checklist.category.replace(/_/g, ' ')}</Badge>
                {detail.score != null && <Badge variant="default">{Math.round(detail.score)}% score</Badge>}
              </div>
            </div>
            <Button variant="outline" onClick={() => setDetail(null)}>
              <X className="h-4 w-4" />
              Close
            </Button>
          </div>

          {detail.status === 'in_progress' ? (
            <div className="space-y-6">
              {Object.entries(groupedItems).map(([section, items]) => (
                <div key={section}>
                  <h3 className="mb-3 border-b border-border pb-2 text-sm font-semibold">{section}</h3>
                  {items.sort((a, b) => a.sortOrder - b.sortOrder).map(item => (
                    <div
                      key={item.id}
                      className={cn(
                        'mb-2 rounded-md border bg-muted/30 p-3',
                        item.isCritical ? 'border-destructive' : 'border-border',
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <p className="text-sm font-medium">
                            {item.isCritical && <span className="mr-1 text-destructive">*</span>}
                            {item.question}
                          </p>
                          {item.guidance && <p className="mt-1 text-xs text-muted-foreground">{item.guidance}</p>}
                          {item.isCritical && <span className="text-[10px] text-destructive">Critical - failure will fail the entire audit</span>}
                          {item.evidenceRequired && <span className="block text-[10px] text-warning">Evidence required</span>}
                        </div>
                        <div className="flex gap-1">
                          {(['pass', 'fail', 'na', 'observation'] as const).map(r => (
                            <Button
                              key={r}
                              size="sm"
                              variant={
                                responses[item.id]?.result === r
                                  ? r === 'pass' ? 'default' : r === 'fail' ? 'destructive' : 'secondary'
                                  : 'outline'
                              }
                              onClick={() => setResponse(item.id, 'result', r)}
                            >
                              {r === 'na' ? 'N/A' : r.charAt(0).toUpperCase() + r.slice(1)}
                            </Button>
                          ))}
                        </div>
                      </div>

                      {responses[item.id]?.result && (
                        <textarea
                          rows={2}
                          placeholder="Notes..."
                          value={responses[item.id]?.notes || ''}
                          onChange={e => setResponse(item.id, 'notes', e.target.value)}
                          className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        />
                      )}

                      {(responses[item.id]?.result === 'fail' || responses[item.id]?.result === 'observation') && (
                        <textarea
                          rows={2}
                          placeholder="Corrective action required..."
                          value={responses[item.id]?.correctiveAction || ''}
                          onChange={e => setResponse(item.id, 'correctiveAction', e.target.value)}
                          className="mt-2 w-full rounded-md border border-warning bg-background px-3 py-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        />
                      )}

                      {(item.evidenceRequired || responses[item.id]?.result) && (
                        <div className="mt-2 flex items-center gap-2">
                          {responses[item.id]?.evidenceRef ? (
                            <div className="flex items-center gap-2 text-xs text-success">
                              <CheckCircle2 className="h-4 w-4" />
                              {evidenceFiles[item.id]?.fileName || 'Evidence uploaded'}
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setResponse(item.id, 'evidenceRef', '');
                                  setEvidenceFiles(prev => {
                                    const next = { ...prev };
                                    delete next[item.id];
                                    return next;
                                  });
                                }}
                              >
                                Remove
                              </Button>
                            </div>
                          ) : (
                            <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                              <Upload className="h-4 w-4" />
                              {uploadingItem === item.id ? 'Uploading...' : (item.evidenceRequired ? 'Upload evidence (required)' : 'Upload evidence')}
                              <input
                                type="file"
                                className="hidden"
                                disabled={uploadingItem === item.id}
                                onChange={e => {
                                  const file = e.target.files?.[0];
                                  if (file) uploadEvidence(item.id, file);
                                  e.target.value = '';
                                }}
                              />
                            </label>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ))}

              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Overall findings</Label>
                  <textarea
                    rows={3}
                    value={completingFindings}
                    onChange={e => setCompletingFindings(e.target.value)}
                    placeholder="Summarize audit findings..."
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Corrective actions required</Label>
                  <textarea
                    rows={3}
                    value={completingCorrectiveActions}
                    onChange={e => setCompletingCorrectiveActions(e.target.value)}
                    placeholder="List corrective actions needed from this audit..."
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </div>
              </div>

              <Button variant="gradient" onClick={completeAudit} disabled={submitting}>
                {submitting ? 'Submitting...' : 'Submit audit'}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <Card className="p-4 text-center">
                  <div className="text-3xl font-bold text-success">{detail.passCount}</div>
                  <div className="text-xs text-muted-foreground">Passed</div>
                </Card>
                <Card className="p-4 text-center">
                  <div className="text-3xl font-bold text-destructive">{detail.failCount}</div>
                  <div className="text-xs text-muted-foreground">Failed</div>
                </Card>
                <Card className="p-4 text-center">
                  <div className="text-3xl font-bold text-muted-foreground">{detail.naCount}</div>
                  <div className="text-xs text-muted-foreground">N/A</div>
                </Card>
              </div>
              {detail.findings && (
                <div className="rounded-md border border-info/30 bg-info/10 p-3 text-sm text-info">
                  <strong>Findings:</strong> {detail.findings}
                </div>
              )}
              {detail.correctiveActions && (
                <div className="rounded-md border border-warning/30 bg-warning/10 p-3 text-sm text-warning">
                  <strong>Corrective actions:</strong> {detail.correctiveActions}
                </div>
              )}
            </div>
          )}
        </Card>
      ) : (
        <Card>
          {loading ? (
            <div className="py-12 text-center text-muted-foreground">Loading...</div>
          ) : audits.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-12 text-muted-foreground">
              <ClipboardCheck className="h-10 w-10 opacity-40" />
              No audits found. Start a new audit to begin.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Audit #</TableHead>
                  <TableHead>Checklist</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Auditor</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="w-[80px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {audits.map(a => (
                  <TableRow key={a.id}>
                    <TableCell><span className="font-mono text-sm font-semibold">{a.auditNumber}</span></TableCell>
                    <TableCell>{a.checklist.title}</TableCell>
                    <TableCell><Badge variant={CATEGORY_VARIANT[a.checklist.category] || 'muted'}>{a.checklist.category.replace(/_/g, ' ')}</Badge></TableCell>
                    <TableCell><Badge variant={STATUS_VARIANT[a.status] || 'muted'}>{a.status.replace(/_/g, ' ')}</Badge></TableCell>
                    <TableCell>
                      {a.score != null ? (
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-14 overflow-hidden rounded-full bg-muted">
                            <div
                              className={cn(
                                'h-full',
                                a.score >= 80 ? 'bg-success' : a.score >= 50 ? 'bg-warning' : 'bg-destructive',
                              )}
                              style={{ width: `${Math.round(a.score)}%` }}
                            />
                          </div>
                          <span className="text-xs">{Math.round(a.score)}%</span>
                        </div>
                      ) : <span className="text-sm text-muted-foreground">-</span>}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{a.auditorName || '-'}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDate(a.auditDate)}</TableCell>
                    <TableCell>
                      <Button size="sm" variant="outline" onClick={() => openDetail(a.id)}>
                        {a.status === 'in_progress' ? 'Continue' : 'View'}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      )}

      <Dialog open={showStart} onOpenChange={setShowStart}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Start new audit</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Checklist *</Label>
              <Select value={startChecklistId} onValueChange={setStartChecklistId}>
                <SelectTrigger><SelectValue placeholder="Select a checklist..." /></SelectTrigger>
                <SelectContent>
                  {checklists.map(c => <SelectItem key={c.id} value={c.id}>{c.title} ({c.category})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Auditor name</Label>
              <Input value={startAuditorName} onChange={e => setStartAuditorName(e.target.value)} placeholder="Who is performing this audit?" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowStart(false)}>Cancel</Button>
            <Button variant="gradient" onClick={startAudit} disabled={!startChecklistId}>Start audit</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
