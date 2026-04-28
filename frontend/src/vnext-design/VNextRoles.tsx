import React, { useEffect, useState } from 'react';
import { ShieldCheck, RefreshCw, Loader2 } from 'lucide-react';

import { API_URL } from '../api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface Role {
  id: string;
  name: string;
  description?: string;
  permissions: string[];
  isSystem: boolean;
  _count?: { users: number };
  createdAt: string;
}

function permissionVariant(name: string): 'info' | 'success' | 'warning' | 'secondary' | 'default' {
  if (name === 'admin' || name === 'broker_admin') return 'default';
  if (name.includes('broker')) return 'info';
  if (name === 'finance') return 'success';
  if (name === 'readonly') return 'secondary';
  if (name === 'warehouse') return 'warning';
  return 'secondary';
}

function Banner({ variant, message }: { variant: 'success' | 'error'; message: string }) {
  const tone =
    variant === 'success'
      ? 'border-success/30 bg-success/10 text-success'
      : 'border-destructive/30 bg-destructive/10 text-destructive';
  return <div className={`rounded-md border p-3 text-sm ${tone}`}>{message}</div>;
}

export default function VNextRoles() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [seeding, setSeeding] = useState(false);
  const [seedMessage, setSeedMessage] = useState('');

  const loadRoles = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/api/v1/roles`);
      const json = await res.json();
      setRoles(json.data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadRoles(); }, []);

  const handleSeedRoles = async () => {
    setSeeding(true);
    setSeedMessage('');
    try {
      const res = await fetch(`${API_URL}/api/v1/roles/seed`, { method: 'POST' });
      const json = await res.json();
      if (json.data) {
        setSeedMessage(`Created ${json.data.created} roles, updated ${json.data.updated} existing roles`);
        loadRoles();
      }
    } catch {
      setSeedMessage('Failed to seed roles');
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Roles and permissions</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage user roles and their associated permissions</p>
        </div>
        <Button variant="outline" onClick={handleSeedRoles} disabled={seeding}>
          {seeding ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          {seeding ? 'Seeding...' : 'Seed system roles'}
        </Button>
      </div>

      {error && <Banner variant="error" message={error} />}
      {seedMessage && <Banner variant="success" message={seedMessage} />}

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : roles.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <ShieldCheck className="h-10 w-10 text-muted-foreground" />
            <h3 className="text-lg font-medium">No roles defined</h3>
            <p className="text-sm text-muted-foreground">Click "Seed system roles" to create the default roles.</p>
            <Button variant="gradient" onClick={handleSeedRoles} disabled={seeding}>
              Seed system roles
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {roles.map(role => (
            <Card key={role.id}>
              <CardContent className="p-5">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-base font-semibold">{role.name}</span>
                      <Badge variant={permissionVariant(role.name)}>{role.isSystem ? 'System' : 'Custom'}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{role.description || 'No description'}</p>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {role._count?.users ?? 0} user{(role._count?.users ?? 0) !== 1 ? 's' : ''}
                  </div>
                </div>
                <div className="flex flex-wrap gap-1">
                  {(role.permissions as string[]).slice(0, 8).map((p, i) => (
                    <Badge key={i} variant="secondary" className="text-[10px]">{p}</Badge>
                  ))}
                  {(role.permissions as string[]).length > 8 && (
                    <Badge variant="secondary" className="text-[10px]">
                      +{(role.permissions as string[]).length - 8} more
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
