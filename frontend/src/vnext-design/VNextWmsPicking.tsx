import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_URL } from '../api';

/* ── Types ────────────────────────────────────────────────── */

interface PickTask {
  id: string;
  status: string;
  pickType: string;
  waveNumber: string | null;
  orderRef: string | null;
  zoneName: string | null;
  assignedTo: string | null;
  totalLines: number;
  completedLines: number;
  createdAt: string;
}

/* ── Helpers ──────────────────────────────────────────────── */

function statusChip(status: string): string {
  switch (status) {
    case 'pending': return 'vn-chip-secondary';
    case 'assigned': return 'vn-chip-info';
    case 'in_progress': return 'vn-chip-warning';
    case 'completed': return 'vn-chip-success';
    case 'short_pick': return 'vn-chip-error';
    case 'cancelled': return 'vn-chip-error';
    default: return 'vn-chip-secondary';
  }
}

function formatStatus(s: string): string {
  return s.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

/* ── Component ────────────────────────────────────────────── */

export default function VNextWmsPicking() {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<PickTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    // TODO: Fetch from API
    setLoading(false);
  }, []);

  const filtered = tasks.filter(t => !statusFilter || t.status === statusFilter);

  return (
    <div>
      <div className="vn-page-header">
        <div>
          <h1>Picking</h1>
          <p className="vn-page-subtitle">Pick tasks for fulfilling orders</p>
        </div>
      </div>

      {/* Filters */}
      <div className="vn-filters" style={{ marginBottom: '1rem' }}>
        <select
          className="vn-filter-select"
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
        >
          <option value="">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="assigned">Assigned</option>
          <option value="in_progress">In Progress</option>
          <option value="completed">Completed</option>
          <option value="short_pick">Short Pick</option>
        </select>
      </div>

      {loading ? (
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          <div className="vn-loading-spinner" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="vn-card" style={{ textAlign: 'center', padding: '3rem' }}>
          <span className="material-icons" style={{ fontSize: '48px', color: 'var(--text-secondary)', marginBottom: '1rem', display: 'block' }}>shopping_cart</span>
          <h3>No pick tasks</h3>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>
            Pick tasks are generated when waves are released. Create a wave and release it to generate pick lists.
          </p>
        </div>
      ) : (
        <div className="vn-table-wrap">
          <table className="vn-table">
            <thead>
              <tr>
                <th>Task</th>
                <th>Type</th>
                <th>Wave</th>
                <th>Order</th>
                <th>Zone</th>
                <th>Progress</th>
                <th>Assigned To</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(task => (
                <tr key={task.id} onClick={() => navigate(`/wms/picking/${task.id}`)} style={{ cursor: 'pointer' }}>
                  <td><span className="vn-table-id">{task.id.slice(0, 8)}</span></td>
                  <td><span className="vn-chip vn-chip-primary">{formatStatus(task.pickType)}</span></td>
                  <td>{task.waveNumber || '--'}</td>
                  <td>{task.orderRef || '--'}</td>
                  <td>{task.zoneName || 'All'}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <div style={{ flex: 1, height: '6px', background: 'var(--border)', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{ width: `${task.totalLines > 0 ? (task.completedLines / task.totalLines) * 100 : 0}%`, height: '100%', background: 'var(--color-success)', borderRadius: '3px' }} />
                      </div>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{task.completedLines}/{task.totalLines}</span>
                    </div>
                  </td>
                  <td>{task.assignedTo || 'Unassigned'}</td>
                  <td><span className={`vn-chip ${statusChip(task.status)}`}>{formatStatus(task.status)}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
