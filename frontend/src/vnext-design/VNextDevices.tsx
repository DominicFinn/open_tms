import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  CheckCircle2,
  AlertTriangle,
  Link as LinkIcon,
  Plus,
  Search,
  Loader2,
  Battery,
  BatteryFull,
  BatteryMedium,
  BatteryLow,
  BatteryWarning,
} from 'lucide-react';

import { API_URL } from '../api';
import { getDeviceImageUrl } from './deviceImages';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

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
  assignments: Array<{
    shipmentId: string | null;
    shipment?: { reference: string };
    orderId: string | null;
    order?: { orderNumber: string };
  }>;
  _count: { sensorReadings: number; deviceEvents: number };
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

function batteryProps(level: number | null) {
  if (level == null) return { Icon: BatteryWarning, color: 'text-muted-foreground' };
  if (level > 75) return { Icon: BatteryFull, color: 'text-success' };
  if (level > 50) return { Icon: BatteryMedium, color: 'text-success' };
  if (level >= 20) return { Icon: Battery, color: 'text-warning' };
  return { Icon: BatteryLow, color: 'text-destructive' };
}

function assignedLabel(device: Device): string {
  const active = device.assignments?.[0];
  if (!active) return 'Unassigned';
  if (active.shipment?.reference) return active.shipment.reference;
  if (active.order?.orderNumber) return active.order.orderNumber;
  return 'Assigned';
}

function statusVariant(status: string): 'success' | 'warning' | 'secondary' {
  if (status === 'active') return 'success';
  if (status === 'inactive') return 'warning';
  return 'secondary';
}

export default function VNextDevices() {
  const navigate = useNavigate();
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const res = await fetch(`${API_URL}/api/v1/devices`);
        if (!res.ok) throw new Error(`Failed to load devices (${res.status})`);
        const json = await res.json();
        if (!cancelled) {
          setDevices(json.data || []);
          setError('');
        }
      } catch (err: any) {
        if (!cancelled) setError(err.message || 'Failed to load devices');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const filtered = devices.filter(d => {
    if (statusFilter !== 'all' && d.status !== statusFilter) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      d.name.toLowerCase().includes(q) ||
      d.displayId.toLowerCase().includes(q) ||
      d.model.toLowerCase().includes(q) ||
      d.provider.toLowerCase().includes(q)
    );
  });

  const totalCount = devices.length;
  const activeCount = devices.filter(d => d.status === 'active').length;
  const alertCount = devices.filter(d => d.batteryLevel != null && d.batteryLevel < 20).length;
  const assignedCount = devices.filter(d => d.assignments && d.assignments.length > 0).length;

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
        {error}
      </div>
    );
  }

  const stats = [
    { label: 'Total devices', value: totalCount, icon: Activity, tone: 'bg-primary/10 text-primary' },
    { label: 'Active', value: activeCount, icon: CheckCircle2, tone: 'bg-success/15 text-success' },
    { label: 'Low battery', value: alertCount, icon: AlertTriangle, tone: 'bg-destructive/15 text-destructive' },
    { label: 'Assigned', value: assignedCount, icon: LinkIcon, tone: 'bg-info/15 text-info' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Devices</h1>
          <p className="mt-1 text-sm text-muted-foreground">{totalCount} devices registered</p>
        </div>
        <Button variant="gradient">
          <Plus className="h-4 w-4" />
          Register device
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map(s => {
          const Icon = s.icon;
          return (
            <Card key={s.label}>
              <CardContent className="flex items-center gap-3 p-4">
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${s.tone}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-2xl font-semibold">{s.value}</div>
                  <div className="text-xs text-muted-foreground">{s.label}</div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="flex flex-wrap items-center gap-2 border-b p-4">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Search devices by name, ID, or model..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="retired">Retired</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Model</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Battery</TableHead>
                <TableHead>Last seen</TableHead>
                <TableHead>Assigned to</TableHead>
                <TableHead>Readings</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(device => {
                const { Icon: BIcon, color } = batteryProps(device.batteryLevel);
                return (
                  <TableRow
                    key={device.id}
                    className="cursor-pointer"
                    onClick={() => navigate(`/devices/${device.id}`)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        {(() => {
                          const imgUrl = getDeviceImageUrl(device.model);
                          return imgUrl ? (
                            <img src={imgUrl} alt={device.model} className="h-9 w-9 shrink-0 object-contain" />
                          ) : (
                            <Activity className="h-7 w-7 shrink-0 text-muted-foreground" />
                          );
                        })()}
                        <div>
                          <div className="font-semibold">{device.name}</div>
                          <div className="text-xs text-muted-foreground">{device.displayId || device.externalId}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{device.model || '-'}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(device.status)}>{device.status}</Badge>
                    </TableCell>
                    <TableCell>
                      {device.batteryLevel != null ? (
                        <span className={cn('inline-flex items-center gap-1', color)}>
                          <BIcon className="h-4 w-4" />
                          {device.batteryLevel}%
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{relativeTime(device.lastSeenAt)}</TableCell>
                    <TableCell className="text-sm">{assignedLabel(device)}</TableCell>
                    <TableCell className="text-sm">{device._count?.sensorReadings ?? 0}</TableCell>
                  </TableRow>
                );
              })}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7}>
                    <div className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
                      <Activity className="h-8 w-8" />
                      <h3 className="text-base font-medium">No devices found</h3>
                      <p className="text-sm">Register a device to get started with IoT tracking.</p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
