import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sparkles,
  Save,
  Send,
  Calendar,
  RefreshCw,
  Loader2,
  Check,
  Hash,
  SmilePlus,
  Heading,
} from 'lucide-react';
import { generatePost, savePost, publishPost as publishPostApi } from '../api';
import { useToast } from '../context/ToastContext';
import PostEditor from '../components/PostEditor';
import SimilarityWarning from '../components/SimilarityWarning';
import ScheduleModal from '../components/ScheduleModal';
import { createSchedule } from '../api';

/**
 * Predefined topic options.
 */
const TOPICS = [
  'Technology',
  'Leadership',
  'Career Growth',
  'Industry News',
  'Personal Branding',
  'Entrepreneurship',
  'Remote Work',
  'AI & Machine Learning',
  'Marketing',
  'Productivity',
  'Innovation',
  'Diversity & Inclusion',
  'Sustainability',
  'Education',
  'Finance',
];

/**
 * Tone options.
 */
const TONES = [
  'Professional',
  'Casual',
  'Inspirational',
  'Educational',
  'Conversational',
  'Thought-Provoking',
];

/**
 * Post length options.
 */
const LENGTHS = [
  { value: 'short', label: 'Short', desc: '~100 words' },
  { value: 'medium', label: 'Medium', desc: '~200 words' },
  { value: 'long', label: 'Long', desc: '~300+ words' },
];

/**
 * Post creation page with AI generation.
 */
export default function CreatePost() {
  const navigate = useNavigate();
  const { addToast } = useToast();

  // Selection state
  const [selectedTopics, setSelectedTopics] = useState([]);
  const [customTopics, setCustomTopics] = useState('');
  const [tone, setTone] = useState('Professional');
  const [length, setLength] = useState('medium');
  const [useHeadings, setUseHeadings] = useState(false);
  const [useEmojis, setUseEmojis] = useState(true);
  const [useHashtags, setUseHashtags] = useState(true);

  // Generation state
  const [generating, setGenerating] = useState(false);
  const [generatedContent, setGeneratedContent] = useState('');
  const [similarPosts, setSimilarPosts] = useState([]);
  const [savedPostId, setSavedPostId] = useState(null);

  // Action state
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);

  // Toggle topic selection
  const toggleTopic = (topic) => {
    setSelectedTopics((prev) =>
      prev.includes(topic) ? prev.filter((t) => t !== topic) : [...prev, topic]
    );
  };

  // Get generation params
  const getParams = useCallback(() => ({
    topics: selectedTopics,
    customTopics,
    tone,
    length,
    useHeadings,
    useEmojis,
    useHashtags,
  }), [selectedTopics, customTopics, tone, length, useHeadings, useEmojis, useHashtags]);

  // Generate post
  const handleGenerate = async () => {
    if (selectedTopics.length === 0 && !customTopics.trim()) {
      addToast('Please select at least one topic or add custom topics.', 'error');
      return;
    }

    try {
      setGenerating(true);
      setSavedPostId(null);
      const response = await generatePost(getParams());
      setGeneratedContent(response.data.content);
      setSimilarPosts(response.data.similarPosts || []);
      addToast('Post generated successfully!', 'success');
    } catch (err) {
      addToast(err.message || 'Failed to generate post', 'error');
    } finally {
      setGenerating(false);
    }
  };

  // Regenerate post
  const handleRegenerate = async () => {
    try {
      setGenerating(true);
      const response = await generatePost(getParams());
      setGeneratedContent(response.data.content);
      setSimilarPosts(response.data.similarPosts || []);
      addToast('Post regenerated!', 'success');
    } catch (err) {
      addToast(err.message || 'Failed to regenerate post', 'error');
    } finally {
      setGenerating(false);
    }
  };

  // Save as draft
  const handleSave = async () => {
    try {
      setSaving(true);
      const response = await savePost({
        content: generatedContent,
        ...getParams(),
      });
      setSavedPostId(response.data.post.id);
      addToast('Post saved as draft!', 'success');
    } catch (err) {
      addToast(err.message || 'Failed to save post', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Publish now
  const handlePublish = async () => {
    if (!window.confirm('Publish this post to LinkedIn now?')) return;

    try {
      setPublishing(true);
      // Save first if not saved
      let postId = savedPostId;
      if (!postId) {
        const saveRes = await savePost({
          content: generatedContent,
          ...getParams(),
        });
        postId = saveRes.data.post.id;
        setSavedPostId(postId);
      }
      await publishPostApi(postId);
      addToast('Post published to LinkedIn!', 'success');
      navigate('/history');
    } catch (err) {
      addToast(err.message || 'Failed to publish post', 'error');
    } finally {
      setPublishing(false);
    }
  };

  // Schedule post
  const handleSchedule = async (scheduleData) => {
    try {
      // Save first if not saved
      let postId = savedPostId;
      if (!postId) {
        const saveRes = await savePost({
          content: generatedContent,
          ...getParams(),
        });
        postId = saveRes.data.post.id;
        setSavedPostId(postId);
      }
      await createSchedule({
        postId,
        ...scheduleData,
      });
      addToast('Post scheduled successfully!', 'success');
      setShowScheduleModal(false);
      navigate('/scheduled');
    } catch (err) {
      addToast(err.message || 'Failed to schedule post', 'error');
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Create Post</h1>
        <p className="text-sm text-gray-500 mt-1">
          Generate AI-powered LinkedIn content tailored to your audience.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left column: Options */}
        <div className="space-y-6">
          {/* Topic Selection */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-3">Topics</h2>
            <p className="text-xs text-gray-500 mb-3">
              Select one or more topics for your post.
            </p>
            <div className="flex flex-wrap gap-2">
              {TOPICS.map((topic) => {
                const isSelected = selectedTopics.includes(topic);
                return (
                  <button
                    key={topic}
                    onClick={() => toggleTopic(topic)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                      isSelected
                        ? 'bg-linkedin text-white shadow-sm'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {isSelected && <Check size={12} />}
                    {topic}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom Topics */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-3">Custom Topics / Key Points</h2>
            <textarea
              value={customTopics}
              onChange={(e) => setCustomTopics(e.target.value)}
              placeholder="Add specific topics, key points, or context for your post..."
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm placeholder-gray-400 resize-none h-24 focus:ring-2 focus:ring-linkedin/20 focus:border-linkedin outline-none transition-colors"
            />
          </div>

          {/* Tone Selector */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-3">Tone</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {TONES.map((t) => (
                <button
                  key={t}
                  onClick={() => setTone(t)}
                  className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                    tone === t
                      ? 'bg-linkedin text-white shadow-sm'
                      : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-200'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Post Preferences */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-3">Preferences</h2>

            {/* Post Length */}
            <div className="mb-4">
              <label className="text-xs font-medium text-gray-600 mb-2 block">Post Length</label>
              <div className="flex gap-2">
                {LENGTHS.map((l) => (
                  <button
                    key={l.value}
                    onClick={() => setLength(l.value)}
                    className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                      length === l.value
                        ? 'bg-linkedin text-white shadow-sm'
                        : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-200'
                    }`}
                  >
                    <div>{l.label}</div>
                    <div className={`text-[10px] mt-0.5 ${length === l.value ? 'text-white/70' : 'text-gray-400'}`}>
                      {l.desc}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Toggles */}
            <div className="space-y-3">
              <ToggleOption
                icon={Heading}
                label="Include Headings"
                checked={useHeadings}
                onChange={setUseHeadings}
              />
              <ToggleOption
                icon={SmilePlus}
                label="Include Emojis"
                checked={useEmojis}
                onChange={setUseEmojis}
              />
              <ToggleOption
                icon={Hash}
                label="Include Hashtags"
                checked={useHashtags}
                onChange={setUseHashtags}
              />
            </div>
          </div>

          {/* Generate Button */}
          <button
            onClick={handleGenerate}
            disabled={generating || (selectedTopics.length === 0 && !customTopics.trim())}
            className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-linkedin text-white rounded-xl text-sm font-semibold hover:bg-linkedin-dark disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md shadow-linkedin/20 hover:shadow-lg hover:shadow-linkedin/30"
          >
            {generating ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles size={18} />
                Generate Post
              </>
            )}
          </button>
        </div>

        {/* Right column: Generated content */}
        <div className="space-y-4">
          {generatedContent ? (
            <>
              {/* Similarity Warning */}
              {similarPosts.length > 0 && (
                <SimilarityWarning
                  similarPosts={similarPosts}
                  onRegenerate={handleRegenerate}
                />
              )}

              {/* Post Editor */}
              <PostEditor
                content={generatedContent}
                onChange={setGeneratedContent}
                onSave={handleSave}
                onPublish={handlePublish}
                saving={saving}
                publishing={publishing}
              />

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={handleRegenerate}
                  disabled={generating}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
                >
                  <RefreshCw size={14} className={generating ? 'animate-spin' : ''} />
                  Regenerate
                </button>
                <button
                  onClick={() => setShowScheduleModal(true)}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
                >
                  <Calendar size={14} />
                  Schedule
                </button>
              </div>

              {savedPostId && (
                <p className="text-xs text-green-600 font-medium flex items-center gap-1">
                  <Check size={12} />
                  Draft saved (ID: {savedPostId})
                </p>
              )}
            </>
          ) : (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-10 text-center">
              <Sparkles className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-base font-semibold text-gray-600 mb-2">Your post will appear here</h3>
              <p className="text-sm text-gray-400">
                Select topics and preferences, then click Generate to create your AI-powered LinkedIn post.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Schedule Modal */}
      <ScheduleModal
        isOpen={showScheduleModal}
        onClose={() => setShowScheduleModal(false)}
        onSchedule={handleSchedule}
      />
    </div>
  );
}

/** Toggle option component */
function ToggleOption({ icon: Icon, label, checked, onChange }) {
  return (
    <label className="flex items-center justify-between cursor-pointer group">
      <div className="flex items-center gap-2">
        <Icon size={14} className="text-gray-400 group-hover:text-gray-600" />
        <span className="text-xs font-medium text-gray-700">{label}</span>
      </div>
      <div className="relative">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="sr-only"
        />
        <div className={`w-9 h-5 rounded-full transition-colors ${checked ? 'bg-linkedin' : 'bg-gray-300'}`}>
          <div
            className={`w-3.5 h-3.5 bg-white rounded-full shadow-sm transition-transform mt-[3px] ${
              checked ? 'ml-[19px]' : 'ml-[3px]'
            }`}
          />
        </div>
      </div>
    </label>
  );
}
