import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Boxes, Grid3x3, Loader2, Plus } from 'lucide-react';

import { API_URL } from '../api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface WarehouseZone {
  id: string;
  locationId: string;
  locationName: string;
  name: string;
  zoneType: string;
  temperatureZone: string | null;
  hazmatCertified: boolean;
  maxWeightKg: number | null;
  maxVolumeCbm: number | null;
  sortOrder: number;
  active: boolean;
  binCount: number;
}

interface WarehouseBin {
  id: string;
  zoneId: string;
  zoneName: string;
  aisleId: string | null;
  label: string;
  binType: string;
  maxWeightKg: number | null;
  maxVolumeCbm: number | null;
  maxPalletPositions: number | null;
  level: number | null;
  walkSequence: number;
  active: boolean;
  currentWeightKg: number;
  currentVolumeCbm: number;
  currentPalletCount: number;
}

interface LocationOption {
  id: string;
  name: string;
}

function formatZoneType(t: string): string {
  return t.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

type BadgeVariant = 'success' | 'info' | 'warning' | 'destructive' | 'muted' | 'secondary' | 'default';

function zoneTypeVariant(t: string): BadgeVariant {
  switch (t) {
    case 'receiving': return 'info';
    case 'bulk_storage': return 'secondary';
    case 'pick_face': return 'default';
    case 'staging': return 'warning';
    case 'packing': return 'info';
    case 'shipping_dock': return 'success';
    case 'quarantine': return 'destructive';
    case 'returns': return 'warning';
    case 'cross_dock': return 'default';
    default: return 'secondary';
  }
}

export default function VNextWmsZones() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTab] = useState<'zones' | 'bins'>(
    (searchParams.get('tab') as 'zones' | 'bins') || 'zones'
  );
  const [zones, setZones] = useState<WarehouseZone[]>([]);
  const [bins, setBins] = useState<WarehouseBin[]>([]);
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [selectedLocation, setSelectedLocation] = useState('');
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetch(`${API_URL}/api/v1/locations`)
      .then(r => r.json())
      .then(res => {
        const locs = (res.data || []).filter(
          (l: any) => !l.locationType || ['warehouse', 'distribution_centre', 'cross_dock'].includes(l.locationType)
        );
        setLocations(locs);
        if (locs.length > 0) {
          setSelectedLocation(locs[0].id);
        } else {
          setLoading(false);
        }
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedLocation) return;
    setLoading(true);
    const zoneP = fetch(`${API_URL}/api/v1/warehouse/zones?locationId=${selectedLocation}`)
      .then(r => r.json())
      .then(res => setZones((res.data || []).map((z: any) => ({ ...z, binCount: z._count?.bins ?? 0 }))));
    const binP = fetch(`${API_URL}/api/v1/warehouse/bins?locationId=${selectedLocation}`)
      .then(r => r.json())
      .then(res => setBins((res.data || []).map((b: any) => ({ ...b, zoneName: b.zone?.name ?? '' }))));
    Promise.all([zoneP, binP]).finally(() => setLoading(false));
  }, [selectedLocation]);

  const switchTab = (t: 'zones' | 'bins') => {
    setTab(t);
    setSearchParams({ tab: t });
  };

  const filteredZones = zones.filter(z =>
    z.name.toLowerCase().includes(search.toLowerCase()) ||
    z.zoneType.toLowerCase().includes(search.toLowerCase())
  );

  const filteredBins = bins.filter(b =>
    b.label.toLowerCase().includes(search.toLowerCase()) ||
    b.binType.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Zones &amp; Bins</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage warehouse location hierarchy</p>
        </div>
        <div className="flex gap-2">
          {tab === 'zones' && (
            <Button variant="gradient" onClick={() => navigate('/wms/zones/create')}>
              <Plus className="h-4 w-4" />
              Add Zone
            </Button>
          )}
          {tab === 'bins' && (
            <Button variant="gradient" onClick={() => navigate('/wms/bins/create')}>
              <Plus className="h-4 w-4" />
              Add Bin
            </Button>
          )}
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => switchTab(v as 'zones' | 'bins')}>
        <TabsList>
          <TabsTrigger value="zones">
            <Grid3x3 className="h-4 w-4" />
            Zones
          </TabsTrigger>
          <TabsTrigger value="bins">
            <Boxes className="h-4 w-4" />
            Bins
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="flex flex-wrap items-center gap-3">
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
        <Input
          placeholder={tab === 'zones' ? 'Search zones...' : 'Search bins...'}
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="max-w-md"
        />
      </div>

      {loading ? (
        <div className="flex flex-col items-center gap-3 py-24 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : tab === 'zones' ? (
        filteredZones.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
              <Grid3x3 className="h-12 w-12 text-muted-foreground" />
              <h3 className="text-base font-medium">No zones configured</h3>
              <p className="text-sm text-muted-foreground">
                Set up warehouse zones to define receiving docks, storage areas, pick faces, and staging areas.
              </p>
              <Button variant="gradient" onClick={() => navigate('/wms/zones/create')}>
                Create First Zone
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Temperature</TableHead>
                  <TableHead>Hazmat</TableHead>
                  <TableHead>Bins</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredZones.map(zone => (
                  <TableRow
                    key={zone.id}
                    onClick={() => navigate(`/wms/zones/${zone.id}`)}
                    className="cursor-pointer"
                  >
                    <TableCell className="font-semibold">{zone.name}</TableCell>
                    <TableCell>
                      <Badge variant={zoneTypeVariant(zone.zoneType)}>{formatZoneType(zone.zoneType)}</Badge>
                    </TableCell>
                    <TableCell>{zone.temperatureZone ? formatZoneType(zone.temperatureZone) : '-'}</TableCell>
                    <TableCell>{zone.hazmatCertified ? 'Yes' : 'No'}</TableCell>
                    <TableCell>{zone.binCount}</TableCell>
                    <TableCell>
                      <Badge variant={zone.active ? 'success' : 'muted'}>
                        {zone.active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )
      ) : (
        filteredBins.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
              <Boxes className="h-12 w-12 text-muted-foreground" />
              <h3 className="text-base font-medium">No bins configured</h3>
              <p className="text-sm text-muted-foreground">
                Bins are individual storage locations within zones. Create zones first, then add bins.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Label</TableHead>
                  <TableHead>Zone</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Level</TableHead>
                  <TableHead>Walk Seq</TableHead>
                  <TableHead>Utilization</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredBins.map(bin => (
                  <TableRow key={bin.id}>
                    <TableCell className="font-mono text-sm font-semibold">{bin.label}</TableCell>
                    <TableCell>{bin.zoneName}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{formatZoneType(bin.binType)}</Badge>
                    </TableCell>
                    <TableCell>{bin.level ?? '-'}</TableCell>
                    <TableCell>{bin.walkSequence}</TableCell>
                    <TableCell>
                      {bin.maxPalletPositions
                        ? `${bin.currentPalletCount}/${bin.maxPalletPositions} pallets`
                        : '-'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={bin.active ? 'success' : 'muted'}>
                        {bin.active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )
      )}
    </div>
  );
}
