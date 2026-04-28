import React, { useState, useEffect, useCallback } from 'react';
import { CheckCircle2, CircleAlert, Plus, Search, Trash2 } from 'lucide-react';

import { API_URL } from '../api';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface Transaction {
  id: string;
  transactionType: string;
  direction: string;
  enabled: boolean;
  autoProcess: boolean;
  ack997Required: boolean;
}

interface TradingPartner {
  id: string;
  name: string;
  active: boolean;
  entityType: string;
  customerId?: string;
  carrierId?: string;
  customer?: { id: string; name: string } | null;
  carrier?: { id: string; name: string } | null;
  sftpHost?: string;
  sftpPort?: number;
  sftpUsername?: string;
  httpUrl?: string;
  senderId?: string;
  receiverId?: string;
  inboundEnabled: boolean;
  inboundDir?: string;
  inboundFilePattern?: string;
  pollingInterval?: number;
  lastPolledAt?: string;
  outboundEnabled: boolean;
  outboundTransport?: string;
  outboundDir?: string;
  outboundFileNaming?: string;
  transactions: Transaction[];
  createdAt: string;
}

interface FormData {
  name: string;
  entityType: string;
  customerId: string;
  carrierId: string;
  sftpHost: string;
  sftpPort: number;
  sftpUsername: string;
  sftpPassword: string;
  httpUrl: string;
  httpAuthType: string;
  httpAuthValue: string;
  senderId: string;
  receiverId: string;
  inboundEnabled: boolean;
  inboundDir: string;
  inboundFilePattern: string;
  pollingInterval: number;
  outboundEnabled: boolean;
  outboundTransport: string;
  outboundDir: string;
  outboundFileNaming: string;
}

const EMPTY_FORM: FormData = {
  name: '', entityType: 'carrier', customerId: '', carrierId: '',
  sftpHost: '', sftpPort: 22, sftpUsername: '', sftpPassword: '',
  httpUrl: '', httpAuthType: '', httpAuthValue: '',
  senderId: '', receiverId: '',
  inboundEnabled: false, inboundDir: '/', inboundFilePattern: '*.edi,*.x12', pollingInterval: 900,
  outboundEnabled: false, outboundTransport: 'sftp', outboundDir: '', outboundFileNaming: 'reference',
};

const ENTITY_TYPES = ['customer', 'carrier', '3pl', 'warehouse', 'erp', 'other'];
const ALL_TXN_TYPES = [
  { code: '850', name: 'Purchase Order', directions: ['inbound'] },
  { code: '856', name: 'Ship Notice', directions: ['outbound'] },
  { code: '204', name: 'Load Tender', directions: ['outbound'] },
  { code: '990', name: 'Tender Response', directions: ['inbound'] },
  { code: '997', name: 'Func. Ack', directions: ['inbound', 'outbound'] },
  { code: '214', name: 'Status', directions: ['inbound', 'outbound'] },
  { code: '210', name: 'Freight Invoice', directions: ['inbound'] },
  { code: '810', name: 'Invoice', directions: ['outbound'] },
  { code: '820', name: 'Payment', directions: ['inbound'] },
];

export default function VNextTradingPartners() {
  const [partners, setPartners] = useState<TradingPartner[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [typeFilter, setTypeFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [connTestResult, setConnTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [connTestLoading, setConnTestLoading] = useState(false);

  const fetchPartners = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (typeFilter !== 'all') params.set('entityType', typeFilter);
      const res = await fetch(`${API_URL}/api/v1/trading-partners?${params}`);
      const json = await res.json();
      setPartners(json.data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [typeFilter]);

  useEffect(() => { fetchPartners(); }, [fetchPartners]);

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setShowForm(true);
  };

  const openEdit = (p: TradingPartner) => {
    setForm({
      name: p.name,
      entityType: p.entityType,
      customerId: p.customerId || '',
      carrierId: p.carrierId || '',
      sftpHost: p.sftpHost || '',
      sftpPort: p.sftpPort || 22,
      sftpUsername: p.sftpUsername || '',
      sftpPassword: '',
      httpUrl: p.httpUrl || '',
      httpAuthType: '',
      httpAuthValue: '',
      senderId: p.senderId || '',
      receiverId: p.receiverId || '',
      inboundEnabled: p.inboundEnabled,
      inboundDir: p.inboundDir || '/',
      inboundFilePattern: p.inboundFilePattern || '*.edi,*.x12',
      pollingInterval: p.pollingInterval || 900,
      outboundEnabled: p.outboundEnabled,
      outboundTransport: p.outboundTransport || 'sftp',
      outboundDir: p.outboundDir || '',
      outboundFileNaming: p.outboundFileNaming || 'reference',
    });
    setEditingId(p.id);
    setShowForm(true);
  };

  const savePartner = async () => {
    const body: any = { ...form };
    if (!body.customerId) delete body.customerId;
    if (!body.carrierId) delete body.carrierId;
    if (!body.sftpPassword) delete body.sftpPassword;
    if (!body.httpUrl) delete body.httpUrl;
    if (!body.httpAuthType) delete body.httpAuthType;
    if (!body.httpAuthValue) delete body.httpAuthValue;

    const url = editingId
      ? `${API_URL}/api/v1/trading-partners/${editingId}`
      : `${API_URL}/api/v1/trading-partners`;
    const method = editingId ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (json.error) {
      setError(json.error);
      return;
    }
    setShowForm(false);
    fetchPartners();
  };

  const testConnection = async (partnerId: string) => {
    setConnTestLoading(true);
    setConnTestResult(null);
    try {
      const res = await fetch(`${API_URL}/api/v1/trading-partners/${partnerId}/test-connection`, { method: 'POST' });
      const json = await res.json();
      if (json.error) {
        setConnTestResult({ success: false, message: json.error });
      } else {
        const sftp = json.data?.sftp;
        const http = json.data?.http;
        if (sftp?.success) {
          setConnTestResult({ success: true, message: `SFTP connected to ${sftp.host}. Files: ${sftp.sampleFiles?.join(', ') || 'none visible'}` });
        } else if (http?.success) {
          setConnTestResult({ success: true, message: `HTTP OK (${http.statusCode}) at ${http.url}` });
        } else {
          setConnTestResult({ success: false, message: sftp?.error || http?.error || 'Connection failed' });
        }
      }
    } catch (err: any) {
      setConnTestResult({ success: false, message: err.message });
    } finally {
      setConnTestLoading(false);
    }
  };

  const [newTxnType, setNewTxnType] = useState('850');
  const [newTxnDirection, setNewTxnDirection] = useState('inbound');

  const addTransaction = async (partnerId: string) => {
    await fetch(`${API_URL}/api/v1/trading-partners/${partnerId}/transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transactionType: newTxnType, direction: newTxnDirection, enabled: true, autoProcess: true, ack997Required: true }),
    });
    fetchPartners();
    setNewTxnType('850');
    setNewTxnDirection('inbound');
  };

  const removeTransaction = async (partnerId: string, txnId: string) => {
    await fetch(`${API_URL}/api/v1/trading-partners/${partnerId}/transactions/${txnId}`, { method: 'DELETE' });
    fetchPartners();
  };

  const filtered = partners.filter(p =>
    !search || p.name.toLowerCase().includes(search.toLowerCase())
  );

  const getDirectionBadges = (p: TradingPartner) => {
    const badges = [];
    if (p.inboundEnabled) badges.push('IN');
    if (p.outboundEnabled) badges.push('OUT');
    return badges;
  };

  const editingPartner = editingId ? partners.find(p => p.id === editingId) : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Trading partners</h1>
          <p className="mt-1 text-sm text-muted-foreground">{partners.length} partners</p>
        </div>
        <Button variant="gradient" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Add partner
        </Button>
      </div>

      {error && (
        <div className="flex items-center gap-3 rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          <CircleAlert className="h-5 w-5" />
          {error}
        </div>
      )}

      <Card>
        <div className="flex flex-wrap items-center gap-3 p-4">
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {ENTITY_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="relative min-w-[240px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by name..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        <Separator />

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Linked to</TableHead>
              <TableHead>Directions</TableHead>
              <TableHead>Transactions</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last polled</TableHead>
              <TableHead className="w-[80px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={8} className="py-8 text-center text-muted-foreground">Loading...</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="py-8 text-center text-muted-foreground">No trading partners found</TableCell></TableRow>
            ) : filtered.map(p => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">{p.name}</TableCell>
                <TableCell><Badge variant="muted">{p.entityType}</Badge></TableCell>
                <TableCell className="text-sm text-muted-foreground">{p.customer?.name || p.carrier?.name || '-'}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    {getDirectionBadges(p).map(b => <Badge key={b} variant="info">{b}</Badge>)}
                  </div>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {p.transactions.filter(t => t.enabled).map(t => t.transactionType).join(', ') || 'None'}
                </TableCell>
                <TableCell>
                  <Badge variant={p.active ? 'success' : 'secondary'}>{p.active ? 'Active' : 'Inactive'}</Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {p.lastPolledAt ? new Date(p.lastPolledAt).toLocaleString() : 'Never'}
                </TableCell>
                <TableCell>
                  <Button size="sm" variant="outline" onClick={() => openEdit(p)}>Edit</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit' : 'New'} trading partner</DialogTitle>
          </DialogHeader>
          <div className="space-y-6">
            <div className="space-y-3">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="md:col-span-2 space-y-2">
                  <Label>Name</Label>
                  <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Entity type</Label>
                  <Select value={form.entityType} onValueChange={v => setForm({ ...form, entityType: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ENTITY_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Sender ID (ISA)</Label>
                  <Input value={form.senderId} onChange={e => setForm({ ...form, senderId: e.target.value })} placeholder="ISA06" />
                </div>
                <div className="space-y-2">
                  <Label>Receiver ID (ISA)</Label>
                  <Input value={form.receiverId} onChange={e => setForm({ ...form, receiverId: e.target.value })} placeholder="ISA08" />
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-base font-semibold">SFTP connection</h3>
              <div className="grid gap-3 md:grid-cols-3">
                <div className="md:col-span-2 space-y-2">
                  <Label>Host</Label>
                  <Input value={form.sftpHost} onChange={e => setForm({ ...form, sftpHost: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Port</Label>
                  <Input type="number" value={form.sftpPort} onChange={e => setForm({ ...form, sftpPort: parseInt(e.target.value) || 22 })} />
                </div>
                <div className="space-y-2">
                  <Label>Username</Label>
                  <Input value={form.sftpUsername} onChange={e => setForm({ ...form, sftpUsername: e.target.value })} />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Password</Label>
                  <Input type="password" value={form.sftpPassword} onChange={e => setForm({ ...form, sftpPassword: e.target.value })} placeholder={editingId ? '(unchanged)' : ''} />
                </div>
              </div>

              {editingId && (
                <div className="space-y-2">
                  <Button variant="outline" size="sm" onClick={() => testConnection(editingId)} disabled={connTestLoading}>
                    {connTestLoading ? 'Testing...' : 'Test connection'}
                  </Button>
                  {connTestResult && (
                    <div className={
                      connTestResult.success
                        ? 'flex items-center gap-2 rounded-md border border-success/30 bg-success/10 p-3 text-sm text-success'
                        : 'flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive'
                    }>
                      {connTestResult.success ? <CheckCircle2 className="h-4 w-4" /> : <CircleAlert className="h-4 w-4" />}
                      {connTestResult.message}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-3">
              <h3 className="text-base font-semibold">Inbound (polling)</h3>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.inboundEnabled} onChange={e => setForm({ ...form, inboundEnabled: e.target.checked })} />
                Enable inbound polling
              </label>
              {form.inboundEnabled && (
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label>Directory</Label>
                    <Input value={form.inboundDir} onChange={e => setForm({ ...form, inboundDir: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>File pattern</Label>
                    <Input value={form.inboundFilePattern} onChange={e => setForm({ ...form, inboundFilePattern: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Polling interval (sec)</Label>
                    <Input type="number" value={form.pollingInterval} onChange={e => setForm({ ...form, pollingInterval: parseInt(e.target.value) || 900 })} />
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-3">
              <h3 className="text-base font-semibold">Outbound (delivery)</h3>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.outboundEnabled} onChange={e => setForm({ ...form, outboundEnabled: e.target.checked })} />
                Enable outbound delivery
              </label>
              {form.outboundEnabled && (
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label>Transport</Label>
                    <Select value={form.outboundTransport} onValueChange={v => setForm({ ...form, outboundTransport: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sftp">SFTP</SelectItem>
                        <SelectItem value="http">HTTP</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Directory / URL</Label>
                    <Input value={form.outboundDir} onChange={e => setForm({ ...form, outboundDir: e.target.value })}
                      placeholder={form.outboundTransport === 'sftp' ? '/outbound' : 'https://...'} />
                  </div>
                  <div className="space-y-2">
                    <Label>File naming</Label>
                    <Select value={form.outboundFileNaming} onValueChange={v => setForm({ ...form, outboundFileNaming: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="reference">By reference</SelectItem>
                        <SelectItem value="date">By date</SelectItem>
                        <SelectItem value="sequence">By sequence</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </div>

            {editingPartner && (
              <div className="space-y-3">
                <h3 className="text-base font-semibold">Transaction types</h3>
                {editingPartner.transactions.length > 0 && (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Type</TableHead>
                        <TableHead>Direction</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="w-[80px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {editingPartner.transactions.map(t => (
                        <TableRow key={t.id}>
                          <TableCell><strong>{t.transactionType}</strong> - {ALL_TXN_TYPES.find(a => a.code === t.transactionType)?.name || ''}</TableCell>
                          <TableCell>{t.direction}</TableCell>
                          <TableCell><Badge variant={t.enabled ? 'success' : 'secondary'}>{t.enabled ? 'Enabled' : 'Disabled'}</Badge></TableCell>
                          <TableCell>
                            <Button size="sm" variant="destructive" onClick={() => removeTransaction(editingPartner.id, t.id)}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
                <div className="flex flex-wrap gap-2">
                  <Select value={newTxnType} onValueChange={setNewTxnType}>
                    <SelectTrigger className="flex-1 min-w-[200px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ALL_TXN_TYPES.map(t => <SelectItem key={t.code} value={t.code}>{t.code} - {t.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={newTxnDirection} onValueChange={setNewTxnDirection}>
                    <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="inbound">Inbound</SelectItem>
                      <SelectItem value="outbound">Outbound</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button onClick={() => addTransaction(editingPartner.id)}>Add</Button>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button variant="gradient" onClick={savePartner}>{editingId ? 'Save changes' : 'Create partner'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
