/**
 * PRYORA Session-Only Multi-Turn Gemini Chat Context
 *
 * Stores conversation history strictly in memory for the active browser session
 * (never persisted to database or localStorage, per user privacy preference).
 * Shared seamlessly between the full-page AdvisorView and the global Slide-Over Drawer.
 */

import React, { createContext, useContext, useState, useCallback } from 'react';
import { apiRequest } from '../lib/api';
import { Account, DashboardData } from '../types';

export type ModelOption =
  | 'auto'
  | 'gemini-3.1-flash-lite'
  | 'gemini-3.8-flash'
  | 'gemini-4-argon';

export type AdvisorRoleId =
  | 'cfo'
  | 'budget_coach'
  | 'debt_optimizer'
  | 'goals_architect';

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: string;
  modelUsed?: string;
  roleId?: AdvisorRoleId;
  roleTitle?: string;
  groundedInLedger?: boolean;
  fallbackUsed?: boolean;
}

export interface AdvisorRoleMeta {
  id: AdvisorRoleId;
  label: string;
  shortLabel: string;
  description: string;
  starterPrompts: string[];
}

export const ADVISOR_ROLES: AdvisorRoleMeta[] = [
  {
    id: 'cfo',
    label: 'Holistic Personal CFO',
    shortLabel: 'Personal CFO',
    description: 'Executive synthesis of net worth, liquidity runway, savings rate, and cash flow allocation.',
    starterPrompts: [
      'Give me an executive audit of my current net worth, monthly cash flow, and savings rate.',
      'How much free cash flow can I safely move into investments or goals this month?',
      'Simulate what happens to my 6-month runway if my monthly expenses drop by 15%.',
    ],
  },
  {
    id: 'budget_coach',
    label: 'Envelope Budget Coach',
    shortLabel: 'Budget Coach',
    description: 'Category utilization tracking, overspend prevention, and recurring subscription audits.',
    starterPrompts: [
      'Which of my budget envelopes are closest to exceeding their monthly cap right now?',
      'Audit my active subscriptions and recurring bills—where can I trim recurring costs?',
      'Build a weekly spending pacing plan for the rest of this month based on my remaining budgets.',
    ],
  },
  {
    id: 'debt_optimizer',
    label: 'Credit & Debt Strategist',
    shortLabel: 'Debt Strategist',
    description: 'Credit card utilization targets (<30%), statement cycle timing, and Avalanche vs Snowball math.',
    starterPrompts: [
      'Analyze my credit card balances and utilization percentages. Which card should I pay down first?',
      'Compare Debt Avalanche vs Debt Snowball payoff timelines for my current liabilities.',
      'How much do I need to pay before my next statement closing date to bring utilization under 10%?',
    ],
  },
  {
    id: 'goals_architect',
    label: 'Savings Goal Architect',
    shortLabel: 'Goal Architect',
    description: 'Milestone runway modeling, monthly contribution targets, and emergency fund prioritization.',
    starterPrompts: [
      'Review my active savings goals and calculate the exact monthly contribution needed for each.',
      'How should I prioritize between my emergency fund and my other active milestones?',
      'If I increase my monthly savings contribution by 20%, how many months earlier will I hit my goals?',
    ],
  },
];

export interface ModelOptionMeta {
  id: ModelOption;
  label: string;
  badge: string;
  description: string;
}

export const MODEL_OPTIONS: ModelOptionMeta[] = [
  {
    id: 'auto',
    label: 'Auto-Route',
    badge: 'Smart',
    description: 'Automatically selects Flash-Lite, Flash 3.8, or Argon 4 based on question complexity.',
  },
  {
    id: 'gemini-3.1-flash-lite',
    label: 'Gemini 3.1 Flash-Lite',
    badge: 'Fastest',
    description: 'Low-latency responses for quick balance checks, definitions, and rapid follow-ups.',
  },
  {
    id: 'gemini-3.8-flash',
    label: 'Gemini 3.8 Flash',
    badge: 'Balanced',
    description: 'Ideal everyday financial advisor for budget reviews, cash flow Q&A, and insights.',
  },
  {
    id: 'gemini-4-argon',
    label: 'Gemini 4 Argon',
    badge: 'Deep Reasoning',
    description: 'Multi-step financial simulations, debt payoff modeling, and scenario trade-offs.',
  },
];

interface ChatContextValue {
  messages: ChatMessage[];
  selectedModel: ModelOption;
  selectedRole: AdvisorRoleId;
  includeLedgerContext: boolean;
  isDrawerOpen: boolean;
  isSending: boolean;
  error: string | null;
  setSelectedModel: (model: ModelOption) => void;
  setSelectedRole: (role: AdvisorRoleId) => void;
  setIncludeLedgerContext: (include: boolean) => void;
  setIsDrawerOpen: (open: boolean) => void;
  sendMessage: (
    promptText: string,
    clientContext?: { dashboardData?: DashboardData | null; accounts?: Account[] }
  ) => Promise<void>;
  clearChat: () => void;
  dismissError: () => void;
}

const ChatContext = createContext<ChatContextValue | undefined>(undefined);

export const ChatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [selectedModel, setSelectedModel] = useState<ModelOption>('auto');
  const [selectedRole, setSelectedRole] = useState<AdvisorRoleId>('cfo');
  const [includeLedgerContext, setIncludeLedgerContext] = useState<boolean>(true);
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);
  const [isSending, setIsSending] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const clearChat = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  const dismissError = useCallback(() => {
    setError(null);
  }, []);

  const sendMessage = useCallback(
    async (
      promptText: string,
      clientContext?: { dashboardData?: DashboardData | null; accounts?: Account[] }
    ) => {
      const trimmed = promptText.trim();
      if (!trimmed || isSending) return;

      const userMsg: ChatMessage = {
        id: `msg_${Date.now()}_user`,
        role: 'user',
        text: trimmed,
        timestamp: new Date().toISOString(),
      };

      const historyPayload = messages.map((m) => ({
        role: m.role,
        text: m.text,
      }));

      setMessages((prev) => [...prev, userMsg]);
      setIsSending(true);
      setError(null);

      try {
        const clientSnapshot =
          includeLedgerContext && clientContext?.dashboardData
            ? {
                summary: clientContext.dashboardData.summary,
                accounts: clientContext.accounts || clientContext.dashboardData.accounts,
                budgets: clientContext.dashboardData.budgets,
                goals: clientContext.dashboardData.goals,
              }
            : undefined;

        const response = await apiRequest<{
          reply: string;
          modelUsed: string;
          requestedModel: string;
          fallbackUsed?: boolean;
          roleId: AdvisorRoleId;
          roleTitle: string;
          groundedInLedger: boolean;
          timestamp: string;
        }>('/api/chat/message', {
          method: 'POST',
          body: JSON.stringify({
            message: trimmed,
            history: historyPayload,
            modelMode: selectedModel,
            roleId: selectedRole,
            includeLedgerContext,
            clientSnapshot,
          }),
        });

        const modelMsg: ChatMessage = {
          id: `msg_${Date.now()}_model`,
          role: 'model',
          text: response.reply,
          timestamp: response.timestamp || new Date().toISOString(),
          modelUsed: response.modelUsed,
          roleId: response.roleId,
          roleTitle: response.roleTitle,
          groundedInLedger: response.groundedInLedger,
          fallbackUsed: response.fallbackUsed,
        };

        setMessages((prev) => [...prev, modelMsg]);
      } catch (err: any) {
        console.error('Gemini Advisor chat error:', err);
        setError(
          err?.message ||
            'Could not reach the PRYORA Gemini Financial Assistant. Please try again.'
        );
      } finally {
        setIsSending(false);
      }
    },
    [isSending, messages, selectedModel, selectedRole, includeLedgerContext]
  );

  return (
    <ChatContext.Provider
      value={{
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
        dismissError,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
};

export function useChat(): ChatContextValue {
  const ctx = useContext(ChatContext);
  if (!ctx) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return ctx;
}
