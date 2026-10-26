import React, { useState, useEffect } from 'react';
import {
  Settings as SettingsIcon,
  Linkedin,
  Key,
  Eye,
  EyeOff,
  Save,
  Trash2,
  AlertTriangle,
  ExternalLink,
  Shield,
  Info,
  Loader2,
  CheckCircle,
} from 'lucide-react';
import { getSettings, saveGeminiKey, deleteGeminiKey, disconnectLinkedIn } from '../api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import LoadingSpinner from '../components/LoadingSpinner';

/**
 * Settings page for LinkedIn account and Gemini API key management.
 */
export default function Settings() {
  const { user, checkAuth } = useAuth();
  const { addToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState({ geminiKeyConfigured: false, geminiKeyMasked: null });

  // Gemini key state
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [savingKey, setSavingKey] = useState(false);
  const [deletingKey, setDeletingKey] = useState(false);
  const [showKeyInput, setShowKeyInput] = useState(false);

  // Disconnect state
  const [disconnecting, setDisconnecting] = useState(false);

  // Fetch settings on mount
  useEffect(() => {
    async function fetchSettings() {
      try {
        setLoading(true);
        const response = await getSettings();
        setSettings(response.data);
      } catch (err) {
        addToast('Failed to load settings', 'error');
      } finally {
        setLoading(false);
      }
    }
    fetchSettings();
  }, [addToast]);

  // Save Gemini key
  const handleSaveKey = async () => {
    if (!apiKey.trim()) {
      addToast('Please enter an API key', 'error');
      return;
    }
    try {
      setSavingKey(true);
      await saveGeminiKey(apiKey.trim());
      addToast('Gemini API key saved!', 'success');
      setApiKey('');
      setShowKeyInput(false);
      // Refresh settings
      const response = await getSettings();
      setSettings(response.data);
    } catch (err) {
      addToast(err.message || 'Failed to save API key', 'error');
    } finally {
      setSavingKey(false);
    }
  };

  // Delete Gemini key
  const handleDeleteKey = async () => {
    if (!window.confirm('Remove your Gemini API key? You won\'t be able to generate posts until you add a new one.')) {
      return;
    }
    try {
      setDeletingKey(true);
      await deleteGeminiKey();
      addToast('API key removed', 'success');
      setSettings((prev) => ({ ...prev, geminiKeyConfigured: false, geminiKeyMasked: null }));
    } catch (err) {
      addToast(err.message || 'Failed to remove API key', 'error');
    } finally {
      setDeletingKey(false);
    }
  };

  // Disconnect LinkedIn
  const handleDisconnect = async () => {
    if (!window.confirm('Disconnect your LinkedIn account? You will need to sign in again to use the app. All your posts and schedules will be preserved.')) {
      return;
    }
    try {
      setDisconnecting(true);
      await disconnectLinkedIn();
      addToast('LinkedIn account disconnected', 'success');
      checkAuth();
    } catch (err) {
      addToast(err.message || 'Failed to disconnect', 'error');
    } finally {
      setDisconnecting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <LoadingSpinner size="lg" text="Loading settings..." />
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500 mt-1">Manage your account and API configuration</p>
      </div>

      <div className="space-y-6 max-w-2xl">
        {/* LinkedIn Account Section */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-50 bg-gray-50/50">
            <div className="flex items-center gap-2">
              <Linkedin size={18} className="text-linkedin" />
              <h2 className="text-base font-semibold text-gray-900">LinkedIn Account</h2>
            </div>
          </div>
          <div className="p-6">
            {user && (
              <div className="flex items-center gap-4 mb-5">
                {user.avatarUrl ? (
                  <img
                    src={user.avatarUrl}
                    alt={user.name}
                    className="w-14 h-14 rounded-full object-cover border-2 border-gray-100"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-full bg-linkedin/10 flex items-center justify-center text-linkedin font-bold text-xl">
                    {user.name?.charAt(0)?.toUpperCase() || '?'}
                  </div>
                )}
                <div>
                  <p className="font-semibold text-gray-900">{user.name}</p>
                  <p className="text-sm text-gray-500">{user.email}</p>
                  {user.profileUrl && (
                    <a
                      href={user.profileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-linkedin hover:text-linkedin-dark mt-1"
                    >
                      <ExternalLink size={10} />
                      View Profile
                    </a>
                  )}
                </div>
                <div className="ml-auto">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                    <CheckCircle size={10} />
                    Connected
                  </span>
                </div>
              </div>
            )}

            {/* Disconnect warning */}
            <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-100 mb-4">
              <AlertTriangle size={14} className="text-amber-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700">
                Disconnecting your LinkedIn account will sign you out and prevent posting.
                Your drafts and schedules will be preserved for when you reconnect.
              </p>
            </div>

            <button
              onClick={handleDisconnect}
              disabled={disconnecting}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 disabled:opacity-50 transition-colors"
            >
              {disconnecting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
              {disconnecting ? 'Disconnecting...' : 'Disconnect LinkedIn'}
            </button>
          </div>
        </div>

        {/* Gemini API Key Section */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-50 bg-gray-50/50">
            <div className="flex items-center gap-2">
              <Key size={18} className="text-amber-500" />
              <h2 className="text-base font-semibold text-gray-900">Gemini API Key</h2>
            </div>
          </div>
          <div className="p-6">
            {settings.geminiKeyConfigured ? (
              // Key is configured
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-600 font-mono">
                    {settings.geminiKeyMasked || '••••••••••••••••'}
                  </div>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                    <CheckCircle size={10} />
                    Configured
                  </span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowKeyInput(true)}
                    className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <Key size={14} />
                    Update Key
                  </button>
                  <button
                    onClick={handleDeleteKey}
                    disabled={deletingKey}
                    className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 disabled:opacity-50 transition-colors"
                  >
                    {deletingKey ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                    Remove
                  </button>
                </div>
              </div>
            ) : (
              // Key is not configured
              <div>
                <p className="text-sm text-gray-600 mb-4">
                  A Gemini API key is required to generate AI-powered posts.
                </p>
              </div>
            )}

            {/* Key input (shown when not configured or updating) */}
            {(!settings.geminiKeyConfigured || showKeyInput) && (
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  {showKeyInput ? 'New API Key' : 'API Key'}
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type={showKey ? 'text' : 'password'}
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder="Enter your Gemini API key..."
                      className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-linkedin/20 focus:border-linkedin outline-none transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowKey(!showKey)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
                    >
                      {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  <button
                    onClick={handleSaveKey}
                    disabled={savingKey || !apiKey.trim()}
                    className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-linkedin rounded-lg hover:bg-linkedin-dark disabled:opacity-50 transition-colors"
                  >
                    {savingKey ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                    Save
                  </button>
                  {showKeyInput && (
                    <button
                      onClick={() => {
                        setShowKeyInput(false);
                        setApiKey('');
                      }}
                      className="px-3 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors"
                    >
                      Cancel
                    </button>
                  )}
                </div>

                <div className="flex items-start gap-2 mt-3 p-3 rounded-lg bg-blue-50 border border-blue-100">
                  <Info size={14} className="text-blue-500 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-blue-700">
                    Get your API key from{' '}
                    <a
                      href="https://aistudio.google.com/apikey"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium underline hover:text-blue-900"
                    >
                      Google AI Studio
                    </a>
                    . It's free to start with generous daily limits.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* LinkedIn API Requirements Section */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-50 bg-gray-50/50">
            <div className="flex items-center gap-2">
              <Shield size={18} className="text-gray-500" />
              <h2 className="text-base font-semibold text-gray-900">LinkedIn API Requirements</h2>
            </div>
          </div>
          <div className="p-6">
            <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-50 border border-blue-100 mb-4">
              <Info size={14} className="text-blue-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-blue-700">
                To use this app, you need a LinkedIn Developer App with the proper API products enabled.
                This is a one-time setup done by the app administrator.
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <h3 className="text-sm font-medium text-gray-800 mb-1">Required API Products</h3>
                <ul className="text-xs text-gray-600 space-y-1 ml-4 list-disc">
                  <li><span className="font-medium">Sign In with LinkedIn using OpenID Connect</span> — for user authentication</li>
                  <li><span className="font-medium">Share on LinkedIn</span> — for posting content</li>
                </ul>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-800 mb-1">Required Scopes</h3>
                <div className="flex flex-wrap gap-1.5">
                  {['openid', 'profile', 'email', 'w_member_social'].map((scope) => (
                    <span
                      key={scope}
                      className="inline-block px-2 py-0.5 rounded text-xs font-mono font-medium bg-gray-100 text-gray-700"
                    >
                      {scope}
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-100">
                <AlertTriangle size={14} className="text-amber-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700">
                  The <code className="font-mono bg-amber-100 px-1 rounded">w_member_social</code> scope
                  requires your LinkedIn Developer App to have the "Share on LinkedIn" product approved.
                  This may require verification by LinkedIn.
                </p>
              </div>

              <a
                href="https://www.linkedin.com/developers/apps"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-linkedin font-medium hover:text-linkedin-dark transition-colors"
              >
                <ExternalLink size={14} />
                Go to LinkedIn Developer Portal
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
