/**
 * The operator's view of every share link issued for a shipment: what each one exposes, how many
 * times it has been opened, and who opened it.
 *
 * Gated on `shipments:share` at the route, and the access log is behind an expander because it
 * carries the email addresses recipients typed in.
 */

import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronRight, Link2, Loader2, Share2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  SHIPMENT_SHARE_SECTIONS,
  SHIPMENT_SHARE_SECTION_LABELS,
  ShipmentShareSection,
} from '@open-tms/shared';
import { API_URL } from '../api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export interface ShareLink {
  id: string;
  shipmentId: string;
  label: string | null;
  sections: string[];
  expiresAt: string;
  revokedAt: string | null;
  accessCount: number;
  lastAccessedAt: string | null;
  createdAt: string;
}

interface ShareAccess {
  id: string;
  email: string;
  outcome: string;
  createdAt: string;
}

const OUTCOME_LABELS: Record<string, string> = {
  granted: 'Opened',
  denied_bad_code: 'Wrong code',
  denied_expired: 'Expired',
  denied_revoked: 'Withdrawn',
  denied_locked: 'Locked out',
};

interface ShipmentShareLinksTabProps {
  shipmentId: string;
  /** Bumped by the parent after a link is issued, to force a reload. */
  refreshKey?: number;
  onShareClick: () => void;
}

export function ShipmentShareLinksTab({
  shipmentId,
  refreshKey,
  onShareClick,
}: ShipmentShareLinksTabProps) {
  const [links, setLinks] = useState<ShareLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [editing, setEditing] = useState<ShareLink | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/v1/shipments/${shipmentId}/share-links`);
      const json = await res.json();
      if (!res.ok || json.error) {
        setError(json.error || 'Could not load share links');
        return;
      }
      setLinks(json.data ?? []);
    } catch {
      setError('Could not load share links');
    } finally {
      setLoading(false);
    }
  }, [shipmentId]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const revoke = async (link: ShareLink) => {
    const res = await fetch(`${API_URL}/api/v1/share-links/${link.id}`, { method: 'DELETE' });
    const json = await res.json();
    if (!res.ok || json.error) {
      toast.error(json.error || 'Could not withdraw the link');
      return;
    }
    toast.success('Link withdrawn');
    load();
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading share links
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="space-y-3 p-6">
          <p className="text-sm text-destructive">{error}</p>
          <Button variant="outline" size="sm" onClick={load}>
            Try again
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Shared links</h3>
          <p className="text-sm text-muted-foreground">
            Public links to this shipment. Each one needs its access code and an email address to
            open.
          </p>
        </div>
        <Button size="sm" onClick={onShareClick}>
          <Share2 className="h-4 w-4" />
          New link
        </Button>
      </div>

      {links.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
            <Link2 className="h-8 w-8 text-muted-foreground" />
            <div>
              <p className="font-medium">No links yet</p>
              <p className="text-sm text-muted-foreground">
                Share this shipment to give a customer or consignee a read-only view.
              </p>
            </div>
            <Button size="sm" onClick={onShareClick}>
              <Share2 className="h-4 w-4" />
              Share shipment
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8" />
                  <TableHead>Note</TableHead>
                  <TableHead>Shows</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Opened</TableHead>
                  <TableHead>Last opened</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {links.map((link) => (
                  <ShareLinkRow
                    key={link.id}
                    link={link}
                    expanded={expanded === link.id}
                    onToggle={() => setExpanded(expanded === link.id ? null : link.id)}
                    onEdit={() => setEditing(link)}
                    onRevoke={() => revoke(link)}
                  />
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {editing && (
        <EditShareLinkDialog
          link={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function ShareLinkRow({
  link,
  expanded,
  onToggle,
  onEdit,
  onRevoke,
}: {
  link: ShareLink;
  expanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onRevoke: () => void;
}) {
  const status = linkStatus(link);

  return (
    <>
      <TableRow>
        <TableCell>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={onToggle}
            aria-label={expanded ? 'Hide access log' : 'Show access log'}
          >
            {expanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </Button>
        </TableCell>
        <TableCell className="font-medium">{link.label || 'Untitled link'}</TableCell>
        <TableCell>
          <div className="flex flex-wrap gap-1">
            {link.sections.map((section) => (
              <Badge key={section} variant="muted">
                {SHIPMENT_SHARE_SECTION_LABELS[section as ShipmentShareSection] ?? section}
              </Badge>
            ))}
          </div>
        </TableCell>
        <TableCell>
          <Badge variant={status.variant}>{status.label}</Badge>
        </TableCell>
        <TableCell className="text-right tabular-nums">{link.accessCount}</TableCell>
        <TableCell className="text-sm text-muted-foreground">
          {link.lastAccessedAt ? new Date(link.lastAccessedAt).toLocaleString() : 'Never'}
        </TableCell>
        <TableCell className="text-right">
          <div className="flex justify-end gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={onEdit}
              disabled={Boolean(link.revokedAt)}
            >
              Edit
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive hover:text-destructive"
              onClick={onRevoke}
              disabled={Boolean(link.revokedAt)}
              aria-label="Withdraw link"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </TableCell>
      </TableRow>
      {expanded && (
        <TableRow>
          <TableCell colSpan={7} className="bg-muted/30">
            <AccessLog shareLinkId={link.id} />
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

function AccessLog({ shareLinkId }: { shareLinkId: string }) {
  const [rows, setRows] = useState<ShareAccess[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_URL}/api/v1/share-links/${shareLinkId}/accesses`);
        const json = await res.json();
        if (cancelled) return;
        if (!res.ok || json.error) {
          setError(json.error || 'Could not load the access log');
          return;
        }
        setRows(json.data ?? []);
      } catch {
        if (!cancelled) setError('Could not load the access log');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [shareLinkId]);

  if (error) return <p className="p-3 text-sm text-destructive">{error}</p>;

  if (!rows) {
    return (
      <div className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading access log
      </div>
    );
  }

  if (rows.length === 0) {
    return <p className="p-3 text-sm text-muted-foreground">Nobody has opened this link yet.</p>;
  }

  return (
    <div className="space-y-1 p-3">
      {rows.map((row) => (
        <div key={row.id} className="flex items-center gap-3 text-sm">
          <span className="w-44 shrink-0 text-muted-foreground">
            {new Date(row.createdAt).toLocaleString()}
          </span>
          <span className="flex-1 truncate">{row.email}</span>
          <Badge variant={row.outcome === 'granted' ? 'success' : 'destructive'}>
            {OUTCOME_LABELS[row.outcome] ?? row.outcome}
          </Badge>
        </div>
      ))}
    </div>
  );
}

function EditShareLinkDialog({
  link,
  onClose,
  onSaved,
}: {
  link: ShareLink;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [sections, setSections] = useState<string[]>(link.sections);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/share-links/${link.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sections }),
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        toast.error(json.error || 'Could not update the link');
        return;
      }
      toast.success('Link updated');
      onSaved();
    } catch {
      toast.error('Could not update the link');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit shared link</DialogTitle>
          <DialogDescription>
            Changes apply straight away, including to anyone with the page already open.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {SHIPMENT_SHARE_SECTIONS.map((section) => (
            <div key={section} className="flex items-center gap-3">
              <Checkbox
                id={`edit-section-${section}`}
                checked={sections.includes(section)}
                onCheckedChange={(checked) =>
                  setSections((current) =>
                    checked === true
                      ? [...current, section]
                      : current.filter((s) => s !== section)
                  )
                }
              />
              <Label htmlFor={`edit-section-${section}`} className="cursor-pointer">
                {SHIPMENT_SHARE_SECTION_LABELS[section]}
              </Label>
            </div>
          ))}
          {sections.length === 0 && (
            <p className="text-xs text-destructive">Pick at least one section to share.</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving || sections.length === 0}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function linkStatus(link: ShareLink): { label: string; variant: 'muted' | 'success' | 'destructive' } {
  if (link.revokedAt) return { label: 'Withdrawn', variant: 'destructive' };
  if (new Date(link.expiresAt).getTime() <= Date.now()) return { label: 'Expired', variant: 'muted' };
  return { label: `Expires ${new Date(link.expiresAt).toLocaleDateString()}`, variant: 'success' };
}
