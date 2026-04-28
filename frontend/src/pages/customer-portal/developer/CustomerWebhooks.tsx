import { useEffect, useState } from 'react';
import { Loader2, Plus } from 'lucide-react';

import { API_URL } from '../../../api';
import { customerFetch } from '../CustomerDashboard';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

interface Webhook {
  id: string;
  name: string;
  url: string;
  events: string[];
  enabled: boolean;
  description: string | null;
  secret: string;
  lastDeliveryAt: string | null;
  lastStatusCode: number | null;
  deliveryCount: number;
  failureCount: number;
  createdAt: string;
}

interface Delivery {
  id: string;
  eventType: string;
  status: string;
  statusCode: number | null;
  errorMessage: string | null;
  deliveredAt: string | null;
  createdAt: string;
}

export default function CustomerWebhooks() {
  const [hooks, setHooks] = useState<Webhook[]>([]);
  const [events, setEvents] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', url: '', description: '', events: ['*'] });
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [deliveries, setDeliveries] = useState<Record<string, Delivery[]>>({});
  const [busy, setBusy] = useState('');

  const load = () => {
    setLoading(true);
    Promise.all([
      customerFetch(`${API_URL}/api/v1/customer-portal/developer/webhooks`).then(r => r.json()),
      customerFetch(`${API_URL}/api/v1/customer-portal/developer/webhooks/events`).then(r => r.json()),
    ]).then(([h, e]) => {
      setHooks(h.data || []);
      setEvents(e.data || []);
    }).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const toggleEvent = (pattern: string) => {
    setForm(f => {
      if (f.events.includes(pattern)) return { ...f, events: f.events.filter(e => e !== pattern) };
      return { ...f, events: [...f.events, pattern] };
    });
  };

  const handleCreate = async () => {
    if (!form.name || !form.url) { setError('Name and URL are required'); return; }
    if (form.events.length === 0) { setError('Select at least one event'); return; }
    setError(''); setBusy('create');
    try {
      const res = await customerFetch(`${API_URL}/api/v1/customer-portal/developer/webhooks`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.error) setError(data.error);
      else { setShowCreate(false); setForm({ name: '', url: '', description: '', events: ['*'] }); load(); }
    } finally { setBusy(''); }
  };

  const handleToggle = async (h: Webhook) => {
    setBusy(h.id);
    await customerFetch(`${API_URL}/api/v1/customer-portal/developer/webhooks/${h.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: !h.enabled }),
    });
    setBusy(''); load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this webhook?')) return;
    await customerFetch(`${API_URL}/api/v1/customer-portal/developer/webhooks/${id}`, { method: 'DELETE' });
    load();
  };

  const handleRotate = async (id: string) => {
    if (!confirm('Rotate the signing secret? The old secret will stop working immediately.')) return;
    setBusy(id);
    const res = await customerFetch(`${API_URL}/api/v1/customer-portal/developer/webhooks/${id}/rotate-secret`, { method: 'POST' });
    const data = await res.json();
    setBusy('');
    if (!data.error) { alert(`New secret: ${data.data.secret}\n\nStore it now - it won't be shown in the list.`); load(); }
  };

  const handleTest = async (id: string) => {
    setBusy(id);
    const res = await customerFetch(`${API_URL}/api/v1/customer-portal/developer/webhooks/${id}/test`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}),
    });
    const data = await res.json();
    setBusy('');
    alert(data.error
      ? `Test failed: ${data.error}`
      : `Test sent - status: ${data.data.status}${data.data.statusCode ? ` (HTTP ${data.data.statusCode})` : ''}${data.data.errorMessage ? `\n${data.data.errorMessage}` : ''}`);
    load();
  };

  const loadDeliveries = async (id: string) => {
    const res = await customerFetch(`${API_URL}/api/v1/customer-portal/developer/webhooks/${id}/deliveries?limit=20`);
    const data = await res.json();
    setDeliveries(d => ({ ...d, [id]: data.data || [] }));
  };

  const toggleExpanded = (id: string) => {
    if (expanded === id) { setExpanded(null); return; }
    setExpanded(id);
    if (!deliveries[id]) loadDeliveries(id);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Webhooks</h1>
          <p className="text-sm text-muted-foreground">
            Subscribe to events from your orders, shipments, invoices, and returns.
          </p>
        </div>
        <Button variant="gradient" onClick={() => setShowCreate(v => !v)}>
          <Plus className="h-4 w-4" />
          New webhook
        </Button>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {showCreate && (
        <Card>
          <CardHeader>
            <CardTitle>New webhook</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="hook-name">Name</Label>
                <Input
                  id="hook-name"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Shipment tracker"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="hook-url">Endpoint URL</Label>
                <Input
                  id="hook-url"
                  value={form.url}
                  onChange={e => setForm(f => ({ ...f, url: e.target.value }))}
                  placeholder="https://yourdomain.com/webhooks/open-tms"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="hook-description">Description</Label>
              <Input
                id="hook-description"
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Optional notes for your team"
              />
            </div>
            <div>
              <div className="mb-2 text-sm font-semibold">Subscribed events</div>
              <div className="flex flex-wrap gap-2">
                {events.map(ev => {
                  const active = form.events.includes(ev);
                  return (
                    <button
                      key={ev}
                      type="button"
                      onClick={() => toggleEvent(ev)}
                      className={cn(
                        'inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                        active
                          ? 'border-primary/40 bg-primary/10 text-primary'
                          : 'border-border bg-muted text-muted-foreground hover:bg-muted/80',
                      )}
                    >
                      {ev}
                    </button>
                  );
                })}
              </div>
              <div className="mt-2 text-xs text-muted-foreground">
                Use <code className="rounded bg-muted px-1">*</code> for everything,{' '}
                <code className="rounded bg-muted px-1">rma.*</code> for all RMA events, or exact patterns.
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="gradient" onClick={handleCreate} disabled={busy === 'create'}>
                {busy === 'create' ? 'Creating...' : 'Create'}
              </Button>
              <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      ) : hooks.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            No webhooks yet. Create one above to start receiving events.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {hooks.map(h => (
            <Card key={h.id}>
              <CardContent className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-semibold">{h.name}</h3>
                      <Badge variant={h.enabled ? 'success' : 'secondary'}>
                        {h.enabled ? 'Enabled' : 'Disabled'}
                      </Badge>
                    </div>
                    <div className="mt-1 truncate text-sm text-muted-foreground">{h.url}</div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {h.events.map(e => (
                        <Badge key={e} variant="muted" className="text-[10px]">{e}</Badge>
                      ))}
                    </div>
                    {h.description && (
                      <div className="mt-2 text-xs text-muted-foreground">{h.description}</div>
                    )}
                    <div className="mt-2 text-xs text-muted-foreground">
                      {h.deliveryCount} deliveries &middot; {h.failureCount} failures
                      {h.lastDeliveryAt && (
                        <> &middot; last at {new Date(h.lastDeliveryAt).toLocaleString()} (HTTP {h.lastStatusCode ?? '-'})</>
                      )}
                    </div>
                    <details className="mt-2">
                      <summary className="cursor-pointer text-xs text-muted-foreground">Reveal signing secret</summary>
                      <code className="mt-1 block break-all rounded bg-muted px-2 py-1 text-xs">{h.secret}</code>
                    </details>
                  </div>
                  <div className="flex shrink-0 flex-col gap-1.5">
                    <Button variant="outline" size="sm" onClick={() => handleTest(h.id)} disabled={busy === h.id}>
                      Send test
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => toggleExpanded(h.id)}>
                      {expanded === h.id ? 'Hide log' : 'View log'}
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleToggle(h)} disabled={busy === h.id}>
                      {h.enabled ? 'Disable' : 'Enable'}
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleRotate(h.id)} disabled={busy === h.id}>
                      Rotate secret
                    </Button>
                    <Button variant="outline" size="sm" className="text-destructive" onClick={() => handleDelete(h.id)}>
                      Delete
                    </Button>
                  </div>
                </div>

                {expanded === h.id && (
                  <div className="mt-4 border-t border-border pt-4">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Event</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>HTTP</TableHead>
                          <TableHead>Time</TableHead>
                          <TableHead>Error</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(deliveries[h.id] || []).length === 0 && (
                          <TableRow>
                            <TableCell colSpan={5} className="py-6 text-center text-sm text-muted-foreground">
                              No deliveries yet
                            </TableCell>
                          </TableRow>
                        )}
                        {(deliveries[h.id] || []).map(d => (
                          <TableRow key={d.id}>
                            <TableCell className="text-sm">{d.eventType}</TableCell>
                            <TableCell>
                              <Badge variant={d.status === 'delivered' ? 'success' : 'destructive'}>
                                {d.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm">{d.statusCode ?? '-'}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {new Date(d.createdAt).toLocaleString()}
                            </TableCell>
                            <TableCell className="max-w-xs truncate text-xs">{d.errorMessage}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
