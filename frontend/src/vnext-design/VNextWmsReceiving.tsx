import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, PackageOpen, Plus } from 'lucide-react';

import { API_URL } from '../api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface ReceivingTask {
  id: string;
  status: string;
  receivingType: string;
  crossDock: boolean;
  shipmentRef: string | null;
  dockDoor: string | null;
  assignedTo: string | null;
  lineCount: number;
  receivedLines: number;
  createdAt: string;
}

type BadgeVariant = 'success' | 'info' | 'warning' | 'destructive' | 'muted' | 'secondary' | 'default';

function statusVariant(status: string): BadgeVariant {
  switch (status) {
    case 'pending': return 'secondary';
    case 'in_progress': return 'info';
    case 'inspection': return 'warning';
    case 'completed': return 'success';
    case 'cancelled': return 'destructive';
    default: return 'secondary';
  }
}

function formatStatus(s: string): string {
  return s.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

export default function VNextWmsReceiving() {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<ReceivingTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');

  const [selectedLocation, setSelectedLocation] = useState('');
  const [locations, setLocations] = useState<Array<{ id: string; name: string }>>([]);

  useEffect(() => {
    fetch(`${API_URL}/api/v1/locations`)
      .then(r => r.json())
      .then(res => {
        const locs = (res.data || []).filter(
          (l: any) => !l.locationType || ['warehouse', 'distribution_centre', 'cross_dock'].includes(l.locationType)
        );
        setLocations(locs);
        if (locs.length > 0) setSelectedLocation(locs[0].id);
        else setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedLocation) return;
    setLoading(true);
    const url = statusFilter !== 'all'
      ? `${API_URL}/api/v1/receiving/tasks?locationId=${selectedLocation}&status=${statusFilter}`
      : `${API_URL}/api/v1/receiving/tasks?locationId=${selectedLocation}`;
    fetch(url)
      .then(r => r.json())
      .then(res => setTasks((res.data || []).map((t: any) => ({
        ...t,
        shipmentRef: t.inboundShipmentId || null,
        dockDoor: t.dockBinId ? t.dockBinId.slice(0, 8) : null,
        assignedTo: t.assignedToUserId || null,
      }))))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [selectedLocation, statusFilter]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Receiving</h1>
          <p className="mt-1 text-sm text-muted-foreground">Inbound goods receiving and inspection</p>
        </div>
        <Button variant="gradient" onClick={() => navigate('/wms/receiving/create')}>
          <Plus className="h-4 w-4" />
          New Receiving Task
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Select value={selectedLocation} onValueChange={setSelectedLocation}>
          <SelectTrigger className="w-[260px]">
            <SelectValue placeholder="Select location" />
          </SelectTrigger>
          <SelectContent>
            {locations.map(l => (
              <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="inspection">Inspection</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex flex-col items-center gap-3 py-24 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : tasks.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <PackageOpen className="h-12 w-12 text-muted-foreground" />
            <h3 className="text-base font-medium">No receiving tasks</h3>
            <p className="text-sm text-muted-foreground">
              Receiving tasks are created when inbound shipments arrive, or manually for blind receiving.
            </p>
            <Button variant="gradient" onClick={() => navigate('/wms/receiving/create')}>
              Create Receiving Task
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Task</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Shipment</TableHead>
                <TableHead>Dock</TableHead>
                <TableHead>Progress</TableHead>
                <TableHead>Assigned To</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tasks.map(task => (
                <TableRow
                  key={task.id}
                  onClick={() => navigate(`/wms/receiving/${task.id}`)}
                  className="cursor-pointer"
                >
                  <TableCell className="font-mono text-sm font-semibold">{task.id.slice(0, 8)}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      <Badge variant="secondary">{task.receivingType === 'asn' ? 'ASN' : 'Blind'}</Badge>
                      {task.crossDock && <Badge variant="warning">Cross-Dock</Badge>}
                    </div>
                  </TableCell>
                  <TableCell>{task.shipmentRef || '-'}</TableCell>
                  <TableCell>{task.dockDoor || '-'}</TableCell>
                  <TableCell>{task.receivedLines}/{task.lineCount} lines</TableCell>
                  <TableCell>{task.assignedTo || 'Unassigned'}</TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(task.status)}>{formatStatus(task.status)}</Badge>
                  </TableCell>
                  <TableCell>{new Date(task.createdAt).toLocaleDateString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
