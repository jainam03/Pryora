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
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Financial Goals & Milestones</h2>
          <p className="text-xs text-slate-500 mt-0.5">
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
          className="bg-slate-900 hover:bg-slate-800 text-white font-semibold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" /> Create Goal
        </button>
      </div>

      {/* Summary Banner */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Saved in Goals</span>
          <div className="text-2xl font-black text-emerald-700 mt-1">
            {formatMinorUnits(totalSavedAcrossGoals, currency)}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Total across {goals.length} target(s)</p>
        </div>

        <div>
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Combined Target Volume</span>
          <div className="text-2xl font-black text-slate-900 mt-1">
            {formatMinorUnits(totalTargetAcrossGoals, currency)}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Overall: {totalTargetAcrossGoals > 0 ? Math.round((totalSavedAcrossGoals / totalTargetAcrossGoals) * 100) : 0}% achieved
          </p>
        </div>

        <div>
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Completed Milestones</span>
          <div className="text-2xl font-black text-indigo-700 mt-1">
            {goals.filter(g => g.is_completed === 1).length} of {goals.length}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Fully funded targets</p>
        </div>
      </div>

      {/* Goals Grid */}
      {loading ? (
        <div className="p-12 text-center text-xs text-slate-400">Loading goals...</div>
      ) : goals.length === 0 ? (
        <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center space-y-3">
          <Target className="w-10 h-10 text-slate-300 mx-auto" />
          <h3 className="text-sm font-bold text-slate-800">No financial milestones set</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Establish a 3-month emergency fund, a home deposit target, or a travel reserve.
          </p>
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="mt-2 inline-flex items-center gap-1.5 bg-slate-900 text-white text-xs font-semibold px-4 py-2 rounded-xl"
          >
            <Plus className="w-4 h-4" /> Create First Goal
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {goals.map(g => (
            <div key={g.id} className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-bold text-slate-900">{g.name}</h4>
                    {g.is_completed === 1 && (
                      <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Reached
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-slate-400 capitalize">
                    {g.category?.replace('_', ' ') || 'Savings'}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => handleDeleteGoal(g.id, g.name)}
                  className="text-slate-400 hover:text-red-600 p-1 rounded"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Progress & Balances */}
              <div className="space-y-2">
                <div className="flex items-baseline justify-between">
                  <span className="text-xl font-black text-slate-900">
                    {formatMinorUnits(g.current_amount_minor, currency)}
                  </span>
                  <span className="text-xs font-bold text-slate-600">
                    Target: {formatMinorUnits(g.target_amount_minor, currency)}
                  </span>
                </div>

                <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      g.is_completed === 1 ? 'bg-emerald-600' : 'bg-emerald-500'
                    }`}
                    style={{ width: `${g.percentage_completed}%` }}
                  />
                </div>

                <div className="flex justify-between text-[11px] text-slate-500 pt-0.5">
                  <span>{g.percentage_completed}% funded</span>
                  <span>{formatMinorUnits(g.remaining_minor, currency)} to go</span>
                </div>
              </div>

              {/* Bottom Actions */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <div className="text-xs text-slate-500">
                  {g.target_date ? (
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      Target: {g.target_date}
                    </span>
                  ) : (
                    <span>No deadline set</span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => openContributeModal(g)}
                  className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors shadow-2xs"
                >
                  <Coins className="w-3.5 h-3.5 text-amber-400" /> Contribute
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Goal Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
              <h3 className="text-sm font-bold text-slate-900">Create Financial Milestone</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            {error && (
              <div className="mx-6 mt-4 p-3 rounded-xl bg-red-50 text-red-700 text-xs border border-red-200">
                {error}
              </div>
            )}

            <form onSubmit={handleSaveGoal} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Goal Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 6-Month Emergency Fund, Japan Trip"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Target Amount ({currency})</label>
                  <input
                    type="number"
                    step="any"
                    required
                    placeholder="150000"
                    value={targetAmount}
                    onChange={e => setTargetAmount(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-bold text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Initial Saved ({currency})</label>
                  <input
                    type="number"
                    step="any"
                    placeholder="0"
                    value={currentAmount}
                    onChange={e => setCurrentAmount(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Category</label>
                  <select
                    value={category}
                    onChange={e => setCategory(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-medium"
                  >
                    <option value="emergency_fund">Emergency Fund</option>
                    <option value="savings_target">Savings Target</option>
                    <option value="major_purchase">Major Purchase</option>
                    <option value="vacation">Vacation / Travel</option>
                    <option value="investment">Investment Milestone</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Target Date (Optional)</label>
                  <input
                    type="date"
                    value={targetDate}
                    onChange={e => setTargetDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-medium"
                  />
                </div>
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
                  Create Goal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Contribute Modal */}
      {contributeModalOpen && targetGoal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Add Contribution</h3>
                <p className="text-xs text-slate-500">Toward {targetGoal.name}</p>
              </div>
              <button onClick={() => setContributeModalOpen(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleExecuteContribution} className="p-6 space-y-4">
              {contributeError && (
                <div className="p-3 bg-rose-50 text-rose-700 text-xs rounded-xl border border-rose-200">
                  {contributeError}
                </div>
              )}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Contribution Amount ({currency})</label>
                <input
                  type="number"
                  step="any"
                  required
                  autoFocus
                  placeholder="e.g. 5000"
                  value={contributeAmount}
                  onChange={e => setContributeAmount(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-base font-bold text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Note (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Monthly allocation from salary"
                  value={contributeNotes}
                  onChange={e => setContributeNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setContributeModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={contributing}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs px-5 py-2 rounded-xl shadow-sm disabled:opacity-50"
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
