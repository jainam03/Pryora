/**
 * PRYORA Full Ledger & Transactions Management View
 * 
 * Features:
 * - Natural-language query search
 * - Comprehensive multi-dimensional filtering (Account, Category, Type, Date)
 * - Duplicate transaction detection banner with 1-click resolution
 * - Fast transaction actions: Edit, Duplicate, Delete, View Receipt
 * - Export filtered or all transactions to CSV
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Transaction, Account, Category } from '../types';
import { apiRequest } from '../lib/api';
import { formatMinorUnits } from '../lib/currency';
import { useAuth } from '../context/AuthContext';
import { ConfirmDialog } from './common/ConfirmDialog';
import {
  Search,
  Filter,
  Download,
  Plus,
  Trash2,
  Copy,
  Edit2,
  Receipt,
  ArrowRightLeft,
  ArrowDownLeft,
  ArrowUpRight,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  CheckCircle2,
  X,
} from 'lucide-react';

interface TransactionsViewProps {
  accounts: Account[];
  categories: Category[];
  onOpenCreateModal: () => void;
  onEditTransaction: (tx: Transaction) => void;
  onViewReceipt: (txId: string, merchant: string) => void;
  onDataChanged: () => void;
}

export const TransactionsView: React.FC<TransactionsViewProps> = ({
  accounts,
  categories,
  onOpenCreateModal,
  onEditTransaction,
  onViewReceipt,
  onDataChanged,
}) => {
  const { user } = useAuth();
  const currency = user?.currency || 'INR';

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalCount, setTotalCount] = useState<number>(0);

  // Filters
  const [search, setSearch] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [accountFilter, setAccountFilter] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // Duplicates banner
  const [duplicates, setDuplicates] = useState<any[]>([]);

  // Debounce search input to provide responsive typing without spamming network requests
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 250);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '30',
      });

      if (debouncedSearch.trim()) params.set('search', debouncedSearch.trim());
      if (typeFilter) params.set('type', typeFilter);
      if (accountFilter) params.set('accountId', accountFilter);
      if (categoryFilter) params.set('categoryId', categoryFilter);
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);

      const data = await apiRequest<any>(`/api/transactions?${params.toString()}`);
      setTransactions(data.transactions || []);
      setTotalPages(data.pagination?.totalPages || 1);
      setTotalCount(data.pagination?.total || 0);

      // Also check duplicates
      const dupData = await apiRequest<any>('/api/transactions/duplicates');
      setDuplicates(dupData.duplicates || []);
    } catch (err) {
      console.error('Error fetching transactions:', err);
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, typeFilter, accountFilter, categoryFilter, startDate, endDate]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  // Deletion confirmation state (iframe-safe, no window.confirm)
  const [txToDelete, setTxToDelete] = useState<{ id: string; merchant: string } | null>(null);
  const [isDeletingTx, setIsDeletingTx] = useState<boolean>(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  const handleDelete = (id: string, merchant: string) => {
    setActionError(null);
    setTxToDelete({ id, merchant });
  };

  const confirmDeleteTransaction = async () => {
    if (!txToDelete) return;
    setIsDeletingTx(true);
    setActionError(null);
    try {
      await apiRequest(`/api/transactions/${txToDelete.id}`, { method: 'DELETE' });
      setActionFeedback(`Transaction "${txToDelete.merchant}" deleted.`);
      setTimeout(() => setActionFeedback(null), 4000);
      setTxToDelete(null);
      fetchTransactions();
      onDataChanged();
    } catch (err: any) {
      setActionError(err.message || 'Could not delete transaction. Please try again.');
    } finally {
      setIsDeletingTx(false);
    }
  };

  const handleDuplicate = async (id: string) => {
    setActionError(null);
    try {
      await apiRequest(`/api/transactions/${id}/duplicate`, { method: 'POST' });
      setActionFeedback('Transaction duplicated to today.');
      setTimeout(() => setActionFeedback(null), 4000);
      fetchTransactions();
      onDataChanged();
    } catch (err: any) {
      setActionError(err.message || 'Could not duplicate transaction.');
    }
  };

  const handleExportCsv = () => {
    window.location.href = '/api/data/export/csv';
  };

  const clearFilters = () => {
    setSearch('');
    setDebouncedSearch('');
    setTypeFilter('');
    setAccountFilter('');
    setCategoryFilter('');
    setStartDate('');
    setEndDate('');
    setPage(1);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Controls Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Ledger & Transactions</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {totalCount} transaction(s) recorded with double-entry balance integrity.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleExportCsv}
            className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-semibold px-3.5 py-2 rounded-xl text-xs flex items-center gap-1.5 transition-colors shadow-2xs"
          >
            <Download className="w-3.5 h-3.5" /> Export CSV
          </button>
          <button
            id="btn_record_transaction"
            type="button"
            onClick={onOpenCreateModal}
            className="bg-slate-900 hover:bg-slate-800 text-white font-semibold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" /> Record Transaction
          </button>
        </div>
      </div>

      {/* Prominent Top Search Bar & Filters */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
        {/* Main Search Input */}
        <div className="relative flex items-center">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none" />
          <input
            id="transactions_search_input"
            data-testid="transactions-search-input"
            type="text"
            placeholder="Search by merchant name or notes (e.g. Swiggy, grocery, 'above 1000')..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                setDebouncedSearch(search);
                setPage(1);
              }
            }}
            className="w-full pl-10 pr-10 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-200 bg-slate-50/60 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition-all placeholder:text-slate-400 text-slate-900 font-medium"
            aria-label="Filter transactions by merchant name or notes"
          />
          {search && (
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setDebouncedSearch('');
                setPage(1);
              }}
              className="absolute right-3 p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              title="Clear search"
              aria-label="Clear search"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Filter Controls Row */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 text-xs">
          {/* Quick Transaction Type Pills */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mr-1 flex items-center gap-1">
              <Filter className="w-3 h-3" /> Type:
            </span>
            {[
              { label: 'All', value: '' },
              { label: 'Expenses', value: 'expense' },
              { label: 'Income', value: 'income' },
              { label: 'Transfers', value: 'transfer' },
            ].map((tab) => (
              <button
                key={tab.value}
                type="button"
                onClick={() => {
                  setTypeFilter(tab.value);
                  setPage(1);
                }}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all ${
                  typeFilter === tab.value
                    ? 'bg-slate-900 text-white shadow-2xs'
                    : 'bg-slate-100/80 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Account, Category & Reset Actions */}
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={accountFilter}
              onChange={(e) => {
                setAccountFilter(e.target.value);
                setPage(1);
              }}
              className="px-2.5 py-1.5 text-xs rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white focus:bg-white font-medium text-slate-700"
              aria-label="Filter by account"
            >
              <option value="">All Accounts</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>

            <select
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                setPage(1);
              }}
              className="px-2.5 py-1.5 text-xs rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white focus:bg-white font-medium text-slate-700"
              aria-label="Filter by category"
            >
              <option value="">All Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>

            {(search || debouncedSearch || typeFilter || accountFilter || categoryFilter || startDate || endDate) && (
              <button
                type="button"
                onClick={clearFilters}
                className="text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-2.5 py-1.5 rounded-xl transition-colors flex items-center gap-1"
                aria-label="Reset all filters"
              >
                <X className="w-3.5 h-3.5" /> Reset
              </button>
            )}
          </div>
        </div>

        {/* Active Search & Filter Feedback Badge */}
        {(debouncedSearch || typeFilter || accountFilter || categoryFilter) && (
          <div className="flex items-center justify-between text-[11px] text-slate-500 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-semibold text-slate-700">Active filters:</span>
              {debouncedSearch && (
                <span className="inline-flex items-center gap-1 bg-white px-2 py-0.5 rounded border border-slate-200 text-slate-700 font-medium">
                  Search: &ldquo;{debouncedSearch}&rdquo;
                  <button
                    type="button"
                    onClick={() => {
                      setSearch('');
                      setDebouncedSearch('');
                      setPage(1);
                    }}
                    className="hover:text-red-500 ml-0.5 font-bold"
                    aria-label="Clear search filter"
                  >
                    ×
                  </button>
                </span>
              )}
              {typeFilter && (
                <span className="inline-flex items-center gap-1 bg-white px-2 py-0.5 rounded border border-slate-200 text-slate-700 font-medium capitalize">
                  Type: {typeFilter}
                  <button
                    type="button"
                    onClick={() => {
                      setTypeFilter('');
                      setPage(1);
                    }}
                    className="hover:text-red-500 ml-0.5 font-bold"
                    aria-label="Clear type filter"
                  >
                    ×
                  </button>
                </span>
              )}
              {accountFilter && (
                <span className="inline-flex items-center gap-1 bg-white px-2 py-0.5 rounded border border-slate-200 text-slate-700 font-medium">
                  Account: {accounts.find((a) => a.id === accountFilter)?.name || accountFilter}
                  <button
                    type="button"
                    onClick={() => {
                      setAccountFilter('');
                      setPage(1);
                    }}
                    className="hover:text-red-500 ml-0.5 font-bold"
                    aria-label="Clear account filter"
                  >
                    ×
                  </button>
                </span>
              )}
              {categoryFilter && (
                <span className="inline-flex items-center gap-1 bg-white px-2 py-0.5 rounded border border-slate-200 text-slate-700 font-medium">
                  Category: {categories.find((c) => c.id === categoryFilter)?.name || categoryFilter}
                  <button
                    type="button"
                    onClick={() => {
                      setCategoryFilter('');
                      setPage(1);
                    }}
                    className="hover:text-red-500 ml-0.5 font-bold"
                    aria-label="Clear category filter"
                  >
                    ×
                  </button>
                </span>
              )}
            </div>
            <span className="font-semibold text-slate-600 shrink-0 ml-2">
              {totalCount} result{totalCount === 1 ? '' : 's'}
            </span>
          </div>
        )}
      </div>
      {/* Action notices (replaces window.alert) */}
      {actionFeedback && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{actionFeedback}</span>
          </div>
          <button type="button" onClick={() => setActionFeedback(null)} className="text-emerald-700 hover:text-emerald-900 font-bold ml-2">
            ✕
          </button>
        </div>
      )}

      {actionError && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between animate-in fade-in">
          <span>{actionError}</span>
          <button type="button" onClick={() => setActionError(null)} className="text-rose-700 hover:text-rose-900 font-bold ml-2">
            ✕
          </button>
        </div>
      )}

      {/* Duplicate Charges Warning Banner */}
      {duplicates.length > 0 && (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 space-y-2 animate-in fade-in">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span className="text-xs font-bold">
              Potential Duplicate Charges Detected ({duplicates.length})
            </span>
          </div>
          <p className="text-xs text-amber-800">
            PRYORA identified transactions with identical payees and amounts within 48 hours. Inspect and resolve any accidental double-swipes.
          </p>
          <div className="space-y-1.5 pt-1">
            {duplicates.slice(0, 3).map((dup, i) => (
              <div key={i} className="flex items-center justify-between text-xs bg-white/70 p-2 rounded-lg border border-amber-100">
                <span>
                  <strong>{dup.merchant}</strong> ({formatMinorUnits(dup.amount_minor, currency)}) on {dup.original_date} and {dup.duplicate_date}
                </span>
                <button
                  type="button"
                  onClick={() => handleDelete(dup.duplicate_id, dup.merchant)}
                  className="text-xs font-bold text-red-600 hover:text-red-800"
                >
                  Remove Duplicate
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Transactions Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-400">
            Updating ledger...
          </div>
        ) : transactions.length === 0 ? (
          <div className="p-12 text-center text-slate-500 space-y-2">
            <p className="text-sm font-semibold text-slate-800">No matching transactions found.</p>
            <p className="text-xs text-slate-400">
              {debouncedSearch
                ? `No transactions matching "${debouncedSearch}" found in merchant name or notes.`
                : 'Try adjusting your filters or record a new transaction.'}
            </p>
            {(debouncedSearch || typeFilter || accountFilter || categoryFilter) && (
              <button
                type="button"
                onClick={clearFilters}
                className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-slate-900 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg transition-colors"
              >
                Clear all filters
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 uppercase tracking-wider font-semibold text-[10px]">
                <tr>
                  <th className="px-5 py-3">Date</th>
                  <th className="px-5 py-3">Merchant / Description</th>
                  <th className="px-5 py-3">Category</th>
                  <th className="px-5 py-3">Account</th>
                  <th className="px-5 py-3 text-right">Amount</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {transactions.map(tx => (
                  <tr key={tx.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-5 py-3.5 whitespace-nowrap text-slate-500 font-medium">
                      {tx.date}
                    </td>

                    <td className="px-5 py-3.5 font-semibold text-slate-900">
                      <div className="flex items-center gap-2">
                        <span>{tx.merchant}</span>
                        {tx.is_split === 1 && (
                          <span className="text-[9px] font-bold bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded border border-indigo-100">
                            Split
                          </span>
                        )}
                        {tx.receipt_count && tx.receipt_count > 0 ? (
                          <button
                            type="button"
                            onClick={() => onViewReceipt(tx.id, tx.merchant)}
                            className="text-slate-400 hover:text-emerald-600 transition-colors"
                            title="View Attached Receipt"
                          >
                            <Receipt className="w-3.5 h-3.5" />
                          </button>
                        ) : null}
                      </div>
                      {tx.notes && (
                        <p className="text-[11px] text-slate-400 font-normal truncate max-w-xs mt-0.5">
                          {tx.notes}
                        </p>
                      )}
                    </td>

                    <td className="px-5 py-3.5 whitespace-nowrap text-slate-600">
                      {tx.type === 'transfer' ? (
                        <span className="inline-flex items-center gap-1 text-blue-700 bg-blue-50 px-2 py-0.5 rounded text-[11px] font-medium">
                          <ArrowRightLeft className="w-3 h-3" /> Transfer
                        </span>
                      ) : (
                        <span>{tx.category_name || 'Uncategorized'}</span>
                      )}
                    </td>

                    <td className="px-5 py-3.5 whitespace-nowrap text-slate-600">
                      {tx.type === 'transfer' ? (
                        <span>{tx.account_name} → {tx.to_account_name || 'Destination'}</span>
                      ) : (
                        <span>{tx.account_name}</span>
                      )}
                    </td>

                    <td className="px-5 py-3.5 whitespace-nowrap text-right font-black">
                      <span className={
                        tx.type === 'income'
                          ? 'text-emerald-700'
                          : tx.type === 'transfer'
                          ? 'text-blue-700'
                          : 'text-slate-900'
                      }>
                        {tx.type === 'income' ? '+' : tx.type === 'transfer' ? '⇄ ' : '-'}
                        {formatMinorUnits(tx.amount_minor, currency)}
                      </span>
                    </td>

                    <td className="px-5 py-3.5 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-1 text-slate-400">
                        <button
                          type="button"
                          onClick={() => handleDuplicate(tx.id)}
                          className="p-1 hover:text-slate-800 hover:bg-slate-100 rounded transition-colors"
                          title="Duplicate to today"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onEditTransaction(tx)}
                          className="p-1 hover:text-slate-800 hover:bg-slate-100 rounded transition-colors"
                          title="Edit transaction"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(tx.id, tx.merchant)}
                          className="p-1 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                          title="Delete transaction"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <div>
            Showing page <strong>{page}</strong> of <strong>{totalPages}</strong> ({totalCount} total)
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
              className="px-3 py-1 bg-white border border-slate-200 rounded-lg font-medium text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 transition-colors"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
              className="px-3 py-1 bg-white border border-slate-200 rounded-lg font-medium text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 transition-colors"
            >
              Next
            </button>
          </div>
        </div>

      </div>

      {/* Confirmation Dialog for Transaction Deletion (Iframe-safe, replaces window.confirm) */}
      <ConfirmDialog
        isOpen={!!txToDelete}
        title="Delete Transaction"
        message={`Are you sure you want to delete the transaction "${txToDelete?.merchant}"? Account balances will automatically recalculate.`}
        confirmLabel="Delete Transaction"
        isLoading={isDeletingTx}
        onConfirm={confirmDeleteTransaction}
        onCancel={() => {
          if (!isDeletingTx) setTxToDelete(null);
        }}
      />

    </div>
  );
};
