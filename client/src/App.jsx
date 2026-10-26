import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import Layout from './components/Layout';
import LoadingSpinner from './components/LoadingSpinner';
import Dashboard from './pages/Dashboard';
import CreatePost from './pages/CreatePost';
import Drafts from './pages/Drafts';
import Scheduled from './pages/Scheduled';
import History from './pages/History';
import Settings from './pages/Settings';
import { Linkedin, Sparkles, Calendar, Clock } from 'lucide-react';

/**
 * Root application component with auth routing.
 */
export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <BrowserRouter>
          <AppContent />
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  );
}

/** Inner app content that consumes auth context */
function AppContent() {
  const { user, loading, isAuthenticated } = useAuth();

  // Full-page loading spinner while checking auth
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" text="Loading..." />
      </div>
    );
  }

  // Login page for unauthenticated users
  if (!isAuthenticated) {
    return <LoginPage />;
  }

  // Authenticated routes
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/create" element={<CreatePost />} />
        <Route path="/drafts" element={<Drafts />} />
        <Route path="/scheduled" element={<Scheduled />} />
        <Route path="/history" element={<History />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

/** Clean login page for unauthenticated users */
function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        {/* Logo */}
        <div className="mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-linkedin rounded-2xl shadow-lg shadow-linkedin/25 mb-6">
            <Linkedin className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">LinkedIn Post Scheduler</h1>
          <p className="text-gray-500 text-base leading-relaxed">
            Create, schedule, and manage your LinkedIn content with AI-powered post generation.
          </p>
        </div>

        {/* Features */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="p-3 rounded-xl bg-white shadow-sm border border-gray-100">
            <Sparkles className="w-6 h-6 text-linkedin mx-auto mb-2" />
            <p className="text-xs text-gray-600 font-medium">AI-Powered</p>
          </div>
          <div className="p-3 rounded-xl bg-white shadow-sm border border-gray-100">
            <Calendar className="w-6 h-6 text-linkedin mx-auto mb-2" />
            <p className="text-xs text-gray-600 font-medium">Scheduling</p>
          </div>
          <div className="p-3 rounded-xl bg-white shadow-sm border border-gray-100">
            <Clock className="w-6 h-6 text-linkedin mx-auto mb-2" />
            <p className="text-xs text-gray-600 font-medium">Automation</p>
          </div>
        </div>

        {/* Connect button */}
        <a
          href="/api/auth/linkedin"
          className="inline-flex items-center justify-center gap-3 w-full px-6 py-3.5 bg-linkedin text-white font-semibold rounded-xl hover:bg-linkedin-dark transition-all shadow-lg shadow-linkedin/25 hover:shadow-xl hover:shadow-linkedin/30 text-base"
        >
          <Linkedin size={22} />
          Connect with LinkedIn
        </a>

        <p className="mt-4 text-xs text-gray-400">
          Sign in with your LinkedIn account to get started.
          <br />
          We only request necessary permissions.
        </p>
      </div>
    </div>
  );
}
