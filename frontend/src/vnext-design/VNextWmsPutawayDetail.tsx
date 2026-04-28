import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  FlaskConical,
  Loader2,
  Snowflake,
  Thermometer,
} from 'lucide-react';

import { API_URL } from '../api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface PutawayTaskDetail {
  id: string;
  locationId: string;
  status: string;
  putawayType: string;
  assignedToUserId: string | null;
  trackableUnit: {
    id: string;
    identifier: string;
    unitType: string;
    barcode: string | null;
    lotNumber: string | null;
    expiryDate: string | null;
    qualityStatus: string;
    lineItems: Array<{
      sku: string;
      description: string | null;
      quantity: number;
      weight: number | null;
      temperature: string | null;
      hazmat: boolean;
    }>;
  };
  sourceBin: { id: string; label: string; binType: string } | null;
  targetBin: {
    id: string;
    label: string;
    binType: string;
    temperatureZone: string | null;
    hazmatCertified: boolean;
    zone: { name: string; zoneType: string; temperatureZone: string | null; hazmatCertified: boolean };
  };
  receivingTask: { id: string; receivingType: string } | null;
  createdAt: string;
}

type BadgeVariant = 'success' | 'info' | 'warning' | 'destructive' | 'muted' | 'secondary' | 'default';

function statusVariant(s: string): BadgeVariant {
  switch (s) {
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

export default function VNextWmsPutawayDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [task, setTask] = useState<PutawayTaskDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [scannedBinLabel, setScannedBinLabel] = useState('');
  const [completing, setCompleting] = useState(false);
  const [completionResult, setCompletionResult] = useState<any>(null);

  const loadTask = () => {
    if (!id) return;
    fetch(`${API_URL}/api/v1/putaway/tasks/${id}`)
      .then(r => r.json())
      .then(res => {
        if (res.error) setError(res.error);
        else setTask(res.data);
      })
      .catch(() => setError('Failed to load task'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadTask(); }, [id]);

  const handleComplete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scannedBinLabel.trim()) return;
    setError('');
    setCompleting(true);
    setCompletionResult(null);

    try {
      const res = await fetch(`${API_URL}/api/v1/putaway/tasks/${id}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scannedBinLabel: scannedBinLabel.trim() }),
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setCompletionResult(data.data);
        loadTask();
      }
    } catch {
      setError('Failed to complete putaway');
    } finally {
      setCompleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-3 py-24 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }
  if (error && !task) {
    return (
      <div className="flex items-center gap-3 rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
        <CircleAlert className="h-5 w-5" />
        {error}
      </div>
    );
  }
  if (!task) return null;

  const isActive = task.status !== 'completed' && task.status !== 'cancelled';
  const unit = task.trackableUnit;
  const hasTemp = unit.lineItems.some(li => li.temperature && li.temperature !== 'ambient');
  const hasHazmat = unit.lineItems.some(li => li.hazmat);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link to="/wms/putaway" className="hover:text-foreground">
          <ArrowLeft className="inline h-4 w-4" /> Putaway
        </Link>
        <ChevronRight className="h-3 w-3" />
        <span>{task.id.slice(0, 8)}</span>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Putaway Task</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm font-semibold">{task.id.slice(0, 8)}</span>
            <Badge variant={statusVariant(task.status)}>{formatStatus(task.status)}</Badge>
            <Badge variant="secondary">{formatStatus(task.putawayType)}</Badge>
          </div>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-3 rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          <CircleAlert className="h-5 w-5" />
          {error}
        </div>
      )}

      {completionResult && (
        <div className="space-y-2">
          {completionResult.deviation && (
            <div className="flex items-start gap-3 rounded-md border border-warning/30 bg-warning/10 p-4 text-sm text-warning">
              <AlertTriangle className="h-5 w-5" />
              <div>
                <strong>Deviation recorded:</strong> {completionResult.deviationReason}
              </div>
            </div>
          )}
          {completionResult.constraintWarnings?.length > 0 && (
            <div className="flex items-start gap-3 rounded-md border border-warning/30 bg-warning/10 p-4 text-sm text-warning">
              <AlertTriangle className="h-5 w-5" />
              <div>
                <strong>Constraint warnings:</strong>
                <ul className="ml-5 mt-1 list-disc">
                  {completionResult.constraintWarnings.map((w: string, i: number) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}
          {!completionResult.deviation && completionResult.constraintWarnings?.length === 0 && (
            <div className="flex items-center gap-3 rounded-md border border-success/30 bg-success/10 p-4 text-sm text-success">
              <CheckCircle2 className="h-5 w-5" />
              Putaway completed successfully at <strong>{completionResult.actualBinLabel}</strong>
            </div>
          )}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Direction</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-6">
                <div className="text-center">
                  <div className="text-xs text-muted-foreground">From</div>
                  <div className="mt-1 text-lg font-semibold">{task.sourceBin?.label || 'Dock'}</div>
                </div>
                <ArrowRight className="h-8 w-8 text-primary" />
                <div className="text-center">
                  <div className="text-xs text-muted-foreground">To</div>
                  <div className="mt-1 text-lg font-semibold text-primary">{task.targetBin.label}</div>
                  <div className="text-xs text-muted-foreground">
                    {task.targetBin.zone.name} ({formatStatus(task.targetBin.zone.zoneType)})
                  </div>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {task.targetBin.temperatureZone && (
                  <Badge variant="info" className="gap-1">
                    <Thermometer className="h-3 w-3" />
                    {formatStatus(task.targetBin.temperatureZone)}
                  </Badge>
                )}
                {task.targetBin.hazmatCertified && (
                  <Badge variant="warning" className="gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    Hazmat Certified
                  </Badge>
                )}
                {hasTemp && (
                  <Badge variant="destructive" className="gap-1">
                    <Snowflake className="h-3 w-3" />
                    Temp Sensitive
                  </Badge>
                )}
                {hasHazmat && (
                  <Badge variant="destructive" className="gap-1">
                    <FlaskConical className="h-3 w-3" />
                    Hazmat
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>

          {isActive && (
            <Card className="border-l-4 border-l-primary">
              <CardHeader>
                <CardTitle>Scan to Confirm</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="mb-4 text-sm text-muted-foreground">
                  Scan the bin barcode where you placed the unit. If different from the directed bin, a deviation will be recorded.
                </p>
                <form onSubmit={handleComplete} className="flex items-end gap-3">
                  <div className="flex-1 space-y-2">
                    <Label>Bin Label</Label>
                    <Input
                      value={scannedBinLabel}
                      onChange={e => setScannedBinLabel(e.target.value)}
                      placeholder={`Expected: ${task.targetBin.label}`}
                      autoFocus
                      required
                    />
                  </div>
                  <Button variant="gradient" type="submit" disabled={completing}>
                    {completing ? 'Confirming...' : 'Confirm Putaway'}
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Unit Contents</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {unit.lineItems.length === 0 ? (
                <p className="px-6 py-4 text-sm text-muted-foreground">No line items</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>SKU</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Qty</TableHead>
                      <TableHead>Weight</TableHead>
                      <TableHead>Temp</TableHead>
                      <TableHead>Hazmat</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {unit.lineItems.map((li, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-mono text-sm font-semibold">{li.sku}</TableCell>
                        <TableCell>{li.description || '-'}</TableCell>
                        <TableCell>{li.quantity}</TableCell>
                        <TableCell>{li.weight != null ? `${li.weight} kg` : '-'}</TableCell>
                        <TableCell>{li.temperature || 'ambient'}</TableCell>
                        <TableCell>{li.hazmat ? <Badge variant="destructive">Yes</Badge> : 'No'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-6 lg:sticky lg:top-20 lg:self-start">
          <Card>
            <CardHeader>
              <CardTitle>Unit</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-xs text-muted-foreground">Identifier</dt>
                  <dd className="mt-0.5 font-medium">{unit.identifier}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Type</dt>
                  <dd className="mt-0.5">{formatStatus(unit.unitType)}</dd>
                </div>
                {unit.barcode && (
                  <div>
                    <dt className="text-xs text-muted-foreground">Barcode</dt>
                    <dd className="mt-0.5 font-mono text-xs">{unit.barcode}</dd>
                  </div>
                )}
                {unit.lotNumber && (
                  <div>
                    <dt className="text-xs text-muted-foreground">Lot</dt>
                    <dd className="mt-0.5">{unit.lotNumber}</dd>
                  </div>
                )}
                {unit.expiryDate && (
                  <div>
                    <dt className="text-xs text-muted-foreground">Expiry</dt>
                    <dd className="mt-0.5">{new Date(unit.expiryDate).toLocaleDateString()}</dd>
                  </div>
                )}
                <div>
                  <dt className="text-xs text-muted-foreground">Quality</dt>
                  <dd className="mt-0.5">
                    <Badge variant={unit.qualityStatus === 'available' ? 'success' : 'warning'}>
                      {formatStatus(unit.qualityStatus)}
                    </Badge>
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Task Info</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-3 text-sm">
                <div>
                  <dt className="text-xs text-muted-foreground">Type</dt>
                  <dd className="mt-0.5">{formatStatus(task.putawayType)}</dd>
                </div>
                {task.assignedToUserId && (
                  <div>
                    <dt className="text-xs text-muted-foreground">Assigned To</dt>
                    <dd className="mt-0.5">{task.assignedToUserId}</dd>
                  </div>
                )}
                {task.receivingTask && (
                  <div>
                    <dt className="text-xs text-muted-foreground">From Receiving</dt>
                    <dd className="mt-0.5">
                      <Button variant="outline" size="sm" onClick={() => navigate(`/wms/receiving/${task.receivingTask!.id}`)}>
                        {task.receivingTask.id.slice(0, 8)} ({task.receivingTask.receivingType})
                      </Button>
                    </dd>
                  </div>
                )}
                <div>
                  <dt className="text-xs text-muted-foreground">Created</dt>
                  <dd className="mt-0.5">{new Date(task.createdAt).toLocaleString()}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
