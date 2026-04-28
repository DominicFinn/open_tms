import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Download,
  Loader2,
  Mail,
  Package,
  Truck,
  XCircle,
} from 'lucide-react';

import { API_URL } from '../api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

type StatusVariant = 'success' | 'warning' | 'destructive' | 'info' | 'muted';

function statusChip(status: string): { label: string; variant: StatusVariant } {
  switch ((status || '').toLowerCase()) {
    case 'in_transit': return { label: 'In Transit', variant: 'info' };
    case 'delivered': return { label: 'Delivered', variant: 'success' };
    case 'delayed': return { label: 'Delayed', variant: 'warning' };
    case 'picked_up':
    case 'pickup': return { label: 'Pickup', variant: 'warning' };
    case 'cancelled': return { label: 'Cancelled', variant: 'destructive' };
    case 'booked': return { label: 'Booked', variant: 'muted' };
    default: return { label: status || 'Unknown', variant: 'muted' };
  }
}

const STAT_TONES = {
  primary: 'bg-primary/10 text-primary',
  success: 'bg-success/15 text-success',
  info: 'bg-info/15 text-info',
  warning: 'bg-warning/15 text-warning',
} as const;

export default function VNextDailyReport() {
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const todayISO = new Date().toISOString().split('T')[0];

  const [shipments, setShipments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function fetchData() {
      try {
        let data: any[] = [];
        const summaryRes = await fetch(`${API_URL}/api/v1/reports/daily/summary?date=${todayISO}`);
        if (summaryRes.ok) {
          const summaryJson = await summaryRes.json();
          if (summaryJson.data && Array.isArray(summaryJson.data)) {
            data = summaryJson.data;
          } else if (summaryJson.data?.shipments && Array.isArray(summaryJson.data.shipments)) {
            data = summaryJson.data.shipments;
          }
        }
        if (data.length === 0) {
          const shipRes = await fetch(`${API_URL}/api/v1/shipments`);
          if (!shipRes.ok) throw new Error('Failed to load shipments');
          const shipJson = await shipRes.json();
          data = shipJson.data || [];
        }
        if (!cancelled) setShipments(data);
      } catch (e: any) {
        if (!cancelled) setError(e.message || 'Failed to load data');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchData();
    return () => { cancelled = true; };
  }, [todayISO]);

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
        <XCircle className="h-5 w-5" />
        {error}
      </div>
    );
  }

  const inTransit = shipments.filter((s: any) => s.status === 'in_transit');
  const delivered = shipments.filter((s: any) => s.status === 'delivered');
  const totalCount = shipments.length || 1;
  const deliveredPct = parseFloat(((delivered.length / totalCount) * 100).toFixed(1));
  const inTransitPct = parseFloat(((inTransit.length / totalCount) * 100).toFixed(1));

  const deliveriesDue = shipments.filter((s: any) => s.status === 'in_transit' || s.status === 'delivered').slice(0, 10);

  const stats = [
    { tone: 'primary' as const, label: 'Total Shipments', value: shipments.length, icon: Truck },
    { tone: 'success' as const, label: 'Delivered', value: `${deliveredPct}%`, icon: CheckCircle2 },
    { tone: 'info' as const, label: 'In Transit', value: inTransit.length, icon: Package },
    { tone: 'warning' as const, label: 'Delivered Today', value: delivered.length, icon: CheckCircle2 },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Daily Report</h1>
          <p className="mt-1 text-sm text-muted-foreground">{today}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Download className="h-4 w-4" />
            Export PDF
          </Button>
          <Button variant="outline">
            <Mail className="h-4 w-4" />
            Email Report
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map(stat => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label} className="p-5">
              <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg', STAT_TONES[stat.tone])}>
                <Icon className="h-5 w-5" />
              </div>
              <div className="mt-3 text-2xl font-bold tracking-tight">{stat.value}</div>
              <div className="mt-1 text-sm text-muted-foreground">{stat.label}</div>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Shipments In Transit */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Shipments In Transit</CardTitle>
            <Badge variant="info">{inTransit.length} active</Badge>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ref</TableHead>
                  <TableHead>Origin</TableHead>
                  <TableHead>Destination</TableHead>
                  <TableHead>ETA</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inTransit.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                      No shipments in transit
                    </TableCell>
                  </TableRow>
                )}
                {inTransit.slice(0, 10).map((s: any, i: number) => {
                  const chip = statusChip(s.status);
                  const origin = s.originCity && s.originState ? `${s.originCity}, ${s.originState}` : s.originCity || 'N/A';
                  const dest = s.destinationCity && s.destinationState ? `${s.destinationCity}, ${s.destinationState}` : s.destinationCity || 'N/A';
                  const eta = s.estimatedDelivery ? new Date(s.estimatedDelivery).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'N/A';
                  return (
                    <TableRow key={s.id || i}>
                      <TableCell className="font-mono text-sm font-semibold">{s.referenceNumber || `SHP-${s.id}`}</TableCell>
                      <TableCell className="text-sm">{origin}</TableCell>
                      <TableCell className="text-sm">{dest}</TableCell>
                      <TableCell className="text-sm">{eta}</TableCell>
                      <TableCell><Badge variant={chip.variant}>{chip.label}</Badge></TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Deliveries Due Today */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Deliveries Due Today</CardTitle>
            <Badge variant="success">{deliveriesDue.length} expected</Badge>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ref</TableHead>
                  <TableHead>Destination</TableHead>
                  <TableHead>Carrier</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {deliveriesDue.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">
                      No deliveries due today
                    </TableCell>
                  </TableRow>
                )}
                {deliveriesDue.map((d: any, i: number) => {
                  const chip = statusChip(d.status);
                  const dest = d.destinationCity && d.destinationState ? `${d.destinationCity}, ${d.destinationState}` : d.destinationCity || 'N/A';
                  const carrier = d.carrier?.name || d.carrierName || 'N/A';
                  return (
                    <TableRow key={d.id || i}>
                      <TableCell className="font-mono text-sm font-semibold">{d.referenceNumber || `SHP-${d.id}`}</TableCell>
                      <TableCell className="text-sm">{dest}</TableCell>
                      <TableCell className="text-sm">{carrier}</TableCell>
                      <TableCell><Badge variant={chip.variant}>{chip.label}</Badge></TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Delivery Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[
              { label: 'Delivered', value: deliveredPct, color: 'bg-success' },
              { label: 'In Transit', value: inTransitPct, color: 'bg-info' },
              { label: 'Other', value: parseFloat((100 - deliveredPct - inTransitPct).toFixed(1)), color: 'bg-warning' },
            ].map(row => (
              <div key={row.label}>
                <div className="mb-1.5 flex justify-between text-sm">
                  <span className="font-medium">{row.label}</span>
                  <span className="text-muted-foreground">{row.value}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div className={cn('h-full rounded-full transition-all', row.color)} style={{ width: `${row.value}%` }} />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
