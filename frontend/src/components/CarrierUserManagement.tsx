import React, { useEffect, useState } from 'react';
import { KeyRound, Loader2, Lock, LockOpen, Plus, UserCog, Users, UserX } from 'lucide-react';

import { API_URL } from '../api';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface LockoutStatus {
  isLocked: boolean;
  lockedUntil: string | null;
  failedAttempts: number;
}

interface CarrierUser {
  id: string;
  carrierId: string;
  email: string;
  name: string;
  role: string;
  active: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  lockoutStatus?: LockoutStatus;
}

interface Props {
  carrierId: string;
  carrierName: string;
}

export default function CarrierUserManagement({ carrierId, carrierName }: Props) {
  const [users, setUsers] = useState<CarrierUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState('dispatcher');

  const [resetPassword, setResetPassword] = useState('');

  useEffect(() => {
    fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carrierId]);

  async function fetchUsers() {
    setLoading(true);
    const res = await fetch(`${API_URL}/api/v1/carriers/${carrierId}/users`);
    const json = await res.json();
    setUsers(json.data || []);
    setLoading(false);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');

    const res = await fetch(`${API_URL}/api/v1/carriers/${carrierId}/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: newEmail, name: newName, password: newPassword, role: newRole }),
    });
    const json = await res.json();

    if (json.error) {
      setError(json.error);
    } else {
      setSuccess(`User ${newEmail} created successfully`);
      setShowCreate(false);
      setNewEmail('');
      setNewName('');
      setNewPassword('');
      setNewRole('dispatcher');
      await fetchUsers();
    }
  }

  async function handleToggleActive(user: CarrierUser) {
    const res = await fetch(`${API_URL}/api/v1/carriers/${carrierId}/users/${user.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !user.active }),
    });
    const json = await res.json();
    if (!json.error) {
      setSuccess(`User ${user.email} ${user.active ? 'deactivated' : 'activated'}`);
      await fetchUsers();
    }
  }

  async function handleResetPassword(userId: string) {
    setError('');
    setSuccess('');

    const res = await fetch(`${API_URL}/api/v1/carriers/${carrierId}/users/${userId}/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newPassword: resetPassword }),
    });
    const json = await res.json();

    if (json.error) {
      setError(json.error);
    } else {
      setSuccess('Password reset successfully');
      setShowResetPassword(null);
      setResetPassword('');
      await fetchUsers();
    }
  }

  async function handleUnlock(user: CarrierUser) {
    setError('');
    setSuccess('');
    const res = await fetch(`${API_URL}/api/v1/carriers/${carrierId}/users/${user.id}/unlock`, {
      method: 'POST',
    });
    const json = await res.json();
    if (json.error) {
      setError(json.error);
    } else {
      setSuccess(`Cleared lockout for ${user.email}`);
      await fetchUsers();
    }
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="m-0 flex items-center gap-2 text-lg font-semibold">
          <Users className="h-5 w-5" />
          Portal users
        </h3>
        <Button size="sm" onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4" />
          Add user
        </Button>
      </div>

      {error && (
        <div className="mb-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-3 rounded-md border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">
          {success}
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center gap-3 py-12 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span className="text-sm">Loading...</span>
        </div>
      ) : users.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-12 text-muted-foreground">
          <UserX className="h-10 w-10 opacity-50" />
          <p className="max-w-md text-center text-sm">
            No portal users yet. Create one so the carrier can log in and respond to tenders.
          </p>
        </div>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last login</TableHead>
                <TableHead className="w-[120px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map(u => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.name}</TableCell>
                  <TableCell>{u.email}</TableCell>
                  <TableCell>
                    <Badge variant={u.role === 'admin' ? 'default' : 'muted'}>{u.role}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap items-center gap-1">
                      <Badge variant={u.active ? 'success' : 'destructive'}>
                        {u.active ? 'Active' : 'Inactive'}
                      </Badge>
                      {u.lockoutStatus?.isLocked && (
                        <Badge variant="destructive" className="gap-1">
                          <Lock className="h-3 w-3" />
                          Locked
                        </Badge>
                      )}
                      {!u.lockoutStatus?.isLocked && (u.lockoutStatus?.failedAttempts ?? 0) > 0 && (
                        <Badge variant="warning" title={`${u.lockoutStatus?.failedAttempts} failed attempt(s) since last success`}>
                          {u.lockoutStatus?.failedAttempts} failed
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : 'Never'}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {u.lockoutStatus?.isLocked && (
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Unlock account"
                          onClick={() => handleUnlock(u)}
                        >
                          <LockOpen className="h-4 w-4 text-success" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        title={u.active ? 'Deactivate' : 'Activate'}
                        onClick={() => handleToggleActive(u)}
                      >
                        <UserCog className={u.active ? 'h-4 w-4 text-destructive' : 'h-4 w-4 text-success'} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Reset password"
                        onClick={() => {
                          setShowResetPassword(u.id);
                          setResetPassword('');
                          setError('');
                        }}
                      >
                        <KeyRound className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create portal user</DialogTitle>
            <DialogDescription>
              Create a login for <strong>{carrierName}</strong> so they can access the carrier portal
              and respond to tenders.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cu-name">Full name *</Label>
              <Input
                id="cu-name"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                required
                placeholder="John Doe"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cu-email">Email *</Label>
              <Input
                id="cu-email"
                type="email"
                value={newEmail}
                onChange={e => setNewEmail(e.target.value)}
                required
                placeholder="user@carrier.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cu-password">Password *</Label>
              <Input
                id="cu-password"
                type="password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                required
                minLength={8}
                placeholder="Min 8 chars, upper, lower, number"
              />
              <p className="text-xs text-muted-foreground">
                Must contain uppercase, lowercase, and a number
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cu-role">Role</Label>
              <Select value={newRole} onValueChange={setNewRole}>
                <SelectTrigger id="cu-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="dispatcher">Dispatcher</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="gradient">Create user</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={showResetPassword !== null} onOpenChange={open => !open && setShowResetPassword(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reset password</DialogTitle>
            <DialogDescription>
              Set a new password for <strong>{users.find(u => u.id === showResetPassword)?.email}</strong>
            </DialogDescription>
          </DialogHeader>
          {error && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="cu-reset">New password</Label>
            <Input
              id="cu-reset"
              type="password"
              value={resetPassword}
              onChange={e => setResetPassword(e.target.value)}
              minLength={8}
              placeholder="Min 8 chars, upper, lower, number"
            />
            <p className="text-xs text-muted-foreground">
              Must contain uppercase, lowercase, and a number
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowResetPassword(null)}>
              Cancel
            </Button>
            <Button
              variant="gradient"
              onClick={() => showResetPassword && handleResetPassword(showResetPassword)}
              disabled={resetPassword.length < 8}
            >
              Reset password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
