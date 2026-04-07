import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import L from 'leaflet';

const EVENTS = [
  { time: 'Apr 7, 2:45 PM', title: 'Position Update', desc: 'Truck near Oklahoma City, OK — 265 mi remaining', location: 'Oklahoma City, OK', dot: 'info', lat: 35.47, lng: -97.52 },
  { time: 'Apr 7, 10:20 AM', title: 'Position Update', desc: 'Truck near Springfield, MO', location: 'Springfield, MO', dot: 'info', lat: 37.21, lng: -93.29 },
  { time: 'Apr 7, 6:00 AM', title: 'Departed Facility', desc: 'Left consolidation yard in St. Louis', location: 'St. Louis, MO', dot: 'primary', lat: 38.63, lng: -90.20 },
  { time: 'Apr 6, 8:30 PM', title: 'Arrived at Stop', desc: 'Consolidation stop — 2 pallets added', location: 'St. Louis, MO', dot: 'warning', lat: 38.63, lng: -90.20 },
  { time: 'Apr 6, 3:15 PM', title: 'Picked Up', desc: 'Loaded 24 pallets — driver signed BOL', location: 'Chicago, IL', dot: 'success', lat: 41.88, lng: -87.63 },
  { time: 'Apr 6, 1:00 PM', title: 'Driver Arrived at Pickup', desc: 'Driver checked in at dock 12', location: 'Chicago, IL', dot: 'info', lat: 41.88, lng: -87.63 },
  { time: 'Apr 6, 9:00 AM', title: 'Dispatched', desc: 'Carrier confirmed — driver assigned: Mike R.', location: '', dot: 'primary', lat: 0, lng: 0 },
  { time: 'Apr 5, 4:30 PM', title: 'Booked', desc: 'Tender accepted by Swift Transport @ $2,850', location: '', dot: 'success', lat: 0, lng: 0 },
];

const ROUTE_COORDS: [number, number][] = [
  [41.88, -87.63], // Chicago
  [38.63, -90.20], // St Louis
  [37.21, -93.29], // Springfield
  [35.47, -97.52], // OKC
  [32.78, -96.80], // Dallas
];

export default function VNextShipmentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const mapRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState('events');

  useEffect(() => {
    if (!mapRef.current) return;
    const map = L.map(mapRef.current, { zoomControl: true, attributionControl: false }).setView([37.5, -93], 5);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', { maxZoom: 19 }).addTo(map);

    // Route line
    L.polyline(ROUTE_COORDS, { color: '#2196F3', weight: 3, opacity: 0.7, dashArray: '8 4' }).addTo(map);

    // Traveled portion
    const traveled = ROUTE_COORDS.slice(0, 4);
    L.polyline(traveled, { color: '#4CAF50', weight: 4 }).addTo(map);

    // Origin marker
    const originIcon = L.divIcon({
      className: '',
      html: `<div style="width:20px;height:20px;border-radius:50%;background:#4CAF50;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;"><div style="width:6px;height:6px;border-radius:50%;background:white;"></div></div>`,
      iconSize: [20, 20], iconAnchor: [10, 10],
    });
    L.marker(ROUTE_COORDS[0], { icon: originIcon }).addTo(map).bindPopup('<strong>Origin</strong><br/>Chicago, IL');

    // Destination marker
    const destIcon = L.divIcon({
      className: '',
      html: `<div style="width:20px;height:20px;border-radius:50%;background:#F44336;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;"><div style="width:6px;height:6px;border-radius:50%;background:white;"></div></div>`,
      iconSize: [20, 20], iconAnchor: [10, 10],
    });
    L.marker(ROUTE_COORDS[ROUTE_COORDS.length - 1], { icon: destIcon }).addTo(map).bindPopup('<strong>Destination</strong><br/>Dallas, TX');

    // Stop marker
    const stopIcon = L.divIcon({
      className: '',
      html: `<div style="width:16px;height:16px;border-radius:50%;background:#FF9800;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);"></div>`,
      iconSize: [16, 16], iconAnchor: [8, 8],
    });
    L.marker(ROUTE_COORDS[1], { icon: stopIcon }).addTo(map).bindPopup('<strong>Stop</strong><br/>St. Louis, MO');

    // Current position (animated)
    const currentIcon = L.divIcon({
      className: '',
      html: `<div style="position:relative;"><div style="width:18px;height:18px;border-radius:50%;background:#2196F3;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);"></div><div style="position:absolute;top:-3px;left:-3px;width:24px;height:24px;border-radius:50%;border:2px solid #2196F3;animation:vn-pulse 2s infinite;"></div></div>`,
      iconSize: [18, 18], iconAnchor: [9, 9],
    });
    L.marker(ROUTE_COORDS[3], { icon: currentIcon }).addTo(map).bindPopup('<strong>Current Position</strong><br/>Oklahoma City, OK<br/><em>265 mi to destination</em>');

    map.fitBounds(L.latLngBounds(ROUTE_COORDS).pad(0.1));

    return () => { map.remove(); };
  }, []);

  return (
    <>
      {/* Breadcrumb & Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <button className="vn-btn vn-btn-ghost vn-btn-sm" onClick={() => navigate('/vnext/shipments')}>
          <span className="material-icons">arrow_back</span>
          Shipments
        </button>
      </div>

      <div className="vn-page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <h1>{id || 'SHP-4821'}</h1>
          <span className="vn-chip vn-chip-info">
            <span className="vn-live-dot" style={{ width: 8, height: 8, marginRight: 2 }} />
            In Transit
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
      <div ref={mapRef} className="vn-map tall" style={{ marginBottom: 24 }} />

      {/* Route Progress */}
      <div className="vn-card" style={{ marginBottom: 24 }}>
        <div className="vn-card-body">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--on-surface)' }}>Chicago, IL → Dallas, TX</span>
            <span style={{ fontSize: 13, color: 'var(--on-surface-variant)' }}>632 mi total · 265 mi remaining · ETA Apr 8 10:00 AM</span>
          </div>
          <div className="vn-progress" style={{ height: 8 }}>
            <div className="vn-progress-bar success" style={{ width: '58%' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span className="vn-route-dot origin" />
              <span style={{ fontSize: 12, color: 'var(--on-surface-variant)' }}>Chicago, IL — Picked up Apr 6 3:15 PM</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 12, color: 'var(--on-surface-variant)' }}>Dallas, TX — ETA Apr 8 10:00 AM</span>
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
                  {EVENTS.map((ev, i) => (
                    <div className="vn-timeline-item" key={i}>
                      <div className={`vn-timeline-dot ${ev.dot}`} />
                      <div className="vn-timeline-time">{ev.time}</div>
                      <div className="vn-timeline-title">{ev.title}</div>
                      <div className="vn-timeline-desc">{ev.desc}</div>
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
                <div className="vn-info-item"><label>Customer</label><span>Acme Corp</span></div>
                <div className="vn-info-item"><label>Carrier</label><span>Swift Transport</span></div>
                <div className="vn-info-item"><label>Driver</label><span>Mike R. · (555) 123-4567</span></div>
                <div className="vn-info-item"><label>Equipment</label><span>53' Dry Van</span></div>
                <div className="vn-info-item"><label>Mode</label><span>FTL</span></div>
                <div className="vn-info-item"><label>Weight</label><span>42,000 lbs (24 pallets)</span></div>
                <div className="vn-info-item"><label>Commodity</label><span>General Merchandise</span></div>
                <div className="vn-info-item"><label>Reference</label><span>PO-2026-8841</span></div>
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
                <label>Facility</label><span>Acme Chicago Warehouse</span>
              </div>
              <div className="vn-info-item" style={{ marginBottom: 8 }}>
                <label>Address</label><span>1400 S Cicero Ave, Chicago, IL 60804</span>
              </div>
              <div className="vn-info-item">
                <label>Pickup Window</label><span>Apr 6, 1:00 PM – 5:00 PM</span>
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
                <label>Facility</label><span>Acme Dallas DC</span>
              </div>
              <div className="vn-info-item" style={{ marginBottom: 8 }}>
                <label>Address</label><span>2200 N Stemmons Fwy, Dallas, TX 75207</span>
              </div>
              <div className="vn-info-item">
                <label>Delivery Window</label><span>Apr 8, 8:00 AM – 12:00 PM</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
