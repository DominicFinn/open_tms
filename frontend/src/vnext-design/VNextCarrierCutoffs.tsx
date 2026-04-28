import { useEffect, useState } from 'react';
import { CircleAlert, Loader2, Plus } from 'lucide-react';

import { API_URL } from '../api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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

interface Carrier { id: string; name: string; }
interface Cutoff {
  id: string;
  carrierId: string;
  locationId: string | null;
  dayOfWeek: number;
  cutoffLocalTime: string;
  timezone: string;
  serviceLevel: string | null;
  notes: string | null;
  active: boolean;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function VNextCarrierCutoffs() {
  const [carriers, setCarriers] = useState<Carrier[]>([]);
  const [selectedCarrier, setSelectedCarrier] = useState('');
  const [cutoffs, setCutoffs] = useState<Cutoff[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ dayOfWeek: 1, cutoffLocalTime: '16:30', timezone: 'UTC', serviceLevel: '', notes: '' });
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`${API_URL}/api/v1/carriers`).then(r => r.json()).then(json => setCarriers(json.data || []));
  }, []);

  const loadCutoffs = (id: string) => {
    setLoading(true);
    fetch(`${API_URL}/api/v1/carriers/${id}/cutoffs`)
      .then(r => r.json())
      .then(json => setCutoffs(json.data || []))
      .finally(() => setLoading(false));
  };

  useEffect(() => { if (selectedCarrier) loadCutoffs(selectedCarrier); else setCutoffs([]); }, [selectedCarrier]);

  const handleCreate = async () => {
    if (!selectedCarrier) return;
    setError('');
    const res = await fetch(`${API_URL}/api/v1/carriers/${selectedCarrier}/cutoffs`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dayOfWeek: form.dayOfWeek,
        cutoffLocalTime: form.cutoffLocalTime,
        timezone: form.timezone,
        serviceLevel: form.serviceLevel || undefined,
        notes: form.notes || undefined,
      }),
    });
    const data = await res.json();
    if (data.error) setError(data.error);
    else { setShowCreate(false); loadCutoffs(selectedCarrier); }
  };

  const handleToggle = async (c: Cutoff) => {
    await fetch(`${API_URL}/api/v1/carrier-cutoffs/${c.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !c.active }),
    });
    loadCutoffs(selectedCarrier);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this cutoff row?')) return;
    await fetch(`${API_URL}/api/v1/carrier-cutoffs/${id}`, { method: 'DELETE' });
    loadCutoffs(selectedCarrier);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Carrier Cutoffs</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure the latest handoff time per day for each carrier. The cutoff monitor compares projected warehouse-ready time against these rows and raises an issue when shipments are at risk.
        </p>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-center gap-2 p-4">
          <Select value={selectedCarrier} onValueChange={setSelectedCarrier}>
            <SelectTrigger className="w-[260px]">
              <SelectValue placeholder="Select a carrier..." />
            </SelectTrigger>
            <SelectContent>
              {carriers.map(c => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedCarrier && (
            <Button variant="gradient" className="ml-auto" onClick={() => setShowCreate(v => !v)}>
              <Plus className="h-4 w-4" />
              New cutoff
            </Button>
          )}
        </CardContent>
      </Card>

      {error && (
        <div className="flex items-center gap-3 rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          <CircleAlert className="h-5 w-5" />
          {error}
        </div>
      )}

      {selectedCarrier && showCreate && (
        <Card>
          <CardHeader>
            <CardTitle>New cutoff row</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Day of week</Label>
                <Select value={String(form.dayOfWeek)} onValueChange={v => setForm(f => ({ ...f, dayOfWeek: parseInt(v) }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DAYS.map((d, i) => (
                      <SelectItem key={i} value={String(i)}>{d}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Cutoff time (HH:mm, local)</Label>
                <Input value={form.cutoffLocalTime} onChange={e => setForm(f => ({ ...f, cutoffLocalTime: e.target.value }))} placeholder="16:30" />
              </div>
              <div className="space-y-2">
                <Label>Timezone (IANA)</Label>
                <Input value={form.timezone} onChange={e => setForm(f => ({ ...f, timezone: e.target.value }))} placeholder="America/New_York" />
              </div>
              <div className="space-y-2">
                <Label>Service level (optional)</Label>
                <Input value={form.serviceLevel} onChange={e => setForm(f => ({ ...f, serviceLevel: e.target.value }))} placeholder="ground" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
            <div className="flex gap-2">
              <Button variant="gradient" onClick={handleCreate}>Create</Button>
              <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {selectedCarrier && (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Day</TableHead>
                <TableHead>Cutoff</TableHead>
                <TableHead>Timezone</TableHead>
                <TableHead>Service</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow>
                  <TableCell colSpan={7} className="py-12 text-center">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                  </TableCell>
                </TableRow>
              )}
              {!loading && cutoffs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-12 text-center text-sm text-muted-foreground">
                    No cutoff rows configured for this carrier.
                  </TableCell>
                </TableRow>
              )}
              {cutoffs.map(c => (
                <TableRow key={c.id}>
                  <TableCell className="font-semibold">{DAYS[c.dayOfWeek]}</TableCell>
                  <TableCell><code className="text-xs">{c.cutoffLocalTime}</code></TableCell>
                  <TableCell>{c.timezone}</TableCell>
                  <TableCell>{c.serviceLevel ?? '-'}</TableCell>
                  <TableCell>
                    <Badge variant={c.active ? 'success' : 'muted'}>{c.active ? 'Active' : 'Disabled'}</Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{c.notes ?? ''}</TableCell>
                  <TableCell className="text-right">
                    <div className="inline-flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => handleToggle(c)}>{c.active ? 'Disable' : 'Enable'}</Button>
                      <Button variant="outline" size="sm" className="text-destructive" onClick={() => handleDelete(c.id)}>Delete</Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
