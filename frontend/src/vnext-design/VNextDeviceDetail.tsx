import React, { useEffect, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Activity,
  MapPin,
  Loader2,
  Link as LinkIcon,
  AlertTriangle,
} from 'lucide-react';

import { API_URL } from '../api';
import { getDeviceImageUrl } from './deviceImages';
import { TimeSeriesChart, readingsToSeries } from './TelemetryChart';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

interface SensorReading {
  id: string;
  temperature: number | null;
  batteryLevel: number | null;
  lightLevel: number | null;
  impactG: number | null;
  tempMin: number | null;
  tempMax: number | null;
  lat: number | null;
  lng: number | null;
  isAlert: boolean;
  eventTime: string;
}

interface DeviceEvent {
  id: string;
  eventType: string;
  category: string;
  message: string | null;
  zoneName: string | null;
  startTime: string;
}

interface Assignment {
  id: string;
  shipmentId: string | null;
  shipment?: { reference: string };
  orderId: string | null;
  order?: { orderNumber: string };
  active: boolean;
  assignedAt: string;
  unassignedAt: string | null;
}

interface Device {
  id: string;
  externalId: string;
  displayId: string;
  name: string;
  provider: string;
  model: string;
  firmware: string;
  status: string;
  batteryLevel: number | null;
  lastSeenAt: string | null;
  lastLat: number | null;
  lastLng: number | null;
  assignments: Assignment[];
  sensorReadings: SensorReading[];
  deviceEvents: DeviceEvent[];
}

function relativeTime(dateStr: string | null): string {
  if (!dateStr) return '-';
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  if (diffMs < 0) return 'just now';
  const mins = Math.floor(diffMs / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(dateStr).toLocaleDateString();
}

function categoryVariant(category: string): 'destructive' | 'warning' | 'info' | 'secondary' {
  switch (category) {
    case 'alert': return 'destructive';
    case 'geofence': return 'warning';
    case 'status': return 'info';
    default: return 'secondary';
  }
}

function statusVariant(status: string): 'success' | 'warning' | 'secondary' {
  if (status === 'active') return 'success';
  if (status === 'inactive') return 'warning';
  return 'secondary';
}

function batteryColorClass(level: number | null): string {
  if (level == null) return 'text-muted-foreground';
  if (level > 50) return 'text-success';
  if (level >= 20) return 'text-warning';
  return 'text-destructive';
}

export default function VNextDeviceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [device, setDevice] = useState<Device | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const res = await fetch(`${API_URL}/api/v1/devices/${id}`);
        if (!res.ok) throw new Error(`Failed to load device (${res.status})`);
        const json = await res.json();
        if (json.error) throw new Error(json.error);
        if (!cancelled) {
          setDevice(json.data);
          setError('');
        }
      } catch (err: any) {
        if (!cancelled) setError(err.message || 'Failed to load device');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <span>{error}</span>
      </div>
    );
  }

  if (!device) {
    return (
      <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <span>Device not found</span>
      </div>
    );
  }

  const readings = device.sensorReadings || [];
  const events = device.deviceEvents || [];
  const assignments = device.assignments || [];
  const activeAssignment = assignments.find(a => a.active);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Button variant="ghost" size="sm" onClick={() => navigate('/devices')}>
          <ArrowLeft className="h-4 w-4" />
          Devices
        </Button>
        <span>/</span>
        <span className="text-foreground">{device.name}</span>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        {(() => {
          const imgUrl = getDeviceImageUrl(device.model);
          return imgUrl ? (
            <img src={imgUrl} alt={device.model} className="h-12 w-12 object-contain" />
          ) : (
            <Activity className="h-11 w-11 text-muted-foreground" />
          );
        })()}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{device.name}</h1>
          <div className="mt-1 flex gap-2">
            <Badge variant={statusVariant(device.status)}>{device.status}</Badge>
            <Badge variant="secondary">{device.model}</Badge>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Sensor readings</CardTitle>
              <span className="text-sm text-muted-foreground">{readings.length} readings</span>
            </CardHeader>
            <CardContent>
              <TimeSeriesChart
                points={readingsToSeries(readings, 'temperature')}
                unit="°"
                band={(() => {
                  const t = [...readings].find(r => r.tempMin != null || r.tempMax != null);
                  return t ? { min: t.tempMin ?? null, max: t.tempMax ?? null } : null;
                })()}
                lineClassName="stroke-primary"
                pointClassName="fill-primary"
              />
            </CardContent>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Temp</TableHead>
                    <TableHead>Battery</TableHead>
                    <TableHead>Light</TableHead>
                    <TableHead>Impact</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Alert</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {readings.slice(0, 20).map(r => (
                    <TableRow key={r.id}>
                      <TableCell className="text-sm">{new Date(r.eventTime).toLocaleString()}</TableCell>
                      <TableCell>{r.temperature != null ? `${r.temperature}°` : '-'}</TableCell>
                      <TableCell>{r.batteryLevel != null ? `${r.batteryLevel}%` : '-'}</TableCell>
                      <TableCell>{r.lightLevel != null ? r.lightLevel : '-'}</TableCell>
                      <TableCell>{r.impactG != null ? r.impactG : '-'}</TableCell>
                      <TableCell className="text-xs">
                        {r.lat != null && r.lng != null ? `${r.lat.toFixed(4)}, ${r.lng.toFixed(4)}` : '-'}
                      </TableCell>
                      <TableCell>
                        {r.isAlert ? (
                          <Badge variant="destructive">Alert</Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {readings.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="py-6 text-center text-sm text-muted-foreground">
                        No sensor readings yet
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Events</CardTitle>
              <span className="text-sm text-muted-foreground">{events.length} events</span>
            </CardHeader>
            <CardContent>
              {events.length === 0 ? (
                <p className="text-sm text-muted-foreground">No events recorded yet.</p>
              ) : (
                <ul className="space-y-3">
                  {events.map(ev => (
                    <li key={ev.id} className="rounded-md border p-3">
                      <div className="text-xs text-muted-foreground">{new Date(ev.startTime).toLocaleString()}</div>
                      <div className="mt-1 flex items-center gap-2 font-medium">
                        {ev.eventType}
                        <Badge variant={categoryVariant(ev.category)}>{ev.category}</Badge>
                      </div>
                      {ev.message && <div className="mt-1 text-sm text-muted-foreground">{ev.message}</div>}
                      {ev.zoneName && (
                        <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                          <MapPin className="h-3 w-3" />
                          {ev.zoneName}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardContent className="flex items-center justify-center py-6">
              {(() => {
                const imgUrl = getDeviceImageUrl(device.model);
                return imgUrl ? (
                  <img src={imgUrl} alt={device.model} className="h-20 w-20 object-contain" />
                ) : (
                  <Activity className="h-16 w-16 text-muted-foreground opacity-50" />
                );
              })()}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Device info</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between"><dt className="text-muted-foreground">Name</dt><dd>{device.name}</dd></div>
                <div className="flex justify-between"><dt className="text-muted-foreground">External ID</dt><dd className="text-right">{device.externalId}</dd></div>
                <div className="flex justify-between"><dt className="text-muted-foreground">Display ID</dt><dd>{device.displayId}</dd></div>
                <div className="flex justify-between"><dt className="text-muted-foreground">Model</dt><dd>{device.model}</dd></div>
                <div className="flex justify-between"><dt className="text-muted-foreground">Firmware</dt><dd>{device.firmware || '-'}</dd></div>
                <div className="flex justify-between"><dt className="text-muted-foreground">Provider</dt><dd>{device.provider}</dd></div>
                <div className="flex justify-between"><dt className="text-muted-foreground">Status</dt><dd><Badge variant={statusVariant(device.status)}>{device.status}</Badge></dd></div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Battery</dt>
                  <dd className={cn(batteryColorClass(device.batteryLevel))}>
                    {device.batteryLevel != null ? `${device.batteryLevel}%` : '-'}
                  </dd>
                </div>
                <div className="flex justify-between"><dt className="text-muted-foreground">Last seen</dt><dd>{relativeTime(device.lastSeenAt)}</dd></div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Last location</dt>
                  <dd className="text-xs">
                    {device.lastLat != null && device.lastLng != null
                      ? `${device.lastLat.toFixed(4)}, ${device.lastLng.toFixed(4)}`
                      : '-'}
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Assignment</CardTitle>
            </CardHeader>
            <CardContent>
              {activeAssignment ? (
                <dl className="space-y-2 text-sm">
                  {activeAssignment.shipmentId && (
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Shipment</dt>
                      <dd>
                        <Link to={`/shipments/${activeAssignment.shipmentId}`} className="font-medium text-primary hover:underline">
                          {activeAssignment.shipment?.reference || activeAssignment.shipmentId}
                        </Link>
                      </dd>
                    </div>
                  )}
                  {activeAssignment.orderId && (
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Order</dt>
                      <dd>
                        <Link to={`/orders/${activeAssignment.orderId}`} className="font-medium text-primary hover:underline">
                          {activeAssignment.order?.orderNumber || activeAssignment.orderId}
                        </Link>
                      </dd>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Assigned</dt>
                    <dd>{new Date(activeAssignment.assignedAt).toLocaleDateString()}</dd>
                  </div>
                </dl>
              ) : (
                <div className="space-y-3 text-center">
                  <p className="text-sm text-muted-foreground">Unassigned</p>
                  <Button variant="outline" size="sm">
                    <LinkIcon className="h-4 w-4" />
                    Assign device
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Assignment history</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {assignments.length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground">No assignment history.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ref</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Assigned</TableHead>
                      <TableHead>Removed</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {assignments.map(a => (
                      <TableRow key={a.id}>
                        <TableCell className="text-sm">{a.shipment?.reference || a.order?.orderNumber || '-'}</TableCell>
                        <TableCell>
                          <Badge variant={a.active ? 'success' : 'secondary'}>
                            {a.active ? 'Active' : 'Ended'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs">{new Date(a.assignedAt).toLocaleDateString()}</TableCell>
                        <TableCell className="text-xs">{a.unassignedAt ? new Date(a.unassignedAt).toLocaleDateString() : '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
