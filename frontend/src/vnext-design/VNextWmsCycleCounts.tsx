import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CircleAlert, ClipboardCheck, Loader2, Plus } from 'lucide-react';

import { API_URL } from '../api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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

interface CycleCount {
  id: string;
  countType: string;
  status: string;
  totalBins: number;
  countedBins: number;
  varianceCount: number;
  assignedToUserId: string | null;
  plannedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

type BadgeVariant = 'success' | 'info' | 'warning' | 'destructive' | 'muted' | 'secondary' | 'default';

function statusVariant(s: string): BadgeVariant {
  switch (s) {
    case 'planned': return 'secondary';
    case 'in_progress': return 'warning';
    case 'completed': return 'success';
    case 'cancelled': return 'destructive';
    default: return 'secondary';
  }
}

function formatStatus(s: string): string {
  return s.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

export default function VNextWmsCycleCounts() {
  const navigate = useNavigate();
  const [counts, setCounts] = useState<CycleCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLocation, setSelectedLocation] = useState('');
  const [locations, setLocations] = useState<Array<{ id: string; name: string }>>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ countType: 'full', zoneId: '' });
  const [zones, setZones] = useState<Array<{ id: string; name: string }>>([]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`${API_URL}/api/v1/locations`)
      .then(r => r.json())
      .then(res => {
        const locs = (res.data || []).filter((l: any) => !l.locationType || ['warehouse', 'distribution_centre', 'cross_dock'].includes(l.locationType));
        setLocations(locs);
        if (locs.length > 0) setSelectedLocation(locs[0].id);
        else setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedLocation) return;
    setLoading(true);
    fetch(`${API_URL}/api/v1/cycle-counts?locationId=${selectedLocation}`)
      .then(r => r.json())
      .then(res => setCounts(res.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));

    fetch(`${API_URL}/api/v1/warehouse/zones?locationId=${selectedLocation}`)
      .then(r => r.json())
      .then(res => setZones((res.data || []).map((z: any) => ({ id: z.id, name: z.name }))))
      .catch(() => {});
  }, [selectedLocation]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setCreating(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/cycle-counts`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          locationId: selectedLocation,
          countType: createForm.countType,
          zoneId: createForm.countType === 'zone' ? createForm.zoneId : null,
        }),
      });
      const data = await res.json();
      if (data.error) setError(data.error);
      else { setShowCreate(false); navigate(`/wms/cycle-counts/${data.data.id}`); }
    } catch { setError('Failed to create'); }
    finally { setCreating(false); }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Cycle Counts</h1>
          <p className="mt-1 text-sm text-muted-foreground">Inventory accuracy verification</p>
        </div>
        <Button variant="gradient" onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4" />
          New Count
        </Button>
      </div>

      {error && (
        <div className="flex items-center gap-3 rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          <CircleAlert className="h-5 w-5" />
          {error}
        </div>
      )}

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Cycle Count</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-2">
              <Label>Count Type</Label>
              <Select value={createForm.countType} onValueChange={v => setCreateForm({ ...createForm, countType: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="full">Full (all bins)</SelectItem>
                  <SelectItem value="zone">Zone (specific zone)</SelectItem>
                  <SelectItem value="random_sample">Random Sample (~20%)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {createForm.countType === 'zone' && (
              <div className="space-y-2">
                <Label>Zone</Label>
                <Select value={createForm.zoneId} onValueChange={v => setCreateForm({ ...createForm, zoneId: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select zone..." />
                  </SelectTrigger>
                  <SelectContent>
                    {zones.map(z => (
                      <SelectItem key={z.id} value={z.id}>{z.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" type="button" onClick={() => setShowCreate(false)}>Cancel</Button>
              <Button variant="gradient" type="submit" disabled={creating}>{creating ? 'Creating...' : 'Create'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <div className="flex flex-wrap items-center gap-2">
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

      {loading ? (
        <div className="flex flex-col items-center gap-3 py-24 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : counts.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <ClipboardCheck className="h-12 w-12 text-muted-foreground" />
            <h3 className="text-base font-medium">No cycle counts</h3>
            <p className="text-sm text-muted-foreground">Create a cycle count to verify inventory accuracy.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Progress</TableHead>
                <TableHead>Variances</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {counts.map(c => (
                <TableRow key={c.id}>
                  <TableCell>
                    <Badge variant="default">{formatStatus(c.countType)}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-32 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-success"
                          style={{ width: `${c.totalBins > 0 ? (c.countedBins / c.totalBins) * 100 : 0}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground">{c.countedBins}/{c.totalBins}</span>
                    </div>
                  </TableCell>
                  <TableCell>{c.varianceCount > 0 ? <span className="font-semibold text-destructive">{c.varianceCount}</span> : '0'}</TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(c.status)}>{formatStatus(c.status)}</Badge>
                  </TableCell>
                  <TableCell>{new Date(c.createdAt).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <Button variant="outline" size="sm" onClick={() => navigate(`/wms/cycle-counts/${c.id}`)}>View</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
