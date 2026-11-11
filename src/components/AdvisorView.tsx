/**
 * PRYORA Gemini Financial Assistant — Dedicated Full-Page Advisor Workspace
 *
 * Features:
 * - Multi-turn session-scoped conversation thread with clean markdown rendering
 * - 4 Role-Based Financial Personas (Holistic CFO, Budget Coach, Debt Strategist, Goal Architect)
 * - 3-Tier Gemini Model Selector (Auto-Route, Gemini 3.1 Flash-Lite, Gemini 3.8 Flash, Gemini 4 Argon)
 * - Explicit Privacy Toggle ("Share Live Ledger Snapshot: On / Off")
 * - Live Ledger Context Inspector panel displaying the exact sanitized metrics shared when enabled
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  useChat,
  ADVISOR_ROLES,
  MODEL_OPTIONS,
  AdvisorRoleId,
  ModelOption,
} from '../context/ChatContext';
import { useAuth } from '../context/AuthContext';
import { Account, DashboardData } from '../types';
import { formatMinorUnits as formatCurrency } from '../lib/currency';
import {
  Send,
  Trash2,
  ShieldCheck,
  ShieldOff,
  Sparkles,
  Bot,
  User,
  AlertCircle,
  Loader2,
  Cpu,
  SlidersHorizontal,
  ArrowUpRight,
  Lock,
  Eye,
} from 'lucide-react';

interface AdvisorViewProps {
  dashboardData: DashboardData | null;
  accounts: Account[];
}

/**
 * Lightweight, safe structured text formatter for financial responses
 * Renders paragraphs, bullet lists, bold text, and tabular numbers cleanly.
 */
export const FormattedAssistantMessage: React.FC<{ text: string }> = ({ text }) => {
  const lines = text.split('\n');

  const formatInline = (line: string) => {
    const parts = line.split(/(\*\*.*?\*\*|`.*?`)/g);
    return parts.map((part, idx) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong key={idx} className="font-bold text-slate-900 dark:text-white">
            {part.slice(2, -2)}
          </strong>
        );
      }
      if (part.startsWith('`') && part.endsWith('`')) {
        return (
          <code
            key={idx}
            className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-slate-200/70 dark:bg-slate-800 text-emerald-700 dark:text-emerald-300 tabular-nums"
          >
            {part.slice(1, -1)}
          </code>
        );
      }
      return <React.Fragment key={idx}>{part}</React.Fragment>;
    });
  };

  return (
    <div className="space-y-2 text-xs sm:text-sm leading-relaxed text-slate-700 dark:text-slate-200">
      {lines.map((rawLine, index) => {
        const line = rawLine.trim();
        if (!line) {
          return <div key={index} className="h-1" />;
        }
        if (line.startsWith('### ')) {
          return (
            <h4
              key={index}
              className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white pt-2"
            >
              {formatInline(line.replace(/^###\s+/, ''))}
            </h4>
          );
        }
        if (line.startsWith('## ') || line.startsWith('# ')) {
          return (
            <h3
              key={index}
              className="text-sm sm:text-base font-bold text-slate-900 dark:text-white pt-2"
            >
              {formatInline(line.replace(/^#+\s+/, ''))}
            </h3>
          );
        }
        if (line.startsWith('- ') || line.startsWith('* ')) {
          return (
            <div key={index} className="flex items-start gap-2 pl-1">
              <span className="text-emerald-500 font-bold mt-0.5 select-none">·</span>
              <span className="flex-1">{formatInline(line.slice(2))}</span>
            </div>
          );
        }
        if (/^\d+\.\s/.test(line)) {
          const match = line.match(/^(\d+\.)\s+(.*)$/);
          if (match) {
            return (
              <div key={index} className="flex items-start gap-2 pl-1">
                <span className="font-mono text-xs font-semibold text-emerald-600 dark:text-emerald-400 mt-0.5 tabular-nums">
                  {match[1]}
                </span>
                <span className="flex-1">{formatInline(match[2])}</span>
              </div>
            );
          }
        }
        return <p key={index}>{formatInline(line)}</p>;
      })}
    </div>
  );
};

export const AdvisorView: React.FC<AdvisorViewProps> = ({ dashboardData, accounts }) => {
  const { user } = useAuth();
  const {
    messages,
    selectedModel,
    selectedRole,
    includeLedgerContext,
    isSending,
    error,
    setSelectedModel,
    setSelectedRole,
    setIncludeLedgerContext,
    sendMessage,
    clearChat,
    dismissError,
  } = useChat();

  const [inputPrompt, setInputPrompt] = useState<string>('');
  const [showInspectorMobile, setShowInspectorMobile] = useState<boolean>(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const currency = user?.currency || 'INR';
  const currentRoleMeta =
    ADVISOR_ROLES.find((r) => r.id === selectedRole) || ADVISOR_ROLES[0];
  const currentModelMeta =
    MODEL_OPTIONS.find((m) => m.id === selectedModel) || MODEL_OPTIONS[0];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isSending]);

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputPrompt.trim() || isSending) return;
    const text = inputPrompt;
    setInputPrompt('');
    await sendMessage(text, { dashboardData, accounts });
  };

  const handleStarterPrompt = async (prompt: string) => {
    if (isSending) return;
    await sendMessage(prompt, { dashboardData, accounts });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const summary = dashboardData?.summary;
  const budgets = dashboardData?.budgets || [];
  const goals = dashboardData?.goals || [];

  return (
    <div className="space-y-5">
      {/* Top Control Header */}
      <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              <Sparkles className="w-3.5 h-3.5" />
              <span>PRYORA Financial Intelligence</span>
              <span aria-hidden="true">·</span>
              <span className="text-slate-500 dark:text-slate-400 font-normal">
                Session-Only Memory
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight mt-1">
              Gemini Financial Advisor
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Multi-turn financial strategy grounded in your live PRYORA ledger with full privacy controls.
            </p>
          </div>

          {/* Right Toolbar: Privacy Toggle + Clear Session */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => setIncludeLedgerContext(!includeLedgerContext)}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold border flex items-center gap-2 transition-colors ${
                includeLedgerContext
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                  : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
              }`}
              title="Control whether your sanitized account balances, budgets, and goals are shared with Gemini"
            >
              {includeLedgerContext ? (
                <>
                  <ShieldCheck className="w-4 h-4 text-emerald-500" />
                  <span>Live Ledger Grounding: ON</span>
                </>
              ) : (
                <>
                  <ShieldOff className="w-4 h-4 text-slate-400" />
                  <span>Live Ledger Grounding: OFF</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => setShowInspectorMobile(!showInspectorMobile)}
              className="lg:hidden px-3 py-2 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 flex items-center gap-1.5"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>{showInspectorMobile ? 'Hide Context' : 'Inspect Context'}</span>
            </button>

            {messages.length > 0 && (
              <button
                type="button"
                onClick={clearChat}
                className="px-3 py-2 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:border-rose-500/30 flex items-center gap-1.5 transition-colors"
                title="Wipe current session chat history from memory"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Reset Session</span>
              </button>
            )}
          </div>
        </div>

        {/* Role & Model Configuration Bar */}
        <div className="mt-5 pt-4 border-t border-slate-200/80 dark:border-slate-800 grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
          {/* Persona Selector (8 cols) */}
          <div className="md:col-span-8">
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">
              Advisor Persona
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {ADVISOR_ROLES.map((role) => {
                const active = selectedRole === role.id;
                return (
                  <button
                    key={role.id}
                    type="button"
                    onClick={() => setSelectedRole(role.id as AdvisorRoleId)}
                    className={`px-3 py-2 rounded-xl text-left border transition-colors ${
                      active
                        ? 'bg-slate-900 text-white border-slate-900 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/40'
                        : 'bg-slate-50/70 dark:bg-slate-800/40 text-slate-700 dark:text-slate-300 border-slate-200/70 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <div className="text-xs font-bold truncate">{role.shortLabel}</div>
                    <div
                      className={`text-[10px] truncate mt-0.5 ${
                        active
                          ? 'text-slate-300 dark:text-emerald-400/80'
                          : 'text-slate-400 dark:text-slate-500'
                      }`}
                    >
                      {role.id === 'cfo' && 'Net Worth & Cash Flow'}
                      {role.id === 'budget_coach' && 'Envelopes & Caps'}
                      {role.id === 'debt_optimizer' && 'Credit & Payoff'}
                      {role.id === 'goals_architect' && 'Runway & Milestones'}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Model Tier Selector (4 cols) */}
          <div className="md:col-span-4">
            <label
              htmlFor="advisor-model-select"
              className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2 flex items-center gap-1.5"
            >
              <Cpu className="w-3.5 h-3.5 text-emerald-500" />
              <span>Gemini Model Engine</span>
            </label>
            <select
              id="advisor-model-select"
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value as ModelOption)}
              className="w-full px-3 py-2.5 rounded-xl text-xs font-semibold bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              {MODEL_OPTIONS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label} ({m.badge})
                </option>
              ))}
            </select>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 truncate">
              {currentModelMeta.description}
            </p>
          </div>
        </div>
      </div>

      {/* Main Workspace Grid: 8-Col Chat Thread + 4-Col Live Context Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left/Center Column: Multi-Turn Conversation Canvas */}
        <div className="lg:col-span-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col h-[640px] overflow-hidden">
          {/* Active Persona Subbar */}
          <div className="px-5 py-3 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between text-xs bg-slate-50/50 dark:bg-slate-950/40">
            <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
              <SlidersHorizontal className="w-3.5 h-3.5 text-emerald-500" />
              <span className="font-semibold text-slate-900 dark:text-white">
                {currentRoleMeta.label}
              </span>
              <span aria-hidden="true">·</span>
              <span className="text-slate-500 dark:text-slate-400 hidden sm:inline">
                {currentRoleMeta.description}
              </span>
            </div>
            <span className="font-mono text-[11px] text-slate-400 dark:text-slate-500 tabular-nums">
              {messages.length} {messages.length === 1 ? 'turn' : 'turns'}
            </span>
          </div>

          {/* Scrollable Message Thread */}
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col justify-center max-w-xl mx-auto py-6">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 flex items-center justify-center mb-4">
                  <Bot className="w-5 h-5" />
                </div>
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white mb-1">
                  Ask {currentRoleMeta.label}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-5">
                  {includeLedgerContext
                    ? 'Live Ledger Grounding is active. Gemini will reference your real-time account balances, budget envelopes, credit utilization, and savings goals.'
                    : 'Privacy Mode is active. Gemini will answer using general financial principles without reading your ledger balances.'}
                </p>

                <div className="space-y-2.5">
                  <span className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    Suggested Prompts for {currentRoleMeta.shortLabel}
                  </span>
                  {currentRoleMeta.starterPrompts.map((prompt, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleStarterPrompt(prompt)}
                      disabled={isSending}
                      className="w-full p-3.5 rounded-xl text-left text-xs font-medium bg-slate-50 dark:bg-slate-800/50 hover:bg-emerald-500/5 dark:hover:bg-emerald-500/10 border border-slate-200/80 dark:border-slate-800 hover:border-emerald-500/40 text-slate-700 dark:text-slate-200 flex items-center justify-between gap-3 transition-all group"
                    >
                      <span>{prompt}</span>
                      <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-500 shrink-0 transition-colors" />
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((msg) => {
                const isUser = msg.role === 'user';
                return (
                  <div
                    key={msg.id}
                    className={`flex items-start gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}
                  >
                    {!isUser && (
                      <div className="w-7 h-7 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-500 flex items-center justify-center shrink-0 mt-0.5">
                        <Bot className="w-4 h-4" />
                      </div>
                    )}

                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-3.5 ${
                        isUser
                          ? 'bg-slate-900 text-white dark:bg-emerald-500 dark:text-slate-950 font-medium text-xs sm:text-sm'
                          : 'bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800'
                      }`}
                    >
                      {isUser ? (
                        <p className="whitespace-pre-wrap leading-relaxed">{msg.text}</p>
                      ) : (
                        <>
                          <FormattedAssistantMessage text={msg.text} />
                          <div className="mt-3 pt-2 border-t border-slate-200/60 dark:border-slate-700/60 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-400 dark:text-slate-500">
                            <span>{msg.roleTitle || 'PRYORA Advisor'}</span>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono">{msg.modelUsed || 'gemini-3.8-flash'}</span>
                            <span aria-hidden="true">·</span>
                            <span>
                              {msg.groundedInLedger ? 'Ledger Grounded' : 'Privacy Mode'}
                            </span>
                          </div>
                        </>
                      )}
                    </div>

                    {isUser && (
                      <div className="w-7 h-7 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center shrink-0 mt-0.5">
                        <User className="w-4 h-4" />
                      </div>
                    )}
                  </div>
                );
              })
            )}

            {isSending && (
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-500 flex items-center justify-center shrink-0">
                  <Loader2 className="w-4 h-4 animate-spin" />
                </div>
                <div className="rounded-2xl px-4 py-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2">
                  <span>Analyzing financial context with {currentModelMeta.label}...</span>
                </div>
              </div>
            )}

            {error && (
              <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
                <button
                  type="button"
                  onClick={dismissError}
                  className="underline font-semibold shrink-0"
                >
                  Dismiss
                </button>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input Composer */}
          <form
            onSubmit={handleSend}
            className="p-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/60"
          >
            <div className="flex items-end gap-2">
              <textarea
                rows={2}
                value={inputPrompt}
                onChange={(e) => setInputPrompt(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={`Ask ${currentRoleMeta.shortLabel} a question... (Press Enter to send, Shift+Enter for new line)`}
                className="flex-1 resize-none rounded-xl px-3.5 py-2.5 text-xs sm:text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <button
                type="submit"
                disabled={!inputPrompt.trim() || isSending}
                className="h-10 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-all shrink-0 cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Send</span>
              </button>
            </div>
          </form>
        </div>

        {/* Right Column: Live Ledger Context Inspector (4 cols) */}
        <div
          className={`lg:col-span-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-4 ${
            showInspectorMobile ? 'block' : 'hidden lg:block'
          }`}
        >
          <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-slate-800 pb-3">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                Ledger Grounding Inspector
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Exact context shared with Gemini per turn
              </p>
            </div>
            <span
              className={`text-[11px] font-semibold ${
                includeLedgerContext
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-slate-400 dark:text-slate-500'
              }`}
            >
              {includeLedgerContext ? 'Active' : 'Paused'}
            </span>
          </div>

          {!includeLedgerContext ? (
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800 text-xs space-y-2">
              <div className="flex items-center gap-2 font-bold text-slate-800 dark:text-slate-200">
                <Lock className="w-4 h-4 text-emerald-500" />
                <span>Zero Ledger Data Shared</span>
              </div>
              <p className="text-slate-500 dark:text-slate-400 leading-relaxed">
                Live Ledger Grounding is currently turned <strong>OFF</strong>. Your account balances, budgets, and goals are withheld from the prompt context.
              </p>
              <button
                type="button"
                onClick={() => setIncludeLedgerContext(true)}
                className="mt-2 text-emerald-600 dark:text-emerald-400 font-semibold hover:underline block"
              >
                Enable Live Ledger Grounding →
              </button>
            </div>
          ) : (
            <div className="space-y-4 text-xs">
              {/* Executive Metrics Snapshot */}
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800 space-y-2">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Cash Flow & Net Worth
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Net Worth</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white tabular-nums">
                    {formatCurrency(summary?.net_worth_minor || 0, currency)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Monthly Inflow</span>
                  <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
                    {formatCurrency(summary?.income_minor || 0, currency)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Monthly Outflow</span>
                  <span className="font-mono font-semibold text-rose-500 dark:text-rose-400 tabular-nums">
                    {formatCurrency(summary?.expenses_minor || 0, currency)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Savings Rate</span>
                  <span className="font-mono font-semibold text-slate-900 dark:text-white tabular-nums">
                    {summary?.savings_rate_pct ?? 0}%
                  </span>
                </div>
              </div>

              {/* Accounts Snapshot */}
              <div>
                <div className="flex justify-between text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">
                  <span>Accounts ({accounts.length})</span>
                  <span>Balance</span>
                </div>
                <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                  {accounts.slice(0, 6).map((acc) => (
                    <div
                      key={acc.id}
                      className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800/60 last:border-b-0"
                    >
                      <span className="text-slate-700 dark:text-slate-300 truncate max-w-[150px]">
                        {acc.name}{' '}
                        <span className="text-[10px] text-slate-400">· {acc.type}</span>
                      </span>
                      <span className="font-mono font-semibold text-slate-900 dark:text-white tabular-nums">
                        {formatCurrency(acc.current_balance_minor, currency)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Envelope Budgets Snapshot */}
              {budgets.length > 0 && (
                <div>
                  <div className="flex justify-between text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">
                    <span>Envelope Budgets ({budgets.length})</span>
                    <span>Used</span>
                  </div>
                  <div className="space-y-1.5">
                    {budgets.slice(0, 4).map((b) => (
                      <div key={b.id} className="flex items-center justify-between">
                        <span className="text-slate-700 dark:text-slate-300 truncate max-w-[160px]">
                          {b.category_name}
                        </span>
                        <span
                          className={`font-mono font-semibold tabular-nums ${
                            (b.percentage || 0) >= 90
                              ? 'text-rose-500'
                              : (b.percentage || 0) >= 75
                              ? 'text-amber-500'
                              : 'text-emerald-600 dark:text-emerald-400'
                          }`}
                        >
                          {b.percentage || 0}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Active Goals Snapshot */}
              {goals.length > 0 && (
                <div>
                  <div className="flex justify-between text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">
                    <span>Active Goals ({goals.length})</span>
                    <span>Target</span>
                  </div>
                  <div className="space-y-1.5">
                    {goals.slice(0, 3).map((g) => (
                      <div key={g.id} className="flex items-center justify-between">
                        <span className="text-slate-700 dark:text-slate-300 truncate max-w-[150px]">
                          {g.name}
                        </span>
                        <span className="font-mono text-slate-900 dark:text-white tabular-nums">
                          {formatCurrency(g.current_amount_minor, currency)} /{' '}
                          {formatCurrency(g.target_amount_minor, currency)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
