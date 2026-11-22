/**
 * PRYORA — Public Early Access Landing Page
 *
 * Strategic Positioning:
 * - Core proposition: "Understand your money. Understand your habits."
 * - Target audience: Students, early-career professionals, and young independent earners in India
 * - Strictly aligned with implemented capabilities and honest architectural & privacy claims
 */

import React, { useState, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { PWAInstallButton } from './PWAInstallButton';
import { openFeedbackModal } from './FeedbackWidget';
import {
  ArrowRight,
  Search,
  ChevronDown,
  Sun,
  Moon,
  PlayCircle,
  Check,
  FileSpreadsheet,
  Receipt,
  ShieldCheck,
  TrendingUp,
} from 'lucide-react';

interface LandingPageViewProps {
  onLaunchApp: () => void;
  onOpenAuth: (initialMode?: 'signin' | 'signup') => void;
}

const formatInr = (amount: number): string => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
};

interface SampleTransaction {
  id: string;
  merchant: string;
  category: string;
  account: string;
  amount: string;
  isIncome?: boolean;
  isTransfer?: boolean;
  date: string;
  note: string;
  hasReceipt?: boolean;
}

const SAMPLE_TRANSACTIONS: SampleTransaction[] = [
  {
    id: 'tx-1',
    merchant: 'Monthly Salary Credit',
    category: 'Salary & Stipend',
    account: 'HDFC Bank (UPI)',
    amount: '+₹68,000',
    isIncome: true,
    date: '01 Oct',
    note: 'Direct salary deposit',
  },
  {
    id: 'tx-2',
    merchant: 'Shared Flat Rent',
    category: 'Housing & Rent',
    account: 'HDFC Bank (UPI)',
    amount: '-₹14,500',
    date: '02 Oct',
    note: 'Monthly house rent via UPI',
  },
  {
    id: 'tx-3',
    merchant: 'Zepto Daily Groceries',
    category: 'Groceries & Supplies',
    account: 'HDFC Bank (UPI)',
    amount: '-₹840',
    date: '04 Oct',
    note: 'Fruits, milk, and pantry staples',
    hasReceipt: true,
  },
  {
    id: 'tx-4',
    merchant: 'Swiggy Dinner Order',
    category: 'Food & Dining',
    account: 'ICICI Amazon Pay Card',
    amount: '-₹485',
    date: '05 Oct',
    note: 'Weekday dinner delivery',
    hasReceipt: true,
  },
  {
    id: 'tx-5',
    merchant: 'Namma Metro & Rapido',
    category: 'Commute & Transit',
    account: 'HDFC Bank (UPI)',
    amount: '-₹310',
    date: '06 Oct',
    note: 'Office commute & card recharge',
  },
  {
    id: 'tx-6',
    merchant: 'Airtel Xstream Fiber',
    category: 'Utilities & Bills',
    account: 'HDFC Bank (UPI)',
    amount: '-₹999',
    date: '07 Oct',
    note: 'Monthly home broadband',
  },
  {
    id: 'tx-7',
    merchant: 'Emergency Fund Transfer',
    category: 'Internal Transfer',
    account: 'HDFC Bank → SBI Savings',
    amount: '₹10,000',
    isTransfer: true,
    date: '08 Oct',
    note: 'Monthly goal allocation (excluded from expenses)',
  },
];

interface FaqItem {
  id: string;
  category: 'getting-started' | 'privacy' | 'features';
  categoryLabel: string;
  q: string;
  a: string;
}

const FAQ_ITEMS: FaqItem[] = [
  {
    id: 'what-is-pryora',
    category: 'getting-started',
    categoryLabel: 'Getting Started',
    q: 'What is PRYORA?',
    a: 'PRYORA is a personal finance platform built to help you track income and expenses, organise multiple accounts, manage monthly budgets and recurring bills, monitor savings goals, and understand the spending patterns behind your financial decisions.',
  },
  {
    id: 'who-is-it-for',
    category: 'getting-started',
    categoryLabel: 'Getting Started',
    q: 'Who is PRYORA designed for?',
    a: 'PRYORA is built for students managing allowances or stipends, early-career professionals balancing salaries, rent, UPI spends, credit cards, and savings, and freelancers or young independent earners managing variable monthly income—especially in India.',
  },
  {
    id: 'is-it-free',
    category: 'getting-started',
    categoryLabel: 'Getting Started',
    q: 'Is PRYORA free to use during Public Early Access?',
    a: 'Yes. All currently available features—including multi-account tracking, Excel and CSV statement imports, budgets, recurring bills, goals, analytics, and data exports—are free to use during Public Early Access.',
  },
  {
    id: 'bank-connections',
    category: 'privacy',
    categoryLabel: 'Privacy & Data',
    q: 'Do I need to connect my bank account, share net-banking passwords, or grant SMS access?',
    a: 'No. PRYORA does not connect to third-party bank aggregators, does not ask for your banking passwords or UPI PINs, and does not read your SMS inbox. You stay in control by entering transactions directly or importing your own Excel or CSV statements.',
  },
  {
    id: 'excel-csv-import',
    category: 'features',
    categoryLabel: 'Features',
    q: 'How do I add expenses? Can I import Excel or CSV bank statements?',
    a: 'You can add transactions manually in seconds—including split transactions and receipt photos—or upload Excel (.xlsx, .xls) workbooks and CSV bank statements using the step-by-step Import Wizard with sheet selection, column mapping, inline editing, and duplicate detection.',
  },
  {
    id: 'data-storage-security',
    category: 'privacy',
    categoryLabel: 'Privacy & Data',
    q: 'Where is my financial data stored and how is it isolated?',
    a: 'Your records are stored in your isolated account inside the PRYORA application server database (SQLite), where every API request checks your session and account ownership so other users cannot view or modify your data. Browser local storage is used only for UI preferences and a user-scoped offline queue that is automatically cleared when you sign out.',
  },
  {
    id: 'ai-scope',
    category: 'features',
    categoryLabel: 'Features',
    q: 'Does PRYORA use AI, and what does it actually do?',
    a: 'PRYORA is not an AI financial advisor and does not give automated investment advice. Its only smart assistance is optional merchant category suggestion when adding expenses—which runs primarily on built-in merchant keyword rules (covering common Indian and global merchants) with an optional Gemini model fallback only when enabled server-side.',
  },
  {
    id: 'export-and-delete',
    category: 'privacy',
    categoryLabel: 'Privacy & Data',
    q: 'Can I export my financial records or delete my account anytime?',
    a: 'Yes. From the Data Hub inside PRYORA, you can export your transactions as CSV or Excel (.xlsx), download a full JSON backup of your workspace, or permanently delete your account and all associated financial records and receipts.',
  },
  {
    id: 'mobile-offline',
    category: 'features',
    categoryLabel: 'Features',
    q: 'Does PRYORA work on mobile phones and when I am briefly offline?',
    a: 'Yes. PRYORA is responsive on mobile screens and can be installed as a Progressive Web App (PWA). If you lose connectivity briefly while signed in, supported entries queue locally for your account and sync back to the server once you reconnect.',
  },
  {
    id: 'roadmap-habits',
    category: 'getting-started',
    categoryLabel: 'Getting Started',
    q: 'What is PRYORA working towards beyond expense tracking?',
    a: 'Today, PRYORA gives you a reliable ledger, budgets, recurring commitments, goals, and evidence-based spending insights derived from your numbers. As Early Access evolves, we are expanding deeper habit and pattern analysis to help you spot lifestyle drift and make calmer financial choices.',
  },
];

export const LandingPageView: React.FC<LandingPageViewProps> = ({
  onLaunchApp,
  onOpenAuth,
}) => {
  const { user, loginDemo } = useAuth();
  const { resolvedTheme, toggleTheme } = useTheme();

  // Interactive 4-tab product preview
  const [activePreviewTab, setActivePreviewTab] = useState<
    'dashboard' | 'transactions' | 'budgets' | 'goals'
  >('dashboard');

  // Interactive live search demo inside Capability Bento
  const [ledgerSearch, setLedgerSearch] = useState<string>('');

  // Interactive Goal Milestone Planner (Indian INR realistic defaults)
  const [goalTarget, setGoalTarget] = useState<number>(30000);
  const [goalSaved, setGoalSaved] = useState<number>(6000);
  const [goalMonthly, setGoalMonthly] = useState<number>(4000);

  // FAQ filtering & accordion
  const [faqFilter, setFaqFilter] = useState<'all' | 'getting-started' | 'privacy' | 'features'>('all');
  const [expandedFaq, setExpandedFaq] = useState<string | null>('what-is-pryora');

  // Live Demo launcher state
  const [demoLoading, setDemoLoading] = useState<boolean>(false);

  const handleLaunchDemo = async () => {
    try {
      setDemoLoading(true);
      await loginDemo();
      onLaunchApp();
    } catch (err) {
      console.error('Failed to launch demo workspace:', err);
      onOpenAuth('signin');
    } finally {
      setDemoLoading(false);
    }
  };

  const handlePrimaryStart = () => {
    if (user) {
      onLaunchApp();
    } else {
      onOpenAuth('signup');
    }
  };

  const filteredTransactions = useMemo(() => {
    const q = ledgerSearch.trim().toLowerCase();
    if (!q) return SAMPLE_TRANSACTIONS;
    return SAMPLE_TRANSACTIONS.filter(
      (tx) =>
        tx.merchant.toLowerCase().includes(q) ||
        tx.category.toLowerCase().includes(q) ||
        tx.account.toLowerCase().includes(q) ||
        tx.note.toLowerCase().includes(q)
    );
  }, [ledgerSearch]);

  // Ensure saved slider stays <= target
  const effectiveSaved = Math.min(goalSaved, goalTarget);
  const remainingNeeded = Math.max(0, goalTarget - effectiveSaved);
  const monthsToGoal =
    remainingNeeded === 0 ? 0 : goalMonthly > 0 ? Math.ceil(remainingNeeded / goalMonthly) : 0;
  const progressPercent =
    goalTarget > 0 ? Math.min(100, Math.round((effectiveSaved / goalTarget) * 100)) : 0;

  const estimatedCompletionLabel = useMemo(() => {
    if (remainingNeeded === 0) return 'Target reached';
    if (monthsToGoal <= 0) return 'Set a monthly amount';
    const targetDate = new Date();
    targetDate.setMonth(targetDate.getMonth() + monthsToGoal);
    return targetDate.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  }, [remainingNeeded, monthsToGoal]);

  const visibleFaqs = useMemo(
    () => FAQ_ITEMS.filter((item) => faqFilter === 'all' || item.category === faqFilter),
    [faqFilter]
  );

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans antialiased transition-colors selection:bg-emerald-500 selection:text-slate-950">
      {/* ========================================================
          TOP NAVIGATION — Strict 3-Zone Contract
         ======================================================== */}
      <header className="sticky top-0 z-50 bg-slate-50/90 dark:bg-slate-950/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800/80 transition-colors">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Single-line Brand Wordmark */}
          <a
            href="#top"
            className="flex items-center gap-2.5 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 rounded-lg"
            aria-label="PRYORA Home"
          >
            <span className="w-8 h-8 rounded-lg bg-emerald-500 text-slate-950 font-display font-extrabold text-sm flex items-center justify-center tracking-tight">
              P
            </span>
            <span className="font-display font-bold text-base tracking-tight text-slate-900 dark:text-white">
              PRYORA
            </span>
          </a>

          {/* Zone 2: 4 Clean Single-Line Nav Links */}
          <nav
            aria-label="Primary"
            className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600 dark:text-slate-300"
          >
            <a
              href="#preview"
              className="hover:text-slate-950 dark:hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Product
            </a>
            <a
              href="#features"
              className="hover:text-slate-950 dark:hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Capabilities
            </a>
            <a
              href="#privacy"
              className="hover:text-slate-950 dark:hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Privacy
            </a>
            <a
              href="#faq"
              className="hover:text-slate-950 dark:hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              FAQ
            </a>
          </nav>

          {/* Zone 3: Theme Toggle, Sign In (when signed out) & Primary Action */}
          <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
            <button
              type="button"
              onClick={toggleTheme}
              className="w-9 h-9 inline-flex items-center justify-center text-slate-600 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white rounded-lg hover:bg-slate-200/70 dark:hover:bg-slate-800/80 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 shrink-0"
              aria-label={resolvedTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {resolvedTheme === 'dark' ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4" />
              )}
            </button>

            {!user && (
              <button
                type="button"
                onClick={() => onOpenAuth('signin')}
                className="hidden sm:inline-flex text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white px-2.5 py-2 transition-colors whitespace-nowrap shrink-0"
              >
                Sign in
              </button>
            )}

            <button
              type="button"
              onClick={handlePrimaryStart}
              className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-sm px-4 py-2 rounded-lg inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-950"
            >
              <span>{user ? 'Open Dashboard' : 'Get Started'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <main id="top" className="flex-1">
        {/* ========================================================
            SECTION 1 — HERO & INTERACTIVE PRODUCT PREVIEW
           ======================================================== */}
        <section className="pt-9 pb-14 sm:pt-12 sm:pb-16 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center">
            {/* Unboxed editorial metadata line */}
            <p className="text-xs sm:text-sm font-medium text-emerald-700 dark:text-emerald-400 mb-3">
              Public Early Access · Personal finance built for India
            </p>

            {/* Primary Headline */}
            <h1
              className="font-display font-bold tracking-tight text-slate-950 dark:text-white mb-4"
              style={{
                fontSize: 'clamp(2.25rem, 4.4vw, 3.5rem)',
                lineHeight: 1.08,
                textWrap: 'balance',
              }}
            >
              Understand your money. Understand your habits.
            </h1>

            {/* Value Proposition */}
            <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed max-w-xl mx-auto mb-6">
              Track your expenses, organise your finances and discover the spending patterns shaping
              your financial life.
            </p>

            {/* Focused Primary + Secondary CTAs */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-5">
              <button
                type="button"
                onClick={handlePrimaryStart}
                className="w-full sm:w-auto bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-sm px-6 py-2.5 rounded-lg inline-flex items-center justify-center gap-2 transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-950"
              >
                <span>{user ? 'Go to Dashboard' : 'Start Managing Your Money'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={handleLaunchDemo}
                disabled={demoLoading}
                className="w-full sm:w-auto bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 font-semibold text-sm px-6 py-2.5 rounded-lg inline-flex items-center justify-center gap-2 transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:opacity-60"
              >
                <PlayCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>{demoLoading ? 'Opening Demo...' : 'Explore Live Demo'}</span>
              </button>

              <PWAInstallButton variant="hero" />
            </div>

            {/* Quiet Unboxed Grounding Line — concise single-line rhythm on desktop */}
            <div className="flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
              <span>No bank passwords required</span>
              <span aria-hidden="true" className="hidden sm:inline">·</span>
              <span>Excel & CSV import</span>
              <span aria-hidden="true" className="hidden sm:inline">·</span>
              <span>Export or delete anytime</span>
            </div>
          </div>

          {/* ========================================================
              INTERACTIVE 4-TAB PRODUCT PREVIEW (Realistic INR Data)
             ======================================================== */}
          <div
            id="preview"
            className="mt-8 sm:mt-10 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden"
          >
            {/* Preview Toolbar */}
            <div className="px-4 sm:px-6 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Sample workspace · Early-career monthly view (INR)
              </div>

              <div
                role="tablist"
                aria-label="PRYORA product preview views"
                className="flex items-center gap-1 bg-slate-200/70 dark:bg-slate-800 p-1 rounded-lg overflow-x-auto no-scrollbar"
              >
                {(
                  [
                    { id: 'dashboard', label: 'Dashboard' },
                    { id: 'transactions', label: 'Transactions' },
                    { id: 'budgets', label: 'Budgets' },
                    { id: 'goals', label: 'Goals & Bills' },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={activePreviewTab === tab.id}
                    onClick={() => setActivePreviewTab(tab.id)}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                      activePreviewTab === tab.id
                        ? 'bg-white dark:bg-slate-950 text-slate-950 dark:text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Preview Content */}
            <div className="p-5 sm:p-8">
              {activePreviewTab === 'dashboard' && (
                <div className="space-y-6">
                  {/* Top Summary Metrics */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pb-6 border-b border-slate-200 dark:border-slate-800">
                    <div>
                      <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                        Total Net Balance
                      </p>
                      <p className="text-2xl sm:text-3xl font-display font-bold text-slate-950 dark:text-white font-mono tabular-nums tracking-tight">
                        ₹1,14,650
                      </p>
                      <p className="text-xs text-emerald-700 dark:text-emerald-400 font-medium mt-1.5 inline-flex items-center gap-1">
                        <TrendingUp className="w-3.5 h-3.5" />
                        <span>Across HDFC Bank, SBI Savings & Cash</span>
                      </p>
                    </div>

                    <div>
                      <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                        Monthly Inflow
                      </p>
                      <p className="text-2xl sm:text-3xl font-display font-bold text-emerald-700 dark:text-emerald-400 font-mono tabular-nums tracking-tight">
                        +₹68,000
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">
                        Salary & freelance credits
                      </p>
                    </div>

                    <div>
                      <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                        Monthly Outflow
                      </p>
                      <p className="text-2xl sm:text-3xl font-display font-bold text-slate-950 dark:text-white font-mono tabular-nums tracking-tight">
                        ₹36,420
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">
                        Savings rate:{' '}
                        <span className="font-mono font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                          46.4%
                        </span>{' '}
                        this month
                      </p>
                    </div>
                  </div>

                  {/* Habit Observation + Recent Activity Split */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    <div className="lg:col-span-5 space-y-3">
                      <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                        Spending patterns noticed
                      </h3>
                      <div className="divide-y divide-slate-200 dark:divide-slate-800 text-sm">
                        <div className="py-3 first:pt-0">
                          <p className="font-medium text-slate-900 dark:text-slate-100">
                            Food delivery & dining is 24% of variable spend
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                            ₹5,400 spent across 11 orders so far — ₹1,600 left in your monthly cap.
                          </p>
                        </div>
                        <div className="py-3">
                          <p className="font-medium text-slate-900 dark:text-slate-100">
                            Fixed rent & utilities stay predictable
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                            ₹16,499 committed to rent, electricity, and broadband (24.3% of income).
                          </p>
                        </div>
                        <div className="py-3 last:pb-0">
                          <p className="font-medium text-slate-900 dark:text-slate-100">
                            Savings transfers excluded from expenses
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                            ₹10,000 moved to SBI Savings keeps your true cash flow accurate.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="lg:col-span-7">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                          Recent ledger entries
                        </h3>
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          Reconciled balances
                        </span>
                      </div>
                      <div className="divide-y divide-slate-200 dark:divide-slate-800 border-t border-b border-slate-200 dark:border-slate-800">
                        {SAMPLE_TRANSACTIONS.slice(0, 4).map((tx) => (
                          <div
                            key={tx.id}
                            className="py-3 flex items-center justify-between gap-4 text-sm"
                          >
                            <div className="min-w-0">
                              <p className="font-medium text-slate-900 dark:text-white truncate">
                                {tx.merchant}
                              </p>
                              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                                {tx.category} · {tx.account} · {tx.date}
                              </p>
                            </div>
                            <span
                              className={`font-mono text-sm font-semibold tabular-nums whitespace-nowrap shrink-0 ${
                                tx.isIncome
                                  ? 'text-emerald-700 dark:text-emerald-400'
                                  : 'text-slate-900 dark:text-slate-100'
                              }`}
                            >
                              {tx.amount}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activePreviewTab === 'transactions' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                  <div className="space-y-4">
                    <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                      Fast entry, split categories, and bank statement import
                    </h3>
                    <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                      Log a UPI payment, card spend, or cash expense in seconds. Built-in keyword
                      rules recognise common Indian merchants—like Swiggy, Zepto, Metro, Airtel, or
                      BESCOM—and suggest the right category automatically, with optional server-side
                      Gemini fallback when enabled.
                    </p>
                    <div className="divide-y divide-slate-200 dark:divide-slate-800 border-t border-slate-200 dark:border-slate-800 pt-2 text-sm">
                      <div className="py-2.5 flex items-center justify-between">
                        <span className="text-slate-600 dark:text-slate-300">
                          Excel & CSV statement wizard
                        </span>
                        <span className="text-xs font-medium text-slate-900 dark:text-slate-100">
                          .xlsx, .xls, .csv + sheet picker
                        </span>
                      </div>
                      <div className="py-2.5 flex items-center justify-between">
                        <span className="text-slate-600 dark:text-slate-300">
                          Split transactions
                        </span>
                        <span className="text-xs font-medium text-slate-900 dark:text-slate-100">
                          Exact paise-level allocation
                        </span>
                      </div>
                      <div className="py-2.5 flex items-center justify-between">
                        <span className="text-slate-600 dark:text-slate-300">
                          Receipt attachments
                        </span>
                        <span className="text-xs font-medium text-slate-900 dark:text-slate-100">
                          JPG, PNG, WebP up to 10MB
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4 text-sm">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
                      <span className="font-semibold text-slate-900 dark:text-white">
                        New expense preview
                      </span>
                      <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400 inline-flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" />
                        Category suggested
                      </span>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <span className="text-xs text-slate-500 dark:text-slate-400 block mb-1">
                          Merchant or narration
                        </span>
                        <div className="px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-medium text-slate-900 dark:text-white">
                          UPI / ZEPTO MARKETPLACE
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <span className="text-xs text-slate-500 dark:text-slate-400 block mb-1">
                            Suggested category
                          </span>
                          <div className="px-3 py-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/70 font-medium text-emerald-800 dark:text-emerald-300">
                            Groceries & Supplies
                          </div>
                        </div>
                        <div>
                          <span className="text-xs text-slate-500 dark:text-slate-400 block mb-1">
                            Amount
                          </span>
                          <div className="px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-mono font-semibold tabular-nums text-slate-900 dark:text-white">
                            ₹840.00
                          </div>
                        </div>
                      </div>

                      <div className="pt-2 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                        <span className="inline-flex items-center gap-1.5">
                          <Receipt className="w-3.5 h-3.5" />
                          zepto_bill_oct04.jpg attached
                        </span>
                        <span>HDFC Bank (UPI)</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activePreviewTab === 'budgets' && (
                <div className="space-y-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-200 dark:border-slate-800">
                    <div>
                      <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                        Monthly spending pacing
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Planned caps compared against actual spending, including split items
                      </p>
                    </div>
                    <div className="text-sm font-mono tabular-nums font-semibold text-slate-900 dark:text-white">
                      ₹12,898 / ₹18,000 planned
                    </div>
                  </div>

                  <div className="space-y-4">
                    {[
                      {
                        name: 'Food & Dining',
                        spent: 5400,
                        limit: 7000,
                        pct: 77,
                        status: 'Nearing limit · ₹1,600 left',
                        barClass: 'bg-amber-500',
                      },
                      {
                        name: 'Groceries & Supplies',
                        spent: 4250,
                        limit: 6000,
                        pct: 71,
                        status: 'On pace · ₹1,750 left',
                        barClass: 'bg-emerald-500',
                      },
                      {
                        name: 'Commute & Transit',
                        spent: 2100,
                        limit: 3500,
                        pct: 60,
                        status: 'Within pace · ₹1,400 left',
                        barClass: 'bg-emerald-500',
                      },
                      {
                        name: 'Subscriptions & OTT',
                        spent: 1148,
                        limit: 1500,
                        pct: 77,
                        status: 'Scheduled renewals tracked · ₹352 left',
                        barClass: 'bg-emerald-500',
                      },
                    ].map((b) => (
                      <div key={b.name} className="space-y-1.5">
                        <div className="flex items-baseline justify-between gap-2 text-sm">
                          <span className="font-medium text-slate-900 dark:text-white">
                            {b.name}
                          </span>
                          <span className="font-mono text-xs sm:text-sm tabular-nums text-slate-600 dark:text-slate-300">
                            {formatInr(b.spent)} / {formatInr(b.limit)} ({b.pct}%)
                          </span>
                        </div>
                        <div className="w-full h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${b.barClass}`}
                            style={{ width: `${b.pct}%` }}
                          />
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{b.status}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activePreviewTab === 'goals' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                      Upcoming recurring commitments
                    </h3>
                    <div className="divide-y divide-slate-200 dark:divide-slate-800 border-t border-b border-slate-200 dark:border-slate-800 text-sm">
                      {[
                        { name: 'Shared Flat Rent', due: '1st of every month', amount: '₹14,500' },
                        { name: 'Airtel Xstream Fiber', due: 'Monthly · Due in 6 days', amount: '₹999' },
                        { name: 'BESCOM Electricity', due: 'Monthly · Variable estimate', amount: '₹1,050' },
                        { name: 'Spotify & OTT Bundle', due: 'Monthly · Auto-reminder', amount: '₹449' },
                      ].map((item) => (
                        <div key={item.name} className="py-3 flex items-center justify-between gap-4">
                          <div>
                            <p className="font-medium text-slate-900 dark:text-white">{item.name}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">{item.due}</p>
                          </div>
                          <span className="font-mono font-semibold tabular-nums text-slate-900 dark:text-slate-100 whitespace-nowrap">
                            {item.amount}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                      Active savings goals
                    </h3>
                    <div className="space-y-5">
                      {[
                        {
                          title: 'Emergency Fund (3 months)',
                          saved: 65000,
                          target: 150000,
                          pct: 43,
                          note: '₹10,000/month contribution pace',
                        },
                        {
                          title: 'Laptop Upgrade',
                          saved: 28000,
                          target: 75000,
                          pct: 37,
                          note: 'On track for next year',
                        },
                        {
                          title: 'Year-End Travel Fund',
                          saved: 16500,
                          target: 25000,
                          pct: 66,
                          note: '₹8,500 remaining',
                        },
                      ].map((g) => (
                        <div key={g.title} className="space-y-1.5">
                          <div className="flex items-baseline justify-between gap-2 text-sm">
                            <span className="font-medium text-slate-900 dark:text-white">
                              {g.title}
                            </span>
                            <span className="font-mono text-xs tabular-nums text-slate-600 dark:text-slate-300">
                              {formatInr(g.saved)} / {formatInr(g.target)}
                            </span>
                          </div>
                          <div className="w-full h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-emerald-500 rounded-full"
                              style={{ width: `${g.pct}%` }}
                            />
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {g.pct}% funded · {g.note}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ========================================================
            SECTION 2 — BUILT FOR EVERYDAY FINANCIAL LIVES IN INDIA
           ======================================================== */}
        <section className="py-16 sm:py-20 border-t border-slate-200 dark:border-slate-800/80 bg-white dark:bg-slate-900/40">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-2xl mb-12">
              <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400 mb-2">
                Who PRYORA is built for
              </p>
              <h2
                className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-950 dark:text-white"
                style={{ textWrap: 'balance' }}
              >
                Approachable clarity, whether it is your first stipend or your fifth salary.
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-10">
              <div className="pt-5 border-t border-slate-200 dark:border-slate-800">
                <p className="font-mono text-xs font-medium text-slate-500 dark:text-slate-400 mb-3">
                  01.
                </p>
                <h3 className="text-lg font-semibold text-slate-950 dark:text-white mb-2">
                  Students & young adults
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  Keep track of monthly allowances, internship stipends, PG or hostel bills, and
                  frequent small UPI spends without wading through complex accounting terms.
                </p>
              </div>

              <div className="pt-5 border-t border-slate-200 dark:border-slate-800">
                <p className="font-mono text-xs font-medium text-slate-500 dark:text-slate-400 mb-3">
                  02.
                </p>
                <h3 className="text-lg font-semibold text-slate-950 dark:text-white mb-2">
                  Early-career professionals
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  See how salary splits across rent, food delivery, credit card bills, OTT
                  subscriptions, and monthly savings—so lifestyle creep never catches you off guard.
                </p>
              </div>

              <div className="pt-5 border-t border-slate-200 dark:border-slate-800">
                <p className="font-mono text-xs font-medium text-slate-500 dark:text-slate-400 mb-3">
                  03.
                </p>
                <h3 className="text-lg font-semibold text-slate-950 dark:text-white mb-2">
                  Freelancers & independent earners
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  Track variable client payments alongside fixed personal expenses, separate
                  accounts cleanly, and import bank or Excel statements whenever you reconcile.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================
            SECTION 3 — ASYMMETRIC CAPABILITIES BENTO
           ======================================================== */}
        <section
          id="features"
          className="py-16 sm:py-24 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8"
        >
          <div className="max-w-2xl mb-12">
            <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400 mb-2">
              Implemented capabilities
            </p>
            <h2
              className="font-display text-2xl sm:text-4xl font-bold tracking-tight text-slate-950 dark:text-white mb-3"
              style={{ textWrap: 'balance' }}
            >
              Everything connected in one ledger, from daily UPI spends to savings goals.
            </h2>
            <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed">
              Every feature listed below is live in PRYORA today—no placeholder modules or coming-soon
              tabs.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Card 1 (Span 2): Interactive Ledger Search */}
            <div className="md:col-span-2 p-6 sm:p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col justify-between">
              <div>
                <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400 mb-2">
                  01. Expense & Income Ledger
                </p>
                <h3 className="text-xl font-bold text-slate-950 dark:text-white mb-2">
                  Search any spend by merchant, category, account, or note.
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed mb-5">
                  Try filtering sample entries right here—type <span className="font-medium text-slate-900 dark:text-slate-100">Swiggy</span>,{' '}
                  <span className="font-medium text-slate-900 dark:text-slate-100">Zepto</span>,{' '}
                  <span className="font-medium text-slate-900 dark:text-slate-100">Rent</span>, or{' '}
                  <span className="font-medium text-slate-900 dark:text-slate-100">UPI</span>.
                </p>

                <div className="relative mb-4">
                  <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    value={ledgerSearch}
                    onChange={(e) => setLedgerSearch(e.target.value)}
                    placeholder="Filter sample ledger entries..."
                    aria-label="Filter sample ledger entries"
                    className="w-full pl-10 pr-16 py-2.5 bg-slate-50 dark:bg-slate-950 rounded-lg text-sm border border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white placeholder:text-slate-400"
                  />
                  {ledgerSearch && (
                    <button
                      type="button"
                      onClick={() => setLedgerSearch('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-slate-500 hover:text-slate-900 dark:hover:text-white"
                    >
                      Clear
                    </button>
                  )}
                </div>

                <div className="divide-y divide-slate-200 dark:divide-slate-800 border-t border-b border-slate-200 dark:border-slate-800 max-h-52 overflow-y-auto">
                  {filteredTransactions.length > 0 ? (
                    filteredTransactions.map((tx) => (
                      <div
                        key={tx.id}
                        className="py-2.5 flex items-center justify-between gap-4 text-sm"
                      >
                        <div className="min-w-0">
                          <p className="font-medium text-slate-900 dark:text-white truncate">
                            {tx.merchant}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                            {tx.category} · {tx.account}
                            {tx.hasReceipt ? ' · Receipt attached' : ''}
                          </p>
                        </div>
                        <span
                          className={`font-mono text-sm font-semibold tabular-nums whitespace-nowrap shrink-0 ${
                            tx.isIncome
                              ? 'text-emerald-700 dark:text-emerald-400'
                              : tx.isTransfer
                                ? 'text-slate-500 dark:text-slate-400'
                                : 'text-slate-900 dark:text-slate-100'
                          }`}
                        >
                          {tx.amount}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">
                      No sample entries match "{ledgerSearch}".
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Card 2: Spending Behaviour & Analytics */}
            <div className="p-6 sm:p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col justify-between">
              <div>
                <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400 mb-2">
                  02. Spending Insights
                </p>
                <h3 className="text-xl font-bold text-slate-950 dark:text-white mb-2">
                  See where money actually goes each month.
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  Review category shares, month-over-month cash flow trends, savings rate, and
                  evidence-based observations calculated directly from your recorded transactions.
                </p>
              </div>
              <p className="pt-5 mt-6 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
                Transfers and card bill payments stay excluded from expense totals.
              </p>
            </div>

            {/* Card 3: Multi-Account Organiser */}
            <div className="p-6 sm:p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400 mb-2">
                03. Multiple Accounts
              </p>
              <h3 className="text-xl font-bold text-slate-950 dark:text-white mb-2">
                Bank, UPI, Cash & Credit Cards
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                Track balances across savings accounts, checking/UPI accounts, wallets, investments,
                loans, and credit cards with limit utilization and statement due dates.
              </p>
            </div>

            {/* Card 4: Monthly Budgets */}
            <div className="p-6 sm:p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400 mb-2">
                04. Monthly Budgets
              </p>
              <h3 className="text-xl font-bold text-slate-950 dark:text-white mb-2">
                Pacing before the month ends
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                Set practical category caps and monitor pace through the month. Split transactions
                allocate accurately across categories without double-counting.
              </p>
            </div>

            {/* Card 5: Savings Goals & Recurring Bills */}
            <div className="p-6 sm:p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400 mb-2">
                05. Goals & Subscriptions
              </p>
              <h3 className="text-xl font-bold text-slate-950 dark:text-white mb-2">
                Commitments & milestones
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                Log recurring rent, broadband, and OTT subscriptions with renewal reminders, while
                tracking contribution progress toward emergency funds or big purchases.
              </p>
            </div>

            {/* Card 6 (Span 3): Excel/CSV Statement Importer & Receipts */}
            <div className="md:col-span-3 p-6 sm:p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              <div className="max-w-2xl">
                <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400 mb-2 inline-flex items-center gap-1.5">
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>06. Statement Import & Receipts</span>
                </p>
                <h3 className="text-xl font-bold text-slate-950 dark:text-white mb-2">
                  Bring in existing Excel or CSV statements in minutes.
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  Upload multi-sheet Excel (.xlsx, .xls) workbooks or CSV bank statements, map your
                  columns side-by-side, fix or edit rows inline, skip duplicates automatically, and
                  attach receipt images (JPG, PNG, WebP up to 10MB) to any transaction.
                </p>
              </div>
              <div className="shrink-0">
                <button
                  type="button"
                  onClick={handlePrimaryStart}
                  className="bg-slate-900 dark:bg-emerald-500 hover:bg-slate-800 dark:hover:bg-emerald-400 text-white dark:text-slate-950 font-semibold text-sm px-5 py-3 rounded-lg inline-flex items-center gap-2 transition-colors whitespace-nowrap"
                >
                  <span>Try Statement Import</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================
            SECTION 4 — INTERACTIVE GOAL MILESTONE PLANNER (INR)
           ======================================================== */}
        <section
          id="goals-planner"
          className="py-16 sm:py-20 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8"
        >
          <div className="p-6 sm:p-10 rounded-2xl bg-slate-900 dark:bg-slate-900 text-white border border-slate-800">
            <div className="max-w-2xl mb-8">
              <p className="text-sm font-medium text-emerald-400 mb-2">
                Interactive goal planner
              </p>
              <h2
                className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-white mb-2"
                style={{ textWrap: 'balance' }}
              >
                See how steady monthly habits reach a real milestone.
              </h2>
              <p className="text-sm text-slate-300 leading-relaxed">
                Adjust a target—whether an emergency buffer, a new phone, or a travel fund—to see
                your timeline before tracking it inside PRYORA.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* Sliders */}
              <div className="lg:col-span-7 space-y-6">
                <div>
                  <div className="flex items-center justify-between text-sm mb-2">
                    <label htmlFor="goal-target-slider" className="font-medium text-slate-200">
                      Goal target
                    </label>
                    <span className="font-mono font-semibold tabular-nums text-white">
                      {formatInr(goalTarget)}
                    </span>
                  </div>
                  <input
                    id="goal-target-slider"
                    type="range"
                    min={5000}
                    max={500000}
                    step={5000}
                    value={goalTarget}
                    onChange={(e) => {
                      const nextTarget = Number(e.target.value);
                      setGoalTarget(nextTarget);
                      if (goalSaved > nextTarget) {
                        setGoalSaved(nextTarget);
                      }
                    }}
                    className="w-full accent-emerald-500 cursor-pointer"
                  />
                  <div className="flex justify-between text-xs text-slate-400 font-mono mt-1">
                    <span>₹5,000</span>
                    <span>₹5,00,000</span>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between text-sm mb-2">
                    <label htmlFor="goal-saved-slider" className="font-medium text-slate-200">
                      Saved so far
                    </label>
                    <span className="font-mono font-semibold tabular-nums text-white">
                      {formatInr(effectiveSaved)}
                    </span>
                  </div>
                  <input
                    id="goal-saved-slider"
                    type="range"
                    min={0}
                    max={goalTarget}
                    step={1000}
                    value={effectiveSaved}
                    onChange={(e) => setGoalSaved(Number(e.target.value))}
                    className="w-full accent-emerald-500 cursor-pointer"
                  />
                  <div className="flex justify-between text-xs text-slate-400 font-mono mt-1">
                    <span>₹0</span>
                    <span>{formatInr(goalTarget)}</span>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between text-sm mb-2">
                    <label htmlFor="goal-monthly-slider" className="font-medium text-slate-200">
                      Monthly contribution
                    </label>
                    <span className="font-mono font-semibold tabular-nums text-emerald-400">
                      {formatInr(goalMonthly)} / mo
                    </span>
                  </div>
                  <input
                    id="goal-monthly-slider"
                    type="range"
                    min={500}
                    max={50000}
                    step={500}
                    value={goalMonthly}
                    onChange={(e) => setGoalMonthly(Number(e.target.value))}
                    className="w-full accent-emerald-500 cursor-pointer"
                  />
                  <div className="flex justify-between text-xs text-slate-400 font-mono mt-1">
                    <span>₹500</span>
                    <span>₹50,000</span>
                  </div>
                </div>
              </div>

              {/* Calculated Output */}
              <div className="lg:col-span-5 lg:border-l lg:border-slate-800 lg:pl-8 space-y-5">
                <div>
                  <p className="text-xs font-medium text-slate-400 mb-1">Estimated completion</p>
                  <p className="font-display text-2xl sm:text-3xl font-bold text-white">
                    {estimatedCompletionLabel}
                  </p>
                  <p className="text-xs text-emerald-400 font-medium mt-1 font-mono tabular-nums">
                    {remainingNeeded === 0
                      ? '100% funded'
                      : `${monthsToGoal} ${monthsToGoal === 1 ? 'month' : 'months'} at ${formatInr(goalMonthly)}/month`}
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-xs text-slate-300 font-mono tabular-nums">
                    <span>Progress</span>
                    <span>{progressPercent}%</span>
                  </div>
                  <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full transition-all duration-200"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-3 border-t border-slate-800 text-xs">
                  <div>
                    <span className="text-slate-400 block mb-0.5">Remaining</span>
                    <span className="font-mono text-sm font-semibold tabular-nums text-white">
                      {formatInr(remainingNeeded)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block mb-0.5">Target</span>
                    <span className="font-mono text-sm font-semibold tabular-nums text-white">
                      {formatInr(goalTarget)}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handlePrimaryStart}
                  className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-sm px-5 py-3 rounded-lg inline-flex items-center justify-center gap-2 transition-colors"
                >
                  <span>Track This Goal in PRYORA</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================
            SECTION 5 — HONEST PRIVACY & DATA ARCHITECTURE
           ======================================================== */}
        <section
          id="privacy"
          className="py-16 sm:py-20 border-t border-slate-200 dark:border-slate-800/80 bg-white dark:bg-slate-900/40"
        >
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-2xl mb-12">
              <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400 mb-2 inline-flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4" />
                <span>Privacy & data handling</span>
              </p>
              <h2
                className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-950 dark:text-white mb-3"
                style={{ textWrap: 'balance' }}
              >
                Clear about how your financial data is stored and protected.
              </h2>
              <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed">
                Financial software should earn trust with plain facts, not vague promises. Here is
                exactly how PRYORA handles your records today.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-6 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <h3 className="text-base font-semibold text-slate-950 dark:text-white mb-2">
                  No bank logins or SMS reading
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  PRYORA never asks for your net-banking credentials, UPI PINs, or SMS inbox access.
                  You record transactions manually or upload your own CSV and Excel files whenever
                  you choose.
                </p>
              </div>

              <div className="p-6 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <h3 className="text-base font-semibold text-slate-950 dark:text-white mb-2">
                  Account-isolated database storage
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  Your ledger is persisted on the PRYORA application server in an isolated account
                  record (SQLite) checked on every API request. Local browser storage only caches UI
                  preferences and user-scoped offline queues, which clear automatically on sign-out.
                </p>
              </div>

              <div className="p-6 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <h3 className="text-base font-semibold text-slate-950 dark:text-white mb-2">
                  Verified sign-in & honest categorization
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  Use email and password authentication or optional Google Sign-In backed by
                  cryptographically verified Firebase ID tokens. Merchant category suggestions rely
                  primarily on deterministic keyword matching, with optional Gemini fallback only
                  when enabled server-side.
                </p>
              </div>

              <div className="p-6 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <h3 className="text-base font-semibold text-slate-950 dark:text-white mb-2">
                  Export or permanently delete anytime
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  Export your ledger in CSV, Excel (.xlsx), or full JSON backup format from the Data
                  Hub with no lock-in—or permanently delete your account, sessions, transactions,
                  and receipts directly from inside the app.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================
            SECTION 6 — 10-QUESTION FILTERABLE FAQ
           ======================================================== */}
        <section id="faq" className="py-16 sm:py-24 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-8">
            <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400 mb-2">
              Frequently asked questions
            </p>
            <h2
              className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-950 dark:text-white mb-5"
              style={{ textWrap: 'balance' }}
            >
              Straight answers about PRYORA Early Access.
            </h2>

            {/* Interactive Filter Tabs */}
            <div className="inline-flex flex-wrap items-center gap-1 p-1 bg-slate-200/70 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg">
              {(
                [
                  { id: 'all', label: 'All questions (10)' },
                  { id: 'getting-started', label: 'Getting Started' },
                  { id: 'privacy', label: 'Privacy & Data' },
                  { id: 'features', label: 'Features' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFaqFilter(tab.id)}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap ${
                    faqFilter === tab.id
                      ? 'bg-white dark:bg-slate-800 text-slate-950 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="divide-y divide-slate-200 dark:divide-slate-800 border-t border-b border-slate-200 dark:border-slate-800">
            {visibleFaqs.map((item) => {
              const isOpen = expandedFaq === item.id;
              return (
                <div key={item.id}>
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    onClick={() => setExpandedFaq(isOpen ? null : item.id)}
                    className="w-full py-5 text-left flex items-center justify-between gap-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 rounded-md"
                  >
                    <span className="text-sm sm:text-base font-semibold text-slate-950 dark:text-white">
                      {item.q}
                    </span>
                    <ChevronDown
                      className={`w-4 h-4 text-slate-500 dark:text-slate-400 shrink-0 transition-transform duration-200 ${
                        isOpen ? 'rotate-180 text-emerald-600 dark:text-emerald-400' : ''
                      }`}
                    />
                  </button>
                  {isOpen && (
                    <div className="pb-5 pr-8 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                      {item.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* ========================================================
            SECTION 7 — FINAL EARLY ACCESS CONVERSION
           ======================================================== */}
        <section className="py-16 sm:py-20 border-t border-slate-200 dark:border-slate-800/80 bg-white dark:bg-slate-900/40">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2
              className="font-display text-2xl sm:text-4xl font-bold tracking-tight text-slate-950 dark:text-white mb-4"
              style={{ textWrap: 'balance' }}
            >
              Your financial habits deserve a closer look.
            </h2>
            <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 max-w-xl mx-auto mb-8 leading-relaxed">
              Explore PRYORA, try the current experience and help shape what comes next.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                type="button"
                onClick={handlePrimaryStart}
                className="w-full sm:w-auto bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-sm px-6 py-3 rounded-lg inline-flex items-center justify-center gap-2 transition-colors whitespace-nowrap"
              >
                <span>{user ? 'Go to Dashboard' : 'Explore PRYORA'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleLaunchDemo}
                disabled={demoLoading}
                className="w-full sm:w-auto bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 font-semibold text-sm px-6 py-3 rounded-lg inline-flex items-center justify-center gap-2 transition-colors whitespace-nowrap disabled:opacity-60"
              >
                <span>{demoLoading ? 'Opening Demo...' : 'Try the Demo'}</span>
              </button>
            </div>
          </div>
        </section>
      </main>

      {/* ========================================================
          QUIET FOOTER
         ======================================================== */}
      <footer className="border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 py-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-md bg-emerald-500 text-slate-950 font-display font-extrabold text-xs flex items-center justify-center">
                P
              </span>
              <span className="font-display font-bold text-sm tracking-tight text-slate-900 dark:text-white">
                PRYORA
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                · Public Early Access
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md">
              Personal finance tracking and spending visibility tool. PRYORA does not provide
              regulated investment, tax, or credit advice.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-5 text-xs font-medium text-slate-600 dark:text-slate-400">
            <a href="#preview" className="hover:text-slate-950 dark:hover:text-white transition-colors">
              Product
            </a>
            <a href="#features" className="hover:text-slate-950 dark:hover:text-white transition-colors">
              Capabilities
            </a>
            <a href="#privacy" className="hover:text-slate-950 dark:hover:text-white transition-colors">
              Privacy
            </a>
            <a href="#faq" className="hover:text-slate-950 dark:hover:text-white transition-colors">
              FAQ
            </a>
            <button
              type="button"
              onClick={openFeedbackModal}
              className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
            >
              Send Feedback
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};
