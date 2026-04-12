/**
 * VNextLocationOps — Per-location operations dashboard.
 *
 * Shows incoming, at-location, and outgoing shipments/units for a single location.
 * Designed for distribution centre, cross-dock, and hub-and-spoke operations.
 */

import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { API_URL } from '../api';
import { getLocationTypeMeta } from './locationTypesMeta';

interface LocationOps {
  location: any;
  stats: {
    incoming: number;
    atLocation: number;
    outgoing: number;
    unitsHere: number;
    todayArrivals: number;
    todayDepartures: number;
    avgDwellMinutes: number | null;
  };
  incoming: { stops: any[]; directShipments: any[] };
  atLocation: { stops: any[]; units: any[] };
  outgoing: { shipments: any[] };
}

function formatDwell(minutes: number | null): string {
  if (minutes === null) return '--';
  if (minutes < 60) return `${minutes}m`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
  return `${Math.floor(minutes / 1440)}d ${Math.floor((minutes % 1440) / 60)}h`;
}

function DwellBadge({ minutes }: { minutes: number | null }) {
  if (minutes === null) return null;
  const color = minutes > 240 ? 'var(--color-error)' : minutes > 120 ? 'var(--color-warning)' : 'var(--on-surface-variant)';
  return (
    <span style={{ fontSize: '12px', fontWeight: 600, color }}>
      {formatDwell(minutes)}
    </span>
  );
}

export default function VNextLocationOps() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<LocationOps | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeSection, setActiveSection] = useState<'incoming' | 'at_location' | 'outgoing'>('at_location');

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    fetch(`${API_URL}/api/v1/locations/${id}/operations`)
      .then((r) => r.json())
      .then((json) => {
        if (!cancelled) {
          if (json.error) setError(json.error);
          else setData(json.data);
        }
      })
      .catch((err) => { if (!cancelled) setError(err.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id]);

  if (loading) {
    return <div style={{ padding: '48px', textAlign: 'center' }}><div className="loading-spinner" /></div>;
  }

  if (error || !data) {
    return (
      <div style={{ padding: '24px' }}>
        <div className="vn-alert vn-alert-error">{error || 'Failed to load location'}</div>
      </div>
    );
  }

  const { location, stats } = data;
  const typeMeta = getLocationTypeMeta(location.locationType);
  const capabilities = location.facilityCapabilities as Record<string, boolean> | null;

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
            {typeMeta && <span className="material-icons" style={{ fontSize: '28px', color: 'var(--primary)' }}>{typeMeta.icon}</span>}
            <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 700 }}>{location.name}</h1>
            {typeMeta && <span className={`vn-chip ${typeMeta.chip}`}>{typeMeta.label}</span>}
          </div>
          <p style={{ margin: '4px 0 0', fontSize: '14px', color: 'var(--on-surface-variant)' }}>
            {location.address1}, {location.city}{location.state ? `, ${location.state}` : ''} — {location.country}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <Link to={`/locations/${id}/edit`} className="vn-btn" style={{ display: 'flex', alignItems: 'center', gap: '4px', textDecoration: 'none' }}>
            <span className="material-icons" style={{ fontSize: '16px' }}>edit</span>
            Edit
          </Link>
          <Link to="/map" className="vn-btn" style={{ display: 'flex', alignItems: 'center', gap: '4px', textDecoration: 'none', background: 'transparent', border: '1px solid var(--outline-variant)', color: 'var(--on-surface-variant)' }}>
            <span className="material-icons" style={{ fontSize: '16px' }}>map</span>
            Map
          </Link>
        </div>
      </div>

      {/* Facility info bar */}
      {(location.dockCount || capabilities || location.contactName) && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', marginBottom: '20px', padding: '12px 16px', background: 'var(--surface-container)', borderRadius: '8px', fontSize: '13px' }}>
          {location.dockCount && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span className="material-icons" style={{ fontSize: '16px', color: 'var(--primary)' }}>dock</span>
              {location.dockCount} docks
            </div>
          )}
          {capabilities?.crossDockCapable && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span className="material-icons" style={{ fontSize: '16px', color: 'var(--color-info)' }}>swap_horiz</span>
              Cross-dock
            </div>
          )}
          {capabilities?.hasColdStorage && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span className="material-icons" style={{ fontSize: '16px', color: 'var(--color-info)' }}>ac_unit</span>
              Cold storage
            </div>
          )}
          {capabilities?.hasHazmatCert && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span className="material-icons" style={{ fontSize: '16px', color: 'var(--color-warning)' }}>warning</span>
              Hazmat
            </div>
          )}
          {location.appointmentRequired && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span className="material-icons" style={{ fontSize: '16px', color: 'var(--color-warning)' }}>event</span>
              Appointment required
            </div>
          )}
          {location.contactName && (
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--on-surface-variant)' }}>
              <span className="material-icons" style={{ fontSize: '16px' }}>person</span>
              {location.contactName}{location.contactPhone ? ` — ${location.contactPhone}` : ''}
            </div>
          )}
        </div>
      )}

      {/* Stats cards */}
      <div className="vn-stats" style={{ marginBottom: '24px' }}>
        <div className="vn-stat" style={{ borderLeft: '4px solid var(--color-info)', cursor: 'pointer' }} onClick={() => setActiveSection('incoming')}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="material-icons" style={{ fontSize: '24px', color: 'var(--color-info)' }}>arrow_downward</span>
            <div>
              <div style={{ fontSize: '28px', fontWeight: 700 }}>{stats.incoming}</div>
              <div style={{ fontSize: '13px', color: 'var(--on-surface-variant)' }}>Incoming</div>
            </div>
          </div>
        </div>
        <div className="vn-stat" style={{ borderLeft: '4px solid var(--color-warning)', cursor: 'pointer' }} onClick={() => setActiveSection('at_location')}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="material-icons" style={{ fontSize: '24px', color: 'var(--color-warning)' }}>inventory</span>
            <div>
              <div style={{ fontSize: '28px', fontWeight: 700 }}>{stats.atLocation}</div>
              <div style={{ fontSize: '13px', color: 'var(--on-surface-variant)' }}>At Location</div>
            </div>
          </div>
        </div>
        <div className="vn-stat" style={{ borderLeft: '4px solid var(--color-success)', cursor: 'pointer' }} onClick={() => setActiveSection('outgoing')}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="material-icons" style={{ fontSize: '24px', color: 'var(--color-success)' }}>arrow_upward</span>
            <div>
              <div style={{ fontSize: '28px', fontWeight: 700 }}>{stats.outgoing}</div>
              <div style={{ fontSize: '13px', color: 'var(--on-surface-variant)' }}>Outgoing</div>
            </div>
          </div>
        </div>
        <div className="vn-stat" style={{ borderLeft: '4px solid var(--primary)' }}>
          <div style={{ fontSize: '28px', fontWeight: 700 }}>{stats.unitsHere}</div>
          <div style={{ fontSize: '13px', color: 'var(--on-surface-variant)' }}>Units Here</div>
        </div>
        <div className="vn-stat">
          <div style={{ fontSize: '28px', fontWeight: 700 }}>{stats.todayArrivals}</div>
          <div style={{ fontSize: '13px', color: 'var(--on-surface-variant)' }}>Today Arrivals</div>
        </div>
        <div className="vn-stat">
          <div style={{ fontSize: '28px', fontWeight: 700, color: stats.avgDwellMinutes && stats.avgDwellMinutes > 240 ? 'var(--color-error)' : 'var(--on-surface)' }}>
            {formatDwell(stats.avgDwellMinutes)}
          </div>
          <div style={{ fontSize: '13px', color: 'var(--on-surface-variant)' }}>Avg Dwell Today</div>
        </div>
      </div>

      {/* Section tabs */}
      <div className="vn-tabs" style={{ marginBottom: '16px' }}>
        <button className={`vn-tab${activeSection === 'incoming' ? ' active' : ''}`} onClick={() => setActiveSection('incoming')}>
          <span className="material-icons" style={{ fontSize: '18px' }}>arrow_downward</span>
          Incoming ({stats.incoming})
        </button>
        <button className={`vn-tab${activeSection === 'at_location' ? ' active' : ''}`} onClick={() => setActiveSection('at_location')}>
          <span className="material-icons" style={{ fontSize: '18px' }}>inventory</span>
          At Location ({stats.atLocation})
        </button>
        <button className={`vn-tab${activeSection === 'outgoing' ? ' active' : ''}`} onClick={() => setActiveSection('outgoing')}>
          <span className="material-icons" style={{ fontSize: '18px' }}>arrow_upward</span>
          Outgoing ({stats.outgoing})
        </button>
      </div>

      {/* Incoming */}
      {activeSection === 'incoming' && (
        <div className="vn-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="vn-table-wrap">
            <table className="vn-table">
              <thead>
                <tr>
                  <th>Shipment</th>
                  <th>Customer</th>
                  <th>Carrier</th>
                  <th>From</th>
                  <th>Type</th>
                  <th>ETA</th>
                </tr>
              </thead>
              <tbody>
                {data.incoming.stops.map((s: any) => (
                  <tr key={s.stopId}>
                    <td><Link to={`/shipments/${s.shipmentId}`} style={{ color: 'var(--primary)', textDecoration: 'none', fontWeight: 500 }}>{s.shipmentReference}</Link></td>
                    <td>{s.customerName || '--'}</td>
                    <td>{s.carrierName || '--'}</td>
                    <td>{s.originName}{s.originCity ? `, ${s.originCity}` : ''}</td>
                    <td><span style={{ textTransform: 'capitalize', fontSize: '12px' }}>{s.stopType}</span></td>
                    <td style={{ fontSize: '12px' }}>{s.estimatedArrival ? new Date(s.estimatedArrival).toLocaleString() : '--'}</td>
                  </tr>
                ))}
                {data.incoming.directShipments.map((s: any) => (
                  <tr key={s.id}>
                    <td><Link to={`/shipments/${s.id}`} style={{ color: 'var(--primary)', textDecoration: 'none', fontWeight: 500 }}>{s.reference}</Link></td>
                    <td>{s.customer?.name || '--'}</td>
                    <td>{s.carrier?.name || '--'}</td>
                    <td>{s.origin?.name}{s.origin?.city ? `, ${s.origin.city}` : ''}</td>
                    <td><span className="vn-chip vn-chip-info" style={{ fontSize: '11px' }}>direct</span></td>
                    <td style={{ fontSize: '12px' }}>{s.deliveryDate ? new Date(s.deliveryDate).toLocaleString() : '--'}</td>
                  </tr>
                ))}
                {data.incoming.stops.length === 0 && data.incoming.directShipments.length === 0 && (
                  <tr><td colSpan={6} style={{ textAlign: 'center', padding: '24px', color: 'var(--on-surface-variant)' }}>No incoming shipments</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* At Location */}
      {activeSection === 'at_location' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Stops currently here */}
          <div className="vn-card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--outline-variant)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span className="material-icons" style={{ fontSize: '18px', color: 'var(--color-warning)' }}>local_shipping</span>
              Shipments at Dock ({data.atLocation.stops.length})
            </div>
            <div className="vn-table-wrap">
              <table className="vn-table">
                <thead>
                  <tr>
                    <th>Shipment</th>
                    <th>Customer</th>
                    <th>Carrier</th>
                    <th>Status</th>
                    <th>Dwell Time</th>
                    <th>Destination</th>
                  </tr>
                </thead>
                <tbody>
                  {data.atLocation.stops.map((s: any) => (
                    <tr key={s.stopId}>
                      <td><Link to={`/shipments/${s.shipmentId}`} style={{ color: 'var(--primary)', textDecoration: 'none', fontWeight: 500 }}>{s.shipmentReference}</Link></td>
                      <td>{s.customerName || '--'}</td>
                      <td>{s.carrierName || '--'}</td>
                      <td><span className={`vn-chip ${s.status === 'in_progress' ? 'vn-chip-warning' : 'vn-chip-info'}`}>{s.status.replace(/_/g, ' ')}</span></td>
                      <td><DwellBadge minutes={s.dwellMinutes} /></td>
                      <td>{s.destinationName}{s.destinationCity ? `, ${s.destinationCity}` : ''}</td>
                    </tr>
                  ))}
                  {data.atLocation.stops.length === 0 && (
                    <tr><td colSpan={6} style={{ textAlign: 'center', padding: '24px', color: 'var(--on-surface-variant)' }}>No shipments currently at dock</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Units here */}
          {data.atLocation.units.length > 0 && (
            <div className="vn-card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--outline-variant)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span className="material-icons" style={{ fontSize: '18px', color: 'var(--primary)' }}>inventory_2</span>
                Trackable Units ({data.atLocation.units.length})
              </div>
              <div className="vn-table-wrap">
                <table className="vn-table">
                  <thead>
                    <tr>
                      <th>Unit</th>
                      <th>Type</th>
                      <th>Condition</th>
                      <th>Order</th>
                      <th>Shipment</th>
                      <th>Arrived</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.atLocation.units.map((u: any) => (
                      <tr key={u.id}>
                        <td style={{ fontWeight: 500 }}>{u.identifier}</td>
                        <td style={{ textTransform: 'capitalize', fontSize: '12px' }}>{u.unitType}</td>
                        <td><span className={`vn-chip ${u.condition === 'good' ? 'vn-chip-success' : u.condition === 'damaged' ? 'vn-chip-error' : 'vn-chip-secondary'}`}>{u.condition}</span></td>
                        <td>{u.orderNumber || '--'}</td>
                        <td>{u.shipmentReference || '--'}</td>
                        <td style={{ fontSize: '12px' }}>{u.arrivedAt ? new Date(u.arrivedAt).toLocaleString() : '--'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Outgoing */}
      {activeSection === 'outgoing' && (
        <div className="vn-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="vn-table-wrap">
            <table className="vn-table">
              <thead>
                <tr>
                  <th>Shipment</th>
                  <th>Status</th>
                  <th>Customer</th>
                  <th>Carrier</th>
                  <th>Destination</th>
                  <th>Pickup Date</th>
                </tr>
              </thead>
              <tbody>
                {data.outgoing.shipments.map((s: any) => (
                  <tr key={s.id}>
                    <td><Link to={`/shipments/${s.id}`} style={{ color: 'var(--primary)', textDecoration: 'none', fontWeight: 500 }}>{s.reference}</Link></td>
                    <td><span className={`vn-chip ${s.status === 'in_transit' ? 'vn-chip-info' : s.status === 'dispatched' ? 'vn-chip-warning' : 'vn-chip-secondary'}`}>{s.status.replace(/_/g, ' ')}</span></td>
                    <td>{s.customerName || '--'}</td>
                    <td>{s.carrierName || '--'}</td>
                    <td>{s.destinationName}{s.destinationCity ? `, ${s.destinationCity}` : ''}</td>
                    <td style={{ fontSize: '12px' }}>{s.pickupDate ? new Date(s.pickupDate).toLocaleString() : '--'}</td>
                  </tr>
                ))}
                {data.outgoing.shipments.length === 0 && (
                  <tr><td colSpan={6} style={{ textAlign: 'center', padding: '24px', color: 'var(--on-surface-variant)' }}>No outgoing shipments</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
