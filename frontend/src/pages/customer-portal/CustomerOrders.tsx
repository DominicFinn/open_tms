import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Plus, Search, Upload } from 'lucide-react';

import { API_URL } from '../../api';
import { customerFetch } from './CustomerDashboard';
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

interface Order {
  id: string; orderNumber: string; poNumber?: string; status: string;
  deliveryStatus: string; customerName: string; serviceLevel?: string;
  originCity?: string; originState?: string; destinationCity?: string; destinationState?: string;
  trackableUnitCount: number; lineItemCount: number; createdAt: string;
}

type StatusVariant = 'success' | 'info' | 'warning' | 'destructive' | 'muted' | 'default' | 'secondary';

function statusVariant(s: string): StatusVariant {
  const m: Record<string, StatusVariant> = {
    validated: 'info',
    assigned: 'default',
    in_transit: 'info',
    delivered: 'success',
    exception: 'destructive',
  };
  return m[s] || 'secondary';
}

export default function CustomerOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (statusFilter !== 'all') params.set('status', statusFilter);
    customerFetch(`${API_URL}/api/v1/customer-portal/orders?${params}`)
      .then(r => r.json())
      .then(json => { setOrders(json.data?.orders || []); setTotal(json.data?.total || 0); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [search, statusFilter]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold tracking-tight">Orders</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link to="/customer-portal/orders/import">
              <Upload className="h-4 w-4" />
              Bulk upload
            </Link>
          </Button>
          <Button variant="gradient" asChild>
            <Link to="/customer-portal/orders/create">
              <Plus className="h-4 w-4" />
              New order
            </Link>
          </Button>
        </div>
      </div>

      <Card>
        <div className="flex flex-wrap items-center gap-3 p-4">
          <div className="relative min-w-[280px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by order or PO number..."
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
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="validated">Validated</SelectItem>
              <SelectItem value="assigned">Assigned</SelectItem>
              <SelectItem value="delivered">Delivered</SelectItem>
              <SelectItem value="exception">Exception</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Separator />

        {loading ? (
          <div className="flex flex-col items-center gap-3 py-12 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="text-sm">Loading orders...</span>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order</TableHead>
                <TableHead>PO</TableHead>
                <TableHead>Route</TableHead>
                <TableHead>Service</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Delivery</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map(o => (
                <TableRow key={o.id}>
                  <TableCell className="font-mono text-sm font-semibold">
                    <Link to={`/customer-portal/orders/${o.id}`} className="text-primary hover:underline">
                      {o.orderNumber}
                    </Link>
                  </TableCell>
                  <TableCell className="text-sm">{o.poNumber || '-'}</TableCell>
                  <TableCell className="text-sm">
                    {o.originCity ? `${o.originCity}, ${o.originState}` : '-'} - {o.destinationCity ? `${o.destinationCity}, ${o.destinationState}` : '-'}
                  </TableCell>
                  <TableCell>
                    <Badge variant="muted">{o.serviceLevel || '-'}</Badge>
                  </TableCell>
                  <TableCell className="text-sm">{o.lineItemCount} items</TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(o.status)}>{o.status}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(o.deliveryStatus)}>{o.deliveryStatus}</Badge>
                  </TableCell>
                </TableRow>
              ))}
              {orders.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                    No orders found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}

        {total > 0 && (
          <div className="border-t border-border px-4 py-2 text-xs text-muted-foreground">
            {total} total orders
          </div>
        )}
      </Card>
    </div>
  );
}
