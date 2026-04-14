import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { API_URL } from '../api';
import { useOrgContext } from '../hooks/useOrgContext';

interface FinancialSummary {
  actualRevenueCents?: number;
  actualCostCents?: number;
  actualMarginCents?: number;
  expectedRevenueCents?: number;
  expectedCostCents?: number;
  expectedMarginCents?: number;
}

interface Shipment {
  id: string;
  reference?: string;
  status: string;
  pickupDate?: string;
  deliveryDate?: string;
  proNumber?: string;
  customer?: { name: string };
  origin?: { name: string; city: string; state: string; lat?: number; lng?: number };
  destination?: { name: string; city: string; state: string };
  lane?: { name: string };
  carrier?: { name: string };
  shipmentFinancialSummary?: FinancialSummary | null;
}

function statusColor(status: string): string {
  const s = status?.toLowerCase().replace(/[_ ]/g, '');
  if (s === 'intransit') return 'info';
  if (s === 'delivered') return 'success';
  if (s === 'booked' || s === 'atpickup') return 'warning';
  if (s === 'issue' || s === 'exception') return 'error';
  return 'secondary';
}

function formatDate(d?: string): string {
  if (!d) return '-';
  const date = new Date(d);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatCents(cents?: number | null): string {
  if (cents == null) return '-';
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function marginColor(marginCents?: number | null, revenueCents?: number | null): string {
  if (marginCents == null || revenueCents == null || revenueCents === 0) return 'var(--on-surface-variant)';
  const pct = (marginCents / revenueCents) * 100;
  if (pct >= 15) return 'var(--color-success)';
  if (pct >= 5) return 'var(--color-warning)';
  return 'var(--color-error)';
}

function marginPercent(marginCents?: number | null, revenueCents?: number | null): string {
  if (marginCents == null || revenueCents == null || revenueCents === 0) return '-';
  return `${((marginCents / revenueCents) * 100).toFixed(1)}%`;
}

export default function VNextShipments() {
  const navigate = useNavigate();
  const { isBroker } = useOrgContext();
  const [showFinancials, setShowFinancials] = useState(isBroker);
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [viewMode, setViewMode] = useState<'table' | 'map'>('table');
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Fetch shipments from API
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const res = await fetch(`${API_URL}/api/v1/shipments`);
        if (!res.ok) throw new Error(`Failed to load shipments (${res.status})`);
        const json = await res.json();
        if (!cancelled) {
          setShipments(json.data || []);
          setError('');
        }
      } catch (err: any) {
        if (!cancelled) setError(err.message || 'Failed to load shipments');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const statusCounts = {
    all: shipments.length,
    transit: shipments.filter(s => s.status?.toLowerCase().replace(/[_ ]/g, '') === 'intransit').length,
    delivered: shipments.filter(s => s.status?.toLowerCase() === 'delivered').length,
    booked: shipments.filter(s => s.status?.toLowerCase() === 'booked').length,
    issue: shipments.filter(s => ['issue', 'exception'].includes(s.status?.toLowerCase())).length,
  };

  // Initialize map
  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;
    const map = L.map(mapRef.current, { zoomControl: true, attributionControl: false }).setView([39.5, -98.5], 4);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
    }).addTo(map);
    markersRef.current = L.layerGroup().addTo(map);
    mapInstance.current = map;
    setTimeout(() => map.invalidateSize(), 100);
    return () => { map.remove(); mapInstance.current = null; markersRef.current = null; };
  }, []);

  // Update map markers when shipments change
  useEffect(() => {
    if (!markersRef.current) return;
    markersRef.current.clearLayers();
    shipments.forEach(s => {
      const lat = s.origin?.lat;
      const lng = s.origin?.lng;
      if (lat == null || lng == null) return;
      const cs = getComputedStyle(document.documentElement);
      const sc = statusColor(s.status);
      const colorMap: Record<string, string> = {
        info: cs.getPropertyValue('--marker-default').trim(),
        success: cs.getPropertyValue('--marker-origin').trim(),
        warning: cs.getPropertyValue('--marker-stop').trim(),
        error: cs.getPropertyValue('--marker-destination').trim(),
      };
      const color = colorMap[sc] || cs.getPropertyValue('--outline-variant').trim();
      const icon = L.divIcon({
        className: '',
        html: `<div style="width:14px;height:14px;border-radius:50%;background:${color};border:3px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.3);"></div>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      });
      const originLabel = s.origin ? `${s.origin.city}, ${s.origin.state}` : '';
      const destLabel = s.destination ? `${s.destination.city}, ${s.destination.state}` : '';
      L.marker([lat, lng], { icon }).addTo(markersRef.current!)
        .bindPopup(`<strong>${s.reference || s.id}</strong><br/>${originLabel} → ${destLabel}<br/><em>${s.status}</em>`);
    });
  }, [shipments]);

  // Resize map when switching to map view
  useEffect(() => {
    if (viewMode === 'map' && mapInstance.current) {
      setTimeout(() => mapInstance.current?.invalidateSize(), 100);
    }
  }, [viewMode]);

  const filtered = shipments.filter(s => {
    const sNorm = s.status?.toLowerCase().replace(/[_ ]/g, '');
    if (statusFilter === 'transit' && sNorm !== 'intransit') return false;
    if (statusFilter === 'delivered' && sNorm !== 'delivered') return false;
    if (statusFilter === 'booked' && sNorm !== 'booked') return false;
    if (statusFilter === 'issue' && !['issue', 'exception'].includes(s.status?.toLowerCase())) return false;
    if (search) {
      const q = search.toLowerCase();
      const customerName = s.customer?.name?.toLowerCase() || '';
      const originLabel = s.origin ? `${s.origin.city}, ${s.origin.state}`.toLowerCase() : '';
      const destLabel = s.destination ? `${s.destination.city}, ${s.destination.state}`.toLowerCase() : '';
      const carrierName = s.carrier?.name?.toLowerCase() || '';
      const ref = (s.reference || s.id || '').toLowerCase();
      return ref.includes(q) || customerName.includes(q) || originLabel.includes(q) || destLabel.includes(q) || carrierName.includes(q);
    }
    return true;
  });

  if (loading) {
    return (
      <div className="vn-empty"><span className="material-icons" style={{animation:'spin 1s linear infinite'}}>refresh</span><h3>Loading...</h3></div>
    );
  }

  if (error) {
    return (
      <div className="vn-alert vn-alert-error"><span className="material-icons">error</span><div className="vn-alert-content">{error}</div></div>
    );
  }

  return (
    <>
      <div className="vn-page-header">
        <div>
          <h1>Shipments</h1>
          <p>{shipments.length} total shipments</p>
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
          <button
            className={`vn-btn vn-btn-sm ${showFinancials ? 'vn-btn-primary' : 'vn-btn-outline'}`}
            onClick={() => setShowFinancials(!showFinancials)}
            title="Toggle financial columns"
            style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13 }}
          >
            <span className="material-icons" style={{ fontSize: 16 }}>attach_money</span>
            Margin
          </button>
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
                <th>Lane</th>
                <th>Pickup</th>
                <th>Delivery</th>
                <th>PRO #</th>
                {showFinancials && <th style={{ textAlign: 'right' }}>Revenue</th>}
                {showFinancials && <th style={{ textAlign: 'right' }}>Cost</th>}
                {showFinancials && <th style={{ textAlign: 'right' }}>Margin</th>}
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(s => (
                <tr key={s.id} onClick={() => navigate(`/shipments/${s.id}`)}>
                  <td><span className="vn-table-id">{s.reference || s.id}</span></td>
                  <td>{s.customer?.name || '—'}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span className="vn-route-dot origin" style={{ width: 8, height: 8 }} />
                      <span style={{ fontSize: 13 }}>{s.origin ? `${s.origin.city}, ${s.origin.state}` : '—'}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                      <span className="vn-route-dot destination" style={{ width: 8, height: 8 }} />
                      <span style={{ fontSize: 12, color: 'var(--on-surface-variant)' }}>{s.destination ? `${s.destination.city}, ${s.destination.state}` : '—'}</span>
                    </div>
                  </td>
                  <td style={{ fontSize: 13 }}>{s.carrier?.name || '—'}</td>
                  <td>{s.lane ? <span className="vn-chip vn-chip-secondary">{s.lane.name}</span> : '—'}</td>
                  <td style={{ fontSize: 13, whiteSpace: 'nowrap' }}>{formatDate(s.pickupDate)}</td>
                  <td style={{ fontSize: 13, whiteSpace: 'nowrap' }}>{formatDate(s.deliveryDate)}</td>
                  <td style={{ fontSize: 13 }}>{s.proNumber || '-'}</td>
                  {showFinancials && (
                    <td style={{ fontSize: 13, textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {formatCents(s.shipmentFinancialSummary?.actualRevenueCents ?? s.shipmentFinancialSummary?.expectedRevenueCents)}
                    </td>
                  )}
                  {showFinancials && (
                    <td style={{ fontSize: 13, textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {formatCents(s.shipmentFinancialSummary?.actualCostCents ?? s.shipmentFinancialSummary?.expectedCostCents)}
                    </td>
                  )}
                  {showFinancials && (() => {
                    const fin = s.shipmentFinancialSummary;
                    const margin = fin?.actualMarginCents ?? fin?.expectedMarginCents;
                    const revenue = fin?.actualRevenueCents ?? fin?.expectedRevenueCents;
                    return (
                      <td style={{ fontSize: 13, textAlign: 'right', whiteSpace: 'nowrap', fontWeight: 600, color: marginColor(margin, revenue) }}>
                        {formatCents(margin)} <span style={{ fontSize: 11, fontWeight: 400 }}>({marginPercent(margin, revenue)})</span>
                      </td>
                    );
                  })()}
                  <td><span className={`vn-chip vn-chip-${statusColor(s.status)}`}>{s.status}</span></td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={showFinancials ? 12 : 9}>
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
