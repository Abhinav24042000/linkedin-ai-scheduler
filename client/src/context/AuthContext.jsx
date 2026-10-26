import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { checkAuthStatus, logout as logoutApi } from '../api';

/**
 * Authentication context for managing user session state.
 */
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  /** Check authentication status on mount and on demand */
  const checkAuth = useCallback(async () => {
    try {
      setLoading(true);
      const response = await checkAuthStatus();
      if (response.success && response.data.authenticated) {
        setUser(response.data.user);
      } else {
        setUser(null);
      }
    } catch (err) {
      console.error('Auth check failed:', err);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  /** Log out the current user */
  const handleLogout = useCallback(async () => {
    try {
      await logoutApi();
    } catch (err) {
      console.error('Logout failed:', err);
    } finally {
      setUser(null);
    }
  }, []);

  // Check auth on mount
  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const value = {
    user,
    loading,
    checkAuth,
    handleLogout,
    isAuthenticated: !!user,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Hook to access authentication context.
 * @returns {{ user: object|null, loading: boolean, checkAuth: Function, handleLogout: Function, isAuthenticated: boolean }}
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
