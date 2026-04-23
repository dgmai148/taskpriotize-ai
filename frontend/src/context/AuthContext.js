import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authApi, setTokens, clearTokens, setAuthFailHandler } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const logout = useCallback(async () => {
    try { await authApi.logout(); } catch {}
    clearTokens();
    setUser(null);
  }, []);

  // Set the auth-fail handler so API layer can trigger logout
  useEffect(() => {
    setAuthFailHandler(() => {
      setUser(null);
      clearTokens();
    });
  }, []);

  // Check for existing session on mount
  useEffect(() => {
    const stored = localStorage.getItem('accessToken');
    if (stored) {
      authApi.me()
        .then(data => setUser(data.user))
        .catch(() => clearTokens())
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email, password) => {
    const data = await authApi.login(email, password);
    setTokens(data.accessToken, data.refreshToken);
    setUser(data.user);
    return data.user;
  };

  const register = async (email, password, name, role) => {
    const data = await authApi.register(email, password, name, role);
    setTokens(data.accessToken, data.refreshToken);
    setUser(data.user);
    return data.user;
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}
