import React, { useState } from 'react';
import { Edit, Trash2, Send, Calendar, Clock, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';
import StatusBadge from './StatusBadge';

/**
 * Reusable card component for displaying a post.
 * @param {object} props
 * @param {object} props.post - Post data object
 * @param {Function} [props.onEdit] - Edit handler
 * @param {Function} [props.onDelete] - Delete handler
 * @param {Function} [props.onPublish] - Publish handler
 * @param {Function} [props.onSchedule] - Schedule handler
 * @param {boolean} [props.showActions=true] - Whether to show action buttons
 */
export default function PostCard({ post, onEdit, onDelete, onPublish, onSchedule, showActions = true }) {
  const [expanded, setExpanded] = useState(false);

  const content = post.content || '';
  const isLong = content.length > 200;
  const displayContent = expanded || !isLong ? content : content.slice(0, 200) + '...';

  // Parse topics
  const topics = (() => {
    if (Array.isArray(post.topics)) return post.topics;
    if (typeof post.topics === 'string') {
      try { return JSON.parse(post.topics); } catch { return post.topics.split(',').map(t => t.trim()).filter(Boolean); }
    }
    return [];
  })();

  // Format date
  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  // Topic colors
  const topicColors = [
    'bg-blue-100 text-blue-700',
    'bg-purple-100 text-purple-700',
    'bg-green-100 text-green-700',
    'bg-amber-100 text-amber-700',
    'bg-pink-100 text-pink-700',
    'bg-cyan-100 text-cyan-700',
    'bg-indigo-100 text-indigo-700',
    'bg-rose-100 text-rose-700',
  ];

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow overflow-hidden">
      <div className="p-5">
        {/* Header: status badge + date */}
        <div className="flex items-center justify-between mb-3">
          <StatusBadge status={post.status} />
          <span className="text-xs text-gray-400">{formatDate(post.created_at || post.createdAt)}</span>
        </div>

        {/* Post content */}
        <div className="mb-3">
          <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{displayContent}</p>
          {isLong && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-1 text-xs text-linkedin font-medium mt-1 hover:text-linkedin-dark transition-colors"
            >
              {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              {expanded ? 'Show less' : 'Show more'}
            </button>
          )}
        </div>

        {/* Topics */}
        {topics.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {topics.map((topic, idx) => (
              <span
                key={idx}
                className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${topicColors[idx % topicColors.length]}`}
              >
                {topic}
              </span>
            ))}
          </div>
        )}

        {/* Tone badge */}
        {post.tone && (
          <div className="mb-3">
            <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
              {post.tone}
            </span>
          </div>
        )}

        {/* Scheduled time */}
        {post.scheduled_at && (
          <div className="flex items-center gap-1.5 text-xs text-blue-600 mb-3">
            <Clock size={12} />
            <span>Scheduled: {formatDate(post.scheduled_at)}</span>
          </div>
        )}

        {/* Error message for failed posts */}
        {post.status === 'failed' && post.error_message && (
          <div className="flex items-start gap-2 p-2.5 rounded-lg bg-red-50 border border-red-100 mb-3">
            <AlertTriangle size={14} className="text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-red-700">{post.error_message}</p>
          </div>
        )}

        {/* Similarity warning */}
        {post.similarity_score > 0.6 && (
          <div className="flex items-center gap-1.5 text-xs text-amber-600 mb-3">
            <AlertTriangle size={12} />
            <span>{Math.round(post.similarity_score * 100)}% similar to previous content</span>
          </div>
        )}
      </div>

      {/* Action buttons */}
      {showActions && (
        <div className="flex items-center gap-1 px-4 py-3 border-t border-gray-50 bg-gray-50/50">
          {onEdit && (post.status === 'draft' || post.status === 'failed') && (
            <button
              onClick={() => onEdit(post)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-md transition-colors"
            >
              <Edit size={12} />
              Edit
            </button>
          )}
          {onSchedule && (post.status === 'draft') && (
            <button
              onClick={() => onSchedule(post)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-md transition-colors"
            >
              <Calendar size={12} />
              Schedule
            </button>
          )}
          {onPublish && (post.status === 'draft' || post.status === 'failed') && (
            <button
              onClick={() => onPublish(post)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-linkedin hover:text-linkedin-dark hover:bg-blue-50 rounded-md transition-colors"
            >
              <Send size={12} />
              Publish
            </button>
          )}
          {onDelete && (
            <button
              onClick={() => onDelete(post)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-500 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors ml-auto"
            >
              <Trash2 size={12} />
              Delete
            </button>
          )}
        </div>
      )}
    </div>
  );
}
