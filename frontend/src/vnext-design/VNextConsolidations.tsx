import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CircleAlert, Container, Loader2, Plus } from 'lucide-react';

import { API_URL } from '../api';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import ConsolidationShipmentPicker from './ConsolidationShipmentPicker';
import { consolidationStatusVariant } from './consolidationStatus';

interface ConsolidationRow {
  id: string;
  reference: string;
  status: string;
  archived: boolean;
  carrierName: string | null;
  shipmentCount: number;
  customerCount: number;
  customerNames: string[];
  stopCount: number;
  firstStopName: string | null;
  lastStopName: string | null;
  pickupDate: string | null;
  deliveryDate: string | null;
  createdAt: string;
}

const PER_PAGE = 25;
const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString() : '—');

export default function VNextConsolidations() {
  const navigate = useNavigate();
  const { hasPermission } = useCurrentUser();
  const [rows, setRows] = useState<ConsolidationRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [view, setView] = useState<'active' | 'archived'>('active');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ page: String(page), perPage: String(PER_PAGE), archived: String(view === 'archived') });
        const res = await fetch(`${API_URL}/api/v1/consolidations?${params}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || `Failed to load consolidations (${res.status})`);
        if (cancelled) return;
        setRows(json.data || []);
        setTotal(json.meta?.total ?? 0);
        setError(null);
      } catch (err: any) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [page, view]);

  async function createFrom(shipmentIds: string[]): Promise<string | null> {
    const res = await fetch(`${API_URL}/api/v1/consolidations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shipmentIds }),
    });
    const json = await res.json();
    if (!res.ok) return json.error || 'Could not create the consolidation.';
    navigate(`/consolidations/${json.data.id}`);
    return null;
  }

  const pages = Math.max(1, Math.ceil(total / PER_PAGE));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Consolidations</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Truck runs carrying several shipments, each still its own customer's.
          </p>
        </div>
        {hasPermission('shipments:write') && (
          <Button variant="gradient" onClick={() => setPicking(true)}>
            <Plus className="h-4 w-4" />
            New consolidation
          </Button>
        )}
      </div>

      <Card>
        <div className="flex items-center justify-between gap-3 p-4">
          <span className="text-sm text-muted-foreground">{total} {view === 'archived' ? 'archived' : 'active'}</span>
          <Select value={view} onValueChange={(v) => { setView(v as 'active' | 'archived'); setPage(1); }}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Separator />

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" /> Loading...
          </div>
        ) : error ? (
          <div className="m-4 flex items-center gap-3 rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            <CircleAlert className="h-5 w-5" /> {error}
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16 text-center text-muted-foreground">
            <Container className="h-8 w-8" />
            <p className="text-sm">No {view === 'archived' ? 'archived ' : ''}consolidations yet.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Reference</TableHead>
                <TableHead>Route</TableHead>
                <TableHead>Customers</TableHead>
                <TableHead className="text-right">Shipments</TableHead>
                <TableHead className="text-right">Stops</TableHead>
                <TableHead>Pickup</TableHead>
                <TableHead>Delivery</TableHead>
                <TableHead>Carrier</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id} className="cursor-pointer" onClick={() => navigate(`/consolidations/${r.id}`)}>
                  <TableCell className="whitespace-nowrap font-medium">{r.reference}</TableCell>
                  <TableCell className="max-w-[280px] truncate text-sm" title={`${r.firstStopName ?? ''} → ${r.lastStopName ?? ''}`}>
                    {r.firstStopName ?? '—'} → {r.lastStopName ?? '—'}
                  </TableCell>
                  <TableCell className="max-w-[220px] truncate text-sm" title={r.customerNames.join(', ')}>
                    {r.customerNames.join(', ') || '—'}
                  </TableCell>
                  <TableCell className="text-right">{r.shipmentCount}</TableCell>
                  <TableCell className="text-right">{r.stopCount}</TableCell>
                  <TableCell className="whitespace-nowrap text-sm">{day(r.pickupDate)}</TableCell>
                  <TableCell className="whitespace-nowrap text-sm">{day(r.deliveryDate)}</TableCell>
                  <TableCell className="text-sm">{r.carrierName ?? '—'}</TableCell>
                  <TableCell>
                    <Badge variant={r.archived ? 'muted' : consolidationStatusVariant(r.status)} className="capitalize">
                      {r.archived ? 'archived' : r.status.replace('_', ' ')}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {pages > 1 && (
          <div className="flex items-center justify-end gap-2 border-t p-3 text-sm">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
            <span className="text-muted-foreground">Page {page} of {pages}</span>
            <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</Button>
          </div>
        )}
      </Card>

      <ConsolidationShipmentPicker
        open={picking}
        onOpenChange={setPicking}
        title="New consolidation"
        confirmLabel="Create consolidation"
        onConfirm={createFrom}
      />
    </div>
  );
}
