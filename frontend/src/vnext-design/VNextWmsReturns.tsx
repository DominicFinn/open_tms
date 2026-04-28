import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Banknote, Loader2, Plus, RotateCcw } from 'lucide-react';

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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface Rma {
  id: string;
  rmaNumber: string;
  customerId: string;
  orderId: string;
  status: string;
  returnReason: string;
  suggestedRefundCents: number;
  actualRefundCents: number | null;
  requestedAt: string;
  completedAt: string | null;
  initiatedVia: string;
  _count: { lines: number };
}

type BadgeVariant = 'success' | 'info' | 'warning' | 'destructive' | 'muted' | 'secondary' | 'default';

function statusVariant(s: string): BadgeVariant {
  switch (s) {
    case 'requested': return 'info';
    case 'authorized': return 'default';
    case 'in_transit': return 'warning';
    case 'received': return 'warning';
    case 'inspecting': return 'warning';
    case 'dispositioning': return 'warning';
    case 'completed': return 'success';
    case 'rejected': return 'destructive';
    default: return 'secondary';
  }
}

function formatStatus(s: string): string {
  return s.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function formatReason(s: string): string {
  return s.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

export default function VNextWmsReturns() {
  const navigate = useNavigate();
  const [rmas, setRmas] = useState<Rma[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    setLoading(true);
    const url = statusFilter !== 'all'
      ? `${API_URL}/api/v1/rmas?status=${statusFilter}`
      : `${API_URL}/api/v1/rmas`;
    fetch(url)
      .then(r => r.json())
      .then(res => setRmas(res.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [statusFilter]);

  const filtered = rmas.filter(r =>
    !search || r.rmaNumber.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Returns</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage RMAs from request through disposition to refund</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate('/wms/returns/refund-review')}>
            <Banknote className="h-4 w-4" />
            Refund Review
          </Button>
          <Button variant="gradient" onClick={() => navigate('/wms/returns/create')}>
            <Plus className="h-4 w-4" />
            New RMA
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="requested">Requested</SelectItem>
            <SelectItem value="authorized">Authorized</SelectItem>
            <SelectItem value="in_transit">In Transit</SelectItem>
            <SelectItem value="received">Received</SelectItem>
            <SelectItem value="inspecting">Inspecting</SelectItem>
            <SelectItem value="dispositioning">Dispositioning</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
        <Input placeholder="Search RMA number..." value={search} onChange={e => setSearch(e.target.value)} className="max-w-sm" />
      </div>

      {loading ? (
        <div className="flex flex-col items-center gap-3 py-24 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <RotateCcw className="h-12 w-12 text-muted-foreground" />
            <h3 className="text-base font-medium">No RMAs</h3>
            <p className="text-sm text-muted-foreground">Create an RMA manually or wait for customer portal requests.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>RMA #</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Lines</TableHead>
                <TableHead>Suggested Refund</TableHead>
                <TableHead>Actual</TableHead>
                <TableHead>Via</TableHead>
                <TableHead>Requested</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(r => (
                <TableRow key={r.id} className="cursor-pointer" onClick={() => navigate(`/wms/returns/${r.id}`)}>
                  <TableCell className="font-mono text-sm font-semibold">{r.rmaNumber}</TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(r.status)}>{formatStatus(r.status)}</Badge>
                  </TableCell>
                  <TableCell>{formatReason(r.returnReason)}</TableCell>
                  <TableCell>{r._count?.lines ?? 0}</TableCell>
                  <TableCell>${(r.suggestedRefundCents / 100).toFixed(2)}</TableCell>
                  <TableCell>{r.actualRefundCents != null ? `$${(r.actualRefundCents / 100).toFixed(2)}` : '-'}</TableCell>
                  <TableCell><Badge variant="secondary">{formatStatus(r.initiatedVia)}</Badge></TableCell>
                  <TableCell>{new Date(r.requestedAt).toLocaleDateString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
