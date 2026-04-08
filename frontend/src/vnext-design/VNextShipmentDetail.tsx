import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import L from 'leaflet';
import { API_URL } from '../api';

export default function VNextShipmentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const mapRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState('events');
  const [shipment, setShipment] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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
                <button className="vn-btn vn-btn-outline vn-btn-sm">
                  <span className="material-icons">upload_file</span>
                  Upload
                </button>
              </div>
              <div className="vn-card-body vn-card-flush">
                <div className="vn-table-wrap">
                  <table className="vn-table">
                    <thead><tr><th>Document</th><th>Type</th><th>Uploaded</th><th>Actions</th></tr></thead>
                    <tbody>
                      {[
                        { name: 'BOL-SHP4821.pdf', type: 'Bill of Lading', date: 'Apr 6, 2026' },
                        { name: 'Rate Confirmation.pdf', type: 'Rate Con', date: 'Apr 5, 2026' },
                        { name: 'POD-SHP4821.jpg', type: 'Proof of Delivery', date: 'Pending' },
                      ].map((doc, i) => (
                        <tr key={i}>
                          <td style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span className="material-icons" style={{ color: 'var(--error)', fontSize: 20 }}>picture_as_pdf</span>
                            <span style={{ fontWeight: 500 }}>{doc.name}</span>
                          </td>
                          <td>{doc.type}</td>
                          <td style={{ fontSize: 13 }}>{doc.date}</td>
                          <td>
                            <button className="vn-btn-icon"><span className="material-icons" style={{ fontSize: 18 }}>download</span></button>
                            <button className="vn-btn-icon"><span className="material-icons" style={{ fontSize: 18 }}>visibility</span></button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
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
