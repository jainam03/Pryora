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
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Accounts & Net Worth</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time balance computation derived from double-entry ledger transactions.
          </p>
        </div>

        <button
          id="btn_add_account"
          type="button"
          onClick={openAddModal}
          className="bg-slate-900 hover:bg-slate-800 text-white font-semibold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" /> Add Account
        </button>
      </div>

      {/* Net Worth Summary Strip */}
      <div className="bg-slate-900 text-white p-6 rounded-2xl border border-slate-800 shadow-xl grid grid-cols-1 md:grid-cols-3 gap-6">
        <div>
          <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Total Net Worth</span>
          <div className="text-3xl font-black text-white mt-1">
            {formatMinorUnits(netWorth, currency)}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Assets minus liabilities</p>
        </div>

        <div className="border-t md:border-t-0 md:border-l border-slate-800 pt-4 md:pt-0 md:pl-6">
          <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Total Assets</span>
          <div className="text-2xl font-black text-emerald-400 mt-1">
            {formatMinorUnits(totalAssets, currency)}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">{assetAccounts.length} asset account(s)</p>
        </div>

        <div className="border-t md:border-t-0 md:border-l border-slate-800 pt-4 md:pt-0 md:pl-6">
          <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Total Liabilities</span>
          <div className="text-2xl font-black text-rose-400 mt-1">
            {formatMinorUnits(totalLiabilities, currency)}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">{creditAccounts.length + loanAccounts.length} liability account(s)</p>
        </div>
      </div>

      {/* Section: Bank & Cash Accounts */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider px-1">
          Banking & Liquid Assets ({assetAccounts.length})
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {assetAccounts.map(acc => (
            <div key={acc.id} className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between space-y-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-800">
                    <AccountIcon name={acc.icon} className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">{acc.name}</h4>
                    <span className="text-[11px] text-slate-500 capitalize">
                      {acc.institution || acc.type.replace('_', ' ')}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1 text-slate-400">
                  <button
                    type="button"
                    onClick={() => openEditModal(acc)}
                    className="p-1 hover:text-slate-700 rounded"
                    title="Edit account"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteAccount(acc)}
                    className="p-1 hover:text-red-600 rounded"
                    title="Delete account"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Current Balance</span>
                <div className="text-2xl font-black text-slate-900 mt-0.5">
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
          <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider px-1">
            Credit Cards & Lines of Credit ({creditAccounts.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {creditAccounts.map(card => {
              const owed = card.current_balance_minor;
              const limit = card.credit_limit_minor || 0;
              const available = Math.max(0, limit - owed);
              const utilization = limit > 0 ? Math.round((owed / limit) * 100) : 0;

              return (
                <div key={card.id} className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-700">
                        <CreditCard className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-slate-900">{card.name}</h4>
                        <span className="text-[11px] text-slate-500">{card.institution || 'Credit Card'}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openPayCardModal(card)}
                        className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors"
                      >
                        <ArrowRightLeft className="w-3 h-3" /> Pay Card
                      </button>
                      <button
                        type="button"
                        onClick={() => openEditModal(card)}
                        className="p-1 text-slate-400 hover:text-slate-700 rounded"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-1">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Current Owed</span>
                      <div className="text-xl font-black text-rose-600 mt-0.5">
                        {formatMinorUnits(owed, currency)}
                      </div>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Available Credit</span>
                      <div className="text-xl font-black text-slate-900 mt-0.5">
                        {formatMinorUnits(available, currency)}
                      </div>
                    </div>
                  </div>

                  {limit > 0 && (
                    <div className="space-y-1 pt-1 border-t border-slate-100">
                      <div className="flex justify-between text-[11px] text-slate-500">
                        <span>Utilization: <strong>{utilization}%</strong></span>
                        <span>Total Limit: {formatMinorUnits(limit, currency)}</span>
                      </div>
                      <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
              <h3 className="text-sm font-bold text-slate-900">
                {editingAccount ? 'Edit Account' : 'Add New Account'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            {error && (
              <div className="mx-6 mt-4 p-3 rounded-xl bg-red-50 text-red-700 text-xs border border-red-200">
                {error}
              </div>
            )}

            <form onSubmit={handleSaveAccount} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Account Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. HDFC Bank, ICICI Coral Card"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-medium focus:ring-1 focus:ring-slate-900 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Account Type</label>
                  <select
                    disabled={!!editingAccount}
                    value={type}
                    onChange={e => setType(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-medium focus:ring-1 focus:ring-slate-900 focus:outline-none disabled:bg-slate-100"
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
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Institution</label>
                  <input
                    type="text"
                    placeholder="e.g. Chase, HDFC"
                    value={institution}
                    onChange={e => setInstitution(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-medium focus:ring-1 focus:ring-slate-900 focus:outline-none"
                  />
                </div>
              </div>

              {!editingAccount && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Starting Balance ({currency})
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={balance}
                    onChange={e => setBalance(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-bold text-slate-900 focus:ring-1 focus:ring-slate-900 focus:outline-none"
                  />
                </div>
              )}

              {type === 'credit_card' && (
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                  <span className="text-xs font-bold text-slate-800">Credit Card Settings</span>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-500 mb-1">Total Credit Limit</label>
                    <input
                      type="number"
                      step="any"
                      placeholder="100000"
                      value={creditLimit}
                      onChange={e => setCreditLimit(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold bg-white"
                    />
                  </div>
                </div>
              )}

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
                  className="bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs px-5 py-2 rounded-xl transition-colors shadow-sm"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Credit Card Payment</h3>
                <p className="text-xs text-slate-500">Pay down {targetCreditCard.name}</p>
              </div>
              <button onClick={() => setPayCardModalOpen(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleExecuteCardPayment} className="p-6 space-y-4">
              {payCardError && (
                <div className="p-3 bg-rose-50 text-rose-700 text-xs rounded-xl border border-rose-200">
                  {payCardError}
                </div>
              )}
              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-emerald-900 text-xs flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                <span>
                  This transfer adjusts balances between your bank and credit card without double-counting as an expense.
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Pay From Bank Account</label>
                <select
                  required
                  value={paySourceAccountId}
                  onChange={e => setPaySourceAccountId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-medium text-slate-900"
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
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Payment Amount</label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={payAmount}
                    onChange={e => setPayAmount(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-bold text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Payment Date</label>
                  <input
                    type="date"
                    required
                    value={payDate}
                    onChange={e => setPayDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-medium text-slate-900"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setPayCardModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={paySubmitting}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs px-5 py-2 rounded-xl transition-colors shadow-sm disabled:opacity-50"
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
