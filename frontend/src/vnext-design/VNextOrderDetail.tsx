import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  Archive,
  ArchiveRestore,
  ArrowLeft,
  Bot,
  Boxes,
  CircleAlert,
  ExternalLink,
  FileText,
  Info,
  Loader2,
  MessageSquare,
  Pencil,
  Trash2,
  User,
  X,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';

import { API_URL } from '../api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
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
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import HandlingUnitsEditor, { HUEditorEndpoints } from '../components/HandlingUnitsEditor';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { NOTE_TAGS } from './VNextCreateShipment';
import { cn } from '@/lib/utils';

type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' | 'info' | 'muted';

interface LineItem {
  id: string;
  sku?: string;
  description?: string;
  quantity?: number;
  weight?: number;
  weightUnit?: string;
  length?: number;
  width?: number;
  height?: number;
  dimUnit?: string;
  unitOfMeasure?: string;
  unitPriceCents?: number;
  totalPriceCents?: number;
  priceCurrency?: string;
  freightClass?: string;
  nmfcCode?: string;
  hazmat?: boolean;
  unNumber?: string;
  hazmatClass?: string;
  packingGroup?: string;
  properShippingName?: string;
  hsCode?: string;
  countryOfOrigin?: string;
  temperature?: string;
  tempMinC?: number;
  tempMaxC?: number;
}

interface TrackableUnit {
  id: string;
  identifier?: string;
  unitType?: string;
  packagingType?: { kind: string; code: string; name: string } | null;
  lineItems: any[];
}

interface OrderShipment {
  shipment: { id: string; reference?: string; status?: string };
}

interface AuditLog {
  id: string;
  action?: string;
  description?: string;
  createdAt?: string;
  userName?: string;
}

interface IssueSummary {
  id: string;
  title: string;
  status: string;
  priority: string;
  category?: string;
}

interface OrderData {
  id: string;
  orderNumber?: string;
  poNumber?: string;
  status: string;
  deliveryStatus?: string;
  importSource?: string;
  customer?: { name: string };
  origin?: { name: string; city: string; state: string };
  destination?: { name: string; city: string; state: string };
  requestedPickupDate?: string;
  requestedDeliveryDate?: string;
  serviceLevel?: string;
  temperatureControl?: boolean;
  requiresHazmat?: boolean;
  specialInstructions?: string;
  notes?: string;
  lineItems: LineItem[];
  trackableUnits: TrackableUnit[];
  orderShipments: OrderShipment[];
  auditLogs: AuditLog[];
  archived?: boolean;
  archivedAt?: string;
  deletedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

// Order.status enum: pending, verified, assigned, issue, cancelled, archived
function statusVariant(status?: string): BadgeVariant {
  const s = status?.toLowerCase().replace(/[_ ]/g, '');
  if (s === 'verified') return 'success';
  if (s === 'pending') return 'warning';
  if (s === 'assigned') return 'info';
  if (s === 'issue') return 'destructive';
  if (s === 'cancelled') return 'destructive';
  if (s === 'archived') return 'secondary';
  return 'secondary';
}

// Order.deliveryStatus: null (not moving yet), in_transit, delivered, exception
function deliveryStatusVariant(status?: string): BadgeVariant {
  const s = status?.toLowerCase().replace(/[_ ]/g, '');
  if (s === 'delivered') return 'success';
  if (s === 'intransit') return 'info';
  if (s === 'exception') return 'destructive';
  return 'secondary';
}

// 'verified' and 'assigned' read as "Available" / "Assigned" — see
// VNextOrders.tsx for the same mapping and the rationale.
const ORDER_STATUS_LABEL: Record<string, string> = {
  pending: 'Pending approval',
  verified: 'Available',
  assigned: 'Assigned',
  issue: 'Needs attention',
  cancelled: 'Cancelled',
  archived: 'Archived',
};
function orderStatusLabel(status?: string): string {
  const s = status?.toLowerCase().replace(/[_ ]/g, '') || '';
  return ORDER_STATUS_LABEL[s] || status || '';
}

const DELIVERY_STATUS_LABEL: Record<string, string> = {
  in_transit: 'In transit',
  delivered: 'Delivered',
  exception: 'Exception',
};
function deliveryStatusLabel(status?: string): string {
  if (!status) return 'Not moving yet';
  return DELIVERY_STATUS_LABEL[status] || status;
}

function issuePriorityVariant(priority?: string): BadgeVariant {
  if (priority === 'critical' || priority === 'high') return 'destructive';
  if (priority === 'medium') return 'warning';
  return 'secondary';
}

function formatDate(d?: string): string {
  if (!d) return '-';
  const date = new Date(d);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDateTime(d?: string): string {
  if (!d) return '-';
  const date = new Date(d);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function InfoItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm">{children}</div>
    </div>
  );
}

// ─── Notes Tab ────────────────────────────────────────────────────────
// Notes are grouped by the same tag taxonomy used on the shipment Notes tab
// (see NOTE_TAGS in VNextCreateShipment.tsx) — a plain note, an "issue" note,
// or an "additional requirement" note. This is distinct from the
// platform-generated Issue Engine exceptions shown on the Issues tab.
const NOTE_GROUPS: {
  key: string;
  label: string;
  Icon: typeof MessageSquare;
  empty: string;
  border: string;
  iconBg: string;
  iconText: string;
}[] = [
  {
    key: 'issue', label: 'Issues', Icon: AlertTriangle, empty: 'No issues noted for this order.',
    border: 'border-l-4 border-l-destructive', iconBg: 'bg-destructive/10', iconText: 'text-destructive',
  },
  {
    key: 'requirement', label: 'Additional requirements', Icon: Info, empty: 'No additional requirements noted.',
    border: 'border-l-4 border-l-info', iconBg: 'bg-info/10', iconText: 'text-info',
  },
  {
    key: '', label: 'Standard notes', Icon: MessageSquare, empty: 'No standard notes yet.',
    border: 'border-l-4 border-l-primary', iconBg: 'bg-primary/10', iconText: 'text-primary',
  },
];

function NotesTab({ orderId }: { orderId: string }) {
  const { user, hasRole } = useCurrentUser();
  const isAdmin = hasRole('admin');
  const currentUserId = user?.id ?? null;

  const [comments, setComments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [noteTag, setNoteTag] = useState(NOTE_TAGS[0].key);
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingDraft, setEditingDraft] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadComments = useCallback(() => {
    fetch(`${API_URL}/api/v1/comments?entityType=order&entityId=${orderId}`)
      .then(r => r.json())
      .then(json => setComments(json.data?.items || json.data || []))
      .catch(() => { })
      .finally(() => setLoading(false));
  }, [orderId]);

  useEffect(() => { loadComments(); }, [loadComments]);

  const handleSubmit = async () => {
    if (!newComment.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entityType: 'order', entityId: orderId, body: newComment, tag: noteTag || undefined }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.error) {
        toast.error(json.error || 'Failed to post comment');
        return;
      }
      setNewComment('');
      setNoteTag(NOTE_TAGS[0].key);
      loadComments();
    } catch {
      toast.error('Failed to post comment');
    } finally {
      setSubmitting(false);
    }
  };

  const beginEdit = (c: any) => {
    setEditingId(c.id);
    setEditingDraft(c.body || '');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingDraft('');
  };

  const saveEdit = async (id: string) => {
    if (!editingDraft.trim()) return;
    setBusyId(id);
    try {
      const res = await fetch(`${API_URL}/api/v1/comments/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: editingDraft }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.error) {
        toast.error(json.error || 'Failed to update comment');
        return;
      }
      cancelEdit();
      loadComments();
    } catch {
      toast.error('Failed to update comment');
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this comment? It will be hidden but kept for audit.')) return;
    setBusyId(id);
    try {
      const res = await fetch(`${API_URL}/api/v1/comments/${id}`, { method: 'DELETE' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.error) {
        toast.error(json.error || 'Failed to delete comment');
        return;
      }
      loadComments();
    } catch {
      toast.error('Failed to delete comment');
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  const renderNote = (c: any) => {
    const isAuthor = !!currentUserId && c.authorId === currentUserId;
    const canEdit = isAuthor && c.authorType !== 'agent';
    const canDelete = (isAuthor || isAdmin) && c.authorType !== 'agent';
    const isEditing = editingId === c.id;
    const busy = busyId === c.id;
    return (
      <div key={c.id} className="group flex gap-3 border-b border-border py-3 last:border-0">
        <div
          className={cn(
            'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white',
            c.authorType === 'agent' ? 'bg-info' : 'bg-primary',
          )}
        >
          {c.authorType === 'agent'
            ? <Bot className="h-4 w-4" />
            : (c.authorName || '?').split(/\s+/).map((w: string) => w[0]).join('').toUpperCase().slice(0, 2)}
        </div>
        <div className="flex-1">
          <div className="mb-1 flex items-center justify-between gap-2">
            <span className="text-sm font-semibold">{c.authorName || 'Unknown user'}</span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {c.createdAt ? new Date(c.createdAt).toLocaleString() : ''}
                {c.updatedAt && c.createdAt && c.updatedAt !== c.createdAt && (
                  <span className="ml-1 italic">(edited)</span>
                )}
              </span>
              {!isEditing && (canEdit || canDelete) && (
                <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => beginEdit(c)}
                      disabled={busy}
                      className="inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                      title="Edit comment"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  )}
                  {canDelete && (
                    <button
                      type="button"
                      onClick={() => handleDelete(c.id)}
                      disabled={busy}
                      className="inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      title={isAuthor ? 'Delete comment' : 'Delete (admin)'}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
          {isEditing ? (
            <div className="flex gap-2">
              <textarea
                className="flex w-full flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                value={editingDraft}
                onChange={e => setEditingDraft(e.target.value)}
                rows={2}
                autoFocus
              />
              <div className="flex flex-col gap-1 self-end">
                <Button
                  size="sm"
                  variant="gradient"
                  onClick={() => saveEdit(c.id)}
                  disabled={busy || !editingDraft.trim() || editingDraft === c.body}
                >
                  {busy ? '...' : 'Save'}
                </Button>
                <Button size="sm" variant="ghost" onClick={cancelEdit} disabled={busy} title="Cancel">
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ) : (
            <p className="whitespace-pre-wrap text-sm leading-relaxed">{c.body}</p>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {NOTE_GROUPS.map(group => {
        const items = comments.filter((c: any) => (group.key ? c.tag === group.key : c.tag !== 'issue' && c.tag !== 'requirement'));
        return (
          <div key={group.key || 'standard'}>
            <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
              <span className={cn('flex h-6 w-6 items-center justify-center rounded-md', group.iconBg, group.iconText)}>
                <group.Icon className="h-3.5 w-3.5" />
              </span>
              <span className="uppercase tracking-wide text-muted-foreground">
                {group.label} ({items.length})
              </span>
            </h3>
            <Card className={group.border}>
              <CardContent className="pt-6">
                {items.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 py-6 text-muted-foreground">
                    <group.Icon className={cn('h-10 w-10 opacity-40', group.iconText)} />
                    <p className="text-sm">{group.empty}</p>
                  </div>
                ) : (
                  items.map(renderNote)
                )}
              </CardContent>
            </Card>
          </div>
        );
      })}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Add a note</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <Label>Tag</Label>
            <div className="flex flex-wrap gap-2">
              {NOTE_TAGS.map(t => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setNoteTag(t.key)}
                  className={cn(
                    'inline-flex items-center gap-2 rounded-lg border-2 px-3 py-2 text-sm transition-colors',
                    noteTag === t.key ? t.activeClass : 'border-border hover:border-primary/40 bg-transparent',
                  )}
                >
                  <span className={cn('h-2 w-2 rounded-full', t.dotClass)} />
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <textarea
              className="flex w-full flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              placeholder="Add a note..."
              value={newComment}
              onChange={e => setNewComment(e.target.value)}
              rows={2}
            />
            <Button variant="gradient" onClick={handleSubmit} disabled={submitting || !newComment.trim()} className="self-end">
              {submitting ? '...' : 'Post'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function VNextOrderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { hasPermission } = useCurrentUser();
  const [activeTab, setActiveTab] = useState('details');
  const [order, setOrder] = useState<OrderData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingUnits, setEditingUnits] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [unarchiving, setUnarchiving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [issues, setIssues] = useState<IssueSummary[]>([]);

  useEffect(() => { window.scrollTo(0, 0); }, [id]);

  const loadOrder = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/v1/orders/${id}`);
      if (!res.ok) throw new Error(`Failed to load order (${res.status})`);
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setOrder(json.data);
      setError('');
    } catch (err: any) {
      setError(err.message || 'Failed to load order');
    }
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      await loadOrder();
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [loadOrder]);

  useEffect(() => {
    if (!id) return;
    fetch(`${API_URL}/api/v1/issues?sourceEntityType=order&sourceEntityId=${id}`)
      .then(res => res.json())
      .then(json => setIssues(json.data || []))
      .catch(() => setIssues([]));
  }, [id]);

  const handleArchive = useCallback(async () => {
    if (!id) return;
    setArchiving(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/orders/${id}`, { method: 'DELETE' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.error) {
        toast.error(json.error || 'Failed to archive order', { duration: 8000 });
        return;
      }
      toast.success('Order archived');
      navigate('/orders');
    } catch {
      toast.error('Failed to archive order');
    } finally {
      setArchiving(false);
    }
  }, [id, navigate]);

  const handleCancel = useCallback(async () => {
    if (!id) return;
    setCancelling(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/orders/${id}/cancel`, { method: 'POST' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.error) {
        toast.error(json.error || 'Failed to cancel order', { duration: 8000 });
        return;
      }
      toast.success('Order cancelled');
      loadOrder();
    } catch {
      toast.error('Failed to cancel order');
    } finally {
      setCancelling(false);
      setConfirmCancel(false);
    }
  }, [id, loadOrder]);

  const handleUnarchive = useCallback(async () => {
    if (!id) return;
    setUnarchiving(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/orders/${id}/unarchive`, { method: 'POST' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.error) {
        toast.error(json.error || 'Failed to unarchive order', { duration: 8000 });
        return;
      }
      toast.success('Order restored');
      loadOrder();
    } catch {
      toast.error('Failed to unarchive order');
    } finally {
      setUnarchiving(false);
    }
  }, [id, loadOrder]);

  const handleSoftDelete = useCallback(async () => {
    if (!id) return;
    setDeleting(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/orders/${id}/soft-delete`, { method: 'POST' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.error) {
        toast.error(json.error || 'Failed to delete order', { duration: 8000 });
        return;
      }
      toast.success('Order deleted');
      navigate('/orders');
    } catch {
      toast.error('Failed to delete order');
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  }, [id, navigate]);

  // Memoised on `id` so the HandlingUnitsEditor doesn't re-trigger its effects
  // (packaging-types fetch, cartonization preview) on every parent render.
  const handlingUnitEndpoints: HUEditorEndpoints = React.useMemo(() => ({
    cartonizationPreview: `${API_URL}/api/v1/order-line-items/cartonization/preview-units`,
    packagingTypes:       `${API_URL}/api/v1/packaging-types?activeOnly=true`,
    createUnit:      (orderId)     => `${API_URL}/api/v1/orders/${orderId}/trackable-units`,
    updateUnit:      (unitId)      => `${API_URL}/api/v1/orders/${id}/trackable-units/${unitId}`,
    deleteUnit:      (unitId)      => `${API_URL}/api/v1/orders/${id}/trackable-units/${unitId}`,
    moveLineItem:    (lineItemId)  => `${API_URL}/api/v1/orders/${id}/line-items/${lineItemId}/move`,
    generateBarcode: (unitId)      => `${API_URL}/api/v1/orders/${id}/trackable-units/${unitId}/generate-barcode`,
    mergeUnits:      (orderId)     => `${API_URL}/api/v1/orders/${orderId}/trackable-units/merge`,
    splitUnit:       (unitId)      => `${API_URL}/api/v1/orders/${id}/trackable-units/${unitId}/split`,
  }), [id]);

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-3 py-24 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin" />
        <h3 className="text-lg font-medium">Loading order...</h3>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="flex items-center gap-3 rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
        <CircleAlert className="h-5 w-5" />
        {error || 'Order not found'}
      </div>
    );
  }

  const openIssues = issues.filter(i => i.status === 'open' || i.status === 'in_progress');

  const tabs = [
    { value: 'details', label: 'Details' },
    { value: 'notes', label: 'Notes' },
    { value: 'line-items', label: 'Line items' },
    { value: 'handling-units', label: 'Handling units' },
    { value: 'shipments', label: 'Shipments' },
    { value: 'issues', label: `Issues${issues.length > 0 ? ` (${issues.length})` : ''}` },
    { value: 'activity', label: 'Activity' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Button variant="ghost" size="sm" onClick={() => navigate('/orders')} className="-ml-2 h-auto px-2 py-1">
          <ArrowLeft className="h-4 w-4" />
          Orders
        </Button>
        <span>/ {order.orderNumber || order.id}</span>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{order.orderNumber || order.id}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge variant={statusVariant(order.status)}>{orderStatusLabel(order.status)}</Badge>
            {order.deliveryStatus && (
              <Badge variant={deliveryStatusVariant(order.deliveryStatus)}>{deliveryStatusLabel(order.deliveryStatus)}</Badge>
            )}
            {order.poNumber && (
              <span className="text-sm text-muted-foreground">PO# {order.poNumber}</span>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate(`/orders/${order.id}/edit`)}>
            <Pencil className="h-4 w-4" />
            Edit
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigate(`/documents?orderId=${order.id}`)}>
            <FileText className="h-4 w-4" />
            Documents
          </Button>
          {hasPermission('orders:write') && ['pending', 'verified', 'issue'].includes(order.status) && !order.deletedAt && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirmCancel(true)}
              disabled={cancelling}
              className="text-destructive hover:text-destructive"
            >
              <XCircle className="h-4 w-4" />
              Cancel order
            </Button>
          )}
          {hasPermission('orders:write') && !order.archived && !order.deletedAt && (
            <Button variant="outline" size="sm" onClick={handleArchive} disabled={archiving}>
              {archiving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Archive className="h-4 w-4" />}
              Archive
            </Button>
          )}
          {hasPermission('orders:delete') && !order.deletedAt && (
            <Button variant="outline" size="sm" onClick={() => setConfirmDelete(true)} disabled={deleting}
              className="text-destructive hover:text-destructive">
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>
          )}
        </div>
      </div>

      {/* Archived banner */}
      {order.archived && (
        <div className="flex flex-wrap items-center gap-3 rounded-md border border-warning/30 bg-warning/10 p-4 text-sm">
          <Archive className="h-5 w-5 text-warning" />
          <div className="flex-1">
            <span className="font-medium text-warning">This order is archived.</span>
            <span className="ml-1 text-muted-foreground">It does not appear in active order lists.</span>
          </div>
          {hasPermission('orders:delete') && (
            <Button variant="outline" size="sm" onClick={handleUnarchive} disabled={unarchiving}>
              {unarchiving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArchiveRestore className="h-4 w-4" />}
              Unarchive
            </Button>
          )}
        </div>
      )}

      {/* Open issues banner */}
      {openIssues.length > 0 && (() => {
        const hasCritical = openIssues.some(i => i.priority === 'critical');
        return (
          <div
            className={cn(
              'flex flex-wrap items-center gap-3 rounded-md border p-4 text-sm',
              hasCritical ? 'border-destructive/30 bg-destructive/10' : 'border-warning/30 bg-warning/10',
            )}
          >
            <CircleAlert className={cn('h-5 w-5', hasCritical ? 'text-destructive' : 'text-warning')} />
            <div className="flex-1">
              <span className={cn('font-medium', hasCritical ? 'text-destructive' : 'text-warning')}>
                {openIssues.length} open issue{openIssues.length === 1 ? '' : 's'} on this order.
              </span>
              <span className="ml-1 text-muted-foreground">
                {openIssues[0].title}
                {openIssues.length > 1 ? ` and ${openIssues.length - 1} more` : ''}
              </span>
            </div>
            <Button variant="outline" size="sm" onClick={() => setActiveTab('issues')}>
              View
            </Button>
          </div>
        );
      })()}

      {/* Soft-delete confirmation (admin) */}
      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this order?</DialogTitle>
            <DialogDescription>
              {order.orderNumber || order.id} will be removed from all views. The record is retained for audit
              but cannot be restored from the UI. This is different from archiving.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(false)} disabled={deleting}>Cancel</Button>
            <Button variant="destructive" onClick={handleSoftDelete} disabled={deleting}>
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Delete order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel confirmation */}
      <Dialog open={confirmCancel} onOpenChange={setConfirmCancel}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel this order?</DialogTitle>
            <DialogDescription>
              {order.orderNumber || order.id} will be marked cancelled. This can only be done before the order
              is assigned to a shipment, and can't be undone from here.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmCancel(false)} disabled={cancelling}>Never mind</Button>
            <Button variant="destructive" onClick={handleCancel} disabled={cancelling}>
              {cancelling ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
              Cancel order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Route summary bar — mirrors the shipment detail page's origin/destination strip */}
      <Card className="overflow-hidden p-0">
        <div className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="flex items-center gap-2 text-sm font-medium">
            <span className="inline-block h-2 w-2 rounded-full bg-success" />
            {order.origin ? `${order.origin.city}, ${order.origin.state}` : 'Origin not set'}
            <ArrowLeft className="h-3.5 w-3.5 rotate-180 text-muted-foreground" />
            {order.destination ? `${order.destination.city}, ${order.destination.state}` : 'Destination not set'}
            <span className="inline-block h-2 w-2 rounded-full bg-destructive" />
          </div>
          <span className="text-xs text-muted-foreground">
            {order.requestedPickupDate && `Requested pickup ${formatDate(order.requestedPickupDate)}`}
            {order.requestedPickupDate && order.requestedDeliveryDate && ' · '}
            {order.requestedDeliveryDate && `Requested delivery ${formatDate(order.requestedDeliveryDate)}`}
          </span>
        </div>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex w-full justify-start overflow-x-auto">
          {tabs.map(t => (
            <TabsTrigger key={t.value} value={t.value}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="details" className="mt-4 space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Order information</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-2">
                  <InfoItem label="Customer">{order.customer?.name || '-'}</InfoItem>
                  <InfoItem label="PO number">{order.poNumber || '-'}</InfoItem>
                  <InfoItem label="Service level">{order.serviceLevel || '-'}</InfoItem>
                  <InfoItem label="Import source">{order.importSource || '-'}</InfoItem>
                  <InfoItem label="Requirements">
                    <div className="flex flex-wrap gap-1">
                      {order.temperatureControl && <Badge variant="muted">Temp control</Badge>}
                      {order.requiresHazmat && <Badge variant="warning">Hazmat</Badge>}
                      {!order.temperatureControl && !order.requiresHazmat && '-'}
                    </div>
                  </InfoItem>
                  <InfoItem label="Created">{formatDateTime(order.createdAt)}</InfoItem>
                  <InfoItem label="Updated">{formatDateTime(order.updatedAt)}</InfoItem>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Route</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-success" />
                    <div>
                      <div className="text-sm font-semibold">{order.origin?.name || 'Origin'}</div>
                      <div className="text-xs text-muted-foreground">
                        {order.origin ? `${order.origin.city}, ${order.origin.state}` : 'Not set'}
                      </div>
                    </div>
                  </div>
                  <div className="ml-1 h-4 border-l-2 border-dashed border-border" />
                  <div className="flex items-center gap-3">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-destructive" />
                    <div>
                      <div className="text-sm font-semibold">{order.destination?.name || 'Destination'}</div>
                      <div className="text-xs text-muted-foreground">
                        {order.destination ? `${order.destination.city}, ${order.destination.state}` : 'Not set'}
                      </div>
                    </div>
                  </div>
                  <Separator />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <InfoItem label="Requested pickup">{formatDate(order.requestedPickupDate)}</InfoItem>
                    <InfoItem label="Requested delivery">{formatDate(order.requestedDeliveryDate)}</InfoItem>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="notes" className="mt-4 space-y-6">
          {(order.specialInstructions || order.notes) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Order notes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {order.specialInstructions && (
                  <div>
                    <div className="text-xs font-semibold text-muted-foreground">Special instructions</div>
                    <p className="mt-1 text-sm">{order.specialInstructions}</p>
                  </div>
                )}
                {order.notes && (
                  <div>
                    <div className="text-xs font-semibold text-muted-foreground">Notes</div>
                    <p className="mt-1 text-sm">{order.notes}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
          <NotesTab orderId={order.id} />
        </TabsContent>

        <TabsContent value="line-items" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Line items</CardTitle>
              <span className="text-sm text-muted-foreground">{order.lineItems?.length || 0} items</span>
            </CardHeader>
            <CardContent className="p-0">
              <Separator />
              {order.lineItems && order.lineItems.length > 0 ? (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>SKU</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Qty</TableHead>
                        <TableHead>UoM</TableHead>
                        <TableHead>Weight</TableHead>
                        <TableHead>Dims</TableHead>
                        <TableHead>Class</TableHead>
                        <TableHead>NMFC</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {order.lineItems.map((li) => (
                        <TableRow key={li.id}>
                          <TableCell className="font-mono text-xs">{li.sku || '-'}</TableCell>
                          <TableCell>{li.description || '-'}</TableCell>
                          <TableCell>{li.quantity ?? '-'}</TableCell>
                          <TableCell>{li.unitOfMeasure || '-'}</TableCell>
                          <TableCell>{li.weight != null ? `${li.weight} ${li.weightUnit || ''}` : '-'}</TableCell>
                          <TableCell>
                            {li.length && li.width && li.height
                              ? `${li.length} x ${li.width} x ${li.height} ${li.dimUnit || ''}`
                              : '-'}
                          </TableCell>
                          <TableCell>{li.freightClass || '-'}</TableCell>
                          <TableCell>{li.nmfcCode || '-'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  {order.lineItems.some((li) => li.hazmat) && (
                    <div className="m-4 rounded-md border border-warning/40 bg-warning/10 p-3">
                      <div className="mb-2 text-xs font-semibold uppercase tracking-wide">Hazmat</div>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>SKU</TableHead>
                            <TableHead>UN</TableHead>
                            <TableHead>Class</TableHead>
                            <TableHead>PG</TableHead>
                            <TableHead>Proper shipping name</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {order.lineItems.filter((li) => li.hazmat).map((li) => (
                            <TableRow key={'hz-' + li.id}>
                              <TableCell className="font-mono text-xs">{li.sku || '-'}</TableCell>
                              <TableCell>{li.unNumber || '-'}</TableCell>
                              <TableCell>{li.hazmatClass || '-'}</TableCell>
                              <TableCell>{li.packingGroup || '-'}</TableCell>
                              <TableCell>{li.properShippingName || '-'}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}

                  {order.lineItems.some((li) => li.hsCode || li.countryOfOrigin) && (
                    <div className="m-4 rounded-md border border-border p-3">
                      <div className="mb-2 text-xs font-semibold uppercase tracking-wide">Customs</div>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>SKU</TableHead>
                            <TableHead>HS code</TableHead>
                            <TableHead>Country of origin</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {order.lineItems.filter((li) => li.hsCode || li.countryOfOrigin).map((li) => (
                            <TableRow key={'cu-' + li.id}>
                              <TableCell className="font-mono text-xs">{li.sku || '-'}</TableCell>
                              <TableCell>{li.hsCode || '-'}</TableCell>
                              <TableCell>{li.countryOfOrigin || '-'}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}

                  {order.lineItems.some((li) => li.tempMinC != null || li.tempMaxC != null) && (
                    <div className="m-4 rounded-md border border-info/40 bg-info/10 p-3">
                      <div className="mb-2 text-xs font-semibold uppercase tracking-wide">Temperature</div>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>SKU</TableHead>
                            <TableHead>Min (°C)</TableHead>
                            <TableHead>Max (°C)</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {order.lineItems.filter((li) => li.tempMinC != null || li.tempMaxC != null).map((li) => (
                            <TableRow key={'tc-' + li.id}>
                              <TableCell className="font-mono text-xs">{li.sku || '-'}</TableCell>
                              <TableCell>{li.tempMinC ?? '-'}</TableCell>
                              <TableCell>{li.tempMaxC ?? '-'}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </>
              ) : (
                <div className="px-6 py-12 text-center text-sm text-muted-foreground">
                  No line items
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="handling-units" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Handling units</CardTitle>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">{order.trackableUnits?.length ?? 0} units</span>
                <Button variant="outline" size="sm" onClick={() => setEditingUnits(s => !s)}>
                  <Boxes className="h-4 w-4" />
                  {editingUnits ? 'Done editing' : 'Edit handling units'}
                </Button>
              </div>
            </CardHeader>
            <CardContent className={editingUnits ? '' : 'p-0'}>
              {!editingUnits && <Separator />}
              {editingUnits ? (
                <HandlingUnitsEditor
                  orderId={order.id}
                  units={(order.trackableUnits ?? []).map((tu: any) => ({
                    id: tu.id,
                    identifier: tu.identifier,
                    unitType: tu.unitType,
                    sequenceNumber: tu.sequenceNumber,
                    packagingType: tu.packagingType ?? null,
                    packagingTypeId: tu.packagingTypeId ?? null,
                    weight: tu.weight, weightUnit: tu.weightUnit,
                    length: tu.length, width: tu.width, height: tu.height, dimUnit: tu.dimUnit,
                    stackable: tu.stackable,
                  }))}
                  lineItems={(order.lineItems ?? []).concat(
                    (order.trackableUnits ?? []).flatMap((tu: any) => (tu.lineItems ?? []).map((li: any) => ({ ...li, trackableUnitId: tu.id })))
                  ).map((li: any) => ({
                    id: li.id, sku: li.sku, description: li.description, quantity: li.quantity,
                    weight: li.weight, weightUnit: li.weightUnit,
                    length: li.length, width: li.width, height: li.height, dimUnit: li.dimUnit,
                    freightClass: li.freightClass,
                    trackableUnitId: li.trackableUnitId ?? null,
                  }))}
                  endpoints={handlingUnitEndpoints}
                  onChange={loadOrder}
                />
              ) : (order.trackableUnits && order.trackableUnits.length > 0) ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Identifier</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Packaging</TableHead>
                      <TableHead>Line items</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {order.trackableUnits.map((tu) => (
                      <TableRow key={tu.id}>
                        <TableCell className="font-mono text-xs">{tu.identifier || '-'}</TableCell>
                        <TableCell>{tu.unitType || '-'}</TableCell>
                        <TableCell>{tu.packagingType ? `${tu.packagingType.kind}: ${tu.packagingType.code}` : '-'}</TableCell>
                        <TableCell>{tu.lineItems?.length || 0}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="p-6 text-sm text-muted-foreground">
                  No handling units yet. Click "Edit handling units" to build them.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="shipments" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Shipments</CardTitle>
              <span className="text-sm text-muted-foreground">{order.orderShipments?.length || 0} shipments</span>
            </CardHeader>
            <CardContent className="p-0">
              <Separator />
              {order.orderShipments && order.orderShipments.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Reference</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-[120px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {order.orderShipments.map((os) => (
                      <TableRow key={os.shipment.id}>
                        <TableCell className="font-mono text-sm font-semibold">{os.shipment.reference || os.shipment.id}</TableCell>
                        <TableCell>
                          <Badge variant={statusVariant(os.shipment.status)}>{os.shipment.status || '-'}</Badge>
                        </TableCell>
                        <TableCell>
                          <Button asChild variant="ghost" size="sm">
                            <Link to={`/shipments/${os.shipment.id}`}>
                              <ExternalLink className="h-4 w-4" />
                              View
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="px-6 py-12 text-center text-sm text-muted-foreground">
                  No shipments linked
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="issues" className="mt-4">
          {issues.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {issues.map(issue => (
                <Link
                  key={issue.id}
                  to={`/issues/${issue.id}`}
                  className="block rounded-md border border-border p-4 text-sm hover:bg-muted/40"
                >
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant={issuePriorityVariant(issue.priority)} className="capitalize">{issue.priority}</Badge>
                    <span className="text-xs capitalize text-muted-foreground">{issue.status.replace(/_/g, ' ')}</span>
                  </div>
                  <div className="mt-2 font-medium">{issue.title}</div>
                  {issue.category && (
                    <div className="mt-1 text-xs capitalize text-muted-foreground">{issue.category}</div>
                  )}
                </Link>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
                <CircleAlert className="h-10 w-10 opacity-40" />
                <p className="text-sm">No issues on this order.</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="activity" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Audit log</CardTitle>
            </CardHeader>
            <CardContent>
              {order.auditLogs && order.auditLogs.length > 0 ? (
                <ol className="relative space-y-4 border-l border-border pl-6">
                  {order.auditLogs.map((log) => (
                    <li key={log.id} className="relative">
                      <span className="absolute -left-[29px] top-1 flex h-3 w-3 items-center justify-center rounded-full bg-info ring-4 ring-background" />
                      <div className="text-xs text-muted-foreground">{formatDateTime(log.createdAt)}</div>
                      <div className="mt-1 text-sm font-medium">{log.action || 'Action'}</div>
                      {log.description && (
                        <div className="mt-0.5 text-sm text-muted-foreground">{log.description}</div>
                      )}
                      {log.userName && (
                        <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                          <User className="h-3 w-3" />
                          {log.userName}
                        </div>
                      )}
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="py-8 text-center text-sm text-muted-foreground">No activity recorded yet</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
