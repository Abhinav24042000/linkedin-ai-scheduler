import React, { useState, useEffect } from 'react';
import {
  X,
  Sparkles,
  Clock,
  Calendar,
  Plus,
  Trash2,
  Check,
  Hash,
  SmilePlus,
  Heading,
  Zap,
  ShieldCheck,
  Globe,
} from 'lucide-react';
import { createAutoSchedule, updateSchedule } from '../api';
import { useToast } from '../context/ToastContext';

const TOPIC_OPTIONS = [
  'Technology',
  'AI & Machine Learning',
  'Leadership',
  'Career Growth',
  'Software Architecture',
  'Industry News',
  'Personal Branding',
  'Remote Work',
  'Productivity',
  'Innovation',
  'Entrepreneurship',
  'Finance',
];

const TONE_OPTIONS = [
  'Professional',
  'Inspirational',
  'Casual',
  'Educational',
  'Conversational',
  'Thought-Provoking',
];

const LENGTH_OPTIONS = [
  { value: 'short', label: 'Short', desc: '~100 words' },
  { value: 'medium', label: 'Medium', desc: '~200 words' },
  { value: 'long', label: 'Long', desc: '~300+ words' },
];

const FREQUENCIES = [
  { id: 'daily', label: 'Everyday', desc: 'Post daily' },
  { id: '3days', label: 'Every 3 Days', desc: 'Every 3 days' },
  { id: 'weekly', label: 'Weekly', desc: 'Specific weekdays' },
  { id: '2weeks', label: 'Every 2 Weeks', desc: 'Bi-weekly cadence' },
  { id: 'monthly', label: 'Monthly', desc: 'Once a month' },
  { id: 'custom', label: 'Custom', desc: 'Every N days' },
];

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

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
  { value: 'Australia/Sydney', label: 'Australia (AEST)' },
];

export default function AutoScheduleModal({ isOpen, onClose, onCreated, existingSchedule }) {
  const { addToast } = useToast();

  const [title, setTitle] = useState('');
  const [selectedTopics, setSelectedTopics] = useState(['Technology', 'AI & Machine Learning']);
  const [customTopics, setCustomTopics] = useState('');
  const [tone, setTone] = useState('Professional');
  const [length, setLength] = useState('medium');
  const [useHeadings, setUseHeadings] = useState(true);
  const [useEmojis, setUseEmojis] = useState(true);
  const [useHashtags, setUseHashtags] = useState(true);

  // Recurrence
  const [frequency, setFrequency] = useState('daily');
  const [frequencyDays, setFrequencyDays] = useState(['Monday', 'Wednesday', 'Friday']);
  const [intervalDays, setIntervalDays] = useState(3);
  const [timesPerDay, setTimesPerDay] = useState(['09:00']);
  const [timezone, setTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
  const [requiresApproval, setRequiresApproval] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (existingSchedule) {
      setTitle(existingSchedule.title || '');
      const cfg = existingSchedule.contentConfig || {};
      setSelectedTopics(cfg.topics || ['Technology']);
      setCustomTopics(cfg.customTopics || '');
      setTone(cfg.tone || 'Professional');
      setLength(cfg.length || 'medium');
      setUseHeadings(cfg.useHeadings !== false);
      setUseEmojis(cfg.useEmojis !== false);
      setUseHashtags(cfg.useHashtags !== false);

      setFrequency(existingSchedule.frequency || 'daily');
      setFrequencyDays(existingSchedule.frequencyDays || ['Monday']);
      setIntervalDays(existingSchedule.intervalDays || 3);
      setTimesPerDay(existingSchedule.timesPerDay?.length ? existingSchedule.timesPerDay : ['09:00']);
      setTimezone(existingSchedule.timezone || 'UTC');
      setRequiresApproval(!!existingSchedule.requiresApproval);
    } else {
      setTitle('Daily AI Tech & Leadership');
      setSelectedTopics(['Technology', 'AI & Machine Learning']);
      setCustomTopics('');
      setTone('Professional');
      setLength('medium');
      setFrequency('daily');
      setTimesPerDay(['09:00']);
      setRequiresApproval(false);
    }
  }, [existingSchedule, isOpen]);

  if (!isOpen) return null;

  const toggleTopic = (topic) => {
    setSelectedTopics((prev) =>
      prev.includes(topic) ? prev.filter((t) => t !== topic) : [...prev, topic]
    );
  };

  const toggleWeekday = (day) => {
    setFrequencyDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const addTimeSlot = () => {
    if (timesPerDay.length >= 6) {
      addToast('Maximum 6 posts per day allowed', 'info');
      return;
    }
    const lastTime = timesPerDay[timesPerDay.length - 1] || '09:00';
    const [h] = lastTime.split(':').map(Number);
    const newH = Math.min(23, (h + 4) % 24);
    const newTime = `${String(newH).padStart(2, '0')}:00`;
    setTimesPerDay([...timesPerDay, newTime]);
  };

  const updateTimeSlot = (index, value) => {
    const updated = [...timesPerDay];
    updated[index] = value;
    setTimesPerDay(updated);
  };

  const removeTimeSlot = (index) => {
    if (timesPerDay.length === 1) {
      addToast('Must have at least one posting time', 'info');
      return;
    }
    setTimesPerDay(timesPerDay.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (selectedTopics.length === 0 && !customTopics.trim()) {
      addToast('Please select at least one topic or enter custom guidelines', 'error');
      return;
    }

    if (frequency === 'weekly' && frequencyDays.length === 0) {
      addToast('Please select at least one day for weekly frequency', 'error');
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        title: title.trim() || 'AI Content Campaign',
        contentConfig: {
          topics: selectedTopics,
          customTopics: customTopics.trim(),
          tone,
          length,
          useHeadings,
          useEmojis,
          useHashtags,
        },
        timesPerDay,
        frequency,
        frequencyDays,
        intervalDays: Number(intervalDays) || 1,
        requiresApproval,
        timezone,
      };

      if (existingSchedule?.id) {
        await updateSchedule(existingSchedule.id, payload);
        addToast('Schedule campaign updated successfully!', 'success');
      } else {
        await createAutoSchedule(payload);
        addToast('Autonomous AI schedule created successfully!', 'success');
      }

      onCreated?.();
      onClose();
    } catch (err) {
      addToast(err.message || 'Failed to save auto schedule', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden my-6">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-linkedin/5 via-blue-50/30 to-purple-50/20">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-linkedin text-white flex items-center justify-center shadow-sm">
              <Sparkles size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">
                {existingSchedule ? 'Edit Content Schedule' : 'Create Autonomous Content Schedule'}
              </h2>
              <p className="text-xs text-gray-500">
                Configure frequency, posting times, and AI post topics
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto flex-1">
          {/* Campaign Title */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
              Schedule Name / Campaign Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Daily Tech Insights & Cloud Architecture"
              className="w-full px-3.5 py-2.5 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-linkedin/20 focus:border-linkedin outline-none transition-colors"
              required
            />
          </div>

          {/* Section 1: Cadence & Frequency */}
          <div className="p-4 rounded-xl bg-gray-50/70 border border-gray-200/80 space-y-4">
            <div className="flex items-center gap-2">
              <Calendar size={16} className="text-linkedin" />
              <h3 className="text-sm font-bold text-gray-800">Recurrence Frequency</h3>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {FREQUENCIES.map((f) => {
                const active = frequency === f.id;
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setFrequency(f.id)}
                    className={`p-3 rounded-xl text-left border transition-all ${
                      active
                        ? 'border-linkedin bg-white shadow-sm ring-2 ring-linkedin/20'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    <p className={`text-xs font-bold ${active ? 'text-linkedin' : 'text-gray-800'}`}>
                      {f.label}
                    </p>
                    <p className="text-[10px] text-gray-400 mt-0.5">{f.desc}</p>
                  </button>
                );
              })}
            </div>

            {/* Weekly Days Picker */}
            {frequency === 'weekly' && (
              <div className="pt-2">
                <label className="block text-xs font-medium text-gray-600 mb-2">
                  Select Days of the Week:
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {WEEKDAYS.map((day) => {
                    const sel = frequencyDays.includes(day);
                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => toggleWeekday(day)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                          sel
                            ? 'bg-linkedin text-white shadow-sm'
                            : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-100'
                        }`}
                      >
                        {day.slice(0, 3)}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Custom Interval */}
            {frequency === 'custom' && (
              <div className="flex items-center gap-2 pt-1">
                <span className="text-xs text-gray-600">Post every</span>
                <input
                  type="number"
                  min="1"
                  max="365"
                  value={intervalDays}
                  onChange={(e) => setIntervalDays(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-20 px-3 py-1.5 border border-gray-300 rounded-lg text-xs text-center font-bold"
                />
                <span className="text-xs text-gray-600">days</span>
              </div>
            )}
          </div>

          {/* Section 2: Times per Day */}
          <div className="p-4 rounded-xl bg-gray-50/70 border border-gray-200/80 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock size={16} className="text-linkedin" />
                <h3 className="text-sm font-bold text-gray-800">
                  Times Per Day ({timesPerDay.length}x daily)
                </h3>
              </div>
              <button
                type="button"
                onClick={addTimeSlot}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-linkedin bg-linkedin/10 hover:bg-linkedin/20 rounded-lg transition-colors"
              >
                <Plus size={14} /> Add Time
              </button>
            </div>

            <p className="text-xs text-gray-500">
              Posts will be published at each specified time on matching schedule days.
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
              {timesPerDay.map((time, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 p-2 bg-white border border-gray-200 rounded-xl shadow-2xs"
                >
                  <input
                    type="time"
                    value={time}
                    onChange={(e) => updateTimeSlot(idx, e.target.value)}
                    className="flex-1 text-xs font-semibold text-gray-800 bg-transparent outline-none cursor-pointer"
                  />
                  {timesPerDay.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeTimeSlot(idx)}
                      className="p-1 text-gray-300 hover:text-red-500 rounded transition-colors"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2 pt-2 text-xs text-gray-500">
              <Globe size={13} />
              <span>Timezone:</span>
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="bg-white border border-gray-200 text-xs text-gray-700 px-2 py-1 rounded-md outline-none"
              >
                {TIMEZONES.map((tz) => (
                  <option key={tz.value} value={tz.value}>
                    {tz.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Section 3: AI Post Style & Topics */}
          <div className="p-4 rounded-xl bg-gray-50/70 border border-gray-200/80 space-y-4">
            <div className="flex items-center gap-2">
              <Sparkles size={16} className="text-linkedin" />
              <h3 className="text-sm font-bold text-gray-800">Post Type & AI Content Settings</h3>
            </div>

            {/* Topics */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-2">
                Select Content Topics:
              </label>
              <div className="flex flex-wrap gap-1.5">
                {TOPIC_OPTIONS.map((topic) => {
                  const sel = selectedTopics.includes(topic);
                  return (
                    <button
                      key={topic}
                      type="button"
                      onClick={() => toggleTopic(topic)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                        sel
                          ? 'bg-linkedin text-white shadow-xs'
                          : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      {sel && <Check size={12} />}
                      {topic}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom Topics / Prompt */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                Custom Topic Guidelines & Instructions (Optional):
              </label>
              <textarea
                value={customTopics}
                onChange={(e) => setCustomTopics(e.target.value)}
                placeholder="e.g. Focus on practical system design tips, microservices trade-offs, and scaling bottlenecks..."
                rows={2}
                className="w-full px-3 py-2 text-xs border border-gray-200 bg-white rounded-xl focus:ring-2 focus:ring-linkedin/20 focus:border-linkedin outline-none resize-none"
              />
            </div>

            {/* Tone & Length */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Tone</label>
                <select
                  value={tone}
                  onChange={(e) => setTone(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-gray-200 bg-white rounded-xl outline-none"
                >
                  {TONE_OPTIONS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Length</label>
                <div className="flex gap-1.5">
                  {LENGTH_OPTIONS.map((l) => (
                    <button
                      key={l.value}
                      type="button"
                      onClick={() => setLength(l.value)}
                      className={`flex-1 py-1.5 text-xs font-semibold rounded-lg border transition-all ${
                        length === l.value
                          ? 'bg-linkedin text-white border-linkedin'
                          : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      {l.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Format Toggles */}
            <div className="grid grid-cols-3 gap-2 pt-1">
              <label className="flex items-center gap-2 p-2 bg-white rounded-lg border border-gray-200 cursor-pointer text-xs font-medium text-gray-700">
                <input
                  type="checkbox"
                  checked={useHeadings}
                  onChange={(e) => setUseHeadings(e.target.checked)}
                  className="rounded text-linkedin focus:ring-0"
                />
                <Heading size={14} className="text-gray-400" />
                <span>Headings</span>
              </label>
              <label className="flex items-center gap-2 p-2 bg-white rounded-lg border border-gray-200 cursor-pointer text-xs font-medium text-gray-700">
                <input
                  type="checkbox"
                  checked={useEmojis}
                  onChange={(e) => setUseEmojis(e.target.checked)}
                  className="rounded text-linkedin focus:ring-0"
                />
                <SmilePlus size={14} className="text-gray-400" />
                <span>Emojis</span>
              </label>
              <label className="flex items-center gap-2 p-2 bg-white rounded-lg border border-gray-200 cursor-pointer text-xs font-medium text-gray-700">
                <input
                  type="checkbox"
                  checked={useHashtags}
                  onChange={(e) => setUseHashtags(e.target.checked)}
                  className="rounded text-linkedin focus:ring-0"
                />
                <Hash size={14} className="text-gray-400" />
                <span>Hashtags</span>
              </label>
            </div>
          </div>

          {/* Section 4: Approval Mode Toggle */}
          <div className="p-4 rounded-xl border border-blue-100 bg-blue-50/50 flex items-start gap-3">
            <ShieldCheck size={20} className="text-blue-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <label className="flex items-center justify-between cursor-pointer">
                <div>
                  <p className="text-xs font-bold text-blue-900">Require Approval Before Publishing</p>
                  <p className="text-[11px] text-blue-700/80 mt-0.5">
                    {requiresApproval
                      ? 'AI generates the post into "Pending Approval" drafts for you to review first.'
                      : 'AI automatically publishes directly to your LinkedIn profile when the scheduled time arrives.'}
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={requiresApproval}
                  onChange={(e) => setRequiresApproval(e.target.checked)}
                  className="w-4 h-4 text-linkedin rounded"
                />
              </label>
            </div>
          </div>

          {/* Footer Action */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-xs font-semibold text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-linkedin text-white text-xs font-bold rounded-xl hover:bg-linkedin-dark transition-all shadow-md shadow-linkedin/25 disabled:opacity-50"
            >
              <Zap size={14} />
              {submitting ? 'Saving...' : existingSchedule ? 'Update Schedule' : 'Start Auto-Posting Schedule'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
