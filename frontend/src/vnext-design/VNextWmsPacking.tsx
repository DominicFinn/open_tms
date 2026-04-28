import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Package } from 'lucide-react';

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

interface PackTask {
  id: string;
  status: string;
  orderRef: string;
  packStation: string | null;
  assignedTo: string | null;
  lineCount: number;
  packedLines: number;
  createdAt: string;
}

type BadgeVariant = 'success' | 'info' | 'warning' | 'destructive' | 'muted' | 'secondary' | 'default';

function statusVariant(status: string): BadgeVariant {
  switch (status) {
    case 'pending': return 'secondary';
    case 'in_progress': return 'warning';
    case 'completed': return 'success';
    case 'cancelled': return 'destructive';
    default: return 'secondary';
  }
}

function formatStatus(s: string): string {
  return s.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

export default function VNextWmsPacking() {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<PackTask[]>([]);
  const [loading, setLoading] = useState(true);

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
    fetch(`${API_URL}/api/v1/pack-tasks?locationId=${selectedLocation}`)
      .then(r => r.json())
      .then(res => setTasks((res.data || []).map((t: any) => ({
        ...t,
        orderRef: t.orderId?.slice(0, 8) ?? '',
        assignedTo: t.assignedToUserId ?? null,
      }))))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [selectedLocation]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Packing</h1>
        <p className="mt-1 text-sm text-muted-foreground">Pack station tasks for order verification and cartonization</p>
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
      </div>

      {loading ? (
        <div className="flex flex-col items-center gap-3 py-24 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : tasks.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <Package className="h-12 w-12 text-muted-foreground" />
            <h3 className="text-base font-medium">No pack tasks</h3>
            <p className="text-sm text-muted-foreground">
              Pack tasks are created when pick tasks are completed. Items arrive at the pack station for verification, cartonization, and label generation.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Task</TableHead>
                <TableHead>Order</TableHead>
                <TableHead>Pack Station</TableHead>
                <TableHead>Progress</TableHead>
                <TableHead>Assigned To</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tasks.map(task => (
                <TableRow key={task.id} onClick={() => navigate(`/wms/packing/${task.id}`)} className="cursor-pointer">
                  <TableCell className="font-mono text-sm font-semibold">{task.id.slice(0, 8)}</TableCell>
                  <TableCell className="font-semibold">{task.orderRef}</TableCell>
                  <TableCell>{task.packStation || 'Unassigned'}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-32 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-success"
                          style={{ width: `${task.lineCount > 0 ? (task.packedLines / task.lineCount) * 100 : 0}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground">{task.packedLines}/{task.lineCount}</span>
                    </div>
                  </TableCell>
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
