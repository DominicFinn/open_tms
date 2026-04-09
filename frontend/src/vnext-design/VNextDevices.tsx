import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { API_URL } from '../api';

interface Device {
  id: string;
  externalId: string;
  displayId: string;
  name: string;
  provider: string;
  model: string;
  firmware: string;
  status: string;
  batteryLevel: number | null;
  lastSeenAt: string | null;
  lastLat: number | null;
  lastLng: number | null;
  assignments: Array<{
    shipmentId: string | null;
    shipment?: { reference: string };
    orderId: string | null;
    order?: { orderNumber: string };
  }>;
  _count: { sensorReadings: number; deviceEvents: number };
}

function relativeTime(dateStr: string | null): string {
  if (!dateStr) return '—';
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  if (diffMs < 0) return 'just now';
  const mins = Math.floor(diffMs / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(dateStr).toLocaleDateString();
}

function batteryIcon(level: number | null): string {
  if (level == null) return 'battery_unknown';
  if (level > 50) return 'battery_full';
  if (level >= 20) return 'battery_3_bar';
  return 'battery_1_bar';
}

function batteryColor(level: number | null): string {
  if (level == null) return 'var(--on-surface-variant)';
  if (level > 50) return 'var(--success)';
  if (level >= 20) return 'var(--warning)';
  return 'var(--error)';
}

function assignedLabel(device: Device): string {
  const active = device.assignments?.[0];
  if (!active) return 'Unassigned';
  if (active.shipment?.reference) return active.shipment.reference;
  if (active.order?.orderNumber) return active.order.orderNumber;
  return 'Assigned';
}

export default function VNextDevices() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const res = await fetch(`${API_URL}/api/v1/devices`);
        if (!res.ok) throw new Error(`Failed to load devices (${res.status})`);
        const json = await res.json();
        if (!cancelled) {
          setDevices(json.data || []);
          setError('');
        }
      } catch (err: any) {
        if (!cancelled) setError(err.message || 'Failed to load devices');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const filtered = devices.filter(d => {
    if (statusFilter !== 'all' && d.status !== statusFilter) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      d.name.toLowerCase().includes(q) ||
      d.displayId.toLowerCase().includes(q) ||
      d.model.toLowerCase().includes(q) ||
      d.provider.toLowerCase().includes(q)
    );
  });

  const totalCount = devices.length;
  const activeCount = devices.filter(d => d.status === 'active').length;
  const alertCount = devices.filter(d => d.batteryLevel != null && d.batteryLevel < 20).length;
  const assignedCount = devices.filter(d => d.assignments && d.assignments.length > 0).length;

  if (loading) {
    return (
      <div className="vn-empty">
        <span className="material-icons" style={{ animation: 'spin 1s linear infinite' }}>refresh</span>
        <h3>Loading...</h3>
      </div>
    );
  }

  if (error) {
    return (
      <div className="vn-alert vn-alert-error">
        <span className="material-icons">error</span>
        <div className="vn-alert-content">{error}</div>
      </div>
    );
  }

  return (
    <>
      <div className="vn-page-header">
        <div>
          <h1>Devices</h1>
          <p>{totalCount} devices registered</p>
        </div>
        <div className="vn-page-actions">
          <button className="vn-btn vn-btn-primary">
            <span className="material-icons">add</span>
            Register Device
          </button>
        </div>
      </div>

      {/* Stats Row */}
      <div className="vn-stats-row" style={{ marginBottom: 24 }}>
        <div className="vn-stat-card">
          <div className="vn-stat-icon" style={{ background: 'var(--primary-container)', color: 'var(--primary)' }}>
            <span className="material-icons">sensors</span>
          </div>
          <div className="vn-stat-content">
            <span className="vn-stat-value">{totalCount}</span>
            <span className="vn-stat-label">Total Devices</span>
          </div>
        </div>
        <div className="vn-stat-card">
          <div className="vn-stat-icon" style={{ background: 'var(--success-container, rgba(0,200,83,0.1))', color: 'var(--success)' }}>
            <span className="material-icons">check_circle</span>
          </div>
          <div className="vn-stat-content">
            <span className="vn-stat-value">{activeCount}</span>
            <span className="vn-stat-label">Active</span>
          </div>
        </div>
        <div className="vn-stat-card">
          <div className="vn-stat-icon" style={{ background: 'var(--error-container, rgba(255,0,0,0.1))', color: 'var(--error)' }}>
            <span className="material-icons">warning</span>
          </div>
          <div className="vn-stat-content">
            <span className="vn-stat-value">{alertCount}</span>
            <span className="vn-stat-label">Alerts</span>
          </div>
        </div>
        <div className="vn-stat-card">
          <div className="vn-stat-icon" style={{ background: 'var(--info-container, rgba(0,150,255,0.1))', color: 'var(--info, var(--primary))' }}>
            <span className="material-icons">link</span>
          </div>
          <div className="vn-stat-content">
            <span className="vn-stat-value">{assignedCount}</span>
            <span className="vn-stat-label">Assigned</span>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="vn-filter-bar" style={{ marginBottom: 16 }}>
        <div className="vn-search">
          <span className="material-icons">search</span>
          <input
            type="text"
            placeholder="Search devices..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select
          className="vn-select"
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
        >
          <option value="all">All Statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="retired">Retired</option>
        </select>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="vn-empty">
          <span className="material-icons">sensors</span>
          <h3>No devices found</h3>
          <p>Register a device to get started with IoT tracking.</p>
        </div>
      ) : (
        <div className="vn-card">
          <div className="vn-card-body vn-card-flush">
            <div className="vn-table-wrap">
              <table className="vn-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Model</th>
                    <th>Status</th>
                    <th>Battery</th>
                    <th>Last Seen</th>
                    <th>Assigned To</th>
                    <th>Readings</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(device => {
                    const statusChip =
                      device.status === 'active' ? 'success' :
                      device.status === 'inactive' ? 'warning' : 'secondary';
                    return (
                      <tr key={device.id}>
                        <td>
                          <div>
                            <div style={{ fontWeight: 600, color: 'var(--on-surface)' }}>{device.name}</div>
                            <div style={{ fontSize: 12, color: 'var(--on-surface-variant)' }}>{device.displayId}</div>
                          </div>
                        </td>
                        <td>{device.model}</td>
                        <td>
                          <span className={`vn-chip vn-chip-${statusChip}`}>{device.status}</span>
                        </td>
                        <td>
                          {device.batteryLevel != null ? (
                            <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: batteryColor(device.batteryLevel) }}>
                              <span className="material-icons" style={{ fontSize: 18 }}>{batteryIcon(device.batteryLevel)}</span>
                              {device.batteryLevel}%
                            </span>
                          ) : (
                            <span style={{ color: 'var(--on-surface-variant)' }}>—</span>
                          )}
                        </td>
                        <td style={{ fontSize: 13, color: 'var(--on-surface-variant)' }}>
                          {relativeTime(device.lastSeenAt)}
                        </td>
                        <td style={{ fontSize: 13 }}>
                          {assignedLabel(device)}
                        </td>
                        <td style={{ fontSize: 13 }}>
                          {device._count?.sensorReadings ?? 0}
                        </td>
                        <td>
                          <Link to={`/devices/${device.id}`} className="vn-btn-icon" title="View device">
                            <span className="material-icons" style={{ fontSize: 18 }}>visibility</span>
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
