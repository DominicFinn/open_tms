import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircle2,
  CircleAlert,
  Loader2,
  Plus,
  PlayCircle,
  Search,
  Trash2,
  X,
  Zap,
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
  executionCount: number;
  lastExecutedAt: string | null;
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

const EVENT_PATTERNS = [
  { value: 'shipment.exception', label: 'Shipment Exception' },
  { value: 'shipment.status_changed', label: 'Shipment Status Changed' },
  { value: 'shipment.delivered', label: 'Shipment Delivered' },
  { value: 'shipment.*', label: 'All Shipment Events' },
  { value: 'sla.breached', label: 'SLA Breached' },
  { value: 'sla.warning', label: 'SLA Warning' },
  { value: 'sla.*', label: 'All SLA Events' },
  { value: 'cargo.misdrop_detected', label: 'Cargo Misdrop' },
  { value: 'cargo.missing_at_stop', label: 'Cargo Missing' },
  { value: 'cargo.left_on_vehicle', label: 'Cargo Left on Vehicle' },
  { value: 'cold_chain.excursion_detected', label: 'Cold Chain Excursion' },
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

function conditionsPreview(conditions: { field: string; operator: string; value?: unknown }[]): string {
  return conditions.map((c) => {
    const op = OPERATORS.find((o) => o.value === c.operator)?.label || c.operator;
    if (c.operator === 'exists' || c.operator === 'notExists') return `${c.field} ${op}`;
    return `${c.field} ${op} ${JSON.stringify(c.value)}`;
  }).join(' AND ');
}

export default function VNextAutomationRules() {
  const navigate = useNavigate();
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  const [formName, setFormName] = useState('');
  const [formEventPattern, setFormEventPattern] = useState('shipment.exception');
  const [formConditions, setFormConditions] = useState<{ field: string; operator: string; value: string }[]>([
    { field: 'payload.exceptionType', operator: 'equals', value: '' },
  ]);
  const [formActionType, setFormActionType] = useState('create_issue');
  const [formSkillChainId, setFormSkillChainId] = useState('');
  const [skillChains, setSkillChains] = useState<{ id: string; name: string; description: string | null }[]>([]);
  const [formIssuePriority, setFormIssuePriority] = useState('high');
  const [formIssueCategory, setFormIssueCategory] = useState('exception');
  const [formIssueTitle, setFormIssueTitle] = useState('');
  const [formPriority, setFormPriority] = useState(50);
  const [saving, setSaving] = useState(false);

  const loadRules = async () => {
    try {
      const [rulesRes, chainsRes] = await Promise.all([
        fetch(`${API_URL}/api/v1/automation-rules`),
        fetch(`${API_URL}/api/v1/skill-chains`),
      ]);
      const json = await rulesRes.json();
      const chainsJson = await chainsRes.json();
      setRules(json.data || []);
      setSkillChains(chainsJson.data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadRules(); }, []);

  async function toggleRule(id: string) {
    await fetch(`${API_URL}/api/v1/automation-rules/${id}/toggle`, { method: 'POST' });
    await loadRules();
  }

  async function deleteRule(id: string) {
    if (!confirm('Delete this automation rule?')) return;
    await fetch(`${API_URL}/api/v1/automation-rules/${id}`, { method: 'DELETE' });
    await loadRules();
    setSuccessMsg('Rule deleted');
    setTimeout(() => setSuccessMsg(''), 3000);
  }

  async function createRule() {
    setSaving(true);
    setError('');
    try {
      const conditions = formConditions.map((c) => {
        let value: unknown = c.value;
        if (c.operator !== 'exists' && c.operator !== 'notExists') {
          try { value = JSON.parse(c.value); } catch { /* keep as string */ }
        }
        return { field: c.field, operator: c.operator, value };
      });

      const res = await fetch(`${API_URL}/api/v1/automation-rules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formName,
          eventPattern: formEventPattern,
          conditions,
          actionType: formActionType,
          actionConfig: formActionType === 'skill_chain'
            ? {}
            : {
                issuePriority: formIssuePriority,
                issueCategory: formIssueCategory,
                issueTitle: formIssueTitle || formName,
              },
          priority: formPriority,
          ...(formActionType === 'skill_chain' && formSkillChainId ? { skillChainId: formSkillChainId } : {}),
        }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);

      setShowCreate(false);
      setFormName('');
      setFormConditions([{ field: 'payload.exceptionType', operator: 'equals', value: '' }]);
      await loadRules();
      setSuccessMsg('Rule created');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const filtered = search
    ? rules.filter((r) => r.name.toLowerCase().includes(search.toLowerCase()) || r.eventPattern.includes(search.toLowerCase()))
    : rules;

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-3 py-24 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin" />
        <h3 className="text-lg font-medium">Loading rules...</h3>
      </div>
    );
  }

  const stats = [
    { label: 'Total rules', value: rules.length, icon: Zap, tone: 'bg-primary/10 text-primary' },
    { label: 'Active', value: rules.filter(r => r.enabled).length, icon: CheckCircle2, tone: 'bg-success/15 text-success' },
    { label: 'Total executions', value: rules.reduce((sum, r) => sum + r.executionCount, 0), icon: PlayCircle, tone: 'bg-info/15 text-info' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Automation rules</h1>
          <p className="mt-1 text-sm text-muted-foreground">{rules.length} rules</p>
        </div>
        <Button variant="gradient" onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4" />
          Create rule
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
          <div className="relative min-w-[240px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search rules..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        <Separator />

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-12 text-muted-foreground">
            <Zap className="h-10 w-10 opacity-40" />
            <h3 className="text-base font-medium">No automation rules yet</h3>
            <p className="text-sm">Create rules manually or promote agent decisions to automate proven patterns.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rule</TableHead>
                <TableHead>Event</TableHead>
                <TableHead>Conditions</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Executions</TableHead>
                <TableHead>Last run</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[60px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(rule => {
                const preview = conditionsPreview(rule.conditions);
                return (
                  <TableRow key={rule.id} onClick={() => navigate(`/automation-rules/${rule.id}`)} className="cursor-pointer">
                    <TableCell>
                      <div className="font-medium">{rule.name}</div>
                      {rule.sourceDecisionId && (
                        <div className="text-xs text-muted-foreground">Promoted from agent</div>
                      )}
                    </TableCell>
                    <TableCell><code className="rounded bg-muted px-1.5 py-0.5 text-xs">{rule.eventPattern}</code></TableCell>
                    <TableCell>
                      <span className="font-mono text-xs text-muted-foreground">
                        {preview.length > 60 ? `${preview.slice(0, 60)}...` : preview}
                      </span>
                    </TableCell>
                    <TableCell>
                      {rule.actionType === 'create_issue' && <Badge variant="info">Create issue</Badge>}
                      {rule.actionType === 'escalate_issue' && <Badge variant="warning">Escalate</Badge>}
                      {rule.actionType === 'skill_chain' && <Badge>Skill chain</Badge>}
                    </TableCell>
                    <TableCell className="font-semibold">{rule.executionCount}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{timeAgo(rule.lastExecutedAt)}</TableCell>
                    <TableCell onClick={e => e.stopPropagation()}>
                      <Badge
                        variant={rule.enabled ? 'success' : 'secondary'}
                        className="cursor-pointer"
                        onClick={() => toggleRule(rule.id)}
                      >
                        {rule.enabled ? 'Active' : 'Disabled'}
                      </Badge>
                    </TableCell>
                    <TableCell onClick={e => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" onClick={() => deleteRule(rule.id)} title="Delete" className="text-destructive hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Create automation rule</DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            <div className="space-y-2">
              <Label>Rule name</Label>
              <Input placeholder="e.g. Critical delay auto-escalation" value={formName} onChange={e => setFormName(e.target.value)} />
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-primary">WHEN</h3>
              <div className="space-y-2">
                <Label>Event type</Label>
                <Select value={formEventPattern} onValueChange={setFormEventPattern}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {EVENT_PATTERNS.map(ep => (
                      <SelectItem key={ep.value} value={ep.value}>{ep.label} ({ep.value})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-primary">GIVEN</h3>
              {formConditions.map((c, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    className="flex-[2] font-mono text-sm"
                    placeholder="payload.delayMinutes"
                    value={c.field}
                    onChange={e => {
                      const arr = [...formConditions];
                      arr[i].field = e.target.value;
                      setFormConditions(arr);
                    }}
                  />
                  <Select
                    value={c.operator}
                    onValueChange={v => {
                      const arr = [...formConditions];
                      arr[i].operator = v;
                      setFormConditions(arr);
                    }}
                  >
                    <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {OPERATORS.map(op => (
                        <SelectItem key={op.value} value={op.value}>{op.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {c.operator !== 'exists' && c.operator !== 'notExists' && (
                    <Input
                      className="flex-[2] font-mono text-sm"
                      placeholder='60 or "critical" or ["a","b"]'
                      value={c.value}
                      onChange={e => {
                        const arr = [...formConditions];
                        arr[i].value = e.target.value;
                        setFormConditions(arr);
                      }}
                    />
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setFormConditions(formConditions.filter((_, j) => j !== i))}
                    disabled={formConditions.length === 1}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setFormConditions([...formConditions, { field: '', operator: 'equals', value: '' }])}
              >
                <Plus className="h-4 w-4" />
                Add condition
              </Button>
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-primary">THEN</h3>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Action</Label>
                  <Select value={formActionType} onValueChange={setFormActionType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="create_issue">Create issue</SelectItem>
                      <SelectItem value="escalate_issue">Escalate issue</SelectItem>
                      {skillChains.length > 0 && <SelectItem value="skill_chain">Skill chain</SelectItem>}
                    </SelectContent>
                  </Select>
                </div>
                {formActionType === 'create_issue' && (
                  <>
                    <div className="space-y-2">
                      <Label>Priority</Label>
                      <Select value={formIssuePriority} onValueChange={setFormIssuePriority}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="critical">Critical</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Category</Label>
                      <Select value={formIssueCategory} onValueChange={setFormIssueCategory}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="exception">Exception</SelectItem>
                          <SelectItem value="delay">Delay</SelectItem>
                          <SelectItem value="damage">Damage</SelectItem>
                          <SelectItem value="compliance">Compliance</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="md:col-span-2 space-y-2">
                      <Label>Issue title</Label>
                      <Input placeholder="Leave blank to use rule name" value={formIssueTitle} onChange={e => setFormIssueTitle(e.target.value)} />
                    </div>
                  </>
                )}
                {formActionType === 'skill_chain' && (
                  <div className="md:col-span-2 space-y-2">
                    <Label>Skill chain</Label>
                    <Select value={formSkillChainId} onValueChange={setFormSkillChainId}>
                      <SelectTrigger><SelectValue placeholder="Select a skill chain..." /></SelectTrigger>
                      <SelectContent>
                        {skillChains.map(sc => (
                          <SelectItem key={sc.id} value={sc.id}>
                            {sc.name}{sc.description ? ` - ${sc.description}` : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {skillChains.length === 0 && (
                      <p className="text-xs text-warning">
                        No skill chains created yet. Create one at Settings &gt; Skill Chains first.
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Rule priority ({formPriority})</Label>
              <input
                type="range"
                min="1"
                max="100"
                value={formPriority}
                onChange={e => setFormPriority(parseInt(e.target.value, 10))}
                className="w-full"
              />
              <span className="text-xs text-muted-foreground">Lower number = higher priority. First matching rule executes.</span>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button variant="gradient" onClick={createRule} disabled={saving || !formName}>
              {saving ? 'Creating...' : 'Create rule'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
