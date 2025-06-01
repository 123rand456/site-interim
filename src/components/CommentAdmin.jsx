import React, { useState, useEffect } from 'react';
import { supabase } from '../utils/supabase';

export default function CommentAdmin() {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('pending'); // 'all', 'pending', 'approved'

  useEffect(() => {
    loadComments();
  }, []);

  const loadComments = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('comments')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setComments(data || []);
    } catch (err) {
      setError('Failed to load comments');
      console.error('Error loading comments:', err);
    } finally {
      setLoading(false);
    }
  };

  const approveComment = async commentId => {
    try {
      const { error } = await supabase
        .from('comments')
        .update({ is_approved: true })
        .eq('id', commentId);

      if (error) throw error;

      setComments(prev =>
        prev.map(comment =>
          comment.id === commentId ? { ...comment, is_approved: true } : comment
        )
      );
    } catch (err) {
      setError('Failed to approve comment');
      console.error('Error approving comment:', err);
    }
  };

  const rejectComment = async commentId => {
    try {
      const { error } = await supabase
        .from('comments')
        .update({ is_approved: false })
        .eq('id', commentId);

      if (error) throw error;

      setComments(prev =>
        prev.map(comment =>
          comment.id === commentId
            ? { ...comment, is_approved: false }
            : comment
        )
      );
    } catch (err) {
      setError('Failed to reject comment');
      console.error('Error rejecting comment:', err);
    }
  };

  const deleteComment = async commentId => {
    if (!confirm('Are you sure you want to permanently delete this comment?'))
      return;

    try {
      const { error } = await supabase
        .from('comments')
        .delete()
        .eq('id', commentId);

      if (error) throw error;

      setComments(prev => prev.filter(comment => comment.id !== commentId));
    } catch (err) {
      setError('Failed to delete comment');
      console.error('Error deleting comment:', err);
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
    } catch (err) {
      setError('Failed to bulk approve comments');
      console.error('Error bulk approving comments:', err);
    }
  };

  const formatDate = timestamp => {
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
    return true; // 'all'
  });

  const pendingCount = comments.filter(c => !c.is_approved).length;
  const approvedCount = comments.filter(c => c.is_approved).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-gray-500 dark:text-gray-400">
          Loading comments...
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      {error && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-red-700 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Stats and Filters */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex gap-4 text-sm">
          <span className="px-3 py-1 bg-yellow-100 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-400 rounded">
            {pendingCount} Pending
          </span>
          <span className="px-3 py-1 bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-400 rounded">
            {approvedCount} Approved
          </span>
          <span className="px-3 py-1 bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-400 rounded">
            {comments.length} Total
          </span>
        </div>

        <div className="flex gap-2">
          <select
            value={filter}
            onChange={e => setFilter(e.target.value)}
            className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
          >
            <option value="all">All Comments</option>
            <option value="pending">Pending Only</option>
            <option value="approved">Approved Only</option>
          </select>

          {filter === 'pending' && pendingCount > 0 && (
            <button
              onClick={bulkApprove}
              className="px-4 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
            >
              Approve All ({pendingCount})
            </button>
          )}

          <button
            onClick={loadComments}
            className="px-4 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Comments List */}
      <div className="space-y-4">
        {filteredComments.length === 0 ? (
          <p className="text-center text-gray-500 dark:text-gray-400 py-8">
            No {filter === 'all' ? '' : filter} comments found.
          </p>
        ) : (
          filteredComments.map(comment => (
            <div
              key={comment.id}
              className={`border rounded-lg p-4 ${
                comment.is_approved
                  ? 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/10'
                  : 'border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/10'
              }`}
            >
              <div className="flex justify-between items-start mb-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <strong className="text-blue-600 dark:text-blue-400">
                      {comment.author_name}
                    </strong>
                    {comment.author_email && (
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        ({comment.author_email})
                      </span>
                    )}
                    <span
                      className={`px-2 py-1 text-xs rounded ${
                        comment.is_approved
                          ? 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-400'
                          : 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-400'
                      }`}
                    >
                      {comment.is_approved ? 'Approved' : 'Pending'}
                    </span>
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    Essay:{' '}
                    <span className="font-mono">{comment.essay_slug}</span> •{' '}
                    {formatDate(comment.created_at)}
                  </div>
                </div>

                <div className="flex gap-2">
                  {!comment.is_approved ? (
                    <button
                      onClick={() => approveComment(comment.id)}
                      className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700"
                    >
                      Approve
                    </button>
                  ) : (
                    <button
                      onClick={() => rejectComment(comment.id)}
                      className="px-3 py-1 bg-yellow-600 text-white rounded text-sm hover:bg-yellow-700"
                    >
                      Unapprove
                    </button>
                  )}
                  <button
                    onClick={() => deleteComment(comment.id)}
                    className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700"
                  >
                    Delete
                  </button>
                </div>
              </div>

              <div className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap bg-white dark:bg-gray-800 p-3 rounded border">
                {comment.content}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
