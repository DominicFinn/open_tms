import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Archive, ArchiveRestore, CircleAlert, Eye, Loader2, Search } from 'lucide-react';
import { toast } from 'sonner';

import { API_URL } from '../api';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface ArchivedOrder {
  id: string;
  orderNumber?: string;
  poNumber?: string;
  status: string;
  archivedAt?: string;
  customer?: { name: string };
  origin?: { city: string; state: string };
  destination?: { city: string; state: string };
}

interface ArchivedShipment {
  id: string;
  reference?: string;
  proNumber?: string;
  status: string;
  archivedAt?: string;
  customer?: { name: string };
  origin?: { city: string; state: string };
  destination?: { city: string; state: string };
  carrier?: { name: string };
}

function formatDateTime(d?: string): string {
  if (!d) return '-';
  return new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export default function VNextArchives() {
  const navigate = useNavigate();
  const { hasPermission } = useCurrentUser();

  const [tab, setTab] = useState<'orders' | 'shipments'>('orders');
  const [search, setSearch] = useState('');

  const [orders, setOrders] = useState<ArchivedOrder[]>([]);
  const [ordersLoaded, setOrdersLoaded] = useState(false);
  const [shipments, setShipments] = useState<ArchivedShipment[]>([]);
  const [shipmentsLoaded, setShipmentsLoaded] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [restoringId, setRestoringId] = useState<string | null>(null);

  const canUnarchiveOrders = hasPermission('orders:delete');
  const canUnarchiveShipments = hasPermission('shipments:delete');

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/api/v1/orders/archived`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.error) throw new Error(json.error || `Failed to load archived orders (${res.status})`);
      setOrders(json.data || []);
      setOrdersLoaded(true);
    } catch (err: any) {
      setError(err.message || 'Failed to load archived orders');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadShipments = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/api/v1/shipments/archived`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.error) throw new Error(json.error || `Failed to load archived shipments (${res.status})`);
      setShipments(json.data || []);
      setShipmentsLoaded(true);
    } catch (err: any) {
      setError(err.message || 'Failed to load archived shipments');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === 'orders' && !ordersLoaded) loadOrders();
    if (tab === 'shipments' && !shipmentsLoaded) loadShipments();
  }, [tab, ordersLoaded, shipmentsLoaded, loadOrders, loadShipments]);

  const handleUnarchiveOrder = useCallback(async (id: string) => {
    setRestoringId(id);
    try {
      const res = await fetch(`${API_URL}/api/v1/orders/${id}/unarchive`, { method: 'POST' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.error) {
        toast.error(json.error || 'Failed to unarchive order', { duration: 8000 });
        return;
      }
      toast.success('Order restored');
      setOrders(prev => prev.filter(o => o.id !== id));
    } catch {
      toast.error('Failed to unarchive order');
    } finally {
      setRestoringId(null);
    }
  }, []);

  const handleUnarchiveShipment = useCallback(async (id: string) => {
    setRestoringId(id);
    try {
      const res = await fetch(`${API_URL}/api/v1/shipments/${id}/unarchive`, { method: 'POST' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.error) {
        toast.error(json.error || 'Failed to unarchive shipment', { duration: 8000 });
        return;
      }
      toast.success('Shipment restored');
      setShipments(prev => prev.filter(s => s.id !== id));
    } catch {
      toast.error('Failed to unarchive shipment');
    } finally {
      setRestoringId(null);
    }
  }, []);

  const filteredOrders = orders.filter(o => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (o.orderNumber || o.id).toLowerCase().includes(q) || (o.customer?.name || '').toLowerCase().includes(q);
  });

  const filteredShipments = shipments.filter(s => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (s.reference || s.id).toLowerCase().includes(q) || (s.customer?.name || '').toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Archives</h1>
        <p className="mt-1 text-sm text-muted-foreground">Orders and shipments that have been archived</p>
      </div>

      <Tabs value={tab} onValueChange={v => setTab(v as 'orders' | 'shipments')}>
        <TabsList>
          <TabsTrigger value="orders">Orders {ordersLoaded && `(${orders.length})`}</TabsTrigger>
          <TabsTrigger value="shipments">Shipments {shipmentsLoaded && `(${shipments.length})`}</TabsTrigger>
        </TabsList>

        <Card className="mt-4">
          <div className="flex flex-wrap items-center gap-3 p-4">
            <div className="relative min-w-[280px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={tab === 'orders' ? 'Search archived orders...' : 'Search archived shipments...'}
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          <Separator />

          {loading ? (
            <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin" />
              <h3 className="text-sm font-medium">Loading...</h3>
            </div>
          ) : error ? (
            <div className="flex items-center gap-3 p-4 text-sm text-destructive">
              <CircleAlert className="h-5 w-5" />
              {error}
            </div>
          ) : (
            <>
              <TabsContent value="orders" className="m-0">
                {filteredOrders.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
                    <Archive className="h-8 w-8" />
                    <p className="text-sm">No archived orders</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Order</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Route</TableHead>
                        <TableHead>Status before archive</TableHead>
                        <TableHead>Archived on</TableHead>
                        <TableHead className="w-[140px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredOrders.map(o => (
                        <TableRow key={o.id} onClick={() => navigate(`/orders/${o.id}`)} className="cursor-pointer">
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
                          <TableCell className="text-sm">{o.status || '-'}</TableCell>
                          <TableCell className="whitespace-nowrap text-sm">{formatDateTime(o.archivedAt)}</TableCell>
                          <TableCell onClick={e => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1">
                              <Button variant="ghost" size="icon" onClick={() => navigate(`/orders/${o.id}`)}>
                                <Eye className="h-4 w-4" />
                              </Button>
                              {canUnarchiveOrders && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleUnarchiveOrder(o.id)}
                                  disabled={restoringId === o.id}
                                >
                                  {restoringId === o.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <ArchiveRestore className="h-4 w-4" />
                                  )}
                                  Unarchive
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </TabsContent>

              <TabsContent value="shipments" className="m-0">
                {filteredShipments.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
                    <Archive className="h-8 w-8" />
                    <p className="text-sm">No archived shipments</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Shipment</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Route</TableHead>
                        <TableHead>Carrier</TableHead>
                        <TableHead>Archived on</TableHead>
                        <TableHead className="w-[140px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredShipments.map(s => (
                        <TableRow key={s.id} onClick={() => navigate(`/shipments/${s.id}`)} className="cursor-pointer">
                          <TableCell>
                            <div className="font-mono text-sm font-semibold">{s.reference || s.id}</div>
                            {s.proNumber && <div className="text-xs text-muted-foreground">PRO# {s.proNumber}</div>}
                          </TableCell>
                          <TableCell>{s.customer?.name || '-'}</TableCell>
                          <TableCell>
                            <div className="text-sm">{s.origin ? `${s.origin.city}, ${s.origin.state}` : '-'}</div>
                            <div className="text-xs text-muted-foreground">
                              to {s.destination ? `${s.destination.city}, ${s.destination.state}` : '-'}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">{s.carrier?.name || '-'}</TableCell>
                          <TableCell className="whitespace-nowrap text-sm">{formatDateTime(s.archivedAt)}</TableCell>
                          <TableCell onClick={e => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1">
                              <Button variant="ghost" size="icon" onClick={() => navigate(`/shipments/${s.id}`)}>
                                <Eye className="h-4 w-4" />
                              </Button>
                              {canUnarchiveShipments && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleUnarchiveShipment(s.id)}
                                  disabled={restoringId === s.id}
                                >
                                  {restoringId === s.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <ArchiveRestore className="h-4 w-4" />
                                  )}
                                  Unarchive
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </TabsContent>
            </>
          )}
        </Card>
      </Tabs>
    </div>
  );
}
