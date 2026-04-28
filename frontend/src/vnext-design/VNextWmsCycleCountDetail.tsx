import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  List,
  Loader2,
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
import { cn } from '@/lib/utils';

interface CycleCountLine {
  id: string;
  binId: string;
  sku: string;
  uomCode: string;
  expectedQuantity: number;
  countedQuantity: number | null;
  variance: number | null;
  status: string;
  countedAt: string | null;
  notes: string | null;
}

interface CycleCountDetail {
  id: string;
  countType: string;
  status: string;
  totalBins: number;
  countedBins: number;
  varianceCount: number;
  lines: CycleCountLine[];
  createdAt: string;
}

type BadgeVariant = 'success' | 'info' | 'warning' | 'destructive' | 'muted' | 'secondary' | 'default';

function lineStatusVariant(s: string): BadgeVariant {
  switch (s) {
    case 'pending': return 'secondary';
    case 'counted': return 'info';
    case 'adjusted': return 'success';
    case 'variance_confirmed': return 'warning';
    default: return 'secondary';
  }
}

function countStatusVariant(s: string): BadgeVariant {
  if (s === 'completed') return 'success';
  if (s === 'in_progress') return 'warning';
  return 'secondary';
}

function formatStatus(s: string): string {
  return s.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

export default function VNextWmsCycleCountDetail() {
  const { id } = useParams<{ id: string }>();
  const [count, setCount] = useState<CycleCountDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [countingLineId, setCountingLineId] = useState<string | null>(null);
  const [countForm, setCountForm] = useState({ countedQuantity: '', notes: '' });
  const [counting, setCounting] = useState(false);

  const loadCount = () => {
    if (!id) return;
    fetch(`${API_URL}/api/v1/cycle-counts/${id}`)
      .then(r => r.json())
      .then(res => { if (res.error) setError(res.error); else setCount(res.data); })
      .catch(() => setError('Failed to load'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadCount(); }, [id]);

  const handleRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!countingLineId) return;
    setError('');
    setCounting(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/cycle-count-lines/${countingLineId}/record`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          countedQuantity: parseInt(countForm.countedQuantity) || 0,
          notes: countForm.notes || undefined,
        }),
      });
      const data = await res.json();
      if (data.error) setError(data.error);
      else { setCountingLineId(null); loadCount(); }
    } catch { setError('Failed to record'); }
    finally { setCounting(false); }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-3 py-24 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }
  if (!count) {
    return (
      <div className="flex items-center gap-3 rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
        <CircleAlert className="h-5 w-5" />
        {error || 'Not found'}
      </div>
    );
  }

  const isActive = count.status !== 'completed' && count.status !== 'cancelled';

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link to="/wms/cycle-counts" className="hover:text-foreground">
          <ArrowLeft className="inline h-4 w-4" /> Cycle Counts
        </Link>
        <ChevronRight className="h-3 w-3" />
        <span>{count.id.slice(0, 8)}</span>
      </div>

      <div>
        <h1 className="text-3xl font-bold tracking-tight">Cycle Count</h1>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="font-mono text-sm font-semibold">{count.id.slice(0, 8)}</span>
          <Badge variant={countStatusVariant(count.status)}>{formatStatus(count.status)}</Badge>
          <Badge variant="default">{formatStatus(count.countType)}</Badge>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-3 rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          <CircleAlert className="h-5 w-5" />
          {error}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { label: 'Total Lines', value: count.totalBins, icon: List, tone: 'bg-primary/10 text-primary' },
          { label: 'Counted', value: count.countedBins, icon: CheckCircle2, tone: 'bg-success/15 text-success' },
          { label: 'Variances', value: count.varianceCount, icon: AlertTriangle, tone: count.varianceCount > 0 ? 'bg-destructive/10 text-destructive' : 'bg-muted text-muted-foreground' },
        ].map(s => {
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

      <Card>
        <CardContent className="p-5">
          <div className="mb-2 flex justify-between text-sm">
            <span className="font-semibold">Progress</span>
            <span className="text-muted-foreground">{count.countedBins}/{count.totalBins}</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-success"
              style={{ width: `${count.totalBins > 0 ? (count.countedBins / count.totalBins) * 100 : 0}%` }}
            />
          </div>
        </CardContent>
      </Card>

      {countingLineId && (
        <Card className="border-l-4 border-l-primary">
          <CardHeader>
            <CardTitle>Record Count</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleRecord} className="flex flex-wrap items-end gap-3">
              <div className="w-32 space-y-2">
                <Label>Counted Qty</Label>
                <Input
                  type="number"
                  min="0"
                  value={countForm.countedQuantity}
                  onChange={e => setCountForm({ ...countForm, countedQuantity: e.target.value })}
                  autoFocus
                  required
                />
              </div>
              <div className="flex-1 space-y-2">
                <Label>Notes</Label>
                <Input value={countForm.notes} onChange={e => setCountForm({ ...countForm, notes: e.target.value })} placeholder="Optional" />
              </div>
              <Button variant="gradient" type="submit" disabled={counting}>{counting ? 'Saving...' : 'Record'}</Button>
              <Button variant="outline" type="button" onClick={() => setCountingLineId(null)}>Cancel</Button>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Count Lines</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SKU</TableHead>
                <TableHead>UOM</TableHead>
                <TableHead>Expected</TableHead>
                <TableHead>Counted</TableHead>
                <TableHead>Variance</TableHead>
                <TableHead>Status</TableHead>
                {isActive && <TableHead></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {count.lines.map(line => (
                <TableRow key={line.id} className={cn(line.id === countingLineId && 'bg-muted')}>
                  <TableCell className="font-mono text-sm font-semibold">{line.sku}</TableCell>
                  <TableCell>{line.uomCode}</TableCell>
                  <TableCell>{line.expectedQuantity}</TableCell>
                  <TableCell className={line.countedQuantity !== null ? 'font-semibold' : ''}>{line.countedQuantity ?? '-'}</TableCell>
                  <TableCell>
                    {line.variance !== null && line.variance !== 0 ? (
                      <span className={cn('font-semibold', line.variance > 0 ? 'text-info' : 'text-destructive')}>
                        {line.variance > 0 ? '+' : ''}{line.variance}
                      </span>
                    ) : line.variance === 0 ? (
                      <span className="text-success">OK</span>
                    ) : '-'}
                  </TableCell>
                  <TableCell>
                    <Badge variant={lineStatusVariant(line.status)}>{formatStatus(line.status)}</Badge>
                  </TableCell>
                  {isActive && (
                    <TableCell>
                      {line.status === 'pending' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => { setCountingLineId(line.id); setCountForm({ countedQuantity: '', notes: '' }); }}
                        >
                          Count
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
