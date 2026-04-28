import React, { useState, useEffect } from 'react';
import {
  Plus,
  Pencil,
  X,
  Loader2,
  Wrench,
  CheckCircle2,
  type LucideIcon,
  AlertCircle,
  Mail,
  Webhook,
  MessageSquare,
  Phone,
  ClipboardList,
  ArrowUp,
} from 'lucide-react';

import { API_URL } from '../api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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
  configSchema: { key: string; label: string; type: string; required: boolean; placeholder?: string }[];
  requiresConfig: boolean;
}

interface SkillConfig {
  id: string;
  skillType: string;
  name: string;
  config: Record<string, unknown>;
  enabled: boolean;
  createdAt: string;
}

const ICON_MAP: Record<string, LucideIcon> = {
  email: Mail,
  mail: Mail,
  send: Mail,
  webhook: Webhook,
  link: Webhook,
  comment: MessageSquare,
  message: MessageSquare,
  phone: Phone,
  call: Phone,
  driver: Phone,
  assignment: ClipboardList,
  issue: ClipboardList,
  escalate: ArrowUp,
  arrow_upward: ArrowUp,
};

function getSkillIcon(name: string): LucideIcon {
  const key = name.toLowerCase();
  for (const k in ICON_MAP) {
    if (key.includes(k)) return ICON_MAP[k];
  }
  return Wrench;
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

export default function VNextSkillsConfig() {
  const [definitions, setDefinitions] = useState<SkillDefinition[]>([]);
  const [configs, setConfigs] = useState<SkillConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const [showConfigForm, setShowConfigForm] = useState(false);
  const [configSkillType, setConfigSkillType] = useState('');
  const [configName, setConfigName] = useState('');
  const [configValues, setConfigValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [editingConfigId, setEditingConfigId] = useState<string | null>(null);

  const loadData = async () => {
    try {
      const [defsRes, configsRes] = await Promise.all([
        fetch(`${API_URL}/api/v1/skills`),
        fetch(`${API_URL}/api/v1/skill-configs`),
      ]);
      const defsJson = await defsRes.json();
      const configsJson = await configsRes.json();
      setDefinitions(defsJson.data || []);
      setConfigs(configsJson.data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  function openConfigForm(skillType: string) {
    const def = definitions.find(d => d.type === skillType);
    setConfigSkillType(skillType);
    setConfigName(def?.name || skillType);
    setConfigValues({});
    setEditingConfigId(null);
    setShowConfigForm(true);
  }

  async function saveConfig() {
    setSaving(true);
    setError('');
    try {
      const url = editingConfigId
        ? `${API_URL}/api/v1/skill-configs/${editingConfigId}`
        : `${API_URL}/api/v1/skill-configs`;
      const method = editingConfigId ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skillType: configSkillType, name: configName, config: configValues }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setShowConfigForm(false);
      setEditingConfigId(null);
      await loadData();
      setSuccessMsg(editingConfigId ? 'Configuration updated' : 'Skill configured');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function deleteConfig(id: string) {
    await fetch(`${API_URL}/api/v1/skill-configs/${id}`, { method: 'DELETE' });
    await loadData();
    setSuccessMsg('Configuration deleted');
    setTimeout(() => setSuccessMsg(''), 3000);
  }

  function editConfig(config: SkillConfig) {
    setConfigSkillType(config.skillType);
    setConfigName(config.name);
    setConfigValues(Object.fromEntries(
      Object.entries(config.config).map(([k, v]) => [k, String(v)])
    ));
    setEditingConfigId(config.id);
    setShowConfigForm(true);
  }

  const configuredTypes = new Set(configs.map(c => c.skillType));

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const selectedDef = definitions.find(d => d.type === configSkillType);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Skills configuration</h1>
          <p className="mt-1 text-sm text-muted-foreground">Configure available skills for automation rules and chains</p>
        </div>
      </div>

      {successMsg && <Banner variant="success" message={successMsg} onClose={() => setSuccessMsg('')} />}
      {error && <Banner variant="error" message={error} onClose={() => setError('')} />}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {definitions.map(def => {
          const isConfigured = !def.requiresConfig || configuredTypes.has(def.type);
          const skillConfigs = configs.filter(c => c.skillType === def.type);
          const Icon = getSkillIcon(def.icon || def.name);

          return (
            <Card key={def.type}>
              <CardContent className="p-4">
                <div className="mb-3 flex items-start gap-3">
                  <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg', isConfigured ? 'bg-success/15 text-success' : 'bg-muted text-muted-foreground')}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-semibold">{def.name}</h3>
                      <Badge variant={isConfigured ? 'success' : 'secondary'}>
                        {isConfigured ? 'Ready' : 'Needs setup'}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{def.description}</p>
                  </div>
                </div>

                <div className="mb-3 text-xs text-muted-foreground">
                  <strong>Fields:</strong> {def.fields.map(f => f.label).join(', ') || 'None'}
                </div>

                {skillConfigs.length > 0 && (
                  <div className="mb-3 space-y-1">
                    {skillConfigs.map(sc => (
                      <div key={sc.id} className="flex items-center justify-between rounded-md bg-muted px-3 py-1.5 text-sm">
                        <span>{sc.name}</span>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={e => { e.stopPropagation(); editConfig(sc); }}>
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={e => { e.stopPropagation(); deleteConfig(sc.id); }}>
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {def.requiresConfig && (
                  <Button variant="outline" size="sm" className="w-full" onClick={() => openConfigForm(def.type)}>
                    <Plus className="h-4 w-4" />
                    {skillConfigs.length > 0 ? 'Add another config' : 'Configure'}
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={showConfigForm} onOpenChange={setShowConfigForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Configure {selectedDef?.name || configSkillType}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Configuration name</Label>
              <Input value={configName} onChange={e => setConfigName(e.target.value)} placeholder="e.g. Ops Webhook" />
            </div>

            {selectedDef?.configSchema.map(field => (
              <div key={field.key} className="space-y-2">
                <Label>{field.label} {field.required && '*'}</Label>
                <Input
                  type={field.type === 'password' ? 'password' : field.type === 'url' ? 'url' : 'text'}
                  placeholder={field.placeholder}
                  value={configValues[field.key] || ''}
                  onChange={e => setConfigValues({ ...configValues, [field.key]: e.target.value })}
                />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfigForm(false)}>Cancel</Button>
            <Button variant="gradient" onClick={saveConfig} disabled={saving}>
              {saving ? 'Saving...' : 'Save configuration'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
