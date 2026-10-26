import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  FileText,
  Calendar,
  CheckCircle,
  AlertTriangle,
  Plus,
  Clock,
  TrendingUp,
} from 'lucide-react';
import { getPosts, getSchedules, getHistory } from '../api';
import { useToast } from '../context/ToastContext';
import PostCard from '../components/PostCard';
import EmptyState from '../components/EmptyState';
import LoadingSpinner from '../components/LoadingSpinner';

/**
 * Main dashboard page with stats, recent activity, and upcoming schedules.
 */
export default function Dashboard() {
  const navigate = useNavigate();
  const { addToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ drafts: 0, scheduled: 0, published: 0, failed: 0 });
  const [recentPosts, setRecentPosts] = useState([]);
  const [upcomingSchedules, setUpcomingSchedules] = useState([]);

  // Fetch dashboard data
  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);

        // Fetch all data in parallel
        const [draftsRes, scheduledRes, historyRes, schedulesRes] = await Promise.all([
          getPosts({ status: 'draft', limit: 5 }).catch(() => ({ data: { posts: [], total: 0 } })),
          getPosts({ status: 'scheduled', limit: 5 }).catch(() => ({ data: { posts: [], total: 0 } })),
          getHistory({ limit: 10 }).catch(() => ({ data: { posts: [], total: 0 } })),
          getSchedules().catch(() => ({ data: { schedules: [] } })),
        ]);

        // Calculate stats
        const publishedPosts = (historyRes.data?.posts || []).filter((p) => p.status === 'published');
        const failedPosts = (historyRes.data?.posts || []).filter((p) => p.status === 'failed');

        setStats({
          drafts: draftsRes.data?.total || 0,
          scheduled: scheduledRes.data?.total || 0,
          published: publishedPosts.length,
          failed: failedPosts.length,
        });

        // Combine and sort recent posts
        const allPosts = [
          ...(draftsRes.data?.posts || []),
          ...(scheduledRes.data?.posts || []),
          ...(historyRes.data?.posts || []).slice(0, 5),
        ];
        // Deduplicate by id
        const uniquePosts = Array.from(new Map(allPosts.map((p) => [p.id, p])).values());
        uniquePosts.sort((a, b) => new Date(b.created_at || b.createdAt) - new Date(a.created_at || a.createdAt));
        setRecentPosts(uniquePosts.slice(0, 5));

        // Upcoming schedules
        const schedules = schedulesRes.data?.schedules || [];
        const upcoming = schedules
          .filter((s) => s.status === 'active' || s.status === 'scheduled')
          .sort((a, b) => new Date(a.scheduled_at || a.scheduledAt) - new Date(b.scheduled_at || b.scheduledAt))
          .slice(0, 3);
        setUpcomingSchedules(upcoming);
      } catch (err) {
        addToast('Failed to load dashboard data', 'error');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [addToast]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <LoadingSpinner size="lg" text="Loading dashboard..." />
      </div>
    );
  }

  const hasAnyContent = recentPosts.length > 0 || upcomingSchedules.length > 0;

  // Stat card config
  const statCards = [
    { label: 'Total Drafts', value: stats.drafts, icon: FileText, color: 'text-gray-600', bg: 'bg-gray-100' },
    { label: 'Scheduled', value: stats.scheduled, icon: Calendar, color: 'text-blue-600', bg: 'bg-blue-100' },
    { label: 'Published', value: stats.published, icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-100' },
    { label: 'Failed', value: stats.failed, icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-100' },
  ];

  // Format countdown for upcoming schedules
  const formatCountdown = (dateStr) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = date - now;
    if (diff < 0) return 'Overdue';
    const hours = Math.floor(diff / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `in ${days}d ${hours % 24}h`;
    }
    if (hours > 0) return `in ${hours}h ${minutes}m`;
    return `in ${minutes}m`;
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">Overview of your LinkedIn content</p>
        </div>
        <button
          onClick={() => navigate('/create')}
          className="flex items-center gap-2 px-4 py-2.5 bg-linkedin text-white rounded-xl text-sm font-semibold hover:bg-linkedin-dark transition-colors shadow-sm"
        >
          <Plus size={18} />
          Quick Create
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {statCards.map((stat) => (
          <div
            key={stat.label}
            className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between mb-3">
              <div className={`p-2 rounded-lg ${stat.bg}`}>
                <stat.icon size={18} className={stat.color} />
              </div>
              <TrendingUp size={14} className="text-gray-300" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>

      {!hasAnyContent ? (
        <EmptyState
          icon={LayoutDashboard}
          title="Welcome to LinkedIn Scheduler!"
          description="Get started by creating your first AI-generated LinkedIn post. Choose topics, set your tone, and let AI do the heavy lifting."
          actionLabel="Create Your First Post"
          onAction={() => navigate('/create')}
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent Activity */}
          <div className="lg:col-span-2">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h2>
            <div className="space-y-4">
              {recentPosts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  showActions={false}
                />
              ))}
            </div>
          </div>

          {/* Upcoming Schedules */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Upcoming</h2>
            {upcomingSchedules.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 text-center">
                <Calendar className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500">No upcoming schedules</p>
              </div>
            ) : (
              <div className="space-y-3">
                {upcomingSchedules.map((schedule) => (
                  <div
                    key={schedule.id}
                    className="bg-white rounded-xl border border-gray-100 shadow-sm p-4"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <Clock size={14} className="text-linkedin" />
                      <span className="text-xs font-semibold text-linkedin">
                        {formatCountdown(schedule.scheduled_at || schedule.scheduledAt)}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 line-clamp-2">
                      {schedule.post?.content || schedule.postContent || 'Scheduled post'}
                    </p>
                    <p className="text-[10px] text-gray-400 mt-2">
                      {new Date(schedule.scheduled_at || schedule.scheduledAt).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
