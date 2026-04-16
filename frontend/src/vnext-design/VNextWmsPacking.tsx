import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_URL } from '../api';

/* ── Types ────────────────────────────────────────────────── */

interface PackTask {
  id: string;
  status: string;
  orderRef: string;
  packStation: string | null;
  assignedTo: string | null;
  lineCount: number;
  packedLines: number;
  createdAt: string;
}

/* ── Helpers ──────────────────────────────────────────────── */

function statusChip(status: string): string {
  switch (status) {
    case 'pending': return 'vn-chip-secondary';
    case 'in_progress': return 'vn-chip-warning';
    case 'completed': return 'vn-chip-success';
    case 'cancelled': return 'vn-chip-error';
    default: return 'vn-chip-secondary';
  }
}

function formatStatus(s: string): string {
  return s.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

/* ── Component ────────────────────────────────────────────── */

export default function VNextWmsPacking() {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<PackTask[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedLocation, setSelectedLocation] = useState('');
  const [locations, setLocations] = useState<Array<{ id: string; name: string }>>([]);

  useEffect(() => {
    fetch(`${API_URL}/api/v1/locations`)
      .then(r => r.json())
      .then(res => {
        const locs = (res.data || []).filter(
          (l: any) => !l.locationType || ['warehouse', 'distribution_centre', 'cross_dock'].includes(l.locationType)
        );
        setLocations(locs);
        if (locs.length > 0) setSelectedLocation(locs[0].id);
        else setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedLocation) return;
    setLoading(true);
    fetch(`${API_URL}/api/v1/pack-tasks?locationId=${selectedLocation}`)
      .then(r => r.json())
      .then(res => setTasks((res.data || []).map((t: any) => ({
        ...t,
        orderRef: t.orderId?.slice(0, 8) ?? '',
        assignedTo: t.assignedToUserId ?? null,
      }))))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [selectedLocation]);

  return (
    <div>
      <div className="vn-page-header">
        <div>
          <h1>Packing</h1>
          <p className="vn-page-subtitle">Pack station tasks for order verification and cartonization</p>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          <div className="vn-loading-spinner" />
        </div>
      ) : tasks.length === 0 ? (
        <div className="vn-card" style={{ textAlign: 'center', padding: '3rem' }}>
          <span className="material-icons" style={{ fontSize: '48px', color: 'var(--text-secondary)', marginBottom: '1rem', display: 'block' }}>package_2</span>
          <h3>No pack tasks</h3>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>
            Pack tasks are created when pick tasks are completed. Items arrive at the pack station for verification, cartonization, and label generation.
          </p>
        </div>
      ) : (
        <div className="vn-table-wrap">
          <table className="vn-table">
            <thead>
              <tr>
                <th>Task</th>
                <th>Order</th>
                <th>Pack Station</th>
                <th>Progress</th>
                <th>Assigned To</th>
                <th>Status</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map(task => (
                <tr key={task.id} onClick={() => navigate(`/wms/packing/${task.id}`)} style={{ cursor: 'pointer' }}>
                  <td><span className="vn-table-id">{task.id.slice(0, 8)}</span></td>
                  <td><strong>{task.orderRef}</strong></td>
                  <td>{task.packStation || 'Unassigned'}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <div style={{ flex: 1, height: '6px', background: 'var(--border)', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{ width: `${task.lineCount > 0 ? (task.packedLines / task.lineCount) * 100 : 0}%`, height: '100%', background: 'var(--color-success)', borderRadius: '3px' }} />
                      </div>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{task.packedLines}/{task.lineCount}</span>
                    </div>
                  </td>
                  <td>{task.assignedTo || 'Unassigned'}</td>
                  <td><span className={`vn-chip ${statusChip(task.status)}`}>{formatStatus(task.status)}</span></td>
                  <td>{new Date(task.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
