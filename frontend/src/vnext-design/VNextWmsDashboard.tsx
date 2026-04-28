import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Boxes,
  CircleAlert,
  Grid3x3,
  Loader2,
  Package,
  PackageOpen,
  PackagePlus,
  Plus,
  Search,
  ShoppingCart,
  Truck,
  Waves,
} from 'lucide-react';

import { API_URL } from '../api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

interface WarehouseStats {
  zones: number;
  bins: number;
  activeBins: number;
  totalSkus: number;
  receivingTasks: number;
  pickTasks: number;
  packTasks: number;
  putawayTasks: number;
}

const TONES = {
  primary: 'bg-primary/10 text-primary',
  info: 'bg-info/15 text-info',
  success: 'bg-success/15 text-success',
  warning: 'bg-warning/15 text-warning',
} as const;

export default function VNextWmsDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<WarehouseStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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
    fetch(`${API_URL}/api/v1/wms/dashboard?locationId=${selectedLocation}`)
      .then(r => r.json())
      .then(res => { if (res.data) setStats(res.data); })
      .catch(() => setError('Failed to load dashboard'))
      .finally(() => setLoading(false));
  }, [selectedLocation]);

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-3 py-24 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin" />
        <p>Loading warehouse dashboard...</p>
      </div>
    );
  }

  const tiles = [
    { label: 'Zones', value: stats?.zones ?? 0, icon: Grid3x3, tone: 'primary' as const, onClick: () => navigate('/wms/zones') },
    { label: 'Active Bins', value: stats?.activeBins ?? 0, icon: Boxes, tone: 'info' as const, onClick: () => navigate('/wms/zones') },
    { label: 'SKUs in Stock', value: stats?.totalSkus ?? 0, icon: Package, tone: 'success' as const, onClick: () => navigate('/wms/inventory') },
    { label: 'Receiving Tasks', value: stats?.receivingTasks ?? 0, icon: PackageOpen, tone: 'warning' as const, onClick: () => navigate('/wms/receiving') },
  ];

  const tilesRow2 = [
    { label: 'Putaway Tasks', value: stats?.putawayTasks ?? 0, icon: PackagePlus, tone: 'info' as const, onClick: () => navigate('/wms/putaway') },
    { label: 'Pick Tasks', value: stats?.pickTasks ?? 0, icon: ShoppingCart, tone: 'primary' as const, onClick: () => navigate('/wms/picking') },
    { label: 'Pack Tasks', value: stats?.packTasks ?? 0, icon: Package, tone: 'warning' as const, onClick: () => navigate('/wms/packing') },
    { label: 'Loading', value: 0, icon: Truck, tone: 'success' as const, onClick: () => navigate('/wms/loading') },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Warehouse Operations</h1>
          <p className="mt-1 text-sm text-muted-foreground">Overview of warehouse activity and performance</p>
        </div>
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

      {error && (
        <div className="flex items-center gap-3 rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          <CircleAlert className="h-5 w-5" />
          {error}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map(t => {
          const Icon = t.icon;
          return (
            <Card key={t.label} className="cursor-pointer transition-colors hover:border-primary/40">
              <button type="button" onClick={t.onClick} className="block w-full p-5 text-left">
                <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg', TONES[t.tone])}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="mt-3 text-2xl font-bold tracking-tight">{t.value}</div>
                <div className="mt-1 text-sm text-muted-foreground">{t.label}</div>
              </button>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {tilesRow2.map(t => {
          const Icon = t.icon;
          return (
            <Card key={t.label} className="cursor-pointer transition-colors hover:border-primary/40">
              <button type="button" onClick={t.onClick} className="block w-full p-5 text-left">
                <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg', TONES[t.tone])}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="mt-3 text-2xl font-bold tracking-tight">{t.value}</div>
                <div className="mt-1 text-sm text-muted-foreground">{t.label}</div>
              </button>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button variant="gradient" onClick={() => navigate('/wms/zones')}>
            <Plus className="h-4 w-4" />
            Set Up Zones
          </Button>
          <Button variant="outline" onClick={() => navigate('/wms/receiving')}>
            <PackageOpen className="h-4 w-4" />
            New Receiving Task
          </Button>
          <Button variant="outline" onClick={() => navigate('/wms/waves')}>
            <Waves className="h-4 w-4" />
            Create Wave
          </Button>
          <Button variant="outline" onClick={() => navigate('/wms/inventory')}>
            <Search className="h-4 w-4" />
            Search Inventory
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Dock Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Dock utilization and appointment schedule will appear here once receiving is configured.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Pick Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Pick rate, accuracy, and wave progress will appear here once picking is active.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
