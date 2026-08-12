import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  AlertTriangle,
  Archive,
  ArrowDown,
  ArrowUp,
  CalendarCheck,
  CheckCircle2,
  CircleAlert,
  Download,
  FilePenLine,
  List as ListIcon,
  Loader2,
  Map as MapIcon,
  Plus,
  Search,
  SearchX,
  Trash2,
  Truck,
  X,
} from 'lucide-react';

import { toast } from 'sonner';

import { API_URL } from '../api';
import { SHIPMENT_LIFECYCLE, SHIPMENT_STATUS_LABELS } from '@open-tms/shared';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { DatePicker } from '@/components/ui/date-picker';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { keepMapSized, worldBoundsMapOptions, noWrapTileOptions, capWorldZoomOut } from '../lib/leafletMap';

interface Shipment {
  id: string;
  reference?: string;
  status: string;
  hasException?: boolean;
  pickupDate?: string;
  deliveryDate?: string;
  proNumber?: string;
  shipmentTypeId?: string | null;
  customer?: { name: string };
  origin?: { name: string; city: string; state: string; lat?: number; lng?: number };
  destination?: { name: string; city: string; state: string };
  lane?: { id?: string; name: string };
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

type StatusVariant = 'success' | 'info' | 'warning' | 'destructive' | 'muted';

// Canonical lifecycle: draft -> ready -> in_progress -> complete.
// 'archived' is orthogonal to the lifecycle (set by archive/unarchive, not
// TransitionShipmentStatusCommand) — same "Inactive" tone Carriers uses.
function statusVariant(status: string): StatusVariant {
  switch (status) {
    case 'ready': return 'warning';
    case 'in_progress': return 'info';
    case 'complete': return 'success';
    case 'archived': return 'destructive';
    default: return 'muted'; // draft + anything unknown
  }
}

function statusLabel(status: string): string {
  return SHIPMENT_STATUS_LABELS[status] ?? status;
}

function formatDate(d?: string): string {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatDateTime(d?: string): string {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
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

const STAT_TONES = {
  draft: 'bg-muted text-muted-foreground',
  ready: 'bg-warning/15 text-warning',
  in_progress: 'bg-info/15 text-info',
  complete: 'bg-success/15 text-success',
  issue: 'bg-destructive/10 text-destructive',
  archived: 'bg-warning/15 text-warning',
} as const;

const ACTIVE_STATUSES = new Set(['ready', 'in_progress']);

const MARKER_COLORS: Record<StatusVariant, string> = {
  info: '#3b82f6',
  success: '#22c55e',
  warning: '#eab308',
  destructive: '#ef4444',
  muted: '#94a3b8',
};

const COLOR_ROUTE = '#a855f7';

interface LaneGeo {
  origin: [number, number] | null;
  destination: [number, number] | null;
  stops: [number, number][];
  route: [number, number][] | null;
}

export default function VNextShipments() {
  const navigate = useNavigate();
  const { hasPermission } = useCurrentUser();
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);
  const laneLinesRef = useRef<L.LayerGroup | null>(null);
  const laneFetchedIds = useRef<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [createdFrom, setCreatedFrom] = useState('');
  const [createdTo, setCreatedTo] = useState('');
  const [updatedFrom, setUpdatedFrom] = useState('');
  const [updatedTo, setUpdatedTo] = useState('');
  const [sortBy, setSortBy] = useState<SortField>('createdAt');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [viewMode, setViewMode] = useState<'table' | 'map'>('table');
  const [mapActiveOnly, setMapActiveOnly] = useState(false);
  const [mapLaneFilter, setMapLaneFilter] = useState('all');
  const [showLanes, setShowLanes] = useState(true);
  const [showRoutes, setShowRoutes] = useState(true);
  const [laneGeo, setLaneGeo] = useState<Record<string, LaneGeo>>({});
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [shipmentTypes, setShipmentTypes] = useState<Record<string, ShipmentTypeSummary>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState('');
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkArchiving, setBulkArchiving] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);

  useEffect(() => {
    fetch(`${API_URL}/api/v1/shipment-types`)
      .then(r => r.json())
      .then(j => {
        const map: Record<string, ShipmentTypeSummary> = {};
        (j.data || []).forEach((t: ShipmentTypeSummary) => {
          map[t.id] = t;
        });
        setShipmentTypes(map);
      })
      .catch(() => {});
  }, []);

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
        // Archived shipments are excluded here by default — they're admin
        // territory, surfaced on /settings/archives instead.
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
    return () => {
      cancelled = true;
    };
  }, [createdFrom, createdTo, updatedFrom, updatedTo, sortBy, sortOrder, refreshKey]);

  const statusCounts = useMemo(() => ({
    all: shipments.length,
    draft: shipments.filter(s => s.status === 'draft').length,
    ready: shipments.filter(s => s.status === 'ready').length,
    in_progress: shipments.filter(s => s.status === 'in_progress').length,
    complete: shipments.filter(s => s.status === 'complete').length,
    issue: shipments.filter(s => !!s.hasException).length,
  }), [shipments]);

  // Callback ref (not a plain useRef + mount-effect): the map container is behind
  // the `loading` early-return below, so a `useEffect(..., [])` fires once at
  // first mount - while still loading and the container doesn't exist yet - and
  // never gets another chance to run once the real DOM node shows up. A callback
  // ref instead fires exactly when the node attaches/detaches, however that comes
  // about (initial load, or a later refetch that re-triggers the loading branch).
  const mapCleanupRef = useRef<(() => void) | null>(null);
  const setMapRef = useCallback((node: HTMLDivElement | null) => {
    if (node) {
      if (mapInstance.current) return;
      const map = L.map(node, { zoomControl: true, attributionControl: false, ...worldBoundsMapOptions }).setView([39.5, -98.5], 4);
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 19,
        ...noWrapTileOptions,
      }).addTo(map);
      capWorldZoomOut(map);
      // Lane lines are added first so shipment markers paint on top of them.
      laneLinesRef.current = L.layerGroup().addTo(map);
      markersRef.current = L.layerGroup().addTo(map);
      mapInstance.current = map;
      const stopSizing = keepMapSized(map, node);
      mapCleanupRef.current = () => {
        stopSizing();
        map.remove();
        mapInstance.current = null;
        markersRef.current = null;
        laneLinesRef.current = null;
      };
    } else {
      mapCleanupRef.current?.();
      mapCleanupRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (viewMode === 'map' && mapInstance.current) {
      setTimeout(() => mapInstance.current?.invalidateSize(), 100);
    }
  }, [viewMode]);

  const sortedShipmentTypes = useMemo(
    () => Object.values(shipmentTypes).sort((a, b) => a.name.localeCompare(b.name)),
    [shipmentTypes],
  );

  const filtered = shipments.filter(s => {
    if (statusFilter === 'issue') {
      if (!s.hasException) return false;
    } else if (statusFilter !== 'all' && s.status !== statusFilter) {
      return false;
    }
    if (typeFilter !== 'all' && (s.shipmentTypeId || '') !== typeFilter) {
      return false;
    }
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

  const lanesInView = useMemo(() => {
    const byId = new Map<string, string>();
    shipments.forEach(s => {
      if (s.lane?.id) byId.set(s.lane.id, s.lane.name);
    });
    return Array.from(byId, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [shipments]);

  const mapShipments = useMemo(() => filtered.filter(s => {
    if (mapActiveOnly && !ACTIVE_STATUSES.has(s.status)) return false;
    if (mapLaneFilter !== 'all' && s.lane?.id !== mapLaneFilter) return false;
    return true;
  }), [filtered, mapActiveOnly, mapLaneFilter]);

  useEffect(() => {
    if (!markersRef.current) return;
    markersRef.current.clearLayers();
    mapShipments.forEach(s => {
      const lat = s.origin?.lat;
      const lng = s.origin?.lng;
      if (lat == null || lng == null) return;
      const color = MARKER_COLORS[statusVariant(s.status)];
      const icon = L.divIcon({
        className: '',
        html: `<div style="width:14px;height:14px;border-radius:50%;background:${color};border:3px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.3);"></div>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      });
      const originLabel = s.origin ? `${s.origin.city}, ${s.origin.state}` : '';
      const destLabel = s.destination ? `${s.destination.city}, ${s.destination.state}` : '';
      L.marker([lat, lng], { icon }).addTo(markersRef.current!)
        .bindPopup(`<strong>${s.reference || s.id}</strong><br/>${originLabel} -> ${destLabel}<br/><em>${s.status}</em>`);
    });
  }, [mapShipments]);

  // Lanes with at least one currently-visible shipment - drives both which
  // lane lines get drawn and which lanes' geometry we bother fetching.
  const visibleLaneIds = useMemo(() => {
    const ids = new Set<string>();
    mapShipments.forEach(s => { if (s.lane?.id) ids.add(s.lane.id); });
    return ids;
  }, [mapShipments]);

  // Fetch full lane geometry (origin/destination/stops coords + planned
  // route waypoints) for lanes as they come into view. The list endpoint's
  // read model doesn't carry coordinates, so each lane needs its own detail
  // call - cached by id via laneFetchedIds so switching filters back and
  // forth doesn't refetch.
  useEffect(() => {
    if (viewMode !== 'map') return;
    const toFetch = Array.from(visibleLaneIds).filter(id => !laneFetchedIds.current.has(id));
    if (toFetch.length === 0) return;
    toFetch.forEach(id => laneFetchedIds.current.add(id));
    let cancelled = false;
    Promise.all(toFetch.map(async (id) => {
      try {
        const res = await fetch(`${API_URL}/api/v1/lanes/${id}`);
        const json = await res.json();
        const lane = json.data;
        if (!lane) return null;
        const geo: LaneGeo = {
          origin: lane.origin?.lat != null && lane.origin?.lng != null ? [lane.origin.lat, lane.origin.lng] : null,
          destination: lane.destination?.lat != null && lane.destination?.lng != null ? [lane.destination.lat, lane.destination.lng] : null,
          stops: (lane.stops || [])
            .map((st: any) => st.location)
            .filter((loc: any) => loc?.lat != null && loc?.lng != null)
            .map((loc: any): [number, number] => [loc.lat, loc.lng]),
          route: Array.isArray(lane.route?.waypoints) && lane.route.waypoints.length >= 2
            ? lane.route.waypoints.map((w: any): [number, number] => [w.lat, w.lng])
            : null,
        };
        return { id, geo };
      } catch {
        return null;
      }
    })).then(results => {
      if (cancelled) return;
      setLaneGeo(prev => {
        const next = { ...prev };
        results.forEach(r => { if (r) next[r.id] = r.geo; });
        return next;
      });
    });
    return () => { cancelled = true; };
  }, [viewMode, visibleLaneIds]);

  // Draw lane straight-lines (dashed) and, where a route has been planned
  // for the lane, a solid overlay of the actual planned path - same visual
  // language as the per-shipment map on the shipment detail page.
  useEffect(() => {
    const layer = laneLinesRef.current;
    if (!layer) return;
    layer.clearLayers();
    if (!showLanes) return;
    visibleLaneIds.forEach(laneId => {
      const geo = laneGeo[laneId];
      if (!geo || !geo.origin || !geo.destination) return;
      const laneName = lanesInView.find(l => l.id === laneId)?.name || 'Lane';
      const straightCoords: [number, number][] = [geo.origin, ...geo.stops, geo.destination];

      L.polyline(straightCoords, { color: MARKER_COLORS.muted, weight: 3, opacity: 0.6, dashArray: '8 4' }).addTo(layer);

      const routeCoords = showRoutes ? geo.route : null;
      if (routeCoords && routeCoords.length >= 2) {
        L.polyline(routeCoords, { color: COLOR_ROUTE, weight: 4, opacity: 0.9 })
          .addTo(layer)
          .bindPopup(`<strong>${laneName}</strong><br/><em>Planned route</em>`);
      } else {
        L.polyline(straightCoords, { color: MARKER_COLORS.info, weight: 3 })
          .addTo(layer)
          .bindPopup(`<strong>${laneName}</strong>`);
      }

      const originIcon = L.divIcon({
        className: '',
        html: `<div style="width:12px;height:12px;border-radius:50%;background:${MARKER_COLORS.info};border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.3);"></div>`,
        iconSize: [12, 12], iconAnchor: [6, 6],
      });
      L.marker(geo.origin, { icon: originIcon }).addTo(layer).bindPopup(`<strong>${laneName}</strong><br/>Origin`);

      const destIcon = L.divIcon({
        className: '',
        html: `<div style="width:12px;height:12px;border-radius:50%;background:${MARKER_COLORS.success};border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.3);"></div>`,
        iconSize: [12, 12], iconAnchor: [6, 6],
      });
      L.marker(geo.destination, { icon: destIcon }).addTo(layer).bindPopup(`<strong>${laneName}</strong><br/>Destination`);
    });
  }, [laneGeo, visibleLaneIds, showLanes, showRoutes, lanesInView]);

  // Frame the map around whatever is actually plotted (shipment pins +
  // lane geometry) so switching views doesn't leave you staring at an
  // empty patch of ocean.
  const allMapCoords = useMemo(() => {
    const coords: [number, number][] = [];
    mapShipments.forEach(s => {
      if (s.origin?.lat != null && s.origin?.lng != null) coords.push([s.origin.lat, s.origin.lng]);
    });
    if (showLanes) {
      visibleLaneIds.forEach(id => {
        const geo = laneGeo[id];
        if (!geo) return;
        if (geo.origin) coords.push(geo.origin);
        if (geo.destination) coords.push(geo.destination);
        geo.stops.forEach(c => coords.push(c));
        if (showRoutes && geo.route) geo.route.forEach(c => coords.push(c));
      });
    }
    return coords;
  }, [mapShipments, laneGeo, visibleLaneIds, showLanes, showRoutes]);

  useEffect(() => {
    const map = mapInstance.current;
    if (!map || viewMode !== 'map' || allMapCoords.length === 0) return;
    if (allMapCoords.length === 1) {
      map.setView(allMapCoords[0], 10);
    } else {
      map.fitBounds(L.latLngBounds(allMapCoords).pad(0.15));
    }
  }, [allMapCoords, viewMode]);

  const hasDateFilters = !!(createdFrom || createdTo || updatedFrom || updatedTo);
  const clearDateFilters = () => {
    setCreatedFrom('');
    setCreatedTo('');
    setUpdatedFrom('');
    setUpdatedTo('');
  };

  const stats = [
    { key: 'draft', label: 'Draft', value: statusCounts.draft, icon: FilePenLine },
    { key: 'ready', label: 'Ready', value: statusCounts.ready, icon: CalendarCheck },
    { key: 'in_progress', label: 'In progress', value: statusCounts.in_progress, icon: Truck },
    { key: 'complete', label: 'Complete', value: statusCounts.complete, icon: CheckCircle2 },
    { key: 'issue', label: 'Issues', value: statusCounts.issue, icon: AlertTriangle },
  ] as const;

  const filteredIds = filtered.map(s => s.id);
  const selectedInView = filteredIds.filter(idv => selected.has(idv));
  const allSelected = filtered.length > 0 && selectedInView.length === filtered.length;

  const toggleOne = (shipmentId: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(shipmentId)) next.delete(shipmentId); else next.add(shipmentId);
      return next;
    });
  };

  const toggleAll = () => {
    setSelected(prev => {
      const next = new Set(prev);
      if (allSelected) {
        filteredIds.forEach(idv => next.delete(idv));
      } else {
        filteredIds.forEach(idv => next.add(idv));
      }
      return next;
    });
  };

  const clearSelection = () => setSelected(new Set());

  const handleBulkApply = async () => {
    if (!bulkStatus || selected.size === 0) return;
    setBulkBusy(true);
    try {
      const ids = Array.from(selected);
      const res = await fetch(`${API_URL}/api/v1/shipments/bulk-transition`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids, toStatus: bulkStatus }),
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        toast.error(json.error || 'Bulk update failed', { duration: 8000 });
        return;
      }
      const results: Array<{ id: string; success: boolean; error: string | null }> = json.data?.results ?? [];
      const ok = results.filter(r => r.success);
      const failed = results.filter(r => !r.success);
      if (failed.length === 0) {
        toast.success(`${ok.length} shipment${ok.length === 1 ? '' : 's'} moved to ${statusLabel(bulkStatus)}`);
      } else {
        // Surface the first distinct reason so skips aren't silent.
        const reason = failed[0]?.error ?? 'blocked';
        toast.warning(
          `${ok.length} moved, ${failed.length} skipped. e.g. ${reason}`,
          { duration: 9000 },
        );
      }
      clearSelection();
      setBulkStatus('');
      setRefreshKey(k => k + 1);
    } catch {
      toast.error('Bulk update failed');
    } finally {
      setBulkBusy(false);
    }
  };

  const handleBulkArchive = async () => {
    if (selected.size === 0) return;
    setBulkArchiving(true);
    try {
      const ids = Array.from(selected);
      const res = await fetch(`${API_URL}/api/v1/shipments/bulk-archive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        toast.error(json.error || 'Bulk archive failed', { duration: 8000 });
        return;
      }
      const results: Array<{ id: string; success: boolean; error: string | null }> = json.data?.results ?? [];
      const ok = results.filter(r => r.success);
      const failed = results.filter(r => !r.success);
      if (failed.length === 0) {
        toast.success(`${ok.length} shipment${ok.length === 1 ? '' : 's'} archived`);
      } else {
        const reason = failed[0]?.error ?? 'blocked';
        toast.warning(`${ok.length} archived, ${failed.length} skipped. e.g. ${reason}`, { duration: 9000 });
      }
      clearSelection();
      setRefreshKey(k => k + 1);
    } catch {
      toast.error('Bulk archive failed');
    } finally {
      setBulkArchiving(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selected.size === 0) return;
    setBulkDeleting(true);
    try {
      const ids = Array.from(selected);
      const res = await fetch(`${API_URL}/api/v1/shipments/bulk-delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        toast.error(json.error || 'Bulk delete failed', { duration: 8000 });
        return;
      }
      const results: Array<{ id: string; success: boolean; error: string | null }> = json.data?.results ?? [];
      const ok = results.filter(r => r.success);
      const failed = results.filter(r => !r.success);
      if (failed.length === 0) {
        toast.success(`${ok.length} shipment${ok.length === 1 ? '' : 's'} deleted`);
      } else {
        const reason = failed[0]?.error ?? 'blocked';
        toast.warning(`${ok.length} deleted, ${failed.length} skipped. e.g. ${reason}`, { duration: 9000 });
      }
      clearSelection();
      setRefreshKey(k => k + 1);
    } catch {
      toast.error('Bulk delete failed');
    } finally {
      setBulkDeleting(false);
      setConfirmBulkDelete(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-3 py-24 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin" />
        <h3 className="text-lg font-medium">Loading...</h3>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-3 rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
        <CircleAlert className="h-5 w-5" />
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Shipments</h1>
          <p className="mt-1 text-sm text-muted-foreground">{shipments.length} total shipments</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => exportShipmentsCsv(filtered)}>
            <Download className="h-4 w-4" />
            Export
          </Button>
          <Button variant="gradient" onClick={() => navigate('/shipments/create')}>
            <Plus className="h-4 w-4" />
            New shipment
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {stats.map(stat => {
          const Icon = stat.icon;
          const isActive = statusFilter === stat.key;
          return (
            <Card
              key={stat.key}
              className={cn('cursor-pointer transition-colors', isActive ? 'border-primary' : 'hover:border-primary/40')}
            >
              <button
                type="button"
                onClick={() => setStatusFilter(isActive ? 'all' : stat.key)}
                className="block w-full p-5 text-left"
              >
                <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg', STAT_TONES[stat.key])}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="mt-3 text-2xl font-bold tracking-tight">{stat.value}</div>
                <div className="mt-1 text-sm text-muted-foreground">{stat.label}</div>
              </button>
            </Card>
          );
        })}
      </div>

      <Card className={cn(viewMode !== 'map' && 'w-fit')}>
        <div className="flex flex-wrap items-center gap-3 p-4">
          <div className="inline-flex rounded-md border border-input">
            <Button
              variant={viewMode === 'table' ? 'secondary' : 'ghost'}
              size="sm"
              className="rounded-r-none"
              onClick={() => setViewMode('table')}
            >
              <ListIcon className="h-4 w-4" />
              Table
            </Button>
            <Separator orientation="vertical" />
            <Button
              variant={viewMode === 'map' ? 'secondary' : 'ghost'}
              size="sm"
              className="rounded-l-none"
              onClick={() => setViewMode('map')}
            >
              <MapIcon className="h-4 w-4" />
              Map
            </Button>
          </div>

          {viewMode === 'map' && (
            <>
              <Separator orientation="vertical" className="h-6" />

              <div className="inline-flex rounded-md border border-input">
                <Button
                  variant={!mapActiveOnly ? 'secondary' : 'ghost'}
                  size="sm"
                  className="rounded-r-none"
                  onClick={() => setMapActiveOnly(false)}
                >
                  All shipments
                </Button>
                <Separator orientation="vertical" />
                <Button
                  variant={mapActiveOnly ? 'secondary' : 'ghost'}
                  size="sm"
                  className="rounded-l-none"
                  onClick={() => setMapActiveOnly(true)}
                >
                  Active only
                </Button>
              </div>

              <Select value={mapLaneFilter} onValueChange={setMapLaneFilter}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="All lanes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All lanes</SelectItem>
                  {lanesInView.map(l => (
                    <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <label className="flex cursor-pointer select-none items-center gap-1.5 text-sm">
                <input
                  type="checkbox"
                  checked={showLanes}
                  onChange={e => setShowLanes(e.target.checked)}
                  className="h-4 w-4 rounded border border-input bg-background accent-primary"
                />
                <span className="inline-block h-0.5 w-4 rounded-full" style={{ background: MARKER_COLORS.info }} />
                Lanes
              </label>
              <label className={cn('flex select-none items-center gap-1.5 text-sm', showLanes ? 'cursor-pointer' : 'cursor-not-allowed opacity-50')}>
                <input
                  type="checkbox"
                  checked={showRoutes}
                  disabled={!showLanes}
                  onChange={e => setShowRoutes(e.target.checked)}
                  className="h-4 w-4 rounded border border-input bg-background accent-primary"
                />
                <span className="inline-block h-0.5 w-4 rounded-full" style={{ background: COLOR_ROUTE }} />
                Planned routes
              </label>

              <span className="ml-auto text-sm text-muted-foreground">
                {mapShipments.length} of {filtered.length} shown on map
              </span>
            </>
          )}
        </div>
      </Card>

      <div className={cn('rounded-lg border border-border bg-card', viewMode !== 'map' && 'hidden')}>
        <div ref={setMapRef} className="h-[600px] w-full overflow-hidden rounded-lg" />
      </div>

      <Card className={cn(viewMode !== 'table' && 'hidden')}>
        <div className="flex flex-wrap items-center gap-3 p-4">
          <div className="relative min-w-[280px] max-w-sm flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by ID, customer, origin, destination, carrier..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses ({statusCounts.all})</SelectItem>
              <SelectItem value="draft">Draft ({statusCounts.draft})</SelectItem>
              <SelectItem value="ready">Ready ({statusCounts.ready})</SelectItem>
              <SelectItem value="in_progress">In progress ({statusCounts.in_progress})</SelectItem>
              <SelectItem value="complete">Complete ({statusCounts.complete})</SelectItem>
              <SelectItem value="issue">Issues ({statusCounts.issue})</SelectItem>
            </SelectContent>
          </Select>

          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {sortedShipmentTypes.map(t => (
                <SelectItem key={t.id} value={t.id}>
                  <span className="inline-flex items-center gap-2">
                    <span
                      className="inline-flex h-2 w-2 rounded-full"
                      style={{ background: t.color }}
                    />
                    {t.name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={sortBy} onValueChange={v => setSortBy(v as SortField)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="createdAt">Sort: Created</SelectItem>
              <SelectItem value="updatedAt">Sort: Updated</SelectItem>
              <SelectItem value="pickupDate">Sort: Pickup</SelectItem>
              <SelectItem value="deliveryDate">Sort: Delivery</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="icon"
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            title={sortOrder === 'asc' ? 'Ascending (oldest first)' : 'Descending (newest first)'}
            aria-label="Toggle sort order"
          >
            {sortOrder === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
          </Button>
        </div>

        <Separator />

        <div className="grid grid-cols-[110px_170px_24px_170px_auto] items-center gap-3 px-4 py-3 text-sm md:px-6">
          <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Created</div>
          <DatePicker
            type="date"
            value={createdFrom}
            onChange={e => setCreatedFrom(e.target.value)}
            aria-label="Created from"
          />
          <div className="text-center text-xs text-muted-foreground">to</div>
          <DatePicker
            type="date"
            value={createdTo}
            onChange={e => setCreatedTo(e.target.value)}
            aria-label="Created to"
          />
          <div className="justify-self-end">
            {hasDateFilters && (
              <Button variant="ghost" size="sm" onClick={clearDateFilters}>
                <X className="h-4 w-4" />
                Clear
              </Button>
            )}
          </div>

          <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Updated</div>
          <DatePicker
            type="date"
            value={updatedFrom}
            onChange={e => setUpdatedFrom(e.target.value)}
            aria-label="Updated from"
          />
          <div className="text-center text-xs text-muted-foreground">to</div>
          <DatePicker
            type="date"
            value={updatedTo}
            onChange={e => setUpdatedTo(e.target.value)}
            aria-label="Updated to"
          />
          <div />
        </div>

        <Separator />

        {selected.size > 0 && (
          <div className="flex flex-wrap items-center gap-3 border-b border-border bg-muted/40 px-4 py-3 md:px-6">
            <span className="text-sm font-medium">{selected.size} selected</span>
            <Button variant="ghost" size="sm" onClick={clearSelection}>
              <X className="h-4 w-4" />
              Clear
            </Button>
            <div className="ml-auto flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Move to</span>
              <Select value={bulkStatus} onValueChange={setBulkStatus}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Select status..." />
                </SelectTrigger>
                <SelectContent>
                  {SHIPMENT_LIFECYCLE.map(st => (
                    <SelectItem key={st} value={st}>{statusLabel(st)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="gradient"
                size="sm"
                disabled={!bulkStatus || bulkBusy}
                onClick={handleBulkApply}
              >
                {bulkBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Apply'}
              </Button>
              {hasPermission('shipments:write') && (
                <Button variant="outline" size="sm" disabled={bulkArchiving} onClick={handleBulkArchive}>
                  {bulkArchiving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Archive className="h-4 w-4" />}
                  Archive
                </Button>
              )}
              {hasPermission('shipments:delete') && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={bulkDeleting}
                  onClick={() => setConfirmBulkDelete(true)}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </Button>
              )}
            </div>
          </div>
        )}

        {viewMode === 'table' && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <input
                    type="checkbox"
                    aria-label="Select all shipments"
                    className="h-4 w-4 cursor-pointer accent-primary"
                    checked={allSelected}
                    ref={el => { if (el) el.indeterminate = selectedInView.length > 0 && !allSelected; }}
                    onChange={toggleAll}
                  />
                </TableHead>
                <TableHead>Shipment</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Route</TableHead>
                <TableHead>Carrier</TableHead>
                <TableHead>Lane</TableHead>
                <TableHead>Dates</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(s => {
                const type = s.shipmentTypeId ? shipmentTypes[s.shipmentTypeId] : null;
                return (
                  <TableRow
                    key={s.id}
                    onClick={() => navigate(`/shipments/${s.id}`)}
                    className={cn('cursor-pointer', selected.has(s.id) && 'bg-primary/5')}
                  >
                    <TableCell onClick={e => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        aria-label={`Select ${s.reference || s.id}`}
                        className="h-4 w-4 cursor-pointer accent-primary"
                        checked={selected.has(s.id)}
                        onChange={() => toggleOne(s.id)}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 font-mono text-sm font-semibold">
                        {type && (
                          <span
                            className="inline-flex h-2 w-2 rounded-full"
                            style={{ background: type.color }}
                            title={type.name}
                          />
                        )}
                        {s.reference || s.id}
                      </div>
                    </TableCell>
                    <TableCell>{s.customer?.name || '-'}</TableCell>
                    <TableCell>
                      <div className="text-sm">{s.origin ? `${s.origin.city}, ${s.origin.state}` : '-'}</div>
                      <div className="text-xs text-muted-foreground">
                        to {s.destination ? `${s.destination.city}, ${s.destination.state}` : '-'}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      <div>{s.carrier?.name || '-'}</div>
                      {s.proNumber && <div className="text-xs text-muted-foreground">PRO# {s.proNumber}</div>}
                    </TableCell>
                    <TableCell>
                      {s.lane ? <Badge variant="muted">{s.lane.name}</Badge> : '-'}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <div className="text-sm">{formatDate(s.pickupDate)}</div>
                      <div className="text-xs text-muted-foreground">to {formatDate(s.deliveryDate)}</div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                      {formatDateTime(s.updatedAt)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <Badge variant={statusVariant(s.status)}>{statusLabel(s.status)}</Badge>
                        {s.hasException && (
                          <Badge variant="destructive" className="gap-1" title="Has an open exception">
                            <AlertTriangle className="h-3 w-3" />
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}

        {viewMode === 'table' && filtered.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-12 text-muted-foreground">
            <SearchX className="h-8 w-8" />
            <h3 className="text-base font-medium">No shipments found</h3>
            <p className="text-sm">Try adjusting your search or filters</p>
          </div>
        )}
      </Card>

      {/* Bulk soft-delete confirmation (admin) */}
      <Dialog open={confirmBulkDelete} onOpenChange={setConfirmBulkDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {selected.size} shipment{selected.size === 1 ? '' : 's'}?</DialogTitle>
            <DialogDescription>
              Selected shipments will be removed from all views. Records are retained for audit
              but cannot be restored from the UI. This is different from archiving.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmBulkDelete(false)} disabled={bulkDeleting}>Cancel</Button>
            <Button variant="destructive" onClick={handleBulkDelete} disabled={bulkDeleting}>
              {bulkDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Delete {selected.size} shipment{selected.size === 1 ? '' : 's'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
