import React, { useEffect, useState } from 'react';
import {
  Check,
  CheckCircle2,
  Hourglass,
  Loader2,
  MoreVertical,
  Route,
  Search,
  X,
  XCircle,
} from 'lucide-react';

import { API_URL } from '../api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

interface PendingLaneRequest {
  id: string;
  order?: { orderNumber?: string };
  origin?: { name: string; city: string; state: string };
  destination?: { name: string; city: string; state: string };
  serviceLevel?: string;
  requiresTemperatureControl?: boolean;
  requiresHazmat?: boolean;
  status: string;
  notes?: string;
  createdAt?: string;
}

type StatusVariant = 'success' | 'warning' | 'destructive' | 'info' | 'muted';

function statusBadgeVariant(status: string): StatusVariant {
  const s = status?.toLowerCase().replace(/[_ ]/g, '');
  if (s === 'pending') return 'warning';
  if (s === 'approved') return 'success';
  if (s === 'rejected') return 'destructive';
  if (s === 'lanecreated') return 'info';
  return 'muted';
}

function formatDate(d?: string): string {
  if (!d) return '-';
  const date = new Date(d);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const STAT_TONES = {
  total: 'bg-primary/10 text-primary',
  pending: 'bg-warning/15 text-warning',
  approved: 'bg-success/15 text-success',
  rejected: 'bg-destructive/10 text-destructive',
} as const;

export default function VNextPendingLaneRequests() {
  const [requests, setRequests] = useState<PendingLaneRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const res = await fetch(`${API_URL}/api/v1/pending-lane-requests`);
        if (!res.ok) throw new Error(`Failed to load pending lane requests (${res.status})`);
        const json = await res.json();
        if (json.error) throw new Error(json.error);
        if (!cancelled) {
          setRequests(json.data || []);
          setError('');
        }
      } catch (err: any) {
        if (!cancelled) setError(err.message || 'Failed to load pending lane requests');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const filtered = requests.filter(r => {
    if (statusFilter !== 'all') {
      const sNorm = r.status?.toLowerCase().replace(/[_ ]/g, '');
      if (sNorm !== statusFilter) return false;
    }
    if (search) {
      const q = search.toLowerCase();
      const orderNum = (r.order?.orderNumber || '').toLowerCase();
      const originLabel = r.origin ? `${r.origin.name} ${r.origin.city} ${r.origin.state}`.toLowerCase() : '';
      const destLabel = r.destination ? `${r.destination.name} ${r.destination.city} ${r.destination.state}`.toLowerCase() : '';
      return orderNum.includes(q) || originLabel.includes(q) || destLabel.includes(q);
    }
    return true;
  });

  const counts = {
    total: requests.length,
    pending: requests.filter(r => r.status?.toLowerCase().replace(/[_ ]/g, '') === 'pending').length,
    approved: requests.filter(r => r.status?.toLowerCase().replace(/[_ ]/g, '') === 'approved').length,
    rejected: requests.filter(r => r.status?.toLowerCase().replace(/[_ ]/g, '') === 'rejected').length,
  };

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
        <XCircle className="h-5 w-5" />
        {error}
      </div>
    );
  }

  const stats = [
    { key: 'total' as const, label: 'Total Requests', value: counts.total, icon: Route },
    { key: 'pending' as const, label: 'Pending', value: counts.pending, icon: Hourglass },
    { key: 'approved' as const, label: 'Approved', value: counts.approved, icon: CheckCircle2 },
    { key: 'rejected' as const, label: 'Rejected', value: counts.rejected, icon: XCircle },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Pending Lane Requests</h1>
          <p className="mt-1 text-sm text-muted-foreground">{requests.length} requests</p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map(stat => {
          const Icon = stat.icon;
          return (
            <Card key={stat.key} className="p-5">
              <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg', STAT_TONES[stat.key])}>
                <Icon className="h-5 w-5" />
              </div>
              <div className="mt-3 text-2xl font-bold tracking-tight">{stat.value}</div>
              <div className="mt-1 text-sm text-muted-foreground">{stat.label}</div>
            </Card>
          );
        })}
      </div>

      <Card>
        <div className="flex flex-wrap items-center gap-3 p-4">
          <div className="relative min-w-[280px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by order, origin, destination..."
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
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
              <SelectItem value="lanecreated">Lane Created</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Separator />

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Order</TableHead>
              <TableHead>Route</TableHead>
              <TableHead>Service Level</TableHead>
              <TableHead>Requirements</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                  No pending lane requests found
                </TableCell>
              </TableRow>
            ) : (
              filtered.map(r => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-sm font-semibold">
                    {r.order?.orderNumber || '-'}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="inline-block h-2 w-2 rounded-full bg-info" />
                      {r.origin ? `${r.origin.city}, ${r.origin.state}` : '-'}
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="inline-block h-2 w-2 rounded-full bg-success" />
                      {r.destination ? `${r.destination.city}, ${r.destination.state}` : '-'}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{r.serviceLevel || '-'}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {r.requiresTemperatureControl && <Badge variant="secondary">Temp Ctrl</Badge>}
                      {r.requiresHazmat && <Badge variant="warning">Hazmat</Badge>}
                      {!r.requiresTemperatureControl && !r.requiresHazmat && '-'}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusBadgeVariant(r.status)}>{r.status}</Badge>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sm">{formatDate(r.createdAt)}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {r.status?.toLowerCase() === 'pending' && (
                        <>
                          <Button size="sm" variant="default" className="h-8">
                            <Check className="h-4 w-4" />
                            Approve
                          </Button>
                          <Button size="sm" variant="outline" className="h-8 border-destructive/40 text-destructive">
                            <X className="h-4 w-4" />
                            Reject
                          </Button>
                        </>
                      )}
                      <Button size="icon" variant="ghost" className="h-8 w-8">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
