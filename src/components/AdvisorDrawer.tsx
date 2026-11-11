/**
 * PRYORA Slide-Over Gemini Assistant Drawer & Floating Trigger
 *
 * Allows users to ask financial questions from any tab (Transactions, Budgets,
 * Accounts, Subscriptions, Goals) without losing their place. Shares the exact
 * same in-memory multi-turn conversation state as the full-page AdvisorView.
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  useChat,
  ADVISOR_ROLES,
  MODEL_OPTIONS,
  AdvisorRoleId,
  ModelOption,
} from '../context/ChatContext';
import { Account, DashboardData } from '../types';
import { FormattedAssistantMessage } from './AdvisorView';
import { TabType } from './Navigation';
import {
  Sparkles,
  X,
  Send,
  ShieldCheck,
  ShieldOff,
  Maximize2,
  Trash2,
  Bot,
  Loader2,
  ArrowUpRight,
} from 'lucide-react';

interface AdvisorDrawerProps {
  dashboardData: DashboardData | null;
  accounts: Account[];
  activeTab: TabType;
  onOpenFullView: () => void;
}

export const AdvisorDrawer: React.FC<AdvisorDrawerProps> = ({
  dashboardData,
  accounts,
  activeTab,
  onOpenFullView,
}) => {
  const {
    messages,
    selectedModel,
    selectedRole,
    includeLedgerContext,
    isDrawerOpen,
    isSending,
    error,
    setSelectedModel,
    setSelectedRole,
    setIncludeLedgerContext,
    setIsDrawerOpen,
    sendMessage,
    clearChat,
  } = useChat();

  const [input, setInput] = useState<string>('');
  const endRef = useRef<HTMLDivElement | null>(null);

  const currentRoleMeta =
    ADVISOR_ROLES.find((r) => r.id === selectedRole) || ADVISOR_ROLES[0];

  useEffect(() => {
    if (isDrawerOpen) {
      endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isSending, isDrawerOpen]);

  // Hide the floating button when already on the dedicated full-page Advisor tab
  if (activeTab === 'advisor') {
    return null;
  }

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() || isSending) return;
    const prompt = input;
    setInput('');
    await sendMessage(prompt, { dashboardData, accounts });
  };

  return (
    <>
      {/* Floating Quick-Launch Trigger Button */}
      {!isDrawerOpen && (
        <button
          id="btn_floating_advisor"
          type="button"
          onClick={() => setIsDrawerOpen(true)}
          className="fixed bottom-20 lg:bottom-6 right-4 sm:right-6 z-40 bg-slate-900 dark:bg-emerald-500 text-white dark:text-slate-950 font-bold text-xs px-4 py-3 rounded-2xl shadow-lg border border-slate-800 dark:border-emerald-400 flex items-center gap-2 hover:scale-[1.02] active:scale-95 transition-all cursor-pointer"
          aria-label="Open Gemini Financial Assistant"
        >
          <Sparkles className="w-4 h-4 text-emerald-400 dark:text-slate-950" />
          <span>Ask Advisor</span>
          {messages.length > 0 && (
            <span className="font-mono text-[10px] opacity-80 tabular-nums">
              · {messages.length}
            </span>
          )}
        </button>
      )}

      {/* Slide-Over Assistant Drawer */}
      {isDrawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/40 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 h-full border-l border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col">
            {/* Drawer Header */}
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-500 flex items-center justify-center">
                  <Sparkles className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                    PRYORA Gemini Advisor
                  </h3>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">
                    Session-scoped multi-turn assistant
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setIsDrawerOpen(false);
                    onOpenFullView();
                  }}
                  title="Expand to full-screen Advisor workspace"
                  className="p-2 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                </button>
                {messages.length > 0 && (
                  <button
                    type="button"
                    onClick={clearChat}
                    title="Reset session chat"
                    className="p-2 rounded-lg text-slate-500 hover:text-rose-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsDrawerOpen(false)}
                  title="Close drawer"
                  className="p-2 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Compact Role, Model & Privacy Bar */}
            <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-950/50 border-b border-slate-200/80 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-[11px]">
              <div className="flex items-center gap-1.5">
                <select
                  aria-label="Select Advisor Role"
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value as AdvisorRoleId)}
                  className="px-2 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-semibold text-slate-800 dark:text-slate-200"
                >
                  {ADVISOR_ROLES.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.shortLabel}
                    </option>
                  ))}
                </select>

                <select
                  aria-label="Select Gemini Model"
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value as ModelOption)}
                  className="px-2 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-semibold text-slate-800 dark:text-slate-200"
                >
                  {MODEL_OPTIONS.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                onClick={() => setIncludeLedgerContext(!includeLedgerContext)}
                className={`px-2 py-1 rounded-lg border font-semibold flex items-center gap-1 ${
                  includeLedgerContext
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                    : 'bg-slate-200/60 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                }`}
              >
                {includeLedgerContext ? (
                  <>
                    <ShieldCheck className="w-3 h-3 text-emerald-500" />
                    <span>Ledger: ON</span>
                  </>
                ) : (
                  <>
                    <ShieldOff className="w-3 h-3" />
                    <span>Ledger: OFF</span>
                  </>
                )}
              </button>
            </div>

            {/* Conversation Thread */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 ? (
                <div className="space-y-3 pt-4">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-white">
                    <Bot className="w-4 h-4 text-emerald-500" />
                    <span>{currentRoleMeta.label}</span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    Ask a question about the current screen or pick a starter prompt below:
                  </p>
                  <div className="space-y-2">
                    {currentRoleMeta.starterPrompts.map((prompt, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => sendMessage(prompt, { dashboardData, accounts })}
                        className="w-full p-3 rounded-xl text-left text-xs bg-slate-50 dark:bg-slate-800/60 hover:bg-emerald-500/10 border border-slate-200/80 dark:border-slate-800 text-slate-700 dark:text-slate-200 flex items-center justify-between gap-2 transition-colors"
                      >
                        <span>{prompt}</span>
                        <ArrowUpRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                messages.map((m) => (
                  <div
                    key={m.id}
                    className={`flex flex-col ${
                      m.role === 'user' ? 'items-end' : 'items-start'
                    }`}
                  >
                    <div
                      className={`max-w-[90%] rounded-2xl px-3.5 py-2.5 ${
                        m.role === 'user'
                          ? 'bg-slate-900 text-white dark:bg-emerald-500 dark:text-slate-950 text-xs font-medium'
                          : 'bg-slate-50 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-800'
                      }`}
                    >
                      {m.role === 'user' ? (
                        <p className="whitespace-pre-wrap">{m.text}</p>
                      ) : (
                        <>
                          <FormattedAssistantMessage text={m.text} />
                          <div className="mt-2 pt-1.5 border-t border-slate-200/60 dark:border-slate-700/60 text-[10px] text-slate-400 flex items-center gap-1.5">
                            <span className="font-mono">{m.modelUsed}</span>
                            <span>·</span>
                            <span>{m.groundedInLedger ? 'Ledger Grounded' : 'Privacy Mode'}</span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                ))
              )}

              {isSending && (
                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 p-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-500" />
                  <span>Thinking...</span>
                </div>
              )}

              {error && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-500 text-xs">
                  {error}
                </div>
              )}

              <div ref={endRef} />
            </div>

            {/* Composer */}
            <form
              onSubmit={handleSubmit}
              className="p-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/60 flex items-center gap-2"
            >
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={`Ask ${currentRoleMeta.shortLabel}...`}
                className="flex-1 px-3 py-2 rounded-xl text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <button
                type="submit"
                disabled={!input.trim() || isSending}
                className="px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-slate-950 font-bold text-xs flex items-center gap-1 cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
