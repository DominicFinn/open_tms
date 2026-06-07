import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

import { API_URL } from '../../api';
import { customerFetch } from './CustomerDashboard';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
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

interface Issue {
  id: string;
  title: string;
  status: string;
  priority: string;
  category: string;
  sourceEntityType?: string;
  sourceEntityId?: string;
  commentCount: number;
  createdAt: string;
  updatedAt: string;
}

type StatusVariant = 'success' | 'info' | 'warning' | 'destructive' | 'muted' | 'secondary';

function statusVariant(s: string): StatusVariant {
  const m: Record<string, StatusVariant> = {
    open: 'warning',
    in_progress: 'info',
    resolved: 'success',
    closed: 'muted',
  };
  return m[s] || 'secondary';
}

function priorityVariant(p: string): StatusVariant {
  const m: Record<string, StatusVariant> = {
    critical: 'destructive',
    high: 'warning',
    medium: 'info',
    low: 'muted',
  };
  return m[p] || 'secondary';
}

export default function CustomerIssues() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const statusFilter = searchParams.get('status') || 'open';

  const setStatusFilter = (next: string) => {
    const params = new URLSearchParams(searchParams);
    if (next === 'all') params.delete('status'); else params.set('status', next);
    setSearchParams(params, { replace: true });
  };

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (statusFilter !== 'all') params.set('status', statusFilter);
    customerFetch(`${API_URL}/api/v1/customer-portal/issues?${params}`)
      .then(r => r.json())
      .then(json => setIssues(json.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [statusFilter]);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Issues</h1>
      <Card>
        <div className="flex flex-wrap items-center gap-3 p-4">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="open">Open (active)</SelectItem>
              <SelectItem value="in_progress">In progress</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Separator />
        {loading ? (
          <div className="flex flex-col items-center gap-3 py-12 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="text-sm">Loading issues...</span>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Comments</TableHead>
                <TableHead>Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {issues.map(i => (
                <TableRow key={i.id}>
                  <TableCell>
                    <Link to={`/customer-portal/issues/${i.id}`} className="font-semibold text-primary hover:underline">
                      {i.title}
                    </Link>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {i.sourceEntityType || '-'}
                  </TableCell>
                  <TableCell><Badge variant={statusVariant(i.status)}>{i.status}</Badge></TableCell>
                  <TableCell><Badge variant={priorityVariant(i.priority)}>{i.priority}</Badge></TableCell>
                  <TableCell className="text-sm">{i.category}</TableCell>
                  <TableCell className="text-right text-sm">{i.commentCount}</TableCell>
                  <TableCell className="text-sm">{new Date(i.updatedAt).toLocaleDateString()}</TableCell>
                </TableRow>
              ))}
              {issues.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                    No issues
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
