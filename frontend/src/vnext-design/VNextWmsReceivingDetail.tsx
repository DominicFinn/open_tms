import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  Clock,
  List,
  Loader2,
  ScanLine,
} from 'lucide-react';

import { API_URL } from '../api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { cn } from '@/lib/utils';

interface ReceivingLine {
  id: string;
  sku: string;
  uomCode: string;
  expectedQuantity: number | null;
  receivedQuantity: number;
  damagedQuantity: number;
  inspectionStatus: string;
  lotNumber: string | null;
  expiryDate: string | null;
  trackableUnitId: string | null;
}

interface ReceivingTaskDetail {
  id: string;
  locationId: string;
  status: string;
  receivingType: string;
  crossDock: boolean;
  inboundShipmentId: string | null;
  dockBinId: string | null;
  assignedToUserId: string | null;
  appointmentId: string | null;
  lines: ReceivingLine[];
  createdAt: string;
}

type BadgeVariant = 'success' | 'info' | 'warning' | 'destructive' | 'muted' | 'secondary' | 'default';

function statusVariant(s: string): BadgeVariant {
  switch (s) {
    case 'pending': return 'secondary';
    case 'in_progress': return 'info';
    case 'inspection': return 'warning';
    case 'completed': return 'success';
    case 'cancelled': return 'destructive';
    default: return 'secondary';
  }
}

function inspectionVariant(s: string): BadgeVariant {
  switch (s) {
    case 'pass': return 'success';
    case 'fail': return 'destructive';
    case 'quarantine': return 'warning';
    default: return 'secondary';
  }
}

function formatStatus(s: string): string {
  return s.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

export default function VNextWmsReceivingDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [task, setTask] = useState<ReceivingTaskDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [completing, setCompleting] = useState(false);

  const [showRecordForm, setShowRecordForm] = useState(false);
  const [recordForm, setRecordForm] = useState({ sku: '', receivedQuantity: '1', damagedQuantity: '0', lotNumber: '', lineId: '' });
  const [recording, setRecording] = useState(false);

  const loadTask = () => {
    if (!id) return;
    fetch(`${API_URL}/api/v1/receiving/tasks/${id}`)
      .then(r => r.json())
      .then(res => {
        if (res.error) setError(res.error);
        else setTask(res.data);
      })
      .catch(() => setError('Failed to load task'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadTask(); }, [id]);

  const handleRecordLine = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError('');
    setRecording(true);

    const payload: Record<string, unknown> = {
      receivedQuantity: parseInt(recordForm.receivedQuantity) || 0,
      damagedQuantity: parseInt(recordForm.damagedQuantity) || 0,
      lotNumber: recordForm.lotNumber || null,
    };

    if (recordForm.lineId) {
      payload.lineId = recordForm.lineId;
    } else {
      payload.sku = recordForm.sku;
    }

    try {
      const res = await fetch(`${API_URL}/api/v1/receiving/tasks/${id}/lines`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.error) {
        setActionError(data.error);
      } else {
        setRecordForm({ sku: '', receivedQuantity: '1', damagedQuantity: '0', lotNumber: '', lineId: '' });
        setShowRecordForm(false);
        loadTask();
      }
    } catch {
      setActionError('Failed to record line');
    } finally {
      setRecording(false);
    }
  };

  const handleComplete = async () => {
    setActionError('');
    setCompleting(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/receiving/tasks/${id}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (data.error) {
        setActionError(data.error);
      } else {
        loadTask();
      }
    } catch {
      setActionError('Failed to complete task');
    } finally {
      setCompleting(false);
    }
  };

  const handleInspect = async (lineId: string, status: string) => {
    try {
      await fetch(`${API_URL}/api/v1/receiving/lines/${lineId}/inspect`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inspectionStatus: status }),
      });
      loadTask();
    } catch {
      setActionError('Failed to update inspection');
    }
  };

  const recordAgainstLine = (line: ReceivingLine) => {
    setRecordForm({
      sku: line.sku,
      receivedQuantity: String(line.expectedQuantity ?? 0),
      damagedQuantity: '0',
      lotNumber: line.lotNumber || '',
      lineId: line.id,
    });
    setShowRecordForm(true);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-3 py-24 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }
  if (error || !task) {
    return (
      <div className="flex items-center gap-3 rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
        <CircleAlert className="h-5 w-5" />
        {error || 'Task not found'}
      </div>
    );
  }

  const totalExpected = task.lines.reduce((s, l) => s + (l.expectedQuantity ?? 0), 0);
  const totalReceived = task.lines.reduce((s, l) => s + l.receivedQuantity, 0);
  const totalDamaged = task.lines.reduce((s, l) => s + l.damagedQuantity, 0);
  const isActive = task.status === 'pending' || task.status === 'in_progress';

  const stats = [
    { label: 'Lines', value: task.lines.length, icon: List, tone: 'bg-info/15 text-info' },
    ...(totalExpected > 0 ? [{ label: 'Expected', value: totalExpected, icon: Clock, tone: 'bg-muted text-muted-foreground' }] : []),
    { label: 'Received', value: totalReceived, icon: CheckCircle2, tone: 'bg-success/15 text-success' },
    { label: 'Damaged', value: totalDamaged, icon: AlertTriangle, tone: totalDamaged > 0 ? 'bg-destructive/10 text-destructive' : 'bg-muted text-muted-foreground' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link to="/wms/receiving" className="hover:text-foreground">
          <ArrowLeft className="inline h-4 w-4" /> Receiving
        </Link>
        <ChevronRight className="h-3 w-3" />
        <span>{task.id.slice(0, 8)}</span>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Receiving Task</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm font-semibold">{task.id.slice(0, 8)}</span>
            <Badge variant={statusVariant(task.status)}>{formatStatus(task.status)}</Badge>
            <Badge variant="secondary">{task.receivingType === 'asn' ? 'ASN' : 'Blind'}</Badge>
            {task.crossDock && <Badge variant="warning">Cross-Dock</Badge>}
          </div>
        </div>
        <div className="flex gap-2">
          {isActive && (
            <>
              <Button
                variant="outline"
                onClick={() => { setShowRecordForm(true); setRecordForm({ sku: '', receivedQuantity: '1', damagedQuantity: '0', lotNumber: '', lineId: '' }); }}
              >
                <ScanLine className="h-4 w-4" />
                Record Item
              </Button>
              <Button variant="gradient" onClick={handleComplete} disabled={completing}>
                {completing ? 'Completing...' : 'Complete Receiving'}
              </Button>
            </>
          )}
        </div>
      </div>

      {actionError && (
        <div className="flex items-center gap-3 rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          <CircleAlert className="h-5 w-5" />
          {actionError}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map(s => {
          const Icon = s.icon;
          return (
            <Card key={s.label}>
              <CardContent className="p-5">
                <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg', s.tone)}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="mt-3 text-2xl font-bold tracking-tight">{s.value}</div>
                <div className="mt-1 text-sm text-muted-foreground">{s.label}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {showRecordForm && (
        <Card className="border-l-4 border-l-primary">
          <CardHeader>
            <CardTitle>{recordForm.lineId ? `Record against ${recordForm.sku}` : 'Record New Item'}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleRecordLine} className="flex flex-wrap items-end gap-3">
              {!recordForm.lineId && (
                <div className="min-w-[150px] flex-1 space-y-2">
                  <Label>SKU *</Label>
                  <Input value={recordForm.sku} onChange={e => setRecordForm({ ...recordForm, sku: e.target.value })} required />
                </div>
              )}
              <div className="w-28 space-y-2">
                <Label>Received Qty *</Label>
                <Input type="number" min="0" value={recordForm.receivedQuantity} onChange={e => setRecordForm({ ...recordForm, receivedQuantity: e.target.value })} required />
              </div>
              <div className="w-28 space-y-2">
                <Label>Damaged</Label>
                <Input type="number" min="0" value={recordForm.damagedQuantity} onChange={e => setRecordForm({ ...recordForm, damagedQuantity: e.target.value })} />
              </div>
              <div className="w-32 space-y-2">
                <Label>Lot #</Label>
                <Input value={recordForm.lotNumber} onChange={e => setRecordForm({ ...recordForm, lotNumber: e.target.value })} />
              </div>
              <div className="flex gap-2">
                <Button variant="gradient" type="submit" disabled={recording}>{recording ? 'Saving...' : 'Save'}</Button>
                <Button variant="outline" type="button" onClick={() => setShowRecordForm(false)}>Cancel</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Receiving Lines</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {task.lines.length === 0 ? (
            <div className="px-6 py-8 text-center text-sm text-muted-foreground">
              No items recorded yet. Click "Record Item" to start receiving.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SKU</TableHead>
                  <TableHead>UOM</TableHead>
                  <TableHead>Expected</TableHead>
                  <TableHead>Received</TableHead>
                  <TableHead>Damaged</TableHead>
                  <TableHead>Lot</TableHead>
                  <TableHead>Inspection</TableHead>
                  {isActive && <TableHead>Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {task.lines.map(line => {
                  const variance = line.expectedQuantity != null ? line.receivedQuantity - line.expectedQuantity : null;
                  return (
                    <TableRow key={line.id}>
                      <TableCell className="font-mono text-sm font-semibold">{line.sku}</TableCell>
                      <TableCell>{line.uomCode}</TableCell>
                      <TableCell>{line.expectedQuantity ?? '-'}</TableCell>
                      <TableCell className={cn('font-semibold', line.receivedQuantity > 0 && 'text-success')}>
                        {line.receivedQuantity}
                        {variance !== null && variance !== 0 && (
                          <span className={cn('ml-1 text-xs', variance > 0 ? 'text-warning' : 'text-destructive')}>
                            ({variance > 0 ? '+' : ''}{variance})
                          </span>
                        )}
                      </TableCell>
                      <TableCell>{line.damagedQuantity > 0 ? <span className="font-semibold text-destructive">{line.damagedQuantity}</span> : 0}</TableCell>
                      <TableCell>{line.lotNumber || '-'}</TableCell>
                      <TableCell>
                        {isActive ? (
                          <Select value={line.inspectionStatus} onValueChange={v => handleInspect(line.id, v)}>
                            <SelectTrigger className="w-[140px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pending">Pending</SelectItem>
                              <SelectItem value="pass">Pass</SelectItem>
                              <SelectItem value="fail">Fail</SelectItem>
                              <SelectItem value="quarantine">Quarantine</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <Badge variant={inspectionVariant(line.inspectionStatus)}>{formatStatus(line.inspectionStatus)}</Badge>
                        )}
                      </TableCell>
                      {isActive && (
                        <TableCell>
                          {line.receivedQuantity === 0 && line.expectedQuantity != null && (
                            <Button variant="outline" size="sm" onClick={() => recordAgainstLine(line)}>
                              Receive
                            </Button>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
