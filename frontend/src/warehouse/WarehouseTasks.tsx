import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Loader2,
  Package,
  PackageCheck,
  PackageOpen,
  PackagePlus,
  RotateCcw,
  ScanLine,
  type LucideIcon,
} from 'lucide-react';

import { API_URL } from '../api';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';

type TaskType = 'pick' | 'putaway' | 'receive' | 'pack' | 'return-receive' | 'return-inspect';

interface TaskItem {
  id: string;
  type: TaskType;
  status: string;
  summary: string;
  detail: string;
  priority: number;
}

const TASK_ICONS: Record<TaskType, LucideIcon> = {
  pick: ScanLine,
  putaway: PackagePlus,
  receive: PackageOpen,
  pack: Package,
  'return-receive': RotateCcw,
  'return-inspect': PackageCheck,
};

function statusVariant(s: string): 'muted' | 'info' | 'warning' | 'success' {
  switch (s) {
    case 'pending': return 'muted';
    case 'assigned': return 'info';
    case 'in_progress': return 'warning';
    case 'completed': return 'success';
    default: return 'muted';
  }
}

const TABS = [
  { value: 'all', label: 'All' },
  { value: 'receive', label: 'Receive' },
  { value: 'putaway', label: 'Putaway' },
  { value: 'pick', label: 'Pick' },
  { value: 'pack', label: 'Pack' },
  { value: 'returns', label: 'Returns' },
] as const;

type Tab = (typeof TABS)[number]['value'];

export default function WarehouseTasks() {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('all');

  const locationId = (() => {
    try { return JSON.parse(localStorage.getItem('warehouse_location') || '{}').id; } catch { return null; }
  })();

  useEffect(() => {
    if (!locationId) { setLoading(false); return; }
    setLoading(true);

    const pickP = fetch(`${API_URL}/api/v1/pick-tasks?locationId=${locationId}`)
      .then(r => r.json())
      .then(res => (res.data || [])
        .filter((t: any) => t.status !== 'completed' && t.status !== 'cancelled' && t.status !== 'short_pick')
        .map((t: any) => ({
          id: t.id, type: 'pick' as TaskType, status: t.status,
          summary: `Pick: ${t.totalLines} lines${t.wave?.waveNumber ? ` (${t.wave.waveNumber})` : ''}`,
          detail: t.pickType === 'zone' ? `Zone pick - ${t.completedLines}/${t.totalLines} done` : `${t.pickType} - ${t.completedLines}/${t.totalLines} done`,
          priority: t.pickType === 'zone' ? (t.zoneSequence ?? 0) : 0,
        })));

    const putawayP = fetch(`${API_URL}/api/v1/putaway/tasks?locationId=${locationId}`)
      .then(r => r.json())
      .then(res => (res.data || [])
        .filter((t: any) => t.status !== 'completed' && t.status !== 'cancelled')
        .map((t: any) => ({
          id: t.id, type: 'putaway' as TaskType, status: t.status,
          summary: `Putaway: ${t.trackableUnit?.identifier ?? 'Unit'}`,
          detail: `${t.sourceBin?.label ?? 'Dock'} -> ${t.targetBin?.label ?? '?'}`,
          priority: 0,
        })));

    const receiveP = fetch(`${API_URL}/api/v1/receiving/tasks?locationId=${locationId}`)
      .then(r => r.json())
      .then(res => (res.data || [])
        .filter((t: any) => t.status !== 'completed' && t.status !== 'cancelled')
        .map((t: any) => {
          const total = t.lines?.length ?? 0;
          const done = t.lines?.filter((l: any) => l.receivedQuantity >= l.expectedQuantity).length ?? 0;
          return {
            id: t.id, type: 'receive' as TaskType, status: t.status,
            summary: `Receive: ${t.receivingType === 'blind' ? 'blind' : t.id.slice(0, 8)}${t.crossDock ? ' - cross-dock' : ''}`,
            detail: `${done}/${total} line${total === 1 ? '' : 's'} received at ${t.dockBin?.label ?? 'dock'}`,
            priority: t.crossDock ? 0 : 1,
          };
        }))
      .catch(() => [] as TaskItem[]);

    const packP = fetch(`${API_URL}/api/v1/pack-tasks?locationId=${locationId}`)
      .then(r => r.json())
      .then(res => (res.data || [])
        .filter((t: any) => t.status !== 'completed' && t.status !== 'cancelled')
        .map((t: any) => ({
          id: t.id, type: 'pack' as TaskType, status: t.status,
          summary: `Pack: ${t.id.slice(0, 8)}`,
          detail: `${t.packedLines ?? 0}/${t.lineCount ?? 0} lines packed`,
          priority: 0,
        })))
      .catch(() => [] as TaskItem[]);

    const returnsP = fetch(`${API_URL}/api/v1/warehouse/rmas?stage=any`)
      .then(r => r.json())
      .then(res => {
        const rmas = res.data || [];
        const items: TaskItem[] = [];
        for (const r of rmas) {
          if (r.linesToReceive > 0) {
            items.push({
              id: r.id, type: 'return-receive', status: r.status,
              summary: `Receive return: ${r.rmaNumber}`,
              detail: `${r.linesToReceive} line${r.linesToReceive === 1 ? '' : 's'} to receive`,
              priority: 0,
            });
          }
          if (r.linesToInspect > 0) {
            items.push({
              id: r.id, type: 'return-inspect', status: r.status,
              summary: `Inspect return: ${r.rmaNumber}`,
              detail: `${r.linesToInspect} line${r.linesToInspect === 1 ? '' : 's'} to inspect`,
              priority: 1,
            });
          }
        }
        return items;
      })
      .catch(() => [] as TaskItem[]);

    Promise.all([pickP, putawayP, receiveP, packP, returnsP])
      .then(([picks, putaways, receives, packs, returns]) =>
        setTasks([...picks, ...putaways, ...receives, ...packs, ...returns]))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [locationId]);

  const filtered = tab === 'all'
    ? tasks
    : tab === 'returns'
      ? tasks.filter(t => t.type === 'return-receive' || t.type === 'return-inspect')
      : tasks.filter(t => t.type === tab);

  const countFor = (k: Tab) =>
    k === 'all' ? tasks.length
      : k === 'returns' ? tasks.filter(x => x.type === 'return-receive' || x.type === 'return-inspect').length
      : tasks.filter(x => x.type === k).length;

  return (
    <div className="mx-auto max-w-2xl space-y-4 px-1 py-2 pb-24">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Tasks</h1>
        <p className="text-sm text-muted-foreground">Active warehouse work assigned to you</p>
      </div>

      {/* Tab pills - scrollable on small screens */}
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {TABS.map(t => {
          const isActive = tab === t.value;
          const count = countFor(t.value);
          return (
            <button
              key={t.value}
              type="button"
              onClick={() => setTab(t.value)}
              className={
                isActive
                  ? 'inline-flex h-11 shrink-0 items-center gap-2 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground'
                  : 'inline-flex h-11 shrink-0 items-center gap-2 rounded-full border border-border bg-card px-4 text-sm font-medium text-foreground hover:bg-muted/40 active:bg-muted/60'
              }
            >
              <span>{t.label}</span>
              <span className={isActive ? 'text-primary-foreground/80' : 'text-muted-foreground'}>
                ({count})
              </span>
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <Card className="flex flex-col items-center gap-2 py-12 text-center">
          <CheckCircle2 className="h-12 w-12 text-success" />
          <p className="text-base font-semibold">No active tasks</p>
          <p className="px-6 text-sm text-muted-foreground">You're all caught up.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map(task => {
            const Icon = TASK_ICONS[task.type] || ClipboardList;
            return (
              <Card
                key={`${task.type}-${task.id}`}
                onClick={() => navigate(`/warehouse/tasks/${task.type}/${task.id}`)}
                className="cursor-pointer transition-colors active:bg-muted/50"
              >
                <div className="flex items-center gap-4 p-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="h-6 w-6" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-base font-semibold">{task.summary}</div>
                    <div className="truncate text-sm text-muted-foreground">{task.detail}</div>
                  </div>
                  <Badge variant={statusVariant(task.status)} className="px-3 py-1 text-sm capitalize">
                    {task.status.replace(/_/g, ' ')}
                  </Badge>
                  <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
