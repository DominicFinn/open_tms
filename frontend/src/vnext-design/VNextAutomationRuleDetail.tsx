import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Beaker,
  Check,
  CheckCircle2,
  CircleAlert,
  ExternalLink,
  History,
  Info,
  Loader2,
  Pencil,
  Plus,
  X,
} from 'lucide-react';

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

interface AutomationRule {
  id: string;
  name: string;
  description: string | null;
  enabled: boolean;
  priority: number;
  eventPattern: string;
  conditions: { field: string; operator: string; value?: unknown }[];
  actionType: string;
  actionConfig: Record<string, unknown>;
  sourceDecisionId: string | null;
  skillChainId: string | null;
  inlineSteps: unknown[] | null;
  executionCount: number;
  lastExecutedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ExecutionLog {
  id: string;
  ruleName: string;
  eventType: string;
  eventId: string;
  entityType: string;
  entityId: string;
  actionType: string;
  actionResult: Record<string, unknown> | null;
  conditionsMatched: boolean;
  evaluationMs: number | null;
  createdAt: string;
}

const OPERATORS = [
  { value: 'equals', label: '=' },
  { value: 'notEquals', label: '!=' },
  { value: 'greaterThan', label: '>' },
  { value: 'lessThan', label: '<' },
  { value: 'greaterThanOrEqual', label: '>=' },
  { value: 'lessThanOrEqual', label: '<=' },
  { value: 'contains', label: 'contains' },
  { value: 'in', label: 'in' },
  { value: 'exists', label: 'exists' },
  { value: 'notExists', label: 'not exists' },
];

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return 'Never';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-border py-2 text-sm last:border-b-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

export default function VNextAutomationRuleDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [rule, setRule] = useState<AutomationRule | null>(null);
  const [executions, setExecutions] = useState<ExecutionLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editPriority, setEditPriority] = useState(50);
  const [editConditions, setEditConditions] = useState<{ field: string; operator: string; value: string }[]>([]);
  const [editActionConfig, setEditActionConfig] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const [showTest, setShowTest] = useState(false);
  const [testEventType, setTestEventType] = useState('');
  const [testPayload, setTestPayload] = useState('{}');
  const [testResult, setTestResult] = useState<Record<string, unknown> | null>(null);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    loadData();
  }, [id]);

  async function loadData() {
    try {
      setLoading(true);
      const [ruleRes, execRes] = await Promise.all([
        fetch(`${API_URL}/api/v1/automation-rules/${id}`),
        fetch(`${API_URL}/api/v1/automation-rules/${id}/executions?limit=20`),
      ]);
      const ruleJson = await ruleRes.json();
      const execJson = await execRes.json();

      if (ruleJson.data) {
        setRule(ruleJson.data);
        setEditName(ruleJson.data.name);
        setEditDescription(ruleJson.data.description || '');
        setEditPriority(ruleJson.data.priority);
        setEditConditions(ruleJson.data.conditions.map((c: { field: string; operator: string; value?: unknown }) => ({
          field: c.field, operator: c.operator, value: c.value !== undefined ? JSON.stringify(c.value) : '',
        })));
        setEditActionConfig(Object.fromEntries(
          Object.entries(ruleJson.data.actionConfig as Record<string, unknown>).map(([k, v]) => [k, String(v)])
        ));
        setTestEventType(ruleJson.data.eventPattern);
      }
      setExecutions(execJson.data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function saveEdit() {
    setSaving(true);
    setError('');
    try {
      const conditions = editConditions.map((c) => {
        let value: unknown = c.value;
        if (c.operator !== 'exists' && c.operator !== 'notExists') {
          try { value = JSON.parse(c.value); } catch { /* keep as string */ }
        }
        return { field: c.field, operator: c.operator, value };
      });

      const res = await fetch(`${API_URL}/api/v1/automation-rules/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName,
          description: editDescription || null,
          priority: editPriority,
          conditions,
          actionConfig: editActionConfig,
        }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setRule(json.data);
      setEditing(false);
      setSuccessMsg('Rule updated');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function runTest() {
    setTesting(true);
    setTestResult(null);
    try {
      let payload: Record<string, unknown> = {};
      try { payload = JSON.parse(testPayload); } catch { /* empty */ }

      const res = await fetch(`${API_URL}/api/v1/automation-rules/${id}/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: {
            type: testEventType || rule?.eventPattern || 'shipment.exception',
            entityType: 'shipment',
            entityId: 'test-entity',
            timestamp: new Date().toISOString(),
            payload,
          },
        }),
      });
      const json = await res.json();
      setTestResult(json.data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setTesting(false);
    }
  }

  async function toggleRule() {
    await fetch(`${API_URL}/api/v1/automation-rules/${id}/toggle`, { method: 'POST' });
    await loadData();
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-3 py-24 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin" />
        <h3 className="text-lg font-medium">Loading rule...</h3>
      </div>
    );
  }

  if (!rule) {
    return (
      <div className="flex items-center gap-3 rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
        <CircleAlert className="h-5 w-5" />
        Rule not found
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => navigate('/automation-rules')}>
          <ArrowLeft className="h-4 w-4" />
          Rules
        </Button>
        <span className="text-sm text-muted-foreground">/ {rule.name}</span>
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

      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-3xl font-bold tracking-tight">{rule.name}</h1>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setShowTest(true)}>
            <Beaker className="h-4 w-4" />
            Test rule
          </Button>
          <Button variant="outline" onClick={() => setEditing(!editing)}>
            {editing ? <X className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
            {editing ? 'Cancel' : 'Edit'}
          </Button>
          <Button variant={rule.enabled ? 'outline' : 'default'} onClick={toggleRule}>
            {rule.enabled ? 'Disable' : 'Enable'}
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Badge variant={rule.enabled ? 'success' : 'secondary'}>{rule.enabled ? 'Active' : 'Disabled'}</Badge>
        <Badge variant="info">Priority {rule.priority}</Badge>
        <Badge variant="secondary">{rule.executionCount} executions</Badge>
        {rule.sourceDecisionId && <Badge>Promoted from agent</Badge>}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>When: {rule.eventPattern}</CardTitle></CardHeader>
            <CardContent>
              <h3 className="mb-3 text-xs font-semibold text-primary">Given these conditions match:</h3>
              {editing ? (
                <div className="space-y-2">
                  {editConditions.map((c, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Input
                        className="flex-[2] font-mono text-sm"
                        value={c.field}
                        onChange={e => {
                          const arr = [...editConditions];
                          arr[i].field = e.target.value;
                          setEditConditions(arr);
                        }}
                      />
                      <Select
                        value={c.operator}
                        onValueChange={v => {
                          const arr = [...editConditions];
                          arr[i].operator = v;
                          setEditConditions(arr);
                        }}
                      >
                        <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {OPERATORS.map(op => <SelectItem key={op.value} value={op.value}>{op.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      {c.operator !== 'exists' && c.operator !== 'notExists' && (
                        <Input
                          className="flex-[2] font-mono text-sm"
                          value={c.value}
                          onChange={e => {
                            const arr = [...editConditions];
                            arr[i].value = e.target.value;
                            setEditConditions(arr);
                          }}
                        />
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setEditConditions(editConditions.filter((_, j) => j !== i))}
                        disabled={editConditions.length === 1}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <Button variant="ghost" size="sm" onClick={() => setEditConditions([...editConditions, { field: '', operator: 'equals', value: '' }])}>
                    <Plus className="h-4 w-4" />
                    Add condition
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {rule.conditions.map((c, i) => (
                    <div key={i} className="flex items-center gap-2 rounded-md bg-muted px-3 py-2 font-mono text-sm">
                      <span className="font-semibold text-primary">{c.field}</span>
                      <span className="text-muted-foreground">{OPERATORS.find(o => o.value === c.operator)?.label || c.operator}</span>
                      {c.value !== undefined && <span>{JSON.stringify(c.value)}</span>}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Then: {rule.actionType.replace(/_/g, ' ')}</CardTitle></CardHeader>
            <CardContent>
              {editing ? (
                <div className="grid gap-3 md:grid-cols-2">
                  {Object.entries(editActionConfig).map(([key, value]) => (
                    <div key={key} className="space-y-2">
                      <Label>{key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())}</Label>
                      <Input value={value} onChange={e => setEditActionConfig({ ...editActionConfig, [key]: e.target.value })} />
                    </div>
                  ))}
                </div>
              ) : (
                Object.entries(rule.actionConfig).map(([k, v]) => (
                  <InfoRow key={k} label={k.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())} value={String(v)} />
                ))
              )}
            </CardContent>
          </Card>

          {editing && (
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
              <Button variant="gradient" onClick={saveEdit} disabled={saving}>
                {saving ? 'Saving...' : 'Save changes'}
              </Button>
            </div>
          )}

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Execution log</CardTitle>
              <span className="text-sm text-muted-foreground">{executions.length} recent</span>
            </CardHeader>
            {executions.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-12 text-muted-foreground">
                <History className="h-10 w-10 opacity-40" />
                <h3 className="text-base font-medium">No executions yet</h3>
                <p className="text-sm">This rule has not matched any events yet.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Event</TableHead>
                    <TableHead>Entity</TableHead>
                    <TableHead>Result</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>Speed</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {executions.map(ex => (
                    <TableRow key={ex.id}>
                      <TableCell><code className="rounded bg-muted px-1.5 py-0.5 text-xs">{ex.eventType}</code></TableCell>
                      <TableCell className="text-sm">{ex.entityType}/{ex.entityId.slice(0, 8)}</TableCell>
                      <TableCell>
                        <Badge variant={ex.conditionsMatched ? 'success' : 'secondary'}>
                          {ex.conditionsMatched ? 'Matched' : 'No match'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{timeAgo(ex.createdAt)}</TableCell>
                      <TableCell className="text-sm">{ex.evaluationMs !== null ? `${ex.evaluationMs}ms` : '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
        </div>

        <div className="space-y-3">
          <Card>
            <CardHeader><CardTitle>Details</CardTitle></CardHeader>
            <CardContent>
              <InfoRow label="Event pattern" value={<code className="rounded bg-muted px-1.5 py-0.5 text-xs">{rule.eventPattern}</code>} />
              <InfoRow
                label="Priority"
                value={
                  editing ? (
                    <Input
                      type="number"
                      min="1"
                      max="100"
                      value={editPriority}
                      onChange={e => setEditPriority(parseInt(e.target.value, 10))}
                      className="w-20"
                    />
                  ) : String(rule.priority)
                }
              />
              <InfoRow label="Executions" value={String(rule.executionCount)} />
              <InfoRow label="Last run" value={timeAgo(rule.lastExecutedAt)} />
              <InfoRow label="Created" value={new Date(rule.createdAt).toLocaleDateString()} />
            </CardContent>
          </Card>

          {rule.sourceDecisionId && (
            <Card>
              <CardHeader><CardTitle>Source decision</CardTitle></CardHeader>
              <CardContent>
                <Button variant="outline" className="w-full" onClick={() => navigate(`/agent-decisions/${rule.sourceDecisionId}`)}>
                  <ExternalLink className="h-4 w-4" />
                  View decision
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <Dialog open={showTest} onOpenChange={open => { setShowTest(open); if (!open) setTestResult(null); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Test rule (dry run)</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Event type</Label>
              <Input value={testEventType} onChange={e => setTestEventType(e.target.value)} placeholder="shipment.exception" />
            </div>
            <div className="space-y-2">
              <Label>Event payload (JSON)</Label>
              <textarea
                rows={6}
                value={testPayload}
                onChange={e => setTestPayload(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>

            {testResult && (
              <div className="space-y-3">
                <div className={cn(
                  'flex items-center gap-3 rounded-md border p-3 text-sm',
                  testResult.allConditionsMatched
                    ? 'border-success/30 bg-success/10 text-success'
                    : 'border-warning/30 bg-warning/10 text-warning',
                )}>
                  {testResult.allConditionsMatched ? <CheckCircle2 className="h-4 w-4" /> : <Info className="h-4 w-4" />}
                  {testResult.allConditionsMatched ? 'Rule would fire and execute action' : 'Rule would NOT fire - conditions not met'}
                </div>

                <h3 className="text-sm font-semibold">Condition results:</h3>
                <div className="flex flex-col gap-1.5">
                  {(testResult.conditionResults as Array<{ field: string; operator: string; expected: unknown; actual: unknown; matched: boolean }>)?.map((cr, i) => (
                    <div
                      key={i}
                      className={cn(
                        'flex items-center gap-2 rounded-md px-3 py-2 font-mono text-sm',
                        cr.matched
                          ? 'bg-success/15 text-success'
                          : 'bg-destructive/15 text-destructive',
                      )}
                    >
                      {cr.matched ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
                      <span>{cr.field} {cr.operator} {JSON.stringify(cr.expected)}</span>
                      <span className="ml-auto opacity-70">actual: {JSON.stringify(cr.actual)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTest(false)}>Close</Button>
            <Button variant="gradient" onClick={runTest} disabled={testing}>
              {testing ? 'Testing...' : 'Run test'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
