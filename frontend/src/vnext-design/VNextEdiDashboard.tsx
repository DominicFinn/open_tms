import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  CheckCircle2,
  CircleAlert,
  Hourglass,
  Inbox,
  Handshake,
  ListChecks,
  Loader2,
  Package,
  Repeat,
} from 'lucide-react';

import { API_URL } from '../api';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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

interface EdiStats {
  total: number;
  pending: number;
  processing: number;
  success: number;
  error: number;
  duplicate: number;
  totalEntitiesCreated: number;
}

interface EdiLog {
  id: string;
  transactionType: string;
  direction: string;
  status: string;
  fileName?: string;
  source?: string;
  partnerName?: string;
  partner?: { name: string };
  referenceNumber?: string;
  createdAt: string;
}

const DEFAULT_STATS: EdiStats = {
  total: 0, pending: 0, processing: 0, success: 0, error: 0, duplicate: 0, totalEntitiesCreated: 0,
};

type BadgeVariant = 'success' | 'destructive' | 'warning' | 'secondary' | 'info' | 'muted';

function statusVariant(status: string): BadgeVariant {
  const s = (status || '').toLowerCase();
  if (s === 'success') return 'success';
  if (s === 'error') return 'destructive';
  if (s === 'pending' || s === 'processing') return 'warning';
  if (s === 'duplicate') return 'secondary';
  return 'info';
}

function directionVariant(dir: string): BadgeVariant {
  return dir === 'inbound' ? 'info' : 'default' as BadgeVariant;
}

function formatDate(d: string): string {
  if (!d) return '-';
  const dt = new Date(d);
  return dt.toLocaleDateString() + ' ' + dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function VNextEdiDashboard() {
  const [stats, setStats] = useState<EdiStats>(DEFAULT_STATS);
  const [recentLogs, setRecentLogs] = useState<EdiLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setError('');
    try {
      const [statsRes, logsRes] = await Promise.all([
        fetch(`${API_URL}/api/v1/edi-logs/stats`),
        fetch(`${API_URL}/api/v1/edi-logs?limit=10&offset=0`),
      ]);

      if (statsRes.ok) {
        const statsJson = await statsRes.json();
        if (statsJson.data) setStats(statsJson.data);
      }

      if (logsRes.ok) {
        const logsJson = await logsRes.json();
        setRecentLogs(logsJson.data || []);
      } else {
        throw new Error('Failed to load recent EDI transactions');
      }
    } catch (e: any) {
      setError(e.message || 'Failed to load EDI dashboard data');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-3 py-24 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin" />
        <h3 className="text-lg font-medium">Loading...</h3>
      </div>
    );
  }

  const statTiles = [
    { label: 'Total transactions', value: stats.total, icon: Repeat, tone: 'bg-primary/10 text-primary' },
    { label: 'Successful', value: stats.success, icon: CheckCircle2, tone: 'bg-success/15 text-success' },
    { label: 'Errors', value: stats.error, icon: CircleAlert, tone: 'bg-destructive/10 text-destructive' },
    { label: 'Pending', value: stats.pending + stats.processing, icon: Hourglass, tone: 'bg-warning/15 text-warning' },
    { label: 'Entities created', value: stats.totalEntitiesCreated, icon: Package, tone: 'bg-info/15 text-info' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">EDI dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">Overview of EDI transaction activity and processing status</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link to="/integrations/edi/partners">
              <Handshake className="h-4 w-4" />
              Trading partners
            </Link>
          </Button>
          <Button variant="gradient" asChild>
            <Link to="/integrations/edi/logs">
              <ListChecks className="h-4 w-4" />
              Transaction log
            </Link>
          </Button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-3 rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          <CircleAlert className="h-5 w-5" />
          {error}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {statTiles.map(tile => {
          const Icon = tile.icon;
          return (
            <Card key={tile.label}>
              <div className="p-5">
                <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg', tile.tone)}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="mt-3 text-2xl font-bold tracking-tight">{tile.value.toLocaleString()}</div>
                <div className="mt-1 text-sm text-muted-foreground">{tile.label}</div>
              </div>
            </Card>
          );
        })}
      </div>

      <Card>
        <div className="flex items-center justify-between p-4">
          <h2 className="text-base font-semibold">Recent activity</h2>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/integrations/edi/logs">
              View all
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
        <Separator />
        {recentLogs.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-12 text-muted-foreground">
            <Inbox className="h-8 w-8" />
            <h3 className="text-base font-medium">No EDI transactions yet</h3>
            <p className="text-sm">Transactions will appear here once trading partners begin sending or receiving EDI files.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Partner</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Direction</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Reference</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentLogs.map(log => (
                <TableRow key={log.id}>
                  <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                    {formatDate(log.createdAt)}
                  </TableCell>
                  <TableCell className="font-medium">
                    {log.partnerName || log.partner?.name || '-'}
                  </TableCell>
                  <TableCell>
                    <span className="font-mono text-sm font-semibold">{log.transactionType || '-'}</span>
                  </TableCell>
                  <TableCell>
                    <Badge variant={directionVariant(log.direction)}>{log.direction || '-'}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(log.status)}>{log.status || '-'}</Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {log.referenceNumber || log.fileName || '-'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
