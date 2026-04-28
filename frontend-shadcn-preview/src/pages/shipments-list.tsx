import * as React from 'react';
import {
  Search,
  ArrowUpDown,
  Map as MapIcon,
  List,
  Plus,
  Filter,
  Download,
} from 'lucide-react';

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import type { RouteKey } from '@/components/app/app-sidebar';

interface Shipment {
  id: string;
  customer: string;
  origin: string;
  destination: string;
  carrier: string;
  pickup: string;
  delivery: string;
  status: 'draft' | 'booked' | 'transit' | 'delivered' | 'exception';
}

const ROWS: Shipment[] = [
  { id: 'SHIP-1042', customer: 'Acme Foods', origin: 'Chicago, IL', destination: 'Atlanta, GA', carrier: 'Werner', pickup: 'Apr 27', delivery: 'Apr 28', status: 'transit' },
  { id: 'SHIP-1041', customer: 'Northwind Pharma', origin: 'Dallas, TX', destination: 'Miami, FL', carrier: 'Schneider', pickup: 'Apr 25', delivery: 'Apr 27', status: 'delivered' },
  { id: 'SHIP-1040', customer: 'Globex Logistics', origin: 'Seattle, WA', destination: 'Denver, CO', carrier: 'JB Hunt', pickup: 'Apr 29', delivery: 'May 01', status: 'booked' },
  { id: 'SHIP-1039', customer: 'Initech Cold', origin: 'Boston, MA', destination: 'Newark, NJ', carrier: 'YRC', pickup: 'Apr 27', delivery: 'Apr 28', status: 'exception' },
  { id: 'SHIP-1038', customer: 'Pied Piper', origin: 'Phoenix, AZ', destination: 'San Diego, CA', carrier: 'XPO', pickup: 'Apr 27', delivery: 'Apr 28', status: 'transit' },
  { id: 'SHIP-1037', customer: 'Wonka Foods', origin: 'Detroit, MI', destination: 'Cleveland, OH', carrier: 'Estes', pickup: 'Apr 28', delivery: 'Apr 29', status: 'draft' },
  { id: 'SHIP-1036', customer: 'Acme Foods', origin: 'Houston, TX', destination: 'New Orleans, LA', carrier: 'Werner', pickup: 'Apr 26', delivery: 'Apr 27', status: 'delivered' },
  { id: 'SHIP-1035', customer: 'Cyberdyne', origin: 'San Jose, CA', destination: 'Portland, OR', carrier: 'Old Dominion', pickup: 'Apr 27', delivery: 'Apr 28', status: 'transit' },
];

const STATUS_VARIANT: Record<Shipment['status'], 'success' | 'info' | 'warning' | 'destructive' | 'muted'> = {
  delivered: 'success',
  transit: 'info',
  booked: 'muted',
  draft: 'muted',
  exception: 'destructive',
};

const STATUS_LABEL: Record<Shipment['status'], string> = {
  delivered: 'Delivered',
  transit: 'In transit',
  booked: 'Booked',
  draft: 'Draft',
  exception: 'Exception',
};

interface Props {
  onNavigate: (r: RouteKey) => void;
}

export function ShipmentsListPage({ onNavigate }: Props) {
  const [search, setSearch] = React.useState('');
  const [status, setStatus] = React.useState<string>('all');
  const [view, setView] = React.useState<'table' | 'map'>('table');

  const filtered = ROWS.filter((r) => {
    if (status !== 'all' && r.status !== status) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return [r.id, r.customer, r.origin, r.destination, r.carrier].some((v) =>
      v.toLowerCase().includes(q),
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Shipments</h1>
          <p className="mt-1 text-muted-foreground">
            {ROWS.length} shipments &middot; {ROWS.filter((r) => r.status === 'transit').length} in transit
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Download className="h-4 w-4" />
            Export
          </Button>
          <Button variant="gradient" onClick={() => onNavigate('create-shipment')}>
            <Plus className="h-4 w-4" />
            New shipment
          </Button>
        </div>
      </div>

      <Card>
        <div className="flex flex-wrap items-center gap-3 p-4">
          <div className="relative min-w-[280px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by ID, customer, origin, destination, carrier..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="booked">Booked</SelectItem>
              <SelectItem value="transit">In transit</SelectItem>
              <SelectItem value="delivered">Delivered</SelectItem>
              <SelectItem value="exception">Exception</SelectItem>
            </SelectContent>
          </Select>

          <Select defaultValue="created">
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="created">Sort: Created</SelectItem>
              <SelectItem value="pickup">Sort: Pickup</SelectItem>
              <SelectItem value="delivery">Sort: Delivery</SelectItem>
            </SelectContent>
          </Select>

          <Button variant="outline" size="icon" aria-label="Toggle sort order">
            <ArrowUpDown className="h-4 w-4" />
          </Button>

          <Button variant="outline">
            <Filter className="h-4 w-4" />
            More filters
          </Button>

          <div className="ml-auto inline-flex rounded-md border border-input">
            <Button
              variant={view === 'table' ? 'secondary' : 'ghost'}
              size="sm"
              className="rounded-r-none"
              onClick={() => setView('table')}
            >
              <List className="h-4 w-4" />
              Table
            </Button>
            <Separator orientation="vertical" />
            <Button
              variant={view === 'map' ? 'secondary' : 'ghost'}
              size="sm"
              className="rounded-l-none"
              onClick={() => setView('map')}
            >
              <MapIcon className="h-4 w-4" />
              Map
            </Button>
          </div>
        </div>
        <Separator />

        {view === 'table' ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Shipment</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Lane</TableHead>
                <TableHead>Carrier</TableHead>
                <TableHead>Pickup</TableHead>
                <TableHead>Delivery</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((row) => (
                <TableRow
                  key={row.id}
                  className="cursor-pointer"
                  onClick={() => onNavigate('shipment-detail')}
                >
                  <TableCell className="font-mono text-sm font-semibold">{row.id}</TableCell>
                  <TableCell>{row.customer}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5 text-sm">
                      <span>{row.origin}</span>
                      <span className="text-muted-foreground">&rarr;</span>
                      <span>{row.destination}</span>
                    </div>
                  </TableCell>
                  <TableCell>{row.carrier}</TableCell>
                  <TableCell className="text-muted-foreground">{row.pickup}</TableCell>
                  <TableCell className="text-muted-foreground">{row.delivery}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[row.status]}>{STATUS_LABEL[row.status]}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm">
                      Open
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="flex h-[480px] items-center justify-center bg-muted/30">
            <div className="text-center text-muted-foreground">
              <MapIcon className="mx-auto h-10 w-10" />
              <div className="mt-3 text-sm">Map view placeholder.</div>
              <div className="text-xs">Same data, plotted on Leaflet/Mapbox in the real build.</div>
            </div>
          </div>
        )}

        <Separator />
        <div className="flex items-center justify-between p-4 text-sm text-muted-foreground">
          <div>
            Showing {filtered.length} of {ROWS.length}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled>
              Previous
            </Button>
            <Button variant="outline" size="sm">
              Next
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
