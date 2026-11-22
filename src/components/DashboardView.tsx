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
    <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-2xl border border-slate-200/80 dark:border-white/10 shadow-xs dark:shadow-slate-950/40 p-5 sm:p-6 relative overflow-hidden transition-colors">
      
      {/* Top Header & Stat Summary */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-5">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900/40 flex items-center justify-center text-rose-600 dark:text-rose-400 shadow-2xs shrink-0">
            <Activity className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
                Daily Expense Trends
              </h3>
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap">
                · Current week
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Mon – Sun daily expenditure tracking & spending velocity
            </p>
          </div>
        </div>

        {/* Highlight Metrics — uniform height & baseline alignment */}
        <div className="grid grid-cols-3 sm:flex sm:items-stretch gap-2.5 flex-wrap shrink-0">
          {/* Week Total */}
          <div className="min-w-0 sm:min-w-[112px] px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700/60 flex flex-col justify-center">
            <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 leading-tight truncate">
              Week total
            </div>
            <div className="text-sm font-bold font-mono tabular-nums text-slate-900 dark:text-white tracking-tight leading-tight mt-1 truncate">
              {formatMinorUnits(effectiveWeekly.total_minor, currency)}
            </div>
          </div>

          {/* Daily Average */}
          <div className="min-w-0 sm:min-w-[112px] px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700/60 flex flex-col justify-center">
            <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 leading-tight truncate">
              Daily avg
            </div>
            <div className="text-sm font-bold font-mono tabular-nums text-slate-800 dark:text-slate-100 tracking-tight leading-tight mt-1 truncate">
              {formatMinorUnits(effectiveWeekly.average_minor, currency)}
            </div>
          </div>

          {/* Peak Day */}
          <div className="min-w-0 sm:min-w-[112px] px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700/60 flex flex-col justify-center">
            <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 leading-tight truncate">
              Peak day
            </div>
            <div className="text-sm font-bold font-mono tabular-nums text-rose-600 dark:text-rose-400 tracking-tight leading-tight mt-1 truncate">
              {effectiveWeekly.peak_amount_minor > 0
                ? `${effectiveWeekly.peak_day} (${formatMinorUnits(effectiveWeekly.peak_amount_minor, currency)})`
                : '—'}
            </div>
          </div>

          {/* Optional Comparison Indicator */}
          {effectiveWeekly.change_vs_last_week_pct !== null && (
            <div className={`col-span-3 sm:col-span-1 px-3 py-2 rounded-xl text-xs font-semibold tabular-nums flex items-center justify-center whitespace-nowrap ${
              effectiveWeekly.change_vs_last_week_pct > 0
                ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-900/40'
                : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/40'
            }`}>
              {effectiveWeekly.change_vs_last_week_pct > 0 ? '+' : ''}
              {effectiveWeekly.change_vs_last_week_pct}% vs last wk
            </div>
          )}
        </div>
      </div>

      {/* Sparkline Chart Canvas (or clean high-contrast empty state when no weekly spend yet) */}
      <div className="relative w-full bg-slate-50/90 dark:bg-slate-950/60 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-800">
        {!hasAnySpend ? (
          <div className="h-28 sm:h-32 flex flex-col items-center justify-center text-center px-4 gap-2">
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              No expenses logged for this week yet
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md">
              Use Quick Log above or record an expense to plot your Monday–Sunday spending trendline.
            </p>
          </div>
        ) : (
          <>
            {/* Floating Active Point Tooltip */}
            {activePoint && activeDay && (
              <div
                className="absolute z-10 top-2 pointer-events-none transition-all duration-150 transform -translate-x-1/2"
                style={{
                  left: `${Math.max(12, Math.min(88, (activePoint.x / svgWidth) * 100))}%`,
                }}
              >
                <div className="bg-slate-900 dark:bg-slate-800 text-white text-[11px] font-semibold px-2.5 py-1 rounded-lg shadow-md border border-slate-700 flex items-center gap-1.5 whitespace-nowrap">
                  <span className="text-slate-300">{activeDay.day_name}:</span>
                  <span className="text-rose-400 font-mono font-bold tabular-nums">
                    {formatMinorUnits(activeDay.amount_minor, currency)}
                  </span>
                  {activeDay.is_today && (
                    <span className="text-emerald-400 text-[10px] font-semibold">· Today</span>
                  )}
                </div>
              </div>
            )}

            <svg
              viewBox={`0 0 ${svgWidth} ${svgHeight}`}
              className="w-full h-28 sm:h-32 overflow-visible select-none mt-4 text-slate-200 dark:text-slate-800"
            >
              <defs>
                <linearGradient id="sparkline_gradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#F43F5E" stopOpacity="0.24" />
                  <stop offset="70%" stopColor="#F43F5E" stopOpacity="0.05" />
                  <stop offset="100%" stopColor="#F43F5E" stopOpacity="0.0" />
                </linearGradient>

                <linearGradient id="sparkline_stroke" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#FB7185" />
                  <stop offset="50%" stopColor="#F43F5E" />
                  <stop offset="100%" stopColor="#E11D48" />
                </linearGradient>
              </defs>

              {/* Theme-aware reference baseline grid lines */}
              <line
                x1={padX}
                y1={padYTop + usableH * 0.25}
                x2={svgWidth - padX}
                y2={padYTop + usableH * 0.25}
                stroke="currentColor"
                strokeDasharray="3 3"
                strokeWidth="1"
              />
              <line
                x1={padX}
                y1={padYTop + usableH * 0.65}
                x2={svgWidth - padX}
                y2={padYTop + usableH * 0.65}
                stroke="currentColor"
                strokeDasharray="3 3"
                strokeWidth="1"
              />
              <line
                x1={padX}
                y1={baselineY}
                x2={svgWidth - padX}
                y2={baselineY}
                stroke="currentColor"
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
                strokeWidth="2.5"
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
                  strokeOpacity="0.55"
                  strokeDasharray="3 3"
                  strokeWidth="1.25"
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
                    <rect
                      x={pt.x - usableW / 12}
                      y={0}
                      width={usableW / 6}
                      height={svgHeight}
                      fill="transparent"
                    />
                    {isHovered && (
                      <circle
                        cx={pt.x}
                        cy={pt.y}
                        r="8"
                        fill="#F43F5E"
                        fillOpacity="0.2"
                      />
                    )}
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r={isHovered ? 5 : isToday ? 4 : 3}
                      fill={isHovered || isToday ? '#F43F5E' : '#0F172A'}
                      stroke={isHovered || isToday ? '#FFFFFF' : '#F43F5E'}
                      strokeWidth={2}
                      className="transition-all duration-150"
                    />
                  </g>
                );
              })}
            </svg>
          </>
        )}
      </div>

      {/* 7 Daily Chips Row below the Sparkline */}
      <div className="grid grid-cols-7 gap-1.5 sm:gap-2 mt-4">
        {days.map((d: any, i: number) => {
          const isSelected = hasAnySpend && i === activeIndex;
          const isToday = d.is_today;
          const barPct = maxSpend > 0 ? Math.min(100, Math.round((d.amount_minor / maxSpend) * 100)) : 0;

          return (
            <button
              key={d.date}
              type="button"
              onMouseEnter={() => setHoveredIndex(i)}
              onClick={() => setHoveredIndex(i)}
              className={`min-w-0 px-1.5 sm:px-2.5 py-2 rounded-xl flex flex-col items-center justify-between text-center transition-colors ${
                isSelected
                  ? 'bg-rose-50 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-800'
                  : isToday
                  ? 'bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-600'
                  : 'bg-slate-50 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200/70 dark:border-slate-800'
              }`}
            >
              <span className={`text-[11px] font-semibold leading-tight ${isToday ? 'text-slate-950 dark:text-white' : 'text-slate-600 dark:text-slate-300'}`}>
                {d.day_name}
              </span>

              <div className="w-full text-[11px] font-mono tabular-nums font-bold text-slate-900 dark:text-white mt-1 truncate">
                {d.amount_minor > 0 ? (
                  formatMinorUnits(d.amount_minor, currency)
                ) : (
                  <span className="text-slate-400 dark:text-slate-500 font-normal">{currencySymbol}0</span>
                )}
              </div>

              {/* Mini proportion bar */}
              <div className="w-full bg-slate-200/80 dark:bg-slate-700/70 h-1 rounded-full overflow-hidden mt-1.5">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    isToday ? 'bg-rose-500' : 'bg-rose-400 dark:bg-rose-500/80'
                  }`}
                  style={{ width: `${d.amount_minor > 0 ? Math.max(12, barPct) : 0}%` }}
                />
              </div>
            </button>
          );
        })}
      </div>

      {/* Goal Emphasizing Motivation Banner */}
      <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-start sm:items-center gap-2 text-slate-600 dark:text-slate-300 min-w-0">
          <Zap className="w-4 h-4 text-amber-500 shrink-0 mt-0.5 sm:mt-0" />
          <span className="leading-relaxed">
            {todaysSpendMinor === 0 ? (
              <>
                No spending logged for today ({todayStr}) yet. Log your morning or evening purchases to stay accurate.
              </>
            ) : (
              <>
                You've recorded <strong className="text-slate-900 dark:text-white font-bold font-mono tabular-nums">{formatMinorUnits(todaysSpendMinor, currency)}</strong> today. Weekly pace is <strong className="text-slate-900 dark:text-white font-bold font-mono tabular-nums">{formatMinorUnits(effectiveWeekly.average_minor, currency)}</strong>/day.
              </>
            )}
          </span>
        </div>

        {todaysSpendMinor === 0 && (
          <button
            type="button"
            onClick={() => onOpenTransactionModal({ type: 'expense', date: todayStr })}
            className="text-xs font-bold text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 inline-flex items-center gap-1 self-start sm:self-auto hover:underline whitespace-nowrap shrink-0"
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
    <div className="space-y-6 pb-12">

      {/* Hero: Quick Expense Tracker Widget */}
      <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-2xl border border-slate-200/80 dark:border-white/10 shadow-xs dark:shadow-slate-950/40 p-5 sm:p-6 relative overflow-hidden transition-colors">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-rose-500 text-white flex items-center justify-center shadow-sm shadow-rose-500/20 shrink-0">
              <Zap className="w-4 h-4 fill-current" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
                Quick Log Expense
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Instantly track your daily spending in seconds.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => onOpenTransactionModal({ type: 'income' })}
              className="h-9 px-3.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 bg-slate-50 dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 border border-slate-200 dark:border-slate-700 transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <TrendingUp className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>Record Income</span>
            </button>
            <button
              type="button"
              onClick={() => onOpenTransactionModal({ type: 'expense' })}
              className="h-9 px-3.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <Plus className="w-3.5 h-3.5 shrink-0" />
              <span>Detailed Entry / Split</span>
            </button>
          </div>
        </div>

        {/* Feedback Notices */}
        {quickFeedback && (
          <div className="mb-4 px-3.5 py-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-900/40 text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>{quickFeedback}</span>
          </div>
        )}

        {quickError && (
          <div className="mb-4 px-3.5 py-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900/40 text-rose-800 dark:text-rose-300 text-xs flex items-center gap-2 animate-in fade-in">
            <span>{quickError}</span>
          </div>
        )}

        {/* Quick Log Form — strictly uniform h-11 control heights across row */}
        <form onSubmit={handleQuickLogExpense} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3.5 items-end">
            
            {/* Amount Input */}
            <div className="lg:col-span-3">
              <label
                htmlFor="input_quick_amount"
                className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5"
              >
                Amount ({currencySymbol})
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 font-bold text-sm pointer-events-none">
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
                  className="w-full h-11 pl-8 pr-3.5 bg-slate-50/80 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-xl text-sm font-mono font-bold tabular-nums text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-colors"
                />
              </div>
            </div>

            {/* Merchant / Description */}
            <div className="lg:col-span-4">
              <label
                htmlFor="input_quick_merchant"
                className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5"
              >
                What / Where?
              </label>
              <input
                id="input_quick_merchant"
                type="text"
                placeholder="e.g. Swiggy, Zepto, Metro, Electricity Bill"
                required
                value={quickMerchant}
                onChange={e => setQuickMerchant(e.target.value)}
                className="w-full h-11 px-3.5 bg-slate-50/80 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-xl text-xs font-medium text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-colors"
              />
            </div>

            {/* Payment Account */}
            <div className="lg:col-span-3">
              <label
                htmlFor="select_quick_account"
                className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5"
              >
                Paid From
              </label>
              <select
                id="select_quick_account"
                value={defaultAccountId}
                onChange={e => setQuickAccount(e.target.value)}
                className="w-full h-11 px-3 bg-slate-50/80 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-xl text-xs font-medium text-slate-800 dark:text-slate-200 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-colors"
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
              <label
                htmlFor="input_quick_date"
                className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5"
              >
                Date
              </label>
              <input
                id="input_quick_date"
                type="date"
                value={quickDate}
                onChange={e => setQuickDate(e.target.value)}
                className="w-full h-11 px-3 bg-slate-50/80 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-xl text-xs font-mono font-medium text-slate-800 dark:text-slate-200 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-colors"
              />
            </div>

          </div>

          {/* Quick Category Chips & Aligned Submit Action */}
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex flex-col lg:flex-row lg:items-end justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Select Category (Optional)
                </span>
                {quickCategory && (
                  <button
                    type="button"
                    onClick={() => setQuickCategory('')}
                    className="text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 underline"
                  >
                    Clear
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
                      className={`h-8 px-3 rounded-lg text-xs font-semibold transition-colors inline-flex items-center whitespace-nowrap ${
                        isSelected
                          ? 'bg-rose-600 text-white shadow-2xs'
                          : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {cat.name}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-end shrink-0">
              <button
                id="btn_submit_quick_expense"
                type="submit"
                disabled={isLogging}
                className="w-full sm:w-auto h-10 bg-rose-600 hover:bg-rose-500 active:scale-[0.99] text-white font-bold text-xs px-5 rounded-xl inline-flex items-center justify-center gap-1.5 transition-all shadow-sm shadow-rose-600/20 disabled:opacity-50 whitespace-nowrap shrink-0"
              >
                <Plus className="w-4 h-4 shrink-0" />
                <span>{isLogging ? 'Logging Expense...' : 'Log Expense Now'}</span>
              </button>
            </div>
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

      {/* Spend Metrics Grid — equal height cards with aligned dividers & tabular numbers */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Today's Spend */}
        <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl p-5 sm:p-6 rounded-2xl border border-slate-200/80 dark:border-white/10 shadow-xs dark:shadow-slate-950/40 flex flex-col justify-between h-full">
          <div>
            <div className="flex items-center justify-between gap-2 mb-2.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Today's Spend</span>
              <Calendar className="w-4 h-4 text-rose-500 shrink-0" />
            </div>
            <div className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-rose-600 dark:text-rose-400 tracking-tight">
              {formatMinorUnits(todaysSpendMinor, currency)}
            </div>
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 truncate">
            Recorded for today ({todayStr})
          </div>
        </div>

        {/* This Month's Expenses */}
        <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl p-5 sm:p-6 rounded-2xl border border-slate-200/80 dark:border-white/10 shadow-xs dark:shadow-slate-950/40 flex flex-col justify-between h-full">
          <div>
            <div className="flex items-center justify-between gap-2 mb-2.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">This Month's Total</span>
              <TrendingDown className="w-4 h-4 text-rose-500 shrink-0" />
            </div>
            <div className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white tracking-tight">
              {formatMinorUnits(summary.expenses_minor, currency)}
            </div>
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 truncate">
            Last Month: <span className="font-mono tabular-nums font-semibold text-slate-700 dark:text-slate-300">{formatMinorUnits(summary.prev_month_expenses_minor, currency)}</span>
          </div>
        </div>

        {/* Available Spending Balance (Assets) */}
        <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl p-5 sm:p-6 rounded-2xl border border-slate-200/80 dark:border-white/10 shadow-xs dark:shadow-slate-950/40 flex flex-col justify-between h-full">
          <div>
            <div className="flex items-center justify-between gap-2 mb-2.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Available Balance</span>
              <Wallet className="w-4 h-4 text-emerald-500 shrink-0" />
            </div>
            <div className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400 tracking-tight">
              {formatMinorUnits(summary.total_assets_minor, currency)}
            </div>
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 truncate">
            Across {accounts.length} active account{accounts.length === 1 ? '' : 's'}
          </div>
        </div>

        {/* Monthly Income / Inflow */}
        <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl p-5 sm:p-6 rounded-2xl border border-slate-200/80 dark:border-white/10 shadow-xs dark:shadow-slate-950/40 flex flex-col justify-between h-full">
          <div>
            <div className="flex items-center justify-between gap-2 mb-2.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Month's Income</span>
              <TrendingUp className="w-4 h-4 text-blue-500 shrink-0" />
            </div>
            <div className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white tracking-tight">
              {formatMinorUnits(summary.income_minor, currency)}
            </div>
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 truncate">
            Net Flow:{' '}
            <strong className={`font-mono tabular-nums ${summary.net_cash_flow_minor >= 0 ? 'text-slate-800 dark:text-slate-200' : 'text-rose-600 dark:text-rose-400'}`}>
              {formatMinorUnits(summary.net_cash_flow_minor, currency)}
            </strong>
          </div>
        </div>

      </div>

      {/* Recent Expenses Ledger & Accounts Breakdown — synchronized card headers & padding */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        
        {/* Left 2 Cols: Recent Expenses List */}
        <div className="lg:col-span-2 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-2xl border border-slate-200/80 dark:border-white/10 shadow-xs overflow-hidden">
          <div className="px-5 sm:px-6 py-4 flex items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Recent Expenses</h3>
            <button
              type="button"
              onClick={() => onNavigateTab('transactions')}
              className="text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white inline-flex items-center gap-1 whitespace-nowrap shrink-0"
            >
              <span>View Full Ledger</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {deleteError && (
            <div className="px-5 sm:px-6 py-3 bg-rose-50 dark:bg-rose-950/60 border-b border-rose-100 dark:border-rose-900/40 text-rose-700 dark:text-rose-300 text-xs font-medium flex items-center justify-between gap-3">
              <span>{deleteError}</span>
              <button type="button" onClick={() => setDeleteError(null)} className="text-rose-600 hover:text-rose-800 font-bold shrink-0">
                ✕
              </button>
            </div>
          )}

          {recent_transactions.length === 0 ? (
            /* Clean Pristine Empty State */
            <div className="px-6 py-12 text-center text-slate-500 dark:text-slate-400 space-y-2.5">
              <div className="w-11 h-11 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto text-slate-400">
                <Sparkles className="w-5 h-5 text-amber-500" />
              </div>
              <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">No expenses recorded yet</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto leading-relaxed">
                Your expense tracker is clean and ready. Use the quick logger at the top to record your first expense.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {recent_transactions.map(tx => (
                <div key={tx.id} className="px-5 sm:px-6 py-3.5 flex items-center justify-between gap-4 hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                      tx.type === 'income'
                        ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400'
                        : tx.type === 'transfer'
                        ? 'bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400'
                        : 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400'
                    }`}>
                      {tx.type === 'income' ? (
                        <TrendingUp className="w-4 h-4" />
                      ) : (
                        <TrendingDown className="w-4 h-4" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold text-slate-900 dark:text-white truncate">{tx.merchant}</div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mt-0.5 min-w-0">
                        <span className="font-mono tabular-nums whitespace-nowrap shrink-0">{tx.date}</span>
                        <span aria-hidden="true" className="shrink-0">·</span>
                        <span className="truncate">{tx.category_name || (tx.type === 'income' ? 'Income' : 'General Expense')}</span>
                        <span aria-hidden="true" className="shrink-0">·</span>
                        <span className="truncate">{tx.account_name}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 shrink-0">
                    <div className={`text-xs font-bold font-mono tabular-nums text-right min-w-[80px] ${
                      tx.type === 'income' ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-900 dark:text-white'
                    }`}>
                      {tx.type === 'income' ? '+' : '-'}
                      {formatMinorUnits(tx.amount_minor, currency)}
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setDeleteError(null);
                        setTxToDelete({ id: tx.id, merchant: tx.merchant });
                      }}
                      className="w-7 h-7 inline-flex items-center justify-center text-slate-400 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors shrink-0"
                      title="Delete expense"
                      aria-label={`Delete ${tx.merchant}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Col: Your Accounts Quick View */}
        <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-2xl border border-slate-200/80 dark:border-white/10 shadow-xs overflow-hidden">
          <div className="px-5 sm:px-6 py-4 flex items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2 min-w-0">
              <CreditCard className="w-4 h-4 text-slate-500 dark:text-slate-400 shrink-0" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate">Payment Accounts</h3>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab('accounts')}
              className="text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white inline-flex items-center gap-1 whitespace-nowrap shrink-0"
            >
              <span>Manage</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="p-4 sm:p-5 space-y-2.5">
            {accounts.map(acc => (
              <div
                key={acc.id}
                className="px-3.5 py-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <div className="w-8 h-8 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-200 shadow-2xs shrink-0">
                    <AccountIcon name={acc.icon} className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate">{acc.name}</h4>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 capitalize block truncate">{acc.type.replace('_', ' ')}</span>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div className="text-xs font-bold font-mono tabular-nums text-slate-900 dark:text-white">
                    {formatMinorUnits(acc.current_balance_minor, currency)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Add-Ons Section */}
      <div className="pt-6 border-t border-slate-200/80 dark:border-slate-800">
        <div className="flex items-center gap-2 mb-4">
          <Layers className="w-4 h-4 text-slate-400 shrink-0" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Extended Financial Tools
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* Budgets Add-on */}
          <button
            type="button"
            onClick={() => onNavigateTab('budgets')}
            className="text-left p-5 rounded-2xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/80 dark:border-white/10 shadow-2xs hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-xs transition-all cursor-pointer group flex flex-col justify-between h-full"
          >
            <div>
              <div className="flex items-center justify-between gap-2 mb-3">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                  <PieChart className="w-4 h-4" />
                </div>
                <span className="text-xs font-semibold font-mono tabular-nums text-indigo-600 dark:text-indigo-400 whitespace-nowrap">
                  {budgets.length} Active
                </span>
              </div>
              <h4 className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                Category Budgets
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                Set monthly spending targets and get pace warnings.
              </p>
            </div>
          </button>

          {/* Subscriptions Add-on */}
          <button
            type="button"
            onClick={() => onNavigateTab('subscriptions')}
            className="text-left p-5 rounded-2xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/80 dark:border-white/10 shadow-2xs hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-xs transition-all cursor-pointer group flex flex-col justify-between h-full"
          >
            <div>
              <div className="flex items-center justify-between gap-2 mb-3">
                <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                  <CalendarClock className="w-4 h-4" />
                </div>
                <span className="text-xs font-semibold font-mono tabular-nums text-amber-600 dark:text-amber-400 whitespace-nowrap">
                  {upcoming_obligations.length} Due Soon
                </span>
              </div>
              <h4 className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                Subscriptions & Bills
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                Track recurring bills, renewal dates, and cadences.
              </p>
            </div>
          </button>

          {/* Goals Add-on */}
          <button
            type="button"
            onClick={() => onNavigateTab('goals')}
            className="text-left p-5 rounded-2xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/80 dark:border-white/10 shadow-2xs hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-xs transition-all cursor-pointer group flex flex-col justify-between h-full"
          >
            <div>
              <div className="flex items-center justify-between gap-2 mb-3">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                  <Target className="w-4 h-4" />
                </div>
                <span className="text-xs font-semibold font-mono tabular-nums text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                  {goals.length} Goals
                </span>
              </div>
              <h4 className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                Financial Goals
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                Create milestone targets for savings or major purchases.
              </p>
            </div>
          </button>

          {/* Analytics Add-on */}
          <button
            type="button"
            onClick={() => onNavigateTab('analytics')}
            className="text-left p-5 rounded-2xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/80 dark:border-white/10 shadow-2xs hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-xs transition-all cursor-pointer group flex flex-col justify-between h-full"
          >
            <div>
              <div className="flex items-center justify-between gap-2 mb-3">
                <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                  <BarChart3 className="w-4 h-4" />
                </div>
                <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 whitespace-nowrap">
                  Reports
                </span>
              </div>
              <h4 className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                Spending Analytics
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                Category distribution charts and historical comparisons.
              </p>
            </div>
          </button>

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
