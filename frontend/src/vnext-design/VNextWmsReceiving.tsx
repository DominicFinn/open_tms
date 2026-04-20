import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_URL } from '../api';

/* ── Types ────────────────────────────────────────────────── */

interface ReceivingTask {
  id: string;
  status: string;
  receivingType: string;
  crossDock: boolean;
  shipmentRef: string | null;
  dockDoor: string | null;
  assignedTo: string | null;
  lineCount: number;
  receivedLines: number;
  createdAt: string;
}

/* ── Helpers ──────────────────────────────────────────────── */

function statusChip(status: string): string {
  switch (status) {
    case 'pending': return 'vn-chip-secondary';
    case 'in_progress': return 'vn-chip-info';
    case 'inspection': return 'vn-chip-warning';
    case 'completed': return 'vn-chip-success';
    case 'cancelled': return 'vn-chip-error';
    default: return 'vn-chip-secondary';
  }
}

function formatStatus(s: string): string {
  return s.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

/* ── Component ────────────────────────────────────────────── */

export default function VNextWmsReceiving() {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<ReceivingTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');

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
    const url = statusFilter
      ? `${API_URL}/api/v1/receiving/tasks?locationId=${selectedLocation}&status=${statusFilter}`
      : `${API_URL}/api/v1/receiving/tasks?locationId=${selectedLocation}`;
    fetch(url)
      .then(r => r.json())
      .then(res => setTasks((res.data || []).map((t: any) => ({
        ...t,
        shipmentRef: t.inboundShipmentId || null,
        dockDoor: t.dockBinId ? t.dockBinId.slice(0, 8) : null,
        assignedTo: t.assignedToUserId || null,
      }))))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [selectedLocation, statusFilter]);

  const filtered = tasks; // Filtering done server-side

  return (
    <div>
      <div className="vn-page-header">
        <div>
          <h1>Receiving</h1>
          <p className="vn-page-subtitle">Inbound goods receiving and inspection</p>
        </div>
        <button className="vn-btn vn-btn-primary" onClick={() => navigate('/wms/receiving/create')}>
          <span className="material-icons" style={{ fontSize: '18px', marginRight: '0.5rem' }}>add</span>
          New Receiving Task
        </button>
      </div>

      {/* Filters */}
      <div className="vn-filters" style={{ marginBottom: '1rem' }}>
        <select
          className="vn-filter-select"
          value={selectedLocation}
          onChange={e => setSelectedLocation(e.target.value)}
        >
          {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
        <select
          className="vn-filter-select"
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
        >
          <option value="">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="in_progress">In Progress</option>
          <option value="inspection">Inspection</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {loading ? (
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          <div className="vn-loading-spinner" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="vn-card" style={{ textAlign: 'center', padding: '3rem' }}>
          <span className="material-icons" style={{ fontSize: '48px', color: 'var(--text-secondary)', marginBottom: '1rem', display: 'block' }}>move_to_inbox</span>
          <h3>No receiving tasks</h3>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>
            Receiving tasks are created when inbound shipments arrive, or manually for blind receiving.
          </p>
          <button className="vn-btn vn-btn-primary" onClick={() => navigate('/wms/receiving/create')}>
            Create Receiving Task
          </button>
        </div>
      ) : (
        <div className="vn-table-wrap">
          <table className="vn-table">
            <thead>
              <tr>
                <th>Task</th>
                <th>Type</th>
                <th>Shipment</th>
                <th>Dock</th>
                <th>Progress</th>
                <th>Assigned To</th>
                <th>Status</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(task => (
                <tr key={task.id} onClick={() => navigate(`/wms/receiving/${task.id}`)} style={{ cursor: 'pointer' }}>
                  <td><span className="vn-table-id">{task.id.slice(0, 8)}</span></td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                      <span className="vn-chip vn-chip-secondary">{task.receivingType === 'asn' ? 'ASN' : 'Blind'}</span>
                      {task.crossDock && <span className="vn-chip vn-chip-warning">Cross-Dock</span>}
                    </div>
                  </td>
                  <td>{task.shipmentRef || '--'}</td>
                  <td>{task.dockDoor || '--'}</td>
                  <td>{task.receivedLines}/{task.lineCount} lines</td>
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
