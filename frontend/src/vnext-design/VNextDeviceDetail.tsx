import React, { useEffect, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { API_URL } from '../api';
import { getDeviceImageUrl } from './deviceImages';

interface SensorReading {
  id: string;
  temperature: number | null;
  humidity: number | null;
  batteryLevel: number | null;
  light: number | null;
  impact: number | null;
  lat: number | null;
  lng: number | null;
  isAlert: boolean;
  recordedAt: string;
}

interface DeviceEvent {
  id: string;
  eventType: string;
  category: string;
  message: string | null;
  zoneName: string | null;
  startTime: string;
}

interface Assignment {
  id: string;
  shipmentId: string | null;
  shipment?: { reference: string };
  orderId: string | null;
  order?: { orderNumber: string };
  active: boolean;
  assignedAt: string;
  unassignedAt: string | null;
}

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
  assignments: Assignment[];
  sensorReadings: SensorReading[];
  deviceEvents: DeviceEvent[];
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

function TempChart({ readings }: { readings: SensorReading[] }) {
  const temps = readings.filter(r => r.temperature != null);
  if (temps.length < 2) {
    return (
      <div className="vn-empty">
        <span className="material-icons">thermostat</span>
        <h3>Not enough data</h3>
      </div>
    );
  }

  const w = 600, h = 200, pad = 40;
  const minT = Math.min(...temps.map(r => r.temperature!));
  const maxT = Math.max(...temps.map(r => r.temperature!));
  const range = maxT - minT || 1;

  const points = temps.map((r, i) => ({
    x: pad + (i / (temps.length - 1)) * (w - pad * 2),
    y: pad + (1 - (r.temperature! - minT) / range) * (h - pad * 2),
    alert: r.isAlert,
  }));

  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');

  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: 'auto' }}>
      <text x={pad} y={pad - 10} fill="var(--on-surface-variant)" fontSize="11">{maxT.toFixed(1)}°</text>
      <text x={pad} y={h - pad + 16} fill="var(--on-surface-variant)" fontSize="11">{minT.toFixed(1)}°</text>
      <line x1={pad} y1={pad} x2={pad} y2={h - pad} stroke="var(--outline-variant)" strokeWidth="1" />
      <line x1={pad} y1={h - pad} x2={w - pad} y2={h - pad} stroke="var(--outline-variant)" strokeWidth="1" />
      <path d={line} fill="none" stroke="var(--primary)" strokeWidth="2" />
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={p.alert ? 5 : 3}
          fill={p.alert ? 'var(--error)' : 'var(--primary)'} />
      ))}
    </svg>
  );
}

function categoryChipColor(category: string): string {
  switch (category) {
    case 'alert': return 'error';
    case 'geofence': return 'warning';
    case 'status': return 'info';
    default: return 'secondary';
  }
}

export default function VNextDeviceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [device, setDevice] = useState<Device | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const res = await fetch(`${API_URL}/api/v1/devices/${id}`);
        if (!res.ok) throw new Error(`Failed to load device (${res.status})`);
        const json = await res.json();
        if (json.error) throw new Error(json.error);
        if (!cancelled) {
          setDevice(json.data);
          setError('');
        }
      } catch (err: any) {
        if (!cancelled) setError(err.message || 'Failed to load device');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

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

  if (!device) {
    return (
      <div className="vn-alert vn-alert-error">
        <span className="material-icons">error</span>
        <div className="vn-alert-content">Device not found</div>
      </div>
    );
  }

  const readings = device.sensorReadings || [];
  const events = device.deviceEvents || [];
  const assignments = device.assignments || [];
  const activeAssignment = assignments.find(a => a.active);
  const statusChip = device.status === 'active' ? 'success' : device.status === 'inactive' ? 'warning' : 'secondary';

  return (
    <>
      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <button className="vn-btn vn-btn-ghost vn-btn-sm" onClick={() => navigate('/devices')}>
          <span className="material-icons">arrow_back</span>
          Devices
        </button>
        <span style={{ color: 'var(--on-surface-variant)' }}>/</span>
        <span style={{ fontSize: 14, color: 'var(--on-surface)' }}>{device.name}</span>
      </div>

      {/* Page Header */}
      <div className="vn-page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          {(() => {
            const imgUrl = getDeviceImageUrl(device.model);
            return imgUrl ? (
              <img src={imgUrl} alt={device.model} style={{ width: 48, height: 48, objectFit: 'contain' }} />
            ) : (
              <span className="material-icons" style={{ fontSize: 44, color: 'var(--on-surface-variant)' }}>sensors</span>
            );
          })()}
          <div>
            <h1>{device.name}</h1>
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <span className={`vn-chip vn-chip-${statusChip}`}>{device.status}</span>
              <span className="vn-chip vn-chip-secondary">{device.model}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="vn-detail-grid">
        {/* Main Content */}
        <div className="vn-detail-main">
          {/* Sensor Readings Chart */}
          <div className="vn-card" style={{ marginBottom: 24 }}>
            <div className="vn-card-header">
              <h2>Sensor Readings</h2>
              <span style={{ fontSize: 13, color: 'var(--on-surface-variant)' }}>{readings.length} readings</span>
            </div>
            <div className="vn-card-body">
              <TempChart readings={readings} />
            </div>
            <div className="vn-card-body vn-card-flush">
              <div className="vn-table-wrap">
                <table className="vn-table">
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>Temp</th>
                      <th>Humidity</th>
                      <th>Battery</th>
                      <th>Light</th>
                      <th>Impact</th>
                      <th>Location</th>
                      <th>Alert</th>
                    </tr>
                  </thead>
                  <tbody>
                    {readings.slice(0, 20).map(r => (
                      <tr key={r.id}>
                        <td style={{ fontSize: 13 }}>{new Date(r.recordedAt).toLocaleString()}</td>
                        <td>{r.temperature != null ? `${r.temperature}°` : '—'}</td>
                        <td>{r.humidity != null ? `${r.humidity}%` : '—'}</td>
                        <td>{r.batteryLevel != null ? `${r.batteryLevel}%` : '—'}</td>
                        <td>{r.light != null ? r.light : '—'}</td>
                        <td>{r.impact != null ? r.impact : '—'}</td>
                        <td style={{ fontSize: 12 }}>
                          {r.lat != null && r.lng != null ? `${r.lat.toFixed(4)}, ${r.lng.toFixed(4)}` : '—'}
                        </td>
                        <td>
                          {r.isAlert ? (
                            <span className="vn-chip vn-chip-error" style={{ fontSize: 11 }}>Alert</span>
                          ) : (
                            <span style={{ color: 'var(--on-surface-variant)', fontSize: 12 }}>—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {readings.length === 0 && (
                      <tr>
                        <td colSpan={8} style={{ textAlign: 'center', color: 'var(--on-surface-variant)', padding: 24 }}>
                          No sensor readings yet
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Events Timeline */}
          <div className="vn-card">
            <div className="vn-card-header">
              <h2>Events</h2>
              <span style={{ fontSize: 13, color: 'var(--on-surface-variant)' }}>{events.length} events</span>
            </div>
            <div className="vn-card-body">
              {events.length === 0 ? (
                <p style={{ color: 'var(--on-surface-variant)', fontSize: 13 }}>No events recorded yet.</p>
              ) : (
                <div className="vn-timeline">
                  {events.map((ev, i) => (
                    <div className="vn-timeline-item" key={ev.id || i}>
                      <div className={`vn-timeline-dot ${categoryChipColor(ev.category)}`} />
                      <div className="vn-timeline-time">{new Date(ev.startTime).toLocaleString()}</div>
                      <div className="vn-timeline-title">
                        {ev.eventType}
                        <span className={`vn-chip vn-chip-${categoryChipColor(ev.category)}`} style={{ marginLeft: 8, fontSize: 11 }}>
                          {ev.category}
                        </span>
                      </div>
                      {ev.message && <div className="vn-timeline-desc">{ev.message}</div>}
                      {ev.zoneName && (
                        <div className="vn-timeline-location">
                          <span className="material-icons">place</span>
                          {ev.zoneName}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="vn-detail-sidebar">
          {/* Device Image */}
          {(() => {
            const imgUrl = getDeviceImageUrl(device.model);
            return (
              <div className="vn-card">
                <div className="vn-card-body" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 20px' }}>
                  {imgUrl ? (
                    <img src={imgUrl} alt={device.model} style={{ width: 80, height: 80, objectFit: 'contain' }} />
                  ) : (
                    <span className="material-icons" style={{ fontSize: 64, color: 'var(--on-surface-variant)', opacity: 0.5 }}>sensors</span>
                  )}
                </div>
              </div>
            );
          })()}

          {/* Device Info */}
          <div className="vn-card">
            <div className="vn-card-header"><h2>Device Info</h2></div>
            <div className="vn-card-body">
              <div className="vn-info-grid">
                <div className="vn-info-item"><label>Name</label><span>{device.name}</span></div>
                <div className="vn-info-item"><label>External ID</label><span>{device.externalId}</span></div>
                <div className="vn-info-item"><label>Display ID</label><span>{device.displayId}</span></div>
                <div className="vn-info-item"><label>Model</label><span>{device.model}</span></div>
                <div className="vn-info-item"><label>Firmware</label><span>{device.firmware || '—'}</span></div>
                <div className="vn-info-item"><label>Provider</label><span>{device.provider}</span></div>
                <div className="vn-info-item"><label>Status</label><span className={`vn-chip vn-chip-${statusChip}`}>{device.status}</span></div>
                <div className="vn-info-item">
                  <label>Battery Level</label>
                  <span style={{ color: device.batteryLevel != null ? (device.batteryLevel > 50 ? 'var(--success)' : device.batteryLevel >= 20 ? 'var(--warning)' : 'var(--error)') : 'var(--on-surface-variant)' }}>
                    {device.batteryLevel != null ? `${device.batteryLevel}%` : '—'}
                  </span>
                </div>
                <div className="vn-info-item"><label>Last Seen</label><span>{relativeTime(device.lastSeenAt)}</span></div>
                <div className="vn-info-item">
                  <label>Last Location</label>
                  <span style={{ fontSize: 12 }}>
                    {device.lastLat != null && device.lastLng != null
                      ? `${device.lastLat.toFixed(4)}, ${device.lastLng.toFixed(4)}`
                      : '—'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Assignment */}
          <div className="vn-card">
            <div className="vn-card-header"><h2>Assignment</h2></div>
            <div className="vn-card-body">
              {activeAssignment ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {activeAssignment.shipmentId && (
                    <div className="vn-info-item">
                      <label>Shipment</label>
                      <Link to={`/shipments/${activeAssignment.shipmentId}`} style={{ color: 'var(--primary)', textDecoration: 'none', fontWeight: 500 }}>
                        {activeAssignment.shipment?.reference || activeAssignment.shipmentId}
                      </Link>
                    </div>
                  )}
                  {activeAssignment.orderId && (
                    <div className="vn-info-item">
                      <label>Order</label>
                      <Link to={`/orders/${activeAssignment.orderId}`} style={{ color: 'var(--primary)', textDecoration: 'none', fontWeight: 500 }}>
                        {activeAssignment.order?.orderNumber || activeAssignment.orderId}
                      </Link>
                    </div>
                  )}
                  <div className="vn-info-item">
                    <label>Assigned</label>
                    <span style={{ fontSize: 13 }}>{new Date(activeAssignment.assignedAt).toLocaleDateString()}</span>
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '12px 0' }}>
                  <p style={{ color: 'var(--on-surface-variant)', fontSize: 13, marginBottom: 12 }}>Unassigned</p>
                  <button className="vn-btn vn-btn-outline vn-btn-sm">
                    <span className="material-icons">link</span>
                    Assign Device
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Assignment History */}
          <div className="vn-card">
            <div className="vn-card-header"><h2>Assignment History</h2></div>
            <div className="vn-card-body vn-card-flush">
              {assignments.length === 0 ? (
                <p style={{ color: 'var(--on-surface-variant)', fontSize: 13, padding: 16 }}>No assignment history.</p>
              ) : (
                <div className="vn-table-wrap">
                  <table className="vn-table">
                    <thead>
                      <tr>
                        <th>Ref</th>
                        <th>Status</th>
                        <th>Assigned</th>
                        <th>Removed</th>
                      </tr>
                    </thead>
                    <tbody>
                      {assignments.map(a => (
                        <tr key={a.id}>
                          <td style={{ fontSize: 13 }}>
                            {a.shipment?.reference || a.order?.orderNumber || '—'}
                          </td>
                          <td>
                            <span className={`vn-chip vn-chip-${a.active ? 'success' : 'secondary'}`} style={{ fontSize: 11 }}>
                              {a.active ? 'Active' : 'Ended'}
                            </span>
                          </td>
                          <td style={{ fontSize: 12 }}>{new Date(a.assignedAt).toLocaleDateString()}</td>
                          <td style={{ fontSize: 12 }}>{a.unassignedAt ? new Date(a.unassignedAt).toLocaleDateString() : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
