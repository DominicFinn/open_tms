import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Archive,
  Check,
  ChevronDown,
  CircleAlert,
  Eye,
  FileText,
  Hourglass,
  Inbox,
  Loader2,
  MoreVertical,
  Package,
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
  origin?: { name: string; city: string; state: string };
  destination?: { name: string; city: string; state: string };
  requestedPickupDate?: string;
  requestedDeliveryDate?: string;
  serviceLevel?: string;
  temperatureControl?: boolean;
  requiresHazmat?: boolean;
}

type StatusVariant = 'success' | 'info' | 'warning' | 'destructive' | 'muted';

function orderStatusVariant(status: string): StatusVariant {
  const s = status?.toLowerCase().replace(/[_ ]/g, '');
  if (s === 'readytoship' || s === 'ready') return 'success';
  if (s === 'pendingapproval' || s === 'pending') return 'warning';
  if (s === 'shipped' || s === 'intransit') return 'info';
  if (s === 'delivered') return 'success';
  if (s === 'cancelled' || s === 'canceled') return 'destructive';
  return 'muted';
}

function formatDate(d?: string): string {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function VNextOrders() {
  const navigate = useNavigate();
  const { hasPermission } = useCurrentUser();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [activeTab, setActiveTab] = useState('all');
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

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const res = await fetch(`${API_URL}/api/v1/orders`);
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
    fetch(`${API_URL}/api/v1/customers`)
      .then(r => r.json())
      .then(json => setCustomers((json.data || []).filter((c: any) => !c.archived)))
      .catch(() => {});
  }, []);

  const filtered = orders.filter(o => {
    if (statusFilter !== 'all') {
      const sNorm = o.status?.toLowerCase().replace(/[_ ]/g, '');
      const map: Record<string, string> = {
        ready: 'readytoship',
        pending: 'pendingapproval',
        shipped: 'shipped',
        draft: 'draft',
        delivered: 'delivered',
        cancelled: 'cancelled',
      };
      if (sNorm !== map[statusFilter]) return false;
    }
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
  });

  const filteredIds = filtered.map(o => o.id);
  const selectedInView = filteredIds.filter(idv => selected.has(idv));
  const allSelected = filtered.length > 0 && selectedInView.length === filtered.length;

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
    if (selected.size === 0) return;
    setBulkArchiving(true);
    try {
      const ids = Array.from(selected);
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
    if (selected.size === 0) return;
    setBulkDeleting(true);
    try {
      const ids = Array.from(selected);
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
    ready: orders.filter(o => o.status?.toLowerCase().replace(/[_ ]/g, '') === 'readytoship').length,
    pending: orders.filter(o => o.status?.toLowerCase().replace(/[_ ]/g, '') === 'pendingapproval').length,
    shipped: orders.filter(o => o.status?.toLowerCase() === 'shipped').length,
    delivered: orders.filter(o => o.status?.toLowerCase() === 'delivered').length,
  };

  const stats = [
    { label: 'Ready to ship', value: counts.ready, icon: Package, tone: 'bg-success/15 text-success' },
    { label: 'Pending approval', value: counts.pending, icon: Hourglass, tone: 'bg-warning/15 text-warning' },
    { label: 'Shipped', value: counts.shipped, icon: Truck, tone: 'bg-info/15 text-info' },
    { label: 'Delivered', value: counts.delivered, icon: Inbox, tone: 'bg-primary/10 text-primary' },
  ];

  const tabs = [
    { key: 'all', label: 'All orders', count: orders.length },
    { key: 'ready', label: 'Ready to ship', count: counts.ready },
    { key: 'pending', label: 'Pending', count: counts.pending },
    { key: 'shipped', label: 'Shipped', count: counts.shipped },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Orders</h1>
          <p className="mt-1 text-sm text-muted-foreground">{orders.length} orders</p>
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

      <div className="flex flex-wrap items-center gap-1 border-b border-border">
        {tabs.map(tab => (
          <button
            key={tab.key}
            type="button"
            onClick={() => {
              setActiveTab(tab.key);
              setStatusFilter(tab.key === 'all' ? 'all' : tab.key);
            }}
            className={cn(
              '-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors',
              activeTab === tab.key
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {tab.label} ({tab.count})
          </button>
        ))}
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
          <Select defaultValue="all">
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All modes</SelectItem>
              <SelectItem value="ftl">FTL</SelectItem>
              <SelectItem value="ltl">LTL</SelectItem>
              <SelectItem value="reefer">Reefer</SelectItem>
              <SelectItem value="flatbed">Flatbed</SelectItem>
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

        {selected.size > 0 && (
          <div className="flex flex-wrap items-center gap-3 border-b border-border bg-muted/40 px-4 py-3 md:px-6">
            <span className="text-sm font-medium">{selected.size} selected</span>
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
              <TableHead>Requirements</TableHead>
              <TableHead>Req. pickup</TableHead>
              <TableHead>Req. delivery</TableHead>
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
                    <div className="font-mono text-sm font-semibold">{o.orderNumber || o.id}</div>
                    {o.poNumber && <div className="text-xs text-muted-foreground">PO# {o.poNumber}</div>}
                  </TableCell>
                  <TableCell>{o.customer?.name || '-'}</TableCell>
                  <TableCell>
                    <div className="text-sm">{o.origin ? `${o.origin.city}, ${o.origin.state}` : '-'}</div>
                    <div className="text-xs text-muted-foreground">
                      to {o.destination ? `${o.destination.city}, ${o.destination.state}` : '-'}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{o.serviceLevel || '-'}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {o.temperatureControl && <Badge variant="muted">Temp ctrl</Badge>}
                      {o.requiresHazmat && <Badge variant="warning">Hazmat</Badge>}
                      {!o.temperatureControl && !o.requiresHazmat && '-'}
                    </div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sm">{formatDate(o.requestedPickupDate)}</TableCell>
                  <TableCell className="whitespace-nowrap text-sm">{formatDate(o.requestedDeliveryDate)}</TableCell>
                  <TableCell className="text-sm">{o.deliveryStatus || '-'}</TableCell>
                  <TableCell>
                    <Badge variant={orderStatusVariant(o.status)}>{o.status}</Badge>
                  </TableCell>
                  <TableCell onClick={e => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1">
                      {sNorm === 'readytoship' && (
                        <Button size="sm" onClick={() => navigate('/carrier-bidding')}>
                          <Truck className="h-4 w-4" />
                          Ship
                        </Button>
                      )}
                      {sNorm === 'pendingapproval' && (
                        <Button size="sm" variant="outline">
                          <Check className="h-4 w-4" />
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
            <DialogTitle>Delete {selected.size} order{selected.size === 1 ? '' : 's'}?</DialogTitle>
            <DialogDescription>
              Selected orders will be removed from all views. Records are retained for audit
              but cannot be restored from the UI. This is different from archiving.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmBulkDelete(false)} disabled={bulkDeleting}>Cancel</Button>
            <Button variant="destructive" onClick={handleBulkDelete} disabled={bulkDeleting}>
              {bulkDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Delete {selected.size} order{selected.size === 1 ? '' : 's'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
