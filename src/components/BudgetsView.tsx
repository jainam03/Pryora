/**
 * PRYORA Budgets & Spending Velocity View
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Budget, Category } from '../types';
import { apiRequest } from '../lib/api';
import { formatMinorUnits } from '../lib/currency';
import { useAuth } from '../context/AuthContext';
import { CategoryIcon } from './common/Icon';
import { ConfirmDialog } from './common/ConfirmDialog';
import {
  PieChart,
  Plus,
  AlertTriangle,
  CheckCircle2,
  Trash2,
  Edit2,
  X,
  TrendingUp,
  Clock,
} from 'lucide-react';

interface BudgetsViewProps {
  categories: Category[];
  onDataChanged: () => void;
}

export const BudgetsView: React.FC<BudgetsViewProps> = ({ categories, onDataChanged }) => {
  const { user } = useAuth();
  const currency = user?.currency || 'INR';

  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [summary, setSummary] = useState<any>({});
  const [loading, setLoading] = useState<boolean>(true);

  // Modal
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  // Deletion confirmation state (iframe-safe)
  const [budgetToDelete, setBudgetToDelete] = useState<{ id: string; name: string } | null>(null);
  const [isDeletingBudget, setIsDeletingBudget] = useState<boolean>(false);

  const fetchBudgets = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiRequest<any>('/api/budgets');
      setBudgets(data.budgets || []);
      setSummary(data.summary || {});
    } catch (err) {
      console.error('Error fetching budgets:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBudgets();
  }, [fetchBudgets]);

  const handleSaveBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) {
      setError('Please enter a valid budget amount.');
      return;
    }

    if (!selectedCategoryId) {
      setError('Please select a category.');
      return;
    }

    try {
      await apiRequest('/api/budgets', {
        method: 'POST',
        body: JSON.stringify({
          categoryId: selectedCategoryId,
          amount: amt,
        }),
      });
      setIsModalOpen(false);
      fetchBudgets();
      onDataChanged();
    } catch (err: any) {
      setError(err.message || 'Could not save budget.');
    }
  };

  const handleDeleteBudget = (id: string, name: string) => {
    setBudgetToDelete({ id, name });
  };

  const confirmDeleteBudget = async () => {
    if (!budgetToDelete) return;
    setIsDeletingBudget(true);
    try {
      await apiRequest(`/api/budgets/${budgetToDelete.id}`, { method: 'DELETE' });
      setBudgetToDelete(null);
      fetchBudgets();
      onDataChanged();
    } catch (err: any) {
      setError(err.message || 'Could not delete budget. Please try again.');
    } finally {
      setIsDeletingBudget(false);
    }
  };

  const expenseCategories = categories.filter(c => c.type === 'expense');

  return (
    <div className="space-y-6 pb-12">
      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">Budgets & Spending Velocity</h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Pacing calculations account for elapsed days in the month and projected burn rates.
          </p>
        </div>

        <button
          id="btn_set_budget"
          type="button"
          onClick={() => {
            setSelectedCategoryId(expenseCategories[0]?.id || '');
            setAmount('');
            setError(null);
            setIsModalOpen(true);
          }}
          className="bg-slate-900 hover:bg-slate-800 dark:bg-emerald-500 dark:hover:bg-emerald-400 text-white dark:text-slate-950 font-bold px-4 py-2.5 rounded-2xl text-xs sm:text-sm flex items-center gap-1.5 transition-all shadow-sm active:scale-95 shrink-0"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" /> Set Category Budget
        </button>
      </div>

      {/* Summary Strip (Liquid Glass) */}
      <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl p-5 sm:p-6 rounded-3xl border border-slate-200/80 dark:border-white/10 shadow-xs dark:shadow-slate-950/40 grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div>
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Monthly Budget</span>
          <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white mt-1 tracking-tight">
            {formatMinorUnits(summary.total_budgeted_minor || 0, currency)}
          </div>
          <div className="text-xs text-slate-400 dark:text-slate-500 mt-1">Across {budgets.length} active category targets</div>
        </div>

        <div className="border-t sm:border-t-0 sm:border-l border-slate-100 dark:border-slate-800 pt-4 sm:pt-0 sm:pl-5">
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Spent This Month</span>
          <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white mt-1 tracking-tight">
            {formatMinorUnits(summary.total_spent_minor || 0, currency)}
          </div>
          <div className="text-xs text-slate-400 dark:text-slate-500 mt-1">
            {summary.overall_percentage_used || 0}% of combined allocation
          </div>
        </div>

        <div className="border-t sm:border-t-0 sm:border-l border-slate-100 dark:border-slate-800 pt-4 sm:pt-0 sm:pl-5">
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Remaining Cushion</span>
          <div className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400 mt-1 tracking-tight">
            {formatMinorUnits(summary.total_remaining_minor || 0, currency)}
          </div>
          <div className="text-xs text-slate-400 dark:text-slate-500 mt-1">
            {summary.days_remaining || 0} day(s) remaining in this month
          </div>
        </div>
      </div>

      {/* Budgets List */}
      {loading ? (
        <div className="p-12 text-center text-xs text-slate-400 dark:text-slate-500">Loading budgets...</div>
      ) : budgets.length === 0 ? (
        <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl p-12 rounded-3xl border border-slate-200/80 dark:border-white/10 text-center space-y-3">
          <PieChart className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto" />
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">No category budgets established yet</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
            Set intentional spending limits for dining, groceries, utilities, and lifestyle expenses to receive pacing diagnostics.
          </p>
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="mt-2 inline-flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 dark:bg-emerald-500 dark:hover:bg-emerald-400 text-white dark:text-slate-950 text-xs font-bold px-4 py-2.5 rounded-xl transition-all shadow-sm active:scale-95"
          >
            <Plus className="w-4 h-4" /> Set First Budget
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {budgets.map(b => (
            <div key={b.id} className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl p-5 sm:p-6 rounded-3xl border border-slate-200/80 dark:border-white/10 shadow-xs dark:shadow-slate-950/40 space-y-4 hover:border-slate-300 dark:hover:border-slate-700 transition-all">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-800 dark:text-slate-200 border border-slate-200/80 dark:border-slate-700 shadow-2xs">
                    <CategoryIcon name={b.category_icon} className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">{b.category_name}</h4>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      Limit: <strong className="text-slate-800 dark:text-slate-200">{formatMinorUnits(b.amount_minor, currency)}</strong> / month
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    b.pace_status === 'over_budget'
                      ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-900/40'
                      : b.pace_status === 'caution'
                      ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-900/40'
                      : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/40'
                  }`}>
                    {b.pace_status === 'over_budget'
                      ? 'Exceeded'
                      : b.pace_status === 'caution'
                      ? 'Trending Over'
                      : 'On Track'}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleDeleteBudget(b.id, b.category_name)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-colors"
                    title="Delete budget"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    {formatMinorUnits(b.spent_minor, currency)} spent
                  </span>
                  <span className="font-bold text-slate-900 dark:text-white">{b.percentage_used}%</span>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      b.percentage_used > 100
                        ? 'bg-rose-500'
                        : b.percentage_used > 80
                        ? 'bg-amber-500'
                        : 'bg-emerald-500'
                    }`}
                    style={{ width: `${Math.min(100, b.percentage_used)}%` }}
                  />
                </div>
              </div>

              {/* Pacing Diagnostic Message */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 flex items-start gap-2.5 text-xs text-slate-600 dark:text-slate-300">
                <Clock className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{b.summary_message}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Set / Edit Budget Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-md p-4">
          <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl rounded-3xl shadow-2xl border border-slate-200/80 dark:border-white/10 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Set Category Budget</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            {error && (
              <div className="mx-6 mt-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 text-xs border border-rose-200 dark:border-rose-900/40">
                {error}
              </div>
            )}

            <form onSubmit={handleSaveBudget} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">Category</label>
                <select
                  value={selectedCategoryId}
                  onChange={e => setSelectedCategoryId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/80 text-sm font-medium text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-none"
                >
                  {expenseCategories.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Monthly Limit ({currency})
                </label>
                <input
                  type="number"
                  step="any"
                  required
                  placeholder="e.g. 10000"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/80 text-sm font-bold text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-slate-900 hover:bg-slate-800 dark:bg-emerald-500 dark:hover:bg-emerald-400 text-white dark:text-slate-950 font-bold text-xs px-5 py-2.5 rounded-xl transition-all shadow-sm active:scale-95"
                >
                  Save Budget
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Dialog for Budget Deletion (Iframe-safe, replaces window.confirm) */}
      <ConfirmDialog
        isOpen={!!budgetToDelete}
        title="Delete Budget"
        message={`Are you sure you want to delete the budget for "${budgetToDelete?.name}"?`}
        confirmLabel="Delete Budget"
        isLoading={isDeletingBudget}
        onConfirm={confirmDeleteBudget}
        onCancel={() => {
          if (!isDeletingBudget) setBudgetToDelete(null);
        }}
      />
    </div>
  );
};
