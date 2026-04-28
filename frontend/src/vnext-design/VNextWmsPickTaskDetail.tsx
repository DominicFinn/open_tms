import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Check, ChevronRight, CircleAlert, Loader2 } from 'lucide-react';

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

interface PickLineDetail {
  id: string;
  orderId: string;
  sku: string;
  uomCode: string;
  requestedQuantity: number;
  pickedQuantity: number;
  status: string;
  walkSequence: number;
  lotNumber: string | null;
  shortPickAction: string | null;
  bin: { label: string; zone: { name: string } };
}

interface PickTaskDetail {
  id: string;
  status: string;
  pickType: string;
  orderId: string | null;
  totalLines: number;
  completedLines: number;
  assignedToUserId: string | null;
  wave: { waveNumber: string; pickStrategy: string } | null;
  pickLines: PickLineDetail[];
  createdAt: string;
}

type BadgeVariant = 'success' | 'info' | 'warning' | 'destructive' | 'muted' | 'secondary' | 'default';

function statusVariant(s: string): BadgeVariant {
  switch (s) {
    case 'pending': return 'secondary';
    case 'assigned': return 'info';
    case 'in_progress': return 'warning';
    case 'picked': case 'completed': return 'success';
    case 'short': case 'short_pick': return 'destructive';
    case 'skipped': return 'secondary';
    default: return 'secondary';
  }
}

function formatStatus(s: string): string {
  return s.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

export default function VNextWmsPickTaskDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [task, setTask] = useState<PickTaskDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [pickingLineId, setPickingLineId] = useState<string | null>(null);
  const [pickForm, setPickForm] = useState({ pickedQuantity: '', shortPickAction: 'backorder' });
  const [picking, setPicking] = useState(false);

  const loadTask = () => {
    if (!id) return;
    fetch(`${API_URL}/api/v1/pick-tasks/${id}`)
      .then(r => r.json())
      .then(res => { if (res.error) setError(res.error); else setTask(res.data); })
      .catch(() => setError('Failed to load'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadTask(); }, [id]);

  const startPick = (line: PickLineDetail) => {
    setPickingLineId(line.id);
    setPickForm({ pickedQuantity: String(line.requestedQuantity), shortPickAction: 'backorder' });
    setError('');
  };

  const handlePick = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pickingLineId) return;
    setError('');
    setPicking(true);

    const qty = parseInt(pickForm.pickedQuantity) || 0;
    const line = task?.pickLines.find(l => l.id === pickingLineId);
    const payload: Record<string, unknown> = { pickedQuantity: qty };
    if (line && qty < line.requestedQuantity) {
      payload.shortPickAction = pickForm.shortPickAction;
    }

    try {
      const res = await fetch(`${API_URL}/api/v1/pick-lines/${pickingLineId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.error) setError(data.error);
      else { setPickingLineId(null); loadTask(); }
    } catch { setError('Failed to complete pick'); }
    finally { setPicking(false); }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-3 py-24 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }
  if (!task) {
    return (
      <div className="flex items-center gap-3 rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
        <CircleAlert className="h-5 w-5" />
        {error || 'Not found'}
      </div>
    );
  }

  const isActive = task.status !== 'completed' && task.status !== 'cancelled' && task.status !== 'short_pick';
  const nextLine = task.pickLines.find(l => l.status === 'pending');

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link to="/wms/picking" className="hover:text-foreground">
          <ArrowLeft className="inline h-4 w-4" /> Picking
        </Link>
        <ChevronRight className="h-3 w-3" />
        <span>{task.id.slice(0, 8)}</span>
      </div>

      <div>
        <h1 className="text-3xl font-bold tracking-tight">Pick Task</h1>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="font-mono text-sm font-semibold">{task.id.slice(0, 8)}</span>
          <Badge variant={statusVariant(task.status)}>{formatStatus(task.status)}</Badge>
          <Badge variant="default">{formatStatus(task.pickType)}</Badge>
          {task.wave && <span className="text-sm text-muted-foreground">Wave: {task.wave.waveNumber}</span>}
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-3 rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          <CircleAlert className="h-5 w-5" />
          {error}
        </div>
      )}

      <Card>
        <CardContent className="p-5">
          <div className="mb-2 flex justify-between text-sm">
            <span className="font-semibold">Progress</span>
            <span className="text-muted-foreground">{task.completedLines}/{task.totalLines} lines</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-success transition-all"
              style={{ width: `${task.totalLines > 0 ? (task.completedLines / task.totalLines) * 100 : 0}%` }}
            />
          </div>
        </CardContent>
      </Card>

      {isActive && nextLine && (
        <Card className="border-l-4 border-l-primary">
          <CardHeader>
            <CardTitle>Next Pick</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center gap-8">
              <div>
                <div className="text-xs text-muted-foreground">Bin</div>
                <div className="text-2xl font-bold text-primary">{nextLine.bin.label}</div>
                <div className="text-xs text-muted-foreground">{nextLine.bin.zone.name}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">SKU</div>
                <div className="text-lg font-semibold">{nextLine.sku}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Qty</div>
                <div className="text-lg font-semibold">{nextLine.requestedQuantity} {nextLine.uomCode}</div>
              </div>
              {nextLine.lotNumber && (
                <div>
                  <div className="text-xs text-muted-foreground">Lot</div>
                  <div>{nextLine.lotNumber}</div>
                </div>
              )}
              <Button variant="gradient" onClick={() => startPick(nextLine)}>
                <Check className="h-4 w-4" />
                Confirm Pick
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {pickingLineId && (
        <Card className="border-l-4 border-l-success">
          <CardHeader>
            <CardTitle>Record Pick</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePick} className="flex flex-wrap items-end gap-3">
              <div className="w-32 space-y-2">
                <Label>Picked Qty</Label>
                <Input
                  type="number"
                  min="0"
                  value={pickForm.pickedQuantity}
                  onChange={e => setPickForm({ ...pickForm, pickedQuantity: e.target.value })}
                  autoFocus
                  required
                />
              </div>
              {parseInt(pickForm.pickedQuantity) < (task.pickLines.find(l => l.id === pickingLineId)?.requestedQuantity ?? 0) && (
                <div className="w-44 space-y-2">
                  <Label>Short Pick Action</Label>
                  <Select value={pickForm.shortPickAction} onValueChange={v => setPickForm({ ...pickForm, shortPickAction: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="backorder">Backorder</SelectItem>
                      <SelectItem value="cancel_line">Cancel Line</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              <Button variant="gradient" type="submit" disabled={picking}>{picking ? 'Saving...' : 'Confirm'}</Button>
              <Button variant="outline" type="button" onClick={() => setPickingLineId(null)}>Cancel</Button>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Pick Lines (walk order)</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Seq</TableHead>
                <TableHead>Bin</TableHead>
                <TableHead>Zone</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>Requested</TableHead>
                <TableHead>Picked</TableHead>
                <TableHead>Lot</TableHead>
                <TableHead>Status</TableHead>
                {isActive && <TableHead></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {task.pickLines.map(line => (
                <TableRow key={line.id} className={cn(line.id === pickingLineId && 'bg-muted')}>
                  <TableCell>{line.walkSequence}</TableCell>
                  <TableCell className="font-mono text-sm font-semibold">{line.bin.label}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{line.bin.zone.name}</TableCell>
                  <TableCell>{line.sku}</TableCell>
                  <TableCell>{line.requestedQuantity}</TableCell>
                  <TableCell
                    className={cn(
                      'font-semibold',
                      line.pickedQuantity > 0 && (line.pickedQuantity < line.requestedQuantity ? 'text-warning' : 'text-success')
                    )}
                  >
                    {line.pickedQuantity}
                  </TableCell>
                  <TableCell>{line.lotNumber || '-'}</TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(line.status)}>{formatStatus(line.status)}</Badge>
                  </TableCell>
                  {isActive && (
                    <TableCell>
                      {line.status === 'pending' && (
                        <Button variant="outline" size="sm" onClick={() => startPick(line)}>
                          Pick
                        </Button>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
