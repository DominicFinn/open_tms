/**
 * Manually raise an issue from the Triage Centre.
 *
 * The Issue Engine raises issues from domain events, but an operator also
 * needs to file one by hand — a phone call from a driver, a customer
 * complaint, anything with no detector behind it. A manual issue carries a
 * null `issueType`, which is what distinguishes it from an engine-raised one
 * throughout triage reporting.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, ShoppingCart, Truck, CircleAlert, X } from 'lucide-react';

import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

import { API_URL } from '../../api';
import { createIssue } from './api';

const ENTITY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  shipment: Package,
  order: ShoppingCart,
  carrier: Truck,
};

function entityIcon(type: string) {
  return ENTITY_ICONS[type] ?? Package;
}

interface EntityResult {
  id: string;
  label: string;
  sub: string;
}

/**
 * Typeahead over shipments / orders / carriers.
 *
 * Filters client-side over the existing list endpoints because none of them
 * accept a search param yet. Fine at current data volumes; if these lists grow
 * past a few thousand rows this needs a server-side search endpoint rather
 * than a bigger fetch.
 */
function EntitySearchField({ entityType, value, onSelect }: {
  entityType: string;
  value: string;
  onSelect: (id: string, label: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<EntityResult[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedLabel, setSelectedLabel] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    setQuery('');
    setResults([]);
    setSelectedLabel('');
  }, [entityType]);

  const search = useCallback((q: string) => {
    if (!entityType || q.length < 1) { setResults([]); return; }
    setLoading(true);
    const endpoint =
      entityType === 'shipment' ? 'shipments' : entityType === 'order' ? 'orders' : 'carriers';
    fetch(`${API_URL}/api/v1/${endpoint}`)
      .then((r) => r.json())
      .then((json) => {
        const items = json.data || [];
        const qLower = q.toLowerCase();
        const mapped: EntityResult[] = items
          .map((item: Record<string, any>): EntityResult => {
            if (entityType === 'carrier') {
              return {
                id: item.id,
                label: item.name || item.id.slice(0, 8),
                sub: item.scacCode || '',
              };
            }
            const who = item.customer?.name || item.origin?.name || '';
            return {
              id: item.id,
              label: item.reference || item.id.slice(0, 8),
              sub: [item.status, who].filter(Boolean).join(' - '),
            };
          })
          .filter((r: EntityResult) =>
            r.label.toLowerCase().includes(qLower) ||
            r.sub.toLowerCase().includes(qLower) ||
            r.id.toLowerCase().includes(qLower))
          .slice(0, 10);
        setResults(mapped);
      })
      .catch(() => setResults([]))
      .finally(() => setLoading(false));
  }, [entityType]);

  const handleInputChange = (val: string) => {
    setQuery(val);
    setShowDropdown(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(val), 250);
  };

  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }, []);

  if (!entityType) {
    return <Input disabled placeholder="Select a subject type first" />;
  }

  const Icon = entityIcon(entityType);

  return (
    <div ref={wrapperRef} className="relative">
      {value && selectedLabel ? (
        <div className="flex items-center gap-2 rounded-md border border-input bg-muted px-3 py-2">
          <Icon className="h-4 w-4 text-primary" aria-hidden="true" />
          <span className="flex-1 text-sm font-semibold">{selectedLabel}</span>
          <span className="font-mono text-xs text-muted-foreground">{value.slice(0, 8)}</span>
          <Button
            variant="ghost"
            size="icon"
            type="button"
            aria-label="Clear selection"
            onClick={() => { onSelect('', ''); setSelectedLabel(''); }}
          >
            <X className="h-3 w-3" aria-hidden="true" />
          </Button>
        </div>
      ) : (
        <Input
          placeholder={`Search ${entityType}s by reference, name, or ID...`}
          value={query}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={() => { if (query.length >= 1 || results.length > 0) setShowDropdown(true); }}
        />
      )}
      {showDropdown && (query.length >= 1 || results.length > 0) && (
        <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-60 overflow-y-auto rounded-md border border-border bg-popover shadow-lg">
          {loading && (
            <div className="p-3 text-center text-xs text-muted-foreground">Searching...</div>
          )}
          {!loading && results.length === 0 && query.length >= 1 && (
            <div className="p-3 text-center text-xs text-muted-foreground">No results found</div>
          )}
          {results.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => {
                onSelect(r.id, r.label);
                setSelectedLabel(r.label);
                setQuery('');
                setShowDropdown(false);
              }}
              className="flex w-full items-center gap-2 border-b border-border px-3 py-2 text-left transition-colors last:border-b-0 hover:bg-muted"
            >
              <Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <div className="flex-1">
                <div className="text-sm font-semibold">{r.label}</div>
                {r.sub && <div className="text-xs text-muted-foreground">{r.sub}</div>}
              </div>
              <span className="font-mono text-[10px] text-muted-foreground">{r.id.slice(0, 8)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const EMPTY_FORM = {
  title: '',
  description: '',
  priority: 'medium',
  category: 'exception',
  sourceEntityType: 'shipment',
  sourceEntityId: '',
  assigneeName: '',
};

export function CreateIssueDialog({ open, onClose, onCreated }: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const navigate = useNavigate();
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const update = (field: keyof typeof EMPTY_FORM, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  useEffect(() => {
    if (open) {
      setForm(EMPTY_FORM);
      setError('');
    }
  }, [open]);

  const handleSubmit = async () => {
    if (!form.title.trim()) { setError('Title is required'); return; }
    setSubmitting(true);
    setError('');
    try {
      const result = await createIssue({
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        priority: form.priority,
        category: form.category,
        sourceEntityType: form.sourceEntityId ? form.sourceEntityType : undefined,
        sourceEntityId: form.sourceEntityId || undefined,
        assigneeName: form.assigneeName.trim() || undefined,
        assigneeId: form.assigneeName.trim()
          ? form.assigneeName.trim().toLowerCase().replace(/\s+/g, '.')
          : undefined,
      });
      onClose();
      onCreated();
      if (result?.id) navigate(`/triage/issues/${result.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create issue');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-visible">
        <DialogHeader>
          <DialogTitle>Report issue</DialogTitle>
        </DialogHeader>

        {error && (
          <div className="flex items-center gap-3 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            <CircleAlert className="h-4 w-4" aria-hidden="true" />
            {error}
          </div>
        )}

        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="issue-title">Title *</Label>
            <Input
              id="issue-title"
              placeholder="Brief description of the issue"
              value={form.title}
              onChange={(e) => update('title', e.target.value)}
              autoFocus
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="issue-description">Description</Label>
            <textarea
              id="issue-description"
              rows={3}
              placeholder="Detailed description, context, impact..."
              value={form.description}
              onChange={(e) => update('description', e.target.value)}
              className="w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          <div className="space-y-2">
            <Label>Priority</Label>
            <Select value={form.priority} onValueChange={(v) => update('priority', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Subject type</Label>
            <Select
              value={form.sourceEntityType || 'none'}
              onValueChange={(v) => {
                update('sourceEntityType', v === 'none' ? '' : v);
                update('sourceEntityId', '');
              }}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="shipment">Shipment</SelectItem>
                <SelectItem value="order">Order</SelectItem>
                <SelectItem value="carrier">Carrier</SelectItem>
                <SelectItem value="none">None</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Subject</Label>
            <EntitySearchField
              entityType={form.sourceEntityType}
              value={form.sourceEntityId}
              onSelect={(id) => update('sourceEntityId', id)}
            />
          </div>

          <div className="space-y-2">
            <Label>Category</Label>
            <Select value={form.category} onValueChange={(v) => update('category', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="exception">Exception</SelectItem>
                <SelectItem value="delay">Delay</SelectItem>
                <SelectItem value="damage">Damage</SelectItem>
                <SelectItem value="compliance">Compliance</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="issue-assignee">Assign to</Label>
            <Input
              id="issue-assignee"
              placeholder="Assignee name (optional)"
              value={form.assigneeName}
              onChange={(e) => update('assigneeName', e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Creating...' : 'Create issue'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
