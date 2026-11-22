/**
 * PRYORA Global Platform Feedback Widget & Modal
 *
 * Accessible from every screen in PRYORA (Landing, Auth, Onboarding, and all Workspace tabs).
 * Clean 3-field direct flow: Email -> Subject -> Feedback -> Send directly to the PRYORA inbox.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../lib/api';
import {
  MessageSquarePlus,
  X,
  Send,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from 'lucide-react';

interface FeedbackWidgetProps {
  screenContext: string;
  hasMobileDock?: boolean;
}

export function openFeedbackModal(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('pryora:open-feedback'));
  }
}

export const FeedbackWidget: React.FC<FeedbackWidgetProps> = ({
  screenContext,
  hasMobileDock = false,
}) => {
  const { user } = useAuth();

  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [email, setEmail] = useState<string>('');
  const [subject, setSubject] = useState<string>('');
  const [message, setMessage] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<boolean>(false);

  const defaultUserEmail = useMemo(() => {
    const userEmail = user?.email?.trim() || '';
    if (!userEmail || userEmail === 'demo@pryora.app' || userEmail.endsWith('@pryora.local')) {
      return '';
    }
    return userEmail;
  }, [user?.email]);

  const handleOpen = useCallback(() => {
    setError(null);
    setSent(false);
    setEmail((prev) => prev || defaultUserEmail);
    setIsOpen(true);
  }, [defaultUserEmail]);

  const handleClose = useCallback(() => {
    if (submitting) return;
    setIsOpen(false);
  }, [submitting]);

  // Allow any screen (e.g., landing footer) to open the feedback modal globally
  useEffect(() => {
    const onOpenEvent = () => handleOpen();
    window.addEventListener('pryora:open-feedback', onOpenEvent);
    return () => window.removeEventListener('pryora:open-feedback', onOpenEvent);
  }, [handleOpen]);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, handleClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedEmail = email.trim();
    const trimmedSubject = subject.trim();
    const trimmedMessage = message.trim();

    if (!trimmedEmail || !trimmedEmail.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }

    if (trimmedSubject.length < 2) {
      setError('Please enter a subject for your feedback.');
      return;
    }

    if (trimmedMessage.length < 5) {
      setError('Please enter at least 5 characters of feedback.');
      return;
    }

    setSubmitting(true);
    try {
      await apiRequest('/api/feedback', {
        method: 'POST',
        body: JSON.stringify({
          email: trimmedEmail,
          subject: trimmedSubject,
          message: trimmedMessage,
          pageContext: screenContext,
        }),
      });
      setSent(true);
      setSubject('');
      setMessage('');
    } catch (err: any) {
      setError(err?.message || 'Could not send feedback right now. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendAnother = () => {
    setSent(false);
    setError(null);
    setSubject('');
    setMessage('');
  };

  return (
    <>
      {/* Persistent Global Floating Feedback Button */}
      <button
        id="btn_global_feedback"
        type="button"
        onClick={handleOpen}
        aria-label="Send feedback about PRYORA"
        title="Send feedback about PRYORA"
        className={`fixed right-4 sm:right-6 z-40 h-10 px-3.5 rounded-xl bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white border border-slate-700/80 dark:border-slate-700 shadow-lg shadow-slate-950/20 inline-flex items-center gap-2 text-xs font-semibold transition-all hover:-translate-y-0.5 active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
          hasMobileDock ? 'bottom-20 lg:bottom-6' : 'bottom-5'
        }`}
      >
        <MessageSquarePlus className="w-4 h-4 text-emerald-400 shrink-0" />
        <span className="hidden sm:inline whitespace-nowrap">Feedback</span>
      </button>

      {/* Direct Send Feedback Modal */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/65 backdrop-blur-xs animate-in fade-in duration-150"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pryora_feedback_title"
          onClick={(e) => {
            if (e.target === e.currentTarget) handleClose();
          }}
        >
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden text-slate-900 dark:text-slate-100">
            {/* Subtle top emerald accent bar */}
            <div className="h-0.5 w-full bg-gradient-to-r from-emerald-500/80 via-teal-400/80 to-emerald-500/80" />

            {/* Header */}
            <div className="px-6 pt-5 pb-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/25 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                  <Send className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h2
                    id="pryora_feedback_title"
                    className="text-base font-bold text-slate-950 dark:text-white tracking-tight leading-snug"
                  >
                    Send Feedback
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Every message is read personally.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleClose}
                disabled={submitting}
                className="w-8 h-8 rounded-lg inline-flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
                aria-label="Close feedback modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {sent ? (
              /* Direct Confirmation State */
              <div className="px-6 pb-6 pt-2 space-y-5">
                <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  <div className="space-y-1 min-w-0">
                    <h3 className="text-sm font-bold text-emerald-950 dark:text-emerald-200">
                      Feedback sent!
                    </h3>
                    <p className="text-xs text-emerald-800 dark:text-emerald-300/90 leading-relaxed">
                      Thank you for sharing your thoughts on PRYORA. Your message has been emailed directly to our inbox.
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 pt-1">
                  <button
                    type="button"
                    onClick={handleSendAnother}
                    className="text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white transition-colors"
                  >
                    Send another message
                  </button>
                  <button
                    type="button"
                    onClick={handleClose}
                    className="h-10 px-5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition-colors"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              /* Clean 3-Field Form: Email, Subject, Feedback + Direct Send */
              <form onSubmit={handleSubmit} className="px-6 pb-6 pt-1 space-y-4">
                {error && (
                  <div className="px-3.5 py-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-200 text-xs flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </div>
                )}

                {/* 1. Email */}
                <div>
                  <label
                    htmlFor="input_feedback_email"
                    className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5"
                  >
                    Email <span className="text-emerald-600 dark:text-emerald-400">*</span>
                  </label>
                  <input
                    id="input_feedback_email"
                    type="email"
                    required
                    maxLength={254}
                    autoComplete="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full h-11 px-3.5 bg-slate-50 dark:bg-slate-800/70 border border-slate-300 dark:border-slate-700/90 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors"
                  />
                </div>

                {/* 2. Subject */}
                <div>
                  <label
                    htmlFor="input_feedback_subject"
                    className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5"
                  >
                    Subject <span className="text-emerald-600 dark:text-emerald-400">*</span>
                  </label>
                  <input
                    id="input_feedback_subject"
                    type="text"
                    required
                    minLength={2}
                    maxLength={160}
                    placeholder="Bug report, feature suggestion, UI feedback, etc."
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full h-11 px-3.5 bg-slate-50 dark:bg-slate-800/70 border border-slate-300 dark:border-slate-700/90 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors"
                  />
                </div>

                {/* 3. Feedback Message */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label
                      htmlFor="textarea_platform_feedback"
                      className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400"
                    >
                      Feedback <span className="text-emerald-600 dark:text-emerald-400">*</span>
                    </label>
                    <span className="text-[11px] font-mono tabular-nums text-slate-400 dark:text-slate-500">
                      {message.length} / 3000
                    </span>
                  </div>
                  <textarea
                    id="textarea_platform_feedback"
                    rows={4}
                    required
                    minLength={5}
                    maxLength={3000}
                    placeholder="Tell us what you think about PRYORA, report a bug, or share an idea..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/70 border border-slate-300 dark:border-slate-700/90 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors resize-y"
                  />
                </div>

                {/* Full-Width Direct Send Button */}
                <div className="pt-1">
                  <button
                    id="btn_submit_platform_feedback"
                    type="submit"
                    disabled={submitting}
                    className="w-full h-11 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:scale-[0.99] text-slate-950 font-bold text-xs sm:text-sm inline-flex items-center justify-center gap-2 transition-all shadow-sm shadow-emerald-500/20 disabled:opacity-60"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                        <span>Sending Feedback...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4 shrink-0" />
                        <span>Send Feedback</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
};
