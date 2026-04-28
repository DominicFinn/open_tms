import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Loader2, Plus, Waves } from 'lucide-react';

import { API_URL } from '../api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface Wave {
  id: string;
  waveNumber: string;
  status: string;
  pickStrategy: string;
  orderCount: number;
  lineCount: number;
  cutoffAt: string | null;
  projectedCompletionAt: string | null;
  createdAt: string;
}

type BadgeVariant = 'success' | 'info' | 'warning' | 'destructive' | 'muted' | 'secondary' | 'default';

function statusVariant(status: string): BadgeVariant {
  switch (status) {
    case 'planning': return 'secondary';
    case 'released': return 'info';
    case 'in_progress': return 'warning';
    case 'completed': return 'success';
    case 'cancelled': return 'destructive';
    default: return 'secondary';
  }
}

function formatStatus(s: string): string {
  return s.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function strategyLabel(s: string): string {
  switch (s) {
    case 'discrete': return 'Discrete';
    case 'batch': return 'Batch';
    case 'zone': return 'Zone';
    case 'wave': return 'Wave';
    default: return s;
  }
}

export default function VNextWmsWaves() {
  const navigate = useNavigate();
  const [waves, setWaves] = useState<Wave[]>([]);
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
    fetch(`${API_URL}/api/v1/waves?locationId=${selectedLocation}`)
      .then(r => r.json())
      .then(res => setWaves((res.data || []).map((w: any) => ({
        ...w,
        createdAt: w.createdAt,
      }))))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [selectedLocation]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Waves</h1>
          <p className="mt-1 text-sm text-muted-foreground">Group orders into pick waves for efficient fulfillment</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate('/wms/waves/templates')}>
            <FileText className="h-4 w-4" />
            Templates
          </Button>
          <Button variant="gradient" onClick={() => navigate('/wms/waves/create')}>
            <Plus className="h-4 w-4" />
            Create Wave
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center gap-3 py-24 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : waves.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <Waves className="h-12 w-12 text-muted-foreground" />
            <h3 className="text-base font-medium">No waves created</h3>
            <p className="text-sm text-muted-foreground">
              Waves group orders for efficient picking. Create wave templates to automate grouping by carrier, cutoff time, or service level.
            </p>
            <Button variant="gradient" onClick={() => navigate('/wms/waves/create')}>
              Create First Wave
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Wave #</TableHead>
                <TableHead>Strategy</TableHead>
                <TableHead>Orders</TableHead>
                <TableHead>Lines</TableHead>
                <TableHead>Cutoff</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {waves.map(w => (
                <TableRow key={w.id} onClick={() => navigate(`/wms/waves/${w.id}`)} className="cursor-pointer">
                  <TableCell className="font-mono text-sm font-semibold">{w.waveNumber}</TableCell>
                  <TableCell>
                    <Badge variant="default">{strategyLabel(w.pickStrategy)}</Badge>
                  </TableCell>
                  <TableCell>{w.orderCount}</TableCell>
                  <TableCell>{w.lineCount}</TableCell>
                  <TableCell>{w.cutoffAt ? new Date(w.cutoffAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}</TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(w.status)}>{formatStatus(w.status)}</Badge>
                  </TableCell>
                  <TableCell>{new Date(w.createdAt).toLocaleDateString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
