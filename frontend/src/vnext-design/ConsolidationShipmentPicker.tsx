import React, { useEffect, useState } from 'react';
import { Loader2, Search } from 'lucide-react';

import { API_URL } from '../api';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface Candidate {
  id: string;
  reference: string;
  status: string;
  customerName: string;
  originName: string | null;
  destinationName: string | null;
  pickupDate: string | null;
}

interface Props {
  open: boolean;
  title: string;
  confirmLabel: string;
  onOpenChange: (open: boolean) => void;
  /** Resolves to an error message to show, or null on success. */
  onConfirm: (shipmentIds: string[]) => Promise<string | null>;
}

/** Picks open shipments that aren't on a consolidation yet (#329). */
export default function ConsolidationShipmentPicker({ open, title, confirmLabel, onOpenChange, onConfirm }: Props) {
  const [search, setSearch] = useState('');
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ perPage: '50' });
        if (search.trim()) params.set('search', search.trim());
        const res = await fetch(`${API_URL}/api/v1/consolidations/candidates?${params}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || `Failed to load shipments (${res.status})`);
        setCandidates(json.data || []);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [open, search]);

  useEffect(() => {
    if (!open) { setSelected([]); setError(null); setSearch(''); }
  }, [open]);

  const toggle = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  async function confirm() {
    setSaving(true);
    setError(null);
    const problem = await onConfirm(selected);
    setSaving(false);
    if (problem) setError(problem);
    else onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Draft or ready shipments that aren't on a consolidation. Each keeps its own customer; the run gets every pickup before every drop.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search by shipment reference..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>

        <div className="max-h-80 space-y-1 overflow-y-auto">
          {loading && (
            <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading shipments...
            </div>
          )}
          {!loading && candidates.length === 0 && (
            <p className="p-4 text-sm text-muted-foreground">No shipments available to consolidate.</p>
          )}
          {!loading && candidates.map((c) => (
            <label key={c.id} className="flex cursor-pointer items-start gap-3 rounded-md border p-3 hover:bg-muted/50">
              <Checkbox checked={selected.includes(c.id)} onCheckedChange={() => toggle(c.id)} className="mt-0.5" />
              <div className="min-w-0 flex-1 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{c.reference}</span>
                  <span className="text-xs capitalize text-muted-foreground">{c.status}</span>
                </div>
                <div className="text-muted-foreground">{c.customerName}</div>
                <div className="truncate text-xs text-muted-foreground">
                  {c.originName ?? '—'} → {c.destinationName ?? '—'}
                  {c.pickupDate && ` · picks up ${new Date(c.pickupDate).toLocaleDateString()}`}
                </div>
              </div>
            </label>
          ))}
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={confirm} disabled={selected.length === 0 || saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {confirmLabel}{selected.length > 0 ? ` (${selected.length})` : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
