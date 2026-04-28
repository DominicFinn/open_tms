import React, { useEffect, useState } from 'react';
import { Download, FolderOpen, Loader2 } from 'lucide-react';

import { API_URL } from '../../api';
import { customerFetch, getCustomerToken } from './CustomerDashboard';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface Doc {
  id: string; documentType: string; fileName: string;
  mimeType: string; fileSize: number; createdAt: string; shipmentId?: string;
}

function docTypeLabel(t: string): string {
  const m: Record<string, string> = {
    bol: 'Bill of Lading',
    label: 'Label',
    customs: 'Customs Form',
    rate_confirmation: 'Rate Confirmation',
    issue_closure_report: 'Closure Report',
    daily_report: 'Daily Report',
  };
  return m[t] || t;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

export default function CustomerDocuments() {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    customerFetch(`${API_URL}/api/v1/customer-portal/documents`)
      .then(r => r.json())
      .then(json => setDocs(json.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleDownload = async (doc: Doc) => {
    const res = await fetch(`${API_URL}/api/v1/customer-portal/documents/${doc.id}/download`, {
      headers: { Authorization: `Bearer ${getCustomerToken()}` },
    });
    if (!res.ok) { alert('Download failed'); return; }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = doc.fileName; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Documents</h1>
      <Card>
        {loading ? (
          <div className="flex flex-col items-center gap-3 py-12 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="text-sm">Loading...</span>
          </div>
        ) : docs.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-12 text-muted-foreground">
            <FolderOpen className="h-10 w-10 opacity-40" />
            <p className="text-sm">No documents available</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Document</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {docs.map(d => (
                <TableRow key={d.id}>
                  <TableCell className="font-semibold">{d.fileName}</TableCell>
                  <TableCell>
                    <Badge variant="muted">{docTypeLabel(d.documentType)}</Badge>
                  </TableCell>
                  <TableCell className="text-sm">{formatSize(d.fileSize)}</TableCell>
                  <TableCell className="text-sm">{new Date(d.createdAt).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <Button variant="outline" size="sm" onClick={() => handleDownload(d)}>
                      <Download className="h-4 w-4" />
                      Download
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
