import React, { useEffect, useMemo, useState } from 'react';
import { ShieldCheck, RefreshCw, Loader2, Plus, Pencil, Trash2, Lock } from 'lucide-react';

import { API_URL } from '../api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

interface Role {
  id: string;
  name: string;
  description?: string;
  permissions: string[];
  isSystem: boolean;
  _count?: { users: number };
  createdAt: string;
}

const FULL_ACCESS = '*';

function roleBadgeVariant(name: string): 'info' | 'success' | 'warning' | 'secondary' | 'default' {
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

/** Group the flat catalogue ('shipments:read', ...) by resource prefix. */
function groupCatalogue(perms: string[]): Map<string, string[]> {
  const groups = new Map<string, string[]>();
  for (const perm of perms) {
    if (perm === FULL_ACCESS) continue;
    const resource = perm.split(':')[0];
    groups.set(resource, [...(groups.get(resource) ?? []), perm]);
  }
  return groups;
}

function PermissionToggle({
  label,
  selected,
  implied,
  onToggle,
}: {
  label: string;
  selected: boolean;
  implied: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={selected || implied}
      disabled={implied}
      onClick={onToggle}
      className={cn(
        'rounded-md border px-2 py-1 text-xs transition-colors',
        selected
          ? 'border-primary bg-primary text-primary-foreground'
          : implied
            ? 'border-border bg-muted text-muted-foreground'
            : 'border-border bg-background text-foreground hover:bg-accent hover:text-accent-foreground',
      )}
    >
      {label}
    </button>
  );
}

function PermissionPicker({
  catalogue,
  selected,
  onChange,
}: {
  catalogue: string[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
}) {
  const groups = useMemo(() => groupCatalogue(catalogue), [catalogue]);
  const hasFullAccess = selected.has(FULL_ACCESS);

  const toggle = (perm: string) => {
    const next = new Set(selected);
    if (next.has(perm)) next.delete(perm);
    else next.add(perm);
    onChange(next);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <PermissionToggle
          label="Full access (*)"
          selected={hasFullAccess}
          implied={false}
          onToggle={() => toggle(FULL_ACCESS)}
        />
        <span className="text-xs text-muted-foreground">Grants everything, including future permissions.</span>
      </div>
      <Separator />
      <div className="max-h-72 space-y-3 overflow-y-auto pr-1">
        {Array.from(groups.entries()).map(([resource, perms]) => {
          const wildcard = `${resource}:*`;
          const hasWildcard = selected.has(wildcard);
          return (
            <div key={resource}>
              <div className="mb-1.5 flex items-center gap-2">
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {resource.replace(/_/g, ' ')}
                </span>
                <PermissionToggle
                  label={`all (${wildcard})`}
                  selected={hasWildcard}
                  implied={hasFullAccess}
                  onToggle={() => toggle(wildcard)}
                />
              </div>
              <div className="flex flex-wrap gap-1.5">
                {perms.map(perm => (
                  <PermissionToggle
                    key={perm}
                    label={perm}
                    selected={selected.has(perm)}
                    implied={hasFullAccess || hasWildcard}
                    onToggle={() => toggle(perm)}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface EditorState {
  mode: 'create' | 'edit';
  roleId?: string;
  name: string;
  description: string;
  permissions: Set<string>;
}

export default function VNextRoles() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [catalogue, setCatalogue] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [seeding, setSeeding] = useState(false);
  const [banner, setBanner] = useState<{ variant: 'success' | 'error'; message: string } | null>(null);

  const [editor, setEditor] = useState<EditorState | null>(null);
  const [editorError, setEditorError] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<Role | null>(null);

  const loadRoles = async () => {
    try {
      setLoading(true);
      setError('');
      const [rolesRes, catRes] = await Promise.all([
        fetch(`${API_URL}/api/v1/roles`),
        fetch(`${API_URL}/api/v1/roles/permissions`),
      ]);
      const rolesJson = await rolesRes.json();
      const catJson = await catRes.json();
      if (!rolesRes.ok) throw new Error(rolesJson.error || 'Failed to load roles');
      setRoles(rolesJson.data || []);
      setCatalogue(Object.values(catJson.data || {}) as string[]);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadRoles(); }, []);

  const handleSeedRoles = async () => {
    setSeeding(true);
    setBanner(null);
    try {
      const res = await fetch(`${API_URL}/api/v1/roles/seed`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to seed roles');
      setBanner({ variant: 'success', message: `Created ${json.data.created} roles, updated ${json.data.updated} existing roles` });
      loadRoles();
    } catch (err: any) {
      setBanner({ variant: 'error', message: err.message });
    } finally {
      setSeeding(false);
    }
  };

  const openCreate = () => {
    setEditorError('');
    setEditor({ mode: 'create', name: '', description: '', permissions: new Set() });
  };

  const openEdit = (role: Role) => {
    setEditorError('');
    setEditor({
      mode: 'edit',
      roleId: role.id,
      name: role.name,
      description: role.description || '',
      permissions: new Set(role.permissions),
    });
  };

  const handleSave = async () => {
    if (!editor) return;
    if (editor.mode === 'create' && !editor.name.trim()) {
      setEditorError('Role name is required');
      return;
    }
    if (editor.permissions.size === 0) {
      setEditorError('Select at least one permission');
      return;
    }
    setSaving(true);
    setEditorError('');
    try {
      const payload = {
        ...(editor.mode === 'create' ? { name: editor.name.trim() } : {}),
        description: editor.description.trim() || undefined,
        permissions: Array.from(editor.permissions),
      };
      const res = await fetch(
        editor.mode === 'create'
          ? `${API_URL}/api/v1/roles`
          : `${API_URL}/api/v1/roles/${editor.roleId}`,
        {
          method: editor.mode === 'create' ? 'POST' : 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to save role');
      setBanner({ variant: 'success', message: editor.mode === 'create' ? `Role "${editor.name}" created` : 'Role updated' });
      setEditor(null);
      loadRoles();
    } catch (err: any) {
      setEditorError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/roles/${deleting.id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to delete role');
      setBanner({ variant: 'success', message: `Role "${deleting.name}" deleted` });
      setDeleting(null);
      loadRoles();
    } catch (err: any) {
      setBanner({ variant: 'error', message: err.message });
      setDeleting(null);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Roles and permissions</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage user roles and their associated permissions</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleSeedRoles} disabled={seeding}>
            {seeding ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            {seeding ? 'Seeding...' : 'Seed system roles'}
          </Button>
          <Button variant="gradient" onClick={openCreate}>
            <Plus className="h-4 w-4" />
            New role
          </Button>
        </div>
      </div>

      {error && <Banner variant="error" message={error} />}
      {banner && <Banner variant={banner.variant} message={banner.message} />}

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : roles.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <ShieldCheck className="h-10 w-10 text-muted-foreground" />
            <h3 className="text-lg font-medium">No roles defined</h3>
            <p className="text-sm text-muted-foreground">Seed the system roles, or create a custom role from scratch.</p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleSeedRoles} disabled={seeding}>Seed system roles</Button>
              <Button variant="gradient" onClick={openCreate}>New role</Button>
            </div>
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
                      <Badge variant={roleBadgeVariant(role.name)}>{role.isSystem ? 'System' : 'Custom'}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{role.description || 'No description'}</p>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {role._count?.users ?? 0} user{(role._count?.users ?? 0) !== 1 ? 's' : ''}
                  </div>
                </div>
                <div className="mb-3 flex flex-wrap gap-1">
                  {role.permissions.slice(0, 8).map((p, i) => (
                    <Badge key={i} variant="secondary" className="text-[10px]">{p}</Badge>
                  ))}
                  {role.permissions.length > 8 && (
                    <Badge variant="secondary" className="text-[10px]">
                      +{role.permissions.length - 8} more
                    </Badge>
                  )}
                </div>
                {role.isSystem ? (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Lock className="h-3 w-3" aria-hidden />
                    Managed in code and re-synced on startup
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => openEdit(role)}>
                      <Pencil className="h-3.5 w-3.5" />
                      Edit
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setDeleting(role)}>
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create / edit dialog */}
      <Dialog open={editor !== null} onOpenChange={(open) => { if (!open) setEditor(null); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editor?.mode === 'create' ? 'New role' : `Edit ${editor?.name}`}</DialogTitle>
            <DialogDescription>
              {editor?.mode === 'create'
                ? 'Name the role and pick its permissions. Wildcards cover every action on a resource.'
                : 'Change the description or permissions. The name is fixed once created.'}
            </DialogDescription>
          </DialogHeader>
          {editor && (
            <div className="space-y-4">
              {editor.mode === 'create' && (
                <div className="space-y-1.5">
                  <Label htmlFor="role-name">Name</Label>
                  <Input
                    id="role-name"
                    value={editor.name}
                    onChange={(e) => setEditor({ ...editor, name: e.target.value })}
                    placeholder="e.g. wms-supervisor"
                    maxLength={50}
                  />
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="role-description">Description</Label>
                <Input
                  id="role-description"
                  value={editor.description}
                  onChange={(e) => setEditor({ ...editor, description: e.target.value })}
                  placeholder="What this role is for"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Permissions</Label>
                <PermissionPicker
                  catalogue={catalogue}
                  selected={editor.permissions}
                  onChange={(permissions) => setEditor({ ...editor, permissions })}
                />
              </div>
              {editorError && <Banner variant="error" message={editorError} />}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditor(null)} disabled={saving}>Cancel</Button>
            <Button variant="gradient" onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {editor?.mode === 'create' ? 'Create role' : 'Save changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={deleting !== null} onOpenChange={(open) => { if (!open) setDeleting(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete {deleting?.name}?</DialogTitle>
            <DialogDescription>
              {deleting?._count?.users
                ? `${deleting._count.users} user${deleting._count.users !== 1 ? 's' : ''} currently hold this role and will lose its permissions.`
                : 'No users currently hold this role.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)} disabled={saving}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Delete role
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
