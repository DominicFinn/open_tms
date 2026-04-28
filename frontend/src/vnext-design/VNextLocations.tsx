import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRightLeft,
  Bluetooth,
  Building,
  CheckCircle2,
  CircleAlert,
  Crosshair,
  Factory,
  List as ListIcon,
  Loader2,
  Map as MapIcon,
  MapPin,
  Network,
  Plus,
  RadioTower,
  Search,
  SearchX,
  Ship,
  Store,
  Train,
  Warehouse,
  Wifi,
} from 'lucide-react';

import { API_URL } from '../api';
import { LOCATION_TYPE_META } from './locationTypesMeta';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
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

type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' | 'info' | 'muted';

interface ArrivalCriteriaSummary {
  id: string;
  criteriaType: string;
}

interface Location {
  id: string;
  name: string;
  address1: string;
  address2?: string;
  city: string;
  state: string;
  postalCode?: string;
  country: string;
  lat: number | null;
  lng: number | null;
  archived: boolean;
  locationType?: string;
  appointmentRequired?: boolean;
  arrivalCriteria?: ArrivalCriteriaSummary[];
}

const LOCATION_TYPE_LABELS = Object.fromEntries(
  Object.entries(LOCATION_TYPE_META).map(([k, v]) => [k, v.label])
);

const LOCATION_TYPE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  warehouse: Warehouse,
  distribution_centre: Network,
  cross_dock: ArrowRightLeft,
  terminal: Building,
  port: Ship,
  rail_yard: Train,
  customer: Store,
  store: Store,
  manufacturing: Factory,
};

const LOCATION_TYPE_VARIANT: Record<string, BadgeVariant> = {
  warehouse: 'default',
  distribution_centre: 'info',
  cross_dock: 'warning',
  terminal: 'secondary',
  port: 'info',
  rail_yard: 'secondary',
  customer: 'success',
  store: 'success',
  manufacturing: 'destructive',
};

function getLocationTypeBadge(type?: string | null) {
  if (!type) return null;
  const meta = LOCATION_TYPE_META[type];
  if (!meta) {
    return { label: type, Icon: MapPin, variant: 'secondary' as BadgeVariant };
  }
  const Icon = LOCATION_TYPE_ICONS[type] || MapPin;
  const variant = LOCATION_TYPE_VARIANT[type] || 'secondary';
  return { label: meta.label, Icon, variant };
}

const CRITERIA_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  geofence: Crosshair,
  wifi: Wifi,
  ble: Bluetooth,
};

export default function VNextLocations() {
  const navigate = useNavigate();
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [countryFilter, setCountryFilter] = useState('all');
  const [viewMode, setViewMode] = useState<'table' | 'map'>('table');
  const [typeFilter, setTypeFilter] = useState('all');

  useEffect(() => {
    async function fetchLocations() {
      try {
        const res = await fetch(`${API_URL}/api/v1/locations`);
        if (!res.ok) throw new Error(`Failed to fetch locations (${res.status})`);
        const json = await res.json();
        setLocations(json.data || []);
      } catch (err: any) {
        setError(err.message || 'Failed to load locations');
      } finally {
        setLoading(false);
      }
    }
    fetchLocations();
  }, []);

  const stats = {
    total: locations.length,
    active: locations.filter(l => !l.archived).length,
    withCoords: locations.filter(l => l.lat != null && l.lng != null).length,
    withCriteria: locations.filter(l => l.arrivalCriteria && l.arrivalCriteria.length > 0).length,
  };

  const filtered = locations.filter(l => {
    if (countryFilter !== 'all' && l.country !== countryFilter) return false;
    if (typeFilter !== 'all' && (l.locationType || '') !== typeFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return l.name.toLowerCase().includes(q) || l.city.toLowerCase().includes(q) || l.state.toLowerCase().includes(q) || (l.address1 || '').toLowerCase().includes(q);
    }
    return true;
  });

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

  const statCards = [
    { label: 'Total locations', value: stats.total, icon: MapPin, tone: 'bg-primary/10 text-primary' },
    { label: 'Active', value: stats.active, icon: CheckCircle2, tone: 'bg-success/15 text-success' },
    { label: 'With coordinates', value: stats.withCoords, icon: Crosshair, tone: 'bg-info/15 text-info' },
    { label: 'With arrival criteria', value: stats.withCriteria, icon: RadioTower, tone: 'bg-warning/15 text-warning' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Locations</h1>
          <p className="mt-1 text-sm text-muted-foreground">{locations.length} locations managed</p>
        </div>
        <div className="flex gap-2">
          <Button variant="gradient" onClick={() => navigate('/locations/create')}>
            <Plus className="h-4 w-4" />
            New location
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map(stat => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label}>
              <div className="p-5">
                <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg', stat.tone)}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="mt-3 text-2xl font-bold tracking-tight">{stat.value}</div>
                <div className="mt-1 text-sm text-muted-foreground">{stat.label}</div>
              </div>
            </Card>
          );
        })}
      </div>

      {viewMode === 'map' && (
        <Card>
          <div className="flex h-[400px] flex-col items-center justify-center gap-2 text-muted-foreground">
            <MapIcon className="h-12 w-12 opacity-50" />
            <span className="text-sm">
              Map view - {filtered.filter(l => l.lat !== null).length} locations with coordinates would render here
            </span>
          </div>
        </Card>
      )}

      <Card>
        <div className="flex flex-wrap items-center gap-3 p-4">
          <div className="relative min-w-[280px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by name, address, city, state..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {Object.entries(LOCATION_TYPE_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={countryFilter} onValueChange={setCountryFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All countries</SelectItem>
              <SelectItem value="US">United States</SelectItem>
              <SelectItem value="CA">Canada</SelectItem>
              <SelectItem value="MX">Mexico</SelectItem>
            </SelectContent>
          </Select>
          <div className="inline-flex rounded-md border border-input">
            <Button
              variant={viewMode === 'table' ? 'secondary' : 'ghost'}
              size="icon"
              className="rounded-r-none"
              onClick={() => setViewMode('table')}
            >
              <ListIcon className="h-4 w-4" />
            </Button>
            <Separator orientation="vertical" />
            <Button
              variant={viewMode === 'map' ? 'secondary' : 'ghost'}
              size="icon"
              className="rounded-l-none"
              onClick={() => setViewMode('map')}
            >
              <MapIcon className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {viewMode === 'table' && (
          <>
            <Separator />
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead>City / State</TableHead>
                  <TableHead>Country</TableHead>
                  <TableHead>Coordinates</TableHead>
                  <TableHead>Arrival criteria</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(l => {
                  const typeBadge = getLocationTypeBadge(l.locationType);
                  return (
                    <TableRow
                      key={l.id}
                      onClick={() => navigate(`/locations/${l.id}/edit`)}
                      className="cursor-pointer"
                    >
                      <TableCell>
                        <div className="font-semibold">{l.name}</div>
                        <div className="text-xs text-muted-foreground">{l.id}</div>
                      </TableCell>
                      <TableCell>
                        {typeBadge ? (
                          <Badge variant={typeBadge.variant}>
                            <typeBadge.Icon className="mr-1 h-3.5 w-3.5" />
                            {typeBadge.label}
                          </Badge>
                        ) : (
                          <span className="text-xs italic text-muted-foreground">Unclassified</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">{l.address1}{l.address2 ? `, ${l.address2}` : ''}</TableCell>
                      <TableCell className="text-sm">{l.city}, {l.state}</TableCell>
                      <TableCell><Badge variant="secondary">{l.country}</Badge></TableCell>
                      <TableCell>
                        {l.lat !== null && l.lng !== null ? (
                          <Badge variant="secondary" className="font-mono">
                            {l.lat.toFixed(3)}, {l.lng.toFixed(3)}
                          </Badge>
                        ) : (
                          <span className="text-xs italic text-muted-foreground">No coordinates</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {l.arrivalCriteria && l.arrivalCriteria.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {l.arrivalCriteria.map(c => {
                              const Icon = CRITERIA_ICONS[c.criteriaType] || RadioTower;
                              const label = c.criteriaType === 'ble' ? 'BLE' : c.criteriaType.charAt(0).toUpperCase() + c.criteriaType.slice(1);
                              return (
                                <Badge key={c.id} variant="info">
                                  <Icon className="mr-1 h-3 w-3" />
                                  {label}
                                </Badge>
                              );
                            })}
                          </div>
                        ) : (
                          <span className="text-xs italic text-muted-foreground">None</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={l.archived ? 'destructive' : 'success'}>
                          {l.archived ? 'Archived' : 'Active'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8}>
                      <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
                        <SearchX className="h-8 w-8" />
                        <h3 className="text-base font-medium">No locations found</h3>
                        <p className="text-sm">Try adjusting your search or filters</p>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </>
        )}
      </Card>
    </div>
  );
}
