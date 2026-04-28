import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, PackagePlus } from 'lucide-react';

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

interface PutawayTask {
  id: string;
  status: string;
  putawayType: string;
  trackableUnitIdentifier: string;
  sourceBinLabel: string | null;
  targetBinLabel: string;
  assignedTo: string | null;
  createdAt: string;
}

type BadgeVariant = 'success' | 'info' | 'warning' | 'destructive' | 'muted' | 'secondary' | 'default';

function statusVariant(status: string): BadgeVariant {
  switch (status) {
    case 'pending': return 'secondary';
    case 'assigned': return 'info';
    case 'in_progress': return 'warning';
    case 'completed': return 'success';
    case 'cancelled': return 'destructive';
    default: return 'secondary';
  }
}

function formatStatus(s: string): string {
  return s.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

export default function VNextWmsPutaway() {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<PutawayTask[]>([]);
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
      ? `${API_URL}/api/v1/putaway/tasks?locationId=${selectedLocation}&status=${statusFilter}`
      : `${API_URL}/api/v1/putaway/tasks?locationId=${selectedLocation}`;
    fetch(url)
      .then(r => r.json())
      .then(res => setTasks((res.data || []).map((t: any) => ({
        ...t,
        trackableUnitIdentifier: t.trackableUnit?.identifier ?? t.trackableUnitId?.slice(0, 8),
        sourceBinLabel: t.sourceBin?.label ?? null,
        targetBinLabel: t.targetBin?.label ?? t.targetBinId,
        assignedTo: t.assignedToUserId ?? null,
      }))))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [selectedLocation, statusFilter]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Putaway</h1>
        <p className="mt-1 text-sm text-muted-foreground">Directed putaway tasks for received goods</p>
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
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="assigned">Assigned</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
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
            <PackagePlus className="h-12 w-12 text-muted-foreground" />
            <h3 className="text-base font-medium">No putaway tasks</h3>
            <p className="text-sm text-muted-foreground">
              Putaway tasks are auto-generated when receiving is completed. Configure putaway rules to direct stock to the right zones.
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
                <TableHead>Unit</TableHead>
                <TableHead>From</TableHead>
                <TableHead>To</TableHead>
                <TableHead>Assigned To</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tasks.map(task => (
                <TableRow key={task.id} className="cursor-pointer" onClick={() => navigate(`/wms/putaway/${task.id}`)}>
                  <TableCell className="font-mono text-sm font-semibold">{task.id.slice(0, 8)}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{formatStatus(task.putawayType)}</Badge>
                  </TableCell>
                  <TableCell className="font-semibold">{task.trackableUnitIdentifier}</TableCell>
                  <TableCell>{task.sourceBinLabel || 'Dock'}</TableCell>
                  <TableCell>{task.targetBinLabel}</TableCell>
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
