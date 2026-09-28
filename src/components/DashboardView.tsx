/**
 * PRYORA Core Expense Tracker & Dashboard View
 * 
 * Delivers the primary offering: Modern, simple, and useful expense tracking.
 * Features:
 * - Dedicated Quick Expense Logger right at the top for frictionless recording
 * - Spend indicators: Today's Spend, This Month's Expenses, Available Balance
 * - Clean recent expenses ledger with immediate edit and delete controls
 * - Zero dummy data - starts pristine and builds naturally with real purchases
 * - Optional add-on capabilities (Budgets, Subscriptions, Goals, Analytics) clearly separated
 */

import React, { useState } from 'react';
import { DashboardData, Account, Transaction } from '../types';
import { formatMinorUnits, SUPPORTED_CURRENCIES } from '../lib/currency';
import { useAuth } from '../context/AuthContext';
import { CategoryIcon, AccountIcon } from './common/Icon';
import { ConfirmDialog } from './common/ConfirmDialog';
import { apiRequest } from '../lib/api';
import {
  TrendingDown,
  TrendingUp,
  Wallet,
  Calendar,
  CreditCard,
  Target,
  ArrowRight,
  Plus,
  Trash2,
  Edit2,
  Sparkles,
  Zap,
  CheckCircle2,
  PieChart,
  CalendarClock,
  BarChart3,
  Receipt,
  Layers,
  Activity,
} from 'lucide-react';

interface DashboardViewProps {
  data: DashboardData | null;
  onRefresh: () => void;
  onOpenTransactionModal: (initial?: Partial<Transaction>) => void;
  onNavigateTab: (tab: any) => void;
  onViewReceipt: (txId: string, merchant: string) => void;
}

interface DailyExpenseSparklineCardProps {
  weeklySpending?: any;
  recentTransactions: Transaction[];
  currency: string;
  currencySymbol: string;
  todaysSpendMinor: number;
  onOpenTransactionModal: (initial?: Partial<Transaction>) => void;
}

const DailyExpenseSparklineCard: React.FC<DailyExpenseSparklineCardProps> = ({
  weeklySpending,
  recentTransactions,
  currency,
  currencySymbol,
  todaysSpendMinor,
  onOpenTransactionModal,
}) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const now = new Date();
  const dayOfWeek = (now.getDay() + 6) % 7; // Mon = 0, Sun = 6
  const monday = new Date(now);
  monday.setDate(now.getDate() - dayOfWeek);
  const todayStr = now.toISOString().slice(0, 10);
  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const dayShorts = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

  // Fallback calculation if weeklySpending is not provided
  const fallbackDays: any[] = [];
  let fallbackTotal = 0;
  let peakAmt = 0;
  let peakDayName = 'Mon';

  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const dStr = d.toISOString().slice(0, 10);
    const amt = recentTransactions
      .filter(t => t.type === 'expense' && t.date === dStr)
      .reduce((sum, t) => sum + (t.amount_minor || 0), 0);

    fallbackTotal += amt;
    if (amt >= peakAmt) {
      peakAmt = amt;
      peakDayName = dayNames[i];
    }

    fallbackDays.push({
      date: dStr,
      day_name: dayNames[i],
      day_short: dayShorts[i],
      amount_minor: amt,
      is_today: dStr === todayStr,
    });
  }

  const effectiveWeekly = weeklySpending || {
    days: fallbackDays,
    total_minor: fallbackTotal,
    average_minor: Math.round(fallbackTotal / (dayOfWeek + 1 || 1)),
    peak_day: peakAmt > 0 ? peakDayName : dayNames[dayOfWeek],
    peak_amount_minor: peakAmt,
    change_vs_last_week_pct: null,
  };

  const days = effectiveWeekly.days;
  const maxSpend = Math.max(...days.map((d: any) => d.amount_minor), 100);
  const hasAnySpend = days.some((d: any) => d.amount_minor > 0);

  // SVG parameters
  const svgWidth = 600;
  const svgHeight = 120;
  const padX = 32;
  const padYTop = 24;
  const padYBottom = 26;
  const usableW = svgWidth - padX * 2;
  const usableH = svgHeight - padYTop - padYBottom;

  const points = days.map((d: any, i: number) => {
    const x = padX + (i / 6) * usableW;
    const y = hasAnySpend
      ? (svgHeight - padYBottom) - (d.amount_minor / maxSpend) * usableH
      : svgHeight - padYBottom - 8;
    return { x, y, day: d };
  });

  // Build smooth curve path
  let linePath = `M ${points[0].x},${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i === 0 ? 0 : i - 1];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] || p2;

    const cp1x = p1.x + (p2.x - p0.x) / 5;
    const cp1y = p1.y + (p2.y - p0.y) / 5;
    const cp2x = p2.x - (p3.x - p1.x) / 5;
    const cp2y = p2.y - (p3.y - p1.y) / 5;

    linePath += ` C ${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
  }

  const baselineY = svgHeight - padYBottom + 8;
  const areaPath = `${linePath} L ${points[points.length - 1].x},${baselineY} L ${points[0].x},${baselineY} Z`;

  const todayIndex = days.findIndex((d: any) => d.is_today);
  const activeIndex = hoveredIndex !== null ? hoveredIndex : (todayIndex >= 0 ? todayIndex : 0);
  const activePoint = points[activeIndex];
  const activeDay = days[activeIndex];

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-7 relative overflow-hidden">
      
      {/* Top Header & Stat Summary */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 shadow-2xs">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-900 tracking-tight">
                Daily Expense Trends
              </h3>
              <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200/60 uppercase tracking-wider">
                Current Week
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Mon – Sun daily expenditure tracking & spending velocity
            </p>
          </div>
        </div>

        {/* Highlight Metrics */}
        <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
          {/* Week Total */}
          <div className="px-3.5 py-1.5 rounded-2xl bg-slate-50 border border-slate-200/80">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Week Total
            </div>
            <div className="text-sm sm:text-base font-black text-slate-900 tracking-tight">
              {formatMinorUnits(effectiveWeekly.total_minor, currency)}
            </div>
          </div>

          {/* Daily Average */}
          <div className="px-3.5 py-1.5 rounded-2xl bg-slate-50 border border-slate-200/80">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Daily Avg
            </div>
            <div className="text-sm sm:text-base font-black text-slate-700 tracking-tight">
              {formatMinorUnits(effectiveWeekly.average_minor, currency)}
            </div>
          </div>

          {/* Peak Day */}
          <div className="hidden sm:block px-3.5 py-1.5 rounded-2xl bg-slate-50 border border-slate-200/80">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Peak Day
            </div>
            <div className="text-xs sm:text-sm font-bold text-rose-600 tracking-tight">
              {effectiveWeekly.peak_day} ({formatMinorUnits(effectiveWeekly.peak_amount_minor, currency)})
            </div>
          </div>

          {/* Optional Comparison Pill */}
          {effectiveWeekly.change_vs_last_week_pct !== null && (
            <div className={`px-2.5 py-1 rounded-xl text-xs font-bold ${
              effectiveWeekly.change_vs_last_week_pct > 0
                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
            }`}>
              {effectiveWeekly.change_vs_last_week_pct > 0 ? '+' : ''}
              {effectiveWeekly.change_vs_last_week_pct}% vs last wk
            </div>
          )}
        </div>
      </div>

      {/* Sparkline Chart Canvas */}
      <div className="relative w-full bg-slate-50/60 rounded-2xl p-3 border border-slate-100">
        
        {/* Floating Active Point Tooltip */}
        {activePoint && activeDay && (
          <div
            className="absolute z-10 -top-1 pointer-events-none transition-all duration-150 transform -translate-x-1/2 -translate-y-full"
            style={{
              left: `${Math.max(10, Math.min(90, (activePoint.x / svgWidth) * 100))}%`,
            }}
          >
            <div className="bg-slate-900 text-white text-[11px] font-bold px-2.5 py-1 rounded-xl shadow-lg border border-slate-800 flex items-center gap-1.5 whitespace-nowrap">
              <span className="text-slate-400">{activeDay.day_name}:</span>
              <span className="text-rose-400 font-extrabold">{formatMinorUnits(activeDay.amount_minor, currency)}</span>
              {activeDay.is_today && (
                <span className="bg-rose-500 text-white text-[9px] px-1 py-0.2 rounded font-black uppercase">
                  Today
                </span>
              )}
            </div>
            {/* Tooltip Arrow */}
            <div className="w-2 h-2 bg-slate-900 rotate-45 mx-auto -mt-1" />
          </div>
        )}

        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full h-28 sm:h-32 overflow-visible select-none"
        >
          <defs>
            <linearGradient id="sparkline_gradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#F43F5E" stopOpacity="0.25" />
              <stop offset="70%" stopColor="#F43F5E" stopOpacity="0.05" />
              <stop offset="100%" stopColor="#F43F5E" stopOpacity="0.0" />
            </linearGradient>

            <linearGradient id="sparkline_stroke" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#FB7185" />
              <stop offset="50%" stopColor="#F43F5E" />
              <stop offset="100%" stopColor="#E11D48" />
            </linearGradient>
          </defs>

          {/* Reference baseline grid lines */}
          <line
            x1={padX}
            y1={padYTop + usableH * 0.25}
            x2={svgWidth - padX}
            y2={padYTop + usableH * 0.25}
            stroke="#E2E8F0"
            strokeDasharray="3 3"
            strokeWidth="0.8"
          />
          <line
            x1={padX}
            y1={padYTop + usableH * 0.65}
            x2={svgWidth - padX}
            y2={padYTop + usableH * 0.65}
            stroke="#E2E8F0"
            strokeDasharray="3 3"
            strokeWidth="0.8"
          />
          <line
            x1={padX}
            y1={baselineY}
            x2={svgWidth - padX}
            y2={baselineY}
            stroke="#CBD5E1"
            strokeWidth="1.2"
          />

          {/* Sparkline Area Fill */}
          <path
            d={areaPath}
            fill="url(#sparkline_gradient)"
            className="transition-all duration-300"
          />

          {/* Sparkline Main Trend Line */}
          <path
            d={linePath}
            fill="none"
            stroke="url(#sparkline_stroke)"
            strokeWidth="2.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="transition-all duration-300"
          />

          {/* Active Guide Vertical Line */}
          {activePoint && (
            <line
              x1={activePoint.x}
              y1={padYTop - 4}
              x2={activePoint.x}
              y2={baselineY}
              stroke="#F43F5E"
              strokeDasharray="3 3"
              strokeWidth="1.5"
              className="transition-all duration-150"
            />
          )}

          {/* Data Points */}
          {points.map((pt, i) => {
            const isHovered = i === activeIndex;
            const isToday = pt.day.is_today;
            return (
              <g
                key={i}
                className="cursor-pointer"
                onMouseEnter={() => setHoveredIndex(i)}
                onClick={() => setHoveredIndex(i)}
              >
                {/* Invisible larger hover hit area */}
                <rect
                  x={pt.x - usableW / 12}
                  y={0}
                  width={usableW / 6}
                  height={svgHeight}
                  fill="transparent"
                />

                {/* Point Halo */}
                {isHovered && (
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r="9"
                    fill="#F43F5E"
                    fillOpacity="0.2"
                    className="animate-pulse"
                  />
                )}

                {/* Main Dot */}
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r={isHovered ? 5.5 : isToday ? 4.5 : 3}
                  fill={isHovered ? '#F43F5E' : isToday ? '#E11D48' : '#FFFFFF'}
                  stroke={isHovered || isToday ? '#FFFFFF' : '#F43F5E'}
                  strokeWidth={isHovered ? 2.5 : 2}
                  className="transition-all duration-150"
                />
              </g>
            );
          })}
        </svg>

        {/* Empty state overlay message if zero spend this week */}
        {!hasAnySpend && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none bg-white/40 backdrop-blur-2xs rounded-2xl">
            <div className="text-center px-4">
              <span className="text-xs font-semibold text-slate-500">
                No expenses logged for this week yet. Track a daily expense to activate your trendline.
              </span>
            </div>
          </div>
        )}
      </div>

      {/* 7 Daily Chips Row below the Sparkline */}
      <div className="grid grid-cols-7 gap-1.5 sm:gap-2 pt-3.5">
        {days.map((d: any, i: number) => {
          const isSelected = i === activeIndex;
          const isToday = d.is_today;
          const barPct = maxSpend > 0 ? Math.min(100, Math.round((d.amount_minor / maxSpend) * 100)) : 0;

          return (
            <button
              key={d.date}
              type="button"
              onMouseEnter={() => setHoveredIndex(i)}
              onClick={() => setHoveredIndex(i)}
              className={`p-2 rounded-2xl text-center transition-all ${
                isSelected
                  ? 'bg-rose-50 border border-rose-300 ring-2 ring-rose-500/20 shadow-xs'
                  : isToday
                  ? 'bg-slate-100/90 border border-slate-300 font-semibold'
                  : 'bg-slate-50 hover:bg-slate-100 border border-slate-100'
              }`}
            >
              <div className="flex items-center justify-center gap-1">
                <span className="text-[11px] font-bold text-slate-600">
                  {d.day_name}
                </span>
                {isToday && (
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500" title="Today" />
                )}
              </div>

              <div className="text-[11px] font-extrabold text-slate-900 mt-1 truncate">
                {d.amount_minor > 0 ? (
                  formatMinorUnits(d.amount_minor, currency)
                ) : (
                  <span className="text-slate-400 font-normal">{currencySymbol}0</span>
                )}
              </div>

              {/* Mini proportion bar */}
              <div className="w-full bg-slate-200/80 h-1 rounded-full overflow-hidden mt-1.5">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    isToday ? 'bg-rose-600' : 'bg-rose-400'
                  }`}
                  style={{ width: `${d.amount_minor > 0 ? Math.max(12, barPct) : 0}%` }}
                />
              </div>
            </button>
          );
        })}
      </div>

      {/* Goal Emphasizing Motivation Banner */}
      <div className="mt-4 pt-3.5 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 text-slate-600">
          <Zap className="w-4 h-4 text-amber-500 shrink-0" />
          <span>
            {todaysSpendMinor === 0 ? (
              <>
                No spending logged for today ({todayStr}) yet. Log your morning or evening purchases to stay accurate.
              </>
            ) : (
              <>
                You've recorded <strong className="text-slate-900 font-bold">{formatMinorUnits(todaysSpendMinor, currency)}</strong> today. Weekly pace is <strong className="text-slate-900 font-bold">{formatMinorUnits(effectiveWeekly.average_minor, currency)}</strong>/day.
              </>
            )}
          </span>
        </div>

        {todaysSpendMinor === 0 && (
          <button
            type="button"
            onClick={() => onOpenTransactionModal({ type: 'expense', date: todayStr })}
            className="text-xs font-bold text-rose-600 hover:text-rose-700 inline-flex items-center gap-1 self-start sm:self-auto hover:underline"
          >
            <span>+ Log Today's Expense</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

    </div>
  );
};

export const DashboardView: React.FC<DashboardViewProps> = ({
  data,
  onRefresh,
  onOpenTransactionModal,
  onNavigateTab,
  onViewReceipt,
}) => {
  const { user } = useAuth();
  const currency = user?.currency || 'INR';
  const currencySymbol = SUPPORTED_CURRENCIES.find(c => c.code === currency)?.symbol || '₹';

  // Quick Expense Logger State
  const [quickAmount, setQuickAmount] = useState<string>('');
  const [quickMerchant, setQuickMerchant] = useState<string>('');
  const [quickCategory, setQuickCategory] = useState<string>('');
  const [quickAccount, setQuickAccount] = useState<string>('');
  const [quickDate, setQuickDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [isLogging, setIsLogging] = useState<boolean>(false);
  const [quickFeedback, setQuickFeedback] = useState<string | null>(null);
  const [quickError, setQuickError] = useState<string | null>(null);

  // Transaction deletion confirmation state (iframe-safe, called unconditionally at top level)
  const [txToDelete, setTxToDelete] = useState<{ id: string; merchant: string } | null>(null);
  const [isDeletingTx, setIsDeletingTx] = useState<boolean>(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const confirmDeleteTransaction = async () => {
    if (!txToDelete) return;
    setIsDeletingTx(true);
    setDeleteError(null);
    try {
      await apiRequest(`/api/transactions/${txToDelete.id}`, { method: 'DELETE' });
      setTxToDelete(null);
      onRefresh();
    } catch (err: any) {
      setDeleteError(err.message || 'Could not delete transaction. Please try again.');
    } finally {
      setIsDeletingTx(false);
    }
  };

  if (!data) {
    return (
      <div className="p-12 text-center text-slate-500 text-sm">
        Loading expense tracker...
      </div>
    );
  }

  const { summary, accounts, recent_transactions, budgets, goals, upcoming_obligations, weekly_spending } = data;

  // Filter only expense transactions for the tracker spotlight
  const expenseTransactions = recent_transactions.filter(t => t.type === 'expense');

  // Compute Today's Spend from recent transactions
  const todayStr = new Date().toISOString().slice(0, 10);
  const todaysSpendMinor = recent_transactions
    .filter(t => t.type === 'expense' && t.date === todayStr)
    .reduce((sum, t) => sum + (t.amount_minor || 0), 0);

  // Selected or default account
  const defaultAccountId = quickAccount || (accounts.length > 0 ? accounts[0].id : '');

  // Popular quick category chips
  const quickCategories = [
    { name: 'Food & Dining', icon: 'Utensils' },
    { name: 'Groceries & Supplies', icon: 'ShoppingBag' },
    { name: 'Transportation', icon: 'Car' },
    { name: 'Utilities & Bills', icon: 'Zap' },
    { name: 'Shopping & Essentials', icon: 'ShoppingBag' },
    { name: 'Entertainment & Leisure', icon: 'Film' },
    { name: 'Health & Medical', icon: 'HeartPulse' },
    { name: 'Other Expense', icon: 'MoreHorizontal' },
  ];

  const handleQuickLogExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    const amtNum = parseFloat(quickAmount);
    if (!amtNum || amtNum <= 0) {
      setQuickError('Please enter a valid expense amount.');
      return;
    }

    if (!quickMerchant.trim()) {
      setQuickError('Please enter where or what you spent on (payee / merchant).');
      return;
    }

    if (!defaultAccountId) {
      setQuickError('Please select a payment account.');
      return;
    }

    setIsLogging(true);
    setQuickError(null);
    setQuickFeedback(null);

    try {
      await apiRequest('/api/transactions', {
        method: 'POST',
        body: JSON.stringify({
          type: 'expense',
          amount: amtNum,
          merchant: quickMerchant.trim(),
          accountId: defaultAccountId,
          categoryId: quickCategory || null,
          date: quickDate || todayStr,
        }),
      });

      // Clear input fields
      setQuickAmount('');
      setQuickMerchant('');
      setQuickFeedback(`Recorded ${currencySymbol}${amtNum.toFixed(2)} for ${quickMerchant.trim()}!`);
      setTimeout(() => setQuickFeedback(null), 4000);

      onRefresh();
    } catch (err: any) {
      setQuickError(err.message || 'Failed to record expense. Please try again.');
    } finally {
      setIsLogging(false);
    }
  };

  return (
    <div className="space-y-6 pb-16">

      {/* Hero: Quick Expense Tracker Widget */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-7 relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-rose-500 text-white flex items-center justify-center shadow-md shadow-rose-500/20">
              <Zap className="w-5 h-5 fill-current" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                Quick Log Expense
              </h2>
              <p className="text-xs text-slate-500">
                Instantly track your daily spending in seconds.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onOpenTransactionModal({ type: 'income' })}
              className="text-xs font-semibold text-slate-600 hover:text-emerald-600 bg-slate-50 hover:bg-emerald-50 border border-slate-200 px-3 py-1.5 rounded-xl transition-colors flex items-center gap-1.5"
            >
              <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
              <span>Record Income</span>
            </button>
            <button
              type="button"
              onClick={() => onOpenTransactionModal({ type: 'expense' })}
              className="text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-xl transition-colors flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Detailed Entry / Split</span>
            </button>
          </div>
        </div>

        {/* Feedback Notices */}
        {quickFeedback && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{quickFeedback}</span>
          </div>
        )}

        {quickError && (
          <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2 animate-in fade-in">
            <span>{quickError}</span>
          </div>
        )}

        {/* Quick Log Form */}
        <form onSubmit={handleQuickLogExpense} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3">
            
            {/* Amount Input */}
            <div className="lg:col-span-3">
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Amount ({currencySymbol})
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-extrabold text-base">
                  {currencySymbol}
                </span>
                <input
                  id="input_quick_amount"
                  type="number"
                  step="any"
                  placeholder="0.00"
                  required
                  value={quickAmount}
                  onChange={e => setQuickAmount(e.target.value)}
                  className="w-full pl-8 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-base font-black text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                />
              </div>
            </div>

            {/* Merchant / Description */}
            <div className="lg:col-span-4">
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                What / Where?
              </label>
              <input
                id="input_quick_merchant"
                type="text"
                placeholder="e.g. Starbucks, Groceries, Uber, Dinner"
                required
                value={quickMerchant}
                onChange={e => setQuickMerchant(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
              />
            </div>

            {/* Payment Account */}
            <div className="lg:col-span-3">
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Paid From
              </label>
              <select
                id="select_quick_account"
                value={defaultAccountId}
                onChange={e => setQuickAccount(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
              >
                {accounts.length === 0 ? (
                  <option value="">No account (Cash Wallet will be used)</option>
                ) : (
                  accounts.map(acc => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} ({formatMinorUnits(acc.current_balance_minor, currency)})
                    </option>
                  ))
                )}
              </select>
            </div>

            {/* Date */}
            <div className="lg:col-span-2">
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Date
              </label>
              <input
                type="date"
                value={quickDate}
                onChange={e => setQuickDate(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
              />
            </div>

          </div>

          {/* Quick Category Chips */}
          <div className="pt-1">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Select Category (Optional)
              </span>
              {quickCategory && (
                <button
                  type="button"
                  onClick={() => setQuickCategory('')}
                  className="text-[10px] text-slate-400 hover:text-slate-700 underline"
                >
                  Clear Selection
                </button>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {quickCategories.map(cat => {
                const isSelected = quickCategory === cat.name;
                return (
                  <button
                    key={cat.name}
                    type="button"
                    onClick={() => setQuickCategory(isSelected ? '' : cat.name)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all flex items-center gap-1.5 ${
                      isSelected
                        ? 'bg-rose-500 text-white shadow-xs font-bold'
                        : 'bg-slate-100 hover:bg-slate-200/80 text-slate-700'
                    }`}
                  >
                    <span>{cat.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Submit Action */}
          <div className="flex justify-end pt-2">
            <button
              id="btn_submit_quick_expense"
              type="submit"
              disabled={isLogging}
              className="bg-rose-600 hover:bg-rose-500 active:scale-[0.99] text-white font-bold text-xs px-6 py-2.5 rounded-xl flex items-center gap-2 transition-all shadow-md shadow-rose-600/20 disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
              <span>{isLogging ? 'Logging Expense...' : 'Log Expense Now'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Daily Expense Summary Card with Weekly Sparkline */}
      <DailyExpenseSparklineCard
        weeklySpending={weekly_spending}
        recentTransactions={recent_transactions}
        currency={currency}
        currencySymbol={currencySymbol}
        todaysSpendMinor={todaysSpendMinor}
        onOpenTransactionModal={onOpenTransactionModal}
      />

      {/* Spend Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Today's Spend */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Today's Spend</span>
            <Calendar className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-2xl font-black text-rose-600 tracking-tight">
            {formatMinorUnits(todaysSpendMinor, currency)}
          </div>
          <div className="text-[11px] text-slate-400 mt-2.5 pt-2 border-t border-slate-100">
            Recorded for today ({todayStr})
          </div>
        </div>

        {/* This Month's Expenses */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">This Month's Total</span>
            <TrendingDown className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-2xl font-black text-slate-900 tracking-tight">
            {formatMinorUnits(summary.expenses_minor, currency)}
          </div>
          <div className="text-[11px] text-slate-400 mt-2.5 pt-2 border-t border-slate-100">
            Last Month: {formatMinorUnits(summary.prev_month_expenses_minor, currency)}
          </div>
        </div>

        {/* Available Spending Balance (Assets) */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Available Balance</span>
            <Wallet className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-black text-emerald-600 tracking-tight">
            {formatMinorUnits(summary.total_assets_minor, currency)}
          </div>
          <div className="text-[11px] text-slate-400 mt-2.5 pt-2 border-t border-slate-100">
            Across {accounts.length} active account(s)
          </div>
        </div>

        {/* Monthly Income / Inflow */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Month's Income</span>
            <TrendingUp className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-black text-slate-900 tracking-tight">
            {formatMinorUnits(summary.income_minor, currency)}
          </div>
          <div className="text-[11px] text-slate-400 mt-2.5 pt-2 border-t border-slate-100">
            Net Cash Flow: <strong className={summary.net_cash_flow_minor >= 0 ? 'text-slate-800' : 'text-rose-600'}>
              {formatMinorUnits(summary.net_cash_flow_minor, currency)}
            </strong>
          </div>
        </div>

      </div>

      {/* Recent Expenses Ledger & Accounts Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left 2 Cols: Recent Expenses List */}
        <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-5 flex items-center justify-between border-b border-slate-100">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-rose-500" />
              <h3 className="text-sm font-bold text-slate-900">Recent Expenses</h3>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab('transactions')}
              className="text-xs font-semibold text-slate-600 hover:text-slate-900 flex items-center gap-1"
            >
              <span>View Full Ledger</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {deleteError && (
            <div className="p-3 bg-rose-50 border-b border-rose-100 text-rose-700 text-xs font-medium flex items-center justify-between">
              <span>{deleteError}</span>
              <button type="button" onClick={() => setDeleteError(null)} className="text-rose-600 hover:text-rose-800 font-bold ml-2">
                ✕
              </button>
            </div>
          )}

          {recent_transactions.length === 0 ? (
            /* Clean Pristine Empty State */
            <div className="p-12 text-center text-slate-500 space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
                <Sparkles className="w-6 h-6 text-amber-500" />
              </div>
              <h4 className="text-sm font-bold text-slate-800">No expenses recorded yet</h4>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Your expense tracker is clean and ready. Use the quick logger at the top to record your first expense.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {recent_transactions.map(tx => (
                <div key={tx.id} className="p-4 flex items-center justify-between hover:bg-slate-50/60 transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                      tx.type === 'income'
                        ? 'bg-emerald-100 text-emerald-700'
                        : tx.type === 'transfer'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-rose-100 text-rose-700'
                    }`}>
                      {tx.type === 'income' ? (
                        <TrendingUp className="w-4 h-4" />
                      ) : (
                        <TrendingDown className="w-4 h-4" />
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-900 truncate">{tx.merchant}</div>
                      <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                        <span>{tx.date}</span>
                        <span>•</span>
                        <span className="truncate">{tx.category_name || (tx.type === 'income' ? 'Income' : 'General Expense')}</span>
                        <span>•</span>
                        <span className="truncate">{tx.account_name}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0 ml-3">
                    <div className={`text-xs font-black ${
                      tx.type === 'income' ? 'text-emerald-700' : 'text-slate-900'
                    }`}>
                      {tx.type === 'income' ? '+' : '-'}
                      {formatMinorUnits(tx.amount_minor, currency)}
                    </div>

                    <div className="flex items-center gap-1 text-slate-300">
                      <button
                        type="button"
                        onClick={() => {
                          setDeleteError(null);
                          setTxToDelete({ id: tx.id, merchant: tx.merchant });
                        }}
                        className="p-1 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                        title="Delete expense"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Col: Your Accounts Quick View */}
        <div className="space-y-6">
          <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-slate-500" />
                <h3 className="text-sm font-bold text-slate-900">Payment Accounts</h3>
              </div>
              <button
                type="button"
                onClick={() => onNavigateTab('accounts')}
                className="text-xs font-semibold text-slate-600 hover:text-slate-900 flex items-center gap-1"
              >
                <span>Manage</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-2.5">
              {accounts.map(acc => (
                <div
                  key={acc.id}
                  className="p-3 rounded-2xl border border-slate-100 bg-slate-50/50 flex items-center justify-between"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-700 shadow-2xs">
                      <AccountIcon name={acc.icon} className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 truncate max-w-[120px]">{acc.name}</h4>
                      <span className="text-[10px] text-slate-400 capitalize">{acc.type.replace('_', ' ')}</span>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-xs font-bold text-slate-900">
                      {formatMinorUnits(acc.current_balance_minor, currency)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>

      {/* Add-Ons Section (Clearly labeled and distinct from core expense tracking) */}
      <div className="pt-6 border-t border-slate-200/80">
        <div className="flex items-center gap-2 mb-4">
          <Layers className="w-4 h-4 text-slate-400" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Add-On Features & Extended Financial Tools
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* Budgets Add-on */}
          <div
            onClick={() => onNavigateTab('budgets')}
            className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs hover:border-slate-300 hover:shadow-xs transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <PieChart className="w-4 h-4" />
              </div>
              <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
                {budgets.length} Active
              </span>
            </div>
            <h4 className="text-xs font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
              Category Budgets
            </h4>
            <p className="text-[11px] text-slate-400 mt-1">
              Set monthly spending targets and get pace warnings.
            </p>
          </div>

          {/* Subscriptions Add-on */}
          <div
            onClick={() => onNavigateTab('subscriptions')}
            className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs hover:border-slate-300 hover:shadow-xs transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <CalendarClock className="w-4 h-4" />
              </div>
              <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                {upcoming_obligations.length} Due Soon
              </span>
            </div>
            <h4 className="text-xs font-bold text-slate-900 group-hover:text-amber-600 transition-colors">
              Subscriptions & Bills
            </h4>
            <p className="text-[11px] text-slate-400 mt-1">
              Track recurring bills, renewal dates, and cadences.
            </p>
          </div>

          {/* Goals Add-on */}
          <div
            onClick={() => onNavigateTab('goals')}
            className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs hover:border-slate-300 hover:shadow-xs transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <Target className="w-4 h-4" />
              </div>
              <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                {goals.length} Goals
              </span>
            </div>
            <h4 className="text-xs font-bold text-slate-900 group-hover:text-emerald-600 transition-colors">
              Financial Goals
            </h4>
            <p className="text-[11px] text-slate-400 mt-1">
              Create milestone targets for savings or major purchases.
            </p>
          </div>

          {/* Analytics Add-on */}
          <div
            onClick={() => onNavigateTab('analytics')}
            className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs hover:border-slate-300 hover:shadow-xs transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <BarChart3 className="w-4 h-4" />
              </div>
              <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                Reports
              </span>
            </div>
            <h4 className="text-xs font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
              Spending Analytics
            </h4>
            <p className="text-[11px] text-slate-400 mt-1">
              Category distribution charts and historical comparisons.
            </p>
          </div>

        </div>
      </div>

      {/* Confirmation Dialog for Transaction Deletion (Iframe-safe, replaces window.confirm) */}
      <ConfirmDialog
        isOpen={!!txToDelete}
        title="Delete Expense"
        message={`Are you sure you want to delete the expense "${txToDelete?.merchant}"? Account balances will automatically recalculate.`}
        confirmLabel="Delete Expense"
        isLoading={isDeletingTx}
        onConfirm={confirmDeleteTransaction}
        onCancel={() => {
          if (!isDeletingTx) setTxToDelete(null);
        }}
      />

    </div>
  );
};
