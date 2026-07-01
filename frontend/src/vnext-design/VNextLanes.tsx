import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  CheckCircle2,
  CircleAlert,
  Loader2,
  Plus,
  Route,
  Ruler,
  Search,
  SearchX,
  Truck,
} from 'lucide-react';

import { API_URL } from '../api';
import { useCurrentUser } from '../hooks/useCurrentUser';
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

interface Lane {
  id: string;
  name: string;
  originId: string;
  destinationId: string;
  origin: { name: string; city: string; state: string };
  destination: { name: string; city: string; state: string };
  distance: number | null;
  notes: string | null;
  status: string;
  serviceLevel: string | null;
  laneCarriers: any[];
  stops: any[];
  _count?: { shipments: number };
}

export default function VNextLanes() {
  const navigate = useNavigate();
  const { hasPermission } = useCurrentUser();
  const [lanes, setLanes] = useState<Lane[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    async function fetchLanes() {
      try {
        const res = await fetch(`${API_URL}/api/v1/lanes`);
        if (!res.ok) throw new Error(`Failed to fetch lanes (${res.status})`);
        const json = await res.json();
        setLanes(json.data || []);
      } catch (err: any) {
        setError(err.message || 'Failed to load lanes');
      } finally {
        setLoading(false);
      }
    }
    fetchLanes();
  }, []);

  const stats = {
    total: lanes.length,
    active: lanes.filter(l => l.status === 'ACTIVE').length,
    avgDistance: lanes.length > 0 ? Math.round(lanes.reduce((s, l) => s + (l.distance || 0), 0) / lanes.length) : 0,
    totalCarriers: lanes.reduce((s, l) => s + (l.laneCarriers?.length || 0), 0),
  };

  const filtered = lanes.filter(l => {
    if (statusFilter === 'active' && l.status !== 'ACTIVE') return false;
    if (statusFilter === 'inactive' && l.status === 'ACTIVE') return false;
    if (search) {
      const q = search.toLowerCase();
      const originLabel = `${l.origin?.city || ''}, ${l.origin?.state || ''}`;
      const destLabel = `${l.destination?.city || ''}, ${l.destination?.state || ''}`;
      return originLabel.toLowerCase().includes(q) || destLabel.toLowerCase().includes(q) || (l.name || '').toLowerCase().includes(q);
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

  const inactiveCount = lanes.filter(l => l.status !== 'ACTIVE').length;

  const statCards = [
    { label: 'Total lanes', value: stats.total, icon: Route, tone: 'bg-primary/10 text-primary' },
    { label: 'Active', value: stats.active, icon: CheckCircle2, tone: 'bg-success/15 text-success' },
    { label: 'Avg distance', value: `${stats.avgDistance.toLocaleString()} km`, icon: Ruler, tone: 'bg-info/15 text-info' },
    { label: 'Carriers assigned', value: stats.totalCarriers, icon: Truck, tone: 'bg-warning/15 text-warning' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Lanes</h1>
          <p className="mt-1 text-sm text-muted-foreground">{lanes.length} lanes configured</p>
        </div>
        <div className="flex gap-2">
          {hasPermission('lanes:write') && (
            <Button variant="gradient" onClick={() => navigate('/lanes/create')}>
              <Plus className="h-4 w-4" />
              New lane
            </Button>
          )}
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

      <Card>
        <div className="flex flex-wrap items-center gap-3 p-4">
          <div className="relative min-w-[280px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by lane ID, origin, or destination..."
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
              <SelectItem value="all">All statuses ({stats.total})</SelectItem>
              <SelectItem value="active">Active ({stats.active})</SelectItem>
              <SelectItem value="inactive">Inactive ({inactiveCount})</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Separator />

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Lane</TableHead>
              <TableHead>Distance</TableHead>
              <TableHead>Carriers</TableHead>
              <TableHead>Shipments</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map(l => (
              <TableRow
                key={l.id}
                onClick={() => navigate(`/lanes/${l.id}`)}
                className="cursor-pointer"
              >
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className="flex flex-col items-center gap-1">
                      <span className="h-2.5 w-2.5 rounded-full bg-success" />
                      <span className="h-3.5 w-px bg-border" />
                      <span className="h-2.5 w-2.5 rounded-full bg-destructive" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 text-sm font-semibold">
                        <span>{l.origin?.city}, {l.origin?.state}</span>
                        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                        <span>{l.destination?.city}, {l.destination?.state}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">{l.name || l.id}</div>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-sm font-semibold">
                  {l.distance ? `${l.distance.toLocaleString()} km` : '-'}
                </TableCell>
                <TableCell className="text-sm">{l.laneCarriers?.length || 0}</TableCell>
                <TableCell className="text-sm font-semibold">{l._count?.shipments ?? 0}</TableCell>
                <TableCell>
                  <Badge variant={l.status === 'ACTIVE' ? 'success' : 'destructive'}>
                    {l.status === 'ACTIVE' ? 'Active' : 'Inactive'}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={5}>
                  <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
                    <SearchX className="h-8 w-8" />
                    <h3 className="text-base font-medium">No lanes found</h3>
                    <p className="text-sm">Try adjusting your search or filters</p>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
