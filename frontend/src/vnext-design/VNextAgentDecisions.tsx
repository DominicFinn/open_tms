import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BadgeCheck,
  Bot,
  CircleAlert,
  Clock,
  Coins,
  Gauge,
  Loader2,
  Search,
  Sparkles,
  Target,
} from 'lucide-react';

import { API_URL } from '../api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
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

interface Decision {
  id: string;
  agentType: string;
  modelProvider: string | null;
  modelId: string | null;
  triggerType: string;
  triggerEventType: string | null;
  entityType: string | null;
  entityId: string | null;
  summary: string;
  confidence: number | null;
  actionType: string;
  actionEntityType: string | null;
  actionEntityId: string | null;
  outcomeStatus: string | null;
  promotedToAutomation: boolean;
  createdAt: string;
  updatedAt: string;
}

interface Stats {
  totalDecisions: number;
  byAgentType: { agentType: string; count: number }[];
  byActionType: { actionType: string; count: number }[];
  byOutcomeStatus: { outcomeStatus: string; count: number }[];
  averageConfidence: number | null;
  promotedCount: number;
  pendingReviewCount: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  averageDurationMs: number | null;
}

interface DailyUsage {
  date: string;
  invocations: number;
  inputTokens: number;
  outputTokens: number;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function outcomeBadge(status: string | null) {
  if (!status || status === 'pending') return <Badge variant="secondary">Pending review</Badge>;
  if (status === 'correct') return <Badge variant="success">Correct</Badge>;
  if (status === 'incorrect') return <Badge variant="destructive">Incorrect</Badge>;
  if (status === 'partially_correct') return <Badge variant="warning">Partial</Badge>;
  return <Badge variant="secondary">{status}</Badge>;
}

function actionBadge(actionType: string) {
  if (actionType === 'create_issue') return <Badge variant="info">Created issue</Badge>;
  if (actionType === 'escalate_issue') return <Badge variant="warning">Escalated</Badge>;
  if (actionType === 'no_action') return <Badge variant="secondary">No action</Badge>;
  return <Badge variant="secondary">{actionType}</Badge>;
}

function ConfidenceBar({ confidence }: { confidence: number | null }) {
  if (confidence === null || confidence === undefined) {
    return <span className="text-sm text-muted-foreground">-</span>;
  }
  const pct = Math.round(confidence * 100);
  const color = pct >= 80 ? 'bg-success' : pct >= 50 ? 'bg-warning' : 'bg-destructive';
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-12 overflow-hidden rounded-full bg-muted">
        <div className={cn('h-full', color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-sm font-medium">{pct}%</span>
    </div>
  );
}

export default function VNextAgentDecisions() {
  const navigate = useNavigate();
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [dailyUsage, setDailyUsage] = useState<DailyUsage[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [outcomeFilter, setOutcomeFilter] = useState('all');
  const [actionFilter, setActionFilter] = useState('all');
  const [agentTypeFilter, setAgentTypeFilter] = useState('all');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const params = new URLSearchParams();
        if (outcomeFilter !== 'all') params.set('outcomeStatus', outcomeFilter);
        if (actionFilter !== 'all') params.set('actionType', actionFilter);
        if (agentTypeFilter !== 'all') params.set('agentType', agentTypeFilter);
        params.set('limit', '100');

        const [listRes, statsRes, usageRes] = await Promise.all([
          fetch(`${API_URL}/api/v1/agent-decisions?${params}`),
          fetch(`${API_URL}/api/v1/agent-decisions/stats`),
          fetch(`${API_URL}/api/v1/agent-decisions/usage?days=30`),
        ]);

        if (!cancelled) {
          const listJson = await listRes.json();
          const statsJson = await statsRes.json();
          const usageJson = await usageRes.json();
          setDecisions(listJson.data?.items || []);
          setTotal(listJson.data?.total || 0);
          setStats(statsJson.data || null);
          setDailyUsage(usageJson.data || []);
          setError('');
        }
      } catch (err: any) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [outcomeFilter, actionFilter, agentTypeFilter]);

  const filtered = search
    ? decisions.filter(d =>
        d.summary.toLowerCase().includes(search.toLowerCase()) ||
        d.entityId?.toLowerCase().includes(search.toLowerCase()) ||
        d.triggerEventType?.toLowerCase().includes(search.toLowerCase())
      )
    : decisions;

  const correctCount = stats?.byOutcomeStatus?.find(s => s.outcomeStatus === 'correct')?.count || 0;
  const incorrectCount = stats?.byOutcomeStatus?.find(s => s.outcomeStatus === 'incorrect')?.count || 0;
  const reviewedCount = correctCount + incorrectCount + (stats?.byOutcomeStatus?.find(s => s.outcomeStatus === 'partially_correct')?.count || 0);
  const accuracyPct = reviewedCount > 0 ? Math.round((correctCount / reviewedCount) * 100) : null;

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-3 py-24 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin" />
        <h3 className="text-lg font-medium">Loading decisions...</h3>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-3 rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
        <CircleAlert className="h-5 w-5" />
        {error}
      </div>
    );
  }

  const statTiles = [
    { label: 'Total decisions', value: stats?.totalDecisions ?? 0, icon: Bot, tone: 'bg-primary/10 text-primary' },
    { label: 'Pending review', value: stats?.pendingReviewCount ?? 0, icon: Clock, tone: 'bg-warning/15 text-warning' },
    { label: 'Accuracy rate', value: accuracyPct !== null ? `${accuracyPct}%` : '-', icon: BadgeCheck, tone: 'bg-success/15 text-success' },
    {
      label: 'Avg confidence',
      value: stats?.averageConfidence !== null ? `${Math.round((stats?.averageConfidence ?? 0) * 100)}%` : '-',
      icon: Gauge,
      tone: 'bg-info/15 text-info',
    },
    { label: 'Promoted', value: stats?.promotedCount ?? 0, icon: Sparkles, tone: 'bg-primary/10 text-primary' },
    { label: 'Total tokens', value: stats?.totalTokens ? stats.totalTokens.toLocaleString() : '0', icon: Coins, tone: 'bg-destructive/10 text-destructive' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Agent decisions</h1>
        <p className="mt-1 text-sm text-muted-foreground">{total} decisions logged</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        {statTiles.map(tile => {
          const Icon = tile.icon;
          return (
            <Card key={tile.label}>
              <div className="p-5">
                <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg', tile.tone)}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="mt-3 text-2xl font-bold tracking-tight">{tile.value}</div>
                <div className="mt-1 text-sm text-muted-foreground">{tile.label}</div>
              </div>
            </Card>
          );
        })}
      </div>

      {dailyUsage.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Usage (last 30 days)</CardTitle>
            <span className="text-sm text-muted-foreground">
              {stats?.totalInputTokens?.toLocaleString() ?? 0} input + {stats?.totalOutputTokens?.toLocaleString() ?? 0} output tokens
            </span>
          </CardHeader>
          <CardContent>
            <div className="flex h-32 items-end gap-0.5">
              {dailyUsage.map(d => {
                const maxInvocations = Math.max(...dailyUsage.map(x => x.invocations), 1);
                const height = Math.max(4, (d.invocations / maxInvocations) * 100);
                const totalTokens = d.inputTokens + d.outputTokens;
                return (
                  <div
                    key={d.date}
                    title={`${d.date}: ${d.invocations} invocations, ${totalTokens.toLocaleString()} tokens`}
                    className="min-w-[4px] flex-1 rounded-t bg-primary/80"
                    style={{ height: `${height}%` }}
                  />
                );
              })}
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
              <span>{dailyUsage[0]?.date}</span>
              <span>Invocations per day</span>
              <span>{dailyUsage[dailyUsage.length - 1]?.date}</span>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <div className="flex flex-wrap items-center gap-3 p-4">
          <div className="relative min-w-[240px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search decisions..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={outcomeFilter} onValueChange={setOutcomeFilter}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All outcomes</SelectItem>
              <SelectItem value="pending">Pending review</SelectItem>
              <SelectItem value="correct">Correct</SelectItem>
              <SelectItem value="incorrect">Incorrect</SelectItem>
              <SelectItem value="partially_correct">Partially correct</SelectItem>
            </SelectContent>
          </Select>
          <Select value={actionFilter} onValueChange={setActionFilter}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All actions</SelectItem>
              <SelectItem value="create_issue">Created issue</SelectItem>
              <SelectItem value="escalate_issue">Escalated</SelectItem>
              <SelectItem value="no_action">No action</SelectItem>
            </SelectContent>
          </Select>
          <Select value={agentTypeFilter} onValueChange={setAgentTypeFilter}>
            <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All agents</SelectItem>
              <SelectItem value="triage">Triage</SelectItem>
              <SelectItem value="quality_analysis">Quality analysis</SelectItem>
              <SelectItem value="route_optimization">Route optimization</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Separator />

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-12 text-muted-foreground">
            <Bot className="h-10 w-10 opacity-40" />
            <h3 className="text-base font-medium">No decisions yet</h3>
            <p className="text-sm">Agent decisions will appear here when the triage agent processes events.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Decision</TableHead>
                <TableHead>Agent</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Confidence</TableHead>
                <TableHead>Outcome</TableHead>
                <TableHead>When</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(d => (
                <TableRow key={d.id} onClick={() => navigate(`/agent-decisions/${d.id}`)} className="cursor-pointer">
                  <TableCell>
                    <div className="font-medium">{d.summary}</div>
                    <div className="text-xs text-muted-foreground">
                      {d.triggerEventType || d.triggerType} {d.entityType ? `on ${d.entityType}` : ''}
                    </div>
                  </TableCell>
                  <TableCell><span className="text-sm capitalize">{d.agentType.replace(/_/g, ' ')}</span></TableCell>
                  <TableCell>{actionBadge(d.actionType)}</TableCell>
                  <TableCell><ConfidenceBar confidence={d.confidence} /></TableCell>
                  <TableCell>{outcomeBadge(d.outcomeStatus)}</TableCell>
                  <TableCell><span className="text-sm text-muted-foreground">{timeAgo(d.createdAt)}</span></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
