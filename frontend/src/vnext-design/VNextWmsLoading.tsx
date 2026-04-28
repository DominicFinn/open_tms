import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Truck } from 'lucide-react';

import { API_URL } from '../api';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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

interface StagingAssignment {
  id: string;
  orderRef: string;
  shipmentRef: string | null;
  stagingBinLabel: string;
  loadSequence: number | null;
  status: string;
  packedAt: string;
}

type BadgeVariant = 'success' | 'info' | 'warning' | 'destructive' | 'muted' | 'secondary' | 'default';

function statusVariant(status: string): BadgeVariant {
  switch (status) {
    case 'staged': return 'info';
    case 'loading': return 'warning';
    case 'loaded': return 'success';
    case 'dispatched': return 'default';
    default: return 'secondary';
  }
}

function formatStatus(s: string): string {
  return s.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

export default function VNextWmsLoading() {
  const navigate = useNavigate();
  const [assignments, setAssignments] = useState<StagingAssignment[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedLocation, setSelectedLocation] = useState('');
  const [locations, setLocations] = useState<Array<{ id: string; name: string }>>([]);

  useEffect(() => {
    fetch(`${API_URL}/api/v1/locations`)
      .then(r => r.json())
      .then(res => {
        const locs = (res.data || []).filter(
          (l: any) => !l.locationType || ['warehouse', 'distribution_centre', 'cross_dock'].includes(l.locationType)
        );
        setLocations(locs);
        if (locs.length > 0) setSelectedLocation(locs[0].id);
        else setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedLocation) return;
    setLoading(true);
    fetch(`${API_URL}/api/v1/staging?locationId=${selectedLocation}`)
      .then(r => r.json())
      .then(res => setAssignments((res.data || []).map((a: any) => ({
        ...a,
        orderRef: a.orderId?.slice(0, 8) ?? '',
        shipmentRef: a.shipmentId?.slice(0, 8) ?? null,
        stagingBinLabel: a.stagingBin?.label ?? '',
        packedAt: a.createdAt,
      }))))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [selectedLocation]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Loading</h1>
        <p className="mt-1 text-sm text-muted-foreground">Staging and loading for outbound shipments</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Select value={selectedLocation} onValueChange={setSelectedLocation}>
          <SelectTrigger className="w-[260px]">
            <SelectValue placeholder="Select location" />
          </SelectTrigger>
          <SelectContent>
            {locations.map(l => (
              <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex flex-col items-center gap-3 py-24 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : assignments.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <Truck className="h-12 w-12 text-muted-foreground" />
            <h3 className="text-base font-medium">No staged orders</h3>
            <p className="text-sm text-muted-foreground">
              Packed orders are staged in the shipping dock area before being loaded onto outbound vehicles. Orders appear here after packing is complete.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order</TableHead>
                <TableHead>Shipment</TableHead>
                <TableHead>Staging Bin</TableHead>
                <TableHead>Load Seq</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Packed At</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {assignments.map(a => (
                <TableRow key={a.id} className="cursor-pointer">
                  <TableCell className="font-mono text-sm font-semibold">{a.orderRef}</TableCell>
                  <TableCell>{a.shipmentRef || 'Not assigned'}</TableCell>
                  <TableCell>{a.stagingBinLabel}</TableCell>
                  <TableCell>{a.loadSequence ?? '-'}</TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(a.status)}>{formatStatus(a.status)}</Badge>
                  </TableCell>
                  <TableCell>{new Date(a.packedAt).toLocaleString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
