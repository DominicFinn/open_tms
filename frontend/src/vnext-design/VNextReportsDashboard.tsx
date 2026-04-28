import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  BadgeCheck,
  Bug,
  CheckCircle2,
  Clock,
  CreditCard,
  Loader2,
  Plane,
  Receipt,
  ScrollText,
  ShieldCheck,
  Truck,
  TrendingDown,
  TrendingUp,
  Warehouse,
} from 'lucide-react';

import { API_URL } from '../api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

interface DashboardData {
  periodLabel: string;
  dateFrom: string;
  dateTo: string;
  shipments: {
    total: number;
    byStatus: Record<string, number>;
    inTransit: number;
    atLocations: number;
    complete: number;
  };
  orders: {
    total: number;
    byStatus: Record<string, number>;
    byDeliveryStatus: Record<string, number>;
  };
  issues: { open: number; inProgress: number; critical: number };
  financial: {
    periodLabel: string;
    totalRevenueCents: number;
    totalCostCents: number;
    totalMarginCents: number;
    marginPercent: number;
    shipmentCount: number;
    notInvoiced: number;
    invoiced: number;
    paid: number;
  };
  invoices: {
    outstanding: number;
    overdueCount: number;
    totalBalanceCents: number;
    overdueBalanceCents: number;
  };
  trends: {
    shipmentCountChange: number | null;
    revenueChange: number | null;
    marginChange: number | null;
    orderCountChange: number | null;
  };
}

type Period = '7d' | '30d' | 'mtd' | 'qtd' | 'ytd';

function formatCents(cents: number): string {
  if (Math.abs(cents) >= 100000000) {
    return `$${(cents / 100000000).toFixed(1)}M`;
  }
  if (Math.abs(cents) >= 100000) {
    return `$${(cents / 100000).toFixed(1)}K`;
  }
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function trendInfo(change: number | null): { Icon: typeof TrendingUp; cls: string; text: string } | null {
  if (change == null) return null;
  if (change > 0) return { Icon: TrendingUp, cls: 'text-success', text: `+${change}%` };
  if (change < 0) return { Icon: TrendingDown, cls: 'text-destructive', text: `${change}%` };
  return { Icon: TrendingUp, cls: 'text-muted-foreground', text: '0%' };
}

function periodDates(period: Period): { dateFrom: string; dateTo: string } {
  const now = new Date();
  const dateTo = now.toISOString().slice(0, 10);
  let dateFrom: string;

  switch (period) {
    case '7d':
      dateFrom = new Date(now.getTime() - 7 * 86400000).toISOString().slice(0, 10);
      break;
    case '30d':
      dateFrom = new Date(now.getTime() - 30 * 86400000).toISOString().slice(0, 10);
      break;
    case 'mtd':
      dateFrom = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
      break;
    case 'qtd': {
      const qMonth = Math.floor(now.getMonth() / 3) * 3;
      dateFrom = `${now.getFullYear()}-${String(qMonth + 1).padStart(2, '0')}-01`;
      break;
    }
    case 'ytd':
      dateFrom = `${now.getFullYear()}-01-01`;
      break;
  }

  return { dateFrom, dateTo };
}

function StatusBar({ label, count, total, colorClass }: { label: string; count: number; total: number; colorClass: string }) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div className="flex items-center gap-3 py-1.5">
      <span className="w-24 text-sm text-muted-foreground">{label}</span>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
        <div
          className={cn('h-full rounded-full transition-all', colorClass)}
          style={{ width: `${pct}%`, minWidth: count > 0 ? 4 : 0 }}
        />
      </div>
      <span className="w-10 text-right text-sm font-semibold">{count}</span>
    </div>
  );
}

function StatCard({
  Icon,
  iconClass,
  value,
  label,
  trend,
  subtext,
}: {
  Icon: typeof TrendingUp;
  iconClass: string;
  value: React.ReactNode;
  label: string;
  trend?: { Icon: typeof TrendingUp; cls: string; text: string } | null;
  subtext?: React.ReactNode;
}) {
  return (
    <Card className="p-5">
      <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg', iconClass)}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="mt-3 text-2xl font-bold tracking-tight">{value}</div>
      <div className="mt-1 text-sm text-muted-foreground">{label}</div>
      {trend && (
        <div className={cn('mt-1 flex items-center gap-1 text-xs', trend.cls)}>
          <trend.Icon className="h-3 w-3" />
          {trend.text}
        </div>
      )}
      {subtext && <div className="mt-1 text-xs text-muted-foreground">{subtext}</div>}
    </Card>
  );
}

export default function VNextReportsDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [period, setPeriod] = useState<Period>('30d');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const { dateFrom, dateTo } = periodDates(period);
    fetch(`${API_URL}/api/v1/reports/dashboard?dateFrom=${dateFrom}&dateTo=${dateTo}`)
      .then(r => r.json())
      .then(json => {
        if (!cancelled) {
          setData(json.data);
          setError('');
        }
      })
      .catch(err => { if (!cancelled) setError(err.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [period]);

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-3 py-24 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
        {error || 'Failed to load dashboard'}
      </div>
    );
  }

  const { shipments, orders, issues, financial, invoices, trends } = data;

  const shipTrend = trendInfo(trends.shipmentCountChange);
  const revTrend = trendInfo(trends.revenueChange);
  const marginTrend = trendInfo(trends.marginChange);
  const orderTrend = trendInfo(trends.orderCountChange);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Executive Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">{data.periodLabel}</p>
        </div>
        <Tabs value={period} onValueChange={v => setPeriod(v as Period)}>
          <TabsList>
            <TabsTrigger value="7d">7 Days</TabsTrigger>
            <TabsTrigger value="30d">30 Days</TabsTrigger>
            <TabsTrigger value="mtd">MTD</TabsTrigger>
            <TabsTrigger value="qtd">QTD</TabsTrigger>
            <TabsTrigger value="ytd">YTD</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Row 1: Shipment stats */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          Icon={Truck}
          iconClass="bg-primary/10 text-primary"
          value={shipments.total}
          label="Total Shipments"
          trend={shipTrend}
        />
        <StatCard
          Icon={Plane}
          iconClass="bg-info/15 text-info"
          value={shipments.inTransit}
          label="In Transit"
        />
        <StatCard
          Icon={Warehouse}
          iconClass="bg-warning/15 text-warning"
          value={shipments.atLocations}
          label="At Locations"
        />
        <StatCard
          Icon={CheckCircle2}
          iconClass="bg-success/15 text-success"
          value={shipments.complete}
          label="Delivered"
        />
      </div>

      {/* Row 2: Financial stats */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          Icon={ScrollText}
          iconClass="bg-primary/10 text-primary"
          value={orders.total}
          label="Total Orders"
          trend={orderTrend}
        />
        <StatCard
          Icon={TrendingUp}
          iconClass="bg-success/15 text-success"
          value={formatCents(financial.totalRevenueCents)}
          label="Revenue"
          trend={revTrend}
        />
        <StatCard
          Icon={CreditCard}
          iconClass="bg-destructive/10 text-destructive"
          value={formatCents(financial.totalCostCents)}
          label="Cost Spent"
        />
        <StatCard
          Icon={TrendingUp}
          iconClass={cn(
            financial.marginPercent >= 10 ? 'bg-success/15 text-success' : 'bg-warning/15 text-warning',
          )}
          value={
            <>
              {formatCents(financial.totalMarginCents)}{' '}
              <span className="text-sm font-normal">({financial.marginPercent}%)</span>
            </>
          }
          label="Margin"
          trend={marginTrend}
        />
      </div>

      {/* Row 3: Invoices & Issues */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          Icon={Receipt}
          iconClass="bg-info/15 text-info"
          value={invoices.outstanding}
          label="Outstanding Invoices"
          subtext={formatCents(invoices.totalBalanceCents)}
        />
        <StatCard
          Icon={Clock}
          iconClass="bg-destructive/10 text-destructive"
          value={invoices.overdueCount}
          label="Overdue"
          subtext={<span className="text-destructive">{formatCents(invoices.overdueBalanceCents)}</span>}
        />
        <StatCard
          Icon={Bug}
          iconClass="bg-warning/15 text-warning"
          value={issues.open + issues.inProgress}
          label="Active Issues"
          subtext={`${issues.open} open, ${issues.inProgress} in progress`}
        />
        <StatCard
          Icon={issues.critical > 0 ? AlertTriangle : ShieldCheck}
          iconClass={cn(
            issues.critical > 0 ? 'bg-destructive/10 text-destructive' : 'bg-success/15 text-success',
          )}
          value={issues.critical}
          label="Critical Issues"
        />
      </div>

      {/* Two-column detail grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Shipment Status</CardTitle>
          </CardHeader>
          <CardContent>
            <StatusBar label="Draft" count={shipments.byStatus['draft'] || 0} total={shipments.total} colorClass="bg-muted-foreground" />
            <StatusBar label="Booked" count={shipments.byStatus['booked'] || 0} total={shipments.total} colorClass="bg-info" />
            <StatusBar label="In Transit" count={shipments.byStatus['in_transit'] || 0} total={shipments.total} colorClass="bg-primary" />
            <StatusBar label="At Pickup" count={shipments.byStatus['at_pickup'] || 0} total={shipments.total} colorClass="bg-warning" />
            <StatusBar label="At Delivery" count={shipments.byStatus['at_delivery'] || 0} total={shipments.total} colorClass="bg-warning" />
            <StatusBar label="Delivered" count={shipments.byStatus['delivered'] || 0} total={shipments.total} colorClass="bg-success" />
            <StatusBar label="Exception" count={shipments.byStatus['exception'] || 0} total={shipments.total} colorClass="bg-destructive" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Order Delivery Status</CardTitle>
          </CardHeader>
          <CardContent>
            <StatusBar label="Unassigned" count={orders.byDeliveryStatus['unassigned'] || 0} total={orders.total} colorClass="bg-muted-foreground" />
            <StatusBar label="Assigned" count={orders.byDeliveryStatus['assigned'] || 0} total={orders.total} colorClass="bg-info" />
            <StatusBar label="In Transit" count={orders.byDeliveryStatus['in_transit'] || 0} total={orders.total} colorClass="bg-primary" />
            <StatusBar label="Delivered" count={orders.byDeliveryStatus['delivered'] || 0} total={orders.total} colorClass="bg-success" />
            <StatusBar label="Exception" count={orders.byDeliveryStatus['exception'] || 0} total={orders.total} colorClass="bg-destructive" />
          </CardContent>
        </Card>
      </div>

      {/* Billing Pipeline */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Billing Pipeline</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-md bg-muted/30 p-4 text-center">
              <div className="text-3xl font-bold tracking-tight text-warning">{financial.notInvoiced}</div>
              <div className="mt-1 text-sm text-muted-foreground">Not Invoiced</div>
            </div>
            <div className="rounded-md bg-muted/30 p-4 text-center">
              <div className="text-3xl font-bold tracking-tight text-info">{financial.invoiced}</div>
              <div className="mt-1 text-sm text-muted-foreground">Invoiced</div>
            </div>
            <div className="rounded-md bg-muted/30 p-4 text-center">
              <div className="text-3xl font-bold tracking-tight text-success">{financial.paid}</div>
              <div className="mt-1 text-sm text-muted-foreground">Paid</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
