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
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Budgets & Spending Velocity</h2>
          <p className="text-xs text-slate-500 mt-0.5">
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
          className="bg-slate-900 hover:bg-slate-800 text-white font-semibold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" /> Set Category Budget
        </button>
      </div>

      {/* Summary Strip */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Monthly Budget</span>
          <div className="text-2xl font-black text-slate-900 mt-1">
            {formatMinorUnits(summary.total_budgeted_minor || 0, currency)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Across {budgets.length} active category targets</div>
        </div>

        <div>
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Spent This Month</span>
          <div className="text-2xl font-black text-slate-900 mt-1">
            {formatMinorUnits(summary.total_spent_minor || 0, currency)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            {summary.overall_percentage_used || 0}% of combined allocation
          </div>
        </div>

        <div>
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Remaining Cushion</span>
          <div className="text-2xl font-black text-emerald-600 mt-1">
            {formatMinorUnits(summary.total_remaining_minor || 0, currency)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            {summary.days_remaining || 0} day(s) remaining in this month
          </div>
        </div>
      </div>

      {/* Budgets List */}
      {loading ? (
        <div className="p-12 text-center text-xs text-slate-400">Loading budgets...</div>
      ) : budgets.length === 0 ? (
        <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center space-y-3">
          <PieChart className="w-10 h-10 text-slate-300 mx-auto" />
          <h3 className="text-sm font-bold text-slate-800">No category budgets established yet</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Set intentional spending limits for dining, groceries, utilities, and lifestyle expenses to receive pacing diagnostics.
          </p>
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="mt-2 inline-flex items-center gap-1.5 bg-slate-900 text-white text-xs font-semibold px-4 py-2 rounded-xl"
          >
            <Plus className="w-4 h-4" /> Set First Budget
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {budgets.map(b => (
            <div key={b.id} className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-800">
                    <CategoryIcon name={b.category_icon} className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">{b.category_name}</h4>
                    <span className="text-[11px] text-slate-500">
                      Limit: <strong>{formatMinorUnits(b.amount_minor, currency)}</strong> / month
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    b.pace_status === 'over_budget'
                      ? 'bg-rose-100 text-rose-800'
                      : b.pace_status === 'caution'
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-emerald-100 text-emerald-800'
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
                    className="p-1 text-slate-400 hover:text-red-600 rounded"
                    title="Delete budget"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="font-semibold text-slate-700">
                    {formatMinorUnits(b.spent_minor, currency)} spent
                  </span>
                  <span className="font-bold text-slate-900">{b.percentage_used}%</span>
                </div>
                <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
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
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-start gap-2.5 text-xs text-slate-600">
                <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{b.summary_message}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Set / Edit Budget Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
              <h3 className="text-sm font-bold text-slate-900">Set Category Budget</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            {error && (
              <div className="mx-6 mt-4 p-3 rounded-xl bg-red-50 text-red-700 text-xs border border-red-200">
                {error}
              </div>
            )}

            <form onSubmit={handleSaveBudget} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Category</label>
                <select
                  value={selectedCategoryId}
                  onChange={e => setSelectedCategoryId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-medium"
                >
                  {expenseCategories.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Monthly Limit ({currency})
                </label>
                <input
                  type="number"
                  step="any"
                  required
                  placeholder="e.g. 10000"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-bold text-slate-900"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs px-5 py-2 rounded-xl shadow-sm"
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
