import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Building2, Loader2, Lock, Search, Truck, Users } from 'lucide-react';

import { API_URL } from '../api';
import CustomerUserManagement from '../components/CustomerUserManagement';
import CarrierUserManagement from '../components/CarrierUserManagement';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

type Tab = 'customers' | 'carriers';

interface PortalUserSummary {
  id: string;
  email: string;
  active: boolean;
  lockoutStatus?: { isLocked: boolean; lockedUntil: string | null; failedAttempts: number };
}

interface EntityRow {
  id: string;
  name: string;
  contactEmail?: string | null;
  city?: string | null;
  state?: string | null;
  scacCode?: string | null;
  userCount: number;
  lockedCount: number;
  inactiveCount: number;
}

function Banner({ variant, message }: { variant: 'success' | 'error'; message: string }) {
  const tone =
    variant === 'success'
      ? 'border-success/30 bg-success/10 text-success'
      : 'border-destructive/30 bg-destructive/10 text-destructive';
  return <div className={`rounded-md border p-3 text-sm ${tone}`}>{message}</div>;
}

export default function VNextPortalUsers() {
  const [tab, setTab] = useState<Tab>('customers');
  const [rows, setRows] = useState<EntityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    setSelected(null);
    setSearch('');
    load(tab);
  }, [tab]);

  async function load(which: Tab) {
    setLoading(true);
    setError('');
    try {
      const listPath = which === 'customers' ? '/api/v1/customers' : '/api/v1/carriers';
      const userPath = which === 'customers' ? 'customers' : 'carriers';
      const listRes = await fetch(`${API_URL}${listPath}`);
      const listJson = await listRes.json();
      if (listJson.error) throw new Error(listJson.error);
      const entities: any[] = listJson.data || [];

      const enriched: EntityRow[] = await Promise.all(
        entities.map(async (e) => {
          let users: PortalUserSummary[] = [];
          try {
            const r = await fetch(`${API_URL}/api/v1/${userPath}/${e.id}/users`);
            const j = await r.json();
            users = j.data || [];
          } catch {
            users = [];
          }
          return {
            id: e.id,
            name: e.name,
            contactEmail: e.contactEmail ?? null,
            city: e.billingCity ?? e.city ?? null,
            state: e.billingState ?? e.state ?? null,
            scacCode: e.scacCode ?? null,
            userCount: users.length,
            lockedCount: users.filter((u) => u.lockoutStatus?.isLocked).length,
            inactiveCount: users.filter((u) => !u.active).length,
          };
        }),
      );

      enriched.sort((a, b) => {
        if (a.lockedCount !== b.lockedCount) return b.lockedCount - a.lockedCount;
        return a.name.localeCompare(b.name);
      });

      setRows(enriched);
    } catch (err: any) {
      setError(err.message || 'Failed to load');
    }
    setLoading(false);
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        (r.contactEmail || '').toLowerCase().includes(q) ||
        (r.scacCode || '').toLowerCase().includes(q),
    );
  }, [rows, search]);

  const totalLocked = useMemo(() => rows.reduce((sum, r) => sum + r.lockedCount, 0), [rows]);

  if (selected) {
    return (
      <div className="space-y-4">
        <Button variant="outline" size="sm" onClick={() => { setSelected(null); load(tab); }}>
          <ArrowLeft className="h-4 w-4" />
          Back to {tab === 'customers' ? 'customers' : 'carriers'}
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{selected.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage portal logins for this {tab === 'customers' ? 'customer' : 'carrier'}.
          </p>
        </div>
        <Card>
          <CardContent className="p-6">
            {tab === 'customers' ? (
              <CustomerUserManagement customerId={selected.id} customerName={selected.name} />
            ) : (
              <CarrierUserManagement carrierId={selected.id} carrierName={selected.name} />
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Portal users</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage logins for the customer and carrier portals. Pick an entity to add users, change
            roles, reset passwords, or unlock accounts.
          </p>
        </div>
        {totalLocked > 0 && (
          <Badge variant="destructive" className="gap-1">
            <Lock className="h-3 w-3" />
            {totalLocked} locked across {tab}
          </Badge>
        )}
      </div>

      <div className="flex gap-2 border-b border-border">
        <button
          type="button"
          onClick={() => setTab('customers')}
          className={`flex items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
            tab === 'customers'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Building2 className="h-4 w-4" />
          Customers
        </button>
        <button
          type="button"
          onClick={() => setTab('carriers')}
          className={`flex items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
            tab === 'carriers'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Truck className="h-4 w-4" />
          Carriers
        </button>
      </div>

      {error && <Banner variant="error" message={error} />}

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder={`Search ${tab}...`}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-12 text-muted-foreground">
              <Users className="h-10 w-10 opacity-50" />
              <p className="text-sm">
                {search ? (
                  `No ${tab} match "${search}"`
                ) : (
                  <>
                    No {tab} yet.{' '}
                    <Link
                      to={tab === 'customers' ? '/customers' : '/carriers'}
                      className="font-medium text-primary hover:underline"
                    >
                      Create one
                    </Link>{' '}
                    before adding portal users.
                  </>
                )}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>{tab === 'customers' ? 'Contact email' : 'SCAC'}</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead className="text-right">Portal users</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[100px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => (
                  <TableRow
                    key={r.id}
                    className="cursor-pointer"
                    onClick={() => setSelected({ id: r.id, name: r.name })}
                  >
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {tab === 'customers' ? (r.contactEmail || '-') : (r.scacCode || '-')}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {[r.city, r.state].filter(Boolean).join(', ') || '-'}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{r.userCount}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {r.lockedCount > 0 && (
                          <Badge variant="destructive" className="gap-1">
                            <Lock className="h-3 w-3" />
                            {r.lockedCount} locked
                          </Badge>
                        )}
                        {r.inactiveCount > 0 && (
                          <Badge variant="muted">{r.inactiveCount} inactive</Badge>
                        )}
                        {r.lockedCount === 0 && r.inactiveCount === 0 && r.userCount > 0 && (
                          <Badge variant="success">Healthy</Badge>
                        )}
                        {r.userCount === 0 && (
                          <Badge variant="muted">No users</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelected({ id: r.id, name: r.name });
                        }}
                      >
                        Manage
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
