/**
 * PRYORA Subscriptions & Recurring Obligations View
 */

import React, { useState, useEffect, useCallback } from 'react';
import { RecurringRule, Account, Category } from '../types';
import { apiRequest } from '../lib/api';
import { formatMinorUnits } from '../lib/currency';
import { useAuth } from '../context/AuthContext';
import { ConfirmDialog } from './common/ConfirmDialog';
import {
  CalendarClock,
  Plus,
  Zap,
  Trash2,
  Edit2,
  Calendar,
  X,
  CreditCard,
  CheckCircle2,
} from 'lucide-react';

interface SubscriptionsViewProps {
  accounts: Account[];
  categories: Category[];
  onDataChanged: () => void;
}

export const SubscriptionsView: React.FC<SubscriptionsViewProps> = ({
  accounts,
  categories,
  onDataChanged,
}) => {
  const { user } = useAuth();
  const currency = user?.currency || 'INR';

  const [rules, setRules] = useState<RecurringRule[]>([]);
  const [summary, setSummary] = useState<any>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [recordingId, setRecordingId] = useState<string | null>(null);

  // Modal
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingRule, setEditingRule] = useState<RecurringRule | null>(null);
  const [merchant, setMerchant] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [frequency, setFrequency] = useState<string>('monthly');
  const [accountId, setAccountId] = useState<string>('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [nextExpectedDate, setNextExpectedDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [isSubscription, setIsSubscription] = useState<boolean>(true);
  const [notes, setNotes] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  // Deletion and feedback state (iframe-safe, declared at top level)
  const [ruleToDelete, setRuleToDelete] = useState<{ id: string; name: string } | null>(null);
  const [isDeletingRule, setIsDeletingRule] = useState<boolean>(false);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);

  const fetchRules = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiRequest<any>('/api/recurring');
      setRules(data.rules || []);
      setSummary(data.summary || {});
    } catch (err) {
      console.error('Error fetching recurring rules:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRules();
  }, [fetchRules]);

  const openAddModal = () => {
    setEditingRule(null);
    setMerchant('');
    setAmount('');
    setFrequency('monthly');
    setAccountId(accounts[0]?.id || '');
    setCategoryId(categories.filter(c => c.type === 'expense')[0]?.id || '');
    setNextExpectedDate(new Date().toISOString().slice(0, 10));
    setIsSubscription(true);
    setNotes('');
    setError(null);
    setIsModalOpen(true);
  };

  const handleSaveRule = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) {
      setError('Please enter a valid amount.');
      return;
    }

    if (!merchant.trim()) {
      setError('Service or merchant name is required.');
      return;
    }

    if (!accountId) {
      setError('Please select an account for this payment.');
      return;
    }

    try {
      const payload: any = {
        merchant: merchant.trim(),
        amount: amt,
        frequency,
        accountId,
        categoryId: categoryId || null,
        nextExpectedDate,
        isSubscription,
        notes: notes.trim() || null,
      };

      if (editingRule) {
        await apiRequest(`/api/recurring/${editingRule.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
      } else {
        await apiRequest('/api/recurring', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }

      setIsModalOpen(false);
      fetchRules();
      onDataChanged();
    } catch (err: any) {
      setError(err.message || 'Could not save recurring rule.');
    }
  };

  const handleRecordNow = async (id: string, merchantName: string) => {
    setRecordingId(id);
    setStatusNotice(null);
    setStatusError(null);
    try {
      const res = await apiRequest<any>(`/api/recurring/${id}/record-now`, { method: 'POST' });
      fetchRules();
      onDataChanged();
      setStatusNotice(res.message || `Transaction recorded for ${merchantName}.`);
      setTimeout(() => setStatusNotice(null), 4000);
    } catch (err: any) {
      setStatusError(err.message || 'Could not record recurring transaction.');
    } finally {
      setRecordingId(null);
    }
  };

  const handleDeleteRule = (id: string, name: string) => {
    setStatusNotice(null);
    setStatusError(null);
    setRuleToDelete({ id, name });
  };

  const confirmDeleteRule = async () => {
    if (!ruleToDelete) return;
    setIsDeletingRule(true);
    setStatusNotice(null);
    setStatusError(null);
    try {
      await apiRequest(`/api/recurring/${ruleToDelete.id}`, { method: 'DELETE' });
      setStatusNotice(`Recurring rule for "${ruleToDelete.name}" deleted.`);
      setTimeout(() => setStatusNotice(null), 4000);
      setRuleToDelete(null);
      fetchRules();
      onDataChanged();
    } catch (err: any) {
      setStatusError(err.message || 'Could not delete recurring rule. Please try again.');
    } finally {
      setIsDeletingRule(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Subscriptions & Recurring Commitments</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Track fixed commitments, monthly equivalents, and auto-advance payment calendars.
          </p>
        </div>

        <button
          id="btn_add_recurring"
          type="button"
          onClick={openAddModal}
          className="bg-slate-900 hover:bg-slate-800 text-white font-semibold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" /> Add Subscription / Obligation
        </button>
      </div>

      {statusNotice && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{statusNotice}</span>
          </div>
          <button type="button" onClick={() => setStatusNotice(null)} className="text-emerald-700 hover:text-emerald-900 font-bold ml-2">
            ✕
          </button>
        </div>
      )}

      {statusError && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between animate-in fade-in">
          <span>{statusError}</span>
          <button type="button" onClick={() => setStatusError(null)} className="text-rose-700 hover:text-rose-900 font-bold ml-2">
            ✕
          </button>
        </div>
      )}

      {/* Summary Cards */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Monthly Recurring Commitment</span>
          <div className="text-2xl font-black text-slate-900 mt-1">
            {formatMinorUnits(summary.total_monthly_recurring_expense_minor || 0, currency)}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Normalized monthly cost of all recurring rules</p>
        </div>

        <div>
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Active Subscriptions</span>
          <div className="text-2xl font-black text-indigo-700 mt-1">
            {summary.active_subscriptions_count || 0}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            {formatMinorUnits(summary.total_monthly_subscription_minor || 0, currency)} / month
          </p>
        </div>

        <div>
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Annualized Subscription Drain</span>
          <div className="text-2xl font-black text-slate-900 mt-1">
            {formatMinorUnits(summary.total_annual_subscription_minor || 0, currency)}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Annual subscription burn rate</p>
        </div>
      </div>

      {/* Rules List */}
      {loading ? (
        <div className="p-12 text-center text-xs text-slate-400">Loading recurring rules...</div>
      ) : rules.length === 0 ? (
        <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center space-y-3">
          <CalendarClock className="w-10 h-10 text-slate-300 mx-auto" />
          <h3 className="text-sm font-bold text-slate-800">No subscriptions or recurring obligations tracked</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Add recurring rent, streaming services, gym memberships, or utilities to receive upcoming payment reminders.
          </p>
          <button
            type="button"
            onClick={openAddModal}
            className="mt-2 inline-flex items-center gap-1.5 bg-slate-900 text-white text-xs font-semibold px-4 py-2 rounded-xl"
          >
            <Plus className="w-4 h-4" /> Add First Obligation
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {rules.map(rule => (
            <div key={rule.id} className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-bold text-slate-900">{rule.merchant}</h4>
                    {rule.is_subscription === 1 && (
                      <span className="text-[9px] font-bold bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded border border-indigo-100">
                        Sub
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {rule.frequency} • {rule.account_name}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => handleDeleteRule(rule.id, rule.merchant)}
                  className="text-slate-400 hover:text-red-600 p-1 rounded"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="space-y-1">
                <div className="flex items-baseline justify-between">
                  <span className="text-xl font-black text-slate-900">
                    {formatMinorUnits(rule.amount_minor, currency)}
                  </span>
                  <span className="text-xs font-semibold text-slate-500 capitalize">
                    per {rule.frequency === 'yearly' ? 'year' : rule.frequency === 'weekly' ? 'week' : 'month'}
                  </span>
                </div>

                {rule.frequency !== 'monthly' && (
                  <div className="text-[11px] text-slate-400">
                    Monthly equivalent: <strong>{formatMinorUnits(rule.monthly_equivalent_minor, currency)}</strong>
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs text-slate-600">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <span>Next: <strong>{rule.next_expected_date}</strong></span>
                </div>

                <button
                  type="button"
                  disabled={recordingId === rule.id}
                  onClick={() => handleRecordNow(rule.id, rule.merchant)}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors shadow-2xs disabled:opacity-50"
                  title="Record transaction now & roll date forward"
                >
                  <Zap className="w-3 h-3" /> Record Now
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Obligation Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
              <h3 className="text-sm font-bold text-slate-900">Add Recurring Obligation</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            {error && (
              <div className="mx-6 mt-4 p-3 rounded-xl bg-red-50 text-red-700 text-xs border border-red-200">
                {error}
              </div>
            )}

            <form onSubmit={handleSaveRule} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Service / Payee</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Netflix, Rent, Gym Membership, Internet"
                  value={merchant}
                  onChange={e => setMerchant(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Amount ({currency})</label>
                  <input
                    type="number"
                    step="any"
                    required
                    placeholder="0.00"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-bold text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Frequency</label>
                  <select
                    value={frequency}
                    onChange={e => setFrequency(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-medium"
                  >
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Payment Account</label>
                  <select
                    value={accountId}
                    onChange={e => setAccountId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-medium"
                  >
                    {accounts.map(a => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Next Expected Date</label>
                  <input
                    type="date"
                    required
                    value={nextExpectedDate}
                    onChange={e => setNextExpectedDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-medium"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="chk_is_sub"
                  checked={isSubscription}
                  onChange={e => setIsSubscription(e.target.checked)}
                  className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                />
                <label htmlFor="chk_is_sub" className="text-xs font-semibold text-slate-700">
                  Classify as active digital subscription
                </label>
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
                  Save Obligation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Dialog for Recurring Rule Deletion (Iframe-safe, replaces window.confirm) */}
      <ConfirmDialog
        isOpen={!!ruleToDelete}
        title="Delete Recurring Obligation"
        message={`Are you sure you want to delete the recurring rule for "${ruleToDelete?.name}"? Future auto-advances will be cancelled.`}
        confirmLabel="Delete Rule"
        isLoading={isDeletingRule}
        onConfirm={confirmDeleteRule}
        onCancel={() => {
          if (!isDeletingRule) setRuleToDelete(null);
        }}
      />
    </div>
  );
};
