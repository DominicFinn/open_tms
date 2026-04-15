import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_URL } from '../api';

/* ── Types ────────────────────────────────────────────────── */

interface PutawayTask {
  id: string;
  status: string;
  putawayType: string;
  trackableUnitIdentifier: string;
  sourceBinLabel: string | null;
  targetBinLabel: string;
  assignedTo: string | null;
  createdAt: string;
}

/* ── Helpers ──────────────────────────────────────────────── */

function statusChip(status: string): string {
  switch (status) {
    case 'pending': return 'vn-chip-secondary';
    case 'assigned': return 'vn-chip-info';
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

export default function VNextWmsPutaway() {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<PutawayTask[]>([]);
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
          <h1>Putaway</h1>
          <p className="vn-page-subtitle">Directed putaway tasks for received goods</p>
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
        </select>
      </div>

      {loading ? (
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          <div className="vn-loading-spinner" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="vn-card" style={{ textAlign: 'center', padding: '3rem' }}>
          <span className="material-icons" style={{ fontSize: '48px', color: 'var(--text-secondary)', marginBottom: '1rem', display: 'block' }}>system_update_alt</span>
          <h3>No putaway tasks</h3>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>
            Putaway tasks are auto-generated when receiving is completed. Configure putaway rules to direct stock to the right zones.
          </p>
        </div>
      ) : (
        <div className="vn-table-wrap">
          <table className="vn-table">
            <thead>
              <tr>
                <th>Task</th>
                <th>Type</th>
                <th>Unit</th>
                <th>From</th>
                <th>To</th>
                <th>Assigned To</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(task => (
                <tr key={task.id} style={{ cursor: 'pointer' }}>
                  <td><span className="vn-table-id">{task.id.slice(0, 8)}</span></td>
                  <td><span className="vn-chip vn-chip-secondary">{formatStatus(task.putawayType)}</span></td>
                  <td><strong>{task.trackableUnitIdentifier}</strong></td>
                  <td>{task.sourceBinLabel || 'Dock'}</td>
                  <td>{task.targetBinLabel}</td>
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
