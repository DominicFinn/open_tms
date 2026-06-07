import React, { useState, useEffect } from 'react';
import {
  ListChecks,
  CheckCircle2,
  XCircle,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Loader2,
  X,
} from 'lucide-react';

import { API_URL } from '../api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';

export default function VNextWebhookLogs() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedLog, setSelectedLog] = useState<any>(null);
  const [dateRange, setDateRange] = useState('24h');
  const [stats, setStats] = useState<{ total: number; successful: number; errors: number; updates: number }>({
    total: 0, successful: 0, errors: 0, updates: 0,
  });

  useEffect(() => { loadLogs(); }, [page, statusFilter]);
  useEffect(() => { loadStats(); }, []);

  async function loadStats() {
    try {
      const res = await fetch(`${API_URL}/api/v1/webhook-logs/stats`);
      if (res.ok) {
        const json = await res.json();
        const t = json.data?.totals;
        if (t) {
          setStats({
            total: t.total ?? 0,
            successful: t.success ?? 0,
            errors: t.errors ?? 0,
            updates: t.updates ?? 0,
          });
        }
      }
    } catch {
      // ignore
    }
  }

  async function loadLogs() {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page: String(page), limit: '50' });
      if (statusFilter !== 'all') params.set('status', statusFilter);
      const res = await fetch(`${API_URL}/api/v1/webhook-logs?${params}`);
      if (!res.ok) throw new Error('Failed to load webhook logs');
      const json = await res.json();
      const data = json.data || [];
      setLogs(Array.isArray(data) ? data : data.items || []);
      if (data.totalPages) setTotalPages(data.totalPages);
      else if (data.total) setTotalPages(Math.ceil(data.total / 50));
      else if (json.meta?.totalPages) setTotalPages(json.meta.totalPages);

      if (stats.total === 0 && Array.isArray(data) && data.length > 0) {
        setStats({
          total: data.length,
          successful: data.filter((l: any) => l.status === 'Success' || l.statusCode < 400).length,
          errors: data.filter((l: any) => l.status === 'Error' || (l.statusCode && l.statusCode >= 400)).length,
          updates: data.filter((l: any) => l.updated).length,
        });
      }
    } catch (e: any) {
      setError(e.message || 'Failed to load webhook logs');
    } finally {
      setLoading(false);
    }
  }

  const filtered = logs.filter(l => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (l.device || '').toLowerCase().includes(q)
      || (l.shipmentId || l.shipment || '').toLowerCase().includes(q)
      || (l.apiKeyName || l.apiKey || '').toLowerCase().includes(q);
  });

  function statusBadge(l: any): { variant: 'success' | 'destructive' | 'warning'; label: string } {
    if (l.statusCode != null && l.statusCode < 400) return { variant: 'success', label: l.status || 'Success' };
    if (l.statusCode != null && l.statusCode >= 400) return { variant: 'destructive', label: l.status || 'Error' };
    if (l.status === 'Success') return { variant: 'success', label: 'Success' };
    if (l.status === 'Error') return { variant: 'destructive', label: 'Error' };
    return { variant: 'warning', label: l.status || '-' };
  }

  const statBlocks = [
    { label: 'Total', value: stats.total, icon: ListChecks, tone: 'bg-primary/10 text-primary' },
    { label: 'Successful', value: stats.successful, icon: CheckCircle2, tone: 'bg-success/15 text-success' },
    { label: 'Errors', value: stats.errors, icon: XCircle, tone: 'bg-destructive/15 text-destructive' },
    { label: 'Updates', value: stats.updates, icon: RefreshCw, tone: 'bg-info/15 text-info' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Webhook logs</h1>
          <p className="mt-1 text-sm text-muted-foreground">Inbound webhook activity from devices and integrations</p>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statBlocks.map(s => {
          const Icon = s.icon;
          return (
            <Card key={s.label}>
              <CardContent className="flex items-center gap-3 p-4">
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${s.tone}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-2xl font-semibold">{(s.value ?? 0).toLocaleString()}</div>
                  <div className="text-xs text-muted-foreground">{s.label}</div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader className="flex flex-col items-start gap-3 lg:flex-row lg:items-center lg:justify-between">
          <CardTitle>Logs</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              placeholder="Search device, shipment..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-56"
            />
            <Select value={statusFilter} onValueChange={v => { setStatusFilter(v); setPage(1); }}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="success">Success</SelectItem>
                <SelectItem value="error">Error</SelectItem>
                <SelectItem value="skipped">Skipped</SelectItem>
                <SelectItem value="notfound">Not Found</SelectItem>
              </SelectContent>
            </Select>
            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="24h">Last 24 hours</SelectItem>
                <SelectItem value="48h">Last 48 hours</SelectItem>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
              <ListChecks className="h-8 w-8" />
              <h3 className="text-base font-medium">No webhook logs found</h3>
              <p className="text-sm">Logs will appear here when webhooks are received.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Device</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Shipment</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Updated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(l => {
                  const sb = statusBadge(l);
                  return (
                    <TableRow key={l.id} className="cursor-pointer" onClick={() => setSelectedLog(l)}>
                      <TableCell className="whitespace-nowrap font-mono text-xs">
                        {l.createdAt ? new Date(l.createdAt).toLocaleString() : l.time || '-'}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{l.device || l.source || '-'}</div>
                        <div className="text-xs text-muted-foreground">{l.apiKeyName || l.apiKey || ''}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={sb.variant}>{sb.label}</Badge>
                      </TableCell>
                      <TableCell>
                        {(l.shipmentId || l.shipment) ? (
                          <span className="font-medium">{l.shipmentId || l.shipment}</span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {l.hasLocation || l.latitude ? (
                          <MapPin className="h-4 w-4 text-success" />
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {l.updated ? (
                          <CheckCircle2 className="h-4 w-4 text-success" />
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
        <div className="flex items-center justify-between border-t p-3">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>
            <ChevronLeft className="h-4 w-4" />
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </Card>

      <Dialog open={!!selectedLog} onOpenChange={open => !open && setSelectedLog(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Webhook log detail</DialogTitle>
          </DialogHeader>
          {selectedLog && (
            <div className="max-h-[70vh] space-y-4 overflow-auto">
              <dl className="grid gap-3 md:grid-cols-2">
                <div>
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">ID</dt>
                  <dd className="font-mono text-xs">{selectedLog.id}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">Status</dt>
                  <dd className="text-sm">{selectedLog.status}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">Device</dt>
                  <dd className="text-sm">{selectedLog.deviceName || '-'}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">Event type</dt>
                  <dd className="text-sm">{selectedLog.eventType || '-'}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">Shipment</dt>
                  <dd className="text-sm">{selectedLog.shipmentReference || selectedLog.shipmentId || '-'}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">Received</dt>
                  <dd className="text-sm">{selectedLog.createdAt ? new Date(selectedLog.createdAt).toLocaleString() : '-'}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">Processed</dt>
                  <dd className="text-sm">{selectedLog.processedAt ? new Date(selectedLog.processedAt).toLocaleString() : '-'}</dd>
                </div>
                {selectedLog.errorMessage && (
                  <div className="md:col-span-2">
                    <dt className="text-xs uppercase tracking-wide text-muted-foreground">Error</dt>
                    <dd className="text-sm text-destructive">{selectedLog.errorMessage}</dd>
                  </div>
                )}
              </dl>
              {selectedLog.rawPayload && (
                <div>
                  <h3 className="mb-2 text-sm font-semibold">Raw payload</h3>
                  <pre className="max-h-72 overflow-auto rounded-md border bg-muted p-3 font-mono text-xs">
                    {JSON.stringify(selectedLog.rawPayload, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedLog(null)}>
              <X className="h-4 w-4" />
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
