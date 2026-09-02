import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Archive,
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  Clock,
  Eye,
  FileText,
  Loader2,
  MoreVertical,
  Pencil,
  Plus,
  Search,
  Trash2,
  Truck,
  Upload,
  X,
} from 'lucide-react';

import { toast } from 'sonner';

import { API_URL } from '../api';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

interface Order {
  id: string;
  orderNumber?: string;
  poNumber?: string;
  status: string;
  deliveryStatus?: string;
  customerId?: string;
  customer?: { name: string };
  originId?: string;
  destinationId?: string;
  origin?: { name: string; city: string; state: string };
  destination?: { name: string; city: string; state: string };
  requestedPickupDate?: string;
  requestedDeliveryDate?: string;
  serviceLevel?: string;
  // "ambient" (default), "refrigerated", or "frozen" — not a boolean.
  temperatureControl?: string;
  requiresHazmat?: boolean;
}

type StatusVariant = 'success' | 'info' | 'warning' | 'destructive' | 'muted';

// Order.status enum: pending, verified, assigned, issue, cancelled, archived
function orderStatusVariant(status: string): StatusVariant {
  const s = status?.toLowerCase().replace(/[_ ]/g, '');
  if (s === 'verified') return 'success';
  if (s === 'pending') return 'warning';
  if (s === 'assigned') return 'info';
  if (s === 'issue') return 'destructive';
  if (s === 'cancelled') return 'destructive';
  // Orthogonal to the lifecycle above — set by archive/unarchive, same
  // "Inactive" tone Carriers uses.
  if (s === 'archived') return 'destructive';
  return 'muted';
}

// 'verified' and 'assigned' read as "Available" / "Assigned" rather than
// the raw enum — "assigned" only means booked onto a shipment, not that it
// has physically departed (that's deliveryStatus's job).
const ORDER_STATUS_LABEL: Record<string, string> = {
  pending: 'Pending approval',
  verified: 'Available',
  assigned: 'Assigned',
  issue: 'Needs attention',
  cancelled: 'Cancelled',
  archived: 'Archived',
};
function orderStatusLabel(status: string): string {
  const s = status?.toLowerCase().replace(/[_ ]/g, '');
  return ORDER_STATUS_LABEL[s] || status;
}

// Order.deliveryStatus: null (not moving yet), in_transit, delivered, exception
// — only ever set once status is 'assigned'.
const DELIVERY_STATUS_LABEL: Record<string, string> = {
  in_transit: 'In transit',
  delivered: 'Delivered',
  exception: 'Exception',
};
function deliveryStatusLabel(status?: string): string {
  if (!status) return 'Not moving yet';
  return DELIVERY_STATUS_LABEL[status] || status;
}
function deliveryStatusVariant(status?: string): StatusVariant {
  if (status === 'delivered') return 'success';
  if (status === 'in_transit') return 'info';
  if (status === 'exception') return 'destructive';
  return 'muted';
}

function formatDate(d?: string): string {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// Query params consumed by VNextCreateShipment's fromOrderId prefill effect.
function buildShipQueryString(o: Order): string {
  const params = new URLSearchParams();
  params.set('fromOrderId', o.id);
  if (o.customerId) params.set('customerId', o.customerId);
  if (o.originId) params.set('originId', o.originId);
  if (o.destinationId) params.set('destinationId', o.destinationId);
  if (o.serviceLevel) params.set('mode', o.serviceLevel);
  if (o.requestedPickupDate) params.set('pickupDate', o.requestedPickupDate.slice(0, 10));
  if (o.requestedDeliveryDate) params.set('deliveryDate', o.requestedDeliveryDate.slice(0, 10));
  if (o.temperatureControl && o.temperatureControl !== 'ambient') params.set('tempControlled', '1');
  if (o.requiresHazmat) params.set('hazmat', '1');
  return params.toString();
}

export default function VNextOrders() {
  const navigate = useNavigate();
  const { hasPermission } = useCurrentUser();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [deliveryFilter, setDeliveryFilter] = useState('all');
  const [modeFilter, setModeFilter] = useState('all');
  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<{ id: string; name: string }[]>([]);
  const [customerFilter, setCustomerFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkArchiving, setBulkArchiving] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [openIssueOrderIds, setOpenIssueOrderIds] = useState<Set<string>>(new Set());
  // LTL "Ship" flow: pick an existing eligible shipment instead of always
  // spinning up a new one, since LTL's whole economics depend on consolidating
  // several orders into one trailer rather than one order per shipment (FTL's
  // "Ship" instead goes straight to creating a new shipment, prefilled).
  const [shipOrder, setShipOrder] = useState<Order | null>(null);
  const [eligibleShipments, setEligibleShipments] = useState<any[]>([]);
  const [eligibleShipmentsLoading, setEligibleShipmentsLoading] = useState(false);
  const [eligibleShipmentSearch, setEligibleShipmentSearch] = useState('');
  const [selectedShipmentId, setSelectedShipmentId] = useState('');
  const [assigningToShipment, setAssigningToShipment] = useState(false);
  const [approvingId, setApprovingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        // Fetch archived orders too — excluded from the default "all
        // statuses" view (see `filtered` below) but reachable via the
        // Archived option so ops can look one up without an admin's
        // orders:delete permission. Restoring it still requires that
        // permission (gated in VNextOrderDetail's Unarchive button).
        const res = await fetch(`${API_URL}/api/v1/orders?includeArchived=true`);
        if (!res.ok) throw new Error(`Failed to load orders (${res.status})`);
        const json = await res.json();
        if (!cancelled) {
          setOrders(json.data || []);
          setError('');
        }
      } catch (err: any) {
        if (!cancelled) setError(err.message || 'Failed to load orders');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  useEffect(() => {
    fetch(`${API_URL}/api/v1/issues?sourceEntityType=order&status=open,in_progress&limit=500`)
      .then(r => r.json())
      .then(json => {
        const ids: string[] = (json.data || [])
          .map((issue: any) => issue.sourceEntityId)
          .filter(Boolean);
        setOpenIssueOrderIds(new Set(ids));
      })
      .catch(() => {});
  }, [refreshKey]);

  useEffect(() => {
    fetch(`${API_URL}/api/v1/customers`)
      .then(r => r.json())
      .then(json => setCustomers((json.data || []).filter((c: any) => !c.archived)))
      .catch(() => {});
  }, []);

  const filtered = useMemo(() => orders.filter(o => {
    const sNorm = o.status?.toLowerCase().replace(/[_ ]/g, '');
    if (statusFilter === 'all') {
      // "All statuses" means all active work, not literally everything —
      // archived orders only show up once someone explicitly asks for them.
      if (sNorm === 'archived') return false;
    } else if (sNorm !== statusFilter) {
      return false;
    }
    if (deliveryFilter !== 'all') {
      if (o.status?.toLowerCase() !== 'assigned') return false;
      const dNorm = o.deliveryStatus || 'none';
      if (dNorm !== deliveryFilter) return false;
    }
    if (modeFilter !== 'all' && o.serviceLevel?.toLowerCase() !== modeFilter) return false;
    if (customerFilter !== 'all' && o.customerId !== customerFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const orderNum = (o.orderNumber || o.id || '').toLowerCase();
      const customerName = o.customer?.name?.toLowerCase() || '';
      const originLabel = o.origin ? `${o.origin.city}, ${o.origin.state}`.toLowerCase() : '';
      const destLabel = o.destination ? `${o.destination.city}, ${o.destination.state}`.toLowerCase() : '';
      return orderNum.includes(q) || customerName.includes(q) || originLabel.includes(q) || destLabel.includes(q);
    }
    return true;
  }), [orders, statusFilter, deliveryFilter, modeFilter, customerFilter, search]);

  const filteredIds = useMemo(() => filtered.map(o => o.id), [filtered]);
  const selectedInView = filteredIds.filter(idv => selected.has(idv));
  const allSelected = filtered.length > 0 && selectedInView.length === filtered.length;

  // Selection is keyed by id and otherwise persists across filter changes, which lets a stale
  // selection made under one filter silently apply under another. Prune it back to whatever's
  // still visible whenever the filtered set changes, so the displayed count and any bulk action
  // always match what's on screen.
  useEffect(() => {
    setSelected(prev => {
      const visible = new Set(filteredIds);
      const next = new Set<string>();
      let changed = false;
      prev.forEach(id => {
        if (visible.has(id)) next.add(id);
        else changed = true;
      });
      return changed ? next : prev;
    });
  }, [filteredIds]);

  const toggleOne = (orderId: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(orderId)) next.delete(orderId); else next.add(orderId);
      return next;
    });
  };

  const toggleAll = () => {
    setSelected(prev => {
      const next = new Set(prev);
      if (allSelected) {
        filteredIds.forEach(idv => next.delete(idv));
      } else {
        filteredIds.forEach(idv => next.add(idv));
      }
      return next;
    });
  };

  const clearSelection = () => setSelected(new Set());

  const handleBulkArchive = async () => {
    if (selectedInView.length === 0) return;
    setBulkArchiving(true);
    try {
      const ids = selectedInView;
      const res = await fetch(`${API_URL}/api/v1/orders/bulk-archive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        toast.error(json.error || 'Bulk archive failed', { duration: 8000 });
        return;
      }
      const results: Array<{ id: string; success: boolean; error: string | null }> = json.data?.results ?? [];
      const ok = results.filter(r => r.success);
      const failed = results.filter(r => !r.success);
      if (failed.length === 0) {
        toast.success(`${ok.length} order${ok.length === 1 ? '' : 's'} archived`);
      } else {
        const reason = failed[0]?.error ?? 'blocked';
        toast.warning(`${ok.length} archived, ${failed.length} skipped. e.g. ${reason}`, { duration: 9000 });
      }
      clearSelection();
      setRefreshKey(k => k + 1);
    } catch {
      toast.error('Bulk archive failed');
    } finally {
      setBulkArchiving(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedInView.length === 0) return;
    setBulkDeleting(true);
    try {
      const ids = selectedInView;
      const res = await fetch(`${API_URL}/api/v1/orders/bulk-delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        toast.error(json.error || 'Bulk delete failed', { duration: 8000 });
        return;
      }
      const results: Array<{ id: string; success: boolean; error: string | null }> = json.data?.results ?? [];
      const ok = results.filter(r => r.success);
      const failed = results.filter(r => !r.success);
      if (failed.length === 0) {
        toast.success(`${ok.length} order${ok.length === 1 ? '' : 's'} deleted`);
      } else {
        const reason = failed[0]?.error ?? 'blocked';
        toast.warning(`${ok.length} deleted, ${failed.length} skipped. e.g. ${reason}`, { duration: 9000 });
      }
      clearSelection();
      setRefreshKey(k => k + 1);
    } catch {
      toast.error('Bulk delete failed');
    } finally {
      setBulkDeleting(false);
      setConfirmBulkDelete(false);
    }
  };

  const handleShipClick = (o: Order) => {
    if (o.serviceLevel?.toUpperCase() === 'FTL') {
      navigate(`/shipments/create?${buildShipQueryString(o)}`);
      return;
    }
    // LTL: offer to consolidate onto an existing open shipment first.
    setShipOrder(o);
    setSelectedShipmentId('');
    setEligibleShipmentSearch('');
    setEligibleShipmentsLoading(true);
    fetch(`${API_URL}/api/v1/orders/${o.id}/eligible-shipments`)
      .then(res => res.json())
      .then(json => setEligibleShipments(json.data || []))
      .catch(() => setEligibleShipments([]))
      .finally(() => setEligibleShipmentsLoading(false));
  };

  const handleAssignToShipment = async () => {
    if (!shipOrder || !selectedShipmentId) return;
    setAssigningToShipment(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/shipments/${selectedShipmentId}/add-orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderIds: [shipOrder.id] }),
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        toast.error(json.error || 'Failed to add order to shipment', { duration: 8000 });
        return;
      }
      const errors: string[] = json.data?.errors || [];
      if (errors.length > 0) {
        toast.warning(json.data.message, { duration: 9000 });
      } else {
        toast.success(json.data.message || 'Order added to shipment');
      }
      setShipOrder(null);
      setRefreshKey(k => k + 1);
    } catch {
      toast.error('Failed to add order to shipment');
    } finally {
      setAssigningToShipment(false);
    }
  };

  const filteredEligibleShipments = eligibleShipmentSearch.trim()
    ? eligibleShipments.filter((s: any) => {
        const q = eligibleShipmentSearch.toLowerCase();
        const reference = (s.reference || s.id || '').toLowerCase();
        const destLabel = s.destination ? `${s.destination.city}, ${s.destination.state || ''}`.toLowerCase() : '';
        return reference.includes(q) || destLabel.includes(q);
      })
    : eligibleShipments;

  const handleApprove = async (o: Order) => {
    setApprovingId(o.id);
    try {
      const res = await fetch(`${API_URL}/api/v1/orders/${o.id}/approve`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok || json.error) {
        toast.error(json.error || 'Failed to approve order', { duration: 8000 });
        return;
      }
      toast.success(`${o.orderNumber || 'Order'} approved`);
      setRefreshKey(k => k + 1);
    } catch {
      toast.error('Failed to approve order');
    } finally {
      setApprovingId(null);
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

  if (error) {
    return (
      <div className="flex items-center gap-3 rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
        <CircleAlert className="h-5 w-5" />
        {error}
      </div>
    );
  }

  const counts = {
    pending: orders.filter(o => o.status?.toLowerCase() === 'pending').length,
    available: orders.filter(o => o.status?.toLowerCase() === 'verified').length,
    inShipment: orders.filter(o => o.status?.toLowerCase() === 'assigned').length,
    needsAttention: orders.filter(o => o.status?.toLowerCase() === 'issue').length,
    cancelled: orders.filter(o => o.status?.toLowerCase() === 'cancelled').length,
    archived: orders.filter(o => o.status?.toLowerCase() === 'archived').length,
  };

  // Delivery status only ever exists once an order is in a shipment, so
  // these four cards are scoped to (and sum to) counts.inShipment rather
  // than the full order count.
  const inShipmentOrders = orders.filter(o => o.status?.toLowerCase() === 'assigned');
  const deliveryCounts = {
    none: inShipmentOrders.filter(o => !o.deliveryStatus).length,
    in_transit: inShipmentOrders.filter(o => o.deliveryStatus === 'in_transit').length,
    delivered: inShipmentOrders.filter(o => o.deliveryStatus === 'delivered').length,
    exception: inShipmentOrders.filter(o => o.deliveryStatus === 'exception').length,
  };

  const deliveryStats = [
    { key: 'none', label: 'Not moving yet', value: deliveryCounts.none, icon: Clock, tone: 'bg-muted text-muted-foreground' },
    { key: 'in_transit', label: 'In transit', value: deliveryCounts.in_transit, icon: Truck, tone: 'bg-info/15 text-info' },
    { key: 'delivered', label: 'Delivered', value: deliveryCounts.delivered, icon: CheckCircle2, tone: 'bg-success/15 text-success' },
    { key: 'exception', label: 'Exception', value: deliveryCounts.exception, icon: AlertTriangle, tone: 'bg-destructive/15 text-destructive' },
  ];

  const statusOptions = [
    { value: 'all', label: 'All statuses' },
    { value: 'pending', label: `${ORDER_STATUS_LABEL.pending} (${counts.pending})` },
    { value: 'verified', label: `${ORDER_STATUS_LABEL.verified} (${counts.available})` },
    { value: 'assigned', label: `${ORDER_STATUS_LABEL.assigned} (${counts.inShipment})` },
    { value: 'issue', label: `${ORDER_STATUS_LABEL.issue} (${counts.needsAttention})` },
    { value: 'cancelled', label: `${ORDER_STATUS_LABEL.cancelled} (${counts.cancelled})` },
    // Lookup-only for anyone without orders:delete — the Unarchive action
    // itself stays gated to admins on the order detail page, so selecting
    // this just lets ops find an order to point an admin at.
    { value: 'archived', label: `${ORDER_STATUS_LABEL.archived} (${counts.archived})` },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Orders</h1>
          <p className="mt-1 text-sm text-muted-foreground">{orders.length - counts.archived} orders</p>
        </div>
        <div className="flex gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <Upload className="h-4 w-4" />
                Import
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => navigate('/orders/import/csv')}>
                <FileText className="h-4 w-4" />
                Import from CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate('/orders/import/edi')}>
                <Upload className="h-4 w-4" />
                Import from EDI
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {hasPermission('orders:write') && (
            <Button variant="gradient" onClick={() => navigate('/orders/create')}>
              <Plus className="h-4 w-4" />
              New order
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {deliveryStats.map(stat => {
          const Icon = stat.icon;
          const active = deliveryFilter === stat.key;
          return (
            <Card
              key={stat.key}
              role="button"
              tabIndex={0}
              onClick={() => setDeliveryFilter(active ? 'all' : stat.key)}
              className={cn('cursor-pointer transition-colors', active && 'ring-2 ring-primary')}
            >
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

      <Card>
        <div className="flex flex-wrap items-center gap-3 p-4">
          <div className="relative min-w-[280px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search orders by ID, customer, route..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[190px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {statusOptions.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={modeFilter} onValueChange={setModeFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All modes</SelectItem>
              <SelectItem value="ftl">FTL</SelectItem>
              <SelectItem value="ltl">LTL</SelectItem>
            </SelectContent>
          </Select>
          <Select value={customerFilter} onValueChange={setCustomerFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="All customers" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All customers</SelectItem>
              {customers.map(c => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Separator />

        {selectedInView.length > 0 && (
          <div className="flex flex-wrap items-center gap-3 border-b border-border bg-muted/40 px-4 py-3 md:px-6">
            <span className="text-sm font-medium">{selectedInView.length} selected</span>
            <Button variant="ghost" size="sm" onClick={clearSelection}>
              <X className="h-4 w-4" />
              Clear
            </Button>
            <div className="ml-auto flex items-center gap-2">
              {hasPermission('orders:write') && (
                <Button variant="outline" size="sm" disabled={bulkArchiving} onClick={handleBulkArchive}>
                  {bulkArchiving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Archive className="h-4 w-4" />}
                  Archive
                </Button>
              )}
              {hasPermission('orders:delete') && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={bulkDeleting}
                  onClick={() => setConfirmBulkDelete(true)}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </Button>
              )}
            </div>
          </div>
        )}

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <input
                  type="checkbox"
                  aria-label="Select all orders"
                  className="h-4 w-4 cursor-pointer accent-primary"
                  checked={allSelected}
                  ref={el => { if (el) el.indeterminate = selectedInView.length > 0 && !allSelected; }}
                  onChange={toggleAll}
                />
              </TableHead>
              <TableHead>Order</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Route</TableHead>
              <TableHead>Service</TableHead>
              <TableHead>Dates</TableHead>
              <TableHead>Delivery status</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[120px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map(o => {
              const sNorm = o.status?.toLowerCase().replace(/[_ ]/g, '');
              return (
                <TableRow
                  key={o.id}
                  onClick={() => navigate(`/orders/${o.id}`)}
                  className={cn('cursor-pointer', selected.has(o.id) && 'bg-primary/5')}
                >
                  <TableCell onClick={e => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      aria-label={`Select ${o.orderNumber || o.id}`}
                      className="h-4 w-4 cursor-pointer accent-primary"
                      checked={selected.has(o.id)}
                      onChange={() => toggleOne(o.id)}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-sm font-semibold">{o.orderNumber || o.id}</span>
                      {openIssueOrderIds.has(o.id) && (
                        <span title="Has an open issue">
                          <AlertTriangle
                            className="h-3.5 w-3.5 shrink-0 text-destructive"
                            aria-label="Has open issue"
                          />
                        </span>
                      )}
                    </div>
                    {o.poNumber && <div className="text-xs text-muted-foreground">PO# {o.poNumber}</div>}
                  </TableCell>
                  <TableCell>{o.customer?.name || '-'}</TableCell>
                  <TableCell>
                    <div className="text-sm">{o.origin ? `${o.origin.city}, ${o.origin.state}` : '-'}</div>
                    <div className="text-xs text-muted-foreground">
                      to {o.destination ? `${o.destination.city}, ${o.destination.state}` : '-'}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap items-center gap-1">
                      <span className="text-sm">{o.serviceLevel || '-'}</span>
                      {o.temperatureControl && o.temperatureControl !== 'ambient' && <Badge variant="muted">Temp ctrl</Badge>}
                      {o.requiresHazmat && <Badge variant="warning">Hazmat</Badge>}
                    </div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <div className="text-sm">{formatDate(o.requestedPickupDate)}</div>
                    <div className="text-xs text-muted-foreground">to {formatDate(o.requestedDeliveryDate)}</div>
                  </TableCell>
                  <TableCell>
                    {sNorm === 'assigned' ? (
                      <Badge variant={deliveryStatusVariant(o.deliveryStatus)}>{deliveryStatusLabel(o.deliveryStatus)}</Badge>
                    ) : '-'}
                  </TableCell>
                  <TableCell>
                    <Badge variant={orderStatusVariant(o.status)}>{orderStatusLabel(o.status)}</Badge>
                  </TableCell>
                  <TableCell onClick={e => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1">
                      {sNorm === 'verified' && (
                        <Button size="sm" onClick={() => handleShipClick(o)}>
                          <Truck className="h-4 w-4" />
                          Ship
                        </Button>
                      )}
                      {sNorm === 'pending' && hasPermission('*') && (
                        <Button size="sm" variant="outline" disabled={approvingId === o.id} onClick={() => handleApprove(o)}>
                          {approvingId === o.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                          Approve
                        </Button>
                      )}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44">
                          <DropdownMenuItem onClick={() => navigate(`/orders/${o.id}`)}>
                            <Eye className="h-4 w-4" />
                            View
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => navigate(`/orders/${o.id}/edit`)}>
                            <Pencil className="h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => navigate(`/documents?orderId=${o.id}`)}>
                            <FileText className="h-4 w-4" />
                            Documents
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      {/* Bulk soft-delete confirmation (admin) */}
      <Dialog open={confirmBulkDelete} onOpenChange={setConfirmBulkDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {selectedInView.length} order{selectedInView.length === 1 ? '' : 's'}?</DialogTitle>
            <DialogDescription>
              Selected orders will be removed from all views. Records are retained for audit
              but cannot be restored from the UI. This is different from archiving.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmBulkDelete(false)} disabled={bulkDeleting}>Cancel</Button>
            <Button variant="destructive" onClick={handleBulkDelete} disabled={bulkDeleting}>
              {bulkDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Delete {selectedInView.length} order{selectedInView.length === 1 ? '' : 's'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* LTL "Ship": assign to an existing shipment, or fall back to creating one */}
      <Dialog open={!!shipOrder} onOpenChange={open => { if (!open) setShipOrder(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Ship {shipOrder?.orderNumber || 'this order'}</DialogTitle>
            <DialogDescription>
              LTL orders can consolidate onto an existing shipment for the same origin and customer.
              Only shipments still in draft or ready are eligible.
            </DialogDescription>
          </DialogHeader>
          {eligibleShipments.length > 0 && (
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search eligible shipments..."
                value={eligibleShipmentSearch}
                onChange={e => setEligibleShipmentSearch(e.target.value)}
                className="pl-9"
                autoFocus
              />
            </div>
          )}
          <div className="max-h-[50vh] overflow-y-auto -mx-1 px-1">
            {eligibleShipmentsLoading ? (
              <div className="flex items-center justify-center py-10 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : eligibleShipments.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No eligible shipments yet for this origin and customer.
              </p>
            ) : filteredEligibleShipments.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No eligible shipments match "{eligibleShipmentSearch}".
              </p>
            ) : (
              <div className="space-y-1">
                {filteredEligibleShipments.map((s: any) => (
                  <label
                    key={s.id}
                    className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 hover:bg-muted/40"
                  >
                    <input
                      type="radio"
                      name="ship-target-shipment"
                      className="h-4 w-4 cursor-pointer accent-primary"
                      checked={selectedShipmentId === s.id}
                      onChange={() => setSelectedShipmentId(s.id)}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium">{s.reference || s.id.slice(0, 8)}</span>
                      <span className="block text-xs text-muted-foreground">
                        {s.orderShipments?.length || 0} order{(s.orderShipments?.length || 0) === 1 ? '' : 's'} &middot; to {s.destination ? `${s.destination.city}, ${s.destination.state || ''}` : 'unknown destination'}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>
          <DialogFooter className="sm:justify-between">
            <Button
              variant="outline"
              disabled={assigningToShipment}
              onClick={() => shipOrder && navigate(`/shipments/create?${buildShipQueryString(shipOrder)}`)}
            >
              <Plus className="h-4 w-4" />
              Create new shipment instead
            </Button>
            <Button onClick={handleAssignToShipment} disabled={assigningToShipment || !selectedShipmentId}>
              {assigningToShipment ? <Loader2 className="h-4 w-4 animate-spin" /> : <Truck className="h-4 w-4" />}
              Assign to shipment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
