import React, { useState, useEffect } from 'react';
import { supabase } from '../utils/supabase';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from './ui/Card';
import {
  CheckCircle,
  Clock,
  Trash2,
  RefreshCw,
  MessageSquare,
  AlertTriangle,
  Eye,
} from 'lucide-react';

interface Comment {
  id: string;
  essay_slug: string;
  author_name: string;
  author_email?: string;
  content: string;
  created_at: string;
  updated_at: string;
  parent_id?: string;
  is_approved: boolean;
  session_id: string;
}

export default function CommentAdmin() {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved'>(
    'pending'
  );
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadComments();
  }, []);

  const loadComments = async () => {
    try {
      setLoading(true);
      setError(null);
      const { data, error } = await supabase
        .from('comments')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setComments(data || []);
    } catch (err: any) {
      setError('Failed to load comments');
      console.error('Error loading comments:', err);
    } finally {
      setLoading(false);
    }
  };

  const processComment = async (
    commentId: string,
    action: 'approve' | 'reject' | 'delete'
  ) => {
    try {
      setProcessingIds(prev => new Set(prev).add(commentId));

      if (action === 'delete') {
        const { error } = await supabase
          .from('comments')
          .delete()
          .eq('id', commentId);

        if (error) throw error;
        setComments(prev => prev.filter(comment => comment.id !== commentId));
      } else {
        const { error } = await supabase
          .from('comments')
          .update({ is_approved: action === 'approve' })
          .eq('id', commentId);

        if (error) throw error;
        setComments(prev =>
          prev.map(comment =>
            comment.id === commentId
              ? { ...comment, is_approved: action === 'approve' }
              : comment
          )
        );
      }
    } catch (err: any) {
      setError(`Failed to ${action} comment`);
      console.error(`Error ${action}ing comment:`, err);
    } finally {
      setProcessingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(commentId);
        return newSet;
      });
    }
  };

  const bulkApprove = async () => {
    const pendingComments = filteredComments.filter(c => !c.is_approved);
    if (pendingComments.length === 0) return;

    if (!confirm(`Approve ${pendingComments.length} pending comments?`)) return;

    try {
      const { error } = await supabase
        .from('comments')
        .update({ is_approved: true })
        .in(
          'id',
          pendingComments.map(c => c.id)
        );

      if (error) throw error;

      setComments(prev =>
        prev.map(comment =>
          pendingComments.some(pc => pc.id === comment.id)
            ? { ...comment, is_approved: true }
            : comment
        )
      );
    } catch (err: any) {
      setError('Failed to bulk approve comments');
      console.error('Error bulk approving comments:', err);
    }
  };

  const formatDate = (timestamp: string) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const filteredComments = comments.filter(comment => {
    if (filter === 'pending') return !comment.is_approved;
    if (filter === 'approved') return comment.is_approved;
    return true;
  });

  const pendingCount = comments.filter(c => !c.is_approved).length;
  const approvedCount = comments.filter(c => c.is_approved).length;
  const totalCount = comments.length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex items-center space-x-2 text-muted-foreground">
          <RefreshCw className="h-4 w-4 animate-spin" />
          <span>Loading comments...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2 text-destructive">
              <AlertTriangle className="h-4 w-4" />
              <span>{error}</span>
              <Button
                onClick={loadComments}
                variant="outline"
                size="sm"
                className="ml-auto"
              >
                Try Again
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Statistics Cards - Matching Security Dashboard Style */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Pending Comments
            </CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
              {pendingCount}
            </div>
            <p className="text-xs text-muted-foreground">Awaiting approval</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Approved Comments
            </CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
              {approvedCount}
            </div>
            <p className="text-xs text-muted-foreground">
              Published and visible
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Comments
            </CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {totalCount}
            </div>
            <p className="text-xs text-muted-foreground">All submissions</p>
          </CardContent>
        </Card>
      </div>

      {/* Action Bar */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex items-center gap-2">
              <select
                value={filter}
                onChange={e => setFilter(e.target.value as typeof filter)}
                className="px-3 py-2 border border-input bg-background rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="all">All Comments</option>
                <option value="pending">Pending Only</option>
                <option value="approved">Approved Only</option>
              </select>

              {filter === 'pending' && pendingCount > 0 && (
                <Button onClick={bulkApprove} size="sm">
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Approve All ({pendingCount})
                </Button>
              )}
            </div>

            <Button onClick={loadComments} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Comments Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Recent Comments
          </CardTitle>
          <CardDescription>
            {filter === 'all' ? 'All comments' : `${filter} comments only`} •{' '}
            {filteredComments.length} total
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredComments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No {filter === 'all' ? '' : filter} comments found.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-medium">Author</th>
                    <th className="text-left py-3 px-4 font-medium">Status</th>
                    <th className="text-left py-3 px-4 font-medium">Essay</th>
                    <th className="text-left py-3 px-4 font-medium">Date</th>
                    <th className="text-left py-3 px-4 font-medium">Content</th>
                    <th className="text-right py-3 px-4 font-medium">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredComments.map(comment => (
                    <tr key={comment.id} className="border-b hover:bg-muted/50">
                      <td className="py-4 px-4">
                        <div className="space-y-1">
                          <div className="font-medium text-sm">
                            {comment.author_name}
                          </div>
                          {comment.author_email && (
                            <div className="text-xs text-muted-foreground">
                              {comment.author_email}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <Badge
                          variant={comment.is_approved ? 'success' : 'warning'}
                        >
                          {comment.is_approved ? (
                            <>
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Approved
                            </>
                          ) : (
                            <>
                              <Clock className="h-3 w-3 mr-1" />
                              Pending
                            </>
                          )}
                        </Badge>
                      </td>
                      <td className="py-4 px-4">
                        <span className="text-sm font-mono bg-muted px-2 py-1 rounded">
                          {comment.essay_slug}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-sm text-muted-foreground">
                        {formatDate(comment.created_at)}
                      </td>
                      <td className="py-4 px-4 max-w-xs">
                        <div className="text-sm truncate">
                          {comment.content}
                        </div>
                        {comment.content.length > 50 && (
                          <div className="text-xs text-muted-foreground mt-1">
                            {comment.content.length} characters
                          </div>
                        )}
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex gap-1 justify-end">
                          {!comment.is_approved ? (
                            <Button
                              onClick={() =>
                                processComment(comment.id, 'approve')
                              }
                              disabled={processingIds.has(comment.id)}
                              size="sm"
                              className="bg-green-600 hover:bg-green-700"
                            >
                              {processingIds.has(comment.id) ? (
                                <RefreshCw className="h-3 w-3 animate-spin" />
                              ) : (
                                <CheckCircle className="h-3 w-3" />
                              )}
                            </Button>
                          ) : (
                            <Button
                              onClick={() =>
                                processComment(comment.id, 'reject')
                              }
                              disabled={processingIds.has(comment.id)}
                              variant="outline"
                              size="sm"
                            >
                              {processingIds.has(comment.id) ? (
                                <RefreshCw className="h-3 w-3 animate-spin" />
                              ) : (
                                <Eye className="h-3 w-3" />
                              )}
                            </Button>
                          )}
                          <Button
                            onClick={() => {
                              if (
                                confirm(
                                  'Are you sure you want to permanently delete this comment?'
                                )
                              ) {
                                processComment(comment.id, 'delete');
                              }
                            }}
                            disabled={processingIds.has(comment.id)}
                            variant="destructive"
                            size="sm"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
