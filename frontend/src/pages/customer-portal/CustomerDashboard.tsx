import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bug, CheckCircle2, Loader2, Receipt, Truck } from 'lucide-react';

import { API_URL } from '../../api';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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

import {
  getCustomerToken as _getCustomerToken,
  getCustomerUser as _getCustomerUser,
  type CustomerSessionUser,
} from './customerSession';

export const getCustomerToken = _getCustomerToken;

export function getCustomerUser(): Partial<CustomerSessionUser> {
  return _getCustomerUser() ?? {};
}

export function customerFetch(url: string, opts?: RequestInit) {
  const headers: Record<string, string> = {
    ...(opts?.headers as Record<string, string> | undefined),
    Authorization: `Bearer ${getCustomerToken()}`,
  };
  if (opts?.body != null) headers['Content-Type'] = 'application/json';
  return fetch(url, { ...opts, headers });
}

function formatCents(cents: number): string {
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

interface DashboardData {
  stats: {
    activeShipments: number;
    recentDeliveries: number;
    openIssues: number;
    outstandingInvoiceCount: number;
    outstandingBalanceCents: number;
  };
  recentShipments: Array<{
    id: string; reference: string; status: string;
    originCity?: string; originState?: string;
    destinationCity?: string; destinationState?: string;
    carrierName?: string; pickupDate?: string; deliveryDate?: string;
  }>;
}

type StatusVariant = 'success' | 'info' | 'warning' | 'destructive' | 'muted';

function statusVariant(s: string): StatusVariant {
  const m: Record<string, StatusVariant> = {
    in_transit: 'info',
    delivered: 'success',
    booked: 'warning',
    exception: 'destructive',
    at_pickup: 'warning',
    at_delivery: 'warning',
  };
  return m[s] || 'muted';
}

const TILE_TONES = {
  primary: 'bg-primary/10 text-primary',
  success: 'bg-success/15 text-success',
  warning: 'bg-warning/15 text-warning',
  info: 'bg-info/15 text-info',
} as const;

export default function CustomerDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const user = getCustomerUser();

  useEffect(() => {
    customerFetch(`${API_URL}/api/v1/customer-portal/dashboard`)
      .then(r => r.json())
      .then(json => setData(json.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-3 py-24 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin" />
        <h3 className="text-lg font-medium">Loading...</h3>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
        Failed to load dashboard
      </div>
    );
  }

  const tiles: Array<{
    tone: 'primary' | 'success' | 'warning' | 'info';
    icon: typeof Truck;
    label: string;
    value: number;
    sub?: string;
    to?: string;
  }> = [
    { tone: 'primary', icon: Truck, label: 'Active shipments', value: data.stats.activeShipments, to: '/customer-portal/shipments?status=active' },
    { tone: 'success', icon: CheckCircle2, label: 'Delivered', value: data.stats.recentDeliveries, to: '/customer-portal/shipments?status=delivered' },
    { tone: 'warning', icon: Bug, label: 'Open issues', value: data.stats.openIssues, to: '/customer-portal/issues?status=open' },
    {
      tone: 'info',
      icon: Receipt,
      label: 'Outstanding invoices',
      value: data.stats.outstandingInvoiceCount,
      sub: formatCents(data.stats.outstandingBalanceCents),
      to: '/customer-portal/invoices?status=outstanding',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Welcome back{user.name ? `, ${user.name}` : ''}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{user.customerName}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map(t => {
          const Icon = t.icon;
          const body = (
            <CardContent className="p-6">
              <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg', TILE_TONES[t.tone])}>
                <Icon className="h-5 w-5" />
              </div>
              <div className="mt-4 text-3xl font-bold tracking-tight">{t.value}</div>
              <div className="mt-1 text-sm text-muted-foreground">{t.label}</div>
              {t.sub && <div className="mt-1 text-xs text-muted-foreground">{t.sub}</div>}
            </CardContent>
          );
          if (!t.to) {
            return <Card key={t.label}>{body}</Card>;
          }
          return (
            <Link
              key={t.label}
              to={t.to}
              className="block rounded-lg transition-shadow hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <Card className="h-full">{body}</Card>
            </Link>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent shipments</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Separator />
          {data.recentShipments.length === 0 ? (
            <div className="px-6 py-12 text-center text-sm text-muted-foreground">No recent shipments</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reference</TableHead>
                  <TableHead>Route</TableHead>
                  <TableHead>Carrier</TableHead>
                  <TableHead>Pickup</TableHead>
                  <TableHead>Delivery</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.recentShipments.map(s => (
                  <TableRow key={s.id}>
                    <TableCell>
                      <Link to={`/customer-portal/shipments/${s.id}`} className="font-semibold text-primary hover:underline">
                        {s.reference}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm">
                      {s.originCity}, {s.originState} - {s.destinationCity}, {s.destinationState}
                    </TableCell>
                    <TableCell className="text-sm">{s.carrierName || '-'}</TableCell>
                    <TableCell className="text-sm">
                      {s.pickupDate ? new Date(s.pickupDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '-'}
                    </TableCell>
                    <TableCell className="text-sm">
                      {s.deliveryDate ? new Date(s.deliveryDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '-'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(s.status)}>{s.status}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
