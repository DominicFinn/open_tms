import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowDown,
  ArrowUp,
  BarChart3,
  Building2,
  CircleAlert,
  Loader2,
  MapPin,
  Route,
  Search,
  Truck,
} from 'lucide-react';

import { API_URL } from '../api';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

interface QualitySummary {
  id: string;
  orgId: string;
  dimensionType: string;
  dimensionId: string;
  dimensionName: string;
  totalIssues: number;
  exceptionCount: number;
  delayCount: number;
  damageCount: number;
  complianceCount: number;
  otherCount: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  openCount: number;
  inProgressCount: number;
  resolvedCount: number;
  closedCount: number;
  capaCount: number;
  avgResolutionHours: number | null;
  lastIssueAt: string | null;
}

type DimensionTab = 'carrier' | 'lane' | 'location' | 'customer';

type SortField =
  | 'dimensionName'
  | 'totalIssues'
  | 'criticalCount'
  | 'highCount'
  | 'exceptionCount'
  | 'delayCount'
  | 'damageCount'
  | 'complianceCount'
  | 'capaCount'
  | 'avgResolutionHours'
  | 'lastIssueAt';

type SortOrder = 'asc' | 'desc';

function formatHours(hours: number | null): string {
  if (hours === null || hours === undefined) return 'N/A';
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  return `${hours.toFixed(1)}h`;
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return 'N/A';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

const TABS: { key: DimensionTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: 'carrier', label: 'Carriers', icon: Truck },
  { key: 'lane', label: 'Lanes', icon: Route },
  { key: 'location', label: 'Locations', icon: MapPin },
  { key: 'customer', label: 'Customers', icon: Building2 },
];

export default function VNextQualityIssueSummaries() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<DimensionTab>('carrier');
  const [summaries, setSummaries] = useState<QualitySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortField>('totalIssues');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError('');
        const params = new URLSearchParams({
          dimensionType: activeTab,
          sortBy: sortBy,
          sortOrder: sortOrder,
          limit: '50',
        });
        const res = await fetch(`${API_URL}/api/v1/quality/summaries?${params}`);
        if (!res.ok) throw new Error(`Failed to load summaries (${res.status})`);
        const json = await res.json();
        if (!cancelled) {
          setSummaries(json.data || []);
        }
      } catch (err: any) {
        if (!cancelled) setError(err.message || 'Failed to load quality summaries');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [activeTab, sortBy, sortOrder]);

  const filtered = useMemo(() => {
    if (!search) return summaries;
    const q = search.toLowerCase();
    return summaries.filter(s => s.dimensionName.toLowerCase().includes(q));
  }, [summaries, search]);

  function handleSort(field: SortField) {
    if (sortBy === field) {
      setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  }

  function SortIndicator({ field }: { field: SortField }) {
    if (sortBy !== field) return null;
    return sortOrder === 'asc' ? <ArrowUp className="ml-1 inline h-3 w-3" /> : <ArrowDown className="ml-1 inline h-3 w-3" />;
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-3 py-24 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin" />
        <h3 className="text-lg font-medium">Loading...</h3>
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Issue analysis</h1>
        <p className="mt-1 text-sm text-muted-foreground">Quality metrics by carrier, lane, location, and customer</p>
      </div>

      <div className="flex flex-wrap items-center gap-1 border-b border-border">
        {TABS.map(tab => {
          const Icon = tab.icon;
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => { setActiveTab(tab.key); setSearch(''); }}
              className={cn(
                '-mb-px flex items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium transition-colors',
                active
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      <Card>
        <div className="flex flex-wrap items-center gap-3 p-4">
          <div className="relative min-w-[240px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={`Search ${TABS.find(t => t.key === activeTab)?.label.toLowerCase() || ''}...`}
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        <Separator />

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-12 text-muted-foreground">
            <BarChart3 className="h-10 w-10 opacity-40" />
            <h3 className="text-base font-medium">No data found</h3>
            <p className="text-sm">
              {search
                ? `No ${TABS.find(t => t.key === activeTab)?.label.toLowerCase() || 'results'} match your search.`
                : `No quality issue data available for ${TABS.find(t => t.key === activeTab)?.label.toLowerCase() || 'this dimension'} yet.`}
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="cursor-pointer" onClick={() => handleSort('dimensionName')}>Name<SortIndicator field="dimensionName" /></TableHead>
                <TableHead className="cursor-pointer text-right" onClick={() => handleSort('totalIssues')}>Total<SortIndicator field="totalIssues" /></TableHead>
                <TableHead className="cursor-pointer text-center" onClick={() => handleSort('criticalCount')}>Critical<SortIndicator field="criticalCount" /></TableHead>
                <TableHead className="cursor-pointer text-center" onClick={() => handleSort('highCount')}>High<SortIndicator field="highCount" /></TableHead>
                <TableHead className="cursor-pointer text-right" onClick={() => handleSort('exceptionCount')}>Exceptions<SortIndicator field="exceptionCount" /></TableHead>
                <TableHead className="cursor-pointer text-right" onClick={() => handleSort('delayCount')}>Delays<SortIndicator field="delayCount" /></TableHead>
                <TableHead className="cursor-pointer text-right" onClick={() => handleSort('damageCount')}>Damage<SortIndicator field="damageCount" /></TableHead>
                <TableHead className="cursor-pointer text-right" onClick={() => handleSort('complianceCount')}>Compliance<SortIndicator field="complianceCount" /></TableHead>
                <TableHead className="cursor-pointer text-right" onClick={() => handleSort('capaCount')}>CAPA req.<SortIndicator field="capaCount" /></TableHead>
                <TableHead className="cursor-pointer text-right" onClick={() => handleSort('avgResolutionHours')}>Avg res.<SortIndicator field="avgResolutionHours" /></TableHead>
                <TableHead className="cursor-pointer text-right" onClick={() => handleSort('lastIssueAt')}>Last issue<SortIndicator field="lastIssueAt" /></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(s => (
                <TableRow key={s.id}>
                  <TableCell>
                    <div className="font-semibold">{s.dimensionName}</div>
                    <div className="text-xs text-muted-foreground">
                      {s.openCount} open / {s.inProgressCount} in progress / {s.resolvedCount} resolved
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-semibold">{s.totalIssues}</TableCell>
                  <TableCell className="text-center">
                    {s.criticalCount > 0
                      ? <Badge variant="destructive">{s.criticalCount}</Badge>
                      : <span className="text-sm text-muted-foreground">0</span>}
                  </TableCell>
                  <TableCell className="text-center">
                    {s.highCount > 0
                      ? <Badge variant="warning">{s.highCount}</Badge>
                      : <span className="text-sm text-muted-foreground">0</span>}
                  </TableCell>
                  <TableCell className="text-right text-sm">{s.exceptionCount}</TableCell>
                  <TableCell className="text-right text-sm">{s.delayCount}</TableCell>
                  <TableCell className="text-right text-sm">{s.damageCount}</TableCell>
                  <TableCell className="text-right text-sm">{s.complianceCount}</TableCell>
                  <TableCell className="text-right text-sm">
                    {s.capaCount > 0
                      ? <span className="font-semibold text-destructive">{s.capaCount}</span>
                      : '0'}
                  </TableCell>
                  <TableCell className="text-right text-sm text-muted-foreground">
                    {formatHours(s.avgResolutionHours)}
                  </TableCell>
                  <TableCell className="text-right text-sm text-muted-foreground">
                    {timeAgo(s.lastIssueAt)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
