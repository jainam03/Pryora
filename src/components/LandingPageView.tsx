/**
 * PRYORA Personal Finance OS — Official Landing Page
 * 
 * Strictly aligned with current application offerings:
 * - Net worth & cash flow overview
 * - Multi-account management (Checking, Savings, Credit Cards, Cash, Investments)
 * - Fast transaction logging with split amounts and custom tags
 * - Real-time instant search & filtering by merchant, category, and notes
 * - Smart AI Auto-Categorization based on merchant description
 * - Receipt image attachments with dedicated high-resolution viewer modal
 * - Envelope budgeting with category spending limits and threshold alerts
 * - Recurring subscriptions tracker with renewal dates & monthly costs
 * - Financial goals & milestone progress tracking
 * - 100% Data Sovereignty: 1-click CSV/JSON exports & CSV imports
 * - Local-first SQLite engine with secure Firebase cloud sync
 * - Interactive Goal Milestone Planner that reflects the in-app Goals module
 */

import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { PWAInstallButton } from './PWAInstallButton';
import {
  ArrowRight,
  ShieldCheck,
  Zap,
  Lock,
  Search,
  Receipt,
  PieChart,
  CalendarClock,
  Target,
  BarChart3,
  Database,
  TrendingUp,
  CheckCircle2,
  ChevronDown,
  Sun,
  Moon,
  Sparkles,
  Layers,
  ArrowRightLeft,
  DollarSign,
  Tag,
  Check,
} from 'lucide-react';

interface LandingPageViewProps {
  onLaunchApp: () => void;
  onOpenAuth: (initialMode?: 'signin' | 'signup') => void;
}

export const LandingPageView: React.FC<LandingPageViewProps> = ({
  onLaunchApp,
  onOpenAuth,
}) => {
  const { user, loginDemo } = useAuth();
  const { resolvedTheme, toggleTheme } = useTheme();

  // Hero Sandbox active tab
  const [activeHeroTab, setActiveHeroTab] = useState<'overview' | 'categorization' | 'budget' | 'subscriptions'>('overview');

  // Interactive Bento Demo: Live Search Filter
  const [bentoSearchQuery, setBentoSearchQuery] = useState<string>('');

  // Interactive Goal Planner State (Alters to match GoalsView in app)
  const [goalTargetAmount, setGoalTargetAmount] = useState<number>(10000);
  const [goalCurrentSaved, setGoalCurrentSaved] = useState<number>(2500);
  const [goalMonthlySavings, setGoalMonthlySavings] = useState<number>(500);

  // FAQ Accordion & Category Filter
  const [activeFaqCategory, setActiveFaqCategory] = useState<'all' | 'privacy' | 'multi-account' | 'workflows'>('all');
  const [expandedFaq, setExpandedFaq] = useState<string | null>('privacy-credentials');

  // Demo Starter state
  const [demoStarting, setDemoStarting] = useState<boolean>(false);
  const handleQuickDemo = async () => {
    try {
      setDemoStarting(true);
      await loginDemo();
      onLaunchApp();
    } catch (err) {
      console.error('Failed to start demo:', err);
      onLaunchApp();
    } finally {
      setDemoStarting(false);
    }
  };

  // Realistic sample transactions matching in-app schema
  const sampleTransactions = [
    { id: '1', merchant: 'Whole Foods Market', category: 'Groceries', amount: '-$142.80', date: 'Today', note: 'Weekly fresh groceries', hasReceipt: true },
    { id: '2', merchant: 'Client Consulting Retainer', category: 'Income', amount: '+$3,200.00', date: 'Yesterday', note: 'Direct deposit into Checking', hasReceipt: false },
    { id: '3', merchant: 'Figma Professional', category: 'Software', amount: '-$15.00', date: 'Oct 02', note: 'Monthly recurring subscription', hasReceipt: true },
    { id: '4', merchant: 'Blue Bottle Cafe', category: 'Dining', amount: '-$6.50', date: 'Sep 30', note: 'Morning coffee', hasReceipt: true },
    { id: '5', merchant: 'Vanguard Index Transfer', category: 'Transfer', amount: '$500.00', date: 'Sep 28', note: 'Checking to Investment savings', hasReceipt: false },
  ];

  const filteredDemoTransactions = sampleTransactions.filter(item => {
    if (!bentoSearchQuery.trim()) return true;
    const q = bentoSearchQuery.toLowerCase();
    return (
      item.merchant.toLowerCase().includes(q) ||
      item.category.toLowerCase().includes(q) ||
      item.note.toLowerCase().includes(q)
    );
  });

  // Calculate Goal Milestone Runway
  const remainingNeeded = Math.max(0, goalTargetAmount - goalCurrentSaved);
  const monthsToGoal = goalMonthlySavings > 0 ? Math.ceil(remainingNeeded / goalMonthlySavings) : 0;
  const progressPercent = goalTargetAmount > 0 ? Math.min(100, Math.round((goalCurrentSaved / goalTargetAmount) * 100)) : 0;

  const faqItems: Array<{
    id: string;
    category: 'privacy' | 'multi-account' | 'workflows';
    categoryLabel: string;
    q: string;
    a: string;
  }> = [
    {
      id: 'privacy-credentials',
      category: 'privacy',
      categoryLabel: 'Data Privacy',
      q: 'Does PRYORA ever ask for my bank login credentials or connect to third-party aggregators?',
      a: 'Never. PRYORA is intentionally designed without third-party bank screen-scrapers or credential harvesting. You never hand over your online banking passwords, PINs, or OAuth tokens. Instead, you log transactions directly or import bank statements via standard CSV files—giving you complete immunity from third-party aggregator data breaches.',
    },
    {
      id: 'multi-account-types',
      category: 'multi-account',
      categoryLabel: 'Multi-Account Tracking',
      q: 'What types of financial accounts can I track simultaneously in PRYORA?',
      a: 'PRYORA supports 8 distinct account classifications out of the box: Checking, Savings, Credit Cards, Cash, Digital Wallets, Investments, Loans, and Other custom accounts. You can create unlimited accounts across these types and view both individual account ledgers and your consolidated Net Worth & Cash Flow in real time.',
    },
    {
      id: 'privacy-storage-isolation',
      category: 'privacy',
      categoryLabel: 'Data Privacy',
      q: 'Where is my financial data stored, and how is it isolated from other users?',
      a: 'PRYORA uses a hybrid Local-First + Private Cloud architecture. It runs an in-memory SQLite engine (sql.js) for instant local queries and pairs with Google Firebase Firestore when you sign in. In Firestore, every document—accounts, transactions, budgets, goals, and subscriptions—is strictly isolated to your authenticated user UID and enforced by server-side security rules.',
    },
    {
      id: 'multi-account-transfers',
      category: 'multi-account',
      categoryLabel: 'Multi-Account Tracking',
      q: 'How does PRYORA handle transfers between my accounts and reconcile balances?',
      a: 'Every account tracks its initial balance and real-time current balance using integer minor units (cents/paise) to eliminate floating-point rounding errors. When you log an expense, income, or an internal account-to-account transfer (for example, paying off a Credit Card from Checking or moving money into Savings), PRYORA automatically debits the source account and credits the destination account without artificially inflating your monthly spending analytics.',
    },
    {
      id: 'multi-account-credit-cards',
      category: 'multi-account',
      categoryLabel: 'Multi-Account Tracking',
      q: 'Does PRYORA offer specialized tracking for Credit Cards alongside bank accounts?',
      a: 'Yes. When you add a Credit Card account in PRYORA, you can track its total Credit Limit, real-time Available Credit, Credit Utilization percentage, Statement Closing Day, Payment Due Day, and Minimum Payment amount—helping you keep utilization low and avoid late fees across multiple cards.',
    },
    {
      id: 'privacy-export-delete',
      category: 'privacy',
      categoryLabel: 'Data Privacy',
      q: 'Can I export my entire financial ledger or permanently delete my data?',
      a: 'Yes, you have 100% data sovereignty with zero vendor lock-in. Inside the Data Hub, you can export your complete ledger (transactions, accounts, categories, and metadata) as standard CSV or raw JSON files with a single click. You can also import historical CSV records or permanently wipe and reset your account data at any time.',
    },
    {
      id: 'privacy-monetization',
      category: 'privacy',
      categoryLabel: 'Data Privacy',
      q: 'Are my transaction notes, merchants, or receipt photos shared with advertisers?',
      a: 'No. PRYORA contains zero ad networks, zero third-party behavioral tracking pixels, and never sells or shares your financial records or uploaded receipt images with data brokers or marketing platforms.',
    },
    {
      id: 'multi-account-currencies',
      category: 'multi-account',
      categoryLabel: 'Multi-Account Tracking',
      q: 'Can I filter transactions by a single account or customize my primary currency?',
      a: 'Yes. You can filter your transaction ledger and cash flow views by any specific account (e.g., viewing only your primary Checking account or a specific Credit Card) and configure your profile to display in Indian Rupee (INR ₹), US Dollar (USD $), Euro (EUR €), British Pound (GBP £), and other major global currencies.',
    },
    {
      id: 'workflows-receipts-categorization',
      category: 'workflows',
      categoryLabel: 'Features & Workflows',
      q: 'How do split transactions, receipt attachments, and smart auto-categorization work?',
      a: 'Any transaction can be split across multiple budget categories (e.g., splitting a supermarket run between Groceries and Household). You can also attach receipt images (PNG, JPG, WebP up to 15MB) and inspect them in the high-resolution Receipt Viewer Modal. As you type a merchant name, PRYORA automatically suggests the matching category based on pattern recognition.',
    },
    {
      id: 'workflows-demo-sandbox',
      category: 'workflows',
      categoryLabel: 'Features & Workflows',
      q: 'Can I explore PRYORA’s multi-account ledger before creating a personal account?',
      a: 'Yes. Click "Explore Live Demo" anywhere on this page to launch an interactive sandbox pre-loaded with sample Checking, Savings, and Credit Card accounts, split transactions, envelope budgets, and recurring subscriptions.',
    },
  ];

  const visibleFaqItems = faqItems.filter(
    (item) => activeFaqCategory === 'all' || item.category === activeFaqCategory
  );

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans antialiased transition-colors selection:bg-emerald-500 selection:text-slate-950">
      
      {/* Background Ambient Glows */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden z-0 opacity-40 dark:opacity-20" aria-hidden="true">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[750px] h-[350px] bg-gradient-to-tr from-emerald-500/25 via-teal-400/20 to-blue-500/15 rounded-full blur-3xl" />
        <div className="absolute top-1/2 -right-32 w-[500px] h-[300px] bg-gradient-to-br from-indigo-500/15 to-purple-500/15 rounded-full blur-3xl" />
      </div>

      {/* ========================================================
          1. TOP BAR CONTRACT (Strict 3-Zone Architecture)
         ======================================================== */}
      <header className="sticky top-0 z-50 bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl border-b border-slate-200/80 dark:border-slate-800/80 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          
          {/* Zone 1: Single text element wordmark */}
          <a
            href="#top"
            className="flex items-center gap-2.5 text-left focus:outline-none group"
            aria-label="Priyora Home"
          >
            <div className="w-8 h-8 rounded-xl bg-emerald-500 text-slate-950 font-black text-sm flex items-center justify-center tracking-tighter shadow-sm shadow-emerald-500/20 group-hover:scale-105 transition-transform">
              P
            </div>
            <span className="font-extrabold text-base tracking-wider text-slate-900 dark:text-white">
              PRYORA
            </span>
          </a>

          {/* Zone 2: Clean Text Navigation Links */}
          <nav className="hidden md:flex items-center gap-7 text-xs font-semibold text-slate-600 dark:text-slate-300">
            <a href="#features" className="hover:text-emerald-500 dark:hover:text-emerald-400 transition-colors">
              Features
            </a>
            <a href="#preview" className="hover:text-emerald-500 dark:hover:text-emerald-400 transition-colors">
              Live Preview
            </a>
            <a href="#goals-planner" className="hover:text-emerald-500 dark:hover:text-emerald-400 transition-colors">
              Goal Planner
            </a>
            <a href="#privacy" className="hover:text-emerald-500 dark:hover:text-emerald-400 transition-colors">
              Data Sovereignty
            </a>
            <a href="#faq" className="hover:text-emerald-500 dark:hover:text-emerald-400 transition-colors">
              FAQ
            </a>
          </nav>

          {/* Zone 3: Primary Actions & Theme Switcher */}
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={toggleTheme}
              className="p-2 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              aria-label="Toggle visual theme"
            >
              {resolvedTheme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
            </button>

            <div className="hidden sm:block">
              <PWAInstallButton variant="header" />
            </div>

            {user ? (
              <button
                type="button"
                onClick={onLaunchApp}
                className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs px-4 py-2 rounded-xl flex items-center gap-1.5 transition-all shadow-sm shadow-emerald-500/20 active:scale-95 whitespace-nowrap"
              >
                <span>Launch OS</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => onOpenAuth('signin')}
                  className="hidden sm:inline-flex text-xs font-semibold text-slate-700 dark:text-slate-200 hover:text-emerald-500 dark:hover:text-emerald-400 px-3 py-2 transition-colors whitespace-nowrap"
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={onLaunchApp}
                  className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs px-4 py-2 rounded-xl flex items-center gap-1.5 transition-all shadow-sm shadow-emerald-500/20 active:scale-95 whitespace-nowrap"
                >
                  <span>Open Priyora OS</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main id="top" className="flex-1 relative z-10">
        
        {/* ========================================================
            HERO SECTION
            Honest, concrete positioning of current features
           ======================================================== */}
        <section className="pt-14 pb-16 sm:pt-20 sm:pb-22 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          
          {/* Subtle Editorial Kicker */}
          <div className="inline-flex items-center gap-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400 mb-4 tracking-wide uppercase">
            <span>Personal Finance OS</span>
            <span aria-hidden="true">·</span>
            <span>Accounts, Budgets & Goals</span>
          </div>

          {/* Master Headline */}
          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-slate-900 dark:text-white max-w-4xl mx-auto leading-[1.15] mb-6">
            Track expenses, manage budgets, <br className="hidden sm:inline" />
            and reach financial goals.
          </h1>

          {/* Value Proposition Subtitle */}
          <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300 max-w-2xl mx-auto mb-8 leading-relaxed">
            Priyora unifies your bank accounts, cash flow, envelope budgets, recurring subscriptions, and receipt attachments in one fast, private interface.
          </p>

          {/* Primary Action Buttons */}
          <div className="flex flex-col sm:flex-row flex-wrap items-center justify-center gap-3 sm:gap-4 mb-6">
            <button
              type="button"
              onClick={onLaunchApp}
              className="w-full sm:w-auto bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm px-6 py-3.5 rounded-xl flex items-center justify-center gap-2 transition-all shadow-md shadow-emerald-500/20 active:scale-95"
            >
              <span>{user ? 'Go to Dashboard' : 'Open Priyora OS'}</span>
              <ArrowRight className="w-4 h-4 stroke-[2.5]" />
            </button>

            <button
              type="button"
              onClick={handleQuickDemo}
              disabled={demoStarting}
              className="w-full sm:w-auto bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-800 font-semibold text-sm px-6 py-3.5 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95"
            >
              <Zap className="w-4 h-4 text-emerald-500" />
              <span>{demoStarting ? 'Loading Sandbox...' : 'Explore Live Demo'}</span>
            </button>

            <PWAInstallButton variant="hero" />
          </div>

          {/* Unboxed Trust Metadata */}
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
            <span>No bank logins required</span>
            <span aria-hidden="true">·</span>
            <span>Split transactions</span>
            <span aria-hidden="true">·</span>
            <span>Receipt attachments</span>
            <span aria-hidden="true">·</span>
            <span>1-click CSV/JSON export</span>
          </div>
        </section>

        {/* ========================================================
            INTERACTIVE LIVE PREVIEW
            Showcases the actual app screens and workflow
           ======================================================== */}
        <section id="preview" className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 mb-24">
          <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/90 dark:border-slate-800/90 rounded-2xl shadow-xl overflow-hidden">
            
            {/* Window Chrome & Interactive Segmented Controls */}
            <div className="px-4 py-3 border-b border-slate-200/80 dark:border-slate-800/80 bg-slate-50/70 dark:bg-slate-950/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5" aria-hidden="true">
                  <div className="w-3 h-3 rounded-full bg-rose-400/80" />
                  <div className="w-3 h-3 rounded-full bg-amber-400/80" />
                  <div className="w-3 h-3 rounded-full bg-emerald-400/80" />
                </div>
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 ml-2">
                  Priyora OS Preview
                </span>
              </div>

              {/* Segmented Switcher */}
              <div className="flex items-center gap-1 bg-slate-200/60 dark:bg-slate-800/60 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setActiveHeroTab('overview')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    activeHeroTab === 'overview'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Dashboard
                </button>
                <button
                  type="button"
                  onClick={() => setActiveHeroTab('categorization')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    activeHeroTab === 'categorization'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Smart Categorization
                </button>
                <button
                  type="button"
                  onClick={() => setActiveHeroTab('budget')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    activeHeroTab === 'budget'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Envelope Budgets
                </button>
                <button
                  type="button"
                  onClick={() => setActiveHeroTab('subscriptions')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    activeHeroTab === 'subscriptions'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Subscriptions
                </button>
              </div>
            </div>

            {/* Live Interactive Tab Panels */}
            <div className="p-6 sm:p-8">
              
              {/* Tab 1: Executive Dashboard */}
              {activeHeroTab === 'overview' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="p-4 rounded-xl bg-slate-100/60 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800/60">
                      <span className="text-xs text-slate-500 dark:text-slate-400 block mb-1">Total Net Worth</span>
                      <span className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white tabular-nums">$148,250.00</span>
                      <div className="mt-2 text-xs font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                        <TrendingUp className="w-3.5 h-3.5" />
                        <span>+$4,120.00 this month</span>
                      </div>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-100/60 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800/60">
                      <span className="text-xs text-slate-500 dark:text-slate-400 block mb-1">Monthly Inflow</span>
                      <span className="text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400 tabular-nums">+$8,400.00</span>
                      <span className="mt-2 text-xs text-slate-500 dark:text-slate-400 block">Salary & freelance income</span>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-100/60 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800/60">
                      <span className="text-xs text-slate-500 dark:text-slate-400 block mb-1">Monthly Outflow</span>
                      <span className="text-2xl font-bold tracking-tight text-rose-500 dark:text-rose-400 tabular-nums">-$4,280.00</span>
                      <div className="mt-2 text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2">
                        <span>Savings Rate: <strong className="text-slate-900 dark:text-white tabular-nums">49.0%</strong></span>
                      </div>
                    </div>
                  </div>

                  {/* Micro Table */}
                  <div className="rounded-xl border border-slate-200/70 dark:border-slate-800/70 overflow-hidden">
                    <div className="px-4 py-2.5 bg-slate-100/50 dark:bg-slate-800/50 text-xs font-semibold text-slate-600 dark:text-slate-300 flex justify-between">
                      <span>Recent Activity</span>
                      <span className="text-emerald-500 font-medium">Reconciled across accounts</span>
                    </div>
                    <div className="divide-y divide-slate-200/60 dark:divide-slate-800/60 text-xs">
                      <div className="px-4 py-3 flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-slate-900 dark:text-white">Client Consulting Retainer</p>
                          <p className="text-slate-500 dark:text-slate-400">Business Checking · Oct 04</p>
                        </div>
                        <span className="font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">+$3,200.00</span>
                      </div>
                      <div className="px-4 py-3 flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-slate-900 dark:text-white">Whole Foods Market</p>
                          <p className="text-slate-500 dark:text-slate-400">Credit Card · Receipt Attached</p>
                        </div>
                        <span className="font-bold text-slate-900 dark:text-white tabular-nums">-$142.80</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 2: Smart Auto-Categorization & Receipt Viewer */}
              {activeHeroTab === 'categorization' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                  <div className="p-5 rounded-xl bg-slate-100/70 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800/70 text-xs space-y-3">
                    <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700 pb-2">
                      <span className="font-bold text-slate-900 dark:text-white">TRANSACTION LOGGING</span>
                      <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" />
                        Keyword Matching
                      </span>
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 block mb-1">Merchant Entered:</span>
                      <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-medium">
                        Whole Foods Market
                      </div>
                    </div>
                    <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300">
                      <p className="font-bold flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" />
                        Matched Category: Groceries
                      </p>
                      <p className="text-[11px] text-emerald-600/90 dark:text-emerald-400/90 mt-1">
                        Matched supermarket merchant. Auto-selected in form.
                      </p>
                    </div>
                    <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between text-slate-500">
                      <span>Receipt Attachment:</span>
                      <span className="text-slate-900 dark:text-white font-medium flex items-center gap-1">
                        <Receipt className="w-3.5 h-3.5 text-emerald-500" />
                        receipt_oct_04.jpg (Preview modal ready)
                      </span>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">
                      Faster Expense Entry with Less Friction
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                      Type any merchant name and Priyora automatically selects the matching category so you don't have to hunt through dropdown menus.
                    </p>
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                      Attach photo receipts (JPG, PNG, WebP) directly to any record and inspect them anytime with the dedicated full-screen Receipt Viewer Modal.
                    </p>
                  </div>
                </div>
              )}

              {/* Tab 3: Envelope Budgets */}
              {activeHeroTab === 'budget' && (
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-xs font-semibold mb-1.5">
                      <span>Dining & Cafes</span>
                      <span className="text-slate-500 tabular-nums">$380 spent / $500 cap (76%)</span>
                    </div>
                    <div className="w-full h-2.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full bg-amber-500 rounded-full" style={{ width: '76%' }} />
                    </div>
                    <span className="text-[11px] text-amber-600 dark:text-amber-400 mt-1 block">$120 remaining this month</span>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs font-semibold mb-1.5">
                      <span>Housing & Utilities</span>
                      <span className="text-slate-500 tabular-nums">$1,850 spent / $1,900 cap (97%)</span>
                    </div>
                    <div className="w-full h-2.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full" style={{ width: '97%' }} />
                    </div>
                    <span className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1 block">$50 remaining this month</span>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs font-semibold mb-1.5">
                      <span>Software Subscriptions</span>
                      <span className="text-slate-500 tabular-nums">$65 spent / $120 cap (54%)</span>
                    </div>
                    <div className="w-full h-2.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full" style={{ width: '54%' }} />
                    </div>
                    <span className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1 block">$55 remaining this month</span>
                  </div>
                </div>
              )}

              {/* Tab 4: Subscriptions */}
              {activeHeroTab === 'subscriptions' && (
                <div className="space-y-3">
                  <div className="p-3 rounded-xl bg-slate-100/60 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800/60 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-500 flex items-center justify-center font-bold">
                        F
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900 dark:text-white">Figma Professional</p>
                        <p className="text-slate-500 dark:text-slate-400">Renews in 5 days · Monthly</p>
                      </div>
                    </div>
                    <span className="font-bold tabular-nums">$15.00 / mo</span>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-100/60 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800/60 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center font-bold">
                        S
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900 dark:text-white">Spotify Family Plan</p>
                        <p className="text-slate-500 dark:text-slate-400">Renews Oct 18 · Monthly</p>
                      </div>
                    </div>
                    <span className="font-bold tabular-nums">$19.99 / mo</span>
                  </div>
                </div>
              )}

            </div>
          </div>
        </section>

        {/* ========================================================
            FEATURES BENTO GRID
            True to what Priyora offers right now
           ======================================================== */}
        <section id="features" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-24">
          
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block mb-2">
              Current Capabilities
            </span>
            <h2 className="text-2xl sm:text-4xl font-bold text-slate-900 dark:text-white tracking-tight">
              A comprehensive toolkit for personal finance.
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Bento Card 1 (Span 2): Live Search & Split Filter */}
            <div className="md:col-span-2 p-6 sm:p-8 rounded-2xl bg-white/70 dark:bg-slate-900/70 border border-slate-200/80 dark:border-slate-800/80 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 text-xs font-semibold mb-3">
                  <Search className="w-4 h-4" />
                  <span>Instant Transaction Search & Filtering</span>
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
                  Find any entry instantly by merchant, note, or category.
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mb-6">
                  Test the live search filter right now. Type "Coffee", "Figma", "Retainer", or "Groceries":
                </p>

                {/* Interactive Filter Input */}
                <div className="relative mb-4">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={bentoSearchQuery}
                    onChange={(e) => setBentoSearchQuery(e.target.value)}
                    placeholder="Type to filter transactions..."
                    className="w-full pl-9 pr-4 py-2.5 bg-slate-100/80 dark:bg-slate-800/80 rounded-xl text-xs border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white"
                  />
                  {bentoSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setBentoSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-white"
                    >
                      Clear
                    </button>
                  )}
                </div>

                {/* Filter Results in Live Demo */}
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {filteredDemoTransactions.length > 0 ? (
                    filteredDemoTransactions.map(tx => (
                      <div
                        key={tx.id}
                        className="px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/50 flex items-center justify-between text-xs"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-slate-900 dark:text-white">{tx.merchant}</p>
                            {tx.hasReceipt && (
                              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded font-medium">
                                Receipt
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">{tx.category} · {tx.note}</p>
                        </div>
                        <span className={`font-bold tabular-nums ${tx.amount.startsWith('+') ? 'text-emerald-500' : 'text-slate-900 dark:text-white'}`}>
                          {tx.amount}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-4 text-xs text-slate-400">
                      No matching records for "{bentoSearchQuery}".
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Bento Card 2: Receipt Attachments & Viewer */}
            <div className="p-6 sm:p-8 rounded-2xl bg-white/70 dark:bg-slate-900/70 border border-slate-200/80 dark:border-slate-800/80 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 text-xs font-semibold mb-3">
                  <Receipt className="w-4 h-4" />
                  <span>Receipt Attachments & Viewer</span>
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
                  Visual proof stored alongside transactions.
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mb-4">
                  Attach physical or digital receipts directly to any expense. Review receipts in full resolution using the dedicated Receipt Viewer Modal.
                </p>
              </div>
              <div className="pt-4 border-t border-slate-200/60 dark:border-slate-800/60 text-xs text-slate-500 dark:text-slate-400">
                Supports JPG, PNG, and WebP images up to 15MB.
              </div>
            </div>

            {/* Bento Card 3: Multi-Account Management */}
            <div className="p-6 sm:p-8 rounded-2xl bg-white/70 dark:bg-slate-900/70 border border-slate-200/80 dark:border-slate-800/80">
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 text-xs font-semibold mb-3">
                <Layers className="w-4 h-4" />
                <span>Multi-Account Ledger</span>
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
                Checking, Savings & Credit Cards
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                Track balances across bank accounts, cash wallets, credit cards with statement cycles, and investment portfolios with simple account transfers.
              </p>
            </div>

            {/* Bento Card 4: Envelope Budgets */}
            <div className="p-6 sm:p-8 rounded-2xl bg-white/70 dark:bg-slate-900/70 border border-slate-200/80 dark:border-slate-800/80">
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 text-xs font-semibold mb-3">
                <PieChart className="w-4 h-4" />
                <span>Envelope Budgets</span>
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
                Spending Caps with Warnings
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                Set monthly caps for specific categories. Visual progress gauges alert you when you near or exceed your target budget.
              </p>
            </div>

            {/* Bento Card 5: Subscriptions & Recurring Bills */}
            <div className="p-6 sm:p-8 rounded-2xl bg-white/70 dark:bg-slate-900/70 border border-slate-200/80 dark:border-slate-800/80">
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 text-xs font-semibold mb-3">
                <CalendarClock className="w-4 h-4" />
                <span>Subscription Radar</span>
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
                Audit Recurring Expenses
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                Keep an inventory of all active recurring memberships, billing frequencies (monthly, quarterly, annual), and renewal dates.
              </p>
            </div>

            {/* Bento Card 6 (Span 3): Excel & CSV Statement Import & Export */}
            <div className="md:col-span-3 p-6 sm:p-8 rounded-2xl bg-white/70 dark:bg-slate-900/70 border border-slate-200/80 dark:border-slate-800/80 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="max-w-2xl">
                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 text-xs font-semibold mb-2">
                  <Database className="w-4 h-4" />
                  <span>Excel (.xlsx, .xls) & CSV Statement Import & Export</span>
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
                  Import multi-sheet Excel workbooks and bank statements with inline row editing.
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  Upload any Excel (.xlsx, .xls) workbook or CSV bank statement. Switch worksheets on the fly, map custom columns or use fallback dates, edit any row inline, detect duplicates, and export your full ledger to CSV or JSON anytime.
                </p>
              </div>
              <div className="shrink-0">
                <button
                  type="button"
                  onClick={onLaunchApp}
                  className="bg-slate-900 dark:bg-emerald-500 text-white dark:text-slate-950 font-bold text-xs px-5 py-3 rounded-xl flex items-center gap-2 transition-all hover:opacity-90 cursor-pointer whitespace-nowrap shrink-0"
                >
                  <span>Import Excel / CSV in OS</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

          </div>
        </section>

        {/* ========================================================
            GOAL MILESTONE PLANNER
            Directly mirrors the in-app GoalsView module
           ======================================================== */}
        <section id="goals-planner" className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 mb-24">
          <div className="p-8 sm:p-10 rounded-3xl bg-slate-900 text-white shadow-2xl relative overflow-hidden border border-slate-800">
            
            <div className="relative z-10">
              <div className="max-w-2xl mb-8">
                <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider block mb-2">
                  In-App Feature Preview
                </span>
                <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                  Simulate your savings goals & milestones.
                </h2>
                <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                  Priyora includes a dedicated <strong>Goals & Milestones</strong> tracker. Test how long it will take to fund your emergency fund, vacation, or down payment:
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
                
                {/* Inputs Column */}
                <div className="lg:col-span-7 space-y-6">
                  
                  {/* Target Amount */}
                  <div>
                    <div className="flex justify-between text-xs font-medium text-slate-300 mb-2">
                      <span>Target Goal Amount</span>
                      <span className="text-emerald-400 font-bold tabular-nums">${goalTargetAmount.toLocaleString()}</span>
                    </div>
                    <input
                      type="range"
                      min={1000}
                      max={100000}
                      step={1000}
                      value={goalTargetAmount}
                      onChange={(e) => setGoalTargetAmount(Number(e.target.value))}
                      className="w-full accent-emerald-500 cursor-pointer"
                    />
                  </div>

                  {/* Current Saved */}
                  <div>
                    <div className="flex justify-between text-xs font-medium text-slate-300 mb-2">
                      <span>Currently Saved</span>
                      <span className="text-emerald-400 font-bold tabular-nums">${goalCurrentSaved.toLocaleString()}</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={goalTargetAmount}
                      step={500}
                      value={goalCurrentSaved}
                      onChange={(e) => setGoalCurrentSaved(Number(e.target.value))}
                      className="w-full accent-emerald-500 cursor-pointer"
                    />
                  </div>

                  {/* Monthly Contribution */}
                  <div>
                    <div className="flex justify-between text-xs font-medium text-slate-300 mb-2">
                      <span>Monthly Contribution</span>
                      <span className="text-emerald-400 font-bold tabular-nums">${goalMonthlySavings.toLocaleString()} / mo</span>
                    </div>
                    <input
                      type="range"
                      min={50}
                      max={5000}
                      step={50}
                      value={goalMonthlySavings}
                      onChange={(e) => setGoalMonthlySavings(Number(e.target.value))}
                      className="w-full accent-emerald-500 cursor-pointer"
                    />
                  </div>

                </div>

                {/* Output Milestone Card */}
                <div className="lg:col-span-5 p-6 rounded-2xl bg-slate-950/80 border border-slate-800 flex flex-col justify-between">
                  <div>
                    <span className="text-xs text-slate-400 uppercase tracking-wider block mb-1">
                      Time to Reach Target
                    </span>
                    <span className="text-3xl sm:text-4xl font-black text-emerald-400 tabular-nums block mb-4">
                      {monthsToGoal} Months
                    </span>

                    {/* Progress Bar */}
                    <div className="mb-4">
                      <div className="flex justify-between text-xs text-slate-400 mb-1">
                        <span>Current Progress</span>
                        <span className="font-bold text-white tabular-nums">{progressPercent}%</span>
                      </div>
                      <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                          style={{ width: `${progressPercent}%` }}
                        />
                      </div>
                    </div>

                    <div className="space-y-2 text-xs border-t border-slate-800 pt-3">
                      <div className="flex justify-between text-slate-300">
                        <span>Remaining Amount:</span>
                        <span className="font-semibold tabular-nums">${remainingNeeded.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-slate-300">
                        <span>Estimated Date:</span>
                        <span className="font-semibold text-emerald-400">
                          {new Date(Date.now() + monthsToGoal * 30.5 * 24 * 60 * 60 * 1000).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}
                        </span>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={onLaunchApp}
                    className="mt-6 w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs py-3 rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-md shadow-emerald-500/20 active:scale-95"
                  >
                    <span>Track This In Priyora Goals</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>

              </div>
            </div>

          </div>
        </section>

        {/* ========================================================
            DATA SOVEREIGNTY & STORAGE ARCHITECTURE
           ======================================================== */}
        <section id="privacy" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-24">
          <div className="p-8 sm:p-12 rounded-3xl bg-white/70 dark:bg-slate-900/70 border border-slate-200/80 dark:border-slate-800/80">
            <div className="max-w-2xl mb-10">
              <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block mb-2">
                Storage & Data Sovereignty
              </span>
              <h2 className="text-2xl sm:text-4xl font-bold text-slate-900 dark:text-white tracking-tight">
                Your financial data remains strictly yours.
              </h2>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-2 leading-relaxed">
                Priyora is built with clear privacy boundaries. No third-party ad networks, no data brokers, and zero vendor lock-in.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              <div className="p-5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/50">
                <Database className="w-5 h-5 text-emerald-500 mb-3" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1.5">
                  1-Click CSV & JSON Export
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  Download all your transactions, accounts, and categories anytime via the Data Hub. Import your own CSVs to migrate past records.
                </p>
              </div>

              <div className="p-5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/50">
                <Lock className="w-5 h-5 text-emerald-500 mb-3" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1.5">
                  Local-First SQLite Engine
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  Powered by `sql.js` for instant in-browser response times and client-side execution without external server lag.
                </p>
              </div>

              <div className="p-5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/50">
                <ShieldCheck className="w-5 h-5 text-emerald-500 mb-3" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1.5">
                  Secure Cloud Sync
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  Optional Google Firebase Firestore synchronization strictly isolated to your authenticated account UID via audited security rules.
                </p>
              </div>

            </div>
          </div>
        </section>

        {/* ========================================================
            ACCESSIBLE FAQ ACCORDION (Data Privacy & Multi-Account Tracking)
           ======================================================== */}
        <section id="faq" className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 mb-24">
          <div className="text-center mb-8">
            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block mb-2">
              Transparency & Architecture
            </span>
            <h2 className="text-2xl sm:text-4xl font-bold text-slate-900 dark:text-white tracking-tight">
              Frequently Asked Questions
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mt-2.5 max-w-2xl mx-auto leading-relaxed">
              Direct answers on how PRYORA protects your financial privacy, isolates your ledger data, and tracks balances across all your accounts.
            </p>
          </div>

          {/* Interactive Topic Filter Bar (Segmented Controls) */}
          <div
            role="tablist"
            aria-label="Filter Frequently Asked Questions by topic"
            className="flex flex-wrap items-center justify-center gap-2 mb-8 p-1.5 rounded-2xl bg-slate-200/60 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800/80 w-fit mx-auto"
          >
            {[
              { id: 'all', label: 'All Questions', count: faqItems.length },
              {
                id: 'privacy',
                label: 'Data Privacy & Sovereignty',
                count: faqItems.filter((i) => i.category === 'privacy').length,
              },
              {
                id: 'multi-account',
                label: 'Multi-Account Tracking',
                count: faqItems.filter((i) => i.category === 'multi-account').length,
              },
              {
                id: 'workflows',
                label: 'Features & Workflows',
                count: faqItems.filter((i) => i.category === 'workflows').length,
              },
            ].map((tab) => {
              const isActive = activeFaqCategory === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => {
                    const nextCategory = tab.id as 'all' | 'privacy' | 'multi-account' | 'workflows';
                    setActiveFaqCategory(nextCategory);
                    const firstMatching = faqItems.find(
                      (item) => nextCategory === 'all' || item.category === nextCategory
                    );
                    if (firstMatching) {
                      setExpandedFaq(firstMatching.id);
                    }
                  }}
                  className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
                    isActive
                      ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold tabular-nums">
                    ({tab.count})
                  </span>
                </button>
              );
            })}
          </div>

          {/* Accordion List */}
          <div className="space-y-3">
            {visibleFaqItems.map((item) => {
              const isExpanded = expandedFaq === item.id;
              return (
                <div
                  key={item.id}
                  className={`rounded-2xl border transition-colors overflow-hidden ${
                    isExpanded
                      ? 'border-emerald-500/40 dark:border-emerald-500/40 bg-white dark:bg-slate-900 shadow-sm'
                      : 'border-slate-200/80 dark:border-slate-800/80 bg-white/70 dark:bg-slate-900/70 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setExpandedFaq(isExpanded ? null : item.id)}
                    className="w-full px-6 py-4 text-left flex items-start sm:items-center justify-between gap-4 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    aria-expanded={isExpanded}
                  >
                    <div className="space-y-1 pr-2">
                      <span className="block text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                        {item.categoryLabel}
                      </span>
                      <span className="block text-sm font-bold text-slate-900 dark:text-white leading-snug">
                        {item.q}
                      </span>
                    </div>
                    <ChevronDown
                      className={`w-4 h-4 text-slate-400 transition-transform duration-200 shrink-0 mt-1 sm:mt-0 ${
                        isExpanded ? 'rotate-180 text-emerald-500' : ''
                      }`}
                    />
                  </button>
                  {isExpanded && (
                    <div className="px-6 pb-5 pt-2 text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed border-t border-slate-100 dark:border-slate-800/60">
                      {item.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* ========================================================
            FINAL CONVERSION BLOCK
           ======================================================== */}
        <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 mb-20 text-center">
          <div className="p-10 sm:p-14 rounded-3xl bg-gradient-to-b from-slate-900 to-slate-950 text-white border border-slate-800 shadow-2xl relative overflow-hidden">
            <div className="max-w-2xl mx-auto relative z-10">
              <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight mb-4">
                Take control of your finances today.
              </h2>
              <p className="text-xs sm:text-sm text-slate-300 mb-8 leading-relaxed">
                Log transactions, stay within budget envelopes, and track your net worth with a clean, fast personal ledger.
              </p>
              
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={onLaunchApp}
                  className="w-full sm:w-auto bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm px-6 py-3.5 rounded-xl flex items-center justify-center gap-2 transition-all shadow-md shadow-emerald-500/20 active:scale-95"
                >
                  <span>{user ? 'Go to Priyora OS' : 'Get Started Free'}</span>
                  <ArrowRight className="w-4 h-4 stroke-[2.5]" />
                </button>

                <button
                  type="button"
                  onClick={handleQuickDemo}
                  disabled={demoStarting}
                  className="w-full sm:w-auto bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold text-sm px-6 py-3.5 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95"
                >
                  <Zap className="w-4 h-4 text-emerald-400" />
                  <span>{demoStarting ? 'Preparing...' : 'Explore Live Demo'}</span>
                </button>
              </div>
            </div>
          </div>
        </section>

      </main>

      {/* ========================================================
          FOOTER
         ======================================================== */}
      <footer className="border-t border-slate-200/80 dark:border-slate-800/80 bg-white/60 dark:bg-slate-950/60 py-10 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500 dark:text-slate-400">
          
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-md bg-emerald-500 text-slate-950 font-black text-[10px] flex items-center justify-center">
              P
            </div>
            <span className="font-bold text-slate-800 dark:text-slate-200">PRYORA</span>
            <span aria-hidden="true">·</span>
            <span>Personal Finance OS</span>
          </div>

          <div className="flex items-center gap-6">
            <a href="#features" className="hover:text-slate-900 dark:hover:text-white transition-colors">Features</a>
            <a href="#privacy" className="hover:text-slate-900 dark:hover:text-white transition-colors">Privacy</a>
            <a href="#goals-planner" className="hover:text-slate-900 dark:hover:text-white transition-colors">Goal Planner</a>
            <a href="#faq" className="hover:text-slate-900 dark:hover:text-white transition-colors">FAQ</a>
            <button
              type="button"
              onClick={onLaunchApp}
              className="text-emerald-600 dark:text-emerald-400 font-semibold hover:underline"
            >
              Launch OS
            </button>
          </div>

          <div>
            © 2026 Priyora. MIT Licensed.
          </div>
        </div>
      </footer>

    </div>
  );
};
