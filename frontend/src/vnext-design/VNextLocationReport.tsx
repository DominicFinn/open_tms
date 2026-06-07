import React, { useState, useEffect } from 'react';
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  BarChart3,
  ChevronDown,
  ChevronsUpDown,
  ChevronUp,
  Loader2,
  MapPin,
  PieChart,
  Search,
  SearchX,
  Truck,
} from 'lucide-react';

import { API_URL } from '../api';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { DatePicker } from '@/components/ui/date-picker';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
import { LOCATION_TYPE_META, getLocationTypeMeta } from './locationTypesMeta';

interface LocationRow {
  id: string;
  name: string;
  city: string;
  state: string;
  country: string;
  locationType: string | null;
  appointmentRequired: boolean;
  shipmentsOutbound: number;
  shipmentsInbound: number;
  ordersOutbound: number;
  ordersInbound: number;
  shipmentsInTransitTo: number;
}

interface TypeBreakdownEntry {
  count: number;
  shipmentsInbound: number;
  shipmentsOutbound: number;
  ordersInbound: number;
  ordersOutbound: number;
}

interface ReportData {
  summary: {
    totalLocations: number;
    totalShipmentsInbound: number;
    totalShipmentsOutbound: number;
    totalOrdersInbound: number;
    totalOrdersOutbound: number;
    totalInTransit: number;
  };
  typeBreakdown: Record<string, TypeBreakdownEntry>;
  locations: LocationRow[];
}

type SortField = 'name' | 'locationType' | 'shipmentsInbound' | 'shipmentsOutbound' | 'ordersInbound' | 'ordersOutbound' | 'shipmentsInTransitTo';

const STAT_TONES = {
  primary: 'bg-primary/10 text-primary',
  success: 'bg-success/15 text-success',
  info: 'bg-info/15 text-info',
  warning: 'bg-warning/15 text-warning',
} as const;

export default function VNextLocationReport() {
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [typeFilter, setTypeFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const [sortField, setSortField] = useState<SortField>('shipmentsInbound');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const [tab, setTab] = useState<'activity' | 'breakdown'>('activity');

  useEffect(() => {
    fetchReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typeFilter, dateFrom, dateTo]);

  async function fetchReport() {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (typeFilter !== 'all') params.set('locationType', typeFilter);
      if (dateFrom) params.set('from', dateFrom);
      if (dateTo) params.set('to', dateTo);
      const qs = params.toString();
      const res = await fetch(`${API_URL}/api/v1/reports/locations/activity${qs ? `?${qs}` : ''}`);
      if (!res.ok) throw new Error(`Failed to fetch report (${res.status})`);
      const json = await res.json();
      setData(json.data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  }

  function SortIcon({ field }: { field: SortField }) {
    if (sortField !== field) return <ChevronsUpDown className="ml-1 inline h-3 w-3" />;
    return sortDir === 'asc' ? <ChevronUp className="ml-1 inline h-3 w-3" /> : <ChevronDown className="ml-1 inline h-3 w-3" />;
  }

  const filteredLocations = (data?.locations || [])
    .filter(l => {
      if (!search) return true;
      const q = search.toLowerCase();
      return l.name.toLowerCase().includes(q) || l.city.toLowerCase().includes(q) || (l.state || '').toLowerCase().includes(q);
    })
    .sort((a, b) => {
      const av = a[sortField] ?? '';
      const bv = b[sortField] ?? '';
      if (typeof av === 'number' && typeof bv === 'number') {
        return sortDir === 'asc' ? av - bv : bv - av;
      }
      return sortDir === 'asc'
        ? String(av).localeCompare(String(bv))
        : String(bv).localeCompare(String(av));
    });

  if (loading && !data) {
    return (
      <div className="flex flex-col items-center gap-3 py-24 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin" />
        <h3 className="text-lg font-medium">Loading report...</h3>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">{error}</div>
    );
  }
  if (!data) return null;

  const { summary, typeBreakdown } = data;

  const maxTypeVolume = Math.max(
    1,
    ...Object.values(typeBreakdown).map(t => t.shipmentsInbound + t.shipmentsOutbound),
  );

  const stats = [
    { tone: 'primary' as const, label: 'Locations', value: summary.totalLocations, icon: MapPin },
    { tone: 'success' as const, label: 'Shipments Inbound', value: summary.totalShipmentsInbound, icon: ArrowDownToLine },
    { tone: 'info' as const, label: 'Shipments Outbound', value: summary.totalShipmentsOutbound, icon: ArrowUpFromLine },
    { tone: 'warning' as const, label: 'In Transit', value: summary.totalInTransit, icon: Truck },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Location Activity</h1>
        <p className="mt-1 text-sm text-muted-foreground">Shipment and order volume across your network</p>
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

      <Tabs value={tab} onValueChange={v => setTab(v as 'activity' | 'breakdown')}>
        <TabsList>
          <TabsTrigger value="activity">Location Activity</TabsTrigger>
          <TabsTrigger value="breakdown">Type Breakdown</TabsTrigger>
        </TabsList>

        <TabsContent value="activity" className="mt-4">
          <Card>
            <div className="flex flex-wrap items-center gap-3 p-4">
              <div className="relative min-w-[280px] flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by name, city, state..."
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
                  <SelectItem value="all">All Types</SelectItem>
                  {Object.entries(LOCATION_TYPE_META).map(([value, meta]) => (
                    <SelectItem key={value} value={value}>{meta.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <DatePicker
                type="date"
                value={dateFrom}
                onChange={e => setDateFrom(e.target.value)}
                className="w-[160px]"
              />
              <DatePicker
                type="date"
                value={dateTo}
                onChange={e => setDateTo(e.target.value)}
                className="w-[160px]"
              />
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="cursor-pointer" onClick={() => toggleSort('name')}>
                    Location <SortIcon field="name" />
                  </TableHead>
                  <TableHead className="cursor-pointer" onClick={() => toggleSort('locationType')}>
                    Type <SortIcon field="locationType" />
                  </TableHead>
                  <TableHead className="cursor-pointer text-right" onClick={() => toggleSort('shipmentsInbound')}>
                    Shipments In <SortIcon field="shipmentsInbound" />
                  </TableHead>
                  <TableHead className="cursor-pointer text-right" onClick={() => toggleSort('shipmentsOutbound')}>
                    Shipments Out <SortIcon field="shipmentsOutbound" />
                  </TableHead>
                  <TableHead className="cursor-pointer text-right" onClick={() => toggleSort('ordersInbound')}>
                    Orders In <SortIcon field="ordersInbound" />
                  </TableHead>
                  <TableHead className="cursor-pointer text-right" onClick={() => toggleSort('ordersOutbound')}>
                    Orders Out <SortIcon field="ordersOutbound" />
                  </TableHead>
                  <TableHead className="cursor-pointer text-right" onClick={() => toggleSort('shipmentsInTransitTo')}>
                    In Transit <SortIcon field="shipmentsInTransitTo" />
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLocations.map(loc => {
                  const meta = getLocationTypeMeta(loc.locationType);
                  return (
                    <TableRow key={loc.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <div className="font-semibold">{loc.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {loc.city}{loc.state ? `, ${loc.state}` : ''} - {loc.country}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {meta ? (
                          <Badge variant="muted" className="text-xs">{meta.label}</Badge>
                        ) : (
                          <span className="text-xs italic text-muted-foreground">Unclassified</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{loc.shipmentsInbound}</TableCell>
                      <TableCell className="text-right tabular-nums">{loc.shipmentsOutbound}</TableCell>
                      <TableCell className="text-right tabular-nums">{loc.ordersInbound}</TableCell>
                      <TableCell className="text-right tabular-nums">{loc.ordersOutbound}</TableCell>
                      <TableCell className="text-right">
                        {loc.shipmentsInTransitTo > 0 ? (
                          <Badge variant="warning" className="text-xs">
                            <Truck className="mr-1 h-3 w-3" />
                            {loc.shipmentsInTransitTo}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {filteredLocations.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7}>
                      <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
                        <SearchX className="h-8 w-8" />
                        <h3 className="text-base font-medium">No locations found</h3>
                        <p className="text-sm">Try adjusting your filters</p>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="breakdown" className="mt-4">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Locations by type */}
            <Card>
              <CardContent className="p-6">
                <h3 className="mb-4 flex items-center gap-2 text-base font-semibold">
                  <PieChart className="h-4 w-4" />
                  Locations by Type
                </h3>
                <div className="space-y-3">
                  {Object.entries(typeBreakdown)
                    .sort(([, a], [, b]) => b.count - a.count)
                    .map(([type, entry]) => {
                      const meta = getLocationTypeMeta(type === 'unclassified' ? null : type);
                      const label = meta?.label || 'Unclassified';
                      const pct = summary.totalLocations > 0 ? (entry.count / summary.totalLocations) * 100 : 0;
                      return (
                        <div key={type}>
                          <div className="mb-1 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <MapPin className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm font-semibold">{label}</span>
                            </div>
                            <span className="text-sm text-muted-foreground">
                              {entry.count} ({pct.toFixed(0)}%)
                            </span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full bg-primary transition-all"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                </div>
              </CardContent>
            </Card>

            {/* Volume by type */}
            <Card>
              <CardContent className="p-6">
                <h3 className="mb-4 flex items-center gap-2 text-base font-semibold">
                  <BarChart3 className="h-4 w-4" />
                  Shipment Volume by Type
                </h3>
                <div className="space-y-4">
                  {Object.entries(typeBreakdown)
                    .sort(([, a], [, b]) => (b.shipmentsInbound + b.shipmentsOutbound) - (a.shipmentsInbound + a.shipmentsOutbound))
                    .map(([type, entry]) => {
                      const meta = getLocationTypeMeta(type === 'unclassified' ? null : type);
                      const label = meta?.label || 'Unclassified';
                      const total = entry.shipmentsInbound + entry.shipmentsOutbound;
                      const inPct = maxTypeVolume > 0 ? (entry.shipmentsInbound / maxTypeVolume) * 100 : 0;
                      const outPct = maxTypeVolume > 0 ? (entry.shipmentsOutbound / maxTypeVolume) * 100 : 0;
                      return (
                        <div key={type}>
                          <div className="mb-1 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <MapPin className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm font-semibold">{label}</span>
                            </div>
                            <span className="text-xs text-muted-foreground">{total} shipments</span>
                          </div>
                          <div className="flex h-2 gap-1">
                            <div
                              className="rounded-full bg-success transition-all"
                              style={{ width: `${inPct}%` }}
                              title={`Inbound: ${entry.shipmentsInbound}`}
                            />
                            <div
                              className="rounded-full bg-info transition-all"
                              style={{ width: `${outPct}%` }}
                              title={`Outbound: ${entry.shipmentsOutbound}`}
                            />
                          </div>
                          <div className="mt-1 flex gap-4 text-xs text-muted-foreground">
                            <span>In: {entry.shipmentsInbound}</span>
                            <span>Out: {entry.shipmentsOutbound}</span>
                            <span>Orders In: {entry.ordersInbound}</span>
                            <span>Orders Out: {entry.ordersOutbound}</span>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
