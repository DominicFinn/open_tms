import { useEffect, useState } from 'react';
import { Loader2, Plus } from 'lucide-react';

import { API_URL } from '../../../api';
import { customerFetch } from '../CustomerDashboard';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  active: boolean;
  lastUsedAt: string | null;
  createdAt: string;
}

export default function CustomerApiKeys() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [freshKey, setFreshKey] = useState<{ id: string; key: string } | null>(null);
  const [error, setError] = useState('');

  const load = () => {
    setLoading(true);
    customerFetch(`${API_URL}/api/v1/customer-portal/developer/api-keys`)
      .then(r => r.json())
      .then(json => setKeys(json.data || []))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!newName.trim()) { setError('Name is required'); return; }
    setError(''); setCreating(true);
    try {
      const res = await customerFetch(`${API_URL}/api/v1/customer-portal/developer/api-keys`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim() }),
      });
      const data = await res.json();
      if (data.error) setError(data.error);
      else {
        setFreshKey({ id: data.data.id, key: data.data.key });
        setNewName('');
        setShowCreate(false);
        load();
      }
    } finally { setCreating(false); }
  };

  const handleToggle = async (id: string, active: boolean) => {
    await customerFetch(`${API_URL}/api/v1/customer-portal/developer/api-keys/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !active }),
    });
    load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Revoke this API key? Applications using it will stop working immediately.')) return;
    await customerFetch(`${API_URL}/api/v1/customer-portal/developer/api-keys/${id}`, { method: 'DELETE' });
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">API keys</h1>
          <p className="text-sm text-muted-foreground">Authenticate programmatic access to Open TMS.</p>
        </div>
        <Button variant="gradient" onClick={() => setShowCreate(v => !v)}>
          <Plus className="h-4 w-4" />
          New key
        </Button>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {freshKey && (
        <div className="rounded-md border border-warning/30 bg-warning/10 p-4 text-sm text-warning-foreground">
          <div className="font-semibold">Copy this key now - it will not be shown again.</div>
          <code className="mt-2 block break-all rounded bg-muted px-3 py-2 text-xs text-foreground">
            {freshKey.key}
          </code>
          <div className="mt-3 flex gap-2">
            <Button variant="outline" size="sm" onClick={() => navigator.clipboard.writeText(freshKey.key)}>
              Copy
            </Button>
            <Button variant="outline" size="sm" onClick={() => setFreshKey(null)}>
              I have stored it
            </Button>
          </div>
        </div>
      )}

      {showCreate && (
        <Card>
          <CardHeader>
            <CardTitle>Create API key</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="key-name">Name</Label>
              <Input
                id="key-name"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="e.g. Production ERP integration"
              />
            </div>
            <div className="flex gap-2">
              <Button variant="gradient" onClick={handleCreate} disabled={creating}>
                {creating ? 'Creating...' : 'Create'}
              </Button>
              <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Prefix</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last used</TableHead>
              <TableHead>Created</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center">
                  <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                </TableCell>
              </TableRow>
            )}
            {!loading && keys.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                  No API keys yet. Create one to start using the public API.
                </TableCell>
              </TableRow>
            )}
            {keys.map(k => (
              <TableRow key={k.id}>
                <TableCell className="font-semibold">{k.name}</TableCell>
                <TableCell>
                  <code className="rounded bg-muted px-1 py-0.5 text-xs">{k.keyPrefix}...</code>
                </TableCell>
                <TableCell>
                  <Badge variant={k.active ? 'success' : 'secondary'}>
                    {k.active ? 'Active' : 'Disabled'}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleString() : 'never'}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {new Date(k.createdAt).toLocaleDateString()}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={() => handleToggle(k.id, k.active)}>
                      {k.active ? 'Disable' : 'Enable'}
                    </Button>
                    <Button variant="outline" size="sm" className="text-destructive" onClick={() => handleDelete(k.id)}>
                      Revoke
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
