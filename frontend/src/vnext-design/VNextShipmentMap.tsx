/**
 * VNextShipmentMap - full-page map view of shipments, orders, and trackable units.
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
import {
  AlertTriangle,
  Bell,
  BellOff,
  Bug,
  CheckCircle2,
  Edit3,
  FileText,
  Loader2,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  Route,
  Truck,
  Warehouse,
  Package,
} from 'lucide-react';

import { API_URL } from '../api';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
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

// Status-to-hex mapping (replaces var(--*) for use inside Leaflet HTML strings)
const COLOR_INFO = '#3b82f6';
const COLOR_SUCCESS = '#22c55e';
const COLOR_WARNING = '#eab308';
const COLOR_DESTRUCTIVE = '#ef4444';
const COLOR_MUTED = '#94a3b8';
const COLOR_PRIMARY = '#6366f1';

function getStatusColor(status: string): string {
  switch (status) {
    case 'in_transit':
    case 'dispatched':
      return COLOR_INFO;
    case 'delivered':
    case 'completed':
      return COLOR_SUCCESS;
    case 'exception':
      return COLOR_DESTRUCTIVE;
    case 'draft':
    case 'pending':
      return COLOR_MUTED;
    default:
      return COLOR_MUTED;
  }
}

function getEntityIcon(entityType: EntityType): typeof Truck {
  switch (entityType) {
    case 'shipments': return Truck;
    case 'orders': return FileText;
    case 'units': return Package;
  }
}

function entityIconLabel(entityType: EntityType): string {
  switch (entityType) {
    case 'shipments': return 'Shipments';
    case 'orders': return 'Orders';
    case 'units': return 'Trackable Units';
  }
}

function buildPopupHtml(entityType: EntityType, props: Record<string, any>): string {
  if (entityType === 'shipments') {
    const staleMinutes = props.lastLocationAt
      ? Math.round((Date.now() - new Date(props.lastLocationAt).getTime()) / 60_000)
      : null;
    const staleLabel = staleMinutes !== null
      ? staleMinutes < 5 ? 'Live' : staleMinutes < 60 ? `${staleMinutes}m ago` : `${Math.round(staleMinutes / 60)}h ago`
      : 'No GPS';

    return `
      <div style="min-width:220px">
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">
          <strong style="font-size:14px">${props.reference}</strong>
        </div>
        <div style="font-size:12px;line-height:1.6">
          <div><strong>Status:</strong> ${(props.status || '').replace(/_/g, ' ')}</div>
          ${props.customerName ? `<div><strong>Customer:</strong> ${props.customerName}</div>` : ''}
          ${props.carrierName ? `<div><strong>Carrier:</strong> ${props.carrierName}</div>` : ''}
          <div><strong>Origin:</strong> ${props.originName || ''}${props.originCity ? `, ${props.originCity}` : ''}</div>
          <div><strong>Dest:</strong> ${props.destinationName || ''}${props.destinationCity ? `, ${props.destinationCity}` : ''}</div>
          <div style="margin-top:4px;color:${staleMinutes !== null && staleMinutes < 60 ? COLOR_SUCCESS : COLOR_MUTED}">
            GPS: ${staleLabel}
          </div>
        </div>
        <a href="/shipments/${props.id}" style="display:inline-block;margin-top:8px;font-size:12px;color:${COLOR_PRIMARY};text-decoration:none">
          View Details &rarr;
        </a>
      </div>
    `;
  }

  if (entityType === 'orders') {
    return `
      <div style="min-width:200px">
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">
          <strong style="font-size:14px">${props.reference}</strong>
        </div>
        <div style="font-size:12px;line-height:1.6">
          <div><strong>Status:</strong> ${props.status}</div>
          <div><strong>Delivery:</strong> ${props.deliveryStatus || 'N/A'}</div>
          ${props.customerName ? `<div><strong>Customer:</strong> ${props.customerName}</div>` : ''}
          <div><strong>Origin:</strong> ${props.originName || ''}${props.originCity ? `, ${props.originCity}` : ''}</div>
          <div><strong>Dest:</strong> ${props.destinationName || ''}${props.destinationCity ? `, ${props.destinationCity}` : ''}</div>
        </div>
        <a href="/orders/${props.id}" style="display:inline-block;margin-top:8px;font-size:12px;color:${COLOR_PRIMARY};text-decoration:none">
          View Details &rarr;
        </a>
      </div>
    `;
  }

  // units
  return `
    <div style="min-width:200px">
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">
        <strong style="font-size:14px">${props.reference}</strong>
      </div>
      <div style="font-size:12px;line-height:1.6">
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
    case 'critical': return COLOR_DESTRUCTIVE;
    case 'high': return COLOR_WARNING;
    case 'medium': return COLOR_INFO;
    default: return COLOR_MUTED;
  }
}

function buildIssuePopupHtml(props: Record<string, any>): string {
  const slaLine = props.slaStatus
    ? `<div style="margin-top:4px;padding:4px 8px;border-radius:4px;font-size:11px;font-weight:600;
        background:${props.slaStatus === 'breached' ? COLOR_DESTRUCTIVE : props.slaStatus === 'warning' ? COLOR_WARNING : COLOR_INFO};
        color:#fff;">
        SLA: ${props.slaRuleName} - ${props.slaStatus.toUpperCase()}
        ${props.slaRemainingMinutes != null ? ` (${props.slaRemainingMinutes}m remaining)` : ''}
        ${props.slaBreachedAt ? ` - breached ${new Date(props.slaBreachedAt).toLocaleString()}` : ''}
      </div>`
    : '';

  return `
    <div style="min-width:240px">
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">
        <strong style="font-size:13px">${props.title}</strong>
      </div>
      <div style="font-size:12px;line-height:1.6">
        <div><strong>Priority:</strong> <span style="color:${getPriorityColor(props.priority)};font-weight:600">${props.priority}</span></div>
        <div><strong>Status:</strong> ${(props.status || '').replace(/_/g, ' ')}</div>
        <div><strong>Category:</strong> ${props.category}</div>
        ${props.assigneeName ? `<div><strong>Assigned:</strong> ${props.assigneeName}</div>` : `<div style="color:${COLOR_WARNING}">Unassigned</div>`}
        <div style="margin-top:4px;padding-top:4px;border-top:1px solid #e2e8f0">
          <strong>Shipment:</strong> ${props.shipmentReference} (${props.shipmentStatus})
        </div>
        ${props.customerName ? `<div><strong>Customer:</strong> ${props.customerName}</div>` : ''}
      </div>
      ${slaLine}
      <div style="display:flex;gap:12px;margin-top:8px">
        <a href="/issues" style="font-size:12px;color:${COLOR_PRIMARY};text-decoration:none">Issues &rarr;</a>
        <a href="/shipments/${props.shipmentId}" style="font-size:12px;color:${COLOR_PRIMARY};text-decoration:none">Shipment &rarr;</a>
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

  const [showIssues, setShowIssues] = useState(false);
  const [issueFeatures, setIssueFeatures] = useState<IssueFeature[]>([]);
  const [issueCount, setIssueCount] = useState(0);
  const issuesLayer = useRef<L.LayerGroup | null>(null);

  const [showLocations, setShowLocations] = useState(false);
  const locationsLayer = useRef<L.LayerGroup | null>(null);

  const [showRoutes, setShowRoutes] = useState(false);
  const routesLayer = useRef<L.LayerGroup | null>(null);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const cluster = useMemo(() => {
    const sc = new Supercluster({
      radius: 60,
      maxZoom: 16,
      minPoints: 3,
    });
    sc.load(features as any);
    return sc;
  }, [features]);

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
      center: [39.8283, -98.5795],
      zoom: 5,
      zoomControl: true,
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    markersLayer.current = L.layerGroup().addTo(map);
    routesLayer.current = L.layerGroup().addTo(map);
    issuesLayer.current = L.layerGroup().addTo(map);
    locationsLayer.current = L.layerGroup().addTo(map);
    mapInstance.current = map;

    let moveTimeout: ReturnType<typeof setTimeout>;
    map.on('moveend', () => {
      clearTimeout(moveTimeout);
      moveTimeout = setTimeout(() => {
        fetchData();
      }, 300);
    });

    fetchData();

    return () => {
      clearTimeout(moveTimeout);
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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
        const count = c.properties.point_count;
        const size = count < 10 ? 36 : count < 100 ? 44 : 52;

        const marker = L.marker([lat, lng], {
          icon: L.divIcon({
            className: 'map-cluster',
            html: `<div style="
              width:${size}px;height:${size}px;
              border-radius:50%;
              background:${COLOR_PRIMARY};
              color:#fff;
              display:flex;align-items:center;justify-content:center;
              font-weight:700;font-size:${count < 100 ? 14 : 12}px;
              border:3px solid #fff;
              box-shadow:0 2px 8px rgba(0,0,0,0.3);
            ">${count < 1000 ? count : `${(count / 1000).toFixed(1)}k`}</div>`,
            iconSize: [size, size],
            iconAnchor: [size / 2, size / 2],
          }),
        });

        marker.on('click', () => {
          const expansionZoom = Math.min(cluster.getClusterExpansionZoom(c.properties.cluster_id), 18);
          map.setView([lat, lng], expansionZoom, { animate: true });
        });

        marker.addTo(layer);
      } else {
        const props = c.properties;
        const status = props.status || '';
        const color = getStatusColor(status);

        const marker = L.marker([lat, lng], {
          icon: L.divIcon({
            className: 'map-point',
            html: `<div style="
              width:32px;height:32px;
              border-radius:50%;
              background:${color};
              color:#fff;
              display:flex;align-items:center;justify-content:center;
              border:2px solid #fff;
              box-shadow:0 2px 4px rgba(0,0,0,0.3);
            "></div>`,
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

  useEffect(() => {
    if (!mapInstance.current) return;
    const map = mapInstance.current;
    const onZoom = () => {
      setFeatures((prev) => [...prev]);
    };
    map.on('zoomend', onZoom);
    return () => { map.off('zoomend', onZoom); };
  }, []);

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
      const color = isBreach ? COLOR_DESTRUCTIVE : isWarning ? COLOR_WARNING : getPriorityColor(props.priority);
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
            border:2px solid #fff;
            box-shadow:0 0 0 3px ${isBreach ? COLOR_DESTRUCTIVE : isWarning ? COLOR_WARNING : 'transparent'},
                        0 2px 6px rgba(0,0,0,0.3);
          "></div>`,
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        }),
        zIndexOffset: 1000,
      });

      marker.bindPopup(buildIssuePopupHtml(props), {
        maxWidth: 300,
        className: 'map-popup',
      });

      marker.addTo(layer);
    }
  }, [issueFeatures, showIssues]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      fetchData();
      if (showIssues) {
        setShowIssues(false);
        setTimeout(() => setShowIssues(true), 50);
      }
    }, 30_000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchData, showIssues]);

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

  useEffect(() => {
    if (mapInstance.current) {
      setTimeout(() => mapInstance.current?.invalidateSize(), 100);
    }
  }, [isFullscreen]);

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
          const locLabel = typeMeta?.label || 'Location';

          const marker = L.marker([loc.lat, loc.lng], {
            icon: L.divIcon({
              className: 'map-location',
              html: `<div style="
                width:26px;height:26px;
                border-radius:4px;
                background:#fff;
                color:${COLOR_PRIMARY};
                display:flex;align-items:center;justify-content:center;
                border:2px solid ${COLOR_PRIMARY};
                box-shadow:0 1px 4px rgba(0,0,0,0.2);
                opacity:0.85;
              "></div>`,
              iconSize: [26, 26],
              iconAnchor: [13, 13],
            }),
            zIndexOffset: -100,
          });

          marker.bindPopup(`
            <div style="min-width:200px">
              <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
                <strong style="font-size:13px">${loc.name}</strong>
              </div>
              <div style="font-size:11px;color:${COLOR_PRIMARY};font-weight:600;margin-bottom:4px">${locLabel}</div>
              <div style="font-size:12px;line-height:1.5">
                <div>${loc.address1}</div>
                <div>${loc.city}${loc.state ? `, ${loc.state}` : ''} ${loc.postalCode || ''}</div>
                <div>${loc.country}</div>
              </div>
              <div style="display:flex;gap:12px;margin-top:6px">
                <a href="/locations/${loc.id}/ops" style="font-size:12px;color:${COLOR_PRIMARY};text-decoration:none;font-weight:600">
                  Operations &rarr;
                </a>
                <a href="/locations/${loc.id}/edit" style="font-size:12px;color:${COLOR_MUTED};text-decoration:none">
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

      if (!['in_transit', 'dispatched'].includes(props.status)) continue;

      const traveledLine = L.polyline(
        [[oLat, oLng], [curLat, curLng]],
        { color: COLOR_INFO, weight: 2, opacity: 0.6 },
      );

      const remainingLine = L.polyline(
        [[curLat, curLng], [dLat, dLng]],
        { color: COLOR_INFO, weight: 2, opacity: 0.4, dashArray: '6, 8' },
      );

      const originDot = L.circleMarker([oLat, oLng], {
        radius: 4, fillColor: COLOR_INFO, fillOpacity: 0.8,
        stroke: true, weight: 1, color: '#fff',
      });
      const destDot = L.circleMarker([dLat, dLng], {
        radius: 4, fillColor: COLOR_SUCCESS, fillOpacity: 0.8,
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
    <div
      ref={containerRef}
      className={cn(
        'relative isolate flex flex-col bg-background',
        isFullscreen ? 'h-screen' : 'h-[calc(100vh-56px)]',
      )}
    >
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 border-b border-border bg-card p-2">
        {/* Entity type tabs */}
        <div className="inline-flex rounded-md border border-border">
          {(['shipments', 'orders', 'units'] as EntityType[]).map((et, i) => {
            const Icon = getEntityIcon(et);
            const active = entityType === et;
            return (
              <Button
                key={et}
                variant={active ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setEntityType(et)}
                className={cn(
                  'rounded-none',
                  i === 0 && 'rounded-l-md',
                  i === 2 && 'rounded-r-md',
                )}
              >
                <Icon className="h-4 w-4" />
                {entityIconLabel(et)}
              </Button>
            );
          })}
        </div>

        {/* Status filter for shipments */}
        {entityType === 'shipments' && (
          <div className="ml-2 flex flex-wrap gap-1">
            {shipmentStatuses.map((s) => {
              const active = statusFilter.includes(s);
              return (
                <button
                  key={s}
                  onClick={() => {
                    setStatusFilter((prev) =>
                      active ? prev.filter((x) => x !== s) : [...prev, s],
                    );
                  }}
                  className={cn(
                    'rounded-full border px-3 py-0.5 text-xs capitalize transition-colors',
                    active ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-muted-foreground hover:border-primary/40',
                  )}
                >
                  {s.replace(/_/g, ' ')}
                </button>
              );
            })}
            {statusFilter.length > 0 && (
              <button
                onClick={() => setStatusFilter([])}
                className="rounded-full px-2 py-0.5 text-xs text-destructive"
              >
                Clear
              </button>
            )}
          </div>
        )}

        {/* Routes overlay toggle */}
        {entityType === 'shipments' && (
          <Button
            variant={showRoutes ? 'default' : 'outline'}
            size="sm"
            onClick={() => setShowRoutes(prev => !prev)}
          >
            <Route className="h-4 w-4" />
            Routes
          </Button>
        )}

        {/* Locations overlay toggle */}
        <Button
          variant={showLocations ? 'default' : 'outline'}
          size="sm"
          onClick={() => setShowLocations(prev => !prev)}
        >
          <Warehouse className="h-4 w-4" />
          Locations
        </Button>

        {/* Issue/SLA overlay toggle */}
        <Button
          variant={showIssues ? 'destructive' : 'outline'}
          size="sm"
          onClick={() => setShowIssues(prev => !prev)}
        >
          {showIssues ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
          Issues{issueCount > 0 && showIssues ? ` (${issueCount})` : ''}
        </Button>

        {/* Right side: controls + stats */}
        <div className="ml-auto flex items-center gap-2 text-sm text-muted-foreground">
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          {!loading && (
            <span>{total.toLocaleString()} {entityType}{truncated ? ' (limited)' : ''}</span>
          )}
          {lastRefresh && !loading && (
            <span className="text-xs opacity-70">{lastRefresh.toLocaleTimeString()}</span>
          )}
          {error && (
            <AlertTriangle className="h-4 w-4 text-destructive" />
          )}

          <Button
            variant={autoRefresh ? 'default' : 'outline'}
            size="sm"
            onClick={() => setAutoRefresh(prev => !prev)}
            title={autoRefresh ? 'Stop auto-refresh (30s)' : 'Start auto-refresh (30s)'}
          >
            {autoRefresh ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            {autoRefresh ? 'Live' : 'Auto'}
          </Button>

          <Button
            variant="outline"
            size="icon"
            onClick={toggleFullscreen}
            title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* Map container */}
      <div ref={mapRef} className="flex-1" />

      {/* Legend */}
      {entityType === 'shipments' && (
        <div className="absolute bottom-6 right-6 z-[1000] rounded-md border border-border bg-card/95 p-3 text-xs shadow-lg backdrop-blur">
          <div className="mb-1.5 font-semibold">Legend</div>
          <LegendItem color={COLOR_INFO} label="In Transit" Icon={Truck} />
          <LegendItem color={COLOR_SUCCESS} label="Delivered" Icon={CheckCircle2} />
          <LegendItem color={COLOR_DESTRUCTIVE} label="Exception" Icon={AlertTriangle} />
          <LegendItem color={COLOR_MUTED} label="Draft / Other" Icon={Edit3} />
          {showRoutes && (
            <>
              <div className="mt-1 flex items-center gap-1.5">
                <div className="h-0.5 w-4 bg-info" />
                <span className="text-muted-foreground">Traveled</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-0.5 w-4 border-t-2 border-dashed border-info opacity-60" />
                <span className="text-muted-foreground">Remaining</span>
              </div>
            </>
          )}
          {showLocations && <LegendItem color={COLOR_PRIMARY} label="Location" Icon={Warehouse} />}
          {showIssues && (
            <>
              <div className="mt-1.5 border-t border-border pt-1.5 font-semibold">Issues / SLA</div>
              <LegendItem color={COLOR_DESTRUCTIVE} label="SLA Breached" Icon={AlertTriangle} />
              <LegendItem color={COLOR_WARNING} label="SLA Warning" Icon={AlertTriangle} />
              <LegendItem color={COLOR_INFO} label="Open Issue" Icon={Bug} />
            </>
          )}
        </div>
      )}

      {/* Animation keyframes for issue pulses */}
      <style>{`
        @keyframes pulse-breach {
          0%, 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.6); }
          50% { box-shadow: 0 0 0 10px rgba(239, 68, 68, 0); }
        }
        @keyframes pulse-warning {
          0%, 100% { box-shadow: 0 0 0 0 rgba(234, 179, 8, 0.5); }
          50% { box-shadow: 0 0 0 8px rgba(234, 179, 8, 0); }
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

function LegendItem({ color, label, Icon }: { color: string; label: string; Icon: typeof Truck }) {
  return (
    <div className="flex items-center gap-1.5">
      <Icon className="h-3.5 w-3.5" style={{ color }} />
      <span className="text-muted-foreground">{label}</span>
    </div>
  );
}
