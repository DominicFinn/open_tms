import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Clock, Loader2, MapPin, SearchX, Truck } from 'lucide-react';

import { API_URL } from '../api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Logo } from '@/components/brand/Logo';

interface TrackingData {
  reference: string;
  status: string;
  pickupDate?: string;
  deliveryDate?: string;
  proNumber?: string;
  origin?: { city: string; state: string };
  destination?: { city: string; state: string };
  stops: Array<{
    sequenceNumber: number;
    stopType: string;
    status: string;
    arrivedAt?: string;
    completedAt?: string;
    location?: { name: string; city: string; state: string };
  }>;
  events: Array<{
    eventType: string;
    status?: string;
    description?: string;
    createdAt: string;
  }>;
  currentLocation?: { lat: number; lng: number; asOf: string } | null;
}

type StatusVariant = 'success' | 'info' | 'warning' | 'destructive' | 'muted';

function statusVariant(s: string): StatusVariant {
  const m: Record<string, StatusVariant> = {
    in_transit: 'info',
    delivered: 'success',
    booked: 'warning',
    exception: 'destructive',
    at_pickup: 'warning',
    at_delivery: 'warning',
  };
  return m[s] || 'muted';
}

function statusLabel(s: string): string {
  return s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function formatDate(d?: string): string {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function PublicTracking() {
  const { token } = useParams();
  const [data, setData] = useState<TrackingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) return;
    fetch(`${API_URL}/api/v1/track/${token}`)
      .then(r => r.json())
      .then(json => {
        if (json.error) setError(json.error);
        else setData(json.data);
      })
      .catch(() => setError('Failed to load tracking information'))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background bg-shell-gradient px-4">
        <Card className="max-w-md border-border/50 bg-card/80 backdrop-blur-xl">
          <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
            <SearchX className="h-16 w-16 text-muted-foreground" />
            <h2 className="text-xl font-semibold">Tracking Not Found</h2>
            <p className="text-sm text-muted-foreground">{error || 'This tracking link is invalid or has expired.'}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background bg-shell-gradient">
      {/* Header */}
      <div className="border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-6 py-4">
          <Logo size="md" showWordmark={false} />
          <span className="text-lg font-bold">Shipment Tracking</span>
        </div>
      </div>

      <div className="mx-auto max-w-3xl space-y-6 p-6">
        {/* Status banner */}
        <Card className="border-l-4 border-l-info">
          <CardContent className="p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground">Shipment Reference</div>
                <div className="mt-1 text-2xl font-bold tracking-tight">{data.reference}</div>
                {data.proNumber && (
                  <div className="mt-1 text-sm text-muted-foreground">PRO: {data.proNumber}</div>
                )}
              </div>
              <Badge variant={statusVariant(data.status)} className="text-sm">
                {statusLabel(data.status)}
              </Badge>
            </div>

            {/* Route */}
            <div className="mt-6 flex items-center gap-4">
              <div className="flex-1">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">Origin</div>
                <div className="mt-0.5 text-base font-semibold">
                  {data.origin ? `${data.origin.city}, ${data.origin.state}` : '-'}
                </div>
                {data.pickupDate && (
                  <div className="text-xs text-muted-foreground">{formatDate(data.pickupDate)}</div>
                )}
              </div>
              <ArrowRight className="h-6 w-6 text-muted-foreground" />
              <div className="flex-1 text-right">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">Destination</div>
                <div className="mt-0.5 text-base font-semibold">
                  {data.destination ? `${data.destination.city}, ${data.destination.state}` : '-'}
                </div>
                {data.deliveryDate && (
                  <div className="text-xs text-muted-foreground">{formatDate(data.deliveryDate)}</div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stops timeline */}
        {data.stops.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Stops</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {data.stops.map((stop, i) => (
                <div
                  key={i}
                  className={`flex gap-4 px-6 py-3 ${i < data.stops.length - 1 ? 'border-b border-border' : ''}`}
                >
                  <div
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                      stop.status === 'completed'
                        ? 'bg-success text-background'
                        : stop.status === 'arrived'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {stop.status === 'completed' ? <CheckCircle2 className="h-4 w-4" /> : stop.sequenceNumber}
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-semibold">{stop.location?.name || `Stop ${stop.sequenceNumber}`}</div>
                    <div className="text-xs text-muted-foreground">
                      {stop.location?.city}, {stop.location?.state} - {stop.stopType}
                    </div>
                    {stop.arrivedAt && (
                      <div className="mt-1 text-xs text-muted-foreground">
                        Arrived: {new Date(stop.arrivedAt).toLocaleString()}
                      </div>
                    )}
                    {stop.completedAt && (
                      <div className="text-xs text-success">
                        Completed: {new Date(stop.completedAt).toLocaleString()}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Tracking events */}
        {data.events.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Tracking Events</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {data.events.map((evt, i) => (
                <div
                  key={i}
                  className={`flex gap-3 px-6 py-3 ${i < data.events.length - 1 ? 'border-b border-border' : ''}`}
                >
                  <Clock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="flex-1">
                    <div className="text-sm font-medium">{evt.description || evt.eventType}</div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(evt.createdAt).toLocaleString()}
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Footer */}
        <div className="flex items-center justify-center gap-2 pt-4 text-xs text-muted-foreground">
          <Truck className="h-3.5 w-3.5" />
          Powered by Open TMS
        </div>
      </div>
    </div>
  );
}
