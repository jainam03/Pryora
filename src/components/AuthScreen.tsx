/**
 * PRYORA Authentication Screen
 *
 * Supports:
 * - Google Sign-In (verified via Firebase ID token)
 * - Email & password account creation and sign-in
 * - Instant guest workspace (ephemeral, no email takeover)
 * - Live Demo Sandbox with sample Indian personal finance data
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  ArrowRight,
  Lock,
  Mail,
  User as UserIcon,
  ShieldCheck,
  PlayCircle,
  Zap,
} from 'lucide-react';

interface AuthScreenProps {
  onBackToLanding?: () => void;
  initialMode?: 'signin' | 'signup';
}

export const AuthScreen: React.FC<AuthScreenProps> = ({
  onBackToLanding,
  initialMode = 'signin',
}) => {
  const { login, register, quickStart, loginDemo, loginWithGoogle } = useAuth();

  const [mode, setMode] = useState<'signin' | 'signup'>(initialMode);
  const [displayName, setDisplayName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [googleLoading, setGoogleLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    setError(null);
    try {
      await loginWithGoogle();
    } catch (err: any) {
      setError(err.message || 'Google Sign-In did not complete. Please ensure popups are allowed.');
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !email.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }

    if (mode === 'signup' && password.length < 8) {
      setError('Please choose a password with at least 8 characters.');
      return;
    }

    if (mode === 'signin' && !password) {
      setError('Please enter your account password.');
      return;
    }

    setLoading(true);
    try {
      if (mode === 'signup') {
        await register(email.trim(), password, displayName.trim() || undefined, 'INR');
      } else {
        await login(email.trim(), password);
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please check your details and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGuestStart = async () => {
    setLoading(true);
    setError(null);
    try {
      await quickStart();
    } catch (err: any) {
      setError(err.message || 'Could not start a guest workspace right now.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDemo = async () => {
    setLoading(true);
    setError(null);
    try {
      await loginDemo();
    } catch (err: any) {
      setError(err.message || 'Could not launch the live demo workspace.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center py-10 sm:px-6 lg:px-8 text-white relative overflow-hidden font-sans">
      {/* Subtle ambient depth */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[560px] h-[360px] bg-emerald-500/8 rounded-full blur-3xl pointer-events-none" />

      {/* Header Branding */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center relative z-10 px-4">
        {onBackToLanding && (
          <button
            type="button"
            onClick={onBackToLanding}
            className="mb-4 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-emerald-400 transition-colors"
          >
            <span>←</span>
            <span>Back to PRYORA Home</span>
          </button>
        )}
        <div className="inline-flex items-center justify-center w-11 h-11 rounded-2xl bg-emerald-500 text-slate-950 font-black text-lg tracking-tighter mb-3 shadow-md shadow-emerald-500/20">
          P
        </div>
        <h1 className="text-2xl font-extrabold tracking-tight text-white">PRYORA</h1>
        <p className="mt-1 text-xs text-slate-400 font-medium">
          Understand your money. Understand your habits.
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0 relative z-10">
        <div className="bg-slate-900 border border-slate-800 py-7 px-6 sm:px-8 shadow-xl rounded-3xl">
          {/* Mode Tabs */}
          <div className="grid grid-cols-2 gap-1 p-1 bg-slate-950/70 rounded-xl border border-slate-800 mb-5">
            <button
              type="button"
              onClick={() => {
                setMode('signin');
                setError(null);
              }}
              className={`py-2 text-xs font-bold rounded-lg transition-colors ${
                mode === 'signin'
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('signup');
                setError(null);
              }}
              className={`py-2 text-xs font-bold rounded-lg transition-colors ${
                mode === 'signup'
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Create Account
            </button>
          </div>

          {error && (
            <div className="mb-5 p-3 rounded-xl bg-rose-950/70 border border-rose-800/80 text-rose-200 text-xs leading-relaxed">
              {error}
            </div>
          )}

          {/* Google Sign-In */}
          <button
            id="btn_google_signin"
            type="button"
            onClick={handleGoogleSignIn}
            disabled={googleLoading || loading}
            className="w-full py-3 px-4 rounded-xl bg-white hover:bg-slate-100 text-slate-900 font-bold text-xs flex items-center justify-center gap-2.5 transition-colors disabled:opacity-50"
          >
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span>{googleLoading ? 'Verifying Google account...' : 'Continue with Google'}</span>
          </button>

          <div className="relative flex items-center justify-center my-5">
            <div className="border-t border-slate-800 w-full" />
            <span className="bg-slate-900 px-3 text-[10px] uppercase font-bold tracking-wider text-slate-500 absolute">
              or with email & password
            </span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3.5">
            {mode === 'signup' && (
              <div>
                <label
                  htmlFor="input_auth_name"
                  className="block text-xs font-semibold text-slate-300 mb-1.5"
                >
                  Your Name (optional)
                </label>
                <div className="relative">
                  <UserIcon className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    id="input_auth_name"
                    type="text"
                    placeholder="e.g. Riya Patel"
                    value={displayName}
                    onChange={e => setDisplayName(e.target.value)}
                    className="w-full pl-10 pr-3.5 py-2.5 bg-slate-800/70 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-medium"
                  />
                </div>
              </div>
            )}

            <div>
              <label
                htmlFor="input_auth_email"
                className="block text-xs font-semibold text-slate-300 mb-1.5"
              >
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="input_auth_email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full pl-10 pr-3.5 py-2.5 bg-slate-800/70 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-medium"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="input_auth_password"
                className="block text-xs font-semibold text-slate-300 mb-1.5"
              >
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="input_auth_password"
                  type="password"
                  required
                  autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                  minLength={mode === 'signup' ? 8 : undefined}
                  placeholder={mode === 'signup' ? 'At least 8 characters' : 'Enter your password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full pl-10 pr-3.5 py-2.5 bg-slate-800/70 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                />
              </div>
              {mode === 'signin' && (
                <p className="mt-1.5 text-[11px] text-slate-500">
                  Forgot password? Early Access accounts using Google Sign-In recover directly via Google. Self-serve email password reset is on our roadmap.
                </p>
              )}
            </div>

            <button
              id="btn_auth_continue"
              type="submit"
              disabled={loading || googleLoading}
              className="w-full py-3 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
            >
              <span>
                {loading
                  ? mode === 'signup'
                    ? 'Creating Workspace...'
                    : 'Signing In...'
                  : mode === 'signup'
                    ? 'Create Early Access Account'
                    : 'Sign In'}
              </span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Secondary options: Live Demo & Temporary Guest Workspace */}
          <div className="mt-5 pt-4 border-t border-slate-800 space-y-2.5">
            <button
              id="btn_quick_demo"
              type="button"
              onClick={handleQuickDemo}
              disabled={loading || googleLoading}
              className="w-full py-2.5 px-3 rounded-xl border border-emerald-500/25 bg-emerald-500/10 hover:bg-emerald-500/15 text-emerald-300 text-xs font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
            >
              <PlayCircle className="w-4 h-4" />
              <span>Explore Live Demo (Sample INR Data)</span>
            </button>

            <button
              id="btn_instant_start"
              type="button"
              onClick={handleGuestStart}
              disabled={loading || googleLoading}
              className="w-full py-2.5 px-3 rounded-xl bg-slate-800/70 hover:bg-slate-800 text-slate-300 text-xs font-medium flex items-center justify-center gap-2 transition-colors border border-slate-700/70 disabled:opacity-50"
            >
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>Start Blank Guest Workspace (No Email)</span>
            </button>
          </div>
        </div>

        {/* Honest Security Footer */}
        <div className="mt-5 flex items-center justify-center gap-3 text-[11px] text-slate-400">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" /> No bank passwords or account linking required
          </span>
        </div>
      </div>
    </div>
  );
};
