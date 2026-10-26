import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText,
  Search,
  Trash2,
  ChevronLeft,
  ChevronRight,
  CheckSquare,
  Square,
  X,
} from 'lucide-react';
import {
  getPosts,
  deletePost,
  publishPost,
  updatePost,
} from '../api';
import { useToast } from '../context/ToastContext';
import PostCard from '../components/PostCard';
import PostEditor from '../components/PostEditor';
import ScheduleModal from '../components/ScheduleModal';
import EmptyState from '../components/EmptyState';
import LoadingSpinner from '../components/LoadingSpinner';
import { createSchedule } from '../api';

/**
 * Drafts listing page with search, pagination, and bulk actions.
 */
export default function Drafts() {
  const navigate = useNavigate();
  const { addToast } = useToast();

  const [posts, setPosts] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState(new Set());

  // Edit mode
  const [editingPost, setEditingPost] = useState(null);
  const [editContent, setEditContent] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  // Schedule modal
  const [schedulePost, setSchedulePost] = useState(null);

  const limit = 20;
  const totalPages = Math.ceil(total / limit);

  // Fetch drafts
  const fetchDrafts = useCallback(async () => {
    try {
      setLoading(true);
      const response = await getPosts({ status: 'draft', page, limit });
      setPosts(response.data.posts || []);
      setTotal(response.data.total || 0);
    } catch (err) {
      addToast('Failed to load drafts', 'error');
    } finally {
      setLoading(false);
    }
  }, [page, limit, addToast]);

  useEffect(() => {
    fetchDrafts();
  }, [fetchDrafts]);

  // Filter posts by search query (client-side)
  const filteredPosts = searchQuery.trim()
    ? posts.filter((p) =>
        p.content?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : posts;

  // Handle edit
  const handleEdit = (post) => {
    setEditingPost(post);
    setEditContent(post.content || '');
  };

  // Save edit
  const handleSaveEdit = async () => {
    if (!editingPost) return;
    try {
      setEditSaving(true);
      await updatePost(editingPost.id, { content: editContent });
      addToast('Draft updated!', 'success');
      setEditingPost(null);
      fetchDrafts();
    } catch (err) {
      addToast(err.message || 'Failed to update draft', 'error');
    } finally {
      setEditSaving(false);
    }
  };

  // Handle delete
  const handleDelete = async (post) => {
    if (!window.confirm('Are you sure you want to delete this draft?')) return;
    try {
      await deletePost(post.id);
      addToast('Draft deleted', 'success');
      setPosts((prev) => prev.filter((p) => p.id !== post.id));
      setTotal((prev) => prev - 1);
    } catch (err) {
      addToast(err.message || 'Failed to delete draft', 'error');
    }
  };

  // Handle publish
  const handlePublish = async (post) => {
    if (!window.confirm('Publish this post to LinkedIn now?')) return;
    try {
      await publishPost(post.id);
      addToast('Post published!', 'success');
      fetchDrafts();
    } catch (err) {
      addToast(err.message || 'Failed to publish post', 'error');
    }
  };

  // Handle schedule
  const handleSchedule = (post) => {
    setSchedulePost(post);
  };

  const handleScheduleSubmit = async (scheduleData) => {
    if (!schedulePost) return;
    try {
      await createSchedule({
        postId: schedulePost.id,
        ...scheduleData,
      });
      addToast('Post scheduled!', 'success');
      setSchedulePost(null);
      fetchDrafts();
    } catch (err) {
      addToast(err.message || 'Failed to schedule post', 'error');
    }
  };

  // Bulk selection
  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredPosts.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredPosts.map((p) => p.id)));
    }
  };

  // Bulk delete
  const handleBulkDelete = async () => {
    if (!window.confirm(`Delete ${selectedIds.size} selected draft(s)?`)) return;
    try {
      await Promise.all([...selectedIds].map((id) => deletePost(id)));
      addToast(`${selectedIds.size} draft(s) deleted`, 'success');
      setSelectedIds(new Set());
      fetchDrafts();
    } catch (err) {
      addToast('Failed to delete some drafts', 'error');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <LoadingSpinner size="lg" text="Loading drafts..." />
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Drafts</h1>
          <p className="text-sm text-gray-500 mt-1">{total} draft{total !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {/* Search and bulk actions */}
      {posts.length > 0 && (
        <div className="flex items-center gap-3 mb-4">
          {/* Search */}
          <div className="relative flex-1 max-w-sm">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search drafts..."
              className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-linkedin/20 focus:border-linkedin outline-none transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-gray-400 hover:text-gray-600"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Select all */}
          <button
            onClick={toggleSelectAll}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            {selectedIds.size === filteredPosts.length && filteredPosts.length > 0 ? (
              <CheckSquare size={14} />
            ) : (
              <Square size={14} />
            )}
            Select All
          </button>

          {/* Bulk delete */}
          {selectedIds.size > 0 && (
            <button
              onClick={handleBulkDelete}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors"
            >
              <Trash2 size={14} />
              Delete ({selectedIds.size})
            </button>
          )}
        </div>
      )}

      {/* Edit mode */}
      {editingPost && (
        <div className="mb-6 bg-white rounded-xl border border-gray-200 shadow-md p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-900">Editing Draft</h3>
            <button
              onClick={() => setEditingPost(null)}
              className="text-gray-400 hover:text-gray-600"
            >
              <X size={18} />
            </button>
          </div>
          <PostEditor
            content={editContent}
            onChange={setEditContent}
            onSave={handleSaveEdit}
            saving={editSaving}
          />
        </div>
      )}

      {/* Posts list */}
      {filteredPosts.length === 0 ? (
        <EmptyState
          icon={FileText}
          title={searchQuery ? 'No matching drafts' : 'No drafts yet'}
          description={
            searchQuery
              ? 'Try a different search term.'
              : 'Start creating posts and save them as drafts to see them here.'
          }
          actionLabel={searchQuery ? undefined : 'Create Post'}
          onAction={searchQuery ? undefined : () => navigate('/create')}
        />
      ) : (
        <div className="space-y-4">
          {filteredPosts.map((post) => (
            <div key={post.id} className="flex items-start gap-3">
              {/* Checkbox */}
              <button
                onClick={() => toggleSelect(post.id)}
                className="mt-5 flex-shrink-0 text-gray-400 hover:text-linkedin transition-colors"
              >
                {selectedIds.has(post.id) ? (
                  <CheckSquare size={18} className="text-linkedin" />
                ) : (
                  <Square size={18} />
                )}
              </button>

              {/* Post card */}
              <div className="flex-1">
                <PostCard
                  post={post}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onPublish={handlePublish}
                  onSchedule={handleSchedule}
                />
              </div>
            </div>
          ))}
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

      {/* Schedule Modal */}
      <ScheduleModal
        isOpen={!!schedulePost}
        onClose={() => setSchedulePost(null)}
        onSchedule={handleScheduleSubmit}
      />
    </div>
  );
}
