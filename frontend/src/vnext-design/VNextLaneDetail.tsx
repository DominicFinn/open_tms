import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { API_URL } from '../api';

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
  const laneName = lane.name || `${origin.city || '?'}, ${origin.state || '?'} → ${destination.city || '?'}, ${destination.state || '?'}`;

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
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <h1>{laneName}</h1>
          <span className={`vn-chip vn-chip-${lane.status === 'active' ? 'success' : 'secondary'}`}>{lane.status || 'Unknown'}</span>
        </div>
        <div className="vn-page-actions">
          <button className="vn-btn vn-btn-outline vn-btn-sm">
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
          {/* Map Placeholder */}
          <div className="vn-map tall" style={{
            marginBottom: 24,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--surface-container)',
            border: '1px solid var(--outline-variant)',
            borderRadius: 'var(--border-radius)',
          }}>
            <div style={{ textAlign: 'center', color: 'var(--on-surface-variant)' }}>
              <span className="material-icons" style={{ fontSize: 48, opacity: 0.4 }}>map</span>
              <div style={{ fontSize: 14, marginTop: 8 }}>Lane Route: {laneName}</div>
              <div style={{ fontSize: 12, marginTop: 4 }}>{lane.distance ? `${lane.distance} miles` : ''}</div>
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
                        <td><span style={{ fontWeight: 500 }}>{c.carrier?.name || '—'}{c.carrier?.mcNumber ? ` (${c.carrier.mcNumber})` : ''}</span></td>
                        <td>{c.price != null ? `${c.currency || '$'}${c.price}` : '—'}</td>
                        <td>{c.serviceLevel || '—'}</td>
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
                <div className="vn-info-item"><label>Distance</label><span>{lane.distance ? `${lane.distance} miles` : '—'}</span></div>
                <div className="vn-info-item"><label>Status</label><span>{lane.status || '—'}</span></div>
                <div className="vn-info-item"><label>Service Level</label><span>{lane.serviceLevel || '—'}</span></div>
                <div className="vn-info-item"><label>Notes</label><span>{lane.notes || '—'}</span></div>
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
              <div className="vn-info-item">
                <label>Address</label><span>{[origin.city, origin.state].filter(Boolean).join(', ') || '—'}</span>
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
              <div className="vn-info-item">
                <label>Address</label><span>{[destination.city, destination.state].filter(Boolean).join(', ') || '—'}</span>
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
