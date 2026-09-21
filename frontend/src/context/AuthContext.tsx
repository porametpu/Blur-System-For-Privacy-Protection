"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';
import * as api from '../lib/api';

interface User {
  id: number;
  email: string;
  full_name?: string;
  avatar_url?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthModalOpen: boolean;
  openAuthModal: () => void;
  closeAuthModal: () => void;
  login: (email: str, password: str) => Promise<void>;
  register: (email: str, password: str, fullName?: string) => Promise<void>;
  googleLogin: (googleData: { email: string; google_id: string; full_name?: string; avatar_url?: string }) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  useEffect(() => {
    const savedToken = localStorage.getItem('token');
    if (savedToken) {
      setToken(savedToken);
      api.getCurrentUser()
        .then(u => {
          if (u && u.id) setUser(u);
          else logout();
        })
        .catch(() => logout())
        .finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, []);

  const handleAuthSuccess = (res: { access_token: string; user: User }) => {
    localStorage.setItem('token', res.access_token);
    setToken(res.access_token);
    setUser(res.user);
    setIsAuthModalOpen(false);
  };

  const login = async (email: str, password: str) => {
    const res = await api.loginUser({ email, password });
    handleAuthSuccess(res);
  };

  const register = async (email: str, password: str, fullName?: string) => {
    const res = await api.registerUser({ email, password, full_name: fullName });
    handleAuthSuccess(res);
  };

  const googleLogin = async (googleData: { email: string; google_id: string; full_name?: string; avatar_url?: string }) => {
    const res = await api.googleLoginUser(googleData);
    handleAuthSuccess(res);
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        isAuthModalOpen,
        openAuthModal: () => setIsAuthModalOpen(true),
        closeAuthModal: () => setIsAuthModalOpen(false),
        login,
        register,
        googleLogin,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
