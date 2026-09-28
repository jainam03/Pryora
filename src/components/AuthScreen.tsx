/**
 * PRYORA Streamlined Authentication Screen
 * 
 * Minimized friction during sign-up:
 * - 1-Click Google Sign-In with Firebase Cloud
 * - Frictionless Email Sign-Up handled silently without password roadblocks
 * - Instant 1-Click Start to jump directly into the streamlined onboarding setup
 * - Optional password sign-in for existing accounts
 */

import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  ArrowRight,
  Sparkles,
  Lock,
  Mail,
  Cloud,
  Zap,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

export const AuthScreen: React.FC = () => {
  const { login, quickStart, loginDemo, loginWithGoogle } = useAuth();

  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [isPasswordMode, setIsPasswordMode] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [googleLoading, setGoogleLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // 1-Click Google Authentication with Firebase Cloud
  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    setError(null);
    try {
      await loginWithGoogle();
      // Silently handled: AuthContext updates user, which triggers immediate transition to Onboarding
    } catch (err: any) {
      setError(err.message || 'Google Sign-in failed. Please ensure popups are permitted.');
    } finally {
      setGoogleLoading(false);
    }
  };

  // Frictionless Email Sign-Up or Quick Continue
  const handleEmailContinue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() && !isPasswordMode) {
      // If empty, prompt or start instant
      setError('Please enter your email address to continue.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (isPasswordMode) {
        await login(email.trim(), password);
      } else {
        // Frictionless silent sign-up: creates or signs in, transitions to onboarding immediately
        await quickStart(email.trim());
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please verify your details.');
    } finally {
      setLoading(false);
    }
  };

  // Instant 1-Click Start without typing
  const handleInstantStart = async () => {
    setLoading(true);
    setError(null);
    try {
      await quickStart();
    } catch (err: any) {
      setError(err.message || 'Could not start instant workspace.');
    } finally {
      setLoading(false);
    }
  };

  // Demo Sandbox Preview
  const handleQuickDemo = async () => {
    setLoading(true);
    setError(null);
    try {
      await loginDemo();
    } catch (err: any) {
      setError(err.message || 'Could not launch demo workspace.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center py-10 sm:px-6 lg:px-8 text-white relative overflow-hidden font-sans">
      
      {/* Background glow accents */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />

      {/* Header Branding */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center relative z-10 px-4">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-emerald-500 text-slate-950 font-black text-xl tracking-tighter mb-3 shadow-lg shadow-emerald-500/25">
          P
        </div>
        <h1 className="text-3xl font-black tracking-tight text-white">PRYORA</h1>
        <p className="mt-1 text-xs text-slate-400 font-medium tracking-wide">
          Simple, modern expense tracking with real-time cloud storage
        </p>
      </div>

      <div className="mt-7 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0 relative z-10">
        <div className="bg-slate-900 border border-slate-800 py-7 px-6 sm:px-8 shadow-2xl rounded-3xl">
          
          {/* Error Banner */}
          {error && (
            <div className="mb-5 p-3.5 rounded-2xl bg-rose-950/70 border border-rose-800/80 text-rose-300 text-xs animate-in fade-in">
              {error}
            </div>
          )}

          {/* Primary Action 1: Google Cloud Firebase Authentication */}
          <button
            id="btn_google_signin"
            type="button"
            onClick={handleGoogleSignIn}
            disabled={googleLoading || loading}
            className="w-full py-3.5 px-4 rounded-2xl bg-white hover:bg-slate-100 text-slate-900 font-bold text-xs flex items-center justify-center gap-3 transition-all shadow-md shadow-white/5 active:scale-[0.99] disabled:opacity-50"
          >
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
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
            <span>{googleLoading ? 'Connecting to Firebase Cloud...' : 'Continue with Google'}</span>
          </button>

          <div className="mt-2.5 mb-5 flex items-center justify-center gap-1.5 text-[11px] text-emerald-400 font-medium">
            <Cloud className="w-3.5 h-3.5" />
            <span>Real-time Google Cloud Firestore backend</span>
          </div>

          <div className="relative flex items-center justify-center my-5">
            <div className="border-t border-slate-800 w-full" />
            <span className="bg-slate-900 px-3 text-[10px] uppercase font-bold tracking-wider text-slate-400 absolute">
              or continue with email
            </span>
          </div>

          {/* Friction-Free Email Form */}
          <form onSubmit={handleEmailContinue} className="space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Your Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="input_auth_email"
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full pl-10 pr-3.5 py-2.5 bg-slate-800/70 border border-slate-700/80 rounded-2xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-medium"
                />
              </div>
            </div>

            {/* Optional Password Field (for existing users) */}
            {isPasswordMode && (
              <div className="animate-in fade-in slide-in-from-top-1">
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Account Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    id="input_auth_password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full pl-10 pr-3.5 py-2.5 bg-slate-800/70 border border-slate-700/80 rounded-2xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  />
                </div>
              </div>
            )}

            <button
              id="btn_auth_continue"
              type="submit"
              disabled={loading || googleLoading}
              className="w-full py-3 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md shadow-emerald-600/20 active:scale-[0.99] disabled:opacity-50"
            >
              <span>{loading ? 'Initializing Workspace...' : isPasswordMode ? 'Sign In with Password' : 'Get Started Free'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Instant 1-Click Start without typing */}
          <div className="mt-3.5 pt-3.5 border-t border-slate-800/80">
            <button
              id="btn_instant_start"
              type="button"
              onClick={handleInstantStart}
              disabled={loading || googleLoading}
              className="w-full py-2.5 px-3 rounded-2xl bg-slate-800/80 hover:bg-slate-750 text-slate-200 text-xs font-semibold flex items-center justify-center gap-2 transition-all border border-slate-700/70"
            >
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>Instant Start (No Email Required)</span>
            </button>
          </div>

          {/* Toggle Password Mode */}
          <div className="mt-3 text-center">
            <button
              type="button"
              onClick={() => {
                setIsPasswordMode(!isPasswordMode);
                setError(null);
              }}
              className="text-[11px] text-slate-400 hover:text-slate-300 font-medium inline-flex items-center gap-1 transition-colors"
            >
              <span>{isPasswordMode ? 'Sign up without password instead' : 'Already have a password-protected account? Sign In'}</span>
              {isPasswordMode ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          </div>

          {/* Demo Sandbox Preview Card */}
          <div className="mt-5 pt-4 border-t border-slate-800 text-center">
            <button
              id="btn_quick_demo"
              type="button"
              onClick={handleQuickDemo}
              disabled={loading || googleLoading}
              className="w-full py-2 px-3 rounded-xl border border-amber-500/20 bg-amber-500/5 hover:bg-amber-500/10 text-amber-300 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Explore Demo Sandbox with Sample Data</span>
            </button>
          </div>

        </div>

        {/* Security Footer */}
        <div className="mt-5 flex items-center justify-center gap-3 text-[11px] text-slate-400">
          <span className="flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" /> Private Cloud Storage
          </span>
          <span>•</span>
          <span>Zero Floating-Point Drift</span>
        </div>

      </div>
    </div>
  );
};
