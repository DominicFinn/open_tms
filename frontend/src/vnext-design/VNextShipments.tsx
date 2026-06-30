import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  AlertTriangle,
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
  Truck,
  X,
} from 'lucide-react';

import { toast } from 'sonner';

import { API_URL } from '../api';
import { SHIPMENT_LIFECYCLE, SHIPMENT_STATUS_LABELS } from '../shared/shipmentTypeValidator';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { DatePicker } from '@/components/ui/date-picker';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
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
import { keepMapSized } from '../lib/leafletMap';

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

type StatusVariant = 'success' | 'info' | 'warning' | 'destructive' | 'muted';

// Canonical lifecycle: draft -> ready -> in_progress -> complete.
function statusVariant(status: string): StatusVariant {
  switch (status) {
    case 'ready': return 'warning';
    case 'in_progress': return 'info';
    case 'complete': return 'success';
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
} as const;

const MARKER_COLORS: Record<StatusVariant, string> = {
  info: '#3b82f6',
  success: '#22c55e',
  warning: '#eab308',
  destructive: '#ef4444',
  muted: '#94a3b8',
};

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
  const [refreshKey, setRefreshKey] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState('');
  const [bulkBusy, setBulkBusy] = useState(false);

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

  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;
    const map = L.map(mapRef.current, { zoomControl: true, attributionControl: false }).setView([39.5, -98.5], 4);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
    }).addTo(map);
    markersRef.current = L.layerGroup().addTo(map);
    mapInstance.current = map;
    const stopSizing = keepMapSized(map, mapRef.current);
    return () => {
      stopSizing();
      map.remove();
      mapInstance.current = null;
      markersRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!markersRef.current) return;
    markersRef.current.clearLayers();
    shipments.forEach(s => {
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
  }, [shipments]);

  useEffect(() => {
    if (viewMode === 'map' && mapInstance.current) {
      setTimeout(() => mapInstance.current?.invalidateSize(), 100);
    }
  }, [viewMode]);

  const filtered = shipments.filter(s => {
    if (statusFilter === 'issue') {
      if (!s.hasException) return false;
    } else if (statusFilter !== 'all' && s.status !== statusFilter) {
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

      <div className={cn('rounded-lg border border-border bg-card', viewMode !== 'map' && 'hidden')}>
        <div ref={mapRef} className="h-[600px] w-full overflow-hidden rounded-lg" />
      </div>

      <Card>
        <div className="flex flex-wrap items-center gap-3 p-4">
          <div className="relative min-w-[280px] flex-1">
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

          <div className="ml-auto inline-flex rounded-md border border-input">
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
                <TableHead>Pickup</TableHead>
                <TableHead>Delivery</TableHead>
                <TableHead>PRO #</TableHead>
                <TableHead>Created</TableHead>
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
                    <TableCell className="text-sm">{s.carrier?.name || '-'}</TableCell>
                    <TableCell>
                      {s.lane ? <Badge variant="muted">{s.lane.name}</Badge> : '-'}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm">{formatDate(s.pickupDate)}</TableCell>
                    <TableCell className="whitespace-nowrap text-sm">{formatDate(s.deliveryDate)}</TableCell>
                    <TableCell className="text-sm">{s.proNumber || '-'}</TableCell>
                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                      {formatDateTime(s.createdAt)}
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
    </div>
  );
}
