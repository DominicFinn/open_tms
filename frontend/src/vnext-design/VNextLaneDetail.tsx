import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Archive,
  ArrowLeft,
  ArrowRight,
  CircleAlert,
  Clock,
  Loader2,
  Map as MapIcon,
  Pencil,
  Plus,
  Radar,
  Route as RouteIcon,
  Ruler,
} from 'lucide-react';

import { API_URL } from '../api';
import GoogleMapsRouteEditor from '../components/GoogleMapsRouteEditor';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export default function VNextLaneDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [lane, setLane] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    fetch(`${API_URL}/api/v1/lanes/${id}`)
      .then(res => {
        if (!res.ok) throw new Error('Failed to load lane');
        return res.json();
      })
      .then(json => {
        if (json.error) throw new Error(json.error);
        setLane(json.data);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-3 py-24 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin" />
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
  if (!lane) {
    return (
      <div className="flex items-center gap-3 rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
        <CircleAlert className="h-5 w-5" />
        Lane not found
      </div>
    );
  }

  const origin = lane.origin || {};
  const destination = lane.destination || {};
  const carriers = lane.laneCarriers || [];
  const stops = lane.stops || [];
  const route = lane.route || null;
  const laneName = lane.name
    || `${origin.city || '?'}, ${origin.state || '?'} -> ${destination.city || '?'}, ${destination.state || '?'}`;

  const originLatLng = origin.lat && origin.lng ? { lat: origin.lat, lng: origin.lng } : null;
  const destLatLng = destination.lat && destination.lng ? { lat: destination.lat, lng: destination.lng } : null;
  const stopLatLngs = stops
    .filter((s: any) => s.location?.lat && s.location?.lng)
    .map((s: any) => ({ lat: s.location.lat, lng: s.location.lng }));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Button variant="ghost" size="sm" onClick={() => navigate('/lanes')} className="-ml-3">
          <ArrowLeft className="h-4 w-4" />
          Lanes
        </Button>
        <span className="text-muted-foreground">/ {laneName}</span>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{laneName}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge variant={lane.status === 'active' ? 'success' : 'muted'}>
              {lane.status || 'Unknown'}
            </Badge>
            {route && (
              <Badge variant="info" className="gap-1">
                <RouteIcon className="h-3 w-3" />
                Route planned
              </Badge>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate(`/lanes/${id}/edit`)}>
            <Pencil className="h-4 w-4" />
            Edit
          </Button>
          <Button variant="outline" size="sm">
            <Archive className="h-4 w-4" />
            Archive
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <MapIcon className="h-5 w-5 text-primary" />
                {route ? 'Planned route' : 'Lane route'}
              </CardTitle>
              {!route && (
                <Button variant="outline" size="sm" onClick={() => navigate(`/lanes/${id}/edit`)}>
                  <Plus className="h-4 w-4" />
                  Plan route
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {route ? (
                <>
                  <GoogleMapsRouteEditor
                    origin={originLatLng}
                    destination={destLatLng}
                    stops={stopLatLngs}
                    existingPolyline={route.encodedPolyline}
                    corridorMeters={route.corridorMeters}
                    height={350}
                    editable={false}
                  />

                  <div className="mt-4 flex flex-wrap gap-6 text-sm">
                    <div className="flex items-center gap-1.5">
                      <Ruler className="h-4 w-4 text-primary" />
                      <strong>{(route.distanceMeters / 1609.34).toFixed(1)} mi</strong>
                      <span className="text-muted-foreground">
                        ({(route.distanceMeters / 1000).toFixed(1)} km)
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Clock className="h-4 w-4 text-primary" />
                      <strong>
                        {Math.floor(route.durationSeconds / 3600)}h{' '}
                        {Math.round((route.durationSeconds % 3600) / 60)}m
                      </strong>
                    </div>
                    {route.summary && (
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <RouteIcon className="h-4 w-4" />
                        via {route.summary}
                      </div>
                    )}
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Radar className="h-4 w-4" />
                      Deviation corridor: {(route.corridorMeters / 1000).toFixed(1)} km
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex h-52 items-center justify-center rounded-md border border-dashed border-border bg-muted/30 text-muted-foreground">
                  <div className="text-center">
                    <MapIcon className="mx-auto h-12 w-12 opacity-40" />
                    <div className="mt-2 text-sm">No planned route configured</div>
                    <div className="mt-1 text-xs">Edit this lane to plan a route for deviation alerts</div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Carriers</CardTitle>
              <Button variant="outline" size="sm">
                <Plus className="h-4 w-4" />
                Add carrier
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Carrier</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Service level</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {carriers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="py-12 text-center text-sm text-muted-foreground">
                        No carriers assigned
                      </TableCell>
                    </TableRow>
                  ) : (
                    carriers.map((c: any, i: number) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">
                          {c.carrier?.name || '-'}
                          {c.carrier?.mcNumber ? ` (${c.carrier.mcNumber})` : ''}
                        </TableCell>
                        <TableCell>{c.price != null ? `${c.currency || '$'}${c.price}` : '-'}</TableCell>
                        <TableCell>{c.serviceLevel || '-'}</TableCell>
                        <TableCell>
                          <Badge variant={c.assigned ? 'success' : 'muted'}>
                            {c.assigned ? 'Assigned' : 'Available'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Recent shipments</CardTitle>
              <Button variant="ghost" size="sm">
                View all
                <ArrowRight className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Reference</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Pickup date</TableHead>
                    <TableHead>Delivery date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell colSpan={4} className="py-12 text-center text-sm text-muted-foreground">
                      {lane._count?.shipments != null
                        ? `${lane._count.shipments} shipment(s) on this lane`
                        : 'No shipment data available'}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-6 lg:sticky lg:top-20 lg:self-start">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Lane info</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="space-y-3 text-sm">
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">Distance</dt>
                  <dd>{lane.distance ? `${lane.distance} miles` : '-'}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">Status</dt>
                  <dd>{lane.status || '-'}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">Service level</dt>
                  <dd>{lane.serviceLevel || '-'}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">Notes</dt>
                  <dd className="text-right">{lane.notes || '-'}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          {route && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Route deviation</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="space-y-3 text-sm">
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">Status</dt>
                    <dd><Badge variant="success" className="text-[10px]">Active</Badge></dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">Corridor</dt>
                    <dd>{(route.corridorMeters / 1000).toFixed(1)} km</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">Provider</dt>
                    <dd className="capitalize">{route.provider || 'Google'}</dd>
                  </div>
                </dl>
                <p className="mt-3 text-xs text-muted-foreground">
                  In-transit shipments on this lane will be monitored for route deviations beyond {(route.corridorMeters / 1000).toFixed(1)} km from the planned route.
                </p>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-5">
              <div className="mb-3 flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-success" />
                <span className="text-sm font-semibold">Origin</span>
              </div>
              <dl className="space-y-2 text-sm">
                <div>
                  <dt className="text-xs text-muted-foreground">Facility</dt>
                  <dd>{origin.name || '-'}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Address</dt>
                  <dd>{[origin.city, origin.state].filter(Boolean).join(', ') || '-'}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <div className="mb-3 flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-destructive" />
                <span className="text-sm font-semibold">Destination</span>
              </div>
              <dl className="space-y-2 text-sm">
                <div>
                  <dt className="text-xs text-muted-foreground">Facility</dt>
                  <dd>{destination.name || '-'}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Address</dt>
                  <dd>{[destination.city, destination.state].filter(Boolean).join(', ') || '-'}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Stops</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {stops.length === 0 && (
                <p className="text-sm text-muted-foreground">No intermediate stops.</p>
              )}
              {stops.map((stop: any, i: number) => (
                <div key={stop.id || i} className="flex items-start gap-3">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-warning text-xs font-bold text-warning-foreground">
                    {i + 1}
                  </div>
                  <div>
                    <div className="text-sm font-medium">
                      {stop.location?.name || stop.name || `Stop ${i + 1}`}
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {stop.location?.city || stop.city || ''}
                      {stop.location?.state || stop.state ? `, ${stop.location?.state || stop.state}` : ''}
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
