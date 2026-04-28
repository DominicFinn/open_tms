import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronRight,
  Clock,
  Flag,
  Loader2,
  Package,
} from 'lucide-react';

import { API_URL } from '../api';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export default function WarehouseArchive() {
  const navigate = useNavigate();
  const [shipments, setShipments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const locationId = (() => {
    try {
      return JSON.parse(localStorage.getItem('warehouse_location') || '{}').id;
    } catch { return ''; }
  })();

  useEffect(() => {
    async function load() {
      try {
        const params = new URLSearchParams();
        if (locationId) params.set('locationId', locationId);
        const res = await fetch(`${API_URL}/api/v1/warehouse/shipments/archive?${params}`);
        const json = await res.json();
        setShipments(json.data || []);
      } catch {
        // ignore
      }
      setLoading(false);
    }
    load();
  }, [locationId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4 px-1 py-2 pb-24">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Archive</h1>
          <p className="text-sm text-muted-foreground">Shipments idle &gt;2 days</p>
        </div>
      </div>

      {shipments.length === 0 ? (
        <Card className="flex flex-col items-center gap-2 py-12 text-center">
          <Package className="h-12 w-12 text-muted-foreground" />
          <p className="text-base font-semibold">No stale shipments</p>
          <p className="px-6 text-sm text-muted-foreground">
            All shipments are being processed on time.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {shipments.map(s => {
            const hasFlags = s.flags?.length > 0;
            return (
              <Card
                key={s.id}
                onClick={() => navigate(`/warehouse/shipments/${s.id}`)}
                className={cn(
                  'cursor-pointer p-4 transition-colors active:bg-muted/50',
                  hasFlags && 'border-warning/40',
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="truncate text-base font-bold">{s.reference}</span>
                  <Badge variant="muted" className="px-3 py-1 text-sm capitalize">
                    {s.status}
                  </Badge>
                </div>
                <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                  <span className="truncate">{s.origin?.name || '-'}</span>
                  <ChevronRight className="h-4 w-4 shrink-0" />
                  <span className="truncate">{s.destination?.name || '-'}</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <Clock className="h-4 w-4" />
                    Created {new Date(s.createdAt).toLocaleDateString()}
                  </span>
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
      )}

      <div className="text-center text-xs text-muted-foreground">
        {shipments.length} stale shipment{shipments.length !== 1 ? 's' : ''}
      </div>
    </div>
  );
}
