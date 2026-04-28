import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  CheckCircle2,
  CircleAlert,
  KeyRound,
  ListChecks,
  Loader2,
  Network,
  Plug,
  RefreshCw,
  Repeat,
  Send,
} from 'lucide-react';

import { API_URL } from '../api';
import { Button } from '@/components/ui/button';
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

interface QueueStats {
  name: string;
  queued: number;
  active: number;
  deadLetter: number;
}

export default function VNextIntegrationsDashboard() {
  const [apiKeys, setApiKeys] = useState<any[]>([]);
  const [integrations, setIntegrations] = useState<any[]>([]);
  const [ediPartners, setEdiPartners] = useState<any[]>([]);
  const [queues, setQueues] = useState<QueueStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setError('');
    try {
      const [keysRes, tpRes] = await Promise.all([
        fetch(`${API_URL}/api/v1/api-keys`),
        fetch(`${API_URL}/api/v1/trading-partners`),
      ]);

      if (!keysRes.ok || !tpRes.ok) {
        setError('Failed to load some integration data');
      }

      const keysData = keysRes.ok ? await keysRes.json() : { data: [] };
      const tpData = tpRes.ok ? await tpRes.json() : { data: [] };

      setApiKeys(keysData.data || []);
      setIntegrations(tpData.data?.filter((p: any) => p.outboundEnabled) || []);
      setEdiPartners(tpData.data?.filter((p: any) => p.inboundEnabled) || []);

      try {
        const qRes = await fetch(`${API_URL}/api/v1/queues/stats`);
        if (qRes.ok) {
          const qData = await qRes.json();
          setQueues(qData.data || []);
        }
      } catch {
        // queue stats endpoint may not exist
      }
    } catch (e: any) {
      setError(e.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }

  const activeIntegrations = integrations.filter((i: any) => i.active !== false).length;
  const totalQueueDepth = queues.reduce((sum, q) => sum + (q.queued || 0), 0);
  const totalDeadLetter = queues.reduce((sum, q) => sum + (q.deadLetter || 0), 0);

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-3 py-24 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin" />
        <h3 className="text-lg font-medium">Loading...</h3>
      </div>
    );
  }

  const stats = [
    { label: 'Active integrations', value: activeIntegrations, icon: Plug, tone: 'bg-primary/10 text-primary' },
    { label: 'API keys', value: apiKeys.length, icon: KeyRound, tone: 'bg-success/15 text-success' },
    { label: 'Queue depth', value: totalQueueDepth, icon: ListChecks, tone: 'bg-warning/15 text-warning' },
    { label: 'Failed', value: totalDeadLetter, icon: CircleAlert, tone: 'bg-destructive/10 text-destructive' },
    { label: 'EDI partners', value: ediPartners.length, icon: Repeat, tone: 'bg-info/15 text-info' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Integrations</h1>
          <p className="mt-1 text-sm text-muted-foreground">Monitor and manage all integration channels</p>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-3 rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          <CircleAlert className="h-5 w-5" />
          {error}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {stats.map(stat => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label}>
              <div className="p-5">
                <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg', stat.tone)}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="mt-3 text-2xl font-bold tracking-tight">{stat.value}</div>
                <div className="mt-1 text-sm text-muted-foreground">{stat.label}</div>
              </div>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Queue status</CardTitle></CardHeader>
          <Separator />
          {queues.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-12 text-muted-foreground">
              <ListChecks className="h-8 w-8" />
              <h3 className="text-base font-medium">No queue data available</h3>
              <p className="text-sm">Queue statistics are not currently available.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Queue name</TableHead>
                  <TableHead className="text-right">Queued</TableHead>
                  <TableHead className="text-right">Active</TableHead>
                  <TableHead className="text-right">Dead letter</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {queues.map(q => (
                  <TableRow key={q.name}>
                    <TableCell className="font-mono text-sm font-medium">{q.name}</TableCell>
                    <TableCell className="text-right">{q.queued}</TableCell>
                    <TableCell className="text-right">{q.active}</TableCell>
                    <TableCell className={cn('text-right', q.deadLetter > 0 && 'font-semibold text-destructive')}>
                      {q.deadLetter}
                    </TableCell>
                    <TableCell>
                      <Button variant="outline" size="sm">
                        <RefreshCw className="h-3 w-3" />
                        Retry
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>

        <Card>
          <CardHeader><CardTitle>Recent activity</CardTitle></CardHeader>
          <CardContent>
            <div className="flex flex-col gap-3">
              {integrations.length === 0 && apiKeys.length === 0 && ediPartners.length === 0 ? (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  No recent activity to display.
                </div>
              ) : (
                <>
                  {apiKeys.slice(0, 3).map((k: any) => (
                    <div key={`key-${k.id}`} className="flex items-start gap-3">
                      <KeyRound className="mt-0.5 h-5 w-5 text-info" />
                      <div className="flex-1">
                        <div className="text-sm">API key &apos;{k.name}&apos; {k.active !== false ? 'active' : 'inactive'}</div>
                        <div className="text-xs text-muted-foreground">Created {new Date(k.createdAt).toLocaleDateString()}</div>
                      </div>
                    </div>
                  ))}
                  {integrations.slice(0, 3).map((i: any) => (
                    <div key={`int-${i.id}`} className="flex items-start gap-3">
                      {i.active !== false ? (
                        <CheckCircle2 className="mt-0.5 h-5 w-5 text-success" />
                      ) : (
                        <CircleAlert className="mt-0.5 h-5 w-5 text-destructive" />
                      )}
                      <div className="flex-1">
                        <div className="text-sm">{i.name} - {i.active !== false ? 'active' : 'inactive'}</div>
                        <div className="text-xs text-muted-foreground">{i.type || 'Integration'}</div>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Quick actions</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" asChild>
              <Link to="/integrations/api-keys">
                <KeyRound className="h-4 w-4" />
                Manage API keys
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/integrations/outbound">
                <Send className="h-4 w-4" />
                Outbound integrations
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/integrations/webhook-logs">
                <ListChecks className="h-4 w-4" />
                Webhook logs
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/integrations/edi/partners">
                <Network className="h-4 w-4" />
                EDI partners
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
