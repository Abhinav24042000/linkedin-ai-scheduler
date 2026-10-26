import React, { useState, useEffect, useCallback } from 'react';
import {
  Calendar,
  Clock,
  Pause,
  Play,
  Trash2,
  Edit,
  Check,
  Repeat,
  AlertTriangle,
  Sparkles,
  Zap,
  Plus,
  ShieldCheck,
  Globe,
  Tag,
} from 'lucide-react';
import {
  getSchedules,
  deleteSchedule,
  pauseSchedule,
  resumeSchedule,
  approveSchedule,
  updateSchedule,
  runNowSchedule,
} from '../api';
import { useToast } from '../context/ToastContext';
import StatusBadge from '../components/StatusBadge';
import ScheduleModal from '../components/ScheduleModal';
import AutoScheduleModal from '../components/AutoScheduleModal';
import EmptyState from '../components/EmptyState';
import LoadingSpinner from '../components/LoadingSpinner';

export default function Scheduled() {
  const { addToast } = useToast();

  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingSchedule, setEditingSchedule] = useState(null);
  const [autoModalOpen, setAutoModalOpen] = useState(false);
  const [editingAutoSchedule, setEditingAutoSchedule] = useState(null);
  const [runningId, setRunningId] = useState(null);

  // Fetch schedules
  const fetchSchedules = useCallback(async () => {
    try {
      setLoading(true);
      const response = await getSchedules();
      setSchedules(response.data.schedules || []);
    } catch (err) {
      addToast('Failed to load schedules', 'error');
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    fetchSchedules();
  }, [fetchSchedules]);

  // Separate schedules by type
  const autoSchedules = schedules.filter(
    (s) => s.scheduleType === 'ai_auto' || s.schedule_type === 'ai_auto'
  );
  const oneTimeSchedules = schedules.filter(
    (s) => !(s.is_recurring || s.isRecurring) && s.scheduleType !== 'ai_auto' && s.schedule_type !== 'ai_auto'
  );
  const recurringPostSchedules = schedules.filter(
    (s) => (s.is_recurring || s.isRecurring) && s.scheduleType !== 'ai_auto' && s.schedule_type !== 'ai_auto'
  );

  // Handle Pause
  const handlePause = async (schedule) => {
    try {
      await pauseSchedule(schedule.id);
      addToast('Schedule paused', 'success');
      fetchSchedules();
    } catch (err) {
      addToast(err.message || 'Failed to pause schedule', 'error');
    }
  };

  // Handle Resume
  const handleResume = async (schedule) => {
    try {
      await resumeSchedule(schedule.id);
      addToast('Schedule resumed', 'success');
      fetchSchedules();
    } catch (err) {
      addToast(err.message || 'Failed to resume schedule', 'error');
    }
  };

  // Handle Delete
  const handleDelete = async (schedule) => {
    if (!window.confirm(`Delete schedule "${schedule.title || 'this schedule'}"?`)) return;
    try {
      await deleteSchedule(schedule.id);
      addToast('Schedule deleted', 'success');
      setSchedules((prev) => prev.filter((s) => s.id !== schedule.id));
    } catch (err) {
      addToast(err.message || 'Failed to delete schedule', 'error');
    }
  };

  // Handle Approve
  const handleApprove = async (schedule) => {
    try {
      await approveSchedule(schedule.id);
      addToast('Schedule approved and post will be published', 'success');
      fetchSchedules();
    } catch (err) {
      addToast(err.message || 'Failed to approve schedule', 'error');
    }
  };

  // Handle Run Now
  const handleRunNow = async (schedule) => {
    try {
      setRunningId(schedule.id);
      await runNowSchedule(schedule.id);
      addToast(
        schedule.requiresApproval
          ? 'Post generated and placed in Pending Approval drafts!'
          : 'Post generated & publishing initiated to LinkedIn!',
        'success'
      );
      fetchSchedules();
    } catch (err) {
      addToast(err.message || 'Failed to execute schedule', 'error');
    } finally {
      setRunningId(null);
    }
  };

  // Format date helper
  const formatDate = (dateStr) => {
    if (!dateStr) return 'Not set';
    return new Date(dateStr).toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short',
    });
  };

  const describeFrequency = (schedule) => {
    const freq = schedule.frequency || 'daily';
    if (freq === 'daily') return 'Everyday (Daily)';
    if (freq === '3days') return 'Every 3 Days';
    if (freq === '2weeks') return 'Every 2 Weeks';
    if (freq === 'monthly') return 'Monthly';
    if (freq === 'weekly') {
      const days = schedule.frequencyDays || [];
      return days.length ? `Weekly (${days.map((d) => d.slice(0, 3)).join(', ')})` : 'Weekly';
    }
    if (freq === 'custom') return `Every ${schedule.intervalDays || 1} days`;
    return freq;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <LoadingSpinner size="lg" text="Loading schedules..." />
      </div>
    );
  }

  return (
    <div>
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Post Scheduling & Automation</h1>
          <p className="text-sm text-gray-500 mt-1">
            Automate your LinkedIn presence with autonomous multi-time posting schedules.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => {
              setEditingAutoSchedule(null);
              setAutoModalOpen(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-linkedin text-white text-sm font-semibold rounded-xl hover:bg-linkedin-dark transition-all shadow-md shadow-linkedin/20 hover:shadow-lg"
          >
            <Sparkles size={16} />
            + New Auto Schedule
          </button>
        </div>
      </div>

      {/* Empty State */}
      {schedules.length === 0 ? (
        <EmptyState
          icon={Calendar}
          title="No schedules yet"
          description="Create an autonomous AI posting campaign or schedule a draft. Set your frequency, times per day, and topics."
          actionLabel="Create Auto Schedule"
          onAction={() => setAutoModalOpen(true)}
        />
      ) : (
        <div className="space-y-10">
          {/* Section 1: Autonomous AI Campaigns */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Sparkles size={19} className="text-linkedin" />
                Autonomous AI Content Schedules ({autoSchedules.length})
              </h2>
            </div>

            {autoSchedules.length === 0 ? (
              <div className="p-6 rounded-2xl border border-dashed border-gray-200 bg-gray-50/50 text-center">
                <p className="text-sm font-medium text-gray-600">No autonomous schedules created yet.</p>
                <p className="text-xs text-gray-400 mt-1">
                  Set up a recurring schedule to automatically generate and publish posts based on your favorite topics.
                </p>
                <button
                  onClick={() => setAutoModalOpen(true)}
                  className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-linkedin bg-linkedin/10 hover:bg-linkedin/20 rounded-lg transition-colors"
                >
                  <Plus size={14} /> Add First Auto Schedule
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {autoSchedules.map((schedule) => {
                  const cfg = schedule.contentConfig || {};
                  const times = schedule.timesPerDay || ['09:00'];
                  const isRunning = runningId === schedule.id;

                  return (
                    <div
                      key={schedule.id}
                      className="bg-white rounded-2xl border border-gray-100 shadow-xs hover:shadow-md transition-all p-5 flex flex-col justify-between"
                    >
                      <div>
                        {/* Title & Status */}
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
                              <h3 className="text-base font-bold text-gray-900">
                                {schedule.title || 'Auto Schedule'}
                              </h3>
                            </div>
                            <p className="text-xs text-gray-400 mt-0.5">
                              {describeFrequency(schedule)} • {times.length}x daily
                            </p>
                          </div>
                          <StatusBadge status={schedule.status} />
                        </div>

                        {/* Badges / Cadence */}
                        <div className="flex flex-wrap items-center gap-1.5 mb-3 text-xs">
                          <span className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 font-semibold flex items-center gap-1">
                            <Clock size={12} />
                            {times.join(', ')}
                          </span>
                          <span className="px-2.5 py-1 rounded-lg bg-purple-50 text-purple-700 font-semibold flex items-center gap-1">
                            <Globe size={12} />
                            {schedule.timezone || 'UTC'}
                          </span>
                          <span
                            className={`px-2.5 py-1 rounded-lg font-semibold flex items-center gap-1 ${
                              schedule.requiresApproval
                                ? 'bg-amber-50 text-amber-700'
                                : 'bg-emerald-50 text-emerald-700'
                            }`}
                          >
                            <ShieldCheck size={12} />
                            {schedule.requiresApproval ? 'Approval Required' : 'Auto-Publish Direct'}
                          </span>
                        </div>

                        {/* Content Settings */}
                        <div className="p-3 bg-gray-50 rounded-xl mb-4 space-y-1.5">
                          <div className="flex items-center gap-1.5 text-xs text-gray-600">
                            <Tag size={13} className="text-gray-400 shrink-0" />
                            <span className="font-semibold text-gray-700">Topics:</span>
                            <span className="truncate">
                              {(cfg.topics || ['Technology']).join(', ')}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-gray-500">
                            <span>
                              <strong className="text-gray-700">Tone:</strong> {cfg.tone || 'Professional'}
                            </span>
                            <span>•</span>
                            <span>
                              <strong className="text-gray-700">Length:</strong> {cfg.length || 'medium'}
                            </span>
                          </div>
                          {cfg.customTopics && (
                            <p className="text-[11px] text-gray-500 italic line-clamp-1">
                              "{cfg.customTopics}"
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Footer Actions */}
                      <div className="pt-3 border-t border-gray-100 flex items-center justify-between text-xs">
                        <div className="text-[11px] text-gray-400">
                          Next: <span className="font-medium text-gray-700">{formatDate(schedule.nextRunAt)}</span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          {/* Run Now Button */}
                          <button
                            onClick={() => handleRunNow(schedule)}
                            disabled={isRunning}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-linkedin/10 hover:bg-linkedin/20 text-linkedin font-bold rounded-lg transition-colors disabled:opacity-50"
                            title="Generate and run this schedule right now"
                          >
                            <Zap size={13} className={isRunning ? 'animate-bounce' : ''} />
                            {isRunning ? 'Running...' : 'Run Now'}
                          </button>

                          {/* Pause / Resume */}
                          {schedule.status === 'active' ? (
                            <button
                              onClick={() => handlePause(schedule)}
                              className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                              title="Pause"
                            >
                              <Pause size={15} />
                            </button>
                          ) : (
                            <button
                              onClick={() => handleResume(schedule)}
                              className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                              title="Resume"
                            >
                              <Play size={15} />
                            </button>
                          )}

                          {/* Edit */}
                          <button
                            onClick={() => {
                              setEditingAutoSchedule(schedule);
                              setAutoModalOpen(true);
                            }}
                            className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                            title="Edit"
                          >
                            <Edit size={15} />
                          </button>

                          {/* Delete */}
                          <button
                            onClick={() => handleDelete(schedule)}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Section 2: Specific Post Schedules */}
          {(oneTimeSchedules.length > 0 || recurringPostSchedules.length > 0) && (
            <div>
              <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Clock size={19} className="text-linkedin" />
                Post Specific Schedules ({oneTimeSchedules.length + recurringPostSchedules.length})
              </h2>

              <div className="space-y-3">
                {[...oneTimeSchedules, ...recurringPostSchedules].map((schedule) => (
                  <div
                    key={schedule.id}
                    className="p-4 bg-white rounded-xl border border-gray-100 shadow-2xs hover:shadow-sm transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <StatusBadge status={schedule.status} />
                        <span className="text-xs text-gray-400">
                          Scheduled: {formatDate(schedule.scheduledAt || schedule.nextRunAt)}
                        </span>
                      </div>
                      <p className="text-xs text-gray-700 font-medium line-clamp-2">
                        {schedule.post?.content || 'Scheduled post content'}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {schedule.status === 'pending_approval' && (
                        <button
                          onClick={() => handleApprove(schedule)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
                        >
                          <Check size={13} /> Approve
                        </button>
                      )}
                      {schedule.status === 'active' ? (
                        <button
                          onClick={() => handlePause(schedule)}
                          className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-gray-50 rounded-lg"
                        >
                          <Pause size={15} />
                        </button>
                      ) : (
                        <button
                          onClick={() => handleResume(schedule)}
                          className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-gray-50 rounded-lg"
                        >
                          <Play size={15} />
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(schedule)}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-gray-50 rounded-lg"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Auto Schedule Modal */}
      <AutoScheduleModal
        isOpen={autoModalOpen}
        onClose={() => {
          setAutoModalOpen(false);
          setEditingAutoSchedule(null);
        }}
        onCreated={fetchSchedules}
        existingSchedule={editingAutoSchedule}
      />

      {/* Classic Schedule Modal */}
      <ScheduleModal
        isOpen={!!editingSchedule}
        onClose={() => setEditingSchedule(null)}
        onSchedule={async (data) => {
          if (!editingSchedule) return;
          await updateSchedule(editingSchedule.id, data);
          setEditingSchedule(null);
          fetchSchedules();
        }}
        existingSchedule={editingSchedule}
      />
    </div>
  );
}
