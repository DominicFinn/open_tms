import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  ClipboardList,
  List,
  Loader2,
  Play,
  Receipt,
} from 'lucide-react';

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

interface WaveDetail {
  id: string;
  waveNumber: string;
  status: string;
  pickStrategy: string;
  orderCount: number;
  lineCount: number;
  cutoffAt: string | null;
  createdAt: string;
  waveOrders: Array<{ orderId: string; priority: number }>;
  pickTasks: Array<{
    id: string;
    status: string;
    pickType: string;
    orderId: string | null;
    totalLines: number;
    completedLines: number;
    assignedToUserId: string | null;
  }>;
}

type BadgeVariant = 'success' | 'info' | 'warning' | 'destructive' | 'muted' | 'secondary' | 'default';

function statusVariant(s: string): BadgeVariant {
  switch (s) {
    case 'planning': return 'secondary';
    case 'released': return 'info';
    case 'in_progress': return 'warning';
    case 'completed': return 'success';
    case 'cancelled': return 'destructive';
    case 'short_pick': return 'destructive';
    default: return 'secondary';
  }
}

function formatStatus(s: string): string {
  return s.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

export default function VNextWmsWaveDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [wave, setWave] = useState<WaveDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [releasing, setReleasing] = useState(false);
  const [releaseResult, setReleaseResult] = useState<any>(null);

  const loadWave = () => {
    if (!id) return;
    fetch(`${API_URL}/api/v1/waves/${id}`)
      .then(r => r.json())
      .then(res => { if (res.error) setError(res.error); else setWave(res.data); })
      .catch(() => setError('Failed to load wave'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadWave(); }, [id]);

  const handleRelease = async () => {
    setError('');
    setReleasing(true);
    setReleaseResult(null);
    try {
      const res = await fetch(`${API_URL}/api/v1/waves/${id}/release`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (data.error) setError(data.error);
      else { setReleaseResult(data.data); loadWave(); }
    } catch { setError('Failed to release wave'); }
    finally { setReleasing(false); }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-3 py-24 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }
  if (error && !wave) {
    return (
      <div className="flex items-center gap-3 rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
        <CircleAlert className="h-5 w-5" />
        {error}
      </div>
    );
  }
  if (!wave) return null;

  const totalPickLines = wave.pickTasks.reduce((s, t) => s + t.totalLines, 0);
  const completedPickLines = wave.pickTasks.reduce((s, t) => s + t.completedLines, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link to="/wms/waves" className="hover:text-foreground">
          <ArrowLeft className="inline h-4 w-4" /> Waves
        </Link>
        <ChevronRight className="h-3 w-3" />
        <span>{wave.waveNumber}</span>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{wave.waveNumber}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge variant={statusVariant(wave.status)}>{formatStatus(wave.status)}</Badge>
            <Badge variant="default">{formatStatus(wave.pickStrategy)}</Badge>
            {wave.cutoffAt && (
              <span className="text-sm text-muted-foreground">
                Cutoff: {new Date(wave.cutoffAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          {wave.status === 'planning' && (
            <Button variant="gradient" onClick={handleRelease} disabled={releasing}>
              <Play className="h-4 w-4" />
              {releasing ? 'Releasing...' : 'Release Wave'}
            </Button>
          )}
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-3 rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          <CircleAlert className="h-5 w-5" />
          {error}
        </div>
      )}

      {releaseResult && (
        <div className="space-y-2">
          <div className="flex items-center gap-3 rounded-md border border-success/30 bg-success/10 p-4 text-sm text-success">
            <CheckCircle2 className="h-5 w-5" />
            Wave released: {releaseResult.pickTasksCreated} pick task(s) created
          </div>
          {releaseResult.allocationFailures?.length > 0 && (
            <div className="flex items-start gap-3 rounded-md border border-warning/30 bg-warning/10 p-4 text-sm text-warning">
              <AlertTriangle className="h-5 w-5" />
              <div>
                <strong>Allocation warnings:</strong>
                <ul className="ml-5 mt-1 list-disc">
                  {releaseResult.allocationFailures.map((f: string, i: number) => <li key={i}>{f}</li>)}
                </ul>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Orders', value: wave.orderCount, icon: Receipt, tone: 'bg-primary/10 text-primary' },
          { label: 'Order Lines', value: wave.lineCount, icon: List, tone: 'bg-info/15 text-info' },
          { label: 'Pick Tasks', value: wave.pickTasks.length, icon: ClipboardList, tone: 'bg-warning/15 text-warning' },
          ...(totalPickLines > 0 ? [{ label: 'Lines Picked', value: `${completedPickLines}/${totalPickLines}`, icon: CheckCircle2, tone: 'bg-success/15 text-success' }] : []),
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
        <CardHeader>
          <CardTitle>Pick Tasks</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {wave.pickTasks.length === 0 ? (
            <div className="px-6 py-8 text-center text-sm text-muted-foreground">
              {wave.status === 'planning' ? 'Release the wave to generate pick tasks.' : 'No pick tasks.'}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Task</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Order</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead>Assigned</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {wave.pickTasks.map(t => (
                  <TableRow key={t.id}>
                    <TableCell className="font-mono text-sm font-semibold">{t.id.slice(0, 8)}</TableCell>
                    <TableCell>
                      <Badge variant="default">{formatStatus(t.pickType)}</Badge>
                    </TableCell>
                    <TableCell>{t.orderId?.slice(0, 8) ?? 'Batch'}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-32 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-success"
                            style={{ width: `${t.totalLines > 0 ? (t.completedLines / t.totalLines) * 100 : 0}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground">{t.completedLines}/{t.totalLines}</span>
                      </div>
                    </TableCell>
                    <TableCell>{t.assignedToUserId || 'Unassigned'}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(t.status)}>{formatStatus(t.status)}</Badge>
                    </TableCell>
                    <TableCell>
                      <Button variant="outline" size="sm" onClick={() => navigate(`/wms/picking/${t.id}`)}>
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
