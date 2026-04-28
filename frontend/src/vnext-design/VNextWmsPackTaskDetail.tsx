import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Check, ChevronRight, CircleAlert, Loader2, Package } from 'lucide-react';

import { API_URL } from '../api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

interface PackLineDetail {
  id: string;
  sku: string;
  expectedQuantity: number;
  packedQuantity: number;
  status: string;
  trackableUnitId: string;
  orderLineItemId: string;
}

interface PackTaskDetail {
  id: string;
  status: string;
  orderId: string;
  locationId: string;
  packStationBin: { label: string } | null;
  pickTask: { id: string; wave: { waveNumber: string } | null } | null;
  packLines: PackLineDetail[];
  createdAt: string;
}

interface CartonRecommendation {
  cartonId: string;
  cartonName: string;
  lengthMm: number;
  widthMm: number;
  heightMm: number;
  volumeUtilization: number;
  weightUtilization: number;
  unitCostCents: number | null;
  fits: boolean;
}

interface CartonResult {
  recommended: CartonRecommendation | null;
  alternatives: CartonRecommendation[];
  totalItemVolumeMm3: number;
  totalItemWeightGrams: number;
  itemsMissingDimensions: string[];
}

type BadgeVariant = 'success' | 'info' | 'warning' | 'destructive' | 'muted' | 'secondary' | 'default';

function statusVariant(s: string): BadgeVariant {
  switch (s) {
    case 'pending': return 'secondary';
    case 'in_progress': return 'warning';
    case 'verified': return 'info';
    case 'packed': case 'completed': return 'success';
    default: return 'secondary';
  }
}

function formatStatus(s: string): string {
  return s.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

export default function VNextWmsPackTaskDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [task, setTask] = useState<PackTaskDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [packing, setPacking] = useState(false);
  const [cartonResult, setCartonResult] = useState<CartonResult | null>(null);
  const [cartonLoading, setCartonLoading] = useState(false);

  const loadTask = () => {
    if (!id) return;
    fetch(`${API_URL}/api/v1/pack-tasks/${id}`)
      .then(r => r.json())
      .then(res => { if (res.error) setError(res.error); else setTask(res.data); })
      .catch(() => setError('Failed to load'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadTask(); }, [id]);

  useEffect(() => {
    if (!task || task.status === 'completed' || task.packLines.length === 0) return;
    setCartonLoading(true);
    const items = task.packLines.map(l => ({ sku: l.sku, quantity: l.expectedQuantity, orderLineItemId: l.orderLineItemId }));
    fetch(`${API_URL}/api/v1/cartonization/recommend`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locationId: task.locationId, items }),
    })
      .then(r => r.json())
      .then(res => { if (res.data) setCartonResult(res.data); })
      .catch(() => {})
      .finally(() => setCartonLoading(false));
  }, [task?.id, task?.status]);

  const handlePackLine = async (lineId: string, expectedQty: number) => {
    setError('');
    setPacking(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/pack-lines/${lineId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packedQuantity: expectedQty }),
      });
      const data = await res.json();
      if (data.error) setError(data.error);
      else loadTask();
    } catch { setError('Failed to verify'); }
    finally { setPacking(false); }
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

  const isActive = task.status !== 'completed' && task.status !== 'cancelled';
  const totalLines = task.packLines.length;
  const packedLines = task.packLines.filter(l => l.status === 'packed').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link to="/wms/packing" className="hover:text-foreground">
          <ArrowLeft className="inline h-4 w-4" /> Packing
        </Link>
        <ChevronRight className="h-3 w-3" />
        <span>{task.id.slice(0, 8)}</span>
      </div>

      <div>
        <h1 className="text-3xl font-bold tracking-tight">Pack Task</h1>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="font-mono text-sm font-semibold">{task.id.slice(0, 8)}</span>
          <Badge variant={statusVariant(task.status)}>{formatStatus(task.status)}</Badge>
          {task.packStationBin && <span className="text-sm text-muted-foreground">Station: {task.packStationBin.label}</span>}
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
            <span className="font-semibold">Verification Progress</span>
            <span className="text-muted-foreground">{packedLines}/{totalLines} items</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-success transition-all"
              style={{ width: `${totalLines > 0 ? (packedLines / totalLines) * 100 : 0}%` }}
            />
          </div>
        </CardContent>
      </Card>

      {isActive && cartonResult && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              Carton Recommendation
            </CardTitle>
          </CardHeader>
          <CardContent>
            {cartonResult.recommended ? (
              <div>
                <div className="flex flex-wrap items-center gap-6">
                  <div className="rounded-md border-2 border-primary bg-muted px-5 py-3">
                    <div className="text-lg font-bold text-primary">{cartonResult.recommended.cartonName}</div>
                    <div className="text-xs text-muted-foreground">
                      {cartonResult.recommended.lengthMm} x {cartonResult.recommended.widthMm} x {cartonResult.recommended.heightMm} mm
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Volume utilization</div>
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-20 overflow-hidden rounded-full bg-muted">
                        <div
                          className={cn('h-full rounded-full', cartonResult.recommended.volumeUtilization > 85 ? 'bg-warning' : 'bg-success')}
                          style={{ width: `${Math.min(cartonResult.recommended.volumeUtilization, 100)}%` }}
                        />
                      </div>
                      <span className="text-sm font-semibold">{cartonResult.recommended.volumeUtilization}%</span>
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Weight utilization</div>
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-20 overflow-hidden rounded-full bg-muted">
                        <div
                          className={cn('h-full rounded-full', cartonResult.recommended.weightUtilization > 85 ? 'bg-warning' : 'bg-success')}
                          style={{ width: `${Math.min(cartonResult.recommended.weightUtilization, 100)}%` }}
                        />
                      </div>
                      <span className="text-sm font-semibold">{cartonResult.recommended.weightUtilization}%</span>
                    </div>
                  </div>
                  {cartonResult.recommended.unitCostCents != null && (
                    <div>
                      <div className="text-xs text-muted-foreground">Cost</div>
                      <div className="text-sm font-medium">${(cartonResult.recommended.unitCostCents / 100).toFixed(2)}</div>
                    </div>
                  )}
                </div>
                {cartonResult.alternatives.length > 0 && (
                  <div className="mt-3 text-xs text-muted-foreground">
                    Alternatives: {cartonResult.alternatives.map(a => `${a.cartonName} (${a.volumeUtilization}% vol)`).join(', ')}
                  </div>
                )}
              </div>
            ) : cartonLoading ? (
              <div className="text-sm text-muted-foreground">Loading recommendation...</div>
            ) : (
              <div className="text-sm text-muted-foreground">
                {cartonResult.itemsMissingDimensions.length > 0
                  ? `Cannot recommend - missing dimensions for: ${cartonResult.itemsMissingDimensions.join(', ')}`
                  : 'No suitable carton found in catalogue'}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Items to Verify &amp; Pack</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SKU</TableHead>
                <TableHead>Expected</TableHead>
                <TableHead>Packed</TableHead>
                <TableHead>Status</TableHead>
                {isActive && <TableHead></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {task.packLines.map(line => (
                <TableRow key={line.id}>
                  <TableCell className="font-mono text-sm font-semibold">{line.sku}</TableCell>
                  <TableCell>{line.expectedQuantity}</TableCell>
                  <TableCell className={cn('font-semibold', line.packedQuantity > 0 && 'text-success')}>
                    {line.packedQuantity}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(line.status)}>{formatStatus(line.status)}</Badge>
                  </TableCell>
                  {isActive && (
                    <TableCell>
                      {line.status === 'pending' && (
                        <Button variant="gradient" size="sm" disabled={packing} onClick={() => handlePackLine(line.id, line.expectedQuantity)}>
                          <Check className="h-4 w-4" />
                          Verify &amp; Pack
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
