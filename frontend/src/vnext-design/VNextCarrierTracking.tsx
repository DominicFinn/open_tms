/**
 * VNextCarrierTracking - List page for carrier tracking integrations.
 * Shows all configured integrations with filtering by provider and status.
 */

import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  CircleAlert,
  Eye,
  Inbox,
  Loader2,
  MapPin,
  Plane,
  Plus,
  Repeat,
  Trash2,
  Truck,
  Wifi,
} from 'lucide-react';

import { API_URL } from '../api';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
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
import { cn } from '@/lib/utils';

interface CarrierTrackingIntegration {
  id: string;
  carrierId: string;
  carrierName: string;
  providerType: string;
  status: string;
  pollingEnabled: boolean;
  pollingIntervalMinutes: number;
  lastPolledAt: string | null;
  lastError: string | null;
  errorCount: number;
  createdAt: string;
  updatedAt: string;
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
  return Truck;
}

type BadgeVariant = 'success' | 'warning' | 'destructive' | 'secondary' | 'muted';

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

export default function VNextCarrierTracking() {
  const [integrations, setIntegrations] = useState<CarrierTrackingIntegration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [providerFilter, setProviderFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [deleting, setDeleting] = useState<string | null>(null);

  const fetchIntegrations = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/v1/carrier-tracking/integrations`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load integrations');
      setIntegrations(Array.isArray(json.data) ? json.data : []);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchIntegrations(); }, [fetchIntegrations]);

  const handleDelete = async (id: string, carrierName: string) => {
    if (!confirm(`Delete tracking integration for ${carrierName}? This cannot be undone.`)) return;
    setDeleting(id);
    try {
      const res = await fetch(`${API_URL}/api/v1/carrier-tracking/integrations/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || 'Failed to delete');
      }
      setIntegrations(prev => prev.filter(i => i.id !== id));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setDeleting(null);
    }
  };

  const handleTest = async (id: string) => {
    try {
      const res = await fetch(`${API_URL}/api/v1/carrier-tracking/integrations/${id}/test`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Test failed');
      alert(json.data?.message || 'Connection test successful');
      fetchIntegrations();
    } catch (err) {
      alert(`Test failed: ${(err as Error).message}`);
    }
  };

  const filtered = (integrations || []).filter(i => {
    if (providerFilter !== 'all' && i.providerType !== providerFilter) return false;
    if (statusFilter !== 'all' && i.status !== statusFilter) return false;
    return true;
  });

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-3 py-24 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin" />
        <h3 className="text-lg font-medium">Loading...</h3>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Carrier tracking integrations</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {integrations.length} integration{integrations.length !== 1 ? 's' : ''} configured
          </p>
        </div>
        <Button variant="gradient" asChild>
          <Link to="/integrations/carrier-tracking/setup">
            <Plus className="h-4 w-4" />
            Add integration
          </Link>
        </Button>
      </div>

      {error && (
        <div className="flex items-center gap-3 rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          <CircleAlert className="h-5 w-5" />
          <span className="flex-1">{error}</span>
          <Button variant="ghost" size="sm" onClick={() => setError(null)}>Dismiss</Button>
        </div>
      )}

      <Card>
        <div className="flex flex-wrap items-center gap-3 p-4">
          <Select value={providerFilter} onValueChange={setProviderFilter}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All providers</SelectItem>
              {Object.entries(PROVIDER_LABELS).map(([val, label]) => (
                <SelectItem key={val} value={val}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {Object.entries(STATUS_LABELS).map(([val, label]) => (
                <SelectItem key={val} value={val}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Separator />

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-12 text-muted-foreground">
            <MapPin className="h-10 w-10 opacity-40" />
            {integrations.length === 0 ? (
              <>
                <h3 className="text-base font-semibold">No tracking integrations yet</h3>
                <p className="text-sm">Set up a carrier tracking integration to start receiving real-time shipment updates.</p>
                <Button variant="gradient" asChild>
                  <Link to="/integrations/carrier-tracking/setup">
                    <Plus className="h-4 w-4" />
                    Add integration
                  </Link>
                </Button>
              </>
            ) : (
              <p className="text-sm">No integrations match the current filters.</p>
            )}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Carrier</TableHead>
                <TableHead>Provider</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last polled</TableHead>
                <TableHead>Errors</TableHead>
                <TableHead className="w-[140px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(integration => {
                const Icon = providerIcon(integration.providerType);
                return (
                  <TableRow key={integration.id}>
                    <TableCell>
                      <Link to={`/integrations/carrier-tracking/${integration.id}`} className="font-medium text-primary hover:underline">
                        {integration.carrierName}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4 text-primary" />
                        <span>{PROVIDER_LABELS[integration.providerType] || integration.providerType}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[integration.status] || 'muted'}>
                        {STATUS_LABELS[integration.status] || integration.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {timeAgo(integration.lastPolledAt)}
                    </TableCell>
                    <TableCell>
                      {integration.errorCount > 0 ? (
                        <span className="font-medium text-destructive">{integration.errorCount}</span>
                      ) : (
                        <span className="text-sm text-muted-foreground">0</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" asChild title="View details">
                          <Link to={`/integrations/carrier-tracking/${integration.id}`}>
                            <Eye className="h-4 w-4" />
                          </Link>
                        </Button>
                        <Button variant="ghost" size="icon" title="Test connection" onClick={() => handleTest(integration.id)}>
                          <Wifi className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Delete"
                          onClick={() => handleDelete(integration.id, integration.carrierName)}
                          disabled={deleting === integration.id}
                          className={cn('text-destructive hover:text-destructive')}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
