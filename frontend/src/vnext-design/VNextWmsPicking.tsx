import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, ShoppingCart } from 'lucide-react';

import { API_URL } from '../api';
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

interface PickTask {
  id: string;
  status: string;
  pickType: string;
  waveNumber: string | null;
  orderRef: string | null;
  zoneName: string | null;
  assignedTo: string | null;
  totalLines: number;
  completedLines: number;
  createdAt: string;
}

type BadgeVariant = 'success' | 'info' | 'warning' | 'destructive' | 'muted' | 'secondary' | 'default';

function statusVariant(status: string): BadgeVariant {
  switch (status) {
    case 'pending': return 'secondary';
    case 'assigned': return 'info';
    case 'in_progress': return 'warning';
    case 'completed': return 'success';
    case 'short_pick': return 'destructive';
    case 'cancelled': return 'destructive';
    default: return 'secondary';
  }
}

function formatStatus(s: string): string {
  return s.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

export default function VNextWmsPicking() {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<PickTask[]>([]);
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
      ? `${API_URL}/api/v1/pick-tasks?locationId=${selectedLocation}&status=${statusFilter}`
      : `${API_URL}/api/v1/pick-tasks?locationId=${selectedLocation}`;
    fetch(url)
      .then(r => r.json())
      .then(res => setTasks((res.data || []).map((t: any) => ({
        ...t,
        waveNumber: t.wave?.waveNumber ?? null,
        orderRef: t.orderId?.slice(0, 8) ?? null,
        zoneName: null,
        assignedTo: t.assignedToUserId ?? null,
      }))))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [selectedLocation, statusFilter]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Picking</h1>
        <p className="mt-1 text-sm text-muted-foreground">Pick tasks for fulfilling orders</p>
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
            <SelectItem value="assigned">Assigned</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="short_pick">Short Pick</SelectItem>
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
            <ShoppingCart className="h-12 w-12 text-muted-foreground" />
            <h3 className="text-base font-medium">No pick tasks</h3>
            <p className="text-sm text-muted-foreground">
              Pick tasks are generated when waves are released. Create a wave and release it to generate pick lists.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Task</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Wave</TableHead>
                <TableHead>Order</TableHead>
                <TableHead>Zone</TableHead>
                <TableHead>Progress</TableHead>
                <TableHead>Assigned To</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tasks.map(task => (
                <TableRow key={task.id} onClick={() => navigate(`/wms/picking/${task.id}`)} className="cursor-pointer">
                  <TableCell className="font-mono text-sm font-semibold">{task.id.slice(0, 8)}</TableCell>
                  <TableCell>
                    <Badge variant="default">{formatStatus(task.pickType)}</Badge>
                  </TableCell>
                  <TableCell>{task.waveNumber || '-'}</TableCell>
                  <TableCell>{task.orderRef || '-'}</TableCell>
                  <TableCell>{task.zoneName || 'All'}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-32 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-success"
                          style={{ width: `${task.totalLines > 0 ? (task.completedLines / task.totalLines) * 100 : 0}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground">{task.completedLines}/{task.totalLines}</span>
                    </div>
                  </TableCell>
                  <TableCell>{task.assignedTo || 'Unassigned'}</TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(task.status)}>{formatStatus(task.status)}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
