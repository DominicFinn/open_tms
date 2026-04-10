import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { API_URL } from '../api';
import { getDeviceImageUrl } from './deviceImages';

function ShipmentTempChart({ readings }: { readings: any[] }) {
  const temps = readings.filter(r => r.temperature != null);
  if (temps.length < 2) return <div className="vn-empty"><span className="material-icons">thermostat</span><h3>Not enough data</h3></div>;

  const w = 600, h = 200, pad = 40;
  const minT = Math.min(...temps.map(r => r.temperature));
  const maxT = Math.max(...temps.map(r => r.temperature));
  const range = maxT - minT || 1;

  const points = temps.map((r: any, i: number) => ({
    x: pad + (i / (temps.length - 1)) * (w - pad * 2),
    y: pad + (1 - (r.temperature - minT) / range) * (h - pad * 2),
    alert: r.isAlert,
  }));

  const line = points.map((p: any, i: number) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');

  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: 'auto' }}>
      <text x={pad} y={pad - 10} fill="var(--on-surface-variant)" fontSize="11">{maxT.toFixed(1)}°</text>
      <text x={pad} y={h - pad + 16} fill="var(--on-surface-variant)" fontSize="11">{minT.toFixed(1)}°</text>
      <line x1={pad} y1={pad} x2={pad} y2={h - pad} stroke="var(--outline-variant)" strokeWidth="1" />
      <line x1={pad} y1={h - pad} x2={w - pad} y2={h - pad} stroke="var(--outline-variant)" strokeWidth="1" />
      <path d={line} fill="none" stroke="var(--primary)" strokeWidth="2" />
      {points.map((p: any, i: number) => (
        <circle key={i} cx={p.x} cy={p.y} r={p.alert ? 5 : 3}
          fill={p.alert ? 'var(--error)' : 'var(--primary)'} />
      ))}
    </svg>
  );
}

function TelemetryTab({ shipmentId }: { shipmentId: string }) {
  const [telemetry, setTelemetry] = useState<any>(null);
  const [tLoading, setTLoading] = useState(true);
  const [tError, setTError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setTLoading(true);
        const res = await fetch(`${API_URL}/api/v1/shipments/${shipmentId}/telemetry`);
        if (!res.ok) throw new Error(`Failed to load telemetry (${res.status})`);
        const json = await res.json();
        if (json.error) throw new Error(json.error);
        if (!cancelled) {
          setTelemetry(json.data);
          setTError('');
        }
      } catch (err: any) {
        if (!cancelled) setTError(err.message || 'Failed to load telemetry');
      } finally {
        if (!cancelled) setTLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [shipmentId]);

  if (tLoading) {
    return <div className="vn-empty"><span className="material-icons" style={{ animation: 'spin 1s linear infinite' }}>refresh</span><h3>Loading telemetry...</h3></div>;
  }

  if (tError) {
    return <div className="vn-alert vn-alert-error"><span className="material-icons">error</span><div className="vn-alert-content">{tError}</div></div>;
  }

  if (!telemetry) {
    return <div className="vn-empty"><span className="material-icons">thermostat</span><h3>No telemetry data</h3></div>;
  }

  const readings: any[] = telemetry.readings || [];
  const alerts = readings.filter((r: any) => r.isAlert);
  const tempsWithValues = readings.filter((r: any) => r.temperature != null);
  const avgTemp = tempsWithValues.length > 0
    ? (tempsWithValues.reduce((sum: number, r: any) => sum + r.temperature, 0) / tempsWithValues.length).toFixed(1)
    : '—';
  const latestBattery = readings.length > 0 && readings[0].batteryLevel != null
    ? `${readings[0].batteryLevel}%`
    : '—';

  // Extract unique devices from readings
  const deviceMap = new Map<string, any>();
  readings.forEach((r: any) => {
    if (r.device && r.device.id && !deviceMap.has(r.device.id)) {
      deviceMap.set(r.device.id, r.device);
    }
  });
  const trackerDevices = Array.from(deviceMap.values());

  return (
    <>
      {/* Tracking Devices */}
      {trackerDevices.length > 0 && (
        <div className="vn-card" style={{ marginBottom: 24 }}>
          <div className="vn-card-header"><h2>Tracking Devices</h2></div>
          <div className="vn-card-body">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
              {trackerDevices.map((dev: any) => {
                const imgUrl = getDeviceImageUrl(dev.model);
                return (
                  <div key={dev.id} style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '12px 16px', borderRadius: 'var(--border-radius-sm)',
                    border: '1px solid var(--outline-variant)', background: 'var(--surface-container-lowest)',
                    minWidth: 220,
                  }}>
                    {imgUrl ? (
                      <img src={imgUrl} alt={dev.model} style={{ width: 40, height: 40, objectFit: 'contain', flexShrink: 0 }} />
                    ) : (
                      <span className="material-icons" style={{ fontSize: 36, color: 'var(--on-surface-variant)', flexShrink: 0 }}>sensors</span>
                    )}
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{dev.name || dev.displayId || 'Device'}</div>
                      <div style={{ fontSize: 12, color: 'var(--on-surface-variant)' }}>
                        {dev.model || 'Unknown model'}{dev.displayId ? ` · ${dev.displayId}` : ''}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="vn-stats-row" style={{ marginBottom: 24 }}>
        <div className="vn-stat-card">
          <div className="vn-stat-icon" style={{ background: 'var(--primary-container)', color: 'var(--primary)' }}>
            <span className="material-icons">sensors</span>
          </div>
          <div className="vn-stat-content">
            <span className="vn-stat-value">{readings.length}</span>
            <span className="vn-stat-label">Reading Count</span>
          </div>
        </div>
        <div className="vn-stat-card">
          <div className="vn-stat-icon" style={{ background: 'var(--error-container, rgba(255,0,0,0.1))', color: 'var(--error)' }}>
            <span className="material-icons">warning</span>
          </div>
          <div className="vn-stat-content">
            <span className="vn-stat-value">{alerts.length}</span>
            <span className="vn-stat-label">Alerts</span>
          </div>
        </div>
        <div className="vn-stat-card">
          <div className="vn-stat-icon" style={{ background: 'var(--primary-container)', color: 'var(--primary)' }}>
            <span className="material-icons">thermostat</span>
          </div>
          <div className="vn-stat-content">
            <span className="vn-stat-value">{avgTemp}{avgTemp !== '—' ? '°' : ''}</span>
            <span className="vn-stat-label">Avg Temp</span>
          </div>
        </div>
        <div className="vn-stat-card">
          <div className="vn-stat-icon" style={{ background: 'var(--success-container, rgba(0,200,83,0.1))', color: 'var(--success)' }}>
            <span className="material-icons">battery_full</span>
          </div>
          <div className="vn-stat-content">
            <span className="vn-stat-value">{latestBattery}</span>
            <span className="vn-stat-label">Latest Battery</span>
          </div>
        </div>
      </div>

      {/* Temperature Chart */}
      <div className="vn-card" style={{ marginBottom: 24 }}>
        <div className="vn-card-header"><h2>Temperature</h2></div>
        <div className="vn-card-body">
          <ShipmentTempChart readings={readings} />
        </div>
      </div>

      {/* Readings Table */}
      <div className="vn-card">
        <div className="vn-card-header"><h2>Recent Readings</h2></div>
        <div className="vn-card-body vn-card-flush">
          <div className="vn-table-wrap">
            <table className="vn-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Temp</th>
                  <th>Humidity</th>
                  <th>Battery</th>
                  <th>Location</th>
                  <th>Alert</th>
                </tr>
              </thead>
              <tbody>
                {readings.slice(0, 25).map((r: any, i: number) => (
                  <tr key={r.id || i}>
                    <td style={{ fontSize: 13 }}>{new Date(r.recordedAt).toLocaleString()}</td>
                    <td>{r.temperature != null ? `${r.temperature}°` : '—'}</td>
                    <td>{r.humidity != null ? `${r.humidity}%` : '—'}</td>
                    <td>{r.batteryLevel != null ? `${r.batteryLevel}%` : '—'}</td>
                    <td style={{ fontSize: 12 }}>{r.lat != null && r.lng != null ? `${r.lat.toFixed(4)}, ${r.lng.toFixed(4)}` : '—'}</td>
                    <td>
                      {r.isAlert
                        ? <span className="vn-chip vn-chip-error" style={{ fontSize: 11 }}>Alert</span>
                        : <span style={{ color: 'var(--on-surface-variant)', fontSize: 12 }}>—</span>
                      }
                    </td>
                  </tr>
                ))}
                {readings.length === 0 && (
                  <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--on-surface-variant)', padding: 24 }}>No readings available</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Cargo Tab ─────────────────────────────────────────────────────────────

interface CargoManifest {
  shipmentId: string;
  stops: Array<{
    stopId: string;
    sequenceNumber: number;
    locationName: string;
    stopType: string;
    status: string;
    expectedUnits: ManifestUnit[];
    scannedUnits: ManifestUnit[];
    discrepancies: CargoDiscrepancy[];
  }>;
  unassignedUnits: ManifestUnit[];
  totalExpected: number;
  totalScanned: number;
  totalDiscrepancies: number;
}

interface ManifestUnit {
  id: string;
  identifier: string;
  unitType: string;
  barcode: string | null;
  condition: string;
  currentStopId: string | null;
  orderId: string;
  orderNumber: string;
  lineItemCount: number;
  lastScannedAt: string | null;
}

interface CargoDiscrepancy {
  id: string;
  discrepancyType: string;
  severity: string;
  status: string;
  description: string;
  detectedAt: string;
  resolvedAt: string | null;
  resolution: string | null;
  trackableUnit: { identifier: string; unitType: string; order?: { orderNumber: string } };
  expectedStop?: { location: { name: string } };
  actualStop?: { location: { name: string } };
}

const discrepancyTypeLabels: Record<string, string> = {
  misdrop_early: 'Dropped Too Early',
  misdrop_late: 'Dropped Too Late',
  missing_at_stop: 'Missing at Stop',
  unexpected_at_stop: 'Unexpected at Stop',
  left_on_vehicle: 'Left on Vehicle',
  damaged: 'Damaged',
  wrong_destination: 'Wrong Destination',
};

const severityChip: Record<string, string> = {
  critical: 'vn-chip vn-chip-error',
  high: 'vn-chip vn-chip-error',
  medium: 'vn-chip vn-chip-warning',
  low: 'vn-chip vn-chip-info',
};

const conditionChip: Record<string, string> = {
  good: 'vn-chip vn-chip-success',
  damaged: 'vn-chip vn-chip-error',
  lost: 'vn-chip vn-chip-error',
  unknown: 'vn-chip vn-chip-warning',
};

const stopStatusIcon: Record<string, { icon: string; color: string }> = {
  pending: { icon: 'schedule', color: 'var(--on-surface-variant)' },
  arrived: { icon: 'location_on', color: 'var(--info)' },
  in_progress: { icon: 'local_shipping', color: 'var(--warning)' },
  completed: { icon: 'check_circle', color: 'var(--success)' },
  skipped: { icon: 'skip_next', color: 'var(--on-surface-variant)' },
};

function CargoTab({ shipmentId }: { shipmentId: string }) {
  const [manifest, setManifest] = useState<CargoManifest | null>(null);
  const [discrepancies, setDiscrepancies] = useState<CargoDiscrepancy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [resolving, setResolving] = useState<string | null>(null);

  const loadData = useCallback(() => {
    if (!shipmentId) return;
    setLoading(true);
    Promise.all([
      fetch(`${API_URL}/api/v1/shipments/${shipmentId}/cargo-manifest`).then(r => r.json()),
      fetch(`${API_URL}/api/v1/shipments/${shipmentId}/cargo-discrepancies`).then(r => r.json()),
    ])
      .then(([manifestRes, discRes]) => {
        if (manifestRes.error) throw new Error(manifestRes.error);
        setManifest(manifestRes.data);
        setDiscrepancies(discRes.data || []);
        setError('');
      })
      .catch(err => setError(err.message || 'Failed to load cargo data'))
      .finally(() => setLoading(false));
  }, [shipmentId]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleResolve = async (discId: string) => {
    const resolution = prompt('Resolution notes:');
    if (!resolution) return;
    setResolving(discId);
    try {
      const res = await fetch(`${API_URL}/api/v1/cargo-discrepancies/${discId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'resolved', resolution }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      loadData();
    } catch (err: any) {
      alert(`Failed to resolve: ${err.message}`);
    } finally {
      setResolving(null);
    }
  };

  const handleInvestigate = async (discId: string) => {
    try {
      await fetch(`${API_URL}/api/v1/cargo-discrepancies/${discId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'investigating' }),
      });
      loadData();
    } catch { /* ignore */ }
  };

  if (loading) {
    return <div className="vn-empty"><span className="material-icons" style={{ animation: 'spin 1s linear infinite' }}>refresh</span><h3>Loading cargo data...</h3></div>;
  }

  if (error) {
    return <div className="vn-alert vn-alert-error"><span className="material-icons">error</span><div className="vn-alert-content">{error}</div></div>;
  }

  if (!manifest || (manifest.totalExpected === 0 && manifest.unassignedUnits.length === 0)) {
    return (
      <div className="vn-card">
        <div className="vn-card-body" style={{ textAlign: 'center', padding: 48 }}>
          <span className="material-icons" style={{ fontSize: 48, opacity: 0.3, display: 'block', marginBottom: 12, color: 'var(--on-surface-variant)' }}>inventory_2</span>
          <h3 style={{ color: 'var(--on-surface-variant)', margin: 0 }}>No trackable cargo units</h3>
          <p style={{ color: 'var(--on-surface-variant)', fontSize: 13, marginTop: 8 }}>
            Add trackable units (pallets, totes, boxes) to orders assigned to this shipment to enable cargo tracking.
          </p>
        </div>
      </div>
    );
  }

  const openDiscrepancies = discrepancies.filter(d => d.status === 'open' || d.status === 'investigating');

  return (
    <>
      {/* Summary Stats */}
      <div className="vn-stats-row" style={{ marginBottom: 24 }}>
        <div className="vn-stat-card">
          <div className="vn-stat-icon" style={{ background: 'var(--primary-container)', color: 'var(--primary)' }}>
            <span className="material-icons">inventory_2</span>
          </div>
          <div className="vn-stat-content">
            <span className="vn-stat-value">{manifest.totalExpected}</span>
            <span className="vn-stat-label">Expected Units</span>
          </div>
        </div>
        <div className="vn-stat-card">
          <div className="vn-stat-icon" style={{ background: 'var(--success-container, rgba(0,200,83,0.1))', color: 'var(--success)' }}>
            <span className="material-icons">qr_code_scanner</span>
          </div>
          <div className="vn-stat-content">
            <span className="vn-stat-value">{manifest.totalScanned}</span>
            <span className="vn-stat-label">Scanned / Confirmed</span>
          </div>
        </div>
        <div className="vn-stat-card">
          <div className="vn-stat-icon" style={{ background: openDiscrepancies.length > 0 ? 'var(--error-container, rgba(255,0,0,0.1))' : 'var(--surface-container)', color: openDiscrepancies.length > 0 ? 'var(--error)' : 'var(--on-surface-variant)' }}>
            <span className="material-icons">warning</span>
          </div>
          <div className="vn-stat-content">
            <span className="vn-stat-value">{openDiscrepancies.length}</span>
            <span className="vn-stat-label">Open Issues</span>
          </div>
        </div>
        <div className="vn-stat-card">
          <div className="vn-stat-icon" style={{ background: 'var(--primary-container)', color: 'var(--primary)' }}>
            <span className="material-icons">pin_drop</span>
          </div>
          <div className="vn-stat-content">
            <span className="vn-stat-value">{manifest.stops.length}</span>
            <span className="vn-stat-label">Delivery Stops</span>
          </div>
        </div>
      </div>

      {/* Discrepancy Alerts */}
      {openDiscrepancies.length > 0 && (
        <div className="vn-card" style={{ marginBottom: 24, border: '1px solid var(--error)', background: 'var(--error-container, rgba(255,0,0,0.04))' }}>
          <div className="vn-card-header" style={{ borderBottom: '1px solid var(--error)' }}>
            <h2 style={{ color: 'var(--error)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="material-icons">report_problem</span>
              Cargo Issues ({openDiscrepancies.length})
            </h2>
          </div>
          <div className="vn-card-body" style={{ padding: 0 }}>
            {openDiscrepancies.map((disc) => (
              <div key={disc.id} style={{
                padding: '12px 16px',
                borderBottom: '1px solid var(--outline-variant)',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
              }}>
                <span className="material-icons" style={{
                  color: disc.severity === 'critical' || disc.severity === 'high' ? 'var(--error)' : 'var(--warning)',
                  fontSize: 20,
                  flexShrink: 0,
                }}>
                  {disc.discrepancyType === 'left_on_vehicle' ? 'local_shipping' :
                   disc.discrepancyType === 'missing_at_stop' ? 'search_off' :
                   disc.discrepancyType.startsWith('misdrop') ? 'wrong_location' : 'error'}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 600, fontSize: 13 }}>
                      {discrepancyTypeLabels[disc.discrepancyType] || disc.discrepancyType}
                    </span>
                    <span className={severityChip[disc.severity] || 'vn-chip'} style={{ fontSize: 11 }}>{disc.severity}</span>
                    {disc.status === 'investigating' && (
                      <span className="vn-chip vn-chip-warning" style={{ fontSize: 11 }}>Investigating</span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--on-surface-variant)', marginTop: 2 }}>
                    {disc.description}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--on-surface-variant)', marginTop: 2 }}>
                    Detected {new Date(disc.detectedAt).toLocaleString()}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                  {disc.status === 'open' && (
                    <button
                      className="vn-btn vn-btn-outline vn-btn-sm"
                      onClick={() => handleInvestigate(disc.id)}
                      style={{ fontSize: 12 }}
                    >
                      Investigate
                    </button>
                  )}
                  <button
                    className="vn-btn vn-btn-primary vn-btn-sm"
                    onClick={() => handleResolve(disc.id)}
                    disabled={resolving === disc.id}
                    style={{ fontSize: 12 }}
                  >
                    {resolving === disc.id ? 'Resolving...' : 'Resolve'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Per-Stop Cargo Manifest */}
      {manifest.stops.map((stop) => {
        const statusInfo = stopStatusIcon[stop.status] || stopStatusIcon.pending;
        const hasIssues = stop.discrepancies.filter(d => d.status !== 'resolved' && d.status !== 'dismissed').length > 0;
        const allDelivered = stop.status === 'completed' && stop.expectedUnits.length > 0;

        return (
          <div key={stop.stopId} className="vn-card" style={{
            marginBottom: 16,
            border: hasIssues ? '1px solid var(--error)' : undefined,
          }}>
            <div className="vn-card-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span className="material-icons" style={{ color: statusInfo.color, fontSize: 20 }}>{statusInfo.icon}</span>
                <div>
                  <h2 style={{ margin: 0, fontSize: 15 }}>
                    Stop {stop.sequenceNumber} — {stop.locationName}
                  </h2>
                  <div style={{ fontSize: 12, color: 'var(--on-surface-variant)', marginTop: 2 }}>
                    {stop.stopType} · {stop.status}
                    {stop.expectedUnits.length > 0 && ` · ${stop.expectedUnits.length} unit${stop.expectedUnits.length !== 1 ? 's' : ''} expected`}
                  </div>
                </div>
              </div>
              {allDelivered && !hasIssues && (
                <span className="vn-chip vn-chip-success" style={{ fontSize: 11 }}>
                  <span className="material-icons" style={{ fontSize: 14, marginRight: 2 }}>check</span>
                  All Delivered
                </span>
              )}
              {hasIssues && (
                <span className="vn-chip vn-chip-error" style={{ fontSize: 11 }}>
                  <span className="material-icons" style={{ fontSize: 14, marginRight: 2 }}>warning</span>
                  Issues Detected
                </span>
              )}
            </div>

            {stop.expectedUnits.length > 0 && (
              <div className="vn-card-body vn-card-flush">
                <div className="vn-table-wrap">
                  <table className="vn-table">
                    <thead>
                      <tr>
                        <th>Unit</th>
                        <th>Type</th>
                        <th>Order</th>
                        <th>Items</th>
                        <th>Condition</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stop.expectedUnits.map((unit) => {
                        const isAtThisStop = unit.currentStopId === stop.stopId;
                        const isScanned = stop.scannedUnits.some(s => s.id === unit.id);
                        const unitDisc = stop.discrepancies.find(
                          (d: any) => d.trackableUnitId === unit.id && d.status !== 'resolved' && d.status !== 'dismissed'
                        );
                        let statusLabel = 'Pending';
                        let statusClass = 'vn-chip vn-chip-secondary';
                        if (isAtThisStop || isScanned) {
                          statusLabel = 'Delivered';
                          statusClass = 'vn-chip vn-chip-success';
                        } else if (stop.status === 'completed') {
                          statusLabel = isScanned ? 'Delivered' : 'Not confirmed';
                          statusClass = isScanned ? 'vn-chip vn-chip-success' : 'vn-chip vn-chip-warning';
                        } else if (stop.status === 'arrived' || stop.status === 'in_progress') {
                          statusLabel = 'In transit';
                          statusClass = 'vn-chip vn-chip-info';
                        }
                        if (unitDisc) {
                          statusLabel = discrepancyTypeLabels[(unitDisc as any).discrepancyType] || 'Issue';
                          statusClass = 'vn-chip vn-chip-error';
                        }

                        return (
                          <tr key={unit.id}>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span className="material-icons" style={{ fontSize: 18, color: 'var(--on-surface-variant)' }}>
                                  {unit.unitType === 'pallet' ? 'pallet' :
                                   unit.unitType === 'box' ? 'inventory_2' :
                                   unit.unitType === 'tote' ? 'shopping_basket' : 'widgets'}
                                </span>
                                <div>
                                  <div style={{ fontWeight: 500, fontSize: 13 }}>{unit.identifier}</div>
                                  {unit.barcode && <div style={{ fontSize: 11, color: 'var(--on-surface-variant)' }}>{unit.barcode}</div>}
                                </div>
                              </div>
                            </td>
                            <td style={{ fontSize: 13, textTransform: 'capitalize' }}>{unit.unitType}</td>
                            <td>
                              <Link to={`/orders/${unit.orderId}`} style={{ color: 'var(--primary)', fontSize: 13, textDecoration: 'none' }}>
                                {unit.orderNumber}
                              </Link>
                            </td>
                            <td style={{ fontSize: 13 }}>{unit.lineItemCount}</td>
                            <td><span className={conditionChip[unit.condition] || 'vn-chip'} style={{ fontSize: 11 }}>{unit.condition}</span></td>
                            <td><span className={statusClass} style={{ fontSize: 11 }}>{statusLabel}</span></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {stop.expectedUnits.length === 0 && (
              <div className="vn-card-body" style={{ textAlign: 'center', padding: 24, color: 'var(--on-surface-variant)', fontSize: 13 }}>
                No cargo units assigned to this stop
              </div>
            )}
          </div>
        );
      })}

      {/* Unassigned Units */}
      {manifest.unassignedUnits.length > 0 && (
        <div className="vn-card" style={{ marginBottom: 16, border: '1px solid var(--warning)' }}>
          <div className="vn-card-header">
            <h2 style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 15 }}>
              <span className="material-icons" style={{ color: 'var(--warning)', fontSize: 20 }}>help_outline</span>
              Unassigned Cargo ({manifest.unassignedUnits.length})
            </h2>
          </div>
          <div className="vn-card-body" style={{ fontSize: 13, color: 'var(--on-surface-variant)' }}>
            These trackable units are on this shipment but not assigned to a delivery stop.
          </div>
          <div className="vn-card-body vn-card-flush">
            <div className="vn-table-wrap">
              <table className="vn-table">
                <thead>
                  <tr><th>Unit</th><th>Type</th><th>Order</th><th>Items</th><th>Condition</th></tr>
                </thead>
                <tbody>
                  {manifest.unassignedUnits.map((unit) => (
                    <tr key={unit.id}>
                      <td style={{ fontWeight: 500, fontSize: 13 }}>{unit.identifier}</td>
                      <td style={{ fontSize: 13, textTransform: 'capitalize' }}>{unit.unitType}</td>
                      <td>
                        <Link to={`/orders/${unit.orderId}`} style={{ color: 'var(--primary)', fontSize: 13, textDecoration: 'none' }}>
                          {unit.orderNumber}
                        </Link>
                      </td>
                      <td style={{ fontSize: 13 }}>{unit.lineItemCount}</td>
                      <td><span className={conditionChip[unit.condition] || 'vn-chip'} style={{ fontSize: 11 }}>{unit.condition}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Resolved Discrepancies History */}
      {discrepancies.filter(d => d.status === 'resolved' || d.status === 'dismissed').length > 0 && (
        <div className="vn-card">
          <div className="vn-card-header">
            <h2 style={{ fontSize: 15 }}>Resolved Issues</h2>
          </div>
          <div className="vn-card-body vn-card-flush">
            <div className="vn-table-wrap">
              <table className="vn-table">
                <thead>
                  <tr><th>Issue</th><th>Unit</th><th>Status</th><th>Resolution</th><th>Resolved</th></tr>
                </thead>
                <tbody>
                  {discrepancies.filter(d => d.status === 'resolved' || d.status === 'dismissed').map((disc) => (
                    <tr key={disc.id}>
                      <td style={{ fontSize: 13 }}>{discrepancyTypeLabels[disc.discrepancyType] || disc.discrepancyType}</td>
                      <td style={{ fontSize: 13 }}>{disc.trackableUnit?.identifier || '—'}</td>
                      <td><span className="vn-chip vn-chip-success" style={{ fontSize: 11 }}>{disc.status}</span></td>
                      <td style={{ fontSize: 12, color: 'var(--on-surface-variant)' }}>{disc.resolution || '—'}</td>
                      <td style={{ fontSize: 12 }}>{disc.resolvedAt ? new Date(disc.resolvedAt).toLocaleString() : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default function VNextShipmentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const mapRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState('events');
  const [shipment, setShipment] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [documents, setDocuments] = useState<any[]>([]);
  const [generating, setGenerating] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    fetch(`${API_URL}/api/v1/shipments/${id}`)
      .then(res => {
        if (!res.ok) throw new Error('Failed to load shipment');
        return res.json();
      })
      .then(json => {
        if (json.error) throw new Error(json.error);
        setShipment(json.data);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  // Fetch documents for this shipment
  const loadDocuments = useCallback(() => {
    if (!id) return;
    fetch(`${API_URL}/api/v1/documents?shipmentId=${id}`)
      .then(r => r.json())
      .then(json => { if (!json.error) setDocuments(json.data || []); })
      .catch(() => {});
  }, [id]);

  useEffect(() => { loadDocuments(); }, [loadDocuments]);

  const handleGenerateDoc = async (type: 'bol' | 'customs') => {
    if (!id) return;
    setGenerating(type);
    try {
      const res = await fetch(`${API_URL}/api/v1/documents/generate/${type}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shipmentId: id }),
      });
      const json = await res.json();
      if (json.error) { alert(`Error: ${json.error}`); return; }
      loadDocuments();
      // Navigate to BOL view for BOL documents
      if (type === 'bol') {
        navigate(`/documents/${json.data.id}/view`);
      }
    } catch {
      alert(`Failed to generate ${type === 'bol' ? 'Bill of Lading' : 'Customs Form'}`);
    } finally {
      setGenerating(null);
    }
  };

  const hasOriginCoords = !!(shipment?.origin?.lat && shipment?.origin?.lng);
  const hasDestCoords = !!(shipment?.destination?.lat && shipment?.destination?.lng);
  const hasAnyCoords = hasOriginCoords || hasDestCoords;

  useEffect(() => {
    if (!mapRef.current || !shipment || !hasAnyCoords) return;
    const origin = shipment.origin;
    const destination = shipment.destination;

    const map = L.map(mapRef.current, { zoomControl: true, attributionControl: false });
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', { maxZoom: 19 }).addTo(map);

    const cs = getComputedStyle(document.documentElement);
    const cOrigin = cs.getPropertyValue('--marker-origin').trim();
    const cDest = cs.getPropertyValue('--marker-destination').trim();
    const cStop = cs.getPropertyValue('--marker-stop').trim();
    const cDefault = cs.getPropertyValue('--marker-default').trim();

    const allCoords: [number, number][] = [];

    // Origin marker
    if (hasOriginCoords) {
      const coord: [number, number] = [origin.lat, origin.lng];
      allCoords.push(coord);
      const originIcon = L.divIcon({
        className: '',
        html: `<div style="width:20px;height:20px;border-radius:50%;background:${cOrigin};border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;"><div style="width:6px;height:6px;border-radius:50%;background:white;"></div></div>`,
        iconSize: [20, 20], iconAnchor: [10, 10],
      });
      L.marker(coord, { icon: originIcon }).addTo(map).bindPopup(`<strong>Origin</strong><br/>${origin.city || ''}, ${origin.state || ''}`);
    }

    // Destination marker
    if (hasDestCoords) {
      const coord: [number, number] = [destination.lat, destination.lng];
      allCoords.push(coord);
      const destIcon = L.divIcon({
        className: '',
        html: `<div style="width:20px;height:20px;border-radius:50%;background:${cDest};border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;"><div style="width:6px;height:6px;border-radius:50%;background:white;"></div></div>`,
        iconSize: [20, 20], iconAnchor: [10, 10],
      });
      L.marker(coord, { icon: destIcon }).addTo(map).bindPopup(`<strong>Destination</strong><br/>${destination.city || ''}, ${destination.state || ''}`);
    }

    // Stop markers
    const stopIcon = L.divIcon({
      className: '',
      html: `<div style="width:16px;height:16px;border-radius:50%;background:${cStop};border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);"></div>`,
      iconSize: [16, 16], iconAnchor: [8, 8],
    });
    (shipment.stops || []).filter((s: any) => s.lat && s.lng).forEach((s: any) => {
      const coord: [number, number] = [s.lat, s.lng];
      allCoords.push(coord);
      L.marker(coord, { icon: stopIcon }).addTo(map).bindPopup(`<strong>Stop</strong><br/>${s.city || ''}, ${s.state || ''}`);
    });

    // Route line between all points
    if (allCoords.length >= 2) {
      L.polyline(allCoords, { color: cDefault, weight: 3, opacity: 0.7, dashArray: '8 4' }).addTo(map);
      L.polyline(allCoords, { color: cOrigin, weight: 4 }).addTo(map);
      map.fitBounds(L.latLngBounds(allCoords).pad(0.1));
    } else if (allCoords.length === 1) {
      map.setView(allCoords[0], 12);
    }

    // Fix tile rendering when container isn't fully laid out yet
    setTimeout(() => map.invalidateSize(), 100);

    return () => { map.remove(); };
  }, [shipment, hasAnyCoords]);

  if (loading) return <div className="loading-spinner" style={{ margin: '2rem auto' }} />;
  if (error) return <div className="vn-alert vn-alert-error" style={{ margin: '2rem' }}>{error}</div>;
  if (!shipment) return <div className="vn-alert vn-alert-error" style={{ margin: '2rem' }}>Shipment not found</div>;

  const origin = shipment.origin || {};
  const destination = shipment.destination || {};
  const events = shipment.events || [];
  const orders = shipment.orderShipments || [];

  return (
    <>
      {/* Breadcrumb & Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <button className="vn-btn vn-btn-ghost vn-btn-sm" onClick={() => navigate('/shipments')}>
          <span className="material-icons">arrow_back</span>
          Shipments
        </button>
      </div>

      <div className="vn-page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <h1>{shipment.reference || id}</h1>
          <span className="vn-chip vn-chip-info">
            <span className="vn-live-dot" style={{ width: 8, height: 8, marginRight: 2 }} />
            {shipment.status || 'Unknown'}
          </span>
        </div>
        <div className="vn-page-actions">
          <button className="vn-btn vn-btn-outline vn-btn-sm">
            <span className="material-icons">edit</span>
            Edit
          </button>
          <button className="vn-btn vn-btn-outline vn-btn-sm">
            <span className="material-icons">description</span>
            Documents
          </button>
          <button className="vn-btn vn-btn-outline vn-btn-sm">
            <span className="material-icons">share</span>
            Share
          </button>
          <button className="vn-btn vn-btn-primary vn-btn-sm">
            <span className="material-icons">track_changes</span>
            Track
          </button>
        </div>
      </div>

      {/* Map */}
      {hasAnyCoords ? (
        <div ref={mapRef} className="vn-map tall" style={{ marginBottom: 24 }} />
      ) : (
        <div className="vn-map tall" style={{
          marginBottom: 24,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          overflow: 'hidden',
        }}>
          {/* Faint map background placeholder */}
          <img
            src="https://basemaps.cartocdn.com/light_all/4/4/6.png"
            alt=""
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              opacity: 0.15,
              filter: 'grayscale(100%)',
              pointerEvents: 'none',
            }}
          />
          <div style={{ textAlign: 'center', color: 'var(--on-surface-variant)', position: 'relative', zIndex: 1 }}>
            <span className="material-icons" style={{ fontSize: 48, opacity: 0.4, display: 'block', marginBottom: 8 }}>map</span>
            <div style={{ fontSize: 14, fontWeight: 500 }}>No coordinates to plot yet</div>
            <div style={{ fontSize: 13, marginTop: 4 }}>Add coordinates to the origin or destination location to see the route map</div>
          </div>
        </div>
      )}

      {/* Route Progress */}
      <div className="vn-card" style={{ marginBottom: 24 }}>
        <div className="vn-card-body">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--on-surface)' }}>{origin.city}, {origin.state} → {destination.city}, {destination.state}</span>
            <span style={{ fontSize: 13, color: 'var(--on-surface-variant)' }}>{shipment.deliveryDate ? `ETA ${new Date(shipment.deliveryDate).toLocaleDateString()}` : ''}</span>
          </div>
          <div className="vn-progress" style={{ height: 8 }}>
            <div className="vn-progress-bar success" style={{ width: '58%' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span className="vn-route-dot origin" />
              <span style={{ fontSize: 12, color: 'var(--on-surface-variant)' }}>{origin.city}, {origin.state}{shipment.pickupDate ? ` — ${new Date(shipment.pickupDate).toLocaleDateString()}` : ''}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 12, color: 'var(--on-surface-variant)' }}>{destination.city}, {destination.state}{shipment.deliveryDate ? ` — ${new Date(shipment.deliveryDate).toLocaleDateString()}` : ''}</span>
              <span className="vn-route-dot destination" />
            </div>
          </div>
        </div>
      </div>

      <div className="vn-detail-grid">
        <div className="vn-detail-main">
          {/* Tabs */}
          <div className="vn-tabs">
            <button className={`vn-tab ${activeTab === 'events' ? 'active' : ''}`} onClick={() => setActiveTab('events')}>Events & History</button>
            <button className={`vn-tab ${activeTab === 'documents' ? 'active' : ''}`} onClick={() => setActiveTab('documents')}>Documents</button>
            <button className={`vn-tab ${activeTab === 'financials' ? 'active' : ''}`} onClick={() => setActiveTab('financials')}>Financials</button>
            <button className={`vn-tab ${activeTab === 'notes' ? 'active' : ''}`} onClick={() => setActiveTab('notes')}>Notes</button>
            <button className={`vn-tab ${activeTab === 'cargo' ? 'active' : ''}`} onClick={() => setActiveTab('cargo')}>
              <span className="material-icons" style={{ fontSize: 16, marginRight: 4, verticalAlign: 'middle' }}>inventory_2</span>
              Cargo
            </button>
            <button className={`vn-tab ${activeTab === 'telemetry' ? 'active' : ''}`} onClick={() => setActiveTab('telemetry')}>
              <span className="material-icons" style={{ fontSize: 16, marginRight: 4, verticalAlign: 'middle' }}>thermostat</span>
              Telemetry
            </button>
          </div>

          {/* Events Timeline */}
          {activeTab === 'events' && (
            <div className="vn-card">
              <div className="vn-card-header">
                <h2>Event Timeline</h2>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="vn-btn vn-btn-ghost vn-btn-sm">
                    <span className="material-icons">filter_list</span>
                    Filter
                  </button>
                  <button className="vn-btn vn-btn-outline vn-btn-sm">
                    <span className="material-icons">add</span>
                    Add Event
                  </button>
                </div>
              </div>
              <div className="vn-card-body">
                <div className="vn-timeline">
                  {events.length === 0 && <p style={{ color: 'var(--on-surface-variant)', fontSize: 13 }}>No events recorded yet.</p>}
                  {events.map((ev: any, i: number) => (
                    <div className="vn-timeline-item" key={ev.id || i}>
                      <div className={`vn-timeline-dot ${ev.type === 'pickup' ? 'success' : ev.type === 'delivery' ? 'primary' : 'info'}`} />
                      <div className="vn-timeline-time">{ev.occurredAt ? new Date(ev.occurredAt).toLocaleString() : ''}</div>
                      <div className="vn-timeline-title">{ev.type || ev.title || 'Event'}</div>
                      <div className="vn-timeline-desc">{ev.description || ev.notes || ''}</div>
                      {ev.location && (
                        <div className="vn-timeline-location">
                          <span className="material-icons">place</span>
                          {ev.location}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'documents' && (
            <div className="vn-card">
              <div className="vn-card-header">
                <h2>Documents</h2>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    className="vn-btn vn-btn-primary vn-btn-sm"
                    disabled={generating !== null}
                    onClick={() => handleGenerateDoc('bol')}
                  >
                    <span className="material-icons">description</span>
                    {generating === 'bol' ? 'Generating...' : 'Generate BOL'}
                  </button>
                  <button
                    className="vn-btn vn-btn-outline vn-btn-sm"
                    disabled={generating !== null}
                    onClick={() => handleGenerateDoc('customs')}
                  >
                    <span className="material-icons">public</span>
                    {generating === 'customs' ? 'Generating...' : 'Customs Form'}
                  </button>
                </div>
              </div>
              <div className="vn-card-body vn-card-flush">
                {documents.length === 0 ? (
                  <div style={{ padding: 32, textAlign: 'center', color: 'var(--on-surface-variant)' }}>
                    <span className="material-icons" style={{ fontSize: 40, opacity: 0.4, marginBottom: 8, display: 'block' }}>folder_open</span>
                    <p style={{ fontSize: 14 }}>No documents yet. Generate a Bill of Lading to get started.</p>
                  </div>
                ) : (
                  <div className="vn-table-wrap">
                    <table className="vn-table">
                      <thead><tr><th>Document</th><th>Type</th><th>Created</th><th>Actions</th></tr></thead>
                      <tbody>
                        {documents.map((doc: any) => {
                          const typeLabel: Record<string, string> = { bol: 'Bill of Lading', customs: 'Customs Form', label: 'Label', attachment: 'Attachment' };
                          const typeChip: Record<string, string> = { bol: 'vn-chip vn-chip-info', customs: 'vn-chip vn-chip-warning', label: 'vn-chip vn-chip-secondary', attachment: 'vn-chip vn-chip-secondary' };
                          return (
                            <tr key={doc.id}>
                              <td style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span className="material-icons" style={{ color: 'var(--error)', fontSize: 20 }}>picture_as_pdf</span>
                                <span style={{ fontWeight: 500 }}>{doc.fileName}</span>
                                {doc.documentNumber && <span style={{ fontSize: 12, color: 'var(--on-surface-variant)' }}>({doc.documentNumber})</span>}
                              </td>
                              <td><span className={typeChip[doc.documentType] || 'vn-chip vn-chip-secondary'}>{typeLabel[doc.documentType] || doc.documentType}</span></td>
                              <td style={{ fontSize: 13 }}>{new Date(doc.createdAt).toLocaleDateString()}</td>
                              <td style={{ display: 'flex', gap: 4 }}>
                                {doc.documentType === 'bol' && (
                                  <Link to={`/documents/${doc.id}/view`}>
                                    <button className="vn-btn-icon" title="View BOL"><span className="material-icons" style={{ fontSize: 18 }}>visibility</span></button>
                                  </Link>
                                )}
                                <a href={`${API_URL}/api/v1/documents/${doc.id}/download`} target="_blank" rel="noopener noreferrer">
                                  <button className="vn-btn-icon" title="Download PDF"><span className="material-icons" style={{ fontSize: 18 }}>download</span></button>
                                </a>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'financials' && (
            <div className="vn-card">
              <div className="vn-card-header"><h2>Financials</h2></div>
              <div className="vn-card-body">
                <div className="vn-info-grid">
                  <div className="vn-info-item"><label>Carrier Rate</label><span>$2,850.00</span></div>
                  <div className="vn-info-item"><label>Customer Rate</label><span>$3,400.00</span></div>
                  <div className="vn-info-item"><label>Margin</label><span style={{ color: 'var(--success)' }}>$550.00 (16.2%)</span></div>
                  <div className="vn-info-item"><label>Fuel Surcharge</label><span>$285.00</span></div>
                  <div className="vn-info-item"><label>Accessorials</label><span>$0.00</span></div>
                  <div className="vn-info-item"><label>Total Revenue</label><span style={{ fontWeight: 700, fontSize: 16 }}>$3,685.00</span></div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'notes' && (
            <div className="vn-card">
              <div className="vn-card-header"><h2>Notes</h2></div>
              <div className="vn-card-body">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ padding: 12, background: 'var(--surface-container)', borderRadius: 'var(--border-radius-sm)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--on-surface)' }}>Jane S.</span>
                      <span style={{ fontSize: 12, color: 'var(--on-surface-variant)' }}>Apr 6, 4:00 PM</span>
                    </div>
                    <p style={{ fontSize: 13, color: 'var(--on-surface-variant)' }}>Customer requested delivery before 10 AM. Carrier confirmed ETA.</p>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input type="text" placeholder="Add a note..." style={{
                      flex: 1, padding: '10px 14px', border: '1px solid var(--outline-variant)', borderRadius: 'var(--border-radius-sm)',
                      background: 'var(--surface-container)', color: 'var(--on-surface)', fontSize: 14, outline: 'none',
                    }} />
                    <button className="vn-btn vn-btn-primary vn-btn-sm"><span className="material-icons">send</span></button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'cargo' && (
            <CargoTab shipmentId={id!} />
          )}

          {activeTab === 'telemetry' && (
            <TelemetryTab shipmentId={id!} />
          )}
        </div>

        {/* Sidebar */}
        <div className="vn-detail-sidebar">
          {/* Shipment Details */}
          <div className="vn-card">
            <div className="vn-card-header"><h2>Details</h2></div>
            <div className="vn-card-body">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="vn-info-item"><label>Customer</label><span>{shipment.customer?.name || '—'}</span></div>
                <div className="vn-info-item"><label>Carrier</label><span>{shipment.carrier?.name || '—'}</span></div>
                <div className="vn-info-item"><label>PRO Number</label><span>{shipment.proNumber || '—'}</span></div>
                <div className="vn-info-item"><label>Status</label><span>{shipment.status || '—'}</span></div>
                <div className="vn-info-item"><label>Pickup Date</label><span>{shipment.pickupDate ? new Date(shipment.pickupDate).toLocaleDateString() : '—'}</span></div>
                <div className="vn-info-item"><label>Delivery Date</label><span>{shipment.deliveryDate ? new Date(shipment.deliveryDate).toLocaleDateString() : '—'}</span></div>
                <div className="vn-info-item"><label>Lane</label><span>{shipment.lane?.name || '—'}</span></div>
                {orders.length > 0 && (
                  <div className="vn-info-item"><label>Orders</label><span>{orders.map((os: any) => os.order?.orderNumber).filter(Boolean).join(', ') || '—'}</span></div>
                )}
              </div>
            </div>
          </div>

          {/* Origin */}
          <div className="vn-card">
            <div className="vn-card-body">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <span className="vn-route-dot origin" />
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--on-surface)' }}>Origin</span>
              </div>
              <div className="vn-info-item" style={{ marginBottom: 8 }}>
                <label>Facility</label><span>{origin.name || '—'}</span>
              </div>
              <div className="vn-info-item" style={{ marginBottom: 8 }}>
                <label>Address</label><span>{[origin.address1, origin.city, origin.state].filter(Boolean).join(', ') || '—'}</span>
              </div>
              <div className="vn-info-item">
                <label>Pickup Date</label><span>{shipment.pickupDate ? new Date(shipment.pickupDate).toLocaleDateString() : '—'}</span>
              </div>
            </div>
          </div>

          {/* Destination */}
          <div className="vn-card">
            <div className="vn-card-body">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <span className="vn-route-dot destination" />
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--on-surface)' }}>Destination</span>
              </div>
              <div className="vn-info-item" style={{ marginBottom: 8 }}>
                <label>Facility</label><span>{destination.name || '—'}</span>
              </div>
              <div className="vn-info-item" style={{ marginBottom: 8 }}>
                <label>Address</label><span>{[destination.address1, destination.city, destination.state].filter(Boolean).join(', ') || '—'}</span>
              </div>
              <div className="vn-info-item">
                <label>Delivery Date</label><span>{shipment.deliveryDate ? new Date(shipment.deliveryDate).toLocaleDateString() : '—'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
