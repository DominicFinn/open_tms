import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_URL } from '../api';

type TaskType = 'pick' | 'putaway' | 'receive' | 'pack' | 'return-receive' | 'return-inspect';

interface TaskItem {
  id: string;
  type: TaskType;
  status: string;
  summary: string;
  detail: string;
  priority: number;
}

function statusColor(s: string): string {
  switch (s) { case 'pending': return '#94a3b8'; case 'assigned': return '#3b82f6'; case 'in_progress': return '#f59e0b'; case 'completed': return '#10b981'; default: return '#94a3b8'; }
}

export default function WarehouseTasks() {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'all' | 'pick' | 'putaway' | 'receive' | 'pack' | 'returns'>('all');

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

  return (
    <div>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        {(['all', 'receive', 'putaway', 'pick', 'pack', 'returns'] as const).map(t => {
          const countFor = (k: typeof t) =>
            k === 'all' ? tasks.length
              : k === 'returns' ? tasks.filter(x => x.type === 'return-receive' || x.type === 'return-inspect').length
              : tasks.filter(x => x.type === k).length;
          const labels: Record<typeof t, string> = {
            all: 'All', receive: 'Receive', putaway: 'Putaway', pick: 'Pick', pack: 'Pack', returns: 'Returns',
          };
          return (
            <button key={t} onClick={() => setTab(t)}
              style={{
                flex: 1, padding: '10px', borderRadius: '8px', border: 'none',
                background: tab === t ? '#3b82f6' : '#1e293b', color: 'white',
                fontWeight: tab === t ? 600 : 400, fontSize: '13px', cursor: 'pointer',
              }}>
              {labels[t]}
              {tab !== t && <span style={{ marginLeft: '4px', opacity: 0.6 }}>({countFor(t)})</span>}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>Loading tasks...</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <span className="material-icons" style={{ fontSize: '48px', color: '#475569', display: 'block', marginBottom: '8px' }}>check_circle</span>
          <div style={{ color: '#94a3b8' }}>No active tasks</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {filtered.map(task => (
            <button key={task.id} onClick={() => navigate(`/warehouse/tasks/${task.type}/${task.id}`)}
              style={{
                display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px',
                background: '#1e293b', borderRadius: '12px', border: '1px solid #334155',
                textAlign: 'left', cursor: 'pointer', color: 'white', width: '100%',
              }}>
              <div style={{
                width: '10px', height: '10px', borderRadius: '50%',
                background: statusColor(task.status), flexShrink: 0,
              }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '2px' }}>{task.summary}</div>
                <div style={{ fontSize: '12px', color: '#94a3b8' }}>{task.detail}</div>
              </div>
              <span className="material-icons" style={{ color: '#475569', fontSize: '20px' }}>chevron_right</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
