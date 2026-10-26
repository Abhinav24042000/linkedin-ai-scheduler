import React, { useState, useEffect, useMemo } from 'react';
import { X, Calendar, Clock, Repeat, AlertTriangle } from 'lucide-react';

/**
 * Common timezone options.
 */
const TIMEZONES = [
  { value: 'UTC', label: 'UTC' },
  { value: 'America/New_York', label: 'US Eastern (ET)' },
  { value: 'America/Chicago', label: 'US Central (CT)' },
  { value: 'America/Denver', label: 'US Mountain (MT)' },
  { value: 'America/Los_Angeles', label: 'US Pacific (PT)' },
  { value: 'Europe/London', label: 'UK (GMT/BST)' },
  { value: 'Europe/Berlin', label: 'EU Central (CET)' },
  { value: 'Europe/Paris', label: 'France (CET)' },
  { value: 'Asia/Kolkata', label: 'India (IST)' },
  { value: 'Asia/Tokyo', label: 'Japan (JST)' },
  { value: 'Asia/Shanghai', label: 'China (CST)' },
  { value: 'Australia/Sydney', label: 'Australia Eastern (AEST)' },
  { value: 'Pacific/Auckland', label: 'New Zealand (NZST)' },
];

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/**
 * Modal dialog for scheduling a post.
 * @param {object} props
 * @param {boolean} props.isOpen - Whether modal is open
 * @param {Function} props.onClose - Close handler
 * @param {Function} props.onSchedule - Schedule handler
 * @param {object} [props.existingSchedule] - Existing schedule data for editing
 */
export default function ScheduleModal({ isOpen, onClose, onSchedule, existingSchedule }) {
  const [scheduledAt, setScheduledAt] = useState('');
  const [timezone, setTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceType, setRecurrenceType] = useState('daily');
  const [weeklyDays, setWeeklyDays] = useState([]);
  const [customInterval, setCustomInterval] = useState(2);
  const [requiresApproval, setRequiresApproval] = useState(false);
  const [error, setError] = useState('');

  // Initialize from existing schedule
  useEffect(() => {
    if (existingSchedule) {
      if (existingSchedule.scheduledAt || existingSchedule.scheduled_at) {
        const dt = new Date(existingSchedule.scheduledAt || existingSchedule.scheduled_at);
        setScheduledAt(formatDatetimeLocal(dt));
      }
      if (existingSchedule.timezone) setTimezone(existingSchedule.timezone);
      if (existingSchedule.isRecurring || existingSchedule.is_recurring) {
        setIsRecurring(true);
        const pattern = existingSchedule.recurrencePattern || existingSchedule.recurrence_pattern || '';
        if (pattern.startsWith('weekly:')) {
          setRecurrenceType('weekly');
          setWeeklyDays(pattern.replace('weekly:', '').split(',').filter(Boolean));
        } else if (pattern.startsWith('every:')) {
          setRecurrenceType('custom');
          setCustomInterval(parseInt(pattern.replace('every:', '')) || 2);
        } else {
          setRecurrenceType('daily');
        }
      }
      setRequiresApproval(existingSchedule.requiresApproval || existingSchedule.requires_approval || false);
    } else {
      // Default to 1 hour from now
      const defaultDate = new Date(Date.now() + 3600000);
      setScheduledAt(formatDatetimeLocal(defaultDate));
    }
  }, [existingSchedule, isOpen]);

  function formatDatetimeLocal(date) {
    const pad = (n) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  // Build recurrence pattern string
  const recurrencePattern = useMemo(() => {
    if (!isRecurring) return null;
    switch (recurrenceType) {
      case 'daily':
        return 'daily';
      case 'weekly':
        return `weekly:${weeklyDays.join(',')}`;
      case 'custom':
        return `every:${customInterval}`;
      default:
        return 'daily';
    }
  }, [isRecurring, recurrenceType, weeklyDays, customInterval]);

  // Validate and submit
  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    if (!scheduledAt) {
      setError('Please select a date and time.');
      return;
    }

    const selectedDate = new Date(scheduledAt);
    if (selectedDate <= new Date()) {
      setError('Scheduled time must be in the future.');
      return;
    }

    if (isRecurring && recurrenceType === 'weekly' && weeklyDays.length === 0) {
      setError('Please select at least one day for weekly recurrence.');
      return;
    }

    onSchedule({
      scheduledAt: selectedDate.toISOString(),
      timezone,
      isRecurring,
      recurrencePattern,
      requiresApproval,
    });
  };

  // Toggle day in weekly selection
  const toggleDay = (day) => {
    setWeeklyDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  // Preview next scheduled time
  const previewTime = useMemo(() => {
    if (!scheduledAt) return null;
    try {
      const date = new Date(scheduledAt);
      return date.toLocaleString('en-US', {
        timeZone: timezone,
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        timeZoneName: 'short',
      });
    } catch {
      return null;
    }
  }, [scheduledAt, timezone]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 modal-backdrop" onClick={onClose}>
      <div className="fixed inset-0 bg-black/50" />
      <div
        className="relative bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto z-10"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-linkedin" />
            <h2 className="text-lg font-semibold text-gray-900">
              {existingSchedule ? 'Edit Schedule' : 'Schedule Post'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Date/Time picker */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              <div className="flex items-center gap-1.5">
                <Clock size={14} />
                Date & Time
              </div>
            </label>
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-linkedin/20 focus:border-linkedin outline-none transition-colors"
            />
          </div>

          {/* Timezone selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Timezone</label>
            <select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-linkedin/20 focus:border-linkedin outline-none transition-colors bg-white"
            >
              {TIMEZONES.map((tz) => (
                <option key={tz.value} value={tz.value}>{tz.label}</option>
              ))}
            </select>
          </div>

          {/* Preview */}
          {previewTime && (
            <div className="px-3 py-2 rounded-lg bg-blue-50 border border-blue-100">
              <p className="text-xs text-blue-700">
                <span className="font-medium">Next post:</span> {previewTime}
              </p>
            </div>
          )}

          {/* Recurring toggle */}
          <div>
            <label className="flex items-center gap-3 cursor-pointer">
              <div className="relative">
                <input
                  type="checkbox"
                  checked={isRecurring}
                  onChange={(e) => setIsRecurring(e.target.checked)}
                  className="sr-only"
                />
                <div className={`w-10 h-5 rounded-full transition-colors ${isRecurring ? 'bg-linkedin' : 'bg-gray-300'}`}>
                  <div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform mt-0.5 ${isRecurring ? 'translate-x-5.5 ml-[22px]' : 'ml-0.5'}`} />
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <Repeat size={14} className="text-gray-500" />
                <span className="text-sm font-medium text-gray-700">Recurring Schedule</span>
              </div>
            </label>
          </div>

          {/* Recurring options */}
          {isRecurring && (
            <div className="pl-4 border-l-2 border-linkedin/20 space-y-4">
              {/* Recurrence type */}
              <div className="flex gap-2">
                {['daily', 'weekly', 'custom'].map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setRecurrenceType(type)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      recurrenceType === type
                        ? 'bg-linkedin text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </button>
                ))}
              </div>

              {/* Weekly: day checkboxes */}
              {recurrenceType === 'weekly' && (
                <div className="flex flex-wrap gap-2">
                  {DAYS_OF_WEEK.map((day) => (
                    <button
                      key={day}
                      type="button"
                      onClick={() => toggleDay(day)}
                      className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                        weeklyDays.includes(day)
                          ? 'bg-linkedin text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {day.slice(0, 3)}
                    </button>
                  ))}
                </div>
              )}

              {/* Custom: interval input */}
              {recurrenceType === 'custom' && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">Every</span>
                  <input
                    type="number"
                    min="1"
                    max="365"
                    value={customInterval}
                    onChange={(e) => setCustomInterval(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-20 px-2 py-1.5 border border-gray-300 rounded-lg text-sm text-center focus:ring-2 focus:ring-linkedin/20 focus:border-linkedin outline-none"
                  />
                  <span className="text-sm text-gray-600">days</span>
                </div>
              )}
            </div>
          )}

          {/* Requires approval toggle */}
          <label className="flex items-center gap-3 cursor-pointer">
            <div className="relative">
              <input
                type="checkbox"
                checked={requiresApproval}
                onChange={(e) => setRequiresApproval(e.target.checked)}
                className="sr-only"
              />
              <div className={`w-10 h-5 rounded-full transition-colors ${requiresApproval ? 'bg-linkedin' : 'bg-gray-300'}`}>
                <div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform mt-0.5 ${requiresApproval ? 'translate-x-5.5 ml-[22px]' : 'ml-0.5'}`} />
              </div>
            </div>
            <span className="text-sm font-medium text-gray-700">Require approval before publishing</span>
          </label>

          {/* Error message */}
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-100">
              <AlertTriangle size={14} className="text-red-500 flex-shrink-0" />
              <p className="text-xs text-red-700">{error}</p>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-sm font-medium text-white bg-linkedin rounded-lg hover:bg-linkedin-dark transition-colors"
            >
              {existingSchedule ? 'Update Schedule' : 'Schedule Post'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
