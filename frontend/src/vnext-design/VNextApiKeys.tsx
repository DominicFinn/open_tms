import React, { useState, useEffect } from 'react';
import {
  KeyRound,
  CheckCircle2,
  Plus,
  Copy,
  X,
  ToggleLeft,
  ToggleRight,
  Trash2,
  Loader2,
} from 'lucide-react';

import { API_URL } from '../api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table';

function Banner({ variant, children, onClose }: { variant: 'success' | 'error'; children: React.ReactNode; onClose?: () => void }) {
  const tone =
    variant === 'success'
      ? 'border-success/30 bg-success/10 text-success'
      : 'border-destructive/30 bg-destructive/10 text-destructive';
  return (
    <div className={`flex items-start justify-between gap-3 rounded-md border p-3 text-sm ${tone}`}>
      <div className="flex-1">{children}</div>
      {onClose && (
        <button onClick={onClose} className="text-xs underline opacity-70 hover:opacity-100">Dismiss</button>
      )}
    </div>
  );
}

export default function VNextApiKeys() {
  const [keys, setKeys] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [newKeyName, setNewKeyName] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [createdKey, setCreatedKey] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadKeys();
  }, []);

  async function loadKeys() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/api/v1/api-keys`);
      if (!res.ok) throw new Error('Failed to load API keys');
      const json = await res.json();
      setKeys(json.data || []);
    } catch (e: any) {
      setError(e.message || 'Failed to load API keys');
    } finally {
      setLoading(false);
    }
  }

  async function createKey() {
    if (!newKeyName.trim()) return;
    setCreating(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/api/v1/api-keys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newKeyName.trim() }),
      });
      if (!res.ok) throw new Error('Failed to create API key');
      const json = await res.json();
      const created = json.data;
      if (created?.key) setCreatedKey(created.key);
      setNewKeyName('');
      setShowCreate(false);
      await loadKeys();
    } catch (e: any) {
      setError(e.message || 'Failed to create API key');
    } finally {
      setCreating(false);
    }
  }

  async function toggleKey(k: any) {
    setError('');
    try {
      const res = await fetch(`${API_URL}/api/v1/api-keys/${k.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !k.active }),
      });
      if (!res.ok) throw new Error('Failed to update API key');
      await loadKeys();
    } catch (e: any) {
      setError(e.message || 'Failed to update API key');
    }
  }

  async function deleteKey(id: string) {
    if (!confirm('Are you sure you want to delete this API key?')) return;
    setError('');
    try {
      const res = await fetch(`${API_URL}/api/v1/api-keys/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete API key');
      await loadKeys();
    } catch (e: any) {
      setError(e.message || 'Failed to delete API key');
    }
  }

  const filtered = keys.filter(k => !search || k.name?.toLowerCase().includes(search.toLowerCase()));
  const activeCount = keys.filter(k => k.active !== false).length;

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">API keys</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage API keys for webhook ingestion and external integrations</p>
        </div>
        <Button variant="gradient" onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4" />
          Create API key
        </Button>
      </div>

      {error && <Banner variant="error" onClose={() => setError('')}>{error}</Banner>}

      {createdKey && (
        <Banner variant="success">
          <div className="space-y-2">
            <div><strong>API key created!</strong> Copy it now - it will not be shown again.</div>
            <div className="flex flex-wrap items-center gap-2">
              <code className="flex-1 break-all rounded bg-muted px-3 py-2 font-mono text-sm">{createdKey}</code>
              <Button variant="outline" size="sm" onClick={() => navigator.clipboard?.writeText(createdKey)}>
                <Copy className="h-4 w-4" />
                Copy
              </Button>
              <Button variant="outline" size="sm" onClick={() => setCreatedKey('')}>
                <X className="h-4 w-4" />
                Dismiss
              </Button>
            </div>
          </div>
        </Banner>
      )}

      {showCreate && (
        <Card>
          <CardHeader>
            <CardTitle>Create new API key</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                value={newKeyName}
                onChange={e => setNewKeyName(e.target.value)}
                placeholder="Key name (e.g. Production Webhook)"
                className="flex-1"
                onKeyDown={e => e.key === 'Enter' && createKey()}
              />
              <Button variant="gradient" onClick={createKey} disabled={creating || !newKeyName.trim()}>
                {creating ? 'Creating...' : 'Create'}
              </Button>
              <Button variant="outline" onClick={() => { setShowCreate(false); setNewKeyName(''); }}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <KeyRound className="h-5 w-5" />
            </div>
            <div>
              <div className="text-2xl font-semibold">{keys.length}</div>
              <div className="text-xs text-muted-foreground">Total keys</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/15 text-success">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <div className="text-2xl font-semibold">{activeCount}</div>
              <div className="text-xs text-muted-foreground">Active</div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Webhook endpoint</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <code className="flex-1 truncate rounded-md border bg-muted px-3 py-2 font-mono text-sm">
              {API_URL}/api/v1/webhooks/inbound
            </code>
            <Button variant="outline" onClick={() => navigator.clipboard?.writeText(`${API_URL}/api/v1/webhooks/inbound`)}>
              <Copy className="h-4 w-4" />
              Copy
            </Button>
          </div>
          <div className="flex flex-wrap gap-6 text-sm text-muted-foreground">
            <div>
              <strong>Header:</strong>{' '}
              <code className="rounded bg-muted px-1.5 py-0.5">X-API-Key: &lt;your-key&gt;</code>
            </div>
            <div>
              <strong>Or:</strong>{' '}
              <code className="rounded bg-muted px-1.5 py-0.5">Authorization: Bearer &lt;your-key&gt;</code>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle>API keys</CardTitle>
          <Input
            placeholder="Search keys..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-56"
          />
        </CardHeader>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
              <KeyRound className="h-8 w-8" />
              <h3 className="text-base font-medium">No API keys found</h3>
              <p className="text-sm">Create an API key to get started with integrations.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Key</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last used</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-24">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(k => (
                  <TableRow key={k.id}>
                    <TableCell className="font-medium">{k.name}</TableCell>
                    <TableCell>
                      <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                        {k.prefix || k.key?.slice(0, 12) || '****'}...
                      </code>
                    </TableCell>
                    <TableCell>
                      <Badge variant={k.active !== false ? 'success' : 'destructive'}>
                        {k.active !== false ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleString() : 'Never'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {k.createdAt ? new Date(k.createdAt).toLocaleDateString() : '-'}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" title={k.active !== false ? 'Deactivate' : 'Activate'} onClick={() => toggleKey(k)}>
                          {k.active !== false ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => deleteKey(k.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
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
