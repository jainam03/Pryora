/**
 * PRYORA Financial Goals & Milestones View
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Goal } from '../types';
import { apiRequest } from '../lib/api';
import { formatMinorUnits } from '../lib/currency';
import { useAuth } from '../context/AuthContext';
import { ConfirmDialog } from './common/ConfirmDialog';
import {
  Target,
  Plus,
  TrendingUp,
  Calendar,
  CheckCircle2,
  Trash2,
  X,
  Coins,
} from 'lucide-react';

interface GoalsViewProps {
  onDataChanged: () => void;
}

export const GoalsView: React.FC<GoalsViewProps> = ({ onDataChanged }) => {
  const { user } = useAuth();
  const currency = user?.currency || 'INR';

  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Add Goal Modal
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [name, setName] = useState<string>('');
  const [targetAmount, setTargetAmount] = useState<string>('');
  const [currentAmount, setCurrentAmount] = useState<string>('0');
  const [targetDate, setTargetDate] = useState<string>('');
  const [category, setCategory] = useState<string>('savings_target');
  const [error, setError] = useState<string | null>(null);

  // Contribute Modal
  const [contributeModalOpen, setContributeModalOpen] = useState<boolean>(false);
  const [targetGoal, setTargetGoal] = useState<Goal | null>(null);
  const [contributeAmount, setContributeAmount] = useState<string>('');
  const [contributeNotes, setContributeNotes] = useState<string>('');
  const [contributing, setContributing] = useState<boolean>(false);
  const [contributeError, setContributeError] = useState<string | null>(null);

  // Deletion confirmation state (iframe-safe)
  const [goalToDelete, setGoalToDelete] = useState<{ id: string; name: string } | null>(null);
  const [isDeletingGoal, setIsDeletingGoal] = useState<boolean>(false);

  const fetchGoals = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiRequest<any>('/api/goals');
      setGoals(data.goals || []);
    } catch (err) {
      console.error('Error fetching goals:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGoals();
  }, [fetchGoals]);

  const handleSaveGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const targetNum = parseFloat(targetAmount);
    if (isNaN(targetNum) || targetNum <= 0) {
      setError('Please enter a valid target amount.');
      return;
    }

    if (!name.trim()) {
      setError('Goal name is required.');
      return;
    }

    try {
      await apiRequest('/api/goals', {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          targetAmount: targetNum,
          currentAmount: parseFloat(currentAmount) || 0,
          targetDate: targetDate || null,
          category,
        }),
      });

      setIsModalOpen(false);
      fetchGoals();
      onDataChanged();
    } catch (err: any) {
      setError(err.message || 'Could not save goal.');
    }
  };

  const openContributeModal = (goal: Goal) => {
    setTargetGoal(goal);
    setContributeAmount('');
    setContributeNotes('');
    setContributeError(null);
    setContributeModalOpen(true);
  };

  const handleExecuteContribution = async (e: React.FormEvent) => {
    e.preventDefault();
    setContributeError(null);
    if (!targetGoal) return;

    const amt = parseFloat(contributeAmount);
    if (isNaN(amt) || amt <= 0) {
      setContributeError('Please enter a valid contribution amount.');
      return;
    }

    setContributing(true);
    try {
      await apiRequest(`/api/goals/${targetGoal.id}/contribute`, {
        method: 'POST',
        body: JSON.stringify({
          amount: amt,
          notes: contributeNotes,
        }),
      });
      setContributeModalOpen(false);
      fetchGoals();
      onDataChanged();
    } catch (err: any) {
      setContributeError(err.message || 'Contribution failed.');
    } finally {
      setContributing(false);
    }
  };

  const handleDeleteGoal = (id: string, goalName: string) => {
    setGoalToDelete({ id, name: goalName });
  };

  const confirmDeleteGoal = async () => {
    if (!goalToDelete) return;
    setIsDeletingGoal(true);
    try {
      await apiRequest(`/api/goals/${goalToDelete.id}`, { method: 'DELETE' });
      setGoalToDelete(null);
      fetchGoals();
      onDataChanged();
    } catch (err: any) {
      setError(err.message || 'Could not delete goal. Please try again.');
    } finally {
      setIsDeletingGoal(false);
    }
  };

  const totalSavedAcrossGoals = goals.reduce((s, g) => s + (g.current_amount_minor || 0), 0);
  const totalTargetAcrossGoals = goals.reduce((s, g) => s + (g.target_amount_minor || 0), 0);

  return (
    <div className="space-y-6 pb-12">
      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">Financial Goals & Milestones</h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Sovereign targets for emergency reserves, major purchases, and long-term security.
          </p>
        </div>

        <button
          id="btn_create_goal"
          type="button"
          onClick={() => {
            setName('');
            setTargetAmount('');
            setCurrentAmount('0');
            setTargetDate('');
            setCategory('savings_target');
            setError(null);
            setIsModalOpen(true);
          }}
          className="bg-slate-900 hover:bg-slate-800 dark:bg-emerald-500 dark:hover:bg-emerald-400 text-white dark:text-slate-950 font-bold px-4 py-2.5 rounded-2xl text-xs sm:text-sm flex items-center gap-1.5 transition-all shadow-sm active:scale-95 shrink-0"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" /> Create Goal
        </button>
      </div>

      {/* Summary Banner (Liquid Glass) */}
      <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl p-5 sm:p-6 rounded-3xl border border-slate-200/80 dark:border-white/10 shadow-xs dark:shadow-slate-950/40 grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div>
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Saved in Goals</span>
          <div className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400 mt-1 tracking-tight">
            {formatMinorUnits(totalSavedAcrossGoals, currency)}
          </div>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Total across {goals.length} target(s)</p>
        </div>

        <div className="border-t sm:border-t-0 sm:border-l border-slate-100 dark:border-slate-800 pt-4 sm:pt-0 sm:pl-5">
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Combined Target Volume</span>
          <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white mt-1 tracking-tight">
            {formatMinorUnits(totalTargetAcrossGoals, currency)}
          </div>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
            Overall: {totalTargetAcrossGoals > 0 ? Math.round((totalSavedAcrossGoals / totalTargetAcrossGoals) * 100) : 0}% achieved
          </p>
        </div>

        <div className="border-t sm:border-t-0 sm:border-l border-slate-100 dark:border-slate-800 pt-4 sm:pt-0 sm:pl-5">
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Completed Milestones</span>
          <div className="text-2xl sm:text-3xl font-black text-indigo-600 dark:text-indigo-400 mt-1 tracking-tight">
            {goals.filter(g => g.is_completed === 1).length} of {goals.length}
          </div>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Fully funded targets</p>
        </div>
      </div>

      {/* Goals Grid */}
      {loading ? (
        <div className="p-12 text-center text-xs text-slate-400 dark:text-slate-500">Loading goals...</div>
      ) : goals.length === 0 ? (
        <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl p-12 rounded-3xl border border-slate-200/80 dark:border-white/10 text-center space-y-3">
          <Target className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto" />
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">No financial milestones set</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
            Establish a 3-month emergency fund, a home deposit target, or a travel reserve.
          </p>
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="mt-2 inline-flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 dark:bg-emerald-500 dark:hover:bg-emerald-400 text-white dark:text-slate-950 text-xs font-bold px-4 py-2.5 rounded-xl transition-all shadow-sm active:scale-95"
          >
            <Plus className="w-4 h-4" /> Create First Goal
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {goals.map(g => (
            <div key={g.id} className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl p-5 sm:p-6 rounded-3xl border border-slate-200/80 dark:border-white/10 shadow-xs dark:shadow-slate-950/40 flex flex-col justify-between space-y-4 hover:border-slate-300 dark:hover:border-slate-700 transition-all">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">{g.name}</h4>
                    {g.is_completed === 1 && (
                      <span className="bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-900/40 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Reached
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-slate-400 dark:text-slate-500 capitalize">
                    {g.category?.replace('_', ' ') || 'Savings'}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => handleDeleteGoal(g.id, g.name)}
                  className="text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 p-1.5 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Progress & Balances */}
              <div className="space-y-2">
                <div className="flex items-baseline justify-between">
                  <span className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
                    {formatMinorUnits(g.current_amount_minor, currency)}
                  </span>
                  <span className="text-xs font-bold text-slate-600 dark:text-slate-400">
                    Target: {formatMinorUnits(g.target_amount_minor, currency)}
                  </span>
                </div>

                <div className="w-full bg-slate-100 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      g.is_completed === 1 ? 'bg-emerald-600' : 'bg-emerald-500'
                    }`}
                    style={{ width: `${g.percentage_completed}%` }}
                  />
                </div>

                <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 pt-0.5">
                  <span>{g.percentage_completed}% funded</span>
                  <span>{formatMinorUnits(g.remaining_minor, currency)} to go</span>
                </div>
              </div>

              {/* Bottom Actions */}
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {g.target_date ? (
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                      Target: {g.target_date}
                    </span>
                  ) : (
                    <span>No deadline set</span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => openContributeModal(g)}
                  className="bg-slate-900 hover:bg-slate-800 dark:bg-emerald-500 dark:hover:bg-emerald-400 text-white dark:text-slate-950 text-xs font-bold px-3 py-1.5 rounded-xl flex items-center gap-1 transition-all shadow-sm active:scale-95"
                >
                  <Coins className="w-3.5 h-3.5 text-amber-400 dark:text-slate-950" /> Contribute
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Goal Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-md p-4">
          <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl rounded-3xl shadow-2xl border border-slate-200/80 dark:border-white/10 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Create Financial Milestone</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            {error && (
              <div className="mx-6 mt-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 text-xs border border-rose-200 dark:border-rose-900/40">
                {error}
              </div>
            )}

            <form onSubmit={handleSaveGoal} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">Goal Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 6-Month Emergency Fund, Japan Trip"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/80 text-sm font-medium text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">Target Amount ({currency})</label>
                  <input
                    type="number"
                    step="any"
                    required
                    placeholder="150000"
                    value={targetAmount}
                    onChange={e => setTargetAmount(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/80 text-sm font-bold text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">Initial Saved ({currency})</label>
                  <input
                    type="number"
                    step="any"
                    placeholder="0"
                    value={currentAmount}
                    onChange={e => setCurrentAmount(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/80 text-sm font-bold text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">Category</label>
                  <select
                    value={category}
                    onChange={e => setCategory(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/80 text-sm font-medium text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-none"
                  >
                    <option value="emergency_fund">Emergency Fund</option>
                    <option value="savings_target">Savings Target</option>
                    <option value="major_purchase">Major Purchase</option>
                    <option value="vacation">Vacation / Travel</option>
                    <option value="investment">Investment Milestone</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">Target Date (Optional)</label>
                  <input
                    type="date"
                    value={targetDate}
                    onChange={e => setTargetDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/80 text-sm font-medium text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
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
                  Create Goal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Contribute Modal */}
      {contributeModalOpen && targetGoal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-md p-4">
          <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl rounded-3xl shadow-2xl border border-slate-200/80 dark:border-white/10 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Add Contribution</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Toward {targetGoal.name}</p>
              </div>
              <button onClick={() => setContributeModalOpen(false)} className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleExecuteContribution} className="p-6 space-y-4">
              {contributeError && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 text-xs rounded-xl border border-rose-200 dark:border-rose-900/40">
                  {contributeError}
                </div>
              )}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">Contribution Amount ({currency})</label>
                <input
                  type="number"
                  step="any"
                  required
                  autoFocus
                  placeholder="e.g. 5000"
                  value={contributeAmount}
                  onChange={e => setContributeAmount(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/80 text-sm font-bold text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">Note (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Monthly allocation from salary"
                  value={contributeNotes}
                  onChange={e => setContributeNotes(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/80 text-sm font-medium text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setContributeModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={contributing}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-5 py-2.5 rounded-xl transition-all shadow-sm active:scale-95 disabled:opacity-50"
                >
                  {contributing ? 'Recording...' : 'Record Contribution'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Dialog for Goal Deletion (Iframe-safe, replaces window.confirm) */}
      <ConfirmDialog
        isOpen={!!goalToDelete}
        title="Delete Financial Goal"
        message={`Are you sure you want to delete the goal "${goalToDelete?.name}"?`}
        confirmLabel="Delete Goal"
        isLoading={isDeletingGoal}
        onConfirm={confirmDeleteGoal}
        onCancel={() => {
          if (!isDeletingGoal) setGoalToDelete(null);
        }}
      />
    </div>
  );
};
