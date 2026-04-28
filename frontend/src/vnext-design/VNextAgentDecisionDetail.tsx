import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Bot,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CircleAlert,
  ExternalLink,
  Loader2,
  MinusCircle,
  Sparkles,
  Star,
  X,
  XCircle,
} from 'lucide-react';

import { API_URL } from '../api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

interface Decision {
  id: string;
  orgId: string;
  agentType: string;
  modelProvider: string | null;
  modelId: string | null;
  triggerType: string;
  triggerEventType: string | null;
  triggerEventId: string | null;
  entityType: string | null;
  entityId: string | null;
  summary: string;
  reasoning: string;
  context: Record<string, unknown>;
  conversationLog: { role: string; content: string }[] | null;
  confidence: number | null;
  actionType: string;
  actionPayload: Record<string, unknown> | null;
  actionEntityType: string | null;
  actionEntityId: string | null;
  outcomeStatus: string | null;
  outcomeNotes: string | null;
  outcomeRecordedAt: string | null;
  outcomeRecordedBy: string | null;
  promotedToAutomation: boolean;
  promotedAt: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  durationMs: number | null;
  matchedConditions: { field: string; operator: string; value?: unknown }[] | null;
  agentConfigId: string | null;
  promptVersionId: string | null;
  createdAt: string;
  updatedAt: string;
}

function outcomeBadge(status: string | null) {
  if (!status || status === 'pending') return <Badge variant="secondary">Pending review</Badge>;
  if (status === 'correct') return <Badge variant="success">Correct</Badge>;
  if (status === 'incorrect') return <Badge variant="destructive">Incorrect</Badge>;
  if (status === 'partially_correct') return <Badge variant="warning">Partially correct</Badge>;
  return <Badge variant="secondary">{status}</Badge>;
}

function actionBadge(actionType: string) {
  if (actionType === 'create_issue') return <Badge variant="info">Created issue</Badge>;
  if (actionType === 'escalate_issue') return <Badge variant="warning">Escalated issue</Badge>;
  if (actionType === 'no_action') return <Badge variant="secondary">No action</Badge>;
  return <Badge variant="secondary">{actionType}</Badge>;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString();
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-border py-2 text-sm last:border-b-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

export default function VNextAgentDecisionDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [decision, setDecision] = useState<Decision | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [showOutcomeModal, setShowOutcomeModal] = useState(false);
  const [outcomeStatus, setOutcomeStatus] = useState('correct');
  const [outcomeNotes, setOutcomeNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const [showContext, setShowContext] = useState(false);
  const [showConversation, setShowConversation] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const res = await fetch(`${API_URL}/api/v1/agent-decisions/${id}`);
        if (!res.ok) throw new Error(`Failed (${res.status})`);
        const json = await res.json();
        if (!cancelled) {
          setDecision(json.data);
          setError('');
        }
      } catch (err: any) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  async function recordOutcome() {
    setSaving(true);
    setSaveError('');
    try {
      const res = await fetch(`${API_URL}/api/v1/agent-decisions/${id}/outcome`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ outcomeStatus, outcomeNotes: outcomeNotes || undefined }),
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || `Failed (${res.status})`);
      }
      const json = await res.json();
      setDecision(json.data);
      setShowOutcomeModal(false);
      setSuccessMsg('Outcome recorded successfully');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err: any) {
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function promoteDecision() {
    try {
      const res = await fetch(`${API_URL}/api/v1/automation-rules/from-decision/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || 'Failed to promote');
      }
      const refreshRes = await fetch(`${API_URL}/api/v1/agent-decisions/${id}`);
      const refreshJson = await refreshRes.json();
      setDecision(refreshJson.data);
      setSuccessMsg('Automation rule created from this decision');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err: any) {
      setSaveError(err.message);
      setTimeout(() => setSaveError(''), 5000);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-3 py-24 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin" />
        <h3 className="text-lg font-medium">Loading decision...</h3>
      </div>
    );
  }

  if (error || !decision) {
    return (
      <div className="flex items-center gap-3 rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
        <CircleAlert className="h-5 w-5" />
        {error || 'Decision not found'}
      </div>
    );
  }

  const confidencePct = decision.confidence !== null ? Math.round(decision.confidence * 100) : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => navigate('/agent-decisions')}>
          <ArrowLeft className="h-4 w-4" />
          Decisions
        </Button>
        <span className="text-sm text-muted-foreground">/ {decision.id.slice(0, 8)}</span>
      </div>

      {successMsg && (
        <div className="flex items-center gap-3 rounded-md border border-success/30 bg-success/10 p-4 text-sm text-success">
          <CheckCircle2 className="h-5 w-5" />
          <span className="flex-1">{successMsg}</span>
          <Button variant="ghost" size="icon" onClick={() => setSuccessMsg('')}><X className="h-4 w-4" /></Button>
        </div>
      )}

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{decision.summary}</h1>
        </div>
        <div className="flex gap-2">
          {decision.outcomeStatus === 'pending' && (
            <Button variant="gradient" onClick={() => setShowOutcomeModal(true)}>
              <Star className="h-4 w-4" />
              Record outcome
            </Button>
          )}
          {decision.outcomeStatus === 'correct' && !decision.promotedToAutomation && (
            <Button variant="outline" onClick={promoteDecision}>
              <Sparkles className="h-4 w-4" />
              Promote to automation
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {actionBadge(decision.actionType)}
        {outcomeBadge(decision.outcomeStatus)}
        {decision.promotedToAutomation && <Badge>Promoted</Badge>}
        <Badge variant="secondary"><Bot className="h-3 w-3" />{decision.agentType}</Badge>
        {confidencePct !== null && (
          <Badge variant={confidencePct >= 80 ? 'success' : confidencePct >= 50 ? 'warning' : 'destructive'}>
            {confidencePct}% confidence
          </Badge>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Agent reasoning</CardTitle></CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap leading-relaxed">{decision.reasoning}</p>
            </CardContent>
          </Card>

          {decision.matchedConditions && decision.matchedConditions.length > 0 && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Matched conditions</CardTitle>
                <span className="text-xs text-muted-foreground">Used for automation rule promotion</span>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-2">
                  {decision.matchedConditions.map((c, i) => (
                    <div key={i} className="flex items-center gap-2 rounded-md bg-muted px-3 py-2 font-mono text-sm">
                      <span className="font-semibold text-primary">{c.field}</span>
                      <span className="text-muted-foreground">{c.operator}</span>
                      {c.value !== undefined && (
                        <span>{JSON.stringify(c.value)}</span>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {decision.actionPayload && Object.keys(decision.actionPayload).length > 0 && (
            <Card>
              <CardHeader><CardTitle>Action details</CardTitle></CardHeader>
              <CardContent>
                {Object.entries(decision.actionPayload).map(([k, v]) => (
                  <InfoRow
                    key={k}
                    label={k.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())}
                    value={String(v)}
                  />
                ))}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="cursor-pointer" onClick={() => setShowContext(!showContext)}>
              <div className="flex items-center justify-between">
                <CardTitle>Context snapshot</CardTitle>
                {showContext ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
              </div>
            </CardHeader>
            {showContext && (
              <CardContent>
                <pre className="max-h-[400px] overflow-auto rounded-md bg-muted p-4 text-xs leading-relaxed">
                  {JSON.stringify(decision.context, null, 2)}
                </pre>
              </CardContent>
            )}
          </Card>

          {decision.conversationLog && decision.conversationLog.length > 0 && (
            <Card>
              <CardHeader className="cursor-pointer" onClick={() => setShowConversation(!showConversation)}>
                <div className="flex items-center justify-between">
                  <CardTitle>LLM conversation</CardTitle>
                  {showConversation ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                </div>
              </CardHeader>
              {showConversation && (
                <CardContent>
                  <div className="flex flex-col gap-3">
                    {decision.conversationLog.map((msg, i) => (
                      <div key={i} className={cn(
                        'rounded-md p-3',
                        msg.role === 'system' && 'bg-muted',
                        msg.role === 'assistant' && 'bg-primary/10',
                        msg.role === 'user' && 'bg-card border border-border',
                      )}>
                        <div className="mb-1 text-[10px] font-semibold uppercase text-muted-foreground">{msg.role}</div>
                        <pre className="whitespace-pre-wrap text-sm leading-relaxed">{msg.content}</pre>
                      </div>
                    ))}
                  </div>
                </CardContent>
              )}
            </Card>
          )}

          {decision.outcomeStatus && decision.outcomeStatus !== 'pending' && (
            <Card>
              <CardHeader><CardTitle>Outcome review</CardTitle></CardHeader>
              <CardContent>
                <InfoRow label="Verdict" value={outcomeBadge(decision.outcomeStatus)} />
                <InfoRow label="Reviewed at" value={decision.outcomeRecordedAt ? formatDate(decision.outcomeRecordedAt) : '-'} />
                <InfoRow label="Reviewed by" value={decision.outcomeRecordedBy || 'System'} />
                {decision.outcomeNotes && <InfoRow label="Notes" value={decision.outcomeNotes} />}
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-3">
          <Card>
            <CardHeader><CardTitle>Details</CardTitle></CardHeader>
            <CardContent>
              <InfoRow label="Agent type" value={<span className="capitalize">{decision.agentType.replace(/_/g, ' ')}</span>} />
              <InfoRow label="Trigger" value={decision.triggerEventType || decision.triggerType} />
              <InfoRow
                label="Entity"
                value={decision.entityType ? `${decision.entityType} / ${decision.entityId?.slice(0, 8)}...` : '-'}
              />
              <InfoRow label="Model" value={decision.modelId || '-'} />
              <InfoRow label="Provider" value={decision.modelProvider || '-'} />
              <InfoRow label="Created" value={formatDate(decision.createdAt)} />
            </CardContent>
          </Card>

          {(decision.inputTokens || decision.outputTokens || decision.durationMs) && (
            <Card>
              <CardHeader><CardTitle>Token usage</CardTitle></CardHeader>
              <CardContent>
                <InfoRow label="Input tokens" value={decision.inputTokens?.toLocaleString() ?? '-'} />
                <InfoRow label="Output tokens" value={decision.outputTokens?.toLocaleString() ?? '-'} />
                <InfoRow label="Total tokens" value={((decision.inputTokens || 0) + (decision.outputTokens || 0)).toLocaleString()} />
                <InfoRow label="Duration" value={decision.durationMs ? `${(decision.durationMs / 1000).toFixed(1)}s` : '-'} />
              </CardContent>
            </Card>
          )}

          {decision.actionEntityType && decision.actionEntityId && (
            <Card>
              <CardHeader><CardTitle>Created entity</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <InfoRow label="Type" value={<span className="capitalize">{decision.actionEntityType}</span>} />
                <InfoRow label="ID" value={decision.actionEntityId.slice(0, 8) + '...'} />
                {decision.actionEntityType === 'issue' && (
                  <Button variant="outline" size="sm" className="w-full" onClick={() => navigate('/issues')}>
                    <ExternalLink className="h-4 w-4" />
                    View issues
                  </Button>
                )}
              </CardContent>
            </Card>
          )}

          {decision.triggerEventId && (
            <Card>
              <CardHeader><CardTitle>Trigger event</CardTitle></CardHeader>
              <CardContent>
                <InfoRow label="Event type" value={decision.triggerEventType || '-'} />
                <InfoRow label="Event ID" value={decision.triggerEventId.slice(0, 8) + '...'} />
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <Dialog open={showOutcomeModal} onOpenChange={setShowOutcomeModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Record decision outcome</DialogTitle>
          </DialogHeader>
          {saveError && (
            <div className="flex items-center gap-3 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              <CircleAlert className="h-4 w-4" />
              {saveError}
            </div>
          )}
          <div className="space-y-4">
            <div>
              <p className="mb-2 text-sm font-medium">Was this decision correct?</p>
              <div className="flex flex-wrap gap-2">
                {(['correct', 'partially_correct', 'incorrect'] as const).map(status => (
                  <Button
                    key={status}
                    variant={outcomeStatus === status ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setOutcomeStatus(status)}
                    className="capitalize"
                  >
                    {status === 'correct' && <CheckCircle2 className="h-4 w-4" />}
                    {status === 'partially_correct' && <MinusCircle className="h-4 w-4" />}
                    {status === 'incorrect' && <XCircle className="h-4 w-4" />}
                    {status.replace(/_/g, ' ')}
                  </Button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="outcome-notes">Notes (optional)</Label>
              <textarea
                id="outcome-notes"
                rows={3}
                placeholder="Why was this decision correct/incorrect?"
                value={outcomeNotes}
                onChange={e => setOutcomeNotes(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowOutcomeModal(false)}>Cancel</Button>
            <Button variant="gradient" onClick={recordOutcome} disabled={saving}>
              {saving ? 'Saving...' : 'Save outcome'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
