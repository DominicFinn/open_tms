import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircle2,
  CircleAlert,
  FileText,
  Grid3x3,
  List as ListIcon,
  Loader2,
  Mail,
  Plus,
  Search,
  SearchX,
  Truck,
  Users,
} from 'lucide-react';

import { API_URL } from '../api';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
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

interface Customer {
  id: string;
  name: string;
  contactEmail: string | null;
  archived: boolean;
  _count?: { shipments: number; orders: number };
}

export default function VNextCustomers() {
  const navigate = useNavigate();
  const { hasPermission } = useCurrentUser();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');

  useEffect(() => {
    async function fetchCustomers() {
      try {
        const res = await fetch(`${API_URL}/api/v1/customers`);
        if (!res.ok) throw new Error(`Failed to fetch customers (${res.status})`);
        const json = await res.json();
        setCustomers(json.data || []);
      } catch (err: any) {
        setError(err.message || 'Failed to load customers');
      } finally {
        setLoading(false);
      }
    }
    fetchCustomers();
  }, []);

  const stats = {
    total: customers.length,
    active: customers.filter(c => !c.archived).length,
    totalShipments: customers.reduce((s, c) => s + (c._count?.shipments || 0), 0),
    totalOrders: customers.reduce((s, c) => s + (c._count?.orders || 0), 0),
  };

  const filtered = customers.filter(c => {
    if (statusFilter === 'active' && c.archived) return false;
    if (statusFilter === 'inactive' && !c.archived) return false;
    if (search) {
      const q = search.toLowerCase();
      return c.name.toLowerCase().includes(q) || (c.contactEmail || '').toLowerCase().includes(q);
    }
    return true;
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

  const statTiles = [
    { label: 'Total customers', value: stats.total, icon: Users, tone: 'bg-primary/10 text-primary' },
    { label: 'Active', value: stats.active, icon: CheckCircle2, tone: 'bg-success/15 text-success' },
    { label: 'Total shipments', value: stats.totalShipments, icon: Truck, tone: 'bg-info/15 text-info' },
    { label: 'Total orders', value: stats.totalOrders, icon: FileText, tone: 'bg-warning/15 text-warning' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Customers</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {customers.length} customers in your account
          </p>
        </div>
        {hasPermission('customers:write') && (
          <Button variant="gradient" onClick={() => navigate('/customers/create')}>
            <Plus className="h-4 w-4" />
            New customer
          </Button>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {statTiles.map(stat => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label}>
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

      <Card>
        <div className="flex flex-wrap items-center gap-3 p-4">
          <div className="relative min-w-[280px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by name, contact, or email..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses ({stats.total})</SelectItem>
              <SelectItem value="active">Active ({stats.active})</SelectItem>
              <SelectItem value="inactive">Inactive ({customers.filter(c => c.archived).length})</SelectItem>
            </SelectContent>
          </Select>
          <div className="ml-auto inline-flex rounded-md border border-input">
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
        </div>
      </Card>

      {viewMode === 'cards' ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map(c => (
            <Card key={c.id} className="cursor-pointer transition-colors hover:border-primary/40">
              <div className="p-5">
                <div className="mb-4 flex items-start gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-gradient text-base font-bold text-white">
                    {c.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-base font-semibold">{c.name}</span>
                      <Badge variant={c.archived ? 'destructive' : 'success'}>
                        {c.archived ? 'Inactive' : 'Active'}
                      </Badge>
                    </div>
                    <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                      <Mail className="h-3.5 w-3.5" />
                      {c.contactEmail || '-'}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 border-t border-border pt-3">
                  <div>
                    <div className="text-xs text-muted-foreground">Shipments</div>
                    <div className="text-sm font-semibold">{c._count?.shipments ?? 0}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Orders</div>
                    <div className="text-sm font-semibold">{c._count?.orders ?? 0}</div>
                  </div>
                </div>
              </div>
            </Card>
          ))}
          {filtered.length === 0 && (
            <Card className="col-span-full">
              <div className="flex flex-col items-center gap-3 py-12 text-muted-foreground">
                <SearchX className="h-8 w-8" />
                <h3 className="text-base font-medium">No customers found</h3>
                <p className="text-sm">Try adjusting your search or filters</p>
              </div>
            </Card>
          )}
        </div>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Shipments</TableHead>
                <TableHead>Orders</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(c => (
                <TableRow key={c.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-gradient text-sm font-bold text-white">
                        {c.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-semibold">{c.name}</div>
                        <div className="text-xs text-muted-foreground">{c.id}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{c.contactEmail || '-'}</TableCell>
                  <TableCell className="text-sm font-semibold">{c._count?.shipments ?? 0}</TableCell>
                  <TableCell className="text-sm font-semibold text-primary">{c._count?.orders ?? 0}</TableCell>
                  <TableCell>
                    <Badge variant={c.archived ? 'destructive' : 'success'}>
                      {c.archived ? 'Inactive' : 'Active'}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5}>
                    <div className="flex flex-col items-center gap-3 py-12 text-muted-foreground">
                      <SearchX className="h-8 w-8" />
                      <h3 className="text-base font-medium">No customers found</h3>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
