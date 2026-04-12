/**
 * VNextShipmentMap — full-page map view of shipments, orders, and trackable units.
 *
 * Uses Leaflet (OSM default, Google Maps if API key configured) with supercluster
 * for client-side point clustering. At zoomed-out levels, shipments aggregate into
 * cluster badges. Zooming in dissolves clusters into individual markers.
 *
 * Performance: supercluster uses a KD-tree spatial index that handles thousands
 * of points efficiently. The backend bbox API limits results to the current viewport.
 */

import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import Supercluster from 'supercluster';
import { API_URL } from '../api';
import { getLocationTypeMeta } from './locationTypesMeta';

// Fix for default markers in Leaflet with Vite
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

type EntityType = 'shipments' | 'orders' | 'units';

interface GeoFeature {
  type: 'Feature';
  geometry: { type: 'Point'; coordinates: [number, number] };
  properties: Record<string, any>;
}

interface IssueFeature {
  type: 'Feature';
  geometry: { type: 'Point'; coordinates: [number, number] };
  properties: Record<string, any>;
}

// Status → CSS variable mapping for markers
function getStatusColor(status: string): string {
  switch (status) {
    case 'in_transit':
    case 'dispatched':
      return 'var(--color-info)';
    case 'delivered':
    case 'completed':
      return 'var(--color-success)';
    case 'exception':
      return 'var(--color-error)';
    case 'draft':
    case 'pending':
      return 'var(--on-surface-variant)';
    default:
      return 'var(--marker-default)';
  }
}

function getStatusIcon(status: string): string {
  switch (status) {
    case 'in_transit':
    case 'dispatched':
      return 'local_shipping';
    case 'delivered':
    case 'completed':
      return 'check_circle';
    case 'exception':
      return 'error';
    case 'draft':
      return 'edit_note';
    default:
      return 'location_on';
  }
}

function getEntityIcon(entityType: EntityType): string {
  switch (entityType) {
    case 'shipments': return 'local_shipping';
    case 'orders': return 'receipt_long';
    case 'units': return 'inventory_2';
  }
}

// Build popup HTML for different entity types
function buildPopupHtml(entityType: EntityType, props: Record<string, any>): string {
  if (entityType === 'shipments') {
    const staleMinutes = props.lastLocationAt
      ? Math.round((Date.now() - new Date(props.lastLocationAt).getTime()) / 60_000)
      : null;
    const staleLabel = staleMinutes !== null
      ? staleMinutes < 5 ? 'Live' : staleMinutes < 60 ? `${staleMinutes}m ago` : `${Math.round(staleMinutes / 60)}h ago`
      : 'No GPS';

    return `
      <div style="min-width:220px;font-family:var(--font-family,Roboto,sans-serif)">
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">
          <span class="material-icons" style="font-size:18px;color:${getStatusColor(props.status)}">${getStatusIcon(props.status)}</span>
          <strong style="font-size:14px">${props.reference}</strong>
        </div>
        <div style="font-size:12px;color:var(--on-surface-variant);line-height:1.6">
          <div><strong>Status:</strong> ${props.status.replace(/_/g, ' ')}</div>
          ${props.customerName ? `<div><strong>Customer:</strong> ${props.customerName}</div>` : ''}
          ${props.carrierName ? `<div><strong>Carrier:</strong> ${props.carrierName}</div>` : ''}
          <div><strong>Origin:</strong> ${props.originName || ''}${props.originCity ? `, ${props.originCity}` : ''}</div>
          <div><strong>Dest:</strong> ${props.destinationName || ''}${props.destinationCity ? `, ${props.destinationCity}` : ''}</div>
          <div style="margin-top:4px;color:${staleMinutes !== null && staleMinutes < 60 ? 'var(--color-success)' : 'var(--on-surface-variant)'}">
            GPS: ${staleLabel}
          </div>
        </div>
        <a href="/shipments/${props.id}" style="display:inline-block;margin-top:8px;font-size:12px;color:var(--primary);text-decoration:none">
          View Details &rarr;
        </a>
      </div>
    `;
  }

  if (entityType === 'orders') {
    return `
      <div style="min-width:200px;font-family:var(--font-family,Roboto,sans-serif)">
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">
          <span class="material-icons" style="font-size:18px;color:var(--primary)">receipt_long</span>
          <strong style="font-size:14px">${props.reference}</strong>
        </div>
        <div style="font-size:12px;color:var(--on-surface-variant);line-height:1.6">
          <div><strong>Status:</strong> ${props.status}</div>
          <div><strong>Delivery:</strong> ${props.deliveryStatus || 'N/A'}</div>
          ${props.customerName ? `<div><strong>Customer:</strong> ${props.customerName}</div>` : ''}
          <div><strong>Origin:</strong> ${props.originName || ''}${props.originCity ? `, ${props.originCity}` : ''}</div>
          <div><strong>Dest:</strong> ${props.destinationName || ''}${props.destinationCity ? `, ${props.destinationCity}` : ''}</div>
        </div>
        <a href="/orders/${props.id}" style="display:inline-block;margin-top:8px;font-size:12px;color:var(--primary);text-decoration:none">
          View Details &rarr;
        </a>
      </div>
    `;
  }

  // units
  return `
    <div style="min-width:200px;font-family:var(--font-family,Roboto,sans-serif)">
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">
        <span class="material-icons" style="font-size:18px;color:var(--primary)">inventory_2</span>
        <strong style="font-size:14px">${props.reference}</strong>
      </div>
      <div style="font-size:12px;color:var(--on-surface-variant);line-height:1.6">
        <div><strong>Type:</strong> ${props.unitType}</div>
        <div><strong>Condition:</strong> ${props.condition || 'unknown'}</div>
        ${props.orderNumber ? `<div><strong>Order:</strong> ${props.orderNumber}</div>` : ''}
        ${props.shipmentReference ? `<div><strong>Shipment:</strong> ${props.shipmentReference}</div>` : ''}
        <div><strong>Last scan:</strong> ${props.lastScanType} (${props.lastScannedAt ? new Date(props.lastScannedAt).toLocaleString() : 'N/A'})</div>
      </div>
    </div>
  `;
}

function getPriorityColor(priority: string): string {
  switch (priority) {
    case 'critical': return 'var(--color-error)';
    case 'high': return 'var(--color-warning)';
    case 'medium': return 'var(--color-info)';
    default: return 'var(--on-surface-variant)';
  }
}

function buildIssuePopupHtml(props: Record<string, any>): string {
  const slaLine = props.slaStatus
    ? `<div style="margin-top:4px;padding:4px 8px;border-radius:4px;font-size:11px;font-weight:600;
        background:${props.slaStatus === 'breached' ? 'var(--color-error)' : props.slaStatus === 'warning' ? 'var(--color-warning)' : 'var(--color-info)'};
        color:#fff;">
        SLA: ${props.slaRuleName} — ${props.slaStatus.toUpperCase()}
        ${props.slaRemainingMinutes != null ? ` (${props.slaRemainingMinutes}m remaining)` : ''}
        ${props.slaBreachedAt ? ` — breached ${new Date(props.slaBreachedAt).toLocaleString()}` : ''}
      </div>`
    : '';

  return `
    <div style="min-width:240px;font-family:var(--font-family,Roboto,sans-serif)">
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">
        <span class="material-icons" style="font-size:18px;color:${getPriorityColor(props.priority)}">
          ${props.type === 'sla_breach' ? 'timer_off' : 'bug_report'}
        </span>
        <strong style="font-size:13px">${props.title}</strong>
      </div>
      <div style="font-size:12px;color:var(--on-surface-variant);line-height:1.6">
        <div><strong>Priority:</strong> <span style="color:${getPriorityColor(props.priority)};font-weight:600">${props.priority}</span></div>
        <div><strong>Status:</strong> ${props.status.replace(/_/g, ' ')}</div>
        <div><strong>Category:</strong> ${props.category}</div>
        ${props.assigneeName ? `<div><strong>Assigned:</strong> ${props.assigneeName}</div>` : '<div style="color:var(--color-warning)">Unassigned</div>'}
        <div style="margin-top:4px;border-top:1px solid var(--outline-variant);padding-top:4px">
          <strong>Shipment:</strong> ${props.shipmentReference} (${props.shipmentStatus})
        </div>
        ${props.customerName ? `<div><strong>Customer:</strong> ${props.customerName}</div>` : ''}
      </div>
      ${slaLine}
      <div style="display:flex;gap:12px;margin-top:8px">
        <a href="/issues" style="font-size:12px;color:var(--primary);text-decoration:none">Issues &rarr;</a>
        <a href="/shipments/${props.shipmentId}" style="font-size:12px;color:var(--primary);text-decoration:none">Shipment &rarr;</a>
      </div>
    </div>
  `;
}

export default function VNextShipmentMap() {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const markersLayer = useRef<L.LayerGroup | null>(null);

  const [entityType, setEntityType] = useState<EntityType>('shipments');
  const [features, setFeatures] = useState<GeoFeature[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [truncated, setTruncated] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Issue/SLA overlay state
  const [showIssues, setShowIssues] = useState(false);
  const [issueFeatures, setIssueFeatures] = useState<IssueFeature[]>([]);
  const [issueCount, setIssueCount] = useState(0);
  const issuesLayer = useRef<L.LayerGroup | null>(null);

  // Location markers overlay state
  const [showLocations, setShowLocations] = useState(false);
  const locationsLayer = useRef<L.LayerGroup | null>(null);

  // Route arcs overlay
  const [showRoutes, setShowRoutes] = useState(false);
  const routesLayer = useRef<L.LayerGroup | null>(null);

  // Fullscreen and auto-refresh
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Supercluster instance — memoised on feature data
  const cluster = useMemo(() => {
    const sc = new Supercluster({
      radius: 60,     // cluster radius in pixels
      maxZoom: 16,    // beyond this, all points are individual
      minPoints: 3,   // minimum points to form a cluster
    });
    sc.load(features as any);
    return sc;
  }, [features]);

  // Fetch data from the API
  const fetchData = useCallback(async () => {
    if (!mapInstance.current) return;

    setLoading(true);
    setError(null);

    try {
      const bounds = mapInstance.current.getBounds();
      const zoom = mapInstance.current.getZoom();
      const sw = bounds.getSouthWest();
      const ne = bounds.getNorthEast();

      let url: string;
      if (entityType === 'shipments') {
        const params = new URLSearchParams({
          sw_lat: sw.lat.toString(),
          sw_lng: sw.lng.toString(),
          ne_lat: ne.lat.toString(),
          ne_lng: ne.lng.toString(),
          zoom: zoom.toString(),
          limit: '3000',
        });
        if (statusFilter.length > 0) {
          params.set('status', statusFilter.join(','));
        }
        url = `${API_URL}/api/v1/map/shipments?${params}`;
      } else if (entityType === 'orders') {
        url = `${API_URL}/api/v1/map/orders?limit=3000`;
      } else {
        url = `${API_URL}/api/v1/map/units?limit=3000`;
      }

      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();

      setFeatures(json.data?.features || []);
      setTotal(json.data?.total || 0);
      setTruncated(json.data?.truncated || false);
      setLastRefresh(new Date());
    } catch (err) {
      setError((err as Error).message);
      console.error('[Map] Fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [entityType, statusFilter]);

  // Initialise map
  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;

    const map = L.map(mapRef.current, {
      center: [39.8283, -98.5795], // Center of US
      zoom: 5,
      zoomControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    markersLayer.current = L.layerGroup().addTo(map);
    routesLayer.current = L.layerGroup().addTo(map);
    issuesLayer.current = L.layerGroup().addTo(map);
    locationsLayer.current = L.layerGroup().addTo(map);
    mapInstance.current = map;

    // Fetch on map move (debounced)
    let moveTimeout: ReturnType<typeof setTimeout>;
    map.on('moveend', () => {
      clearTimeout(moveTimeout);
      moveTimeout = setTimeout(() => {
        fetchData();
      }, 300);
    });

    // Initial fetch
    fetchData();

    return () => {
      clearTimeout(moveTimeout);
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-fetch when entity type or filter changes
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Render clusters/markers when features or zoom change
  useEffect(() => {
    if (!mapInstance.current || !markersLayer.current) return;

    const map = mapInstance.current;
    const layer = markersLayer.current;
    layer.clearLayers();

    const zoom = map.getZoom();
    const bounds = map.getBounds();

    const clusters = cluster.getClusters(
      [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()],
      zoom,
    );

    for (const c of clusters) {
      const [lng, lat] = c.geometry.coordinates;

      if (c.properties.cluster) {
        // Cluster marker
        const count = c.properties.point_count;
        const size = count < 10 ? 36 : count < 100 ? 44 : 52;

        const marker = L.marker([lat, lng], {
          icon: L.divIcon({
            className: 'map-cluster',
            html: `<div style="
              width:${size}px;height:${size}px;
              border-radius:50%;
              background:var(--primary);
              color:var(--on-primary);
              display:flex;align-items:center;justify-content:center;
              font-weight:700;font-size:${count < 100 ? 14 : 12}px;
              border:3px solid var(--surface);
              box-shadow:0 2px 8px rgba(0,0,0,0.3);
            ">${count < 1000 ? count : `${(count / 1000).toFixed(1)}k`}</div>`,
            iconSize: [size, size],
            iconAnchor: [size / 2, size / 2],
          }),
        });

        // Click to zoom into cluster
        marker.on('click', () => {
          const expansionZoom = Math.min(cluster.getClusterExpansionZoom(c.properties.cluster_id), 18);
          map.setView([lat, lng], expansionZoom, { animate: true });
        });

        marker.addTo(layer);
      } else {
        // Individual marker
        const props = c.properties;
        const status = props.status || '';
        const color = getStatusColor(status);
        const icon = entityType === 'shipments' ? getStatusIcon(status)
          : entityType === 'orders' ? 'receipt_long'
          : 'inventory_2';

        const marker = L.marker([lat, lng], {
          icon: L.divIcon({
            className: 'map-point',
            html: `<div style="
              width:32px;height:32px;
              border-radius:50%;
              background:${color};
              color:#fff;
              display:flex;align-items:center;justify-content:center;
              border:2px solid var(--surface);
              box-shadow:0 2px 4px rgba(0,0,0,0.3);
            "><span class="material-icons" style="font-size:18px">${icon}</span></div>`,
            iconSize: [32, 32],
            iconAnchor: [16, 16],
          }),
        });

        marker.bindPopup(buildPopupHtml(entityType, props), {
          maxWidth: 280,
          className: 'map-popup',
        });

        marker.addTo(layer);
      }
    }
  }, [features, cluster, entityType]);

  // Also re-render on zoom changes
  useEffect(() => {
    if (!mapInstance.current) return;
    const map = mapInstance.current;
    const onZoom = () => {
      // Trigger re-render of clusters at new zoom level
      setFeatures((prev) => [...prev]);
    };
    map.on('zoomend', onZoom);
    return () => { map.off('zoomend', onZoom); };
  }, []);

  // Fetch and render issue/SLA overlay
  useEffect(() => {
    if (!showIssues || !mapInstance.current || !issuesLayer.current) {
      issuesLayer.current?.clearLayers();
      return;
    }

    let cancelled = false;

    async function fetchIssues() {
      try {
        const res = await fetch(`${API_URL}/api/v1/map/issues?status=open,in_progress&limit=500`);
        if (!res.ok || cancelled) return;
        const json = await res.json();
        const feats = json.data?.features || [];
        if (!cancelled) {
          setIssueFeatures(feats);
          setIssueCount(json.data?.total || 0);
        }
      } catch (err) {
        console.error('[Map] Issue overlay fetch error:', err);
      }
    }

    fetchIssues();
    return () => { cancelled = true; };
  }, [showIssues]);

  // Render issue markers onto their own layer
  useEffect(() => {
    if (!issuesLayer.current) return;
    const layer = issuesLayer.current;
    layer.clearLayers();

    if (!showIssues) return;

    for (const feat of issueFeatures) {
      const [lng, lat] = feat.geometry.coordinates;
      const props = feat.properties;
      const isBreach = props.slaStatus === 'breached';
      const isWarning = props.slaStatus === 'warning';
      const color = isBreach ? 'var(--color-error)' : isWarning ? 'var(--color-warning)' : getPriorityColor(props.priority);
      const icon = props.type === 'sla_breach' ? 'timer_off' : 'bug_report';
      const pulseClass = isBreach ? 'issue-pulse-breach' : isWarning ? 'issue-pulse-warning' : '';

      const marker = L.marker([lat, lng], {
        icon: L.divIcon({
          className: 'map-issue',
          html: `<div class="${pulseClass}" style="
            width:28px;height:28px;
            border-radius:50%;
            background:${color};
            color:#fff;
            display:flex;align-items:center;justify-content:center;
            border:2px solid var(--surface);
            box-shadow:0 0 0 3px ${isBreach ? 'var(--color-error)' : isWarning ? 'var(--color-warning)' : 'transparent'},
                        0 2px 6px rgba(0,0,0,0.3);
          "><span class="material-icons" style="font-size:16px">${icon}</span></div>`,
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        }),
        zIndexOffset: 1000, // Issues render above shipments
      });

      marker.bindPopup(buildIssuePopupHtml(props), {
        maxWidth: 300,
        className: 'map-popup',
      });

      marker.addTo(layer);
    }
  }, [issueFeatures, showIssues]);

  // Auto-refresh (30s interval)
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      fetchData();
      // Re-fetch issues too if overlay is active
      if (showIssues) {
        setShowIssues(false);
        setTimeout(() => setShowIssues(true), 50);
      }
    }, 30_000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchData, showIssues]);

  // Fullscreen toggle
  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  }, []);

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  // Invalidate map size after fullscreen toggle (Leaflet needs this)
  useEffect(() => {
    if (mapInstance.current) {
      setTimeout(() => mapInstance.current?.invalidateSize(), 100);
    }
  }, [isFullscreen]);

  // Location markers overlay
  useEffect(() => {
    if (!showLocations || !mapInstance.current || !locationsLayer.current) {
      locationsLayer.current?.clearLayers();
      return;
    }

    let cancelled = false;
    async function fetchLocations() {
      try {
        const res = await fetch(`${API_URL}/api/v1/locations?limit=500`);
        if (!res.ok || cancelled) return;
        const json = await res.json();
        const locs = (json.data || []).filter((l: any) => l.lat && l.lng);

        if (cancelled || !locationsLayer.current) return;
        locationsLayer.current.clearLayers();

        for (const loc of locs) {
          const typeMeta = getLocationTypeMeta(loc.locationType);
          const locIcon = typeMeta?.icon || 'place';
          const locLabel = typeMeta?.label || 'Location';

          const marker = L.marker([loc.lat, loc.lng], {
            icon: L.divIcon({
              className: 'map-location',
              html: `<div style="
                width:26px;height:26px;
                border-radius:4px;
                background:var(--surface);
                color:var(--primary);
                display:flex;align-items:center;justify-content:center;
                border:2px solid var(--primary);
                box-shadow:0 1px 4px rgba(0,0,0,0.2);
                opacity:0.85;
              "><span class="material-icons" style="font-size:16px">${locIcon}</span></div>`,
              iconSize: [26, 26],
              iconAnchor: [13, 13],
            }),
            zIndexOffset: -100, // Locations render below shipments
          });

          marker.bindPopup(`
            <div style="min-width:200px;font-family:var(--font-family,Roboto,sans-serif)">
              <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
                <span class="material-icons" style="font-size:16px;color:var(--primary)">${locIcon}</span>
                <strong style="font-size:13px">${loc.name}</strong>
              </div>
              <div style="font-size:11px;color:var(--primary);font-weight:600;margin-bottom:4px">${locLabel}</div>
              <div style="font-size:12px;color:var(--on-surface-variant);line-height:1.5">
                <div>${loc.address1}</div>
                <div>${loc.city}${loc.state ? `, ${loc.state}` : ''} ${loc.postalCode || ''}</div>
                <div>${loc.country}</div>
              </div>
              <div style="display:flex;gap:12px;margin-top:6px">
                <a href="/locations/${loc.id}/ops" style="font-size:12px;color:var(--primary);text-decoration:none;font-weight:600">
                  Operations &rarr;
                </a>
                <a href="/locations/${loc.id}/edit" style="font-size:12px;color:var(--on-surface-variant);text-decoration:none">
                  Edit
                </a>
              </div>
            </div>
          `, { className: 'map-popup' });

          marker.addTo(locationsLayer.current!);
        }
      } catch (err) {
        console.error('[Map] Location fetch error:', err);
      }
    }

    fetchLocations();
    return () => { cancelled = true; };
  }, [showLocations]);

  // Route arcs: draw straight lines from origin → current position → destination
  useEffect(() => {
    if (!routesLayer.current) return;
    routesLayer.current.clearLayers();

    if (!showRoutes || entityType !== 'shipments') return;

    for (const feat of features) {
      const props = feat.properties;
      const [curLng, curLat] = feat.geometry.coordinates;
      const oLat = props.originLat;
      const oLng = props.originLng;
      const dLat = props.destLat;
      const dLng = props.destLng;

      if (!oLat || !oLng || !dLat || !dLng) continue;

      // Only show routes for active shipments
      if (!['in_transit', 'dispatched'].includes(props.status)) continue;

      // Origin → current position (solid line, traveled portion)
      const traveledLine = L.polyline(
        [[oLat, oLng], [curLat, curLng]],
        { color: 'var(--color-info)', weight: 2, opacity: 0.6 }
      );

      // Current position → destination (dashed line, remaining portion)
      const remainingLine = L.polyline(
        [[curLat, curLng], [dLat, dLng]],
        { color: 'var(--color-info)', weight: 2, opacity: 0.4, dashArray: '6, 8' }
      );

      // Small origin/destination markers
      const originDot = L.circleMarker([oLat, oLng], {
        radius: 4, fillColor: 'var(--marker-origin)', fillOpacity: 0.8,
        stroke: true, weight: 1, color: '#fff',
      });
      const destDot = L.circleMarker([dLat, dLng], {
        radius: 4, fillColor: 'var(--marker-destination)', fillOpacity: 0.8,
        stroke: true, weight: 1, color: '#fff',
      });

      traveledLine.addTo(routesLayer.current!);
      remainingLine.addTo(routesLayer.current!);
      originDot.addTo(routesLayer.current!);
      destDot.addTo(routesLayer.current!);
    }
  }, [features, showRoutes, entityType]);

  const shipmentStatuses = ['draft', 'dispatched', 'in_transit', 'delivered', 'exception'];

  return (
    <div ref={containerRef} style={{ display: 'flex', flexDirection: 'column', height: isFullscreen ? '100vh' : 'calc(100vh - 56px)', background: 'var(--surface)' }}>
      {/* Toolbar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '8px 16px',
        borderBottom: '1px solid var(--outline-variant)',
        background: 'var(--surface)',
        flexWrap: 'wrap',
      }}>
        {/* Entity type tabs */}
        <div className="vn-tabs" style={{ margin: 0 }}>
          {(['shipments', 'orders', 'units'] as EntityType[]).map((et) => (
            <button
              key={et}
              className={`vn-tab${entityType === et ? ' active' : ''}`}
              onClick={() => setEntityType(et)}
              style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              <span className="material-icons" style={{ fontSize: '18px' }}>{getEntityIcon(et)}</span>
              {et === 'units' ? 'Trackable Units' : et.charAt(0).toUpperCase() + et.slice(1)}
            </button>
          ))}
        </div>

        {/* Status filter for shipments */}
        {entityType === 'shipments' && (
          <div style={{ display: 'flex', gap: '4px', marginLeft: '8px' }}>
            {shipmentStatuses.map((s) => {
              const active = statusFilter.includes(s);
              return (
                <button
                  key={s}
                  onClick={() => {
                    setStatusFilter((prev) =>
                      active ? prev.filter((x) => x !== s) : [...prev, s]
                    );
                  }}
                  style={{
                    padding: '2px 10px',
                    fontSize: '12px',
                    borderRadius: '12px',
                    border: `1px solid ${active ? 'var(--primary)' : 'var(--outline-variant)'}`,
                    background: active ? 'var(--primary)' : 'transparent',
                    color: active ? 'var(--on-primary)' : 'var(--on-surface-variant)',
                    cursor: 'pointer',
                    textTransform: 'capitalize',
                  }}
                >
                  {s.replace(/_/g, ' ')}
                </button>
              );
            })}
            {statusFilter.length > 0 && (
              <button
                onClick={() => setStatusFilter([])}
                style={{
                  padding: '2px 8px',
                  fontSize: '12px',
                  borderRadius: '12px',
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--color-error)',
                  cursor: 'pointer',
                }}
              >
                Clear
              </button>
            )}
          </div>
        )}

        {/* Routes overlay toggle */}
        {entityType === 'shipments' && (
          <button
            onClick={() => setShowRoutes((prev) => !prev)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '4px 12px',
              fontSize: '12px',
              fontWeight: 600,
              borderRadius: '12px',
              border: `1px solid ${showRoutes ? 'var(--color-info)' : 'var(--outline-variant)'}`,
              background: showRoutes ? 'var(--color-info)' : 'transparent',
              color: showRoutes ? '#fff' : 'var(--on-surface-variant)',
              cursor: 'pointer',
            }}
          >
            <span className="material-icons" style={{ fontSize: '16px' }}>route</span>
            Routes
          </button>
        )}

        {/* Locations overlay toggle */}
        <button
          onClick={() => setShowLocations((prev) => !prev)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '4px 12px',
            fontSize: '12px',
            fontWeight: 600,
            borderRadius: '12px',
            border: `1px solid ${showLocations ? 'var(--primary)' : 'var(--outline-variant)'}`,
            background: showLocations ? 'var(--primary)' : 'transparent',
            color: showLocations ? 'var(--on-primary)' : 'var(--on-surface-variant)',
            cursor: 'pointer',
          }}
        >
          <span className="material-icons" style={{ fontSize: '16px' }}>warehouse</span>
          Locations
        </button>

        {/* Issue/SLA overlay toggle */}
        <button
          onClick={() => setShowIssues((prev) => !prev)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '4px 12px',
            fontSize: '12px',
            fontWeight: 600,
            borderRadius: '12px',
            border: `1px solid ${showIssues ? 'var(--color-error)' : 'var(--outline-variant)'}`,
            background: showIssues ? 'var(--color-error)' : 'transparent',
            color: showIssues ? '#fff' : 'var(--on-surface-variant)',
            cursor: 'pointer',
            marginLeft: entityType !== 'shipments' ? '8px' : '0',
          }}
        >
          <span className="material-icons" style={{ fontSize: '16px' }}>
            {showIssues ? 'notifications_active' : 'notifications_none'}
          </span>
          Issues{issueCount > 0 && showIssues ? ` (${issueCount})` : ''}
        </button>

        {/* Right side: controls + stats */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--on-surface-variant)' }}>
          {loading && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span className="material-icons" style={{ fontSize: '16px', animation: 'spin 1s linear infinite' }}>sync</span>
            </span>
          )}
          {!loading && (
            <span>{total.toLocaleString()} {entityType}{truncated ? ' (limited)' : ''}</span>
          )}
          {lastRefresh && !loading && (
            <span style={{ fontSize: '11px', opacity: 0.7 }}>
              {lastRefresh.toLocaleTimeString()}
            </span>
          )}
          {error && (
            <span style={{ color: 'var(--color-error)', fontSize: '12px' }}>
              <span className="material-icons" style={{ fontSize: '16px', verticalAlign: 'middle' }}>error</span>
            </span>
          )}

          {/* Auto-refresh toggle */}
          <button
            onClick={() => setAutoRefresh((prev) => !prev)}
            title={autoRefresh ? 'Stop auto-refresh (30s)' : 'Start auto-refresh (30s)'}
            style={{
              display: 'flex', alignItems: 'center', gap: '3px',
              padding: '3px 8px', fontSize: '11px', fontWeight: 600,
              borderRadius: '10px',
              border: `1px solid ${autoRefresh ? 'var(--color-success)' : 'var(--outline-variant)'}`,
              background: autoRefresh ? 'var(--color-success)' : 'transparent',
              color: autoRefresh ? '#fff' : 'var(--on-surface-variant)',
              cursor: 'pointer',
            }}
          >
            <span className="material-icons" style={{ fontSize: '14px' }}>
              {autoRefresh ? 'pause' : 'play_arrow'}
            </span>
            {autoRefresh ? 'Live' : 'Auto'}
          </button>

          {/* Fullscreen toggle */}
          <button
            onClick={toggleFullscreen}
            title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen (control centre mode)'}
            style={{
              display: 'flex', alignItems: 'center',
              padding: '4px',
              borderRadius: '6px',
              border: '1px solid var(--outline-variant)',
              background: 'transparent',
              color: 'var(--on-surface-variant)',
              cursor: 'pointer',
            }}
          >
            <span className="material-icons" style={{ fontSize: '18px' }}>
              {isFullscreen ? 'fullscreen_exit' : 'fullscreen'}
            </span>
          </button>
        </div>
      </div>

      {/* Map container — fills remaining space */}
      <div ref={mapRef} style={{ flex: 1 }} />

      {/* Legend */}
      {entityType === 'shipments' && (
        <div style={{
          position: 'absolute',
          bottom: '24px',
          left: '24px',
          zIndex: 1000,
          background: 'var(--surface)',
          border: '1px solid var(--outline-variant)',
          borderRadius: '8px',
          padding: '10px 14px',
          fontSize: '12px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        }}>
          <div style={{ fontWeight: 600, marginBottom: '6px', color: 'var(--on-surface)' }}>Legend</div>
          {[
            { label: 'In Transit', color: 'var(--color-info)', icon: 'local_shipping' },
            { label: 'Delivered', color: 'var(--color-success)', icon: 'check_circle' },
            { label: 'Exception', color: 'var(--color-error)', icon: 'error' },
            { label: 'Draft / Other', color: 'var(--on-surface-variant)', icon: 'edit_note' },
          ].map((item) => (
            <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
              <span className="material-icons" style={{ fontSize: '16px', color: item.color }}>{item.icon}</span>
              <span style={{ color: 'var(--on-surface-variant)' }}>{item.label}</span>
            </div>
          ))}
          {showRoutes && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                <div style={{ width: '16px', height: '2px', background: 'var(--color-info)' }} />
                <span style={{ color: 'var(--on-surface-variant)' }}>Traveled</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                <div style={{ width: '16px', height: '2px', background: 'var(--color-info)', opacity: 0.4, borderTop: '2px dashed var(--color-info)' }} />
                <span style={{ color: 'var(--on-surface-variant)' }}>Remaining</span>
              </div>
            </>
          )}
          {showLocations && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
              <span className="material-icons" style={{ fontSize: '16px', color: 'var(--primary)' }}>warehouse</span>
              <span style={{ color: 'var(--on-surface-variant)' }}>Location</span>
            </div>
          )}
          {showIssues && (
            <>
              <div style={{ borderTop: '1px solid var(--outline-variant)', margin: '6px 0', paddingTop: '6px', fontWeight: 600, color: 'var(--on-surface)' }}>Issues / SLA</div>
              {[
                { label: 'SLA Breached', color: 'var(--color-error)', icon: 'timer_off' },
                { label: 'SLA Warning', color: 'var(--color-warning)', icon: 'timer_off' },
                { label: 'Open Issue', color: 'var(--color-info)', icon: 'bug_report' },
              ].map((item) => (
                <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                  <span className="material-icons" style={{ fontSize: '16px', color: item.color }}>{item.icon}</span>
                  <span style={{ color: 'var(--on-surface-variant)' }}>{item.label}</span>
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {/* Spin keyframe */}
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes pulse-breach {
          0%, 100% { box-shadow: 0 0 0 0 rgba(244, 67, 54, 0.6); }
          50% { box-shadow: 0 0 0 10px rgba(244, 67, 54, 0); }
        }
        @keyframes pulse-warning {
          0%, 100% { box-shadow: 0 0 0 0 rgba(255, 152, 0, 0.5); }
          50% { box-shadow: 0 0 0 8px rgba(255, 152, 0, 0); }
        }
        .issue-pulse-breach { animation: pulse-breach 2s ease-in-out infinite; }
        .issue-pulse-warning { animation: pulse-warning 2.5s ease-in-out infinite; }
        .map-popup .leaflet-popup-content-wrapper {
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        }
        .map-cluster, .map-point, .map-issue, .map-location {
          background: transparent !important;
          border: none !important;
        }
      `}</style>
    </div>
  );
}
