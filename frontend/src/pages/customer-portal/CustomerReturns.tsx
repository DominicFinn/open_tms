import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Plus } from 'lucide-react';

import { API_URL } from '../../api';
import { customerFetch } from './CustomerDashboard';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
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

interface RmaSummary {
  id: string;
  rmaNumber: string;
  orderId: string;
  status: string;
  returnReason: string;
  suggestedRefundCents: number;
  actualRefundCents: number | null;
  createdAt: string;
  returnTrackingNumber: string | null;
  returnPickupScheduledAt: string | null;
  _count: { lines: number };
}

type StatusVariant = 'success' | 'info' | 'warning' | 'destructive' | 'muted' | 'secondary' | 'default';

function statusVariant(s: string): StatusVariant {
  const m: Record<string, StatusVariant> = {
    requested: 'info',
    authorized: 'default',
    in_transit: 'info',
    received: 'warning',
    inspecting: 'warning',
    dispositioning: 'warning',
    completed: 'success',
    rejected: 'destructive',
  };
  return m[s] || 'secondary';
}

function fmt(s: string): string {
  return s.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

export default function CustomerReturns() {
  const [rmas, setRmas] = useState<RmaSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (statusFilter !== 'all') params.set('status', statusFilter);
    customerFetch(`${API_URL}/api/v1/customer-portal/rmas?${params}`)
      .then(r => r.json())
      .then(json => { setRmas(json.data?.rmas || []); setTotal(json.data?.total || 0); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [statusFilter]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold tracking-tight">Returns</h1>
        <Button variant="gradient" asChild>
          <Link to="/customer-portal/returns/new">
            <Plus className="h-4 w-4" />
            Request return
          </Link>
        </Button>
      </div>

      <Card>
        <div className="flex flex-wrap items-center gap-3 p-4">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="requested">Requested</SelectItem>
              <SelectItem value="authorized">Authorized</SelectItem>
              <SelectItem value="in_transit">In transit</SelectItem>
              <SelectItem value="received">Received</SelectItem>
              <SelectItem value="inspecting">Inspecting</SelectItem>
              <SelectItem value="dispositioning">Pending refund</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
          <div className="ml-auto text-sm text-muted-foreground">
            {total} return{total === 1 ? '' : 's'}
          </div>
        </div>

        <Separator />

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>RMA number</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>Lines</TableHead>
              <TableHead>Refund</TableHead>
              <TableHead>Return tracking</TableHead>
              <TableHead>Requested</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center">
                  <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                </TableCell>
              </TableRow>
            )}
            {!loading && rmas.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                  You have not requested any returns yet.{' '}
                  <Link to="/customer-portal/returns/new" className="text-primary hover:underline">
                    Request one now
                  </Link>.
                </TableCell>
              </TableRow>
            )}
            {rmas.map(r => (
              <TableRow key={r.id}>
                <TableCell>
                  <Link to={`/customer-portal/returns/${r.id}`} className="font-mono font-semibold text-primary hover:underline">
                    {r.rmaNumber}
                  </Link>
                </TableCell>
                <TableCell>
                  <Badge variant={statusVariant(r.status)}>{fmt(r.status)}</Badge>
                </TableCell>
                <TableCell className="text-sm">{fmt(r.returnReason)}</TableCell>
                <TableCell className="text-sm">{r._count?.lines ?? 0}</TableCell>
                <TableCell className="text-sm">
                  {r.actualRefundCents != null
                    ? <strong>${(r.actualRefundCents / 100).toFixed(2)}</strong>
                    : <span className="text-muted-foreground">${(r.suggestedRefundCents / 100).toFixed(2)} est.</span>}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {r.returnTrackingNumber || '-'}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{new Date(r.createdAt).toLocaleDateString()}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
