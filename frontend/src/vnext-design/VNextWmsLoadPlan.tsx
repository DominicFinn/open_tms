import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, CircleAlert, Loader2, Plus, Truck } from 'lucide-react';

import { API_URL } from '../api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
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
import { cn } from '@/lib/utils';

interface LoadPlan {
  id: string;
  shipmentId: string | null;
  status: string;
  totalUnits: number;
  loadedUnits: number;
  sealNumber: string | null;
  trailerNumber: string | null;
  carrierId: string | null;
  bolDocumentId: string | null;
  completedAt: string | null;
  createdAt: string;
  _count: { lines: number };
}

interface StagingAssignment {
  id: string;
  orderId: string;
  trackableUnitId: string;
  status: string;
  stagingBin: { label: string } | null;
  trackableUnit: { identifier: string; unitType: string } | null;
}

type BadgeVariant = 'success' | 'info' | 'warning' | 'destructive' | 'muted' | 'secondary' | 'default';

function statusVariant(s: string): BadgeVariant {
  switch (s) {
    case 'planning': return 'secondary';
    case 'loading': return 'warning';
    case 'completed': return 'success';
    case 'cancelled': return 'destructive';
    default: return 'secondary';
  }
}

function formatStatus(s: string): string {
  return s.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

export default function VNextWmsLoadPlan() {
  const navigate = useNavigate();
  const [plans, setPlans] = useState<LoadPlan[]>([]);
  const [staged, setStaged] = useState<StagingAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLocation, setSelectedLocation] = useState('');
  const [locations, setLocations] = useState<Array<{ id: string; name: string }>>([]);

  const [showCreate, setShowCreate] = useState(false);
  const [selectedAssignments, setSelectedAssignments] = useState<Set<string>>(new Set());
  const [createForm, setCreateForm] = useState({ shipmentId: '', trailerNumber: '', dockBinId: 'none' });
  const [creating, setCreating] = useState(false);

  const [completing, setCompleting] = useState<string | null>(null);
  const [sealNumber, setSealNumber] = useState('');

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [dockBins, setDockBins] = useState<Array<{ id: string; label: string }>>([]);

  useEffect(() => {
    fetch(`${API_URL}/api/v1/locations`).then(r => r.json()).then(res => {
      const locs = (res.data || []).filter((l: any) => !l.locationType || ['warehouse', 'distribution_centre', 'cross_dock'].includes(l.locationType));
      setLocations(locs);
      if (locs.length > 0) setSelectedLocation(locs[0].id);
      else setLoading(false);
    });
  }, []);

  const loadData = () => {
    if (!selectedLocation) return;
    setLoading(true);
    Promise.all([
      fetch(`${API_URL}/api/v1/load-plans?locationId=${selectedLocation}`).then(r => r.json()).then(res => setPlans(res.data || [])),
      fetch(`${API_URL}/api/v1/staging?locationId=${selectedLocation}&status=staged`).then(r => r.json()).then(res => setStaged(res.data || [])),
      fetch(`${API_URL}/api/v1/warehouse/bins?locationId=${selectedLocation}`).then(r => r.json()).then(res => setDockBins((res.data || []).filter((b: any) => b.binType === 'dock_door' && b.active))),
    ]).finally(() => setLoading(false));
  };
  useEffect(() => { loadData(); }, [selectedLocation]);

  const toggleAssignment = (id: string) => {
    const next = new Set(selectedAssignments);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedAssignments(next);
  };

  const handleCreate = async () => {
    if (selectedAssignments.size === 0) return;
    setError(''); setCreating(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/load-plans`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          locationId: selectedLocation,
          stagingAssignmentIds: [...selectedAssignments],
          shipmentId: createForm.shipmentId || null,
          trailerNumber: createForm.trailerNumber || null,
          dockBinId: createForm.dockBinId === 'none' ? null : createForm.dockBinId,
        }),
      });
      const data = await res.json();
      if (data.error) setError(data.error);
      else { setShowCreate(false); setSelectedAssignments(new Set()); loadData(); }
    } catch { setError('Failed to create'); }
    finally { setCreating(false); }
  };

  const handleComplete = async (planId: string) => {
    setError(''); setSuccess('');
    try {
      const res = await fetch(`${API_URL}/api/v1/load-plans/${planId}/complete`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sealNumber: sealNumber || null, generateBol: true }),
      });
      const data = await res.json();
      if (data.error) setError(data.error);
      else {
        const r = data.data;
        setSuccess(`Load plan completed. ${r.loadedUnits} units loaded.${r.bolGenerated ? ' BOL generated.' : ''}${r.bolError ? ` BOL warning: ${r.bolError}` : ''}`);
        setCompleting(null); setSealNumber(''); loadData();
      }
    } catch { setError('Failed'); }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Load Plans</h1>
          <p className="mt-1 text-sm text-muted-foreground">Plan outbound loads with reverse load-sequence and auto BOL generation</p>
        </div>
        <Button variant="gradient" onClick={() => setShowCreate(true)} disabled={staged.length === 0}>
          <Plus className="h-4 w-4" />
          New Load Plan
        </Button>
      </div>

      {error && (
        <div className="flex items-center gap-3 rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          <CircleAlert className="h-5 w-5" />
          {error}
        </div>
      )}
      {success && (
        <div className="flex items-center gap-3 rounded-md border border-success/30 bg-success/10 p-4 text-sm text-success">
          <CheckCircle2 className="h-5 w-5" />
          {success}
        </div>
      )}

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

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>New Load Plan</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Trailer #</Label>
                <Input value={createForm.trailerNumber} onChange={e => setCreateForm({ ...createForm, trailerNumber: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Dock Door</Label>
                <Select value={createForm.dockBinId} onValueChange={v => setCreateForm({ ...createForm, dockBinId: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {dockBins.map(b => (
                      <SelectItem key={b.id} value={b.id}>{b.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <h4 className="font-semibold">Select Staged Units ({selectedAssignments.size} selected)</h4>
            <div className="max-h-72 overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead></TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead>Order</TableHead>
                    <TableHead>Staging Bin</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {staged.map(a => (
                    <TableRow
                      key={a.id}
                      onClick={() => toggleAssignment(a.id)}
                      className={cn('cursor-pointer', selectedAssignments.has(a.id) && 'bg-muted')}
                    >
                      <TableCell>
                        <input
                          type="checkbox"
                          checked={selectedAssignments.has(a.id)}
                          onChange={() => toggleAssignment(a.id)}
                          className="h-4 w-4 rounded border border-input bg-background accent-primary"
                        />
                      </TableCell>
                      <TableCell className="font-mono text-sm font-semibold">{a.trackableUnit?.identifier ?? a.trackableUnitId.slice(0, 8)}</TableCell>
                      <TableCell>{a.orderId.slice(0, 8)}</TableCell>
                      <TableCell>{a.stagingBin?.label ?? '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button variant="gradient" disabled={creating || selectedAssignments.size === 0} onClick={handleCreate}>
              {creating ? 'Creating...' : `Create Plan (${selectedAssignments.size} units)`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!completing} onOpenChange={(o) => !o && setCompleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Complete Load</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Seal Number</Label>
              <Input value={sealNumber} onChange={e => setSealNumber(e.target.value)} placeholder="Enter trailer seal number" autoFocus />
            </div>
            <p className="text-sm text-muted-foreground">
              Completing the load will mark all units as loaded, clear their warehouse location, and auto-generate a Bill of Lading.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCompleting(null)}>Cancel</Button>
            <Button variant="gradient" onClick={() => completing && handleComplete(completing)}>Complete &amp; Generate BOL</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {loading ? (
        <div className="flex flex-col items-center gap-3 py-24 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : plans.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <Truck className="h-12 w-12 text-muted-foreground" />
            <h3 className="text-base font-medium">No load plans</h3>
            <p className="text-sm text-muted-foreground">
              {staged.length > 0 ? `${staged.length} units staged and ready. Create a load plan to sequence the load and generate a BOL.` : 'Stage packed units first, then create a load plan.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Plan</TableHead>
                <TableHead>Shipment</TableHead>
                <TableHead>Trailer</TableHead>
                <TableHead>Units</TableHead>
                <TableHead>Seal</TableHead>
                <TableHead>BOL</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {plans.map(p => (
                <TableRow key={p.id}>
                  <TableCell className="font-mono text-sm font-semibold">{p.id.slice(0, 8)}</TableCell>
                  <TableCell>{p.shipmentId?.slice(0, 8) ?? '-'}</TableCell>
                  <TableCell>{p.trailerNumber ?? '-'}</TableCell>
                  <TableCell>{p.loadedUnits}/{p.totalUnits}</TableCell>
                  <TableCell>{p.sealNumber ?? '-'}</TableCell>
                  <TableCell>{p.bolDocumentId ? <Badge variant="success">Generated</Badge> : '-'}</TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(p.status)}>{formatStatus(p.status)}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {p.status === 'planning' && (
                        <Button variant="gradient" size="sm" onClick={() => { setCompleting(p.id); setSealNumber(''); }}>
                          Complete
                        </Button>
                      )}
                      {p.bolDocumentId && (
                        <Button variant="outline" size="sm" onClick={() => navigate(`/documents/${p.bolDocumentId}/view`)}>
                          BOL
                        </Button>
                      )}
                    </div>
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
