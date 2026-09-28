/**
 * PRYORA User Onboarding Flow
 * 
 * Clean, friction-free onboarding designed for rapid access to the Expense Tracker.
 * Lets the user choose their base currency and optional starting account,
 * with an instant 1-click skip straight into expense tracking.
 */

import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { SUPPORTED_CURRENCIES } from '../lib/currency';
import {
  ArrowRight,
  Wallet,
  CreditCard,
  Building2,
  Plus,
  Trash2,
  Sparkles,
  Zap,
  CheckCircle,
} from 'lucide-react';

interface AccountDraft {
  name: string;
  type: string;
  balance: string;
  institution?: string;
}

interface OnboardingModalProps {
  isOpen?: boolean;
  onCompleted?: () => void;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({ onCompleted }) => {
  const { user, completeOnboarding } = useAuth();
  const [step, setStep] = useState<number>(1);
  const [currency, setCurrency] = useState<string>(user?.currency || 'INR');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Accounts step state - clean starting accounts without forced dummy amounts!
  const [accounts, setAccounts] = useState<AccountDraft[]>([
    { name: 'Cash Wallet', type: 'cash', balance: '0', institution: 'Cash' },
  ]);

  const addAccountRow = (type: string = 'checking', defaultName: string = 'Bank Account') => {
    setAccounts([
      ...accounts,
      { name: defaultName, type, balance: '0', institution: type === 'cash' ? 'Cash' : 'Bank' },
    ]);
  };

  const removeAccountRow = (index: number) => {
    if (accounts.length <= 1) return;
    setAccounts(accounts.filter((_, i) => i !== index));
  };

  const handleFinish = async (useDefaults: boolean = false) => {
    setIsSubmitting(true);
    setError(null);
    try {
      const finalAccounts = useDefaults
        ? [
            { name: 'Cash Wallet', type: 'cash', balance: 0, institution: 'Cash' },
            { name: 'Primary Checking', type: 'checking', balance: 0, institution: 'Bank' },
          ]
        : accounts.map(a => ({
            name: a.name.trim() || 'Main Account',
            type: a.type,
            balance: parseFloat(a.balance) || 0,
            initialBalance: parseFloat(a.balance) || 0,
            institution: a.institution || '',
          }));

      await completeOnboarding({
        currency,
        profile: {
          currency,
          displayName: user?.display_name || 'My Workspace',
        },
        accounts: finalAccounts,
      });

      if (onCompleted) {
        onCompleted();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to complete setup. Please try again.');
      setIsSubmitting(false);
    }
  };

  const currentCurrencyObj = SUPPORTED_CURRENCIES.find(c => c.code === currency) || SUPPORTED_CURRENCIES[0];
  const currentCurrencySymbol = currentCurrencyObj?.symbol || '₹';

  return (
    <div id="onboarding_modal" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="bg-slate-900 text-white px-6 sm:px-8 py-5 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-emerald-500 text-slate-950 font-black text-sm flex items-center justify-center tracking-tighter shadow-sm">
              P
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-sm tracking-wider text-white">PRYORA</span>
                <span className="text-[10px] text-emerald-400 font-semibold uppercase tracking-wider bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                  Quick Setup
                </span>
              </div>
              <h2 className="text-sm font-medium text-slate-300 mt-0.5">
                {step === 1 ? 'Step 1: Choose Your Currency' : 'Step 2: Your Starting Account'}
              </h2>
            </div>
          </div>

          {/* Friction-Free Skip Button */}
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => handleFinish(true)}
            className="text-xs text-slate-400 hover:text-emerald-400 font-semibold px-2.5 py-1.5 rounded-lg hover:bg-slate-800/80 transition-all flex items-center gap-1.5"
            title="Skip setup and start tracking expenses immediately"
          >
            <span>Skip to Tracker</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Step Indicator Bar */}
        <div className="w-full bg-slate-100 h-1 flex">
          <div className={`h-full bg-emerald-500 transition-all duration-300 ${step === 1 ? 'w-1/2' : 'w-full'}`} />
        </div>

        {error && (
          <div className="mx-6 sm:mx-8 mt-4 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
            {error}
          </div>
        )}

        {/* Step 1: Currency Selection */}
        {step === 1 && (
          <div className="p-6 sm:p-8 space-y-6">
            <div>
              <h3 className="text-base font-bold text-slate-900">What currency do you spend in?</h3>
              <p className="text-xs text-slate-500 mt-1">
                Your expenses, balances, and reports will be recorded in this currency.
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 max-h-60 overflow-y-auto pr-1">
              {SUPPORTED_CURRENCIES.map(curr => {
                const isSelected = currency === curr.code;
                return (
                  <button
                    key={curr.code}
                    type="button"
                    onClick={() => setCurrency(curr.code)}
                    className={`p-3 rounded-xl border text-left transition-all relative ${
                      isSelected
                        ? 'border-emerald-600 bg-emerald-50/50 ring-2 ring-emerald-500/20 text-slate-900 shadow-xs'
                        : 'border-slate-200 hover:border-slate-300 text-slate-700 hover:bg-slate-50/50'
                    }`}
                  >
                    {isSelected && (
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-600 absolute top-2.5 right-2.5" />
                    )}
                    <div className="text-xl font-black text-slate-900">{curr.symbol}</div>
                    <div className="font-bold text-xs mt-0.5">{curr.code}</div>
                    <div className="text-[10px] text-slate-400 truncate">{curr.name}</div>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => handleFinish(true)}
                disabled={isSubmitting}
                className="text-xs font-semibold text-slate-500 hover:text-slate-800 py-2"
              >
                Use defaults & skip
              </button>
              <button
                type="button"
                onClick={() => setStep(2)}
                className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white px-5 py-2.5 rounded-xl font-semibold text-xs transition-colors shadow-sm"
              >
                Next: Account Setup <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Starting Account Setup */}
        {step === 2 && (
          <div className="p-6 sm:p-8 space-y-6">
            <div>
              <h3 className="text-base font-bold text-slate-900">Configure your spending account</h3>
              <p className="text-xs text-slate-500 mt-1">
                Enter your initial balance if you'd like, or leave as 0.00 to start fresh.
              </p>
            </div>

            {/* Account List */}
            <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
              {accounts.map((acc, index) => (
                <div key={index} className="p-3.5 rounded-2xl border border-slate-200 bg-slate-50/60 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-700 shrink-0">
                      {acc.type === 'credit_card' ? (
                        <CreditCard className="w-4 h-4 text-rose-500" />
                      ) : acc.type === 'cash' ? (
                        <Wallet className="w-4 h-4 text-amber-500" />
                      ) : (
                        <Building2 className="w-4 h-4 text-blue-500" />
                      )}
                    </div>
                    <select
                      value={acc.type}
                      onChange={e => {
                        const next = [...accounts];
                        next[index].type = e.target.value;
                        if (e.target.value === 'cash' && next[index].name === 'Bank Account') {
                          next[index].name = 'Cash Wallet';
                        }
                        setAccounts(next);
                      }}
                      className="bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    >
                      <option value="cash">Cash</option>
                      <option value="checking">Bank / Checking</option>
                      <option value="savings">Savings</option>
                      <option value="credit_card">Credit Card</option>
                    </select>
                  </div>

                  <div className="flex-1">
                    <input
                      type="text"
                      placeholder="Account Name (e.g. Cash, HDFC, Chase)"
                      value={acc.name}
                      onChange={e => {
                        const next = [...accounts];
                        next[index].name = e.target.value;
                        setAccounts(next);
                      }}
                      className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>

                  <div className="w-full sm:w-36">
                    <div className="relative">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">
                        {currentCurrencySymbol}
                      </span>
                      <input
                        type="number"
                        step="any"
                        placeholder="0.00"
                        value={acc.balance}
                        onChange={e => {
                          const next = [...accounts];
                          next[index].balance = e.target.value;
                          setAccounts(next);
                        }}
                        className="w-full bg-white border border-slate-200 rounded-lg pl-7 pr-2.5 py-1.5 text-xs font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>
                  </div>

                  {accounts.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeAccountRow(index)}
                      className="text-slate-400 hover:text-rose-500 p-1.5 transition-colors self-end sm:self-center"
                      title="Remove"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Quick Add Presets */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="text-[11px] text-slate-400 font-medium">Add another:</span>
              <button
                type="button"
                onClick={() => addAccountRow('checking', 'Bank Account')}
                className="text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-700 px-2.5 py-1 rounded-lg font-medium transition-colors flex items-center gap-1"
              >
                <Plus className="w-3 h-3" /> Bank
              </button>
              <button
                type="button"
                onClick={() => addAccountRow('credit_card', 'Credit Card')}
                className="text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-700 px-2.5 py-1 rounded-lg font-medium transition-colors flex items-center gap-1"
              >
                <Plus className="w-3 h-3" /> Credit Card
              </button>
            </div>

            {/* Action Bar */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setStep(1)}
                disabled={isSubmitting}
                className="text-xs font-semibold text-slate-500 hover:text-slate-800"
              >
                Back
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => handleFinish(true)}
                  className="text-xs font-semibold text-slate-500 hover:text-slate-800 px-3 py-2"
                >
                  Skip & Use Defaults
                </button>
                <button
                  id="btn_finish_onboarding"
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => handleFinish(false)}
                  className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2.5 rounded-xl font-bold text-xs transition-all shadow-md disabled:opacity-50"
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span>{isSubmitting ? 'Setting up...' : 'Start Tracking Expenses'}</span>
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
