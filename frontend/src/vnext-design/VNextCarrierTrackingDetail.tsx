/**
 * VNextCarrierTrackingDetail - Detail page for a single carrier tracking integration.
 *
 * Two-column layout: main (connection status, recent events) + sidebar (config, credentials, actions).
 */

import React, { useEffect, useState, useCallback } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import {
  Activity,
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  CircleAlert,
  Inbox,
  Loader2,
  Pause,
  Pencil,
  Plane,
  Play,
  RefreshCw,
  Repeat,
  Timer,
  Trash2,
  Truck,
  Wifi,
  X,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

interface TrackingIntegration {
  id: string;
  carrierId: string;
  carrierName: string;
  providerType: string;
  status: string;
  pollingEnabled: boolean;
  pollingIntervalMinutes: number;
  webhookEnabled?: boolean;
  lastPolledAt: string | null;
  lastError: string | null;
  errorCount: number;
  callsToday?: number;
  dailyMax?: number;
  notes?: string;
  credentials?: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

interface TrackingEvent {
  id: string;
  trackingNumber: string;
  status: string;
  location: string;
  occurredAt: string;
  source: string;
}

const PROVIDER_LABELS: Record<string, string> = {
  fedex: 'FedEx',
  ups: 'UPS',
  dhl: 'DHL',
  easypost: 'EasyPost',
  edi_214: 'EDI 214',
  manual: 'Manual',
};

function providerIcon(provider: string) {
  if (provider === 'dhl') return Plane;
  if (provider === 'edi_214') return Repeat;
  if (provider === 'easypost') return Inbox;
  if (provider === 'manual') return Pencil;
  return Truck;
}

type BadgeVariant = 'success' | 'warning' | 'destructive' | 'secondary' | 'muted' | 'info' | 'default';

const STATUS_VARIANT: Record<string, BadgeVariant> = {
  active: 'success',
  pending_setup: 'warning',
  error: 'destructive',
  disabled: 'secondary',
};

const STATUS_LABELS: Record<string, string> = {
  active: 'Active',
  pending_setup: 'Pending setup',
  error: 'Error',
  disabled: 'Disabled',
};

const EVENT_STATUS_VARIANT: Record<string, BadgeVariant> = {
  delivered: 'success',
  in_transit: 'info',
  out_for_delivery: 'default',
  exception: 'destructive',
  pending: 'warning',
  picked_up: 'info',
};

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return 'Never';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString();
}

function maskCredential(value: string): string {
  if (!value || value.length < 8) return '********';
  return '****' + value.slice(-4);
}

export default function VNextCarrierTrackingDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [integration, setIntegration] = useState<TrackingIntegration | null>(null);
  const [events, setEvents] = useState<TrackingEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [testing, setTesting] = useState(false);
  const [polling, setPolling] = useState(false);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notes, setNotes] = useState('');
  const [editingCredentials, setEditingCredentials] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const fetchDetail = useCallback(async () => {
    try {
      const [intRes, eventsRes] = await Promise.all([
        fetch(`${API_URL}/api/v1/carrier-tracking/integrations/${id}`),
        fetch(`${API_URL}/api/v1/carrier-tracking/integrations/${id}/events?limit=20`),
      ]);
      const intJson = await intRes.json();
      if (!intRes.ok) throw new Error(intJson.error || 'Failed to load integration');
      setIntegration(intJson.data);
      setNotes(intJson.data?.notes || '');

      if (eventsRes.ok) {
        const evJson = await eventsRes.json();
        setEvents(evJson.data || []);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchDetail(); }, [fetchDetail]);

  const handleTest = async () => {
    setTesting(true);
    setMessage(null);
    try {
      const res = await fetch(`${API_URL}/api/v1/carrier-tracking/integrations/${id}/test`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok) {
        setMessage({ type: 'error', text: json.error || 'Test failed' });
      } else {
        setMessage({ type: 'success', text: json.data?.message || 'Connection test successful' });
        fetchDetail();
      }
    } catch (err) {
      setMessage({ type: 'error', text: (err as Error).message });
    } finally {
      setTesting(false);
    }
  };

  const handlePoll = async () => {
    setPolling(true);
    setMessage(null);
    try {
      const res = await fetch(`${API_URL}/api/v1/carrier-tracking/integrations/${id}/poll`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Poll failed');
      setMessage({ type: 'success', text: 'Manual poll completed' });
      fetchDetail();
    } catch (err) {
      setMessage({ type: 'error', text: (err as Error).message });
    } finally {
      setPolling(false);
    }
  };

  const handleToggleStatus = async () => {
    if (!integration) return;
    const newStatus = integration.status === 'disabled' ? 'active' : 'disabled';
    try {
      const res = await fetch(`${API_URL}/api/v1/carrier-tracking/integrations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to update');
      setMessage({ type: 'success', text: `Integration ${newStatus === 'active' ? 'enabled' : 'disabled'}` });
      fetchDetail();
    } catch (err) {
      setMessage({ type: 'error', text: (err as Error).message });
    }
  };

  const handleTogglePolling = async () => {
    if (!integration) return;
    try {
      const res = await fetch(`${API_URL}/api/v1/carrier-tracking/integrations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pollingEnabled: !integration.pollingEnabled }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to update');
      fetchDetail();
    } catch (err) {
      setMessage({ type: 'error', text: (err as Error).message });
    }
  };

  const handleSaveNotes = async () => {
    try {
      const res = await fetch(`${API_URL}/api/v1/carrier-tracking/integrations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to save notes');
      setEditingNotes(false);
      fetchDetail();
    } catch (err) {
      setMessage({ type: 'error', text: (err as Error).message });
    }
  };

  const handleDelete = async () => {
    try {
      const res = await fetch(`${API_URL}/api/v1/carrier-tracking/integrations/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || 'Failed to delete');
      }
      navigate('/integrations/carrier-tracking');
    } catch (err) {
      setMessage({ type: 'error', text: (err as Error).message });
      setShowDeleteConfirm(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-3 py-24 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin" />
        <h3 className="text-lg font-medium">Loading...</h3>
      </div>
    );
  }

  if (error || !integration) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-3 rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          <CircleAlert className="h-5 w-5" />
          {error || 'Integration not found'}
        </div>
        <Button variant="link" asChild>
          <Link to="/integrations/carrier-tracking">Back to list</Link>
        </Button>
      </div>
    );
  }

  const ProviderIcon = providerIcon(integration.providerType);
  const callsPercent = integration.dailyMax
    ? Math.min(100, Math.round(((integration.callsToday || 0) / integration.dailyMax) * 100))
    : 0;

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" asChild className="-ml-3 self-start">
        <Link to="/integrations/carrier-tracking">
          <ArrowLeft className="h-4 w-4" />
          Back to carrier tracking
        </Link>
      </Button>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <ProviderIcon className="h-6 w-6" />
        </div>
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight">{integration.carrierName}</h1>
          <div className="mt-1 flex items-center gap-2">
            <Badge variant="info">{PROVIDER_LABELS[integration.providerType] || integration.providerType}</Badge>
            <Badge variant={STATUS_VARIANT[integration.status] || 'muted'}>
              {STATUS_LABELS[integration.status] || integration.status}
            </Badge>
          </div>
        </div>
      </div>

      {message && (
        <div className={cn(
          'flex items-center gap-3 rounded-md border p-4 text-sm',
          message.type === 'success'
            ? 'border-success/30 bg-success/10 text-success'
            : 'border-destructive/30 bg-destructive/10 text-destructive',
        )}>
          {message.type === 'success' ? <CheckCircle2 className="h-5 w-5" /> : <CircleAlert className="h-5 w-5" />}
          <span className="flex-1">{message.text}</span>
          <Button variant="ghost" size="icon" onClick={() => setMessage(null)}><X className="h-4 w-4" /></Button>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <Card className="space-y-4 p-5">
            <h3 className="flex items-center gap-2 text-base font-semibold">
              <Activity className="h-5 w-5 text-primary" />
              Connection status
            </h3>

            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <div className="text-xs text-muted-foreground">Last polled</div>
                <div className="mt-1 text-sm font-medium">{timeAgo(integration.lastPolledAt)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Error count</div>
                <div className={cn('mt-1 text-sm font-medium', integration.errorCount > 0 && 'text-destructive')}>
                  {integration.errorCount}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Created</div>
                <div className="mt-1 text-sm font-medium">{formatDate(integration.createdAt)}</div>
              </div>
            </div>

            {integration.lastError && (
              <div className="flex items-start gap-3 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                <CircleAlert className="mt-0.5 h-4 w-4" />
                {integration.lastError}
              </div>
            )}

            {integration.dailyMax && integration.dailyMax > 0 && (
              <div>
                <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
                  <span>API usage today</span>
                  <span>{integration.callsToday || 0} / {integration.dailyMax}</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn(
                      'h-full transition-all',
                      callsPercent > 80 ? 'bg-destructive' : callsPercent > 50 ? 'bg-warning' : 'bg-success',
                    )}
                    style={{ width: `${callsPercent}%` }}
                  />
                </div>
              </div>
            )}

            <Button onClick={handlePoll} disabled={polling}>
              {polling ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              {polling ? 'Polling...' : 'Poll now'}
            </Button>
          </Card>

          <Card className="space-y-4 p-5">
            <h3 className="flex items-center gap-2 text-base font-semibold">
              <CalendarClock className="h-5 w-5 text-primary" />
              Recent tracking events
            </h3>

            {events.length === 0 ? (
              <div className="flex flex-col items-center gap-2 rounded-md border-2 border-dashed border-border p-8 text-center text-muted-foreground">
                <CalendarClock className="h-8 w-8 opacity-40" />
                <p className="text-sm">No tracking events yet. Events will appear here once shipments are tracked.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tracking number</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Occurred</TableHead>
                    <TableHead>Source</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {events.map(event => (
                    <TableRow key={event.id}>
                      <TableCell><span className="font-mono text-sm">{event.trackingNumber}</span></TableCell>
                      <TableCell>
                        <Badge variant={EVENT_STATUS_VARIANT[event.status] || 'muted'}>
                          {event.status.replace(/_/g, ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{event.location || '-'}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{formatDate(event.occurredAt)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{event.source}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
        </div>

        <div className="space-y-3">
          <Card className="space-y-3 p-4">
            <h4 className="text-sm font-semibold">Configuration</h4>
            <div className="space-y-1 text-sm">
              <div className="flex items-center justify-between border-b border-border py-2">
                <span className="text-muted-foreground">Provider</span>
                <span className="font-medium">{PROVIDER_LABELS[integration.providerType] || integration.providerType}</span>
              </div>
              <div className="flex items-center justify-between border-b border-border py-2">
                <span className="text-muted-foreground">Polling</span>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={integration.pollingEnabled} onChange={handleTogglePolling} />
                  <span className="font-medium">{integration.pollingEnabled ? 'Enabled' : 'Disabled'}</span>
                </label>
              </div>
              {integration.pollingEnabled && (
                <div className="flex items-center justify-between border-b border-border py-2">
                  <span className="text-muted-foreground">Interval</span>
                  <span className="font-medium">{integration.pollingIntervalMinutes} min</span>
                </div>
              )}
              <div className="flex items-center justify-between py-2">
                <span className="text-muted-foreground">Webhook</span>
                <span className="font-medium">{integration.webhookEnabled ? 'Active' : 'Not configured'}</span>
              </div>
            </div>
          </Card>

          {integration.credentials && Object.keys(integration.credentials).length > 0 && (
            <Card className="space-y-3 p-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold">Credentials</h4>
                <Button variant="ghost" size="icon" title="Edit credentials" onClick={() => setEditingCredentials(!editingCredentials)}>
                  {editingCredentials ? <X className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
                </Button>
              </div>
              <div className="space-y-1 text-sm">
                {Object.entries(integration.credentials).map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between border-b border-border py-2">
                    <span className="text-muted-foreground">{key}</span>
                    <span className="font-mono text-xs">{editingCredentials ? value : maskCredential(value)}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          <Card className="space-y-3 p-4">
            <h4 className="text-sm font-semibold">Actions</h4>
            <div className="flex flex-col gap-2">
              <Button onClick={handleTest} disabled={testing} className="w-full">
                {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wifi className="h-4 w-4" />}
                {testing ? 'Testing...' : 'Test connection'}
              </Button>
              <Button variant="outline" onClick={handleToggleStatus} className="w-full">
                {integration.status === 'disabled' ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                {integration.status === 'disabled' ? 'Enable' : 'Disable'}
              </Button>
              <Button variant="destructive" onClick={() => setShowDeleteConfirm(true)} className="w-full">
                <Trash2 className="h-4 w-4" />
                Delete integration
              </Button>
            </div>
          </Card>

          <Card className="space-y-3 p-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold">Notes</h4>
              {!editingNotes && (
                <Button variant="ghost" size="icon" title="Edit notes" onClick={() => setEditingNotes(true)}>
                  <Pencil className="h-4 w-4" />
                </Button>
              )}
            </div>
            {editingNotes ? (
              <div className="space-y-2">
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  rows={4}
                  placeholder="Add notes about this integration..."
                  className="w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
                <div className="flex justify-end gap-2">
                  <Button variant="outline" size="sm" onClick={() => { setEditingNotes(false); setNotes(integration.notes || ''); }}>
                    Cancel
                  </Button>
                  <Button size="sm" onClick={handleSaveNotes}>Save</Button>
                </div>
              </div>
            ) : (
              <p className={cn('whitespace-pre-wrap text-sm', !integration.notes && 'text-muted-foreground')}>
                {integration.notes || 'No notes.'}
              </p>
            )}
          </Card>
        </div>
      </div>

      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete integration</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the tracking integration for <strong>{integration.carrierName}</strong>?
              This will stop all tracking updates from this carrier. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
