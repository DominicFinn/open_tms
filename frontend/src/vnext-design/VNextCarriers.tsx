import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircle2,
  CircleAlert,
  Clock,
  Grid3x3,
  List as ListIcon,
  Loader2,
  MapPin,
  Pencil,
  Plus,
  Search,
  Star,
  Truck,
} from 'lucide-react';

import { API_URL } from '../api';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { Button } from '@/components/ui/button';
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

interface Carrier {
  id: string;
  name: string;
  mcNumber?: string;
  dotNumber?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  city?: string;
  state?: string;
  country?: string;
  archived?: boolean;
  validationTier?: string;
  registrationChecked?: boolean;
  insuranceDocReceived?: boolean;
}

type StatusVariant = 'success' | 'warning' | 'destructive';

function carrierStatus(c: Carrier): { label: string; variant: StatusVariant } {
  if (c.archived) return { label: 'Inactive', variant: 'destructive' };
  if (c.validationTier === 'probation') return { label: 'Probation', variant: 'warning' };
  return { label: 'Active', variant: 'success' };
}

export default function VNextCarriers() {
  const navigate = useNavigate();
  const { hasPermission } = useCurrentUser();
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('cards');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [carriers, setCarriers] = useState<Carrier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statFilter, setStatFilter] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        // Include archived carriers so the management list + "Archived" stat
        // filter can surface them (they show an "Inactive" badge).
        const res = await fetch(`${API_URL}/api/v1/carriers?includeArchived=true`);
        if (!res.ok) throw new Error(`Failed to load carriers (${res.status})`);
        const json = await res.json();
        if (!cancelled) {
          setCarriers(json.data || []);
          setError('');
        }
      } catch (err: any) {
        if (!cancelled) setError(err.message || 'Failed to load carriers');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Clickable stat boxes each carry a predicate; selecting one filters the list.
  const statDefs = [
    { key: 'active', label: 'Active carriers', icon: CheckCircle2, tone: 'bg-success/15 text-success', match: (c: Carrier) => !c.archived },
    { key: 'registration', label: 'Registration verified', icon: Star, tone: 'bg-info/15 text-info', match: (c: Carrier) => !!c.registrationChecked },
    { key: 'insurance', label: 'Insurance on file', icon: Truck, tone: 'bg-primary/10 text-primary', match: (c: Carrier) => !!c.insuranceDocReceived },
    { key: 'archived', label: 'Archived', icon: Clock, tone: 'bg-warning/15 text-warning', match: (c: Carrier) => !!c.archived },
  ];
  const activeStat = statDefs.find(s => s.key === statFilter);

  const filtered = carriers.filter(c => {
    if (activeStat && !activeStat.match(c)) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return c.name.toLowerCase().includes(q)
      || (c.mcNumber || '').toLowerCase().includes(q)
      || (c.contactName || '').toLowerCase().includes(q);
  });

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

  const stats = statDefs.map(s => ({ ...s, value: carriers.filter(s.match).length }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Carriers</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {carriers.length} carriers in your network
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-md border border-input">
            <Button
              variant={viewMode === 'cards' ? 'secondary' : 'ghost'}
              size="icon"
              className="rounded-r-none"
              onClick={() => setViewMode('cards')}
            >
              <Grid3x3 className="h-4 w-4" />
            </Button>
            <Separator orientation="vertical" />
            <Button
              variant={viewMode === 'table' ? 'secondary' : 'ghost'}
              size="icon"
              className="rounded-l-none"
              onClick={() => setViewMode('table')}
            >
              <ListIcon className="h-4 w-4" />
            </Button>
          </div>
          {hasPermission('carriers:write') && (
            <Button variant="gradient" onClick={() => navigate('/carriers/create')}>
              <Plus className="h-4 w-4" />
              Add carrier
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map(stat => {
          const Icon = stat.icon;
          const isActive = statFilter === stat.key;
          return (
            <Card
              key={stat.key}
              role="button"
              tabIndex={0}
              aria-pressed={isActive}
              onClick={() => setStatFilter(isActive ? null : stat.key)}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setStatFilter(isActive ? null : stat.key); } }}
              className={cn(
                'cursor-pointer transition-colors hover:border-primary/50',
                isActive && 'border-primary ring-1 ring-primary'
              )}
            >
              <div className="p-5">
                <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg', stat.tone)}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="mt-3 text-2xl font-bold tracking-tight">{stat.value}</div>
                <div className="mt-1 text-sm text-muted-foreground">{stat.label}</div>
              </div>
            </Card>
          );
        })}
      </div>

      {activeStat && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>Filtered by <span className="font-medium text-foreground">{activeStat.label}</span> — showing {filtered.length} of {carriers.length}.</span>
          <button className="text-primary hover:underline" onClick={() => setStatFilter(null)}>Clear</button>
        </div>
      )}

      <Card>
        <div className="p-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search carriers by name, MC#, or contact..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
      </Card>

      {viewMode === 'cards' ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map(c => {
            const st = carrierStatus(c);
            const isOpen = expandedId === c.id;
            return (
              <Card
                key={c.id}
                className="cursor-pointer transition-colors hover:border-primary/40"
                onClick={() => setExpandedId(isOpen ? null : c.id)}
              >
                <div className="p-5">
                  <div className="mb-4 flex items-start gap-3">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                      <Truck className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-base font-semibold">{c.name}</span>
                        <Badge variant={st.variant}>{st.label}</Badge>
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {c.mcNumber ? `MC# ${c.mcNumber}` : ''}
                        {c.mcNumber && c.dotNumber ? ' · ' : ''}
                        {c.dotNumber ? `DOT# ${c.dotNumber}` : ''}
                      </div>
                    </div>
                  </div>

                  {c.city && c.state && (
                    <div className="mb-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5" />
                      {c.city}, {c.state}{c.country && c.country !== 'US' ? `, ${c.country}` : ''}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="mb-1 text-xs text-muted-foreground">Registration</div>
                      <Badge variant={c.registrationChecked ? 'success' : 'muted'}>
                        {c.registrationChecked ? 'Verified' : 'Pending'}
                      </Badge>
                    </div>
                    <div>
                      <div className="mb-1 text-xs text-muted-foreground">Insurance</div>
                      <Badge variant={c.insuranceDocReceived ? 'success' : 'warning'}>
                        {c.insuranceDocReceived ? 'On file' : 'Missing'}
                      </Badge>
                    </div>
                  </div>

                  {isOpen && (
                    <div className="mt-4 border-t border-border pt-4 text-sm">
                      <dl className="grid grid-cols-2 gap-3">
                        <div>
                          <dt className="text-xs text-muted-foreground">Contact</dt>
                          <dd>{c.contactName || '-'}</dd>
                        </div>
                        <div>
                          <dt className="text-xs text-muted-foreground">Phone</dt>
                          <dd>{c.contactPhone || '-'}</dd>
                        </div>
                        <div className="col-span-2">
                          <dt className="text-xs text-muted-foreground">Email</dt>
                          <dd className="text-info">{c.contactEmail || '-'}</dd>
                        </div>
                      </dl>
                      {c.validationTier && (
                        <div className="mt-3 text-xs text-muted-foreground">
                          Validation tier: <strong>{c.validationTier}</strong>
                        </div>
                      )}
                      <div className="mt-4 flex justify-end">
                        <Button
                          size="sm"
                          onClick={e => {
                            e.stopPropagation();
                            navigate(`/carriers/${c.id}/edit`);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                          Open details
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Carrier</TableHead>
                <TableHead>MC / DOT</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Registration</TableHead>
                <TableHead>Insurance</TableHead>
                <TableHead>Validation</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(c => {
                const st = carrierStatus(c);
                return (
                  <TableRow
                    key={c.id}
                    onClick={() => navigate(`/carriers/${c.id}/edit`)}
                    className="cursor-pointer"
                  >
                    <TableCell>
                      <div className="font-semibold">{c.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {c.contactName || ''}{c.contactPhone ? ` · ${c.contactPhone}` : ''}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">{c.mcNumber ? `MC# ${c.mcNumber}` : '-'}</div>
                      <div className="text-xs text-muted-foreground">
                        {c.dotNumber ? `DOT# ${c.dotNumber}` : ''}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {c.city && c.state ? `${c.city}, ${c.state}` : '-'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={c.registrationChecked ? 'success' : 'muted'}>
                        {c.registrationChecked ? 'Verified' : 'Pending'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={c.insuranceDocReceived ? 'success' : 'warning'}>
                        {c.insuranceDocReceived ? 'On file' : 'Missing'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">{c.validationTier || '-'}</TableCell>
                    <TableCell>
                      <Badge variant={st.variant}>{st.label}</Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
