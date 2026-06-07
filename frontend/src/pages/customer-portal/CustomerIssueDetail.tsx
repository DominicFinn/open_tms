import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';

import { API_URL } from '../../api';
import { customerFetch } from './CustomerDashboard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

interface Issue {
  id: string;
  title: string;
  description?: string;
  status: string;
  priority: string;
  category: string;
  sourceEntityType?: string;
  sourceEntityId?: string;
  createdAt: string;
  updatedAt: string;
  closedAt?: string;
  resolution?: string;
}

interface Comment {
  id: string;
  body: string;
  authorName: string;
  authorType: string;
  visibleToCustomer: boolean;
  createdAt: string;
}

type StatusVariant = 'success' | 'info' | 'warning' | 'destructive' | 'muted' | 'secondary';

function statusVariant(s: string): StatusVariant {
  const m: Record<string, StatusVariant> = {
    open: 'warning',
    in_progress: 'info',
    resolved: 'success',
    closed: 'muted',
    critical: 'destructive',
    high: 'warning',
    medium: 'info',
    low: 'muted',
  };
  return m[s] || 'secondary';
}

const TEXTAREA_CLASS =
  'flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50';

export default function CustomerIssueDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [issue, setIssue] = useState<Issue | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState('');
  const [posting, setPosting] = useState(false);

  const loadComments = useCallback(() => {
    return customerFetch(`${API_URL}/api/v1/customer-portal/issues/${id}/comments`)
      .then(r => r.json())
      .then(json => setComments(json.data || []));
  }, [id]);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      customerFetch(`${API_URL}/api/v1/customer-portal/issues/${id}`)
        .then(r => r.json())
        .then(json => setIssue(json.data)),
      loadComments(),
    ])
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id, loadComments]);

  async function handlePost(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setPosting(true);
    try {
      const res = await customerFetch(`${API_URL}/api/v1/customer-portal/issues/${id}/comments`, {
        method: 'POST',
        body: JSON.stringify({ body: body.trim() }),
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        toast.error('Failed to post comment', { description: json.error || `HTTP ${res.status}` });
        setPosting(false);
        return;
      }
      setBody('');
      await loadComments();
      toast.success('Comment added');
    } catch (err: any) {
      toast.error('Failed to post comment', { description: err?.message || 'Network error' });
    } finally {
      setPosting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-3 py-24 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }
  if (!issue) {
    return (
      <div className="rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
        Issue not found
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Button variant="ghost" size="sm" onClick={() => navigate('/customer-portal/issues')}>
          <ArrowLeft className="h-4 w-4" />
          Issues
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-bold tracking-tight">{issue.title}</h1>
        <Badge variant={statusVariant(issue.status)}>{issue.status}</Badge>
        <Badge variant={statusVariant(issue.priority)}>{issue.priority}</Badge>
        <Badge variant="muted">{issue.category}</Badge>
      </div>

      {issue.description && (
        <Card>
          <CardHeader>
            <CardTitle>Description</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm">{issue.description}</p>
          </CardContent>
        </Card>
      )}

      {issue.resolution && (
        <Card>
          <CardHeader>
            <CardTitle>Resolution</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm">{issue.resolution}</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Comments ({comments.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {comments.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              No comments yet. Be the first to add one.
            </div>
          ) : (
            <div className="space-y-3">
              {comments.map(c => (
                <div
                  key={c.id}
                  className="rounded-md border border-border bg-card p-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold">{c.authorName}</div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant="muted">{c.authorType === 'customer' ? 'You' : 'Team'}</Badge>
                      <span>{new Date(c.createdAt).toLocaleString()}</span>
                    </div>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm">{c.body}</p>
                </div>
              ))}
            </div>
          )}

          <Separator />

          <form onSubmit={handlePost} className="space-y-3">
            <textarea
              className={TEXTAREA_CLASS}
              value={body}
              onChange={e => setBody(e.target.value)}
              placeholder="Add a comment..."
              disabled={posting}
            />
            <div className="flex justify-end">
              <Button type="submit" disabled={posting || !body.trim()}>
                {posting ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquare className="h-4 w-4" />}
                {posting ? 'Posting...' : 'Post comment'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
