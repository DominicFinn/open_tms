import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Clock, Loader2 } from 'lucide-react';

import { API_URL } from '../../api';
import { customerFetch } from './CustomerDashboard';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type StatusVariant = 'success' | 'info' | 'warning' | 'destructive' | 'muted' | 'secondary';

function statusVariant(s: string): StatusVariant {
  const m: Record<string, StatusVariant> = {
    in_transit: 'info',
    delivered: 'success',
    booked: 'warning',
    exception: 'destructive',
    at_pickup: 'warning',
    at_delivery: 'warning',
  };
  return m[s] || 'secondary';
}

function stopVariant(s: string): StatusVariant {
  if (s === 'completed') return 'success';
  if (s === 'arrived') return 'info';
  return 'secondary';
}

export default function CustomerShipmentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [shipment, setShipment] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    customerFetch(`${API_URL}/api/v1/customer-portal/shipments/${id}`)
      .then(r => r.json())
      .then(json => setShipment(json.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-3 py-24 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }
  if (!shipment) {
    return (
      <div className="rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
        Shipment not found
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Button variant="ghost" size="sm" onClick={() => navigate('/customer-portal/shipments')}>
          <ArrowLeft className="h-4 w-4" />
          Shipments
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-bold tracking-tight">{shipment.reference}</h1>
        <Badge variant={statusVariant(shipment.status)}>{shipment.status}</Badge>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Origin</CardTitle>
          </CardHeader>
          <CardContent>
            {shipment.origin ? (
              <div className="space-y-1">
                <div className="font-semibold">{shipment.origin.name}</div>
                <div className="text-sm text-muted-foreground">{shipment.origin.address1}</div>
                <div className="text-sm text-muted-foreground">
                  {shipment.origin.city}, {shipment.origin.state} {shipment.origin.postalCode}
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
            {shipment.destination ? (
              <div className="space-y-1">
                <div className="font-semibold">{shipment.destination.name}</div>
                <div className="text-sm text-muted-foreground">{shipment.destination.address1}</div>
                <div className="text-sm text-muted-foreground">
                  {shipment.destination.city}, {shipment.destination.state} {shipment.destination.postalCode}
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
              <div className="text-xs text-muted-foreground">Carrier</div>
              <div className="font-semibold">{shipment.carrier?.name || '-'}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Pickup date</div>
              <div className="font-semibold">{shipment.pickupDate ? new Date(shipment.pickupDate).toLocaleDateString() : '-'}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Delivery date</div>
              <div className="font-semibold">{shipment.deliveryDate ? new Date(shipment.deliveryDate).toLocaleDateString() : '-'}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">PRO number</div>
              <div className="font-semibold">{shipment.proNumber || '-'}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {shipment.stops && shipment.stops.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Stops</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {shipment.stops.map((stop: any, i: number) => (
              <div
                key={stop.id}
                className="flex items-center gap-3 border-b border-border py-2 last:border-0"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                  {i + 1}
                </span>
                <div className="flex-1">
                  <div className="text-sm font-semibold">{stop.location?.name || 'Unknown'}</div>
                  <div className="text-xs text-muted-foreground">
                    {stop.location?.city}, {stop.location?.state} - {stop.stopType}
                  </div>
                </div>
                <Badge variant={stopVariant(stop.status)}>{stop.status}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {shipment.events && shipment.events.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Tracking events</CardTitle>
          </CardHeader>
          <CardContent>
            {shipment.events.map((evt: any) => (
              <div key={evt.id} className="flex gap-3 border-b border-border py-2 last:border-0">
                <Clock className="mt-0.5 h-4 w-4 text-muted-foreground" />
                <div>
                  <div className="text-sm">{evt.eventType}: {evt.description || evt.status || '-'}</div>
                  <div className="text-xs text-muted-foreground">{new Date(evt.createdAt).toLocaleString()}</div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
