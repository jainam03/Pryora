/**
 * PRYORA Accounts & Net Worth Management View
 * 
 * Features:
 * - Real Assets vs Liabilities ledger calculation
 * - Credit card utilization, limits, statement/due tracking
 * - Safe Credit Card Payment flow (transfer without double-counting)
 * - Add/Edit Account modals
 */

import React, { useState } from 'react';
import { Account } from '../types';
import { apiRequest } from '../lib/api';
import { formatMinorUnits } from '../lib/currency';
import { useAuth } from '../context/AuthContext';
import { AccountIcon } from './common/Icon';
import { ConfirmDialog } from './common/ConfirmDialog';
import {
  Landmark,
  CreditCard,
  Wallet,
  TrendingUp,
  Plus,
  ArrowRightLeft,
  Edit2,
  Trash2,
  ShieldCheck,
  Scale,
  X,
  AlertCircle,
} from 'lucide-react';

interface AccountsViewProps {
  accounts: Account[];
  onRefresh: () => void;
}

export const AccountsView: React.FC<AccountsViewProps> = ({ accounts, onRefresh }) => {
  const { user } = useAuth();
  const currency = user?.currency || 'INR';

  // Add/Edit Account Modal State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [name, setName] = useState<string>('');
  const [type, setType] = useState<string>('checking');
  const [balance, setBalance] = useState<string>('');
  const [institution, setInstitution] = useState<string>('');
  const [creditLimit, setCreditLimit] = useState<string>('');
  const [statementDay, setStatementDay] = useState<string>('');
  const [dueDay, setDueDay] = useState<string>('');
  const [color, setColor] = useState<string>('#3B82F6');
  const [error, setError] = useState<string | null>(null);

  // Pay Credit Card Modal State
  const [payCardModalOpen, setPayCardModalOpen] = useState<boolean>(false);
  const [targetCreditCard, setTargetCreditCard] = useState<Account | null>(null);
  const [paySourceAccountId, setPaySourceAccountId] = useState<string>('');
  const [payAmount, setPayAmount] = useState<string>('');
  const [payDate, setPayDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [paySubmitting, setPaySubmitting] = useState<boolean>(false);
  const [payCardError, setPayCardError] = useState<string | null>(null);

  // Deletion confirmation state (iframe-safe, declared at top level)
  const [accToDelete, setAccToDelete] = useState<Account | null>(null);
  const [isDeletingAcc, setIsDeletingAcc] = useState<boolean>(false);
  const [accountError, setAccountError] = useState<string | null>(null);

  // Net Worth calculations
  const totalAssets = accounts
    .filter(a => a.type !== 'credit_card' && a.type !== 'loan')
    .reduce((sum, a) => sum + (a.current_balance_minor || 0), 0);

  const totalLiabilities = accounts
    .filter(a => a.type === 'credit_card' || a.type === 'loan')
    .reduce((sum, a) => sum + (a.current_balance_minor || 0), 0);

  const netWorth = totalAssets - totalLiabilities;

  const openAddModal = () => {
    setEditingAccount(null);
    setName('');
    setType('checking');
    setBalance('0');
    setInstitution('');
    setCreditLimit('50000');
    setStatementDay('');
    setDueDay('');
    setColor('#3B82F6');
    setError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (acc: Account) => {
    setEditingAccount(acc);
    setName(acc.name);
    setType(acc.type);
    setBalance((acc.current_balance_minor / 100).toFixed(2));
    setInstitution(acc.institution || '');
    setCreditLimit(acc.credit_limit_minor ? (acc.credit_limit_minor / 100).toFixed(2) : '');
    setStatementDay(acc.statement_day ? acc.statement_day.toString() : '');
    setDueDay(acc.due_day ? acc.due_day.toString() : '');
    setColor(acc.color || '#3B82F6');
    setError(null);
    setIsModalOpen(true);
  };

  const handleSaveAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Account name is required.');
      return;
    }

    try {
      const payload: any = {
        name: name.trim(),
        type,
        institution: institution.trim(),
        color,
        creditLimit: type === 'credit_card' && creditLimit ? parseFloat(creditLimit) : undefined,
        statementDay: statementDay ? parseInt(statementDay, 10) : undefined,
        dueDay: dueDay ? parseInt(dueDay, 10) : undefined,
      };

      if (!editingAccount) {
        payload.initialBalance = parseFloat(balance) || 0;
        await apiRequest('/api/accounts', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      } else {
        await apiRequest(`/api/accounts/${editingAccount.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
      }

      setIsModalOpen(false);
      onRefresh();
    } catch (err: any) {
      setError(err.message || 'Could not save account.');
    }
  };

  const openPayCardModal = (card: Account) => {
    setTargetCreditCard(card);
    // Find checking or cash account with highest balance as default source
    const checkingAcc = accounts.find(a => a.type === 'checking' || a.type === 'cash');
    setPaySourceAccountId(checkingAcc?.id || '');
    setPayAmount((card.current_balance_minor / 100).toFixed(2));
    setPayDate(new Date().toISOString().slice(0, 10));
    setPayCardModalOpen(true);
  };

  const handleExecuteCardPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setPayCardError(null);
    if (!targetCreditCard || !paySourceAccountId) return;

    const amt = parseFloat(payAmount);
    if (isNaN(amt) || amt <= 0) {
      setPayCardError('Please enter a valid payment amount.');
      return;
    }

    setPaySubmitting(true);
    try {
      await apiRequest(`/api/accounts/${targetCreditCard.id}/pay-card`, {
        method: 'POST',
        body: JSON.stringify({
          fromAccountId: paySourceAccountId,
          amount: amt,
          date: payDate,
        }),
      });
      setPayCardModalOpen(false);
      onRefresh();
    } catch (err: any) {
      setPayCardError(err.message || 'Payment execution failed.');
    } finally {
      setPaySubmitting(false);
    }
  };

  const handleDeleteAccount = (acc: Account) => {
    setAccountError(null);
    setAccToDelete(acc);
  };

  const confirmDeleteAccount = async () => {
    if (!accToDelete) return;
    setIsDeletingAcc(true);
    setAccountError(null);
    try {
      await apiRequest(`/api/accounts/${accToDelete.id}`, { method: 'DELETE' });
      setAccToDelete(null);
      onRefresh();
    } catch (err: any) {
      setAccountError(err.message || 'Could not delete account. Please try again.');
    } finally {
      setIsDeletingAcc(false);
    }
  };

  const assetAccounts = accounts.filter(a => a.type !== 'credit_card' && a.type !== 'loan');
  const creditAccounts = accounts.filter(a => a.type === 'credit_card');
  const loanAccounts = accounts.filter(a => a.type === 'loan');

  return (
    <div className="space-y-6 pb-12">
      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">Accounts & Net Worth</h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Real-time balance computation derived from double-entry ledger transactions.
          </p>
        </div>

        <button
          id="btn_add_account"
          type="button"
          onClick={openAddModal}
          className="bg-slate-900 hover:bg-slate-800 dark:bg-emerald-500 dark:hover:bg-emerald-400 text-white dark:text-slate-950 font-bold px-4 py-2.5 rounded-2xl text-xs sm:text-sm flex items-center gap-1.5 transition-all shadow-sm active:scale-95 shrink-0"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" /> Add Account
        </button>
      </div>

      {/* Net Worth Summary Strip (Liquid Glass) */}
      <div className="bg-slate-900 dark:bg-slate-900/90 text-white p-5 sm:p-6 rounded-3xl border border-slate-800 dark:border-white/10 shadow-xl backdrop-blur-xl grid grid-cols-1 md:grid-cols-3 gap-6">
        <div>
          <span className="text-xs text-slate-400 dark:text-slate-400 font-bold uppercase tracking-wider">Total Net Worth</span>
          <div className="text-3xl font-black text-white mt-1 tracking-tight">
            {formatMinorUnits(netWorth, currency)}
          </div>
          <p className="text-xs text-slate-400 mt-1">Assets minus liabilities</p>
        </div>

        <div className="border-t md:border-t-0 md:border-l border-slate-800 dark:border-slate-800/80 pt-4 md:pt-0 md:pl-6">
          <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Total Assets</span>
          <div className="text-2xl font-black text-emerald-400 mt-1 tracking-tight">
            {formatMinorUnits(totalAssets, currency)}
          </div>
          <p className="text-xs text-slate-400 mt-1">{assetAccounts.length} asset account(s)</p>
        </div>

        <div className="border-t md:border-t-0 md:border-l border-slate-800 dark:border-slate-800/80 pt-4 md:pt-0 md:pl-6">
          <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Total Liabilities</span>
          <div className="text-2xl font-black text-rose-400 mt-1 tracking-tight">
            {formatMinorUnits(totalLiabilities, currency)}
          </div>
          <p className="text-xs text-slate-400 mt-1">{creditAccounts.length + loanAccounts.length} liability account(s)</p>
        </div>
      </div>

      {accountError && (
        <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900/40 text-rose-800 dark:text-rose-300 text-xs flex items-center justify-between animate-in fade-in">
          <span>{accountError}</span>
          <button type="button" onClick={() => setAccountError(null)} className="text-rose-600 dark:text-rose-400 font-bold ml-2">
            ✕
          </button>
        </div>
      )}

      {/* Section: Bank & Cash Accounts */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider px-1">
          Banking & Liquid Assets ({assetAccounts.length})
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {assetAccounts.map(acc => (
            <div key={acc.id} className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl p-5 rounded-3xl border border-slate-200/80 dark:border-white/10 shadow-xs dark:shadow-slate-950/40 flex flex-col justify-between space-y-4 hover:border-slate-300 dark:hover:border-slate-700 transition-all">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-800 dark:text-slate-200 border border-slate-200/80 dark:border-slate-700 shadow-2xs">
                    <AccountIcon name={acc.icon} className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">{acc.name}</h4>
                    <span className="text-xs text-slate-500 dark:text-slate-400 capitalize">
                      {acc.institution || acc.type.replace('_', ' ')}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1 text-slate-400 dark:text-slate-500">
                  <button
                    type="button"
                    onClick={() => openEditModal(acc)}
                    className="p-1.5 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
                    title="Edit account"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteAccount(acc)}
                    className="p-1.5 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-colors"
                    title="Delete account"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div>
                <span className="text-xs uppercase font-bold text-slate-400 dark:text-slate-500 tracking-wider">Current Balance</span>
                <div className="text-2xl font-black text-slate-900 dark:text-white mt-0.5 tracking-tight">
                  {formatMinorUnits(acc.current_balance_minor, currency)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Section: Credit Cards */}
      {creditAccounts.length > 0 && (
        <div className="space-y-3 pt-2">
          <h3 className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider px-1">
            Credit Cards & Lines of Credit ({creditAccounts.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {creditAccounts.map(card => {
              const owed = card.current_balance_minor;
              const limit = card.credit_limit_minor || 0;
              const available = Math.max(0, limit - owed);
              const utilization = limit > 0 ? Math.round((owed / limit) * 100) : 0;

              return (
                <div key={card.id} className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl p-5 sm:p-6 rounded-3xl border border-slate-200/80 dark:border-white/10 shadow-xs dark:shadow-slate-950/40 space-y-4 hover:border-slate-300 dark:hover:border-slate-700 transition-all">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-100 dark:border-rose-900/40 flex items-center justify-center text-rose-600 dark:text-rose-400 shadow-2xs">
                        <CreditCard className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white">{card.name}</h4>
                        <span className="text-xs text-slate-500 dark:text-slate-400">{card.institution || 'Credit Card'}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openPayCardModal(card)}
                        className="bg-slate-900 hover:bg-slate-800 dark:bg-emerald-500 dark:hover:bg-emerald-400 text-white dark:text-slate-950 text-xs font-bold px-3 py-1.5 rounded-xl flex items-center gap-1 transition-all shadow-sm"
                      >
                        <ArrowRightLeft className="w-3 h-3" /> Pay Card
                      </button>
                      <button
                        type="button"
                        onClick={() => openEditModal(card)}
                        className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-1">
                    <div>
                      <span className="text-xs uppercase font-bold text-slate-400 dark:text-slate-500 tracking-wider">Current Owed</span>
                      <div className="text-xl font-black text-rose-600 dark:text-rose-400 mt-0.5 tracking-tight">
                        {formatMinorUnits(owed, currency)}
                      </div>
                    </div>
                    <div>
                      <span className="text-xs uppercase font-bold text-slate-400 dark:text-slate-500 tracking-wider">Available Credit</span>
                      <div className="text-xl font-black text-slate-900 dark:text-white mt-0.5 tracking-tight">
                        {formatMinorUnits(available, currency)}
                      </div>
                    </div>
                  </div>

                  {limit > 0 && (
                    <div className="space-y-1.5 pt-1 border-t border-slate-100 dark:border-slate-800">
                      <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400">
                        <span>Utilization: <strong className={utilization > 30 ? 'text-rose-500 font-bold' : 'font-bold'}>{utilization}%</strong></span>
                        <span>Total Limit: {formatMinorUnits(limit, currency)}</span>
                      </div>
                      <div className="w-full bg-slate-100 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            utilization > 30 ? 'bg-rose-500' : 'bg-emerald-500'
                          }`}
                          style={{ width: `${Math.min(100, utilization)}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Add / Edit Account Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-md p-4">
          <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl rounded-3xl shadow-2xl border border-slate-200/80 dark:border-white/10 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {editingAccount ? 'Edit Account' : 'Add New Account'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            {error && (
              <div className="mx-6 mt-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 text-xs border border-rose-200 dark:border-rose-900/40">
                {error}
              </div>
            )}

            <form onSubmit={handleSaveAccount} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">Account Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. HDFC Bank, ICICI Coral Card"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/80 text-sm font-medium text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">Account Type</label>
                  <select
                    disabled={!!editingAccount}
                    value={type}
                    onChange={e => setType(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/80 text-sm font-medium text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-none disabled:opacity-50"
                  >
                    <option value="checking">Checking / Current</option>
                    <option value="savings">Savings</option>
                    <option value="cash">Cash</option>
                    <option value="credit_card">Credit Card</option>
                    <option value="investment">Investment</option>
                    <option value="loan">Loan</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">Institution</label>
                  <input
                    type="text"
                    placeholder="e.g. Chase, HDFC"
                    value={institution}
                    onChange={e => setInstitution(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/80 text-sm font-medium text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              {!editingAccount && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Starting Balance ({currency})
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={balance}
                    onChange={e => setBalance(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/80 text-sm font-bold text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              )}

              {type === 'credit_card' && (
                <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">Credit Card Settings</span>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Total Credit Limit</label>
                    <input
                      type="number"
                      step="any"
                      placeholder="100000"
                      value={creditLimit}
                      onChange={e => setCreditLimit(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    />
                  </div>
                </div>
              )}

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
                  {editingAccount ? 'Save Changes' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Pay Credit Card Modal */}
      {payCardModalOpen && targetCreditCard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-md p-4">
          <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl rounded-3xl shadow-2xl border border-slate-200/80 dark:border-white/10 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Credit Card Payment</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Pay down {targetCreditCard.name}</p>
              </div>
              <button onClick={() => setPayCardModalOpen(false)} className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleExecuteCardPayment} className="p-6 space-y-4">
              {payCardError && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 text-xs rounded-xl border border-rose-200 dark:border-rose-900/40">
                  {payCardError}
                </div>
              )}
              <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/50 rounded-xl border border-emerald-200 dark:border-emerald-900/40 text-emerald-900 dark:text-emerald-300 text-xs flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0 mt-0.5" />
                <span>
                  This transfer adjusts balances between your bank and credit card without double-counting as an expense.
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">Pay From Bank Account</label>
                <select
                  required
                  value={paySourceAccountId}
                  onChange={e => setPaySourceAccountId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/80 text-sm font-medium text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-none"
                >
                  <option value="">Select Account</option>
                  {assetAccounts.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({formatMinorUnits(a.current_balance_minor, currency)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">Payment Amount</label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={payAmount}
                    onChange={e => setPayAmount(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/80 text-sm font-bold text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">Payment Date</label>
                  <input
                    type="date"
                    required
                    value={payDate}
                    onChange={e => setPayDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/80 text-sm font-medium text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setPayCardModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={paySubmitting}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-5 py-2.5 rounded-xl transition-all shadow-sm active:scale-95 disabled:opacity-50"
                >
                  {paySubmitting ? 'Recording...' : 'Execute Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Dialog for Account Deletion (Iframe-safe, replaces window.confirm) */}
      <ConfirmDialog
        isOpen={!!accToDelete}
        title="Delete / Archive Account"
        message={`Are you sure you want to remove "${accToDelete?.name}"? If transactions exist, it will be safely archived to preserve ledger balance history.`}
        confirmLabel="Remove Account"
        isLoading={isDeletingAcc}
        onConfirm={confirmDeleteAccount}
        onCancel={() => {
          if (!isDeletingAcc) setAccToDelete(null);
        }}
      />
    </div>
  );
};
