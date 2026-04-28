import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { API_URL } from '../api';
import { VnFilterBar, VnDateRangeFilter } from './components';

interface Shipment {
  id: string;
  reference?: string;
  status: string;
  pickupDate?: string;
  deliveryDate?: string;
  proNumber?: string;
  shipmentTypeId?: string | null;
  customer?: { name: string };
  origin?: { name: string; city: string; state: string; lat?: number; lng?: number };
  destination?: { name: string; city: string; state: string };
  lane?: { name: string };
  carrier?: { name: string };
  createdAt?: string;
  updatedAt?: string;
}

interface ShipmentTypeSummary {
  id: string;
  name: string;
  icon: string;
  color: string;
}

type SortField = 'createdAt' | 'updatedAt' | 'pickupDate' | 'deliveryDate';
type SortOrder = 'asc' | 'desc';

function statusColor(status: string): string {
  const s = status?.toLowerCase().replace(/[_ ]/g, '');
  if (s === 'intransit') return 'info';
  if (s === 'delivered') return 'success';
  if (s === 'booked' || s === 'atpickup') return 'warning';
  if (s === 'issue' || s === 'exception') return 'error';
  if (s === 'draft') return 'secondary';
  return 'secondary';
}

function formatDate(d?: string): string {
  if (!d) return '-';
  const date = new Date(d);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatDateTime(d?: string): string {
  if (!d) return '-';
  const date = new Date(d);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function csvEscape(value: unknown): string {
  if (value == null) return '';
  const s = String(value);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function exportShipmentsCsv(rows: Shipment[]): void {
  const headers = [
    'Reference', 'Status', 'Customer', 'Origin', 'Destination', 'Carrier', 'Lane',
    'Pickup Date', 'Delivery Date', 'PRO #', 'Created', 'Updated',
  ];
  const lines = [headers.join(',')];
  for (const s of rows) {
    const row = [
      s.reference || s.id,
      s.status,
      s.customer?.name || '',
      s.origin ? `${s.origin.city}, ${s.origin.state}` : '',
      s.destination ? `${s.destination.city}, ${s.destination.state}` : '',
      s.carrier?.name || '',
      s.lane?.name || '',
      s.pickupDate || '',
      s.deliveryDate || '',
      s.proNumber || '',
      s.createdAt || '',
      s.updatedAt || '',
    ].map(csvEscape);
    lines.push(row.join(','));
  }
  const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const stamp = new Date().toISOString().slice(0, 10);
  const a = document.createElement('a');
  a.href = url;
  a.download = `shipments-${stamp}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function VNextShipments() {
  const navigate = useNavigate();
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [createdFrom, setCreatedFrom] = useState('');
  const [createdTo, setCreatedTo] = useState('');
  const [updatedFrom, setUpdatedFrom] = useState('');
  const [updatedTo, setUpdatedTo] = useState('');
  const [sortBy, setSortBy] = useState<SortField>('createdAt');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [viewMode, setViewMode] = useState<'table' | 'map'>('table');
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [shipmentTypes, setShipmentTypes] = useState<Record<string, ShipmentTypeSummary>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`${API_URL}/api/v1/shipment-types`)
      .then(r => r.json())
      .then(j => {
        const map: Record<string, ShipmentTypeSummary> = {};
        (j.data || []).forEach((t: ShipmentTypeSummary) => { map[t.id] = t; });
        setShipmentTypes(map);
      })
      .catch(() => {});
  }, []);

  // Fetch shipments from API with server-side date filters and sort
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const params = new URLSearchParams();
        if (createdFrom) params.set('createdFrom', createdFrom);
        if (createdTo) params.set('createdTo', `${createdTo}T23:59:59Z`);
        if (updatedFrom) params.set('updatedFrom', updatedFrom);
        if (updatedTo) params.set('updatedTo', `${updatedTo}T23:59:59Z`);
        params.set('sortBy', sortBy);
        params.set('sortOrder', sortOrder);
        const qs = params.toString();
        const res = await fetch(`${API_URL}/api/v1/shipments${qs ? `?${qs}` : ''}`);
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
  }, [createdFrom, createdTo, updatedFrom, updatedTo, sortBy, sortOrder]);

  const statusCounts = useMemo(() => ({
    all: shipments.length,
    draft: shipments.filter(s => s.status?.toLowerCase() === 'draft').length,
    transit: shipments.filter(s => s.status?.toLowerCase().replace(/[_ ]/g, '') === 'intransit').length,
    delivered: shipments.filter(s => s.status?.toLowerCase() === 'delivered').length,
    booked: shipments.filter(s => s.status?.toLowerCase() === 'booked').length,
    issue: shipments.filter(s => ['issue', 'exception'].includes(s.status?.toLowerCase())).length,
  }), [shipments]);

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
    if (statusFilter === 'draft' && s.status?.toLowerCase() !== 'draft') return false;
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

  const hasDateFilters = createdFrom || createdTo || updatedFrom || updatedTo;
  const clearDateFilters = () => {
    setCreatedFrom('');
    setCreatedTo('');
    setUpdatedFrom('');
    setUpdatedTo('');
  };

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
          <button className="vn-btn vn-btn-outline" onClick={() => exportShipmentsCsv(filtered)}>
            <span className="material-icons">download</span>
            Export
          </button>
          <button className="vn-btn vn-btn-primary" onClick={() => navigate('/shipments/create')}>
            <span className="material-icons">add</span>
            New Shipment
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="vn-stats">
        <div className="vn-stat" style={{ cursor: 'pointer' }} onClick={() => setStatusFilter('draft')}>
          <div className="vn-stat-icon"><span className="material-icons">edit_note</span></div>
          <div>
            <div className="vn-stat-value">{statusCounts.draft}</div>
            <div className="vn-stat-label">Draft</div>
          </div>
        </div>
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
        <VnFilterBar
          searchPlaceholder="Search by ID, customer, origin, destination, carrier..."
          searchValue={search}
          onSearchChange={setSearch}
        >
          <select
            className="vn-filter-select"
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
          >
            <option value="all">All Statuses ({statusCounts.all})</option>
            <option value="draft">Draft ({statusCounts.draft})</option>
            <option value="transit">In Transit ({statusCounts.transit})</option>
            <option value="booked">Booked ({statusCounts.booked})</option>
            <option value="delivered">Delivered ({statusCounts.delivered})</option>
            <option value="issue">Issue ({statusCounts.issue})</option>
          </select>
          <select
            className="vn-filter-select"
            value={sortBy}
            onChange={e => setSortBy(e.target.value as SortField)}
            title="Sort by"
          >
            <option value="createdAt">Sort: Created</option>
            <option value="updatedAt">Sort: Updated</option>
            <option value="pickupDate">Sort: Pickup</option>
            <option value="deliveryDate">Sort: Delivery</option>
          </select>
          <button
            type="button"
            className="vn-filter-btn"
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            title={sortOrder === 'asc' ? 'Ascending (oldest first)' : 'Descending (newest first)'}
          >
            <span className="material-icons">
              {sortOrder === 'asc' ? 'arrow_upward' : 'arrow_downward'}
            </span>
            {sortOrder === 'asc' ? 'Asc' : 'Desc'}
          </button>
          <div className="vn-filter-btn-group">
            <button
              type="button"
              className={`vn-filter-btn${viewMode === 'table' ? ' is-active' : ''}`}
              onClick={() => setViewMode('table')}
              title="Table view"
              aria-label="Table view"
            >
              <span className="material-icons">view_list</span>
            </button>
            <button
              type="button"
              className={`vn-filter-btn${viewMode === 'map' ? ' is-active' : ''}`}
              onClick={() => setViewMode('map')}
              title="Map view"
              aria-label="Map view"
            >
              <span className="material-icons">map</span>
            </button>
          </div>
        </VnFilterBar>

        <VnDateRangeFilter
          rows={[
            {
              iconName: 'event',
              label: 'Created',
              from: createdFrom,
              to: createdTo,
              onFromChange: setCreatedFrom,
              onToChange: setCreatedTo,
            },
            {
              iconName: 'update',
              label: 'Updated',
              from: updatedFrom,
              to: updatedTo,
              onFromChange: setUpdatedFrom,
              onToChange: setUpdatedTo,
            },
          ]}
          onClear={clearDateFilters}
          showClear={!!hasDateFilters}
        />

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
                <th>Created</th>
                <th>Updated</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(s => {
                const type = s.shipmentTypeId ? shipmentTypes[s.shipmentTypeId] : null;
                return (
                <tr key={s.id} onClick={() => navigate(`/shipments/${s.id}`)}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {type ? (
                        <span
                          className="material-icons"
                          style={{ color: type.color, fontSize: 20 }}
                          title={type.name}
                        >{type.icon}</span>
                      ) : (
                        <span style={{ width: 20, display: 'inline-block' }} />
                      )}
                      <span className="vn-table-id">{s.reference || s.id}</span>
                    </div>
                  </td>
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
                  <td style={{ fontSize: 13, whiteSpace: 'nowrap', color: 'var(--on-surface-variant)' }}>{formatDateTime(s.createdAt)}</td>
                  <td style={{ fontSize: 13, whiteSpace: 'nowrap', color: 'var(--on-surface-variant)' }}>{formatDateTime(s.updatedAt)}</td>
                  <td><span className={`vn-chip vn-chip-${statusColor(s.status)}`}>{s.status}</span></td>
                </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={11}>
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
