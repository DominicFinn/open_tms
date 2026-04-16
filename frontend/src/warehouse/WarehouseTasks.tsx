import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_URL } from '../api';

type TaskType = 'pick' | 'putaway';

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
  const [tab, setTab] = useState<'all' | 'pick' | 'putaway'>('all');

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

    Promise.all([pickP, putawayP])
      .then(([picks, putaways]) => setTasks([...picks, ...putaways]))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [locationId]);

  const filtered = tab === 'all' ? tasks : tasks.filter(t => t.type === tab);

  return (
    <div>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        {(['all', 'pick', 'putaway'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{
              flex: 1, padding: '10px', borderRadius: '8px', border: 'none',
              background: tab === t ? '#3b82f6' : '#1e293b', color: 'white',
              fontWeight: tab === t ? 600 : 400, fontSize: '14px', cursor: 'pointer',
            }}>
            {t === 'all' ? 'All Tasks' : t === 'pick' ? 'Picking' : 'Putaway'}
            {tab !== t && <span style={{ marginLeft: '4px', opacity: 0.6 }}>({tasks.filter(x => t === 'all' || x.type === t).length})</span>}
          </button>
        ))}
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
