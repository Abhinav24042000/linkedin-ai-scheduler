import React, { useState, useEffect, useCallback } from 'react';
import {
  History as HistoryIcon,
  ChevronLeft,
  ChevronRight,
  Filter,
  ExternalLink,
  AlertTriangle,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import { getHistory } from '../api';
import { useToast } from '../context/ToastContext';
import StatusBadge from '../components/StatusBadge';
import EmptyState from '../components/EmptyState';
import LoadingSpinner from '../components/LoadingSpinner';

/**
 * Published posts history page.
 */
export default function History() {
  const { addToast } = useToast();

  const [posts, setPosts] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');

  const limit = 20;
  const totalPages = Math.ceil(total / limit);

  // Fetch history
  const fetchHistory = useCallback(async () => {
    try {
      setLoading(true);
      const response = await getHistory({ page, limit });
      let historyPosts = response.data.posts || [];

      // Client-side status filtering
      if (statusFilter !== 'all') {
        historyPosts = historyPosts.filter((p) => p.status === statusFilter);
      }

      setPosts(historyPosts);
      setTotal(response.data.total || 0);
    } catch (err) {
      addToast('Failed to load history', 'error');
    } finally {
      setLoading(false);
    }
  }, [page, limit, statusFilter, addToast]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  // Format date
  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  // Parse topics
  const parseTopics = (topics) => {
    if (Array.isArray(topics)) return topics;
    if (typeof topics === 'string') {
      try { return JSON.parse(topics); } catch { return topics.split(',').map(t => t.trim()).filter(Boolean); }
    }
    return [];
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <LoadingSpinner size="lg" text="Loading history..." />
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">History</h1>
          <p className="text-sm text-gray-500 mt-1">Your published and failed posts</p>
        </div>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2 mb-6">
        <Filter size={14} className="text-gray-400" />
        {['all', 'published', 'failed'].map((filter) => (
          <button
            key={filter}
            onClick={() => {
              setStatusFilter(filter);
              setPage(1);
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              statusFilter === filter
                ? 'bg-linkedin text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {filter === 'all' ? 'All' : filter.charAt(0).toUpperCase() + filter.slice(1)}
          </button>
        ))}
      </div>

      {/* Posts list */}
      {posts.length === 0 ? (
        <EmptyState
          icon={HistoryIcon}
          title="No history yet"
          description="Published and failed posts will appear here. Start by creating and publishing your first post."
        />
      ) : (
        <div className="space-y-4">
          {posts.map((post) => {
            const topics = parseTopics(post.topics);
            const isPublished = post.status === 'published';
            const isFailed = post.status === 'failed';

            return (
              <div
                key={post.id}
                className="bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow overflow-hidden"
              >
                <div className="p-5">
                  {/* Header */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <StatusBadge status={post.status} />
                      {isPublished && (
                        <span className="flex items-center gap-1 text-xs text-green-600">
                          <CheckCircle size={12} />
                        </span>
                      )}
                      {isFailed && (
                        <span className="flex items-center gap-1 text-xs text-red-500">
                          <XCircle size={12} />
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-gray-400">
                      {formatDate(post.published_at || post.publishedAt || post.updated_at || post.updatedAt || post.created_at || post.createdAt)}
                    </span>
                  </div>

                  {/* Content */}
                  <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed mb-3 line-clamp-4">
                    {post.content}
                  </p>

                  {/* Error message for failed posts */}
                  {isFailed && (post.error_message || post.errorMessage) && (
                    <div className="flex items-start gap-2 p-2.5 rounded-lg bg-red-50 border border-red-100 mb-3">
                      <AlertTriangle size={14} className="text-red-500 flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-red-700">{post.error_message || post.errorMessage}</p>
                    </div>
                  )}

                  {/* Topics and tone */}
                  <div className="flex flex-wrap items-center gap-2">
                    {topics.map((topic, idx) => (
                      <span
                        key={idx}
                        className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600"
                      >
                        {topic}
                      </span>
                    ))}
                    {post.tone && (
                      <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-600">
                        {post.tone}
                      </span>
                    )}
                  </div>

                  {/* LinkedIn link */}
                  {(post.linkedin_post_url || post.linkedinPostUrl) && (
                    <div className="mt-3">
                      <a
                        href={post.linkedin_post_url || post.linkedinPostUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs text-linkedin font-medium hover:text-linkedin-dark transition-colors"
                      >
                        <ExternalLink size={12} />
                        View on LinkedIn
                      </a>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft size={18} />
          </button>
          <span className="text-sm text-gray-600 px-3">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      )}
    </div>
  );
}
