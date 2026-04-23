import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { API_URL } from '../api';
import GoogleMapsRouteEditor from '../components/GoogleMapsRouteEditor';

export default function VNextLaneDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [lane, setLane] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    fetch(`${API_URL}/api/v1/lanes/${id}`)
      .then(res => {
        if (!res.ok) throw new Error('Failed to load lane');
        return res.json();
      })
      .then(json => {
        if (json.error) throw new Error(json.error);
        setLane(json.data);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="loading-spinner" style={{ margin: '2rem auto' }} />;
  if (error) return <div className="vn-alert vn-alert-error" style={{ margin: '2rem' }}>{error}</div>;
  if (!lane) return <div className="vn-alert vn-alert-error" style={{ margin: '2rem' }}>Lane not found</div>;

  const origin = lane.origin || {};
  const destination = lane.destination || {};
  const carriers = lane.laneCarriers || [];
  const stops = lane.stops || [];
  const route = lane.route || null;
  const laneName = lane.name || `${origin.city || '?'}, ${origin.state || '?'} → ${destination.city || '?'}, ${destination.state || '?'}`;

  // Build LatLng for origin/destination for read-only map
  const originLatLng = origin.lat && origin.lng ? { lat: origin.lat, lng: origin.lng } : null;
  const destLatLng = destination.lat && destination.lng ? { lat: destination.lat, lng: destination.lng } : null;
  const stopLatLngs = stops
    .filter((s: any) => s.location?.lat && s.location?.lng)
    .map((s: any) => ({ lat: s.location.lat, lng: s.location.lng }));

  return (
    <>
      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <button className="vn-btn vn-btn-ghost vn-btn-sm" onClick={() => navigate('/lanes')}>
          <span className="material-icons">arrow_back</span>
          Lanes
        </button>
        <span style={{ color: 'var(--on-surface-variant)', fontSize: 13 }}>/ {laneName}</span>
      </div>

      {/* Page Header */}
      <div className="vn-page-header">
        <div>
          <h1>{laneName}</h1>
          <div className="vn-page-header-meta">
            <span className={`vn-chip vn-chip-${lane.status === 'active' ? 'success' : 'secondary'}`}>{lane.status || 'Unknown'}</span>
            {route && (
              <span className="vn-chip vn-chip-info">
                <span className="material-icons" style={{ fontSize: 14 }}>route</span>
                Route Planned
              </span>
            )}
          </div>
        </div>
        <div className="vn-page-actions">
          <button className="vn-btn vn-btn-outline vn-btn-sm" onClick={() => navigate(`/lanes/${id}/edit`)}>
            <span className="material-icons">edit</span>
            Edit
          </button>
          <button className="vn-btn vn-btn-outline vn-btn-sm">
            <span className="material-icons">archive</span>
            Archive
          </button>
        </div>
      </div>

      <div className="vn-detail-grid">
        {/* Main Area */}
        <div className="vn-detail-main">
          {/* Route Map */}
          <div className="vn-card" style={{ marginBottom: 24 }}>
            <div className="vn-card-header">
              <h2>
                <span className="material-icons" style={{ fontSize: 20, verticalAlign: 'middle', marginRight: 6 }}>map</span>
                {route ? 'Planned Route' : 'Lane Route'}
              </h2>
              {!route && (
                <button className="vn-btn vn-btn-outline vn-btn-sm" onClick={() => navigate(`/lanes/${id}/edit`)}>
                  <span className="material-icons">add</span>
                  Plan Route
                </button>
              )}
            </div>
            <div className="vn-card-body">
              {route ? (
                <>
                  <GoogleMapsRouteEditor
                    origin={originLatLng}
                    destination={destLatLng}
                    stops={stopLatLngs}
                    existingPolyline={route.encodedPolyline}
                    corridorMeters={route.corridorMeters}
                    height={350}
                    editable={false}
                  />

                  {/* Route details */}
                  <div style={{ display: 'flex', gap: 24, marginTop: 16, flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--on-surface)' }}>
                      <span className="material-icons" style={{ fontSize: 16, color: 'var(--primary)' }}>straighten</span>
                      <strong>{(route.distanceMeters / 1609.34).toFixed(1)} mi</strong>
                      <span style={{ color: 'var(--on-surface-variant)' }}>({(route.distanceMeters / 1000).toFixed(1)} km)</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--on-surface)' }}>
                      <span className="material-icons" style={{ fontSize: 16, color: 'var(--primary)' }}>schedule</span>
                      <strong>{Math.floor(route.durationSeconds / 3600)}h {Math.round((route.durationSeconds % 3600) / 60)}m</strong>
                    </div>
                    {route.summary && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--on-surface-variant)' }}>
                        <span className="material-icons" style={{ fontSize: 16 }}>directions</span>
                        via {route.summary}
                      </div>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--on-surface-variant)' }}>
                      <span className="material-icons" style={{ fontSize: 16 }}>radar</span>
                      Deviation corridor: {(route.corridorMeters / 1000).toFixed(1)} km
                    </div>
                  </div>
                </>
              ) : (
                <div style={{
                  height: 200,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'var(--surface-container)',
                  border: '1px solid var(--outline-variant)',
                  borderRadius: 'var(--border-radius)',
                }}>
                  <div style={{ textAlign: 'center', color: 'var(--on-surface-variant)' }}>
                    <span className="material-icons" style={{ fontSize: 48, opacity: 0.4 }}>map</span>
                    <div style={{ fontSize: 14, marginTop: 8 }}>No planned route configured</div>
                    <div style={{ fontSize: 12, marginTop: 4 }}>Edit this lane to plan a route for deviation alerts</div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Carriers */}
          <div className="vn-card" style={{ marginBottom: 24 }}>
            <div className="vn-card-header">
              <h2>Carriers</h2>
              <button className="vn-btn vn-btn-outline vn-btn-sm">
                <span className="material-icons">add</span>
                Add Carrier
              </button>
            </div>
            <div className="vn-card-body vn-card-flush">
              <div className="vn-table-wrap">
                <table className="vn-table">
                  <thead>
                    <tr>
                      <th>Carrier</th>
                      <th>Price</th>
                      <th>Service Level</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {carriers.length === 0 && (
                      <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--on-surface-variant)', padding: 24 }}>No carriers assigned</td></tr>
                    )}
                    {carriers.map((c: any, i: number) => (
                      <tr key={i}>
                        <td><span style={{ fontWeight: 500 }}>{c.carrier?.name || '-'}{c.carrier?.mcNumber ? ` (${c.carrier.mcNumber})` : ''}</span></td>
                        <td>{c.price != null ? `${c.currency || '$'}${c.price}` : '-'}</td>
                        <td>{c.serviceLevel || '-'}</td>
                        <td>
                          {c.assigned
                            ? <span className="vn-chip vn-chip-success">Assigned</span>
                            : <span className="vn-chip vn-chip-secondary">Available</span>
                          }
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Recent Shipments */}
          <div className="vn-card">
            <div className="vn-card-header">
              <h2>Recent Shipments</h2>
              <button className="vn-btn vn-btn-ghost vn-btn-sm">
                View All
                <span className="material-icons">arrow_forward</span>
              </button>
            </div>
            <div className="vn-card-body vn-card-flush">
              <div className="vn-table-wrap">
                <table className="vn-table">
                  <thead>
                    <tr>
                      <th>Reference</th>
                      <th>Status</th>
                      <th>Pickup Date</th>
                      <th>Delivery Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td colSpan={4} style={{ textAlign: 'center', color: 'var(--on-surface-variant)', padding: 24 }}>
                        {lane._count?.shipments != null ? `${lane._count.shipments} shipment(s) on this lane` : 'No shipment data available'}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="vn-detail-sidebar">
          {/* Lane Info */}
          <div className="vn-card">
            <div className="vn-card-header"><h2>Lane Info</h2></div>
            <div className="vn-card-body">
              <div className="vn-info-grid">
                <div className="vn-info-item"><label>Distance</label><span>{lane.distance ? `${lane.distance} miles` : '-'}</span></div>
                <div className="vn-info-item"><label>Status</label><span>{lane.status || '-'}</span></div>
                <div className="vn-info-item"><label>Service Level</label><span>{lane.serviceLevel || '-'}</span></div>
                <div className="vn-info-item"><label>Notes</label><span>{lane.notes || '-'}</span></div>
              </div>
            </div>
          </div>

          {/* Route Deviation Alerts */}
          {route && (
            <div className="vn-card">
              <div className="vn-card-header"><h2>Route Deviation</h2></div>
              <div className="vn-card-body">
                <div className="vn-info-grid">
                  <div className="vn-info-item">
                    <label>Status</label>
                    <span className="vn-chip vn-chip-success" style={{ fontSize: 11 }}>Active</span>
                  </div>
                  <div className="vn-info-item">
                    <label>Corridor</label>
                    <span>{(route.corridorMeters / 1000).toFixed(1)} km</span>
                  </div>
                  <div className="vn-info-item">
                    <label>Provider</label>
                    <span style={{ textTransform: 'capitalize' }}>{route.provider || 'Google'}</span>
                  </div>
                </div>
                <p style={{ fontSize: 12, color: 'var(--on-surface-variant)', marginTop: 12 }}>
                  In-transit shipments on this lane will be monitored for route deviations beyond {(route.corridorMeters / 1000).toFixed(1)} km from the planned route.
                </p>
              </div>
            </div>
          )}

          {/* Origin */}
          <div className="vn-card">
            <div className="vn-card-body">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <span className="vn-route-dot origin" />
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--on-surface)' }}>Origin</span>
              </div>
              <div className="vn-info-item" style={{ marginBottom: 8 }}>
                <label>Facility</label><span>{origin.name || '-'}</span>
              </div>
              <div className="vn-info-item">
                <label>Address</label><span>{[origin.city, origin.state].filter(Boolean).join(', ') || '-'}</span>
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
                <label>Facility</label><span>{destination.name || '-'}</span>
              </div>
              <div className="vn-info-item">
                <label>Address</label><span>{[destination.city, destination.state].filter(Boolean).join(', ') || '-'}</span>
              </div>
            </div>
          </div>

          {/* Stops */}
          <div className="vn-card">
            <div className="vn-card-header"><h2>Stops</h2></div>
            <div className="vn-card-body">
              {stops.length === 0 && <p style={{ color: 'var(--on-surface-variant)', fontSize: 13 }}>No intermediate stops.</p>}
              {stops.map((stop: any, i: number) => (
                <div key={stop.id || i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: i < stops.length - 1 ? 12 : 0 }}>
                  <div style={{
                    width: 24, height: 24, borderRadius: '50%',
                    background: 'var(--warning)', color: 'var(--on-warning, #fff)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, fontWeight: 700, flexShrink: 0,
                  }}>{i + 1}</div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--on-surface)' }}>{stop.location?.name || stop.name || `Stop ${i + 1}`}</div>
                    <div style={{ fontSize: 12, color: 'var(--on-surface-variant)', marginTop: 2 }}>{stop.location?.city || stop.city || ''}{stop.location?.state || stop.state ? `, ${stop.location?.state || stop.state}` : ''}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
