import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import L from 'leaflet';

const SHIPMENTS = [
  { id: 'SHP-4821', customer: 'Acme Corp', origin: 'Chicago, IL', dest: 'Dallas, TX', carrier: 'Swift Transport', mode: 'FTL', status: 'In Transit', statusColor: 'info', pickup: 'Apr 6', delivery: 'Apr 8', weight: '42,000 lbs', lat: 37.5, lng: -95.7 },
  { id: 'SHP-4820', customer: 'Global Widgets', origin: 'Los Angeles, CA', dest: 'Phoenix, AZ', carrier: 'Desert Freight', mode: 'LTL', status: 'Delivered', statusColor: 'success', pickup: 'Apr 5', delivery: 'Apr 6', weight: '12,500 lbs', lat: 33.45, lng: -112.07 },
  { id: 'SHP-4819', customer: 'TechStart Inc', origin: 'Atlanta, GA', dest: 'Miami, FL', carrier: 'Southeast Express', mode: 'FTL', status: 'At Pickup', statusColor: 'warning', pickup: 'Apr 7', delivery: 'Apr 9', weight: '38,200 lbs', lat: 33.749, lng: -84.388 },
  { id: 'SHP-4818', customer: 'FreshFoods LLC', origin: 'New York, NY', dest: 'Boston, MA', carrier: 'NorthEast Carriers', mode: 'Reefer', status: 'Booked', statusColor: 'secondary', pickup: 'Apr 8', delivery: 'Apr 9', weight: '28,000 lbs', lat: 40.713, lng: -74.006 },
  { id: 'SHP-4817', customer: 'Industrial Co', origin: 'Denver, CO', dest: 'Salt Lake City, UT', carrier: 'Mountain Haul', mode: 'Flatbed', status: 'In Transit', statusColor: 'info', pickup: 'Apr 5', delivery: 'Apr 7', weight: '55,000 lbs', lat: 39.739, lng: -104.99 },
  { id: 'SHP-4816', customer: 'Acme Corp', origin: 'Seattle, WA', dest: 'Portland, OR', carrier: 'Pacific Lines', mode: 'LTL', status: 'In Transit', statusColor: 'info', pickup: 'Apr 6', delivery: 'Apr 7', weight: '8,200 lbs', lat: 47.606, lng: -122.332 },
  { id: 'SHP-4815', customer: 'RetailMax', origin: 'Houston, TX', dest: 'San Antonio, TX', carrier: 'Lone Star Freight', mode: 'FTL', status: 'Delivered', statusColor: 'success', pickup: 'Apr 4', delivery: 'Apr 5', weight: '33,500 lbs', lat: 29.76, lng: -95.37 },
  { id: 'SHP-4814', customer: 'BioPharm Inc', origin: 'Minneapolis, MN', dest: 'Milwaukee, WI', carrier: 'Midwest Transit', mode: 'Reefer', status: 'Issue', statusColor: 'error', pickup: 'Apr 5', delivery: 'Apr 6', weight: '15,000 lbs', lat: 44.978, lng: -93.265 },
  { id: 'SHP-4813', customer: 'AutoParts Plus', origin: 'Detroit, MI', dest: 'Columbus, OH', carrier: 'Great Lakes Haul', mode: 'FTL', status: 'In Transit', statusColor: 'info', pickup: 'Apr 6', delivery: 'Apr 7', weight: '44,000 lbs', lat: 42.331, lng: -83.046 },
  { id: 'SHP-4812', customer: 'FreshFoods LLC', origin: 'Nashville, TN', dest: 'Charlotte, NC', carrier: 'Southern Express', mode: 'FTL', status: 'Booked', statusColor: 'secondary', pickup: 'Apr 8', delivery: 'Apr 10', weight: '29,800 lbs', lat: 36.163, lng: -86.781 },
];

const statusCounts = {
  all: SHIPMENTS.length,
  transit: SHIPMENTS.filter(s => s.status === 'In Transit').length,
  delivered: SHIPMENTS.filter(s => s.status === 'Delivered').length,
  booked: SHIPMENTS.filter(s => s.status === 'Booked').length,
  issue: SHIPMENTS.filter(s => s.status === 'Issue').length,
};

export default function VNextShipments() {
  const navigate = useNavigate();
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [viewMode, setViewMode] = useState<'table' | 'map'>('table');

  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;
    const map = L.map(mapRef.current, { zoomControl: true, attributionControl: false }).setView([39.5, -98.5], 4);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
    }).addTo(map);

    SHIPMENTS.forEach(s => {
      const color = s.statusColor === 'info' ? '#2196F3' : s.statusColor === 'success' ? '#4CAF50' : s.statusColor === 'warning' ? '#FF9800' : s.statusColor === 'error' ? '#F44336' : '#9E9E9E';
      const icon = L.divIcon({
        className: '',
        html: `<div style="width:14px;height:14px;border-radius:50%;background:${color};border:3px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.3);"></div>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      });
      L.marker([s.lat, s.lng], { icon }).addTo(map)
        .bindPopup(`<strong>${s.id}</strong><br/>${s.origin} → ${s.dest}<br/><em>${s.status}</em>`);
    });

    mapInstance.current = map;
    return () => { map.remove(); mapInstance.current = null; };
  }, []);

  // Resize map when switching to map view
  useEffect(() => {
    if (viewMode === 'map' && mapInstance.current) {
      setTimeout(() => mapInstance.current?.invalidateSize(), 100);
    }
  }, [viewMode]);

  const filtered = SHIPMENTS.filter(s => {
    if (statusFilter === 'transit' && s.status !== 'In Transit') return false;
    if (statusFilter === 'delivered' && s.status !== 'Delivered') return false;
    if (statusFilter === 'booked' && s.status !== 'Booked') return false;
    if (statusFilter === 'issue' && s.status !== 'Issue') return false;
    if (search) {
      const q = search.toLowerCase();
      return s.id.toLowerCase().includes(q) || s.customer.toLowerCase().includes(q) || s.origin.toLowerCase().includes(q) || s.dest.toLowerCase().includes(q) || s.carrier.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <>
      <div className="vn-page-header">
        <div>
          <h1>Shipments</h1>
          <p>{SHIPMENTS.length} total shipments</p>
        </div>
        <div className="vn-page-actions">
          <button className="vn-btn vn-btn-outline">
            <span className="material-icons">download</span>
            Export
          </button>
          <button className="vn-btn vn-btn-primary">
            <span className="material-icons">add</span>
            New Shipment
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="vn-stats">
        <div className="vn-stat" style={{ cursor: 'pointer' }} onClick={() => setStatusFilter('transit')}>
          <div className="vn-stat-icon info"><span className="material-icons">local_shipping</span></div>
          <div>
            <div className="vn-stat-value">{statusCounts.transit}</div>
            <div className="vn-stat-label">In Transit</div>
          </div>
        </div>
        <div className="vn-stat" style={{ cursor: 'pointer' }} onClick={() => setStatusFilter('booked')}>
          <div className="vn-stat-icon primary"><span className="material-icons">event_available</span></div>
          <div>
            <div className="vn-stat-value">{statusCounts.booked}</div>
            <div className="vn-stat-label">Booked</div>
          </div>
        </div>
        <div className="vn-stat" style={{ cursor: 'pointer' }} onClick={() => setStatusFilter('delivered')}>
          <div className="vn-stat-icon success"><span className="material-icons">check_circle</span></div>
          <div>
            <div className="vn-stat-value">{statusCounts.delivered}</div>
            <div className="vn-stat-label">Delivered</div>
          </div>
        </div>
        <div className="vn-stat" style={{ cursor: 'pointer' }} onClick={() => setStatusFilter('issue')}>
          <div className="vn-stat-icon error"><span className="material-icons">warning</span></div>
          <div>
            <div className="vn-stat-value">{statusCounts.issue}</div>
            <div className="vn-stat-label">Issues</div>
          </div>
        </div>
      </div>

      {/* Map (always mounted, hidden when not active for performance) */}
      <div style={{ display: viewMode === 'map' ? 'block' : 'none', marginBottom: 24 }}>
        <div ref={mapRef} className="vn-map full" />
      </div>

      {/* Shipments Table Card */}
      <div className="vn-card">
        <div className="vn-filters">
          <div className="vn-filter-group" style={{ flex: 1 }}>
            <span className="material-icons">search</span>
            <input
              className="vn-filter-input"
              placeholder="Search by ID, customer, origin, destination, carrier..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ width: '100%' }}
            />
          </div>
          <select className="vn-filter-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="all">All Statuses ({statusCounts.all})</option>
            <option value="transit">In Transit ({statusCounts.transit})</option>
            <option value="booked">Booked ({statusCounts.booked})</option>
            <option value="delivered">Delivered ({statusCounts.delivered})</option>
            <option value="issue">Issue ({statusCounts.issue})</option>
          </select>
          <select className="vn-filter-select">
            <option>All Modes</option>
            <option>FTL</option>
            <option>LTL</option>
            <option>Reefer</option>
            <option>Flatbed</option>
          </select>
          <div style={{ display: 'flex', border: '1px solid var(--outline-variant)', borderRadius: 'var(--border-radius-sm)', overflow: 'hidden' }}>
            <button
              className="vn-btn-icon"
              style={{ borderRadius: 0, background: viewMode === 'table' ? 'var(--surface-container)' : 'transparent' }}
              onClick={() => setViewMode('table')}
            >
              <span className="material-icons" style={{ fontSize: 20 }}>view_list</span>
            </button>
            <button
              className="vn-btn-icon"
              style={{ borderRadius: 0, background: viewMode === 'map' ? 'var(--surface-container)' : 'transparent' }}
              onClick={() => setViewMode('map')}
            >
              <span className="material-icons" style={{ fontSize: 20 }}>map</span>
            </button>
          </div>
        </div>

        <div className="vn-table-wrap">
          <table className="vn-table">
            <thead>
              <tr>
                <th>Shipment</th>
                <th>Customer</th>
                <th>Route</th>
                <th>Carrier</th>
                <th>Mode</th>
                <th>Pickup</th>
                <th>Delivery</th>
                <th>Weight</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(s => (
                <tr key={s.id} onClick={() => navigate(`/vnext/shipments/${s.id}`)}>
                  <td><span className="vn-table-id">{s.id}</span></td>
                  <td>{s.customer}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span className="vn-route-dot origin" style={{ width: 8, height: 8 }} />
                      <span style={{ fontSize: 13 }}>{s.origin}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                      <span className="vn-route-dot destination" style={{ width: 8, height: 8 }} />
                      <span style={{ fontSize: 12, color: 'var(--on-surface-variant)' }}>{s.dest}</span>
                    </div>
                  </td>
                  <td style={{ fontSize: 13 }}>{s.carrier}</td>
                  <td><span className="vn-chip vn-chip-secondary">{s.mode}</span></td>
                  <td style={{ fontSize: 13, whiteSpace: 'nowrap' }}>{s.pickup}</td>
                  <td style={{ fontSize: 13, whiteSpace: 'nowrap' }}>{s.delivery}</td>
                  <td style={{ fontSize: 13 }}>{s.weight}</td>
                  <td><span className={`vn-chip vn-chip-${s.statusColor}`}>{s.status}</span></td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={9}>
                    <div className="vn-empty">
                      <span className="material-icons">search_off</span>
                      <h3>No shipments found</h3>
                      <p>Try adjusting your search or filters</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
