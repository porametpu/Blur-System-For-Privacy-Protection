"use client";

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '../context/AuthContext';
import { LogOut, User as UserIcon } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function Navbar() {
  const { user, logout } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentTab = searchParams.get('tab') || 'dashboard';

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <nav className="fixed top-0 left-0 right-0 h-16 bg-white border-b border-slate-200 dark:border-slate-800 z-50">
      <div className="max-w-[1400px] mx-auto h-full px-4 sm:px-6 lg:px-8 flex items-center justify-between bg-white">

        {/* Logo */}
        <Link
          href="/?tab=dashboard"
          className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity shrink-0"
        >
          <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center shadow-sm">
            <span className="text-white font-black text-sm">B</span>
          </div>
          <span className="text-xl font-black tracking-tight text-slate-900 hidden sm:block">
            Blur<span className="text-blue-600">System</span>
          </span>
        </Link>

        {/* Center Links */}
        <div className="flex items-center gap-6">
          <Link
            href="/?tab=dashboard"
            className={`text-sm font-bold transition-colors ${currentTab === 'dashboard'
              ? 'text-blue-500'
              : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-300'
              }`}
          >
            Dashboard
          </Link>
          <Link
            href="/?tab=history"
            className={`text-sm font-bold transition-colors ${currentTab === 'history'
              ? 'text-blue-500'
              : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-300'
              }`}
          >
            History
          </Link>
          <Link
            href="/?tab=settings"
            className={`text-sm font-bold transition-colors ${currentTab === 'settings'
              ? 'text-blue-500'
              : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-300'
              }`}
          >
            Settings
          </Link>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-3 shrink-0" ref={dropdownRef}>
          {user ? (
            <div className="relative">
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center gap-2 hover:bg-slate-100 dark:hover:bg-slate-800 p-1 rounded-full transition-colors border border-transparent"
              >
                {user.avatar_url ? (
                  <img src={user.avatar_url} alt={user.full_name || 'User'} className="w-8 h-8 rounded-full border border-slate-200 dark:border-slate-700 bg-white object-cover" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
                    <UserIcon className="w-4 h-4" />
                  </div>
                )}
              </button>

              {dropdownOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-slate-100 py-2 z-50">
                  <div className="px-4 py-2 border-b border-slate-100 mb-2">
                    <p className="text-sm font-black text-slate-800 truncate">{user.full_name || 'User'}</p>
                    <p className="text-xs font-medium text-slate-500 truncate">{user.email}</p>
                  </div>
                  <button
                    onClick={() => {
                      logout();
                      setDropdownOpen(false);
                      router.push('/?tab=dashboard');
                    }}
                    className="w-full text-left px-4 py-2 text-sm font-bold text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2 transition-colors"
                  >
                    <LogOut className="w-4 h-4" /> Sign Out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link
              href="/?tab=login"
              className="bg-[#0070F3] hover:bg-[#005bb5] text-white text-sm font-semibold px-6 py-2 rounded-full transition-colors shadow-sm flex items-center justify-center"
            >
              Sign In
            </Link>
          )}
        </div>

      </div>
    </nav>
  );
}
