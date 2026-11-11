/**
 * PRYORA Gemini Financial Assistant — Multi-Turn Conversational API Route
 *
 * Implements:
 * - Multi-turn chat via @google/genai (ai.chats.create + chat.sendMessage)
 * - 3-Tier Gemini Model Routing:
 *   1. Fast tasks: 'gemini-3.1-flash-lite'
 *   2. General conversational & financial tasks: 'gemini-3.8-flash'
 *   3. Complex multi-step financial reasoning: 'gemini-4-argon'
 *   4. 'auto' classifier that routes based on prompt complexity
 * - Role-based financial system instructions (CFO, Budget Coach, Debt Strategist, Goals Architect)
 * - Privacy-controlled Live Ledger Grounding snapshot
 */

import { Router } from 'express';
import { GoogleGenAI } from '@google/genai';
import { requireAuth, AuthenticatedRequest } from '../auth.js';
import { query } from '../db/database.js';
import { calculateNetWorth, calculateCashFlow } from '../domain/finance.js';

export const chatRouter = Router();

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

export interface ChatHistoryTurn {
  role: 'user' | 'model';
  text: string;
}

const ROLE_INSTRUCTIONS: Record<AdvisorRoleId, { title: string; instruction: string }> = {
  cfo: {
    title: 'Holistic Personal CFO',
    instruction: `You are PRYORA's Holistic Personal CFO — an analytical, institutional-grade personal finance advisor embedded inside PRYORA Personal Finance OS.
Your focus:
- Evaluate overall net worth, asset-to-liability ratios, liquidity runway, and monthly savings rate.
- Connect the dots between checking/savings balances, monthly cash flow, envelope budgets, recurring subscriptions, and long-term savings goals.
- Provide concrete, numbers-backed action plans using the user's primary currency.
- Format numbers clearly, use concise bullet points and markdown tables when comparing scenarios, and never fabricate transactions that aren't in the provided context.`,
  },
  budget_coach: {
    title: 'Envelope Budget Coach',
    instruction: `You are PRYORA's Envelope Budget Coach — a pragmatic behavioral spending specialist inside PRYORA Personal Finance OS.
Your focus:
- Analyze monthly category budget caps, current utilization percentages, and discretionary vs fixed expenses.
- Identify categories at risk of overspending (>80% utilization) and audit recurring subscriptions for potential savings.
- Recommend practical weekly spending pacing and realistic envelope reallocations without judgmental language.`,
  },
  debt_optimizer: {
    title: 'Credit & Debt Strategist',
    instruction: `You are PRYORA's Credit & Debt Strategist — a specialist in credit utilization optimization, statement cycle timing, and debt payoff math.
Your focus:
- Analyze credit card balances, credit limits, utilization percentages (targeting <30% overall and <10% optimal), statement closing days, and payment due days.
- Compare Debt Avalanche (highest APR first) vs Debt Snowball (smallest balance first) payoff schedules with clear step-by-step math.
- Help the user schedule internal account transfers before statement closing dates to keep reported utilization low.`,
  },
  goals_architect: {
    title: 'Savings Goal Architect',
    instruction: `You are PRYORA's Savings Goal Architect — a milestone and runway planner inside PRYORA Personal Finance OS.
Your focus:
- Analyze active savings goals, target amounts, current saved amounts, remaining funding gaps, and target dates.
- Calculate exact monthly or weekly contribution requirements to hit each milestone on schedule.
- Suggest how much free monthly cash flow can be safely directed toward emergency funds, major purchases, or investments.`,
  },
};

/**
 * Classifies an incoming user message when modelMode === 'auto'
 */
function resolveTargetModel(
  modelMode: ModelOption,
  message: string,
  historyLength: number
): 'gemini-3.1-flash-lite' | 'gemini-3.8-flash' | 'gemini-4-argon' {
  if (
    modelMode === 'gemini-3.1-flash-lite' ||
    modelMode === 'gemini-3.8-flash' ||
    modelMode === 'gemini-4-argon'
  ) {
    return modelMode;
  }

  const normalized = message.toLowerCase().trim();

  // Complex multi-step financial simulation / optimization keywords -> gemini-4-argon
  const complexKeywords = [
    'simulate',
    'simulation',
    'scenario',
    'avalanche',
    'snowball',
    'amortization',
    'rebalance',
    'reallocate',
    'multi-year',
    'projection',
    'forecast',
    'trade-off',
    'compare strategies',
    'step-by-step plan',
    'comprehensive audit',
    'debt payoff plan',
    'runway analysis',
  ];

  if (
    message.length > 260 ||
    complexKeywords.some((kw) => normalized.includes(kw))
  ) {
    return 'gemini-4-argon';
  }

  // Quick definitions, short lookups, or simple greetings -> gemini-3.1-flash-lite
  const fastKeywords = [
    'what is',
    'define',
    'quick',
    'summary in one sentence',
    'hello',
    'hi ',
    'thanks',
    'thank you',
  ];

  if (
    message.length < 75 &&
    historyLength <= 2 &&
    (fastKeywords.some((kw) => normalized.includes(kw)) || !normalized.includes('why'))
  ) {
    return 'gemini-3.1-flash-lite';
  }

  // Default balanced model -> gemini-3.8-flash
  return 'gemini-3.8-flash';
}

/**
 * Formats minor integer units (cents/paise) into human-readable currency string
 */
function formatMinorCurrency(amountMinor: number, currency: string): string {
  const major = (amountMinor || 0) / 100;
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'INR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(major);
  } catch {
    return `${currency || 'INR'} ${major.toFixed(2)}`;
  }
}

/**
 * Builds a structured, sanitized financial ledger snapshot for the authenticated user
 */
function buildLedgerSnapshot(userId: string, currency: string, clientSnapshot?: any) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonthNum = now.getMonth() + 1;
  const currentMonthStr = `${currentYear}-${String(currentMonthNum).padStart(2, '0')}`;
  const startOfMonth = `${currentMonthStr}-01`;
  const endOfMonth = `${currentMonthStr}-31`;

  // 1. Accounts
  let accounts = query<any>(
    `SELECT id, name, type, currency, current_balance_minor, credit_limit_minor, statement_day, due_day, minimum_payment_minor
     FROM accounts
     WHERE user_id = ? AND is_archived = 0
     ORDER BY type ASC, name ASC`,
    [userId]
  );

  // If SQLite has no accounts but client passed live Firebase/dashboard state, use clientSnapshot
  if (accounts.length === 0 && clientSnapshot?.accounts?.length) {
    accounts = clientSnapshot.accounts;
  }

  const netWorthData = calculateNetWorth(accounts);

  // 2. Current Month Transactions
  const currentMonthTxs = query<any>(
    `SELECT id, account_id, to_account_id, category_id, type, amount_minor, date, merchant
     FROM transactions
     WHERE user_id = ? AND date >= ? AND date <= ?
     ORDER BY date DESC`,
    [userId, startOfMonth, endOfMonth]
  );

  const cashFlow =
    currentMonthTxs.length > 0
      ? calculateCashFlow(currentMonthTxs)
      : {
          totalIncomeMinor: clientSnapshot?.summary?.income_minor ?? 0,
          totalExpensesMinor: clientSnapshot?.summary?.expenses_minor ?? 0,
          netCashFlowMinor: clientSnapshot?.summary?.net_cash_flow_minor ?? 0,
          savingsRatePercentage: clientSnapshot?.summary?.savings_rate_pct ?? 0,
        };

  // 3. Budgets
  let budgets = query<any>(
    `SELECT b.id, b.category_id, b.amount_minor, c.name as category_name
     FROM budgets b
     JOIN categories c ON c.id = b.category_id
     WHERE b.user_id = ?`,
    [userId]
  );

  const spentByCategory = new Map<string, number>();
  for (const tx of currentMonthTxs) {
    if (tx.type === 'expense' && tx.category_id) {
      spentByCategory.set(
        tx.category_id,
        (spentByCategory.get(tx.category_id) || 0) + (tx.amount_minor || 0)
      );
    }
  }

  let formattedBudgets = budgets.map((b: any) => {
    const spentMinor = spentByCategory.get(b.category_id) || 0;
    const pct = b.amount_minor > 0 ? Math.round((spentMinor / b.amount_minor) * 100) : 0;
    return {
      category: b.category_name,
      limit: formatMinorCurrency(b.amount_minor, currency),
      spent: formatMinorCurrency(spentMinor, currency),
      remaining: formatMinorCurrency(Math.max(0, b.amount_minor - spentMinor), currency),
      utilization_pct: pct,
    };
  });

  if (formattedBudgets.length === 0 && clientSnapshot?.budgets?.length) {
    formattedBudgets = clientSnapshot.budgets.map((b: any) => ({
      category: b.category_name,
      limit: formatMinorCurrency(b.amount_minor, currency),
      spent: formatMinorCurrency(b.spent_minor || 0, currency),
      remaining: formatMinorCurrency(Math.max(0, (b.amount_minor || 0) - (b.spent_minor || 0)), currency),
      utilization_pct: b.percentage || 0,
    }));
  }

  // 4. Goals
  let goals = query<any>(
    `SELECT id, name, target_amount_minor, current_amount_minor, target_date, category
     FROM goals
     WHERE user_id = ? AND is_completed = 0
     ORDER BY target_date ASC`,
    [userId]
  );

  if (goals.length === 0 && clientSnapshot?.goals?.length) {
    goals = clientSnapshot.goals;
  }

  const formattedGoals = goals.map((g: any) => {
    const target = g.target_amount_minor || 0;
    const saved = g.current_amount_minor || 0;
    const pct = target > 0 ? Math.round((saved / target) * 100) : 0;
    return {
      name: g.name,
      saved: formatMinorCurrency(saved, currency),
      target: formatMinorCurrency(target, currency),
      remaining: formatMinorCurrency(Math.max(0, target - saved), currency),
      progress_pct: pct,
      target_date: g.target_date || 'Flexible',
    };
  });

  // 5. Active Subscriptions & Recurring Rules
  const recurringRules = query<any>(
    `SELECT merchant, amount_minor, frequency, next_expected_date, is_subscription
     FROM recurring_rules
     WHERE user_id = ? AND is_active = 1
     ORDER BY next_expected_date ASC`,
    [userId]
  );

  const formattedRecurring = recurringRules.map((r: any) => ({
    merchant: r.merchant,
    amount: formatMinorCurrency(r.amount_minor, currency),
    frequency: r.frequency,
    next_date: r.next_expected_date,
  }));

  // 6. Credit Card Utilization Summary
  const creditAccounts = accounts.filter((a: any) => a.type === 'credit');
  const formattedAccounts = accounts.map((a: any) => {
    const balanceMinor = a.current_balance_minor || 0;
    const limitMinor = a.credit_limit_minor || 0;
    const utilizationPct =
      a.type === 'credit' && limitMinor > 0
        ? Math.round((Math.abs(balanceMinor) / limitMinor) * 100)
        : null;

    return {
      name: a.name,
      type: a.type,
      balance: formatMinorCurrency(balanceMinor, currency),
      ...(a.type === 'credit' && limitMinor > 0
        ? {
            credit_limit: formatMinorCurrency(limitMinor, currency),
            utilization_pct: `${utilizationPct}%`,
            due_day: a.due_day ? `Day ${a.due_day}` : undefined,
          }
        : {}),
    };
  });

  return {
    currency,
    asOfDate: now.toISOString().slice(0, 10),
    summary: {
      net_worth: formatMinorCurrency(netWorthData.netWorthMinor, currency),
      total_assets: formatMinorCurrency(netWorthData.totalAssetsMinor, currency),
      total_liabilities: formatMinorCurrency(netWorthData.totalLiabilitiesMinor, currency),
      monthly_income: formatMinorCurrency(cashFlow.totalIncomeMinor, currency),
      monthly_expenses: formatMinorCurrency(cashFlow.totalExpensesMinor, currency),
      monthly_net_cash_flow: formatMinorCurrency(cashFlow.netCashFlowMinor, currency),
      savings_rate_pct: `${cashFlow.savingsRatePercentage}%`,
      active_accounts_count: accounts.length,
      credit_cards_count: creditAccounts.length,
    },
    accounts: formattedAccounts,
    budgets: formattedBudgets,
    goals: formattedGoals,
    recurring_obligations: formattedRecurring,
  };
}

// GET /api/chat/snapshot — Returns sanitized ledger snapshot for the UI Context Inspector
chatRouter.get('/snapshot', requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const currency = req.user!.currency || 'INR';
    const snapshot = buildLedgerSnapshot(userId, currency);
    res.json({ snapshot });
  } catch (err) {
    console.error('Error building ledger snapshot:', err);
    res.status(500).json({ error: 'Failed to build ledger snapshot.' });
  }
});

// POST /api/chat/message — Multi-turn Gemini conversational endpoint
chatRouter.post('/message', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const currency = req.user!.currency || 'INR';
    const {
      message,
      history = [],
      modelMode = 'auto',
      roleId = 'cfo',
      includeLedgerContext = true,
      clientSnapshot,
    } = req.body as {
      message?: string;
      history?: ChatHistoryTurn[];
      modelMode?: ModelOption;
      roleId?: AdvisorRoleId;
      includeLedgerContext?: boolean;
      clientSnapshot?: any;
    };

    if (!message || typeof message !== 'string' || !message.trim()) {
      res.status(400).json({ error: 'Message text is required.' });
      return;
    }

    const validRole: AdvisorRoleId = ROLE_INSTRUCTIONS[roleId as AdvisorRoleId]
      ? (roleId as AdvisorRoleId)
      : 'cfo';
    const roleMeta = ROLE_INSTRUCTIONS[validRole];

    const resolvedModel = resolveTargetModel(modelMode, message, history.length);

    // Build system instruction with optional live ledger grounding
    let systemInstruction = `${roleMeta.instruction}\n\nUser Profile Currency: ${currency}\nCurrent Date: ${new Date().toISOString().slice(0, 10)}\n`;

    if (includeLedgerContext) {
      const snapshot = buildLedgerSnapshot(userId, currency, clientSnapshot);
      systemInstruction += `\n=== LIVE PRYORA LEDGER SNAPSHOT (User Opted-In) ===
${JSON.stringify(snapshot, null, 2)}
===================================================
Instructions for using the snapshot:
- Ground your analysis directly in the balances, budgets, goals, and obligations above.
- Reference exact account names, category utilization percentages, and currency amounts when relevant.
- Never invent accounts or transactions not present in the snapshot.`;
    } else {
      systemInstruction += `\n=== PRIVACY MODE ACTIVE (Ledger Snapshot Excluded) ===
The user has turned OFF live ledger sharing for this turn. Answer their financial question using general financial principles or figures they explicitly mention in the conversation.`;
    }

    // Format multi-turn history for @google/genai chats.create
    const formattedHistory = (Array.isArray(history) ? history : [])
      .slice(-24) // Keep recent 24 turns for fast context window
      .filter((turn) => turn && typeof turn.text === 'string' && turn.text.trim().length > 0)
      .map((turn) => ({
        role: turn.role === 'model' ? 'model' : 'user',
        parts: [{ text: turn.text }],
      }));

    // Select API key: gemini-4-argon prefers API_KEY (user paid key) with fallback to GEMINI_API_KEY
    const apiKey =
      resolvedModel === 'gemini-4-argon'
        ? process.env.API_KEY || process.env.GEMINI_API_KEY
        : process.env.GEMINI_API_KEY || process.env.API_KEY;

    if (!apiKey) {
      res.status(500).json({
        error: 'Gemini API key is not configured on the server environment.',
      });
      return;
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
    });

    let activeModel = resolvedModel;
    let fallbackUsed = false;
    let replyText = '';

    try {
      const chat = ai.chats.create({
        model: activeModel,
        history: formattedHistory,
        config: {
          systemInstruction,
          temperature: 0.4,
        },
      });

      const response = await chat.sendMessage({
        message: message.trim(),
      });

      replyText = response.text || 'I analyzed your request, but no text output was returned.';
    } catch (modelErr: any) {
      // If gemini-4-argon fails due to billing/tier permissions, gracefully fall back to gemini-3.8-flash
      if (activeModel === 'gemini-4-argon') {
        console.warn(
          'gemini-4-argon invocation failed, falling back to gemini-3.8-flash:',
          modelErr?.message || modelErr
        );
        activeModel = 'gemini-3.8-flash';
        fallbackUsed = true;

        const fallbackAi = new GoogleGenAI({
          apiKey: process.env.GEMINI_API_KEY || process.env.API_KEY,
          httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
        });

        const fallbackChat = fallbackAi.chats.create({
          model: activeModel,
          history: formattedHistory,
          config: {
            systemInstruction,
            temperature: 0.4,
          },
        });

        const fallbackResponse = await fallbackChat.sendMessage({
          message: message.trim(),
        });

        replyText =
          fallbackResponse.text || 'I analyzed your request, but no text output was returned.';
      } else {
        throw modelErr;
      }
    }

    res.json({
      reply: replyText,
      modelUsed: activeModel,
      requestedModel: resolvedModel,
      fallbackUsed,
      roleId: validRole,
      roleTitle: roleMeta.title,
      groundedInLedger: Boolean(includeLedgerContext),
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('Error in /api/chat/message:', err);
    res.status(500).json({
      error:
        err?.message ||
        'Unable to generate a response from the Gemini Financial Assistant right now.',
    });
  }
});
