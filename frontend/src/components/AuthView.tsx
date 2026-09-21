"use client";

import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { AlertCircle, Loader2, Check } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function AuthView() {
  const { login, register, googleLogin } = useAuth();
  const [tab, setTab] = useState<'signin' | 'signup'>('signup');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      if (tab === 'signin') {
        await login(email, password);
      } else {
        await register(email, password, fullName);
      }
      router.push('/?tab=dashboard');
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSimulatedGoogleSignIn = async () => {
    setError('');
    setIsLoading(true);
    try {
      const dummyGoogleId = "google_user_1029384756";
      const dummyEmail = email.trim() ? email : "user.google@gmail.com";
      const dummyName = fullName.trim() ? fullName : "Google Member";
      const dummyAvatar = `https://lh3.googleusercontent.com/a/ACg8ocK${Math.floor(Math.random() * 1000)}=s96-c`;

      await googleLogin({
        google_id: dummyGoogleId,
        email: dummyEmail,
        full_name: dummyName,
        avatar_url: dummyAvatar
      });
      router.push('/?tab=dashboard');
    } catch (err: any) {
      setError(err.message || 'Google Sign-In failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center p-4 md:p-8 min-h-[calc(100vh-4rem)] pt-20 fade-slide-in">
      <div className="w-full max-w-5xl bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl overflow-hidden flex flex-col md:flex-row relative">

        {/* Left Side - Blue Splash */}
        <div className="hidden md:flex flex-col w-2/5 bg-gradient-to-b from-blue-600 to-blue-800 relative text-white p-12 justify-between items-center text-center">

          {/* Cloud SVG Divider on the right edge */}
          <div className="absolute top-0 right-0 bottom-0 w-16 translate-x-px overflow-hidden z-10 pointer-events-none">
            <svg
              className="absolute right-0 top-0 h-full w-full text-white dark:text-slate-900 drop-shadow-[-10px_0_15px_rgba(0,0,0,0.15)]"
              fill="currentColor"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
            >
              <path d="M100 0 L100 100 L0 100 C30 80 40 60 10 50 C-20 40 20 20 0 0 Z" />
              <path d="M100 0 L100 100 L15 100 C45 85 55 65 25 55 C-5 45 35 25 15 0 Z" className="opacity-40" />
            </svg>
          </div>

          <div /> {/* Spacer */}

          <div className="relative z-20 flex flex-col items-center">
            <h2 className="text-xl font-medium mb-6">Welcome to</h2>
            <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center shadow-2xl mb-4 text-blue-600">
              <span className="font-black text-5xl tracking-tighter">B</span>
            </div>
            <h1 className="text-3xl font-bold tracking-tight mb-8">BlurSystem</h1>
            <p className="text-blue-100 text-xs font-medium opacity-80 leading-relaxed max-w-[200px]">
              Protect your privacy with AI-powered face detection and selective blurring.
            </p>
          </div>

          <div className="flex gap-4 text-[10px] font-bold tracking-wider text-blue-200/50 uppercase z-20">
            <span>BlurSystem</span>
            <span>|</span>
            <span>Protect Your Privacy</span>
          </div>
        </div>

        {/* Right Side - Form */}
        <div className="w-full md:w-3/5 p-8 md:p-16 flex flex-col justify-center relative z-20 bg-white">

          <div className="max-w-md mx-auto w-full">
            <h2 className="text-2xl font-bold text-color-black text-slate-800 dark:text-slate-100 mb-10 text-center md:text-left">
              {tab === 'signup' ? 'Create your account' : 'Sign in to your account'}
            </h2>

            {error && (
              <div className="mb-6 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 flex items-center gap-2 text-red-600 dark:text-red-400 text-xs font-bold fade-slide-in">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              {tab === 'signup' && (
                <div className="group">
                  <label className="block text-color-black text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">Name</label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      placeholder="Enter your name"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full text-color-black py-2 border-b-2 border-slate-200 dark:border-slate-700 bg-transparent text-sm font-semibold text-slate-800 dark:text-slate-100 focus:outline-none focus:border-blue-500 transition-colors placeholder:text-slate-400 placeholder:font-normal"
                    />
                    {fullName && <Check className="w-4 h-4 text-blue-500 absolute right-0 top-1/2 -translate-y-1/2" />}
                  </div>
                </div>
              )}

              <div className="group">
                <label className="block text-color-black text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">E-mail Address</label>
                <div className="relative">
                  <input
                    type="email"
                    required
                    placeholder="Enter your mail"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full text-color-black py-2 border-b-2 border-slate-200 dark:border-slate-700 bg-transparent text-sm font-semibold text-slate-800 dark:text-slate-100 focus:outline-none focus:border-blue-500 transition-colors placeholder:text-slate-400 placeholder:font-normal"
                  />
                  {email.includes('@') && <Check className="w-4 h-4 text-blue-500 absolute right-0 top-1/2 -translate-y-1/2" />}
                </div>
              </div>

              <div className="group">
                <label className="block text-color-black text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">Password</label>
                <div className="relative">
                  <input
                    type="password"
                    required
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full text-color-black py-2 border-b-2 border-slate-200 dark:border-slate-700 bg-transparent text-sm font-semibold text-slate-800 dark:text-slate-100 focus:outline-none focus:border-blue-500 transition-colors placeholder:text-slate-400 placeholder:font-normal"
                  />
                  {password.length >= 6 && <Check className="w-4 h-4 text-blue-500 absolute right-0 top-1/2 -translate-y-1/2" />}
                </div>
              </div>

              {tab === 'signup' && (
                <div className="flex items-center gap-2 pt-2">
                  <input type="checkbox" required className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                  <span className="text-xs text-slate-500 font-medium">By Signing Up, I agree with <a href="#" className="text-blue-500 hover:underline font-bold">Terms & Conditions</a></span>
                </div>
              )}

              <div className="flex items-center gap-4 pt-6">
                {tab === 'signup' ? (
                  <>
                    <button
                      type="submit"
                      disabled={isLoading}
                      className="px-8 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-full shadow-lg shadow-blue-500/30 transition-transform hover:-translate-y-0.5 disabled:opacity-50 flex items-center justify-center min-w-[120px]"
                    >
                      {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Sign Up'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setTab('signin')}
                      className="px-8 py-2.5 bg-transparent border-2 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600 hover:text-slate-700 dark:hover:text-slate-200 font-bold text-sm rounded-full transition-colors min-w-[120px]"
                    >
                      Sign In
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="submit"
                      disabled={isLoading}
                      className="px-8 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-full shadow-lg shadow-blue-500/30 transition-transform hover:-translate-y-0.5 disabled:opacity-50 flex items-center justify-center min-w-[120px]"
                    >
                      {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Sign In'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setTab('signup')}
                      className="px-8 py-2.5 bg-transparent border-2 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600 hover:text-slate-700 dark:hover:text-slate-200 font-bold text-sm rounded-full transition-colors min-w-[120px]"
                    >
                      Sign Up
                    </button>
                  </>
                )}
              </div>
            </form>

            <div className="mt-10 pt-8 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={handleSimulatedGoogleSignIn}
                disabled={isLoading}
                className="w-full py-3 px-4 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-sm rounded-full border border-slate-200 dark:border-slate-700 flex items-center justify-center gap-3 transition-colors shadow-sm disabled:opacity-50"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                Continue with Google
              </button>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
