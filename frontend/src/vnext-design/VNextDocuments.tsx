import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Download,
  Eye,
  File,
  FileText,
  Filter,
  Folder,
  Gavel,
  Image as ImageIcon,
  Loader2,
  Paperclip,
  Search,
  Upload,
  X,
  XCircle,
} from 'lucide-react';

import { API_URL } from '../api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

function formatFileSize(bytes: number): string {
  if (!bytes) return 'N/A';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

type DocVariant = 'info' | 'warning' | 'muted';

function docTypeLabel(documentType: string): { type: string; variant: DocVariant } {
  switch ((documentType || '').toLowerCase()) {
    case 'bol': return { type: 'BOL', variant: 'info' };
    case 'customs': return { type: 'Customs', variant: 'warning' };
    default: return { type: 'Attachment', variant: 'muted' };
  }
}

function DocIcon({ mimeType, className }: { mimeType: string; className?: string }) {
  if (mimeType && mimeType.startsWith('image/')) return <ImageIcon className={className} />;
  return <FileText className={className} />;
}

const STAT_TONES = {
  primary: 'bg-primary/10 text-primary',
  info: 'bg-info/15 text-info',
  warning: 'bg-warning/15 text-warning',
  muted: 'bg-muted text-muted-foreground',
} as const;

export default function VNextDocuments() {
  const [searchParams, setSearchParams] = useSearchParams();
  const orderIdFilter = searchParams.get('orderId') || '';
  const shipmentIdFilter = searchParams.get('shipmentId') || '';
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function fetchDocs() {
      try {
        const params = new URLSearchParams();
        if (orderIdFilter) params.set('orderId', orderIdFilter);
        if (shipmentIdFilter) params.set('shipmentId', shipmentIdFilter);
        const qs = params.toString();
        const res = await fetch(`${API_URL}/api/v1/documents${qs ? `?${qs}` : ''}`);
        if (!res.ok) throw new Error('Failed to load documents');
        const json = await res.json();
        if (!cancelled) setDocuments(json.data || []);
      } catch (e: any) {
        if (!cancelled) setError(e.message || 'Failed to load documents');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchDocs();
    return () => { cancelled = true; };
  }, [orderIdFilter, shipmentIdFilter]);

  const clearEntityFilter = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('orderId');
    next.delete('shipmentId');
    setSearchParams(next);
  };

  const mappedDocs = documents.map((d: any) => {
    const { type, variant } = docTypeLabel(d.documentType);
    const entity = d.shipmentId ? `SHP-${d.shipmentId}` : d.orderId ? `ORD-${d.orderId}` : d.carrierId ? `Carrier-${d.carrierId}` : 'N/A';
    const size = formatFileSize(d.fileSize);
    const created = d.createdAt ? new Date(d.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A';
    return { ...d, type, variant, entity, size, created, name: d.fileName || d.documentNumber || 'Untitled' };
  });

  const typeCounts = {
    all: mappedDocs.length,
    bol: mappedDocs.filter((d: any) => d.type === 'BOL').length,
    customs: mappedDocs.filter((d: any) => d.type === 'Customs').length,
    attachment: mappedDocs.filter((d: any) => d.type === 'Attachment').length,
  };

  const filtered = mappedDocs.filter((d: any) => {
    if (typeFilter === 'bol' && d.type !== 'BOL') return false;
    if (typeFilter === 'customs' && d.type !== 'Customs') return false;
    if (typeFilter === 'attachment' && d.type !== 'Attachment') return false;
    if (search) {
      const q = search.toLowerCase();
      return d.name.toLowerCase().includes(q) || d.entity.toLowerCase().includes(q);
    }
    return true;
  });

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-3 py-24 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin" />
        <h3 className="text-lg font-medium">Loading...</h3>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-3 rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
        <XCircle className="h-5 w-5" />
        {error}
      </div>
    );
  }

  const stats = [
    { tone: 'primary' as const, label: 'Total Documents', value: typeCounts.all, icon: Folder, key: 'all' },
    { tone: 'info' as const, label: 'Bills of Lading', value: typeCounts.bol, icon: FileText, key: 'bol' },
    { tone: 'warning' as const, label: 'Customs Forms', value: typeCounts.customs, icon: Gavel, key: 'customs' },
    { tone: 'muted' as const, label: 'Attachments', value: typeCounts.attachment, icon: Paperclip, key: 'attachment' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-3xl font-bold tracking-tight">Documents</h1>
        <Button variant="gradient">
          <Upload className="h-4 w-4" />
          Upload
        </Button>
      </div>

      {(orderIdFilter || shipmentIdFilter) && (
        <div className="flex items-center justify-between gap-3 rounded-md border border-info/30 bg-info/10 p-3 text-sm text-info">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4" />
            <span>
              Filtered to {orderIdFilter ? 'order' : 'shipment'}{' '}
              <span className="font-mono text-xs">{orderIdFilter || shipmentIdFilter}</span>
            </span>
          </div>
          <Button variant="ghost" size="sm" onClick={clearEntityFilter}>
            <X className="h-4 w-4" />
            Clear filter
          </Button>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map(stat => {
          const Icon = stat.icon;
          return (
            <Card
              key={stat.key}
              onClick={() => setTypeFilter(stat.key)}
              className="cursor-pointer p-5 hover:border-primary/40"
            >
              <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg', STAT_TONES[stat.tone])}>
                <Icon className="h-5 w-5" />
              </div>
              <div className="mt-3 text-2xl font-bold tracking-tight">{stat.value}</div>
              <div className="mt-1 text-sm text-muted-foreground">{stat.label}</div>
            </Card>
          );
        })}
      </div>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-[220px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search documents..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="bol">BOL</SelectItem>
                <SelectItem value="customs">Customs</SelectItem>
                <SelectItem value="attachment">Attachment</SelectItem>
              </SelectContent>
            </Select>
            <Select defaultValue="all">
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Dates</SelectItem>
                <SelectItem value="7d">Last 7 Days</SelectItem>
                <SelectItem value="30d">Last 30 Days</SelectItem>
                <SelectItem value="90d">Last 90 Days</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <span className="text-sm text-muted-foreground">{filtered.length} documents</span>
        </div>
        <Separator />
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Document Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Entity</TableHead>
              <TableHead>Size</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((doc, i) => (
              <TableRow key={i}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <DocIcon mimeType={doc.mimeType} className="h-5 w-5 text-muted-foreground" />
                    <span className="font-medium">{doc.name}</span>
                  </div>
                </TableCell>
                <TableCell><Badge variant={doc.variant}>{doc.type}</Badge></TableCell>
                <TableCell>
                  <span className="cursor-pointer font-medium text-primary">{doc.entity}</span>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{doc.size}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{doc.created}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    {doc.documentType === 'bol' && (
                      <Button asChild variant="ghost" size="icon" className="h-8 w-8">
                        <Link to={`/documents/${doc.id}/view`} title="View BOL">
                          <Eye className="h-4 w-4" />
                        </Link>
                      </Button>
                    )}
                    <Button asChild variant="ghost" size="icon" className="h-8 w-8">
                      <a
                        href={`${API_URL}/api/v1/documents/${doc.id}/download`}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Download"
                      >
                        <Download className="h-4 w-4" />
                      </a>
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                  <File className="mx-auto mb-2 h-8 w-8 opacity-40" />
                  No documents found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
