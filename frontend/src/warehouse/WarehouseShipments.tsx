import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building2,
  Calendar,
  Camera,
  CheckCircle2,
  ChevronRight,
  Flag,
  Keyboard,
  Loader2,
  Package,
  Radio,
  Receipt,
  Search,
  SearchX,
  X,
} from 'lucide-react';

import { API_URL } from '../api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useBarcodeScanner } from './useBarcodeScanner';
import { CameraScannerModal } from './CameraScannerModal';

const STATUS_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'To Do' },
  { value: 'launched', label: 'Launched' },
  { value: 'flagged', label: 'Flagged' },
] as const;

type StatusFilter = (typeof STATUS_FILTERS)[number]['value'];

export default function WarehouseShipments() {
  const navigate = useNavigate();
  const [shipments, setShipments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [cameraOpen, setCameraOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const locationId = (() => {
    try {
      return JSON.parse(localStorage.getItem('warehouse_location') || '{}').id;
    } catch { return ''; }
  })();

  const loadShipments = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ locationId });
      if (search) params.set('search', search);
      const res = await fetch(`${API_URL}/api/v1/warehouse/shipments?${params}`);
      const json = await res.json();
      setShipments(json.data || []);
    } catch {
      // Ignore - will show empty
    }
    setLoading(false);
  }, [locationId, search]);

  useEffect(() => {
    loadShipments();
    // Refresh every 30s
    const interval = setInterval(loadShipments, 30000);
    return () => clearInterval(interval);
  }, [loadShipments]);

  // Barcode scanner hook: when a barcode is scanned, search for it
  const handleScan = useCallback((barcode: string) => {
    setSearch(barcode);
  }, []);

  useBarcodeScanner(handleScan);

  // Filter shipments client-side by status
  const filtered = shipments.filter(s => {
    if (statusFilter === 'flagged') return s.flags?.length > 0;
    if (statusFilter === 'launched') return !!s.launchedAt;
    if (statusFilter === 'pending') return !s.launchedAt;
    return true;
  });

  function formatDate(d: string | null) {
    if (!d) return '-';
    return new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  function statusVariant(s: any): 'success' | 'warning' | 'info' | 'muted' {
    if (s.flags?.length > 0) return 'warning';
    if (s.launchedAt) return 'success';
    if (s.status === 'in_transit') return 'info';
    return 'muted';
  }

  function statusLabel(s: any) {
    if (s.launchedAt) return 'launched';
    return s.status;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4 px-1 py-2 pb-24">
      {/* Search bar */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={searchRef}
            type="text"
            placeholder="Search or scan shipment..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            inputMode="none"
            className="h-12 pl-10 pr-10 text-base"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted/40 hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <Button
          variant="outline"
          size="icon"
          className="h-12 w-12 shrink-0"
          onClick={() => setCameraOpen(true)}
          aria-label="Scan with camera"
        >
          <Camera className="h-5 w-5" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="h-12 w-12 shrink-0"
          onClick={() => {
            if (searchRef.current) {
              searchRef.current.focus();
              searchRef.current.inputMode = 'text';
            }
          }}
          aria-label="Type to search"
        >
          <Keyboard className="h-5 w-5" />
        </Button>
      </div>

      {/* Camera scanner modal */}
      <CameraScannerModal
        open={cameraOpen}
        onClose={() => setCameraOpen(false)}
        onScan={(barcode) => setSearch(barcode)}
        title="Scan Shipment"
        hint="Point camera at a shipment barcode"
      />

      {/* Filter chips */}
      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map(f => (
          <Button
            key={f.value}
            type="button"
            size="sm"
            variant={statusFilter === f.value ? 'default' : 'outline'}
            className="h-10 text-sm"
            onClick={() => setStatusFilter(f.value)}
          >
            {f.label}
          </Button>
        ))}
      </div>

      {/* Loading */}
      {loading && shipments.length === 0 && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}

      {/* Empty */}
      {!loading && filtered.length === 0 && (
        <Card className="flex flex-col items-center gap-2 py-12 text-center">
          {search ? (
            <SearchX className="h-12 w-12 text-muted-foreground" />
          ) : (
            <CheckCircle2 className="h-12 w-12 text-success" />
          )}
          <p className="text-base font-semibold">
            {search ? 'No matches' : "You're all caught up"}
          </p>
          <p className="px-6 text-sm text-muted-foreground">
            {search ? 'Try a different search or scan.' : 'No shipments need attention right now.'}
          </p>
        </Card>
      )}

      {/* Shipment list */}
      <div className="space-y-3">
        {filtered.map(s => {
          const orderCount = s.orderShipments?.length || 0;
          const unitCount = s.orderShipments?.reduce(
            (sum: number, os: any) => sum + (os.order?.trackableUnits?.length || 0), 0,
          ) || 0;
          const deviceCount = s.deviceAssignments?.length || 0;
          const hasFlags = s.flags?.length > 0;

          return (
            <Card
              key={s.id}
              onClick={() => navigate(`/warehouse/shipments/${s.id}`)}
              className={cn(
                'cursor-pointer p-4 transition-colors active:bg-muted/50',
                hasFlags && 'border-warning/40',
                s.launchedAt && 'border-success/40',
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="truncate text-base font-bold">{s.reference}</span>
                <Badge variant={statusVariant(s)} className="px-3 py-1 text-sm capitalize">
                  {statusLabel(s)}
                </Badge>
              </div>

              <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                <span className="truncate">{s.origin?.name || '-'}</span>
                <ChevronRight className="h-4 w-4 shrink-0" />
                <span className="truncate">{s.destination?.name || '-'}</span>
              </div>

              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
                {s.customer && (
                  <span className="inline-flex items-center gap-1.5">
                    <Building2 className="h-4 w-4" />
                    {s.customer.name}
                  </span>
                )}
                {s.pickupDate && (
                  <span className="inline-flex items-center gap-1.5">
                    <Calendar className="h-4 w-4" />
                    {formatDate(s.pickupDate)}
                  </span>
                )}
                {orderCount > 0 && (
                  <span className="inline-flex items-center gap-1.5">
                    <Receipt className="h-4 w-4" />
                    {orderCount} order{orderCount !== 1 ? 's' : ''}
                  </span>
                )}
                {unitCount > 0 && (
                  <span className="inline-flex items-center gap-1.5">
                    <Package className="h-4 w-4" />
                    {unitCount} unit{unitCount !== 1 ? 's' : ''}
                  </span>
                )}
                {deviceCount > 0 && (
                  <span className="inline-flex items-center gap-1.5">
                    <Radio className="h-4 w-4" />
                    {deviceCount} tracker{deviceCount !== 1 ? 's' : ''}
                  </span>
                )}
                {hasFlags && (
                  <span className="inline-flex items-center gap-1.5 text-destructive">
                    <Flag className="h-4 w-4" />
                    {s.flags.length} flag{s.flags.length !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      {/* Footer count and refresh */}
      <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
        {filtered.length > 0 && (
          <span>
            {filtered.length} shipment{filtered.length !== 1 ? 's' : ''}
          </span>
        )}
        {filtered.length > 0 && <span>·</span>}
        <button
          type="button"
          onClick={loadShipments}
          className="text-primary underline-offset-2 hover:underline"
        >
          Refresh
        </button>
      </div>
    </div>
  );
}
