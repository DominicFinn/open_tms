import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Boxes,
  ChevronRight,
  CircleAlert,
  Edit,
  ListPlus,
  Loader2,
  Plus,
} from 'lucide-react';

import { API_URL } from '../api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface ZoneDetail {
  id: string;
  locationId: string;
  name: string;
  zoneType: string;
  temperatureZone: string | null;
  hazmatCertified: boolean;
  maxWeightKg: number | null;
  maxVolumeCbm: number | null;
  sortOrder: number;
  active: boolean;
  bins: Bin[];
  aisles: Aisle[];
}

interface Bin {
  id: string;
  label: string;
  binType: string;
  level: number | null;
  walkSequence: number;
  active: boolean;
  maxWeightKg: number | null;
  maxPalletPositions: number | null;
  currentWeightKg: number;
  currentPalletCount: number;
}

interface Aisle {
  id: string;
  name: string;
  sortOrder: number;
}

function formatZoneType(t: string): string {
  return t.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

type BadgeVariant = 'success' | 'info' | 'warning' | 'destructive' | 'muted' | 'secondary' | 'default';

function binTypeVariant(t: string): BadgeVariant {
  switch (t) {
    case 'pallet': return 'default';
    case 'shelf': return 'info';
    case 'floor': return 'secondary';
    case 'dock_door': return 'warning';
    case 'staging': return 'info';
    case 'pack_station': return 'success';
    default: return 'secondary';
  }
}

export default function VNextWmsZoneDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [zone, setZone] = useState<ZoneDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    fetch(`${API_URL}/api/v1/warehouse/zones/${id}`)
      .then(r => r.json())
      .then(res => {
        if (res.error) setError(res.error);
        else setZone(res.data);
      })
      .catch(() => setError('Failed to load zone'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-3 py-24 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (error || !zone) {
    return (
      <div className="flex items-center gap-3 rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
        <CircleAlert className="h-5 w-5" />
        {error || 'Zone not found'}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link to="/wms/zones" className="hover:text-foreground">
          <ArrowLeft className="inline h-4 w-4" /> Zones
        </Link>
        <ChevronRight className="h-3 w-3" />
        <span>{zone.name}</span>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{zone.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{formatZoneType(zone.zoneType)} zone</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate(`/wms/zones/${id}/edit`)}>
            <Edit className="h-4 w-4" />
            Edit
          </Button>
          <Button variant="gradient" onClick={() => navigate(`/wms/zones/${id}/bins/create`)}>
            <Plus className="h-4 w-4" />
            Add Bins
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Bins ({zone.bins.length})</CardTitle>
              <Button variant="outline" size="sm" onClick={() => navigate(`/wms/zones/${id}/bins/bulk`)}>
                <ListPlus className="h-4 w-4" />
                Bulk Create
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              {zone.bins.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-12 text-center text-muted-foreground">
                  <Boxes className="h-10 w-10" />
                  <p className="text-sm">No bins in this zone yet. Add bins individually or use bulk create.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Label</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Level</TableHead>
                      <TableHead>Walk Seq</TableHead>
                      <TableHead>Utilization</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {zone.bins.map(bin => (
                      <TableRow key={bin.id}>
                        <TableCell className="font-mono text-sm font-semibold">{bin.label}</TableCell>
                        <TableCell>
                          <Badge variant={binTypeVariant(bin.binType)}>{formatZoneType(bin.binType)}</Badge>
                        </TableCell>
                        <TableCell>{bin.level ?? '-'}</TableCell>
                        <TableCell>{bin.walkSequence}</TableCell>
                        <TableCell>
                          {bin.maxPalletPositions
                            ? `${bin.currentPalletCount}/${bin.maxPalletPositions}`
                            : bin.maxWeightKg
                              ? `${bin.currentWeightKg.toFixed(0)}/${bin.maxWeightKg}kg`
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
              )}
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-6 lg:sticky lg:top-20 lg:self-start">
          <Card>
            <CardHeader>
              <CardTitle>Properties</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-xs text-muted-foreground">Type</dt>
                  <dd className="mt-0.5 font-medium">{formatZoneType(zone.zoneType)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Temperature</dt>
                  <dd className="mt-0.5">{zone.temperatureZone ? formatZoneType(zone.temperatureZone) : 'None'}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Hazmat</dt>
                  <dd className="mt-0.5">{zone.hazmatCertified ? 'Yes' : 'No'}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Sort Order</dt>
                  <dd className="mt-0.5">{zone.sortOrder}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Max Weight</dt>
                  <dd className="mt-0.5">{zone.maxWeightKg != null ? `${zone.maxWeightKg} kg` : '-'}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Max Volume</dt>
                  <dd className="mt-0.5">{zone.maxVolumeCbm != null ? `${zone.maxVolumeCbm} cbm` : '-'}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Status</dt>
                  <dd className="mt-0.5">
                    <Badge variant={zone.active ? 'success' : 'destructive'}>
                      {zone.active ? 'Active' : 'Inactive'}
                    </Badge>
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Bins</dt>
                  <dd className="mt-0.5 font-semibold">{zone.bins.length}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          {zone.aisles.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Aisles</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {zone.aisles.map(a => (
                  <Badge key={a.id} variant="secondary">{a.name}</Badge>
                ))}
              </CardContent>
            </Card>
          )}
        </aside>
      </div>
    </div>
  );
}
