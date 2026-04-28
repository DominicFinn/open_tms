import React, { useEffect, useState } from 'react';
import { Loader2, KeyRound, Power } from 'lucide-react';

import { API_URL } from '../api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

interface InternalUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  active: boolean;
  authProvider: string | null;
  lastLoginAt: string | null;
  passwordChangedAt: string | null;
  roles: { id: string; name: string }[];
  createdAt: string;
}

function Banner({ variant, message }: { variant: 'success' | 'error'; message: string }) {
  const tone =
    variant === 'success'
      ? 'border-success/30 bg-success/10 text-success'
      : 'border-destructive/30 bg-destructive/10 text-destructive';
  return <div className={`rounded-md border p-3 text-sm ${tone}`}>{message}</div>;
}

export default function VNextUsers() {
  const [users, setUsers] = useState<InternalUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [resetTarget, setResetTarget] = useState<InternalUser | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [resetBusy, setResetBusy] = useState(false);
  const [resetError, setResetError] = useState('');
  const [resetSuccess, setResetSuccess] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/api/v1/users`);
      const json = await res.json();
      if (json.error) setError(json.error);
      else setUsers(json.data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load users');
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function doReset() {
    if (!resetTarget) return;
    setResetBusy(true);
    setResetError('');
    try {
      const res = await fetch(`${API_URL}/api/v1/users/${resetTarget.id}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword }),
      });
      const json = await res.json();
      if (json.error) {
        setResetError(json.error);
      } else {
        setResetSuccess(`Password reset for ${resetTarget.email}. Share the new password securely.`);
        setResetTarget(null);
        setNewPassword('');
        load();
      }
    } catch (err: any) {
      setResetError(err.message || 'Failed to reset password');
    }
    setResetBusy(false);
  }

  async function toggleActive(u: InternalUser) {
    const next = !u.active;
    try {
      await fetch(`${API_URL}/api/v1/users/${u.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: next }),
      });
      load();
    } catch {
      // swallowed - next load will show actual state
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Internal users</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage TMS staff accounts. Reset a password when a user is locked out.
          </p>
        </div>
      </div>

      {error && <Banner variant="error" message={error} />}
      {resetSuccess && <Banner variant="success" message={resetSuccess} />}

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Roles</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last login</TableHead>
                  <TableHead className="w-56">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map(u => (
                  <TableRow key={u.id}>
                    <TableCell>{u.firstName} {u.lastName}</TableCell>
                    <TableCell className="text-muted-foreground">{u.email}</TableCell>
                    <TableCell>
                      {u.roles.length === 0 ? (
                        <span className="text-sm text-muted-foreground">No roles</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {u.roles.map(r => (
                            <Badge key={r.id} variant="info">{r.name}</Badge>
                          ))}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={u.active ? 'success' : 'secondary'}>
                        {u.active ? 'Active' : 'Disabled'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : '-'}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => setResetTarget(u)}>
                          <KeyRound className="h-3 w-3" />
                          Reset password
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => toggleActive(u)}>
                          <Power className="h-3 w-3" />
                          {u.active ? 'Deactivate' : 'Reactivate'}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {users.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">No users.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!resetTarget} onOpenChange={open => !open && setResetTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset password for {resetTarget?.email}</DialogTitle>
            <DialogDescription>
              Choose a temporary password. Share it with the user via a secure channel; they can change it after signing in.
            </DialogDescription>
          </DialogHeader>
          {resetError && <Banner variant="error" message={resetError} />}
          <div className="space-y-2">
            <Label>New password</Label>
            <Input
              type="text"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              placeholder="At least 8 chars, upper/lower/number"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetTarget(null)}>Cancel</Button>
            <Button variant="gradient" onClick={doReset} disabled={resetBusy || newPassword.length < 8}>
              {resetBusy ? 'Resetting...' : 'Reset password'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
