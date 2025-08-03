import { useState, useEffect } from 'react';
import {
  supabase,
  getSessionId,
  setSessionConfig,
  canEditComment,
} from '../utils/supabase';
import {
  sanitizeHtml,
  sanitizeText,
  sanitizeEmail,
  checkCommentRateLimit,
  recordCommentSubmission,
} from '../utils/sanitize';
import { logSecurityEvent } from '../utils/security-monitor';
import '../utils/rate-limit-info';

// Helper Components
const CommentBadge = ({ type, children }) => {
  const styles = {
    pending:
      'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-400',
    user: 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-400',
    reply: 'bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400',
  };
  return (
    <span className={`text-xs px-2 py-1 rounded ${styles[type]}`}>
      {children}
    </span>
  );
};

const CommentActions = ({ canEdit, onEdit, onDelete, onReply }) => (
  <div className="flex gap-2">
    {canEdit && (
      <>
        <button
          onClick={onEdit}
          className="text-blue-500 hover:text-blue-700 text-sm"
        >
          Edit
        </button>
        <button
          onClick={onDelete}
          className="text-red-500 hover:text-red-700 text-sm"
        >
          Delete
        </button>
      </>
    )}
    <button
      onClick={onReply}
      className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 text-sm"
    >
      Reply
    </button>
  </div>
);

const EditForm = ({ content, onChange, onSave, onCancel }) => (
  <div className="mt-2">
    <textarea
      value={content}
      onChange={e => onChange(e.target.value)}
      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
      rows={3}
    />
    <div className="mt-2 flex gap-2">
      <button
        onClick={onSave}
        className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
      >
        Save
      </button>
      <button
        onClick={onCancel}
        className="px-3 py-1 bg-gray-500 text-white rounded text-sm hover:bg-gray-600"
      >
        Cancel
      </button>
    </div>
  </div>
);

const ReplyIndicator = () => (
  <div className="flex items-center mb-2">
    <div className="w-6 h-px bg-blue-300 dark:bg-blue-600"></div>
    <span className="text-xs text-blue-600 dark:text-blue-400 ml-2 font-medium">
      ↳ Reply
    </span>
  </div>
);

const ReplyContext = ({ comment, onCancel }) => (
  <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded">
    <div className="flex justify-between items-center">
      <div>
        <span className="text-sm text-blue-700 dark:text-blue-400">
          Replying to <strong>{comment.author_name}</strong>
        </span>
        <div className="text-xs text-blue-600 dark:text-blue-500 mt-1 italic">
          &ldquo;{comment.content.substring(0, 100)}
          {comment.content.length > 100 ? '...' : ''}&rdquo;
        </div>
      </div>
      <button
        onClick={onCancel}
        className="text-blue-500 hover:text-blue-700 text-sm"
      >
        Cancel Reply
      </button>
    </div>
  </div>
);

export default function SupabaseComments({ essaySlug }) {
  const [state, setState] = useState({
    comments: [],
    newComment: { name: '', email: '', content: '' },
    replyingTo: null,
    editingComment: null,
    editContent: '',
    isSubmitting: false,
    loading: true,
    error: null,
    currentTime: new Date(),
  });

  // Timer for edit window
  useEffect(() => {
    const timer = setInterval(() => {
      setState(prev => ({ ...prev, currentTime: new Date() }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const loadComments = async () => {
      try {
        updateState({ loading: true });
        const { data, error } = await supabase
          .from('comments')
          .select('*')
          .eq('essay_slug', essaySlug)
          .order('created_at', { ascending: true });

        if (error) throw error;
        updateState({ comments: data || [] });
      } catch (err) {
        updateState({ error: `Failed to load comments: ${err.message}` });
      } finally {
        updateState({ loading: false });
      }
    };

    const initializeComments = async () => {
      try {
        await setSessionConfig();
        await loadComments();
      } catch (err) {
        setState(prev => ({
          ...prev,
          error: `Failed to initialize comments: ${err.message}`,
        }));
      }
    };

    initializeComments();
  }, [essaySlug]);

  const updateState = updates => setState(prev => ({ ...prev, ...updates }));

  const handleSubmit = async e => {
    e.preventDefault();
    if (!state.newComment.name.trim() || !state.newComment.content.trim())
      return;

    // Rate limiting check
    if (!checkCommentRateLimit()) {
      logSecurityEvent('rate_limit_hit', {
        action: 'comment_submission',
        essay_slug: essaySlug,
      });
      updateState({
        error: 'Please wait 30 seconds between comments to prevent spam.',
      });
      return;
    }

    // Input validation and sanitization
    const sanitizedName = sanitizeText(state.newComment.name);
    const sanitizedEmail = sanitizeEmail(state.newComment.email);
    const sanitizedContent = sanitizeHtml(state.newComment.content);

    if (!sanitizedName || !sanitizedContent) {
      logSecurityEvent('invalid_input', {
        action: 'comment_validation_failed',
        original_name: state.newComment.name,
        original_content_length: state.newComment.content.length,
      });
      updateState({
        error: 'Please provide valid name and content for your comment.',
      });
      return;
    }

    if (sanitizedContent.length > 2000) {
      updateState({
        error: 'Comment is too long. Please keep it under 2000 characters.',
      });
      return;
    }

    updateState({ isSubmitting: true, error: null });

    try {
      const sessionId = getSessionId();
      const { data, error } = await supabase.rpc('insert_comment', {
        p_essay_slug: essaySlug,
        p_author_name: sanitizedName,
        p_author_email: sanitizedEmail || null,
        p_content: sanitizedContent,
        p_parent_id: state.replyingTo || null,
        p_session_id: sessionId,
      });

      if (error) throw error;

      // Record successful submission for rate limiting
      recordCommentSubmission();

      updateState({
        comments: [...state.comments, data],
        newComment: { name: '', email: '', content: '' },
        replyingTo: null,
      });
    } catch (err) {
      updateState({ error: `Failed to post comment: ${err.message}` });
    } finally {
      updateState({ isSubmitting: false });
    }
  };

  const handleEdit = async (commentId, newContent) => {
    const comment = state.comments.find(c => c.id === commentId);
    if (!comment || !canEditComment(comment)) {
      updateState({ error: 'You can no longer edit this comment' });
      return;
    }

    // Sanitize the edited content
    const sanitizedContent = sanitizeHtml(newContent);
    if (!sanitizedContent) {
      updateState({ error: 'Please provide valid content for your comment.' });
      return;
    }

    if (sanitizedContent.length > 2000) {
      updateState({
        error: 'Comment is too long. Please keep it under 2000 characters.',
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('comments')
        .update({
          content: sanitizedContent,
          updated_at: new Date().toISOString(),
        })
        .eq('id', commentId)
        .eq('session_id', getSessionId());

      if (error) throw error;

      updateState({
        comments: state.comments.map(comment =>
          comment.id === commentId
            ? {
                ...comment,
                content: sanitizedContent,
                updated_at: new Date().toISOString(),
              }
            : comment
        ),
        editingComment: null,
        editContent: '',
      });
    } catch (err) {
      updateState({ error: `Failed to update comment: ${err.message}` });
    }
  };

  const handleDelete = async commentId => {
    const comment = state.comments.find(c => c.id === commentId);
    if (!comment || !canEditComment(comment)) {
      updateState({ error: 'You can no longer delete this comment' });
      return;
    }

    if (!confirm('Are you sure you want to delete this comment?')) return;

    try {
      const { error } = await supabase
        .from('comments')
        .delete()
        .eq('id', commentId)
        .eq('session_id', getSessionId());

      if (error) throw error;

      updateState({
        comments: state.comments.filter(comment => comment.id !== commentId),
      });
    } catch (err) {
      updateState({ error: `Failed to delete comment: ${err.message}` });
    }
  };

  // Utility functions
  const getTimeRemaining = comment => {
    const diffMinutes =
      (state.currentTime - new Date(comment.created_at)) / (1000 * 60);
    const remaining = Math.max(0, 5 - diffMinutes);
    if (remaining <= 0) return null;
    const minutes = Math.floor(remaining);
    const seconds = Math.floor((remaining - minutes) * 60);
    return `${minutes}m ${seconds}s left to edit`;
  };

  const formatDate = timestamp =>
    new Date(timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  const organizeComments = comments => {
    const commentMap = new Map();
    const topLevel = [];

    comments.forEach(comment =>
      commentMap.set(comment.id, { ...comment, replies: [] })
    );
    comments.forEach(comment => {
      if (comment.parent_id && commentMap.has(comment.parent_id)) {
        commentMap
          .get(comment.parent_id)
          .replies.push(commentMap.get(comment.id));
      } else {
        topLevel.push(commentMap.get(comment.id));
      }
    });

    return topLevel;
  };

  const renderComment = (comment, depth = 0) => {
    const isApproved = comment.is_approved;
    const canEdit = canEditComment(comment);
    const timeRemaining = getTimeRemaining(comment);
    const isOwn = comment.session_id === getSessionId();
    const isReply = depth > 0;
    const isEditing = state.editingComment === comment.id;

    return (
      <div key={comment.id} className={`${isReply ? 'ml-8 mt-4' : 'mb-6'}`}>
        {isReply && <ReplyIndicator />}

        <div
          className={`border rounded-lg p-4 ${
            isReply
              ? 'border-l-4 border-l-blue-400 dark:border-l-blue-500 bg-blue-50/50 dark:bg-blue-900/20 mb-4'
              : 'mb-4'
          } ${
            isApproved
              ? 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
              : 'border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/10'
          }`}
        >
          <div className="flex justify-between items-start mb-2">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <strong className="text-blue-600 dark:text-blue-400">
                  {comment.author_name}
                </strong>
                {!isApproved && (
                  <CommentBadge type="pending">
                    Awaiting moderation
                  </CommentBadge>
                )}
                {isOwn && <CommentBadge type="user">Your comment</CommentBadge>}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                {formatDate(comment.created_at)}
                {canEdit && timeRemaining && (
                  <span className="ml-2 text-orange-600 dark:text-orange-400 font-mono text-xs">
                    • {timeRemaining}
                  </span>
                )}
                {isOwn && !canEdit && (
                  <span className="ml-2 text-gray-400 dark:text-gray-500 text-xs">
                    • Edit time expired
                  </span>
                )}
              </div>
            </div>

            <CommentActions
              canEdit={canEdit}
              onEdit={() =>
                updateState({
                  editingComment: comment.id,
                  editContent: comment.content,
                })
              }
              onDelete={() => handleDelete(comment.id)}
              onReply={() => {
                updateState({ replyingTo: comment.id });
                document
                  .querySelector('#comment-form')
                  .scrollIntoView({ behavior: 'smooth' });
              }}
            />
          </div>

          {isEditing ? (
            <EditForm
              content={state.editContent}
              onChange={content => updateState({ editContent: content })}
              onSave={() => handleEdit(comment.id, state.editContent)}
              onCancel={() =>
                updateState({ editingComment: null, editContent: '' })
              }
            />
          ) : (
            <div className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
              {comment.content}
            </div>
          )}
        </div>

        {comment.replies?.length > 0 && (
          <div className="border-l-2 border-gray-200 dark:border-gray-700 ml-4 pl-4">
            {comment.replies.map(reply => renderComment(reply, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  if (state.loading) {
    return (
      <div className="mt-16 border-t border-gray-200 dark:border-gray-700 pt-8">
        <div className="flex items-center justify-center py-8">
          <div className="text-gray-500 dark:text-gray-400">
            Loading comments...
          </div>
        </div>
      </div>
    );
  }

  const approvedComments = state.comments.filter(
    comment => comment.is_approved
  );
  const pendingComments = state.comments.filter(
    comment => !comment.is_approved && comment.session_id === getSessionId()
  );
  const organizedComments = organizeComments(approvedComments);
  const replyingToComment = state.comments.find(c => c.id === state.replyingTo);

  return (
    <div className="mt-16 border-t border-gray-200 dark:border-gray-700 pt-8">
      {state.error && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-red-700 dark:text-red-400">{state.error}</p>
        </div>
      )}

      {pendingComments.length > 0 && (
        <div className="mb-8">
          <h4 className="text-lg font-semibold mb-4">Your Pending Comments</h4>
          {pendingComments.map(comment => renderComment(comment))}
        </div>
      )}

      <div className="mb-8">
        {organizedComments.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400 italic">
            No comments yet. Be the first to share your thoughts!
          </p>
        ) : (
          <div className="space-y-0">
            {organizedComments.map(comment => renderComment(comment))}
          </div>
        )}
      </div>

      <div id="comment-form" className="mt-8">
        <h3 className="text-xl font-bold mb-4">
          {state.replyingTo ? 'Reply to Comment' : 'Leave a Reply'}
        </h3>

        {replyingToComment && (
          <ReplyContext
            comment={replyingToComment}
            onCancel={() => updateState({ replyingTo: null })}
          />
        )}

        <div className="mb-4 text-sm text-gray-600 dark:text-gray-400">
          <p>
            All comments are treated as letters to me. Anyone who feels unjustly
            censored is welcome to the rest of the Internet.
          </p>
          <p className="mt-2 text-orange-600 dark:text-orange-400">
            <strong>Note:</strong> You can edit or delete your comments for 5
            minutes after posting.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input
              type="text"
              required
              value={state.newComment.name}
              onChange={e =>
                updateState({
                  newComment: { ...state.newComment, name: e.target.value },
                })
              }
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              placeholder="Name (required)"
            />
            <input
              type="email"
              value={state.newComment.email}
              onChange={e =>
                updateState({
                  newComment: { ...state.newComment, email: e.target.value },
                })
              }
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              placeholder="Mail (not published, but required)"
            />
          </div>

          <textarea
            required
            rows={6}
            value={state.newComment.content}
            onChange={e =>
              updateState({
                newComment: { ...state.newComment, content: e.target.value },
              })
            }
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            placeholder="Share your thoughts..."
          />

          <button
            type="submit"
            disabled={
              state.isSubmitting ||
              !state.newComment.name.trim() ||
              !state.newComment.content.trim()
            }
            className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {state.isSubmitting
              ? 'Submitting Comment...'
              : state.replyingTo
                ? 'Post Reply'
                : 'Submit'}
          </button>
        </form>
      </div>
    </div>
  );
}
