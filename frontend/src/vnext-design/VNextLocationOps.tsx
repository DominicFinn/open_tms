/**
 * VNextLocationOps - Per-location operations dashboard.
 *
 * Shows incoming, at-location, and outgoing shipments/units for a single location.
 * Designed for distribution centre, cross-dock, and hub-and-spoke operations.
 */

import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowDown,
  ArrowUp,
  Calendar,
  Edit,
  Loader2,
  Map as MapIcon,
  Package,
  ShieldAlert,
  Snowflake,
  SquareStack,
  Truck,
  User,
  Warehouse,
  ArrowLeftRight,
} from 'lucide-react';

import { API_URL } from '../api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { getLocationTypeMeta } from './locationTypesMeta';

interface LocationOps {
  location: any;
  stats: {
    incoming: number;
    atLocation: number;
    outgoing: number;
    unitsHere: number;
    todayArrivals: number;
    todayDepartures: number;
    avgDwellMinutes: number | null;
  };
  incoming: { stops: any[]; directShipments: any[] };
  atLocation: { stops: any[]; units: any[] };
  outgoing: { shipments: any[] };
}

function formatDwell(minutes: number | null): string {
  if (minutes === null) return '--';
  if (minutes < 60) return `${minutes}m`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
  return `${Math.floor(minutes / 1440)}d ${Math.floor((minutes % 1440) / 60)}h`;
}

function DwellBadge({ minutes }: { minutes: number | null }) {
  if (minutes === null) return null;
  const cls = minutes > 240 ? 'text-destructive' : minutes > 120 ? 'text-warning' : 'text-muted-foreground';
  return (
    <span className={cn('text-xs font-semibold', cls)}>
      {formatDwell(minutes)}
    </span>
  );
}

export default function VNextLocationOps() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<LocationOps | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeSection, setActiveSection] = useState<'incoming' | 'at_location' | 'outgoing'>('at_location');

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    fetch(`${API_URL}/api/v1/locations/${id}/operations`)
      .then((r) => r.json())
      .then((json) => {
        if (!cancelled) {
          if (json.error) setError(json.error);
          else setData(json.data);
        }
      })
      .catch((err) => { if (!cancelled) setError(err.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id]);

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-3 py-24 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
        {error || 'Failed to load location'}
      </div>
    );
  }

  const { location, stats } = data;
  const typeMeta = getLocationTypeMeta(location.locationType);
  const capabilities = location.facilityCapabilities as Record<string, boolean> | null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <Warehouse className="h-7 w-7 text-primary" />
            <h1 className="text-3xl font-bold tracking-tight">{location.name}</h1>
            {typeMeta && <Badge variant="muted">{typeMeta.label}</Badge>}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {location.address1}, {location.city}{location.state ? `, ${location.state}` : ''} - {location.country}
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link to={`/locations/${id}/edit`}>
              <Edit className="h-4 w-4" />
              Edit
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/map">
              <MapIcon className="h-4 w-4" />
              Map
            </Link>
          </Button>
        </div>
      </div>

      {/* Facility info bar */}
      {(location.dockCount || capabilities || location.contactName) && (
        <div className="flex flex-wrap items-center gap-4 rounded-md bg-muted/30 px-4 py-3 text-sm">
          {location.dockCount && (
            <div className="flex items-center gap-1.5">
              <SquareStack className="h-4 w-4 text-primary" />
              {location.dockCount} docks
            </div>
          )}
          {capabilities?.crossDockCapable && (
            <div className="flex items-center gap-1.5">
              <ArrowLeftRight className="h-4 w-4 text-info" />
              Cross-dock
            </div>
          )}
          {capabilities?.hasColdStorage && (
            <div className="flex items-center gap-1.5">
              <Snowflake className="h-4 w-4 text-info" />
              Cold storage
            </div>
          )}
          {capabilities?.hasHazmatCert && (
            <div className="flex items-center gap-1.5">
              <ShieldAlert className="h-4 w-4 text-warning" />
              Hazmat
            </div>
          )}
          {location.appointmentRequired && (
            <div className="flex items-center gap-1.5">
              <Calendar className="h-4 w-4 text-warning" />
              Appointment required
            </div>
          )}
          {location.contactName && (
            <div className="ml-auto flex items-center gap-1.5 text-muted-foreground">
              <User className="h-4 w-4" />
              {location.contactName}{location.contactPhone ? ` - ${location.contactPhone}` : ''}
            </div>
          )}
        </div>
      )}

      {/* Stats cards */}
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Card
          onClick={() => setActiveSection('incoming')}
          className="cursor-pointer border-l-4 border-l-info p-5"
        >
          <div className="flex items-center gap-2">
            <ArrowDown className="h-6 w-6 text-info" />
            <div>
              <div className="text-2xl font-bold tracking-tight">{stats.incoming}</div>
              <div className="text-xs text-muted-foreground">Incoming</div>
            </div>
          </div>
        </Card>
        <Card
          onClick={() => setActiveSection('at_location')}
          className="cursor-pointer border-l-4 border-l-warning p-5"
        >
          <div className="flex items-center gap-2">
            <Package className="h-6 w-6 text-warning" />
            <div>
              <div className="text-2xl font-bold tracking-tight">{stats.atLocation}</div>
              <div className="text-xs text-muted-foreground">At Location</div>
            </div>
          </div>
        </Card>
        <Card
          onClick={() => setActiveSection('outgoing')}
          className="cursor-pointer border-l-4 border-l-success p-5"
        >
          <div className="flex items-center gap-2">
            <ArrowUp className="h-6 w-6 text-success" />
            <div>
              <div className="text-2xl font-bold tracking-tight">{stats.outgoing}</div>
              <div className="text-xs text-muted-foreground">Outgoing</div>
            </div>
          </div>
        </Card>
        <Card className="border-l-4 border-l-primary p-5">
          <div className="text-2xl font-bold tracking-tight">{stats.unitsHere}</div>
          <div className="text-xs text-muted-foreground">Units Here</div>
        </Card>
        <Card className="p-5">
          <div className="text-2xl font-bold tracking-tight">{stats.todayArrivals}</div>
          <div className="text-xs text-muted-foreground">Today Arrivals</div>
        </Card>
        <Card className="p-5">
          <div
            className={cn(
              'text-2xl font-bold tracking-tight',
              stats.avgDwellMinutes && stats.avgDwellMinutes > 240 && 'text-destructive',
            )}
          >
            {formatDwell(stats.avgDwellMinutes)}
          </div>
          <div className="text-xs text-muted-foreground">Avg Dwell Today</div>
        </Card>
      </div>

      <Tabs value={activeSection} onValueChange={v => setActiveSection(v as 'incoming' | 'at_location' | 'outgoing')}>
        <TabsList>
          <TabsTrigger value="incoming">
            <ArrowDown className="h-4 w-4" />
            Incoming ({stats.incoming})
          </TabsTrigger>
          <TabsTrigger value="at_location">
            <Package className="h-4 w-4" />
            At Location ({stats.atLocation})
          </TabsTrigger>
          <TabsTrigger value="outgoing">
            <ArrowUp className="h-4 w-4" />
            Outgoing ({stats.outgoing})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="incoming" className="mt-4">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Shipment</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Carrier</TableHead>
                  <TableHead>From</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>ETA</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.incoming.stops.map((s: any) => (
                  <TableRow key={s.stopId}>
                    <TableCell>
                      <Link to={`/shipments/${s.shipmentId}`} className="font-medium text-primary">
                        {s.shipmentReference}
                      </Link>
                    </TableCell>
                    <TableCell>{s.customerName || '--'}</TableCell>
                    <TableCell>{s.carrierName || '--'}</TableCell>
                    <TableCell>{s.originName}{s.originCity ? `, ${s.originCity}` : ''}</TableCell>
                    <TableCell className="text-xs capitalize">{s.stopType}</TableCell>
                    <TableCell className="text-xs">{s.estimatedArrival ? new Date(s.estimatedArrival).toLocaleString() : '--'}</TableCell>
                  </TableRow>
                ))}
                {data.incoming.directShipments.map((s: any) => (
                  <TableRow key={s.id}>
                    <TableCell>
                      <Link to={`/shipments/${s.id}`} className="font-medium text-primary">
                        {s.reference}
                      </Link>
                    </TableCell>
                    <TableCell>{s.customer?.name || '--'}</TableCell>
                    <TableCell>{s.carrier?.name || '--'}</TableCell>
                    <TableCell>{s.origin?.name}{s.origin?.city ? `, ${s.origin.city}` : ''}</TableCell>
                    <TableCell><Badge variant="info" className="text-xs">direct</Badge></TableCell>
                    <TableCell className="text-xs">{s.deliveryDate ? new Date(s.deliveryDate).toLocaleString() : '--'}</TableCell>
                  </TableRow>
                ))}
                {data.incoming.stops.length === 0 && data.incoming.directShipments.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-6 text-center text-muted-foreground">
                      No incoming shipments
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="at_location" className="mt-4 space-y-4">
          <Card>
            <div className="flex items-center gap-2 border-b border-border p-4 font-semibold">
              <Truck className="h-5 w-5 text-warning" />
              Shipments at Dock ({data.atLocation.stops.length})
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Shipment</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Carrier</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Dwell Time</TableHead>
                  <TableHead>Destination</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.atLocation.stops.map((s: any) => (
                  <TableRow key={s.stopId}>
                    <TableCell>
                      <Link to={`/shipments/${s.shipmentId}`} className="font-medium text-primary">
                        {s.shipmentReference}
                      </Link>
                    </TableCell>
                    <TableCell>{s.customerName || '--'}</TableCell>
                    <TableCell>{s.carrierName || '--'}</TableCell>
                    <TableCell>
                      <Badge variant={s.status === 'in_progress' ? 'warning' : 'info'}>
                        {s.status.replace(/_/g, ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell><DwellBadge minutes={s.dwellMinutes} /></TableCell>
                    <TableCell>{s.destinationName}{s.destinationCity ? `, ${s.destinationCity}` : ''}</TableCell>
                  </TableRow>
                ))}
                {data.atLocation.stops.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-6 text-center text-muted-foreground">
                      No shipments currently at dock
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Card>

          {data.atLocation.units.length > 0 && (
            <Card>
              <div className="flex items-center gap-2 border-b border-border p-4 font-semibold">
                <Package className="h-5 w-5 text-primary" />
                Trackable Units ({data.atLocation.units.length})
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Unit</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Condition</TableHead>
                    <TableHead>Order</TableHead>
                    <TableHead>Shipment</TableHead>
                    <TableHead>Arrived</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.atLocation.units.map((u: any) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">{u.identifier}</TableCell>
                      <TableCell className="text-xs capitalize">{u.unitType}</TableCell>
                      <TableCell>
                        <Badge variant={u.condition === 'good' ? 'success' : u.condition === 'damaged' ? 'destructive' : 'muted'}>
                          {u.condition}
                        </Badge>
                      </TableCell>
                      <TableCell>{u.orderNumber || '--'}</TableCell>
                      <TableCell>{u.shipmentReference || '--'}</TableCell>
                      <TableCell className="text-xs">{u.arrivedAt ? new Date(u.arrivedAt).toLocaleString() : '--'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="outgoing" className="mt-4">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Shipment</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Carrier</TableHead>
                  <TableHead>Destination</TableHead>
                  <TableHead>Pickup Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.outgoing.shipments.map((s: any) => (
                  <TableRow key={s.id}>
                    <TableCell>
                      <Link to={`/shipments/${s.id}`} className="font-medium text-primary">
                        {s.reference}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant={s.status === 'in_transit' ? 'info' : s.status === 'dispatched' ? 'warning' : 'muted'}>
                        {s.status.replace(/_/g, ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell>{s.customerName || '--'}</TableCell>
                    <TableCell>{s.carrierName || '--'}</TableCell>
                    <TableCell>{s.destinationName}{s.destinationCity ? `, ${s.destinationCity}` : ''}</TableCell>
                    <TableCell className="text-xs">{s.pickupDate ? new Date(s.pickupDate).toLocaleString() : '--'}</TableCell>
                  </TableRow>
                ))}
                {data.outgoing.shipments.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-6 text-center text-muted-foreground">
                      No outgoing shipments
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
