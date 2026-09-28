/**
 * PRYORA Financial Analytics & Historical Trends View
 */

import React, { useState, useEffect, useCallback } from 'react';
import { apiRequest } from '../lib/api';
import { formatMinorUnits } from '../lib/currency';
import { useAuth } from '../context/AuthContext';
import { CategoryIcon } from './common/Icon';
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Percent,
  Calendar,
  Layers,
  ShoppingBag,
} from 'lucide-react';

export const AnalyticsView: React.FC = () => {
  const { user } = useAuth();
  const currency = user?.currency || 'INR';

  const [period, setPeriod] = useState<string>('current_month');
  const [cashflowHistory, setCashflowHistory] = useState<any[]>([]);
  const [spendingData, setSpendingData] = useState<any>({ categories: [], merchants: [], total_expense_minor: 0 });
  const [loading, setLoading] = useState<boolean>(true);

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      const [cfRes, spRes] = await Promise.all([
        apiRequest<any>('/api/analytics/cashflow'),
        apiRequest<any>(`/api/analytics/spending?period=${period}`),
      ]);
      setCashflowHistory(cfRes.history || []);
      setSpendingData(spRes || { categories: [], merchants: [], total_expense_minor: 0 });
    } catch (err) {
      console.error('Error fetching analytics:', err);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  // Max value for Cash Flow bar heights
  const maxFlowMinor = Math.max(
    1,
    ...cashflowHistory.map(m => Math.max(m.income_minor, m.expenses_minor))
  );

  return (
    <div className="space-y-6 pb-12">
      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">Analytics & Cash Flow Trends</h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Evidence-based financial breakdown strictly isolating transfers from operational cash flows.
          </p>
        </div>

        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl border border-slate-200/80 dark:border-white/5">
          <button
            type="button"
            onClick={() => setPeriod('current_month')}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all ${
              period === 'current_month'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            This Month
          </button>
          <button
            type="button"
            onClick={() => setPeriod('last_30_days')}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all ${
              period === 'last_30_days'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Last 30 Days
          </button>
          <button
            type="button"
            onClick={() => setPeriod('this_year')}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all ${
              period === 'this_year'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            This Year
          </button>
        </div>
      </div>

      {/* 6-Month Cash Flow Bar Chart (Liquid Glass) */}
      <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl p-5 sm:p-6 rounded-3xl border border-slate-200/80 dark:border-white/10 shadow-xs dark:shadow-slate-950/40 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Historical Cash Flow (Past 6 Months)</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Income (emerald) vs Expenses (rose)</p>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-xs bg-emerald-500" />
              <span className="text-slate-600 dark:text-slate-300 font-semibold">Income</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-xs bg-rose-500" />
              <span className="text-slate-600 dark:text-slate-300 font-semibold">Expenses</span>
            </div>
          </div>
        </div>

        {cashflowHistory.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400 dark:text-slate-500">No cash flow data available.</div>
        ) : (
          <div className="grid grid-cols-6 gap-2 sm:gap-6 pt-6 pb-2 items-end h-56 border-b border-slate-100 dark:border-slate-800">
            {cashflowHistory.map(m => {
              const incomeHeight = Math.round((m.income_minor / maxFlowMinor) * 160);
              const expenseHeight = Math.round((m.expenses_minor / maxFlowMinor) * 160);

              return (
                <div key={m.month} className="flex flex-col items-center gap-2 h-full justify-end">
                  <div className="flex items-end gap-1.5 h-44">
                    {/* Income Bar */}
                    <div
                      className="w-3.5 sm:w-6 bg-emerald-500 hover:bg-emerald-400 rounded-t-md transition-all relative group"
                      style={{ height: `${Math.max(4, incomeHeight)}px` }}
                    >
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] px-2 py-0.5 rounded whitespace-nowrap z-10 pointer-events-none">
                        +{formatMinorUnits(m.income_minor, currency)}
                      </div>
                    </div>

                    {/* Expense Bar */}
                    <div
                      className="w-3.5 sm:w-6 bg-rose-500 hover:bg-rose-400 rounded-t-md transition-all relative group"
                      style={{ height: `${Math.max(4, expenseHeight)}px` }}
                    >
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] px-2 py-0.5 rounded whitespace-nowrap z-10 pointer-events-none">
                        -{formatMinorUnits(m.expenses_minor, currency)}
                      </div>
                    </div>
                  </div>

                  <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 truncate max-w-full">
                    {m.label}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Grid: Category Spending & Merchant Analytics (Liquid Glass) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Category Breakdown */}
        <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl p-5 sm:p-6 rounded-3xl border border-slate-200/80 dark:border-white/10 shadow-xs dark:shadow-slate-950/40 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Category Spending Distribution</h3>
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
              Total: {formatMinorUnits(spendingData.total_expense_minor || 0, currency)}
            </span>
          </div>

          {spendingData.categories.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400 dark:text-slate-500">
              No expenses recorded in this period.
            </div>
          ) : (
            <div className="space-y-3.5">
              {spendingData.categories.map((c: any) => (
                <div key={c.id} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700">
                        <CategoryIcon name={c.icon} className="w-3.5 h-3.5" />
                      </div>
                      <span className="font-semibold text-slate-900 dark:text-white">{c.name}</span>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500">({c.count} txs)</span>
                    </div>
                    <div className="text-right font-semibold text-slate-800 dark:text-slate-200">
                      {formatMinorUnits(c.total_minor, currency)}{' '}
                      <span className="text-slate-400 dark:text-slate-500 font-normal">({c.share_percentage}%)</span>
                    </div>
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-slate-800 dark:bg-emerald-500"
                      style={{ width: `${c.share_percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top Merchants */}
        <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl p-5 sm:p-6 rounded-3xl border border-slate-200/80 dark:border-white/10 shadow-xs dark:shadow-slate-950/40 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Top Payees & Merchants</h3>
            <ShoppingBag className="w-4 h-4 text-slate-400 dark:text-slate-500" />
          </div>

          {spendingData.merchants.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400 dark:text-slate-500">
              No merchant data for this period.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {spendingData.merchants.map((m: any, idx: number) => (
                <div key={idx} className="py-2.5 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-slate-900 dark:text-white">{m.merchant}</span>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 ml-2">{m.count} payment(s)</span>
                  </div>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {formatMinorUnits(m.total_minor, currency)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
