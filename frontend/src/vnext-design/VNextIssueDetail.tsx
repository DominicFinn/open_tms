import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  AlarmClock,
  AlarmClockOff,
  ArrowLeft,
  ArrowUpFromLine,
  Bot,
  CheckCircle2,
  CircleAlert,
  ClipboardList,
  Download,
  ExternalLink,
  FileText,
  Info,
  Loader2,
  MapPin,
  Package,
  Pencil,
  Play,
  RefreshCw,
  Truck,
  UserPlus,
  User as UserIcon,
  XCircle,
} from 'lucide-react';

import { API_URL } from '../api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function getInitials(name: string | null): string {
  if (!name) return '?';
  return name.split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

function eventDescription(evt: any): string {
  const t = evt.eventType || '';
  const p = evt.payload || {};
  if (t === 'issue.created') return 'Issue created';
  if (t === 'issue.status_changed') return `Status changed from ${p.previousStatus} to ${p.newStatus}`;
  if (t === 'issue.assigned') return `Assigned to ${p.assigneeName || p.assigneeId || 'someone'}`;
  if (t === 'issue.escalated') return `Escalated to ${p.escalatedTo || 'someone'}`;
  if (t === 'issue.resolved') return 'Issue resolved';
  if (t === 'issue.closed') return 'Issue closed';
  if (t === 'issue.reopened') return 'Issue reopened';
  if (t === 'issue.snoozed') return `Snoozed until ${p.snoozedUntil ? new Date(p.snoozedUntil).toLocaleString() : 'later'}`;
  if (t === 'issue.unsnoozed') return 'Snooze cleared';
  if (t === 'issue.needs_capa_marked') return p.needsCapa ? 'Marked as needs CAPA' : 'CAPA requirement cleared';
  if (t === 'issue.label_added') return 'Label added';
  if (t === 'issue.label_removed') return 'Label removed';
  if (t === 'issue.updated') return `Updated: ${(p.changes || []).join(', ')}`;
  return t.replace('issue.', '').replace(/_/g, ' ');
}

interface IssueDetail {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  category: string;
  sourceEntityType: string | null;
  sourceEntityId: string | null;
  sourceEventId: string | null;
  assigneeId: string | null;
  assigneeName: string | null;
  escalatedTo: string | null;
  escalatedAt: string | null;
  resolvedAt: string | null;
  resolvedBy: string | null;
  resolution: string | null;
  snoozedUntil: string | null;
  snoozedBy: string | null;
  snoozedReason: string | null;
  needsCapa: boolean;
  closedAt: string | null;
  closedBy: string | null;
  createdAt: string;
  updatedAt: string;
  labelAssignments?: Array<{ label: { id: string; name: string; color: string } }>;
  capaReports?: any[];
  slaEvaluations?: any[];
  commentCount?: number;
}

type BadgeVariant = 'success' | 'destructive' | 'warning' | 'info' | 'secondary' | 'muted' | 'default';

function priorityVariant(priority: string): BadgeVariant {
  if (priority === 'critical' || priority === 'high') return 'destructive';
  if (priority === 'medium') return 'warning';
  return 'secondary';
}

function statusVariant(status: string): BadgeVariant {
  if (status === 'open') return 'info';
  if (status === 'in_progress') return 'warning';
  if (status === 'resolved') return 'success';
  return 'secondary';
}

function SourceEntityCard({ entityType, entityId }: { entityType: string | null; entityId: string | null }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!entityType || !entityId) { setLoading(false); return; }
    const url = entityType === 'shipment' ? `${API_URL}/api/v1/shipments/${entityId}` : entityType === 'order' ? `${API_URL}/api/v1/orders/${entityId}` : null;
    if (!url) { setLoading(false); return; }
    fetch(url).then(r => r.json()).then(json => setData(json.data)).catch(() => {}).finally(() => setLoading(false));
  }, [entityType, entityId]);

  if (!entityType || !entityId) {
    return (
      <Card className="p-4 text-sm text-muted-foreground">No linked entity</Card>
    );
  }
  if (loading) {
    return (
      <Card className="p-4">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </Card>
    );
  }
  if (!data) {
    return <Card className="p-4 text-sm text-muted-foreground">Entity not found</Card>;
  }

  if (entityType === 'shipment') {
    const driver = data.loads?.[0]?.driver;
    return (
      <Card>
        <CardHeader className="p-4 pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Truck className="h-4 w-4" />
            Shipment
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 px-4 pb-4 text-sm">
          <div className="flex items-center justify-between">
            <span className="font-semibold">{data.reference || data.id?.slice(0, 8)}</span>
            <Badge variant={data.status === 'delivered' ? 'success' : data.status === 'in_transit' ? 'warning' : 'info'}>
              {data.status}
            </Badge>
          </div>
          {data.origin && (
            <div className="flex items-center gap-2"><MapPin className="h-3 w-3 text-success" />{data.origin.name || data.origin.city}</div>
          )}
          {data.destination && (
            <div className="flex items-center gap-2"><MapPin className="h-3 w-3 text-destructive" />{data.destination.name || data.destination.city}</div>
          )}
          {data.carrier && (
            <div className="flex items-center gap-2"><Truck className="h-3 w-3" />{data.carrier.name}</div>
          )}
          {driver ? (
            <div className="flex items-center gap-2">
              <UserIcon className="h-3 w-3" />
              {driver.name}
              {driver.phone && <span className="text-primary">{driver.phone}</span>}
            </div>
          ) : (
            <div className="flex items-center gap-2 text-xs text-warning">
              <CircleAlert className="h-3 w-3" />
              No driver assigned
            </div>
          )}
          <Button variant="link" size="sm" asChild className="h-auto p-0">
            <Link to={`/shipments/${entityId}`}>
              View shipment
              <ExternalLink className="h-3 w-3" />
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="p-4 pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Package className="h-4 w-4" />
          Order
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 px-4 pb-4 text-sm">
        <div className="font-semibold">{data.reference || data.id?.slice(0, 8)}</div>
        <div>Status: <Badge variant="info">{data.status}</Badge></div>
        {data.customer && <div>Customer: {data.customer.name}</div>}
        <Button variant="link" size="sm" asChild className="h-auto p-0">
          <Link to={`/orders/${entityId}`}>
            View order
            <ExternalLink className="h-3 w-3" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function IssueReportSection({ issueId }: { issueId: string }) {
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    fetch(`${API_URL}/api/v1/issues/${issueId}/report`)
      .then(r => r.json())
      .then(json => { if (json.data) setReport(json.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [issueId]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/issues/${issueId}/report`, { method: 'POST' });
      const json = await res.json();
      if (json.data) {
        const docRes = await fetch(`${API_URL}/api/v1/issues/${issueId}/report`);
        const docJson = await docRes.json();
        if (docJson.data) setReport(docJson.data);
      }
    } catch { /* ignore */ }
    setGenerating(false);
  };

  if (loading) return <Loader2 className="h-5 w-5 animate-spin" />;

  if (report) {
    return (
      <div className="flex items-center gap-3">
        <FileText className="h-8 w-8 text-destructive" />
        <div className="flex-1">
          <div className="text-sm font-semibold">{report.fileName}</div>
          <div className="text-xs text-muted-foreground">Generated {new Date(report.createdAt).toLocaleString()}</div>
        </div>
        <Button variant="gradient" size="sm" asChild>
          <a href={`${API_URL}/api/v1/documents/${report.id}/download`}>
            <Download className="h-4 w-4" />
            Download
          </a>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-muted-foreground">No closure report generated yet.</span>
      <Button variant="gradient" size="sm" onClick={handleGenerate} disabled={generating}>
        <FileText className="h-4 w-4" />
        {generating ? 'Generating...' : 'Generate report'}
      </Button>
    </div>
  );
}

export default function VNextIssueDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [issue, setIssue] = useState<IssueDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'activity' | 'details' | 'resolution'>('activity');

  const [activity, setActivity] = useState<any[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);

  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [allLabels, setAllLabels] = useState<any[]>([]);
  const [showLabelPicker, setShowLabelPicker] = useState(false);

  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [editingDesc, setEditingDesc] = useState(false);
  const [descDraft, setDescDraft] = useState('');

  const [showSnooze, setShowSnooze] = useState(false);
  const [snoozeDate, setSnoozeDate] = useState('');

  const [showAssign, setShowAssign] = useState(false);
  const [assignName, setAssignName] = useState('');

  const loadIssue = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/v1/issues/${id}`);
      const json = await res.json();
      if (json.data) setIssue(json.data);
      else setError('Issue not found');
    } catch { setError('Failed to load issue'); }
    setLoading(false);
  }, [id]);

  const loadActivity = useCallback(async () => {
    setActivityLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/issues/${id}/activity`);
      const json = await res.json();
      setActivity(json.data || []);
    } catch { /* ignore */ }
    setActivityLoading(false);
  }, [id]);

  useEffect(() => {
    loadIssue();
    loadActivity();
    fetch(`${API_URL}/api/v1/issue-labels`).then(r => r.json()).then(j => setAllLabels(j.data || [])).catch(() => {});
  }, [loadIssue, loadActivity]);

  const doAction = async (path: string, body?: any) => {
    await fetch(`${API_URL}/api/v1/issues/${id}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    loadIssue();
    loadActivity();
  };

  const doUpdate = async (data: any) => {
    await fetch(`${API_URL}/api/v1/issues/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    loadIssue();
    loadActivity();
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) return;
    setSubmitting(true);
    await fetch(`${API_URL}/api/v1/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entityType: 'issue', entityId: id, body: newComment }),
    });
    setNewComment('');
    setSubmitting(false);
    loadActivity();
  };

  const handleAddLabel = async (labelId: string) => {
    await fetch(`${API_URL}/api/v1/issues/${id}/labels`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ labelId }),
    });
    setShowLabelPicker(false);
    loadIssue();
  };

  const handleRemoveLabel = async (labelId: string) => {
    await fetch(`${API_URL}/api/v1/issues/${id}/labels/${labelId}`, { method: 'DELETE' });
    loadIssue();
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-3 py-24 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin" />
        <h3 className="text-lg font-medium">Loading...</h3>
      </div>
    );
  }
  if (error || !issue) {
    return (
      <div className="flex items-center gap-3 rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
        <CircleAlert className="h-5 w-5" />
        {error || 'Issue not found'}
      </div>
    );
  }

  const labels = (issue.labelAssignments || []).map((a: any) => a.label);
  const isSnoozed = issue.snoozedUntil && new Date(issue.snoozedUntil) > new Date();

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" onClick={() => navigate('/issues')} className="-ml-3 self-start">
        <ArrowLeft className="h-4 w-4" />
        Back to issues
      </Button>

      <div className="space-y-3">
        <div className="flex flex-wrap items-start gap-3">
          {editingTitle ? (
            <Input
              value={titleDraft}
              onChange={e => setTitleDraft(e.target.value)}
              autoFocus
              onBlur={() => { if (titleDraft.trim() && titleDraft !== issue.title) doUpdate({ title: titleDraft }); setEditingTitle(false); }}
              onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
              className="flex-1 min-w-[300px] text-2xl font-bold"
            />
          ) : (
            <h1 className="flex-1 cursor-pointer text-3xl font-bold tracking-tight" onClick={() => { setTitleDraft(issue.title); setEditingTitle(true); }}>
              {issue.title}
            </h1>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={priorityVariant(issue.priority)} className="capitalize">{issue.priority}</Badge>
            <Badge variant={statusVariant(issue.status)} className="capitalize">{issue.status.replace('_', ' ')}</Badge>
            <Badge variant="muted" className="capitalize">{issue.category}</Badge>
            {issue.needsCapa && (
              <Badge variant="warning"><ClipboardList className="h-3 w-3" />Needs CAPA</Badge>
            )}
            {isSnoozed && (
              <Badge variant="secondary"><AlarmClock className="h-3 w-3" />Snoozed</Badge>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {labels.map((l: any) => (
            <span
              key={l.id}
              className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold text-white"
              style={{ background: l.color }}
            >
              {l.name}
              <button onClick={() => handleRemoveLabel(l.id)} className="text-white/80 hover:text-white">&times;</button>
            </span>
          ))}
          <div className="relative">
            <Button variant="outline" size="sm" onClick={() => setShowLabelPicker(!showLabelPicker)}>+ Label</Button>
            {showLabelPicker && (
              <div className="absolute left-0 top-full z-10 mt-1 min-w-[160px] rounded-md border border-border bg-popover p-2 shadow-lg">
                {allLabels.filter(l => !labels.find((el: any) => el.id === l.id)).map((l: any) => (
                  <button
                    key={l.id}
                    type="button"
                    className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm transition-colors hover:bg-muted"
                    onClick={() => handleAddLabel(l.id)}
                  >
                    <span className="h-3 w-3 rounded-full" style={{ background: l.color }} />
                    {l.name}
                  </button>
                ))}
                {allLabels.filter(l => !labels.find((el: any) => el.id === l.id)).length === 0 && (
                  <div className="p-2 text-xs text-muted-foreground">No more labels</div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {issue.status === 'open' && (
          <Button onClick={() => doAction('/status', { status: 'in_progress' })}>
            <Play className="h-4 w-4" />
            Start working
          </Button>
        )}
        {(issue.status === 'open' || issue.status === 'in_progress') && (
          <Button variant="default" onClick={() => { const r = prompt('Resolution notes (optional):'); doAction('/status', { status: 'resolved', resolution: r || undefined }); }}>
            <CheckCircle2 className="h-4 w-4" />
            Resolve
          </Button>
        )}
        {(issue.status === 'open' || issue.status === 'in_progress' || issue.status === 'resolved') && (
          <Button variant="outline" onClick={() => doAction('/close')}>
            <XCircle className="h-4 w-4" />
            Close
          </Button>
        )}
        {(issue.status === 'resolved' || issue.status === 'closed') && (
          <Button variant="outline" onClick={() => doAction('/reopen')}>
            <RefreshCw className="h-4 w-4" />
            Reopen
          </Button>
        )}
        <Button variant="outline" onClick={() => setShowAssign(!showAssign)}>
          <UserPlus className="h-4 w-4" />
          Assign
        </Button>
        <Button variant="outline" onClick={() => { const to = prompt('Escalate to:'); const reason = prompt('Reason:'); if (to) doAction('/escalate', { escalatedTo: to, reason }); }}>
          <ArrowUpFromLine className="h-4 w-4" />
          Escalate
        </Button>
        {!isSnoozed ? (
          <Button variant="outline" onClick={() => setShowSnooze(!showSnooze)}>
            <AlarmClock className="h-4 w-4" />
            Snooze
          </Button>
        ) : (
          <Button variant="outline" onClick={() => doAction('/unsnooze')}>
            <AlarmClockOff className="h-4 w-4" />
            Unsnooze
          </Button>
        )}
        <Button variant={issue.needsCapa ? 'default' : 'outline'} onClick={() => doAction('/needs-capa', { needsCapa: !issue.needsCapa })}>
          <ClipboardList className="h-4 w-4" />
          {issue.needsCapa ? 'Clear CAPA' : 'Needs CAPA'}
        </Button>
      </div>

      {showAssign && (
        <Card className="flex items-center gap-2 p-3">
          <Input className="flex-1" placeholder="Assignee name" value={assignName} onChange={e => setAssignName(e.target.value)} />
          <Button variant="gradient" onClick={() => {
            if (assignName.trim()) {
              doAction('/assign', { assigneeId: assignName.toLowerCase().replace(/\s/g, '.'), assigneeName: assignName });
              setShowAssign(false);
              setAssignName('');
            }
          }}>
            Assign
          </Button>
          <Button variant="outline" onClick={() => setShowAssign(false)}>Cancel</Button>
        </Card>
      )}

      {showSnooze && (
        <Card className="flex items-center gap-2 p-3">
          <Input type="datetime-local" value={snoozeDate} onChange={e => setSnoozeDate(e.target.value)} />
          <Button variant="gradient" onClick={() => {
            if (snoozeDate) {
              doAction('/snooze', { until: new Date(snoozeDate).toISOString() });
              setShowSnooze(false);
              setSnoozeDate('');
            }
          }}>
            Snooze
          </Button>
          <Button variant="outline" onClick={() => setShowSnooze(false)}>Cancel</Button>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-1 border-b border-border">
            {(['activity', 'details', ...(issue.status === 'resolved' || issue.status === 'closed' ? ['resolution'] : [])] as const).map(tab => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab as any)}
                className={cn(
                  '-mb-px border-b-2 px-3 py-2 text-sm font-medium capitalize transition-colors',
                  activeTab === tab
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground',
                )}
              >
                {tab}
              </button>
            ))}
          </div>

          {activeTab === 'activity' && (
            <Card>
              <CardContent className="space-y-2 p-4">
                {activityLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : activity.length === 0 ? (
                  <div className="py-6 text-center text-sm text-muted-foreground">No activity yet</div>
                ) : (
                  <div className="flex flex-col">
                    {activity.map((item, idx) => (
                      item.type === 'comment' ? (
                        <div
                          key={item.id}
                          className={cn('flex gap-3 py-3', idx < activity.length - 1 && 'border-b border-border')}
                        >
                          <div className={cn(
                            'flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white',
                            item.authorType === 'agent' ? 'bg-info' : 'bg-primary',
                          )}>
                            {item.authorType === 'agent' ? <Bot className="h-4 w-4" /> : getInitials(item.authorName)}
                          </div>
                          <div className="flex-1">
                            <div className="mb-1 flex items-center justify-between">
                              <span className="text-sm font-semibold">{item.authorName}</span>
                              <span className="text-xs text-muted-foreground">{new Date(item.timestamp).toLocaleString()}</span>
                            </div>
                            <p className="text-sm leading-relaxed">{item.body}</p>
                          </div>
                        </div>
                      ) : (
                        <div
                          key={item.id}
                          className={cn(
                            'flex items-center gap-2 py-2 text-xs text-muted-foreground',
                            idx < activity.length - 1 && 'border-b border-border',
                          )}
                        >
                          <Info className="h-4 w-4" />
                          <span>{eventDescription(item)}</span>
                          <span className="ml-auto">{new Date(item.timestamp).toLocaleString()}</span>
                        </div>
                      )
                    ))}
                  </div>
                )}

                <Separator className="my-3" />
                <div className="flex gap-2">
                  <textarea
                    rows={2}
                    placeholder="Add a comment..."
                    value={newComment}
                    onChange={e => setNewComment(e.target.value)}
                    className="flex-1 resize-y rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                  <Button variant="gradient" onClick={handleAddComment} disabled={submitting || !newComment.trim()} className="self-end">
                    {submitting ? '...' : 'Post'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {activeTab === 'details' && (
            <Card>
              <CardContent className="grid gap-3 p-4 md:grid-cols-2">
                <div className="md:col-span-2 space-y-2">
                  <Label>Description</Label>
                  {editingDesc ? (
                    <div className="flex gap-2">
                      <textarea
                        value={descDraft}
                        onChange={e => setDescDraft(e.target.value)}
                        rows={4}
                        className="flex-1 resize-y rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      />
                      <div className="flex flex-col gap-2">
                        <Button variant="gradient" onClick={() => { doUpdate({ description: descDraft }); setEditingDesc(false); }}>Save</Button>
                        <Button variant="outline" onClick={() => setEditingDesc(false)}>Cancel</Button>
                      </div>
                    </div>
                  ) : (
                    <div
                      onClick={() => { setDescDraft(issue.description || ''); setEditingDesc(true); }}
                      className="min-h-[40px] cursor-pointer rounded-md border border-input p-2 text-sm hover:border-primary/40"
                    >
                      {issue.description || <span className="text-muted-foreground">Click to add description...</span>}
                    </div>
                  )}
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground">Category</Label>
                  <div className="text-sm">{issue.category}</div>
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground">Source type</Label>
                  <div className="text-sm">{issue.sourceEntityType || '-'}</div>
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground">Source entity</Label>
                  <div className="text-sm">{issue.sourceEntityId?.slice(0, 12) || '-'}</div>
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground">Created</Label>
                  <div className="text-sm">{new Date(issue.createdAt).toLocaleString()}</div>
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground">Updated</Label>
                  <div className="text-sm">{new Date(issue.updatedAt).toLocaleString()}</div>
                </div>
                {issue.escalatedTo && (
                  <div className="space-y-1">
                    <Label className="text-muted-foreground">Escalated to</Label>
                    <div className="text-sm">{issue.escalatedTo}</div>
                  </div>
                )}
                {issue.escalatedAt && (
                  <div className="space-y-1">
                    <Label className="text-muted-foreground">Escalated at</Label>
                    <div className="text-sm">{new Date(issue.escalatedAt).toLocaleString()}</div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {activeTab === 'resolution' && (
            <Card>
              <CardContent className="space-y-4 p-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="md:col-span-2 space-y-1">
                    <Label className="text-muted-foreground">Resolution</Label>
                    <div className="text-sm">{issue.resolution || <span className="text-muted-foreground">No resolution notes</span>}</div>
                  </div>
                  {issue.resolvedBy && (
                    <div className="space-y-1">
                      <Label className="text-muted-foreground">Resolved by</Label>
                      <div className="text-sm">{issue.resolvedBy}</div>
                    </div>
                  )}
                  {issue.resolvedAt && (
                    <div className="space-y-1">
                      <Label className="text-muted-foreground">Resolved at</Label>
                      <div className="text-sm">{new Date(issue.resolvedAt).toLocaleString()}</div>
                    </div>
                  )}
                  {issue.closedBy && (
                    <div className="space-y-1">
                      <Label className="text-muted-foreground">Closed by</Label>
                      <div className="text-sm">{issue.closedBy}</div>
                    </div>
                  )}
                  {issue.closedAt && (
                    <div className="space-y-1">
                      <Label className="text-muted-foreground">Closed at</Label>
                      <div className="text-sm">{new Date(issue.closedAt).toLocaleString()}</div>
                    </div>
                  )}
                </div>
                <Separator />
                <div>
                  <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                    <FileText className="h-4 w-4" />
                    Closure report
                  </h3>
                  <IssueReportSection issueId={id!} />
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-3">
          <SourceEntityCard entityType={issue.sourceEntityType} entityId={issue.sourceEntityId} />

          <Card>
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-sm">SLA status</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 text-sm">
              {(issue.slaEvaluations || []).length === 0 ? (
                <div className="text-muted-foreground">No SLA rules active</div>
              ) : (
                (issue.slaEvaluations || []).map((sla: any, idx: number) => (
                  <div
                    key={idx}
                    className={cn(
                      'flex items-center justify-between py-2',
                      idx < (issue.slaEvaluations || []).length - 1 && 'border-b border-border',
                    )}
                  >
                    <span className="text-xs">{sla.ruleName || sla.ruleType}</span>
                    <Badge variant={sla.status === 'breached' ? 'destructive' : sla.status === 'warning' ? 'warning' : 'info'}>
                      {sla.status}
                    </Badge>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-sm">Assignment</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 px-4 pb-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                  {getInitials(issue.assigneeName)}
                </div>
                <span>{issue.assigneeName || 'Unassigned'}</span>
              </div>
              {issue.escalatedTo && <div className="text-xs text-destructive">Escalated to: {issue.escalatedTo}</div>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-sm">CAPA reports</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 px-4 pb-4 text-sm">
              {(issue.capaReports || []).length === 0 ? (
                <div className="text-muted-foreground">No CAPA reports linked</div>
              ) : (
                (issue.capaReports || []).map((capa: any) => (
                  <div key={capa.id} className="flex items-center justify-between">
                    <Link to="/quality/capa" className="text-xs text-primary hover:underline">{capa.reportNumber}</Link>
                    <Badge variant="muted">{capa.status}</Badge>
                  </div>
                ))
              )}
              {issue.needsCapa && (
                <div className="flex items-center gap-2 rounded-md border border-warning/30 bg-warning/10 p-2 text-xs text-warning">
                  <ClipboardList className="h-3 w-3" />
                  CAPA required for this issue
                </div>
              )}
              <Button variant="outline" size="sm" asChild className="w-full">
                <Link to={`/quality/capa?createFromIssue=${id}`}>Create CAPA report</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
