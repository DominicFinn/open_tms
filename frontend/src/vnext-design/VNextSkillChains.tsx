import React, { useState, useEffect } from 'react';
import {
  Plus,
  HelpCircle,
  Wrench,
  Trash2,
  X,
  GitBranch,
  Loader2,
  type LucideIcon,
  Mail,
  Webhook,
  MessageSquare,
  Phone,
  ClipboardList,
  ArrowUp,
} from 'lucide-react';

import { API_URL } from '../api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

interface SkillDefinition {
  type: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  fields: { key: string; label: string; type: string; required: boolean; placeholder?: string }[];
  requiresConfig: boolean;
}

interface SkillChain {
  id: string;
  name: string;
  description: string | null;
  steps: SkillChainStep[];
  createdAt: string;
}

type SkillChainStep =
  | { type: 'skill'; skillType: string; fields: Record<string, string> }
  | { type: 'question'; question: string; conditions: { field: string; operator: string; value?: string }[]; branches: { label: string; matched: boolean; steps: SkillChainStep[] }[] };

const OPERATORS = [
  { value: 'equals', label: '=' },
  { value: 'notEquals', label: '!=' },
  { value: 'greaterThan', label: '>' },
  { value: 'lessThan', label: '<' },
  { value: 'contains', label: 'contains' },
  { value: 'exists', label: 'exists' },
];

const ICON_MAP: Record<string, LucideIcon> = {
  email: Mail,
  mail: Mail,
  send: Mail,
  webhook: Webhook,
  comment: MessageSquare,
  message: MessageSquare,
  phone: Phone,
  driver: Phone,
  issue: ClipboardList,
  escalate: ArrowUp,
};

function getSkillIcon(name: string): LucideIcon {
  const key = (name || '').toLowerCase();
  for (const k in ICON_MAP) {
    if (key.includes(k)) return ICON_MAP[k];
  }
  return Wrench;
}

function StepDisplay({ step, skills, depth = 0 }: { step: SkillChainStep; skills: SkillDefinition[]; depth?: number }) {
  const indentStyle = { marginLeft: depth * 24 };

  if (step.type === 'skill') {
    const def = skills.find(s => s.type === step.skillType);
    const Icon = getSkillIcon(def?.icon || def?.name || step.skillType);
    return (
      <div style={indentStyle} className="mb-2 rounded-md border-l-4 border-l-primary bg-muted px-3 py-2">
        <div className="mb-1 flex items-center gap-2">
          <Icon className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">{def?.name || step.skillType}</span>
        </div>
        <div className="font-mono text-xs text-muted-foreground">
          {Object.entries(step.fields).map(([k, v]) => (
            <div key={k}>{k}: {v}</div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={indentStyle} className="mb-2">
      <div className="mb-2 rounded-md border-l-4 border-l-warning bg-muted px-3 py-2">
        <div className="mb-1 flex items-center gap-2">
          <HelpCircle className="h-4 w-4 text-warning" />
          <span className="text-sm font-semibold">{step.question}</span>
        </div>
        <div className="font-mono text-xs text-muted-foreground">
          {step.conditions.map((c, i) => (
            <div key={i}>{c.field} {c.operator} {c.value !== undefined ? JSON.stringify(c.value) : ''}</div>
          ))}
        </div>
      </div>
      {step.branches.map((branch, bi) => (
        <div key={bi} className="ml-4">
          <div className={cn('mb-1 text-xs font-semibold', branch.matched ? 'text-success' : 'text-destructive')}>
            {branch.matched ? 'Yes' : 'No'}: {branch.label}
          </div>
          {branch.steps.map((s, si) => (
            <StepDisplay key={si} step={s} skills={skills} depth={depth + 1} />
          ))}
        </div>
      ))}
    </div>
  );
}

function Banner({ variant, message, onClose }: { variant: 'success' | 'error'; message: string; onClose?: () => void }) {
  const tone =
    variant === 'success'
      ? 'border-success/30 bg-success/10 text-success'
      : 'border-destructive/30 bg-destructive/10 text-destructive';
  return (
    <div className={`flex items-start justify-between gap-3 rounded-md border p-3 text-sm ${tone}`}>
      <span>{message}</span>
      {onClose && (
        <button onClick={onClose} className="text-xs underline opacity-70 hover:opacity-100">Dismiss</button>
      )}
    </div>
  );
}

export default function VNextSkillChains() {
  const [chains, setChains] = useState<SkillChain[]>([]);
  const [skills, setSkills] = useState<SkillDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formSteps, setFormSteps] = useState<SkillChainStep[]>([]);
  const [saving, setSaving] = useState(false);

  const [showAddStep, setShowAddStep] = useState(false);
  const [addStepType, setAddStepType] = useState<'skill' | 'question'>('skill');
  const [addSkillType, setAddSkillType] = useState('');
  const [addSkillFields, setAddSkillFields] = useState<Record<string, string>>({});
  const [addQuestion, setAddQuestion] = useState('');
  const [addConditions, setAddConditions] = useState<{ field: string; operator: string; value: string }[]>([{ field: '', operator: 'equals', value: '' }]);
  const [addYesSkillType, setAddYesSkillType] = useState('');
  const [addYesFields, setAddYesFields] = useState<Record<string, string>>({});
  const [addNoSkillType, setAddNoSkillType] = useState('');
  const [addNoFields, setAddNoFields] = useState<Record<string, string>>({});

  const loadData = async () => {
    try {
      const [chainsRes, skillsRes] = await Promise.all([
        fetch(`${API_URL}/api/v1/skill-chains`),
        fetch(`${API_URL}/api/v1/skills`),
      ]);
      setChains((await chainsRes.json()).data || []);
      setSkills((await skillsRes.json()).data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  function openAddStep() {
    setAddStepType('skill');
    setAddSkillType(skills[0]?.type || '');
    setAddSkillFields({});
    setAddQuestion('');
    setAddConditions([{ field: '', operator: 'equals', value: '' }]);
    setAddYesSkillType(skills[0]?.type || '');
    setAddYesFields({});
    setAddNoSkillType(skills[0]?.type || '');
    setAddNoFields({});
    setShowAddStep(true);
  }

  function confirmAddStep() {
    if (addStepType === 'skill') {
      setFormSteps([...formSteps, { type: 'skill', skillType: addSkillType, fields: { ...addSkillFields } }]);
    } else {
      const conditions = addConditions.map(c => {
        let value: unknown = c.value;
        try { value = JSON.parse(c.value); } catch { /* keep string */ }
        return { field: c.field, operator: c.operator, value: String(value) };
      });
      setFormSteps([
        ...formSteps,
        {
          type: 'question',
          question: addQuestion,
          conditions,
          branches: [
            { label: 'Yes', matched: true, steps: addYesSkillType ? [{ type: 'skill', skillType: addYesSkillType, fields: { ...addYesFields } }] : [] },
            { label: 'No', matched: false, steps: addNoSkillType ? [{ type: 'skill', skillType: addNoSkillType, fields: { ...addNoFields } }] : [] },
          ],
        },
      ]);
    }
    setShowAddStep(false);
  }

  async function saveChain() {
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/api/v1/skill-chains`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: formName, description: formDescription || undefined, steps: formSteps }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setShowCreate(false);
      setFormName('');
      setFormDescription('');
      setFormSteps([]);
      await loadData();
      setSuccessMsg('Skill chain created');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function deleteChain(chainId: string) {
    if (!confirm('Delete this skill chain?')) return;
    await fetch(`${API_URL}/api/v1/skill-chains/${chainId}`, { method: 'DELETE' });
    await loadData();
    setSuccessMsg('Chain deleted');
    setTimeout(() => setSuccessMsg(''), 3000);
  }

  const selectedSkillDef = skills.find(s => s.type === addSkillType);
  const yesSkillDef = skills.find(s => s.type === addYesSkillType);
  const noSkillDef = skills.find(s => s.type === addNoSkillType);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Skill chains</h1>
          <p className="mt-1 text-sm text-muted-foreground">{chains.length} chains</p>
        </div>
        <Button variant="gradient" onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4" />
          Create chain
        </Button>
      </div>

      {successMsg && <Banner variant="success" message={successMsg} onClose={() => setSuccessMsg('')} />}
      {error && <Banner variant="error" message={error} onClose={() => setError('')} />}

      {chains.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-12 text-center text-muted-foreground">
          <GitBranch className="h-10 w-10" />
          <h3 className="text-lg font-medium">No skill chains yet</h3>
          <p className="text-sm">Create a chain to compose multiple skills with conditional branching.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {chains.map(chain => (
            <Card key={chain.id}>
              <CardHeader className="flex flex-row items-start justify-between">
                <div>
                  <CardTitle>{chain.name}</CardTitle>
                  {chain.description && <CardDescription>{chain.description}</CardDescription>}
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{chain.steps.length} steps</Badge>
                  <Button variant="ghost" size="icon" onClick={() => deleteChain(chain.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {chain.steps.map((step, i) => <StepDisplay key={i} step={step} skills={skills} />)}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Create skill chain</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Chain name</Label>
              <Input value={formName} onChange={e => setFormName(e.target.value)} placeholder="e.g. Critical Delay Response" />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input value={formDescription} onChange={e => setFormDescription(e.target.value)} placeholder="Optional" />
            </div>

            <h3 className="text-sm font-semibold">Steps ({formSteps.length})</h3>
            {formSteps.map((step, i) => (
              <div key={i} className="relative">
                <StepDisplay step={step} skills={skills} />
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1"
                  onClick={() => setFormSteps(formSteps.filter((_, j) => j !== i))}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ))}

            <Button variant="outline" className="w-full" onClick={openAddStep}>
              <Plus className="h-4 w-4" />
              Add step
            </Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button variant="gradient" onClick={saveChain} disabled={saving || !formName || formSteps.length === 0}>
              {saving ? 'Saving...' : 'Create chain'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showAddStep} onOpenChange={setShowAddStep}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Add step</DialogTitle>
          </DialogHeader>

          <div className="flex gap-2">
            <Button
              variant={addStepType === 'skill' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setAddStepType('skill')}
            >
              <Wrench className="h-4 w-4" />
              Skill
            </Button>
            <Button
              variant={addStepType === 'question' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setAddStepType('question')}
            >
              <HelpCircle className="h-4 w-4" />
              Question (Branch)
            </Button>
          </div>

          {addStepType === 'skill' && (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>Skill</Label>
                <Select value={addSkillType} onValueChange={v => { setAddSkillType(v); setAddSkillFields({}); }}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {skills.map(s => (
                      <SelectItem key={s.type} value={s.type}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {selectedSkillDef?.fields.map(f => (
                <div className="space-y-2" key={f.key}>
                  <Label>{f.label} {f.required && '*'}</Label>
                  <Input
                    placeholder={f.placeholder || `Use {{template}} syntax`}
                    value={addSkillFields[f.key] || ''}
                    onChange={e => setAddSkillFields({ ...addSkillFields, [f.key]: e.target.value })}
                  />
                </div>
              ))}
            </div>
          )}

          {addStepType === 'question' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Question</Label>
                <Input value={addQuestion} onChange={e => setAddQuestion(e.target.value)} placeholder="Is the delay greater than 60 minutes?" />
              </div>

              <div>
                <h4 className="mb-2 text-sm font-semibold">Conditions</h4>
                {addConditions.map((c, i) => (
                  <div key={i} className="mb-2 grid grid-cols-[2fr_1fr_2fr] gap-2">
                    <Input
                      className="font-mono text-xs"
                      placeholder="payload.delayMinutes"
                      value={c.field}
                      onChange={e => { const arr = [...addConditions]; arr[i].field = e.target.value; setAddConditions(arr); }}
                    />
                    <Select value={c.operator} onValueChange={v => { const arr = [...addConditions]; arr[i].operator = v; setAddConditions(arr); }}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {OPERATORS.map(op => (
                          <SelectItem key={op.value} value={op.value}>{op.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      className="font-mono text-xs"
                      placeholder="60"
                      value={c.value}
                      onChange={e => { const arr = [...addConditions]; arr[i].value = e.target.value; setAddConditions(arr); }}
                    />
                  </div>
                ))}
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2 rounded-md border border-success/30 bg-success/5 p-3">
                  <h4 className="text-sm font-semibold text-success">Yes branch</h4>
                  <Select value={addYesSkillType} onValueChange={v => { setAddYesSkillType(v); setAddYesFields({}); }}>
                    <SelectTrigger>
                      <SelectValue placeholder="No action" />
                    </SelectTrigger>
                    <SelectContent>
                      {skills.map(s => (
                        <SelectItem key={s.type} value={s.type}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {yesSkillDef?.fields.map(f => (
                    <div key={f.key} className="space-y-1">
                      <label className="text-xs font-semibold">{f.label}</label>
                      <Input
                        className="text-xs"
                        placeholder={f.placeholder}
                        value={addYesFields[f.key] || ''}
                        onChange={e => setAddYesFields({ ...addYesFields, [f.key]: e.target.value })}
                      />
                    </div>
                  ))}
                </div>

                <div className="space-y-2 rounded-md border border-destructive/30 bg-destructive/5 p-3">
                  <h4 className="text-sm font-semibold text-destructive">No branch</h4>
                  <Select value={addNoSkillType} onValueChange={v => { setAddNoSkillType(v); setAddNoFields({}); }}>
                    <SelectTrigger>
                      <SelectValue placeholder="No action" />
                    </SelectTrigger>
                    <SelectContent>
                      {skills.map(s => (
                        <SelectItem key={s.type} value={s.type}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {noSkillDef?.fields.map(f => (
                    <div key={f.key} className="space-y-1">
                      <label className="text-xs font-semibold">{f.label}</label>
                      <Input
                        className="text-xs"
                        placeholder={f.placeholder}
                        value={addNoFields[f.key] || ''}
                        onChange={e => setAddNoFields({ ...addNoFields, [f.key]: e.target.value })}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddStep(false)}>Cancel</Button>
            <Button variant="gradient" onClick={confirmAddStep}>Add</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
