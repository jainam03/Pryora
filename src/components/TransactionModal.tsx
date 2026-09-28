/**
 * PRYORA Transaction Entry & Editing Modal
 * 
 * Supports:
 * - Expense, Income, Transfer types
 * - Split transactions with real-time mathematical validation
 * - Account-to-account balance adjustments
 * - Receipt image attachments (drag/drop + preview)
 * - Tags management
 */

import React, { useState, useEffect, useRef } from 'react';
import { Account, Category, Transaction } from '../types';
import { apiRequest } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { SUPPORTED_CURRENCIES } from '../lib/currency';
import { ConfirmDialog } from './common/ConfirmDialog';
import {
  X,
  Upload,
  Plus,
  Trash2,
  Receipt,
  ArrowRightLeft,
  TrendingDown,
  TrendingUp,
  Tag as TagIcon,
  AlertCircle,
  Check,
  Sparkles,
  Loader2,
  CheckCircle2,
} from 'lucide-react';

interface AiCategorySuggestion {
  categoryId: string | null;
  categoryName: string;
  confidence: number;
  reason: string;
  source: 'gemini' | 'heuristic';
}

interface SplitItem {
  categoryId: string;
  amount: string;
  notes: string;
}

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  onSaved?: () => void;
  accounts: Account[];
  categories: Category[];
  initialTransaction?: Transaction | null;
  transactionToEdit?: Transaction | null;
  initialData?: Partial<Transaction>;
}

export const TransactionModal: React.FC<TransactionModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  onSaved,
  accounts,
  categories,
  initialTransaction,
  transactionToEdit,
  initialData,
}) => {
  const activeTx = initialTransaction || transactionToEdit || null;
  const { user } = useAuth();
  const currency = user?.currency || 'INR';
  const currencySymbol = SUPPORTED_CURRENCIES.find(c => c.code === currency)?.symbol || '₹';

  const [type, setType] = useState<'expense' | 'income' | 'transfer'>('expense');
  const [amount, setAmount] = useState<string>('');
  const [merchant, setMerchant] = useState<string>('');
  const [accountId, setAccountId] = useState<string>('');
  const [toAccountId, setToAccountId] = useState<string>('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState<string>('');
  const [tagInput, setTagInput] = useState<string>('');
  const [tags, setTags] = useState<string[]>([]);

  // Split state
  const [isSplit, setIsSplit] = useState<boolean>(false);
  const [splits, setSplits] = useState<SplitItem[]>([]);

  // Receipt state
  const [receiptDataUrl, setReceiptDataUrl] = useState<string | null>(null);
  const [receiptFileName, setReceiptFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Deletion state
  const [isConfirmingDelete, setIsConfirmingDelete] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  const handleDeleteFromModal = async () => {
    if (!activeTx) return;
    setIsDeleting(true);
    setError(null);
    try {
      await apiRequest(`/api/transactions/${activeTx.id}`, { method: 'DELETE' });
      setIsConfirmingDelete(false);
      if (onSuccess) onSuccess();
      if (onSaved) onSaved();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Could not delete transaction. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  // AI-Driven Auto-Categorization State
  const [aiSuggestion, setAiSuggestion] = useState<AiCategorySuggestion | null>(null);
  const [isAiSuggesting, setIsAiSuggesting] = useState<boolean>(false);
  const [hasUserManuallyChangedCategory, setHasUserManuallyChangedCategory] = useState<boolean>(false);

  // Available categories for current transaction type
  const availableCategories = categories.filter(c => c.type === (type === 'income' ? 'income' : 'expense'));

  // Trigger AI Auto-Categorization
  const triggerAiCategorization = async (merchantName: string) => {
    if (!merchantName || merchantName.trim().length < 2 || isAiSuggesting) return;
    setIsAiSuggesting(true);
    try {
      const res = await apiRequest<{ suggestion: AiCategorySuggestion }>('/api/categories/suggest', {
        method: 'POST',
        body: JSON.stringify({
          merchant: merchantName.trim(),
          type: 'expense',
          availableCategories: availableCategories.map(c => ({ id: c.id, name: c.name })),
        }),
      });

      if (res && res.suggestion) {
        setAiSuggestion(res.suggestion);
        // Automatically select the category if user has not manually set a specific one
        if (!hasUserManuallyChangedCategory && res.suggestion.categoryId) {
          setCategoryId(res.suggestion.categoryId);
        }
      }
    } catch (err) {
      console.warn('AI categorization request failed:', err);
    } finally {
      setIsAiSuggesting(false);
    }
  };

  // Debounced auto-categorization when merchant name changes for an expense
  useEffect(() => {
    if (type !== 'expense' || isSplit || !merchant.trim() || merchant.trim().length < 2) {
      setAiSuggestion(null);
      return;
    }

    // Do not auto-retrigger if viewing/editing an existing unchanged transaction
    if (activeTx && activeTx.merchant.trim().toLowerCase() === merchant.trim().toLowerCase()) {
      return;
    }

    const timer = setTimeout(() => {
      triggerAiCategorization(merchant.trim());
    }, 550);

    return () => clearTimeout(timer);
  }, [merchant, type, isSplit, activeTx]);

  // Initialize form state
  useEffect(() => {
    if (activeTx) {
      setType(activeTx.type as any);
      setAmount((activeTx.amount_minor / 100).toFixed(2));
      setMerchant(activeTx.merchant);
      setAccountId(activeTx.account_id);
      setToAccountId(activeTx.to_account_id || '');
      setCategoryId(activeTx.category_id || '');
      setDate(activeTx.date);
      setNotes(activeTx.notes || '');
      setTags(activeTx.tags ? JSON.parse(activeTx.tags) : []);
      setIsSplit(activeTx.is_split === 1);
    } else {
      setType((initialData?.type as any) || 'expense');
      setAmount('');
      setMerchant('');
      setAccountId(accounts[0]?.id || '');
      setToAccountId(accounts[1]?.id || '');
      const defaultCat = categories.filter(c => c.type === (initialData?.type === 'income' ? 'income' : 'expense'))[0]?.id || '';
      setCategoryId(defaultCat);
      setDate(new Date().toISOString().slice(0, 10));
      setNotes('');
      setTags([]);
      setIsSplit(false);
      setSplits([]);
      setReceiptDataUrl(null);
      setReceiptFileName(null);
      setAiSuggestion(null);
      setHasUserManuallyChangedCategory(false);
    }
    setError(null);
  }, [activeTx, initialData, isOpen, accounts, categories]);

  if (!isOpen) return null;

  // Split calculations
  const totalAmountNum = parseFloat(amount) || 0;
  const splitsSum = splits.reduce((sum, s) => sum + (parseFloat(s.amount) || 0), 0);
  const splitDifference = Math.round((totalAmountNum - splitsSum) * 100) / 100;
  const isSplitValid = Math.abs(splitDifference) < 0.01;

  const handleToggleSplit = () => {
    if (!isSplit) {
      setIsSplit(true);
      // Initialize with 2 default splits
      const half = totalAmountNum > 0 ? (totalAmountNum / 2).toFixed(2) : '';
      setSplits([
        { categoryId: availableCategories[0]?.id || '', amount: half, notes: '' },
        { categoryId: availableCategories[1]?.id || availableCategories[0]?.id || '', amount: half, notes: '' },
      ]);
    } else {
      setIsSplit(false);
      setSplits([]);
    }
  };

  const addSplitRow = () => {
    const rem = splitDifference > 0 ? splitDifference.toFixed(2) : '';
    setSplits([
      ...splits,
      { categoryId: availableCategories[0]?.id || '', amount: rem, notes: '' },
    ]);
  };

  const removeSplitRow = (idx: number) => {
    setSplits(splits.filter((_, i) => i !== idx));
  };

  const handleAddTag = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const val = tagInput.trim().replace(/^#/, '');
      if (val && !tags.includes(val)) {
        setTags([...tags, val]);
        setTagInput('');
      }
    }
  };

  const removeTag = (t: string) => {
    setTags(tags.filter(item => item !== t));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 15 * 1024 * 1024) {
      setError('Receipt image must be under 15MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setReceiptDataUrl(reader.result as string);
      setReceiptFileName(file.name);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const amtNum = parseFloat(amount);
    if (isNaN(amtNum) || amtNum <= 0) {
      setError('Please enter a valid amount greater than zero.');
      return;
    }

    if (!merchant.trim()) {
      setError('Please enter a merchant or transaction description.');
      return;
    }

    if (!accountId) {
      setError('Please select an account.');
      return;
    }

    if (type === 'transfer') {
      if (!toAccountId) {
        setError('Please select a destination account for the transfer.');
        return;
      }
      if (toAccountId === accountId) {
        setError('Destination account must be different from source account.');
        return;
      }
    }

    if (isSplit && !isSplitValid) {
      setError(`Split items do not match total amount. Difference: ${currencySymbol}${Math.abs(splitDifference).toFixed(2)}`);
      return;
    }

    setIsSubmitting(true);

    try {
      const payload: any = {
        type,
        amount: amtNum,
        merchant: merchant.trim(),
        accountId,
        toAccountId: type === 'transfer' ? toAccountId : null,
        categoryId: type === 'transfer' ? null : (isSplit ? null : categoryId),
        date,
        notes: notes.trim() || null,
        tags,
        splits: isSplit ? splits.map(s => ({
          categoryId: s.categoryId,
          amount: parseFloat(s.amount) || 0,
          notes: s.notes.trim() || null,
        })) : null,
        receiptDataUrl: receiptDataUrl || undefined,
        receiptFileName: receiptFileName || undefined,
      };

      if (activeTx) {
        await apiRequest(`/api/transactions/${activeTx.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
      } else {
        await apiRequest('/api/transactions', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }

      if (onSuccess) onSuccess();
      if (onSaved) onSaved();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save transaction. Your database is safe.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div id="transaction_modal" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-md p-3.5 sm:p-4 overflow-y-auto">
      <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl rounded-3xl shadow-2xl border border-slate-200/80 dark:border-white/10 w-full max-w-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            {initialTransaction ? 'Edit Transaction' : 'Record Transaction'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mx-6 mt-4 p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900/40 text-rose-700 dark:text-rose-300 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Type Selector Tabs */}
          <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl border border-slate-200/60 dark:border-white/5">
            <button
              type="button"
              onClick={() => setType('expense')}
              className={`py-2 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all ${
                type === 'expense'
                  ? 'bg-white dark:bg-slate-700 text-rose-600 dark:text-rose-400 shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <TrendingDown className="w-3.5 h-3.5" /> Expense
            </button>
            <button
              type="button"
              onClick={() => setType('income')}
              className={`py-2 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all ${
                type === 'income'
                  ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5" /> Income
            </button>
            <button
              type="button"
              onClick={() => setType('transfer')}
              className={`py-2 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all ${
                type === 'transfer'
                  ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <ArrowRightLeft className="w-3.5 h-3.5" /> Transfer
            </button>
          </div>

          {/* Amount and Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Amount ({currencySymbol})
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 font-extrabold text-base">
                  {currencySymbol}
                </span>
                <input
                  type="number"
                  step="any"
                  required
                  autoFocus
                  placeholder="0.00"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/80 text-lg font-black text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">Date</label>
              <input
                type="date"
                required
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/80 text-sm text-slate-900 dark:text-white font-medium focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Merchant / Description */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                {type === 'transfer' ? 'Transfer Note / Reference' : 'Merchant / Payee / Source'}
              </label>
              {type === 'expense' && merchant.trim().length >= 2 && (
                <button
                  id="btn_ai_auto_categorize"
                  type="button"
                  onClick={() => triggerAiCategorization(merchant.trim())}
                  disabled={isAiSuggesting}
                  className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 inline-flex items-center gap-1 transition-colors disabled:opacity-50"
                  title="Ask AI to categorize this merchant"
                >
                  {isAiSuggesting ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin text-indigo-600 dark:text-indigo-400" />
                      <span>AI Categorizing...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3 h-3 text-indigo-500 fill-indigo-100 dark:fill-indigo-950" />
                      <span>AI Auto-Categorize</span>
                    </>
                  )}
                </button>
              )}
            </div>
            <div className="relative">
              <input
                id="input_tx_merchant"
                type="text"
                required
                placeholder={
                  type === 'expense'
                    ? 'e.g. Starbucks, Uber, Whole Foods, Netflix'
                    : type === 'income'
                    ? 'e.g. Monthly Salary, Freelance project'
                    : 'e.g. Credit Card payment, Savings transfer'
                }
                value={merchant}
                onChange={e => setMerchant(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/80 text-sm font-medium text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
              {isAiSuggesting && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-[11px] text-indigo-600 dark:text-indigo-400 font-semibold bg-white/90 dark:bg-slate-800/90 px-2 py-0.5 rounded-lg border border-indigo-200 dark:border-indigo-800">
                  <Sparkles className="w-3 h-3 animate-spin text-indigo-500" />
                  <span>Analyzing...</span>
                </div>
              )}
            </div>
          </div>

          {/* Account Selection */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                {type === 'transfer' ? 'From Account' : 'Account'}
              </label>
              <select
                value={accountId}
                onChange={e => setAccountId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/80 text-sm font-medium text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              >
                {accounts.map(acc => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name} ({acc.type.replace('_', ' ')})
                  </option>
                ))}
              </select>
            </div>

            {type === 'transfer' ? (
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">To Account</label>
                <select
                  value={toAccountId}
                  onChange={e => setToAccountId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/80 text-sm font-medium text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                >
                  <option value="">Select Destination Account</option>
                  {accounts
                    .filter(a => a.id !== accountId)
                    .map(acc => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name} ({acc.type.replace('_', ' ')})
                      </option>
                    ))}
                </select>
              </div>
            ) : !isSplit ? (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Category</label>
                    {isAiSuggesting && (
                      <span className="inline-flex items-center gap-1 text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold animate-pulse">
                        <Sparkles className="w-2.5 h-2.5" /> AI analyzing...
                      </span>
                    )}
                  </div>
                  {type === 'expense' && (
                    <button
                      type="button"
                      onClick={handleToggleSplit}
                      className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300"
                    >
                      + Split Categories
                    </button>
                  )}
                </div>
                <select
                  id="select_tx_category"
                  value={categoryId}
                  onChange={e => {
                    setCategoryId(e.target.value);
                    setHasUserManuallyChangedCategory(true);
                  }}
                  className={`w-full px-3.5 py-2.5 rounded-2xl border text-sm font-medium text-slate-900 dark:text-white bg-slate-50/70 dark:bg-slate-800/80 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors ${
                    aiSuggestion && categoryId === aiSuggestion.categoryId
                      ? 'border-indigo-300 dark:border-indigo-600 bg-indigo-50/30 dark:bg-indigo-950/40'
                      : 'border-slate-200 dark:border-slate-700'
                  }`}
                >
                  <option value="">Uncategorized</option>
                  {availableCategories.map(cat => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>

                {/* AI Suggestion Banner / Pill */}
                {aiSuggestion && type === 'expense' && (
                  <div
                    id="ai_category_suggestion_banner"
                    className="mt-1.5 p-2.5 rounded-2xl bg-indigo-50/90 dark:bg-indigo-950/70 border border-indigo-200/90 dark:border-indigo-800/80 flex items-start justify-between gap-2 text-xs animate-in fade-in slide-in-from-top-1 shadow-2xs"
                  >
                    <div className="flex items-start gap-2 min-w-0">
                      <div className="w-5 h-5 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                        <Sparkles className="w-3 h-3 fill-current" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[11px] font-bold text-indigo-900 dark:text-indigo-200">
                            {categoryId === aiSuggestion.categoryId ? 'AI Auto-categorized:' : 'AI Suggestion:'}
                          </span>
                          <span className="text-[11px] font-extrabold text-indigo-700 dark:text-indigo-300 bg-white dark:bg-slate-800 px-2 py-0.5 rounded-md border border-indigo-200 dark:border-indigo-700 shadow-2xs">
                            {aiSuggestion.categoryName}
                          </span>
                          <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold bg-indigo-100/70 dark:bg-indigo-900/50 px-1.5 py-0.2 rounded">
                            {Math.round(aiSuggestion.confidence * 100)}% match
                          </span>
                        </div>
                        {aiSuggestion.reason && (
                          <p className="text-[11px] text-indigo-800/80 dark:text-indigo-300/80 mt-1 leading-snug">
                            {aiSuggestion.reason}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 pt-0.5">
                      {categoryId !== aiSuggestion.categoryId && (
                        <button
                          id="btn_apply_ai_category"
                          type="button"
                          onClick={() => {
                            if (aiSuggestion.categoryId) {
                              setCategoryId(aiSuggestion.categoryId);
                              setHasUserManuallyChangedCategory(false);
                            }
                          }}
                          className="px-2.5 py-1 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold shadow-xs transition-colors flex items-center gap-1"
                        >
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Apply</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setAiSuggestion(null)}
                        className="text-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-200 p-1 rounded-lg hover:bg-indigo-100/60 dark:hover:bg-indigo-900/60 transition-colors"
                        title="Dismiss suggestion"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : null}
          </div>

          {/* Split Mode Sub-Form */}
          {isSplit && type !== 'transfer' && (
            <div className="p-4 bg-indigo-50/50 dark:bg-indigo-950/40 rounded-2xl border border-indigo-100 dark:border-indigo-900/50 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-indigo-900 dark:text-indigo-200 uppercase tracking-wider">Split Transaction Details</span>
                <button
                  type="button"
                  onClick={handleToggleSplit}
                  className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-300 font-medium"
                >
                  Cancel Split
                </button>
              </div>

              <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                {splits.map((s, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <select
                      value={s.categoryId}
                      onChange={e => {
                        const next = [...splits];
                        next[idx].categoryId = e.target.value;
                        setSplits(next);
                      }}
                      className="flex-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl px-2.5 py-1.5 text-xs font-medium"
                    >
                      {availableCategories.map(cat => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name}
                        </option>
                      ))}
                    </select>

                    <div className="relative w-28 shrink-0">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-xs">
                        {currencySymbol}
                      </span>
                      <input
                        type="number"
                        step="any"
                        placeholder="0.00"
                        value={s.amount}
                        onChange={e => {
                          const next = [...splits];
                          next[idx].amount = e.target.value;
                          setSplits(next);
                        }}
                        className="w-full pl-6 pr-2 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl text-xs font-semibold"
                      />
                    </div>

                    {splits.length > 2 && (
                      <button
                        type="button"
                        onClick={() => removeSplitRow(idx)}
                        className="text-slate-400 hover:text-rose-500 p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between pt-1 border-t border-indigo-100 dark:border-indigo-900/50 text-xs">
                <button
                  type="button"
                  onClick={addSplitRow}
                  className="text-indigo-700 dark:text-indigo-300 font-bold flex items-center gap-1 hover:text-indigo-900 dark:hover:text-white"
                >
                  <Plus className="w-3.5 h-3.5" /> Add split category
                </button>
                <div className="font-medium">
                  {isSplitValid ? (
                    <span className="text-emerald-700 dark:text-emerald-400 font-bold flex items-center gap-1">
                      <Check className="w-3.5 h-3.5 stroke-[2.5]" /> Exact Match
                    </span>
                  ) : (
                    <span className="text-amber-700 dark:text-amber-400 font-bold">
                      Remaining: {currencySymbol}{splitDifference.toFixed(2)}
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Notes and Tags */}
          <div className="space-y-2">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">Notes (Optional)</label>
              <input
                type="text"
                placeholder="Add contextual details or receipt references"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/80 text-xs font-medium text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">Tags (Press Enter)</label>
              <div className="flex flex-wrap items-center gap-1.5 p-2 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
                {tags.map(t => (
                  <span
                    key={t}
                    className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs px-2.5 py-1 rounded-xl flex items-center gap-1 font-medium shadow-2xs"
                  >
                    #{t}
                    <button type="button" onClick={() => removeTag(t)} className="text-slate-400 hover:text-slate-700 dark:hover:text-white ml-0.5">
                      ×
                    </button>
                  </span>
                ))}
                <input
                  type="text"
                  placeholder="e.g. tax, vacation, reimbursed"
                  value={tagInput}
                  onChange={e => setTagInput(e.target.value)}
                  onKeyDown={handleAddTag}
                  className="bg-transparent text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none min-w-[120px] px-1 py-1"
                />
              </div>
            </div>
          </div>

          {/* Receipt Attachment */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">Receipt Attachment</label>
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />

            {receiptDataUrl ? (
              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                <div className="flex items-center gap-2 text-xs font-medium text-slate-800 dark:text-slate-200">
                  <Receipt className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span className="truncate max-w-[240px]">{receiptFileName || 'receipt_attached.jpg'}</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setReceiptDataUrl(null);
                    setReceiptFileName(null);
                  }}
                  className="text-xs text-rose-600 dark:text-rose-400 hover:text-rose-700 font-bold"
                >
                  Remove
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 rounded-2xl p-3.5 text-center transition-colors flex items-center justify-center gap-2 text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              >
                <Upload className="w-4 h-4 text-slate-400 dark:text-slate-500" /> Upload receipt image (receipt proof)
              </button>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            {activeTx ? (
              <button
                id="btn_modal_delete_transaction"
                type="button"
                onClick={() => setIsConfirmingDelete(true)}
                disabled={isSubmitting || isDeleting}
                className="px-3.5 py-2 text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-colors flex items-center gap-1.5 disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete</span>
              </button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting || isDeleting}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                id="btn_submit_transaction"
                type="submit"
                disabled={isSubmitting || isDeleting}
                className="bg-slate-900 hover:bg-slate-800 dark:bg-emerald-500 dark:hover:bg-emerald-400 text-white dark:text-slate-950 px-6 py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95 disabled:opacity-50"
              >
                {isSubmitting ? 'Saving...' : activeTx ? 'Save Changes' : 'Record Transaction'}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={isConfirmingDelete}
        title="Delete Transaction"
        message={`Are you sure you want to delete this ${activeTx?.merchant || 'transaction'}? Account balances will automatically recalculate.`}
        confirmLabel="Delete Transaction"
        isLoading={isDeleting}
        onConfirm={handleDeleteFromModal}
        onCancel={() => {
          if (!isDeleting) setIsConfirmingDelete(false);
        }}
      />
    </div>
  );
};
