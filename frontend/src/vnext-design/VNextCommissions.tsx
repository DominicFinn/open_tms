import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';

import { API_URL } from '../api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

interface Commission {
  id: string;
  user: { id: string; email: string; firstName?: string; lastName?: string };
  shipment: { id: string; reference: string; status: string };
  basisType: string;
  basisAmountCents: number;
  commissionPercent: string;
  commissionCents: number;
  currency: string;
  status: string;
  approvedAt?: string;
  paidAt?: string;
  notes?: string;
  createdAt: string;
}

interface AgentSummary {
  userId: string;
  userName: string;
  email: string;
  totalCommissionCents: number;
  accruedCents: number;
  approvedCents: number;
  paidCents: number;
  count: number;
}

function formatCents(cents: number): string {
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' | 'info' | 'muted';

function statusVariant(s: string): BadgeVariant {
  return s === 'paid' ? 'success' : s === 'approved' ? 'info' : 'warning';
}

export default function VNextCommissions() {
  const [tab, setTab] = useState<'list' | 'summary'>('summary');
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [summary, setSummary] = useState<AgentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch(`${API_URL}/api/v1/commissions`).then(r => r.json()),
      fetch(`${API_URL}/api/v1/commissions/summary`).then(r => r.json()),
    ]).then(([commJson, sumJson]) => {
      setCommissions(commJson.data || []);
      setSummary(sumJson.data || []);
    }).catch(() => {})
    .finally(() => setLoading(false));
  }, []);

  const handleAction = async (id: string, action: 'approve' | 'pay') => {
    await fetch(`${API_URL}/api/v1/commissions/${id}/${action}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    const res = await fetch(`${API_URL}/api/v1/commissions`);
    const json = await res.json();
    setCommissions(json.data || []);
    const sumRes = await fetch(`${API_URL}/api/v1/commissions/summary`);
    const sumJson = await sumRes.json();
    setSummary(sumJson.data || []);
  };

  const filtered = statusFilter === 'all' ? commissions : commissions.filter(c => c.status === statusFilter);

  const totals = summary.reduce((acc, s) => ({
    total: acc.total + s.totalCommissionCents,
    accrued: acc.accrued + s.accruedCents,
    approved: acc.approved + s.approvedCents,
    paid: acc.paid + s.paidCents,
  }), { total: 0, accrued: 0, approved: 0, paid: 0 });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Commissions</h1>
          <p className="mt-1 text-sm text-muted-foreground">Track broker agent commissions on shipments</p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-5">
            <div className="text-sm text-muted-foreground">Total</div>
            <div className="mt-1 text-2xl font-bold tracking-tight font-mono tabular-nums">{formatCents(totals.total)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="text-sm text-muted-foreground">Accrued</div>
            <div className="mt-1 text-2xl font-bold tracking-tight font-mono tabular-nums text-warning">{formatCents(totals.accrued)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="text-sm text-muted-foreground">Approved</div>
            <div className="mt-1 text-2xl font-bold tracking-tight font-mono tabular-nums text-info">{formatCents(totals.approved)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="text-sm text-muted-foreground">Paid</div>
            <div className="mt-1 text-2xl font-bold tracking-tight font-mono tabular-nums text-success">{formatCents(totals.paid)}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={tab} onValueChange={v => setTab(v as 'list' | 'summary')}>
        <TabsList>
          <TabsTrigger value="summary">By Agent</TabsTrigger>
          <TabsTrigger value="list">All Commissions</TabsTrigger>
        </TabsList>
      </Tabs>

      {loading ? (
        <div className="flex flex-col items-center gap-3 py-12 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin" />
          <h3 className="text-base font-medium">Loading...</h3>
        </div>
      ) : tab === 'summary' ? (
        <Card>
          {summary.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">No commissions recorded yet</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Agent</TableHead>
                  <TableHead className="text-right">Shipments</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Accrued</TableHead>
                  <TableHead className="text-right">Approved</TableHead>
                  <TableHead className="text-right">Paid</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summary.map(s => (
                  <TableRow key={s.userId}>
                    <TableCell>
                      <div className="font-semibold">{s.userName}</div>
                      <div className="text-xs text-muted-foreground">{s.email}</div>
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums">{s.count}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums font-semibold">{formatCents(s.totalCommissionCents)}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums text-warning">{formatCents(s.accruedCents)}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums text-info">{formatCents(s.approvedCents)}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums text-success">{formatCents(s.paidCents)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      ) : (
        <Card>
          <div className="flex flex-wrap items-center gap-3 p-4">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="accrued">Accrued</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Agent</TableHead>
                <TableHead>Shipment</TableHead>
                <TableHead>Basis</TableHead>
                <TableHead className="text-right">Rate</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(c => {
                const name = [c.user.firstName, c.user.lastName].filter(Boolean).join(' ') || c.user.email;
                return (
                  <TableRow key={c.id}>
                    <TableCell>{name}</TableCell>
                    <TableCell>
                      <span className="font-mono text-sm font-semibold">{c.shipment.reference}</span>
                    </TableCell>
                    <TableCell>{c.basisType} ({formatCents(c.basisAmountCents)})</TableCell>
                    <TableCell className="text-right font-mono tabular-nums">{Number(c.commissionPercent).toFixed(1)}%</TableCell>
                    <TableCell className="text-right font-mono tabular-nums font-semibold">{formatCents(c.commissionCents)}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(c.status)}>{c.status}</Badge>
                    </TableCell>
                    <TableCell>
                      {c.status === 'accrued' && (
                        <Button size="sm" onClick={() => handleAction(c.id, 'approve')}>Approve</Button>
                      )}
                      {c.status === 'approved' && (
                        <Button size="sm" onClick={() => handleAction(c.id, 'pay')}>Mark Paid</Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
