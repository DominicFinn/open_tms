import React, { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Archive, ArrowLeft, Loader2, Boxes } from 'lucide-react';
import { toast } from 'sonner';

import { API_URL } from '../../api';
import { customerFetch } from './CustomerDashboard';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import HandlingUnitsEditor, { HUEditorEndpoints } from '../../components/HandlingUnitsEditor';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

type StatusVariant = 'success' | 'info' | 'warning' | 'destructive' | 'muted' | 'default' | 'secondary';

function statusVariant(s: string): StatusVariant {
  const m: Record<string, StatusVariant> = {
    validated: 'info',
    converted: 'info',
    assigned: 'default',
    in_transit: 'info',
    delivered: 'success',
    exception: 'destructive',
    cancelled: 'muted',
  };
  return m[s] || 'secondary';
}

function formatCents(cents: number | null | undefined, currency = 'USD'): string {
  if (cents == null) return '-';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(cents / 100);
}

function formatDate(d: string | null | undefined): string {
  if (!d) return '-';
  return new Date(d).toLocaleDateString();
}

export default function CustomerOrderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [archiving, setArchiving] = useState(false);
  const [editingUnits, setEditingUnits] = useState(false);

  const reload = useCallback(() => {
    return customerFetch(`${API_URL}/api/v1/customer-portal/orders/${id}`)
      .then(r => r.json())
      .then(json => setOrder(json.data))
      .catch(() => {});
  }, [id]);

  useEffect(() => {
    setLoading(true);
    reload().finally(() => setLoading(false));
  }, [reload]);

  const handlingUnitEndpoints: HUEditorEndpoints = {
    cartonizationPreview: `${API_URL}/api/v1/order-line-items/cartonization/preview-units`,
    packagingTypes:       `${API_URL}/api/v1/customer-portal/packaging-types`,
    createUnit:      (orderId)     => `${API_URL}/api/v1/customer-portal/orders/${orderId}/trackable-units`,
    updateUnit:      (unitId)      => `${API_URL}/api/v1/customer-portal/trackable-units/${unitId}`,
    deleteUnit:      (unitId)      => `${API_URL}/api/v1/customer-portal/trackable-units/${unitId}`,
    moveLineItem:    (lineItemId)  => `${API_URL}/api/v1/customer-portal/line-items/${lineItemId}/move`,
    generateBarcode: (unitId)      => `${API_URL}/api/v1/customer-portal/trackable-units/${unitId}/generate-barcode`,
    mergeUnits:      (orderId)     => `${API_URL}/api/v1/customer-portal/orders/${orderId}/trackable-units/merge`,
    splitUnit:       (unitId)      => `${API_URL}/api/v1/customer-portal/trackable-units/${unitId}/split`,
  };

  const canArchive = !!order && !order.archived;

  async function handleArchive() {
    if (!window.confirm(`Archive order ${order.orderNumber}? It will be removed from your active orders list.`)) return;
    setArchiving(true);
    try {
      const res = await customerFetch(`${API_URL}/api/v1/customer-portal/orders/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok || json.error) {
        toast.error('Failed to archive order', { description: json.error || `HTTP ${res.status}` });
        setArchiving(false);
        return;
      }
      toast.success(`Order ${order.orderNumber} archived`);
      navigate('/customer-portal/orders');
    } catch (err: any) {
      toast.error('Failed to archive order', { description: err?.message || 'Network error' });
      setArchiving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-3 py-24 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }
  if (!order) {
    return (
      <div className="rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
        Order not found
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Button variant="ghost" size="sm" onClick={() => navigate('/customer-portal/orders')}>
          <ArrowLeft className="h-4 w-4" />
          Orders
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-bold tracking-tight">{order.orderNumber}</h1>
        <Badge variant={statusVariant(order.status)}>{order.status}</Badge>
        <Badge variant={statusVariant(order.deliveryStatus)}>{order.deliveryStatus}</Badge>
        {order.archived && (
          <Badge variant="muted" className="gap-1">
            <Archive className="h-3 w-3" />
            Archived
          </Badge>
        )}
        {canArchive && (
          <Button variant="outline" size="sm" className="ml-auto" onClick={handleArchive} disabled={archiving}>
            {archiving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Archive className="h-4 w-4" />}
            {archiving ? 'Archiving...' : 'Archive'}
          </Button>
        )}
      </div>

      {order.archived && (
        <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
          This order is archived{order.archivedAt ? ` (${new Date(order.archivedAt).toLocaleDateString()})` : ''} and no longer appears in your active orders list. It remains accessible by its order number.
        </div>
      )}

      <div className="grid gap-6 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Origin</CardTitle>
          </CardHeader>
          <CardContent>
            {order.origin ? (
              <div className="space-y-1">
                <div className="font-semibold">{order.origin.name}</div>
                <div className="text-sm text-muted-foreground">{order.origin.address1}</div>
                <div className="text-sm text-muted-foreground">
                  {order.origin.city}, {order.origin.state} {order.origin.postalCode}
                </div>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">-</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Destination</CardTitle>
          </CardHeader>
          <CardContent>
            {order.destination ? (
              <div className="space-y-1">
                <div className="font-semibold">{order.destination.name}</div>
                <div className="text-sm text-muted-foreground">{order.destination.address1}</div>
                <div className="text-sm text-muted-foreground">
                  {order.destination.city}, {order.destination.state} {order.destination.postalCode}
                </div>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">-</div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <div className="text-xs text-muted-foreground">PO number</div>
              <div className="font-semibold">{order.poNumber || '-'}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Service level</div>
              <div className="font-semibold">{order.serviceLevel || '-'}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Temperature</div>
              <div className="font-semibold">{order.temperatureControl || '-'}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Hazmat</div>
              <div className="font-semibold">{order.requiresHazmat ? 'Yes' : 'No'}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Order date</div>
              <div className="font-semibold">{formatDate(order.orderDate)}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Requested pickup</div>
              <div className="font-semibold">{formatDate(order.requestedPickupDate)}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Requested delivery</div>
              <div className="font-semibold">{formatDate(order.requestedDeliveryDate)}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Delivered at</div>
              <div className="font-semibold">{order.deliveredAt ? new Date(order.deliveredAt).toLocaleString() : '-'}</div>
            </div>
          </div>
          {(order.specialInstructions || order.notes) && (
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {order.specialInstructions && (
                <div>
                  <div className="text-xs text-muted-foreground">Special instructions</div>
                  <div className="text-sm">{order.specialInstructions}</div>
                </div>
              )}
              {order.notes && (
                <div>
                  <div className="text-xs text-muted-foreground">Notes</div>
                  <div className="text-sm">{order.notes}</div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {order.lineItems && order.lineItems.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Line items</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SKU</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead>UoM</TableHead>
                  <TableHead className="text-right">Weight</TableHead>
                  <TableHead>Dims</TableHead>
                  <TableHead>Class</TableHead>
                  <TableHead className="text-right">Unit price</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {order.lineItems.map((li: any) => (
                  <TableRow key={li.id}>
                    <TableCell className="font-mono text-sm">{li.sku}</TableCell>
                    <TableCell className="text-sm">{li.description || '-'}</TableCell>
                    <TableCell className="text-right text-sm">{li.quantity}</TableCell>
                    <TableCell className="text-sm">{li.unitOfMeasure || '-'}</TableCell>
                    <TableCell className="text-right text-sm">
                      {li.weight != null ? `${li.weight} ${li.weightUnit}` : '-'}
                    </TableCell>
                    <TableCell className="text-sm">
                      {li.length && li.width && li.height
                        ? `${li.length} x ${li.width} x ${li.height} ${li.dimUnit}`
                        : '-'}
                    </TableCell>
                    <TableCell className="text-sm">{li.freightClass || '-'}{li.nmfcCode ? ` (${li.nmfcCode})` : ''}</TableCell>
                    <TableCell className="text-right text-sm">{formatCents(li.unitPriceCents, li.priceCurrency)}</TableCell>
                    <TableCell className="text-right text-sm">{formatCents(li.totalPriceCents, li.priceCurrency)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {order.lineItems.some((li: any) => li.hazmat) && (
              <div className="rounded-md border border-warning/40 bg-warning/10 p-3">
                <div className="mb-2 text-sm font-semibold">Hazardous materials</div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>SKU</TableHead>
                      <TableHead>UN number</TableHead>
                      <TableHead>Class</TableHead>
                      <TableHead>Packing group</TableHead>
                      <TableHead>Proper shipping name</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {order.lineItems.filter((li: any) => li.hazmat).map((li: any) => (
                      <TableRow key={'hz-' + li.id}>
                        <TableCell className="font-mono text-sm">{li.sku}</TableCell>
                        <TableCell className="text-sm">{li.unNumber || '-'}</TableCell>
                        <TableCell className="text-sm">{li.hazmatClass || '-'}</TableCell>
                        <TableCell className="text-sm">{li.packingGroup || '-'}</TableCell>
                        <TableCell className="text-sm">{li.properShippingName || '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {order.lineItems.some((li: any) => li.hsCode || li.countryOfOrigin) && (
              <div className="rounded-md border border-border p-3">
                <div className="mb-2 text-sm font-semibold">Customs</div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>SKU</TableHead>
                      <TableHead>HS code</TableHead>
                      <TableHead>Country of origin</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {order.lineItems.filter((li: any) => li.hsCode || li.countryOfOrigin).map((li: any) => (
                      <TableRow key={'cu-' + li.id}>
                        <TableCell className="font-mono text-sm">{li.sku}</TableCell>
                        <TableCell className="text-sm">{li.hsCode || '-'}</TableCell>
                        <TableCell className="text-sm">{li.countryOfOrigin || '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {order.lineItems.some((li: any) => li.tempMinC != null || li.tempMaxC != null) && (
              <div className="rounded-md border border-info/40 bg-info/10 p-3">
                <div className="mb-2 text-sm font-semibold">Temperature requirements</div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>SKU</TableHead>
                      <TableHead>Temp min (°C)</TableHead>
                      <TableHead>Temp max (°C)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {order.lineItems.filter((li: any) => li.tempMinC != null || li.tempMaxC != null).map((li: any) => (
                      <TableRow key={'tc-' + li.id}>
                        <TableCell className="font-mono text-sm">{li.sku}</TableCell>
                        <TableCell className="text-sm">{li.tempMinC ?? '-'}</TableCell>
                        <TableCell className="text-sm">{li.tempMaxC ?? '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Handling units</CardTitle>
          {!order.archived && (
            <Button variant="outline" size="sm" onClick={() => setEditingUnits(e => !e)}>
              <Boxes className="h-4 w-4" />
              {editingUnits ? 'Done editing' : 'Edit handling units'}
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {editingUnits ? (
            <HandlingUnitsEditor
              orderId={order.id}
              units={(order.trackableUnits ?? []).map((u: any) => ({
                id: u.id,
                identifier: u.identifier,
                unitType: u.unitType,
                sequenceNumber: u.sequenceNumber,
                packagingType: u.packagingType ?? null,
                packagingTypeId: u.packagingTypeId ?? null,
                weight: u.weight, weightUnit: u.weightUnit,
                length: u.length, width: u.width, height: u.height, dimUnit: u.dimUnit,
                stackable: u.stackable,
              }))}
              lineItems={(order.lineItems ?? []).map((li: any) => ({
                id: li.id, sku: li.sku, description: li.description, quantity: li.quantity,
                weight: li.weight, weightUnit: li.weightUnit,
                length: li.length, width: li.width, height: li.height, dimUnit: li.dimUnit,
                freightClass: li.freightClass,
                trackableUnitId: li.trackableUnitId ?? null,
              }))}
              endpoints={handlingUnitEndpoints}
              fetcher={customerFetch as unknown as typeof fetch}
              onChange={reload}
            />
          ) : order.trackableUnits && order.trackableUnits.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Identifier</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Packaging</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Weight</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {order.trackableUnits.map((u: any) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-mono text-sm">{u.identifier || u.id.slice(0, 8)}</TableCell>
                    <TableCell className="text-sm">{u.unitType || '-'}</TableCell>
                    <TableCell className="text-sm">
                      {u.packagingType ? `${u.packagingType.kind}: ${u.packagingType.code}` : '-'}
                    </TableCell>
                    <TableCell><Badge variant="muted">{u.condition || u.status || '-'}</Badge></TableCell>
                    <TableCell className="text-right text-sm">
                      {u.weight != null ? `${u.weight} ${u.weightUnit || 'kg'}` : '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-sm text-muted-foreground">No handling units yet. Click "Edit handling units" to build them.</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
