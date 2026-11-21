/**
 * PRYORA Data Hub (Excel / CSV Import Wizard, Exports, Backups & Account Controls)
 */

import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { Account, Category } from '../types';
import { apiRequest, getStoredToken } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { ConfirmDialog } from './common/ConfirmDialog';
import { SpreadsheetImportWizard } from './SpreadsheetImportWizard';
import {
  Upload,
  Download,
  Database,
  FileSpreadsheet,
  Loader2,
  Trash2,
  UserX,
} from 'lucide-react';

interface DataHubViewProps {
  accounts: Account[];
  categories?: Category[];
  onDataChanged: () => void;
  onNavigateToLedger?: () => void;
}

export const DataHubView: React.FC<DataHubViewProps> = ({
  accounts,
  categories = [],
  onDataChanged,
  onNavigateToLedger,
}) => {
  const { isDemoUser, deleteAccount } = useAuth();

  // JSON restore
  const [restoring, setRestoring] = useState<boolean>(false);
  const [restoreResult, setRestoreResult] = useState<string | null>(null);
  const [pendingRestoreData, setPendingRestoreData] = useState<any | null>(null);

  // Export status
  const [exportingExcel, setExportingExcel] = useState<boolean>(false);
  const [exportingCsv, setExportingCsv] = useState<boolean>(false);
  const [exportError, setExportError] = useState<string | null>(null);

  // Clear transactions
  const [clearing, setClearing] = useState<boolean>(false);
  const [clearResult, setClearResult] = useState<string | null>(null);
  const [isConfirmingClear, setIsConfirmingClear] = useState<boolean>(false);

  // Delete account
  const [deletingAccount, setDeletingAccount] = useState<boolean>(false);
  const [deleteAccountError, setDeleteAccountError] = useState<string | null>(null);
  const [isConfirmingDeleteAccount, setIsConfirmingDeleteAccount] = useState<boolean>(false);

  const confirmClearTransactions = async () => {
    setIsConfirmingClear(false);
    setClearing(true);
    setClearResult(null);
    try {
      const res = await apiRequest<{ message: string }>('/api/data/clear-transactions', {
        method: 'POST',
      });
      setClearResult(res.message);
      onDataChanged();
    } catch (err: any) {
      setClearResult(err.message || 'Could not clear records.');
    } finally {
      setClearing(false);
    }
  };

  const confirmDeleteAccount = async () => {
    setDeletingAccount(true);
    setDeleteAccountError(null);
    try {
      await deleteAccount();
      setIsConfirmingDeleteAccount(false);
    } catch (err: any) {
      setDeleteAccountError(err.message || 'Could not delete your account right now.');
      setIsConfirmingDeleteAccount(false);
    } finally {
      setDeletingAccount(false);
    }
  };

  const confirmRestoreDatabase = async () => {
    if (!pendingRestoreData) return;
    setRestoring(true);
    try {
      const res = await apiRequest<any>('/api/data/restore', {
        method: 'POST',
        body: JSON.stringify({ backupData: pendingRestoreData }),
      });
      setPendingRestoreData(null);
      setRestoreResult(res.message || 'Backup restored successfully.');
      onDataChanged();
    } catch (err: any) {
      setRestoreResult(err.message || 'Could not restore backup.');
    } finally {
      setRestoring(false);
    }
  };

  const handleDownloadBackup = async () => {
    setExportError(null);
    try {
      const data = await apiRequest<any>('/api/data/export/json');
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pryora_backup_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      setExportError(err?.message || 'Could not download JSON backup.');
    }
  };

  const handleExportCsv = async () => {
    setExportingCsv(true);
    setExportError(null);
    try {
      const token = getStoredToken();
      const res = await fetch('/api/data/export/csv', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error('Could not export CSV. Please ensure you are signed in.');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pryora_transactions_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      setExportError(err?.message || 'CSV export failed.');
    } finally {
      setExportingCsv(false);
    }
  };

  const handleExportExcel = async () => {
    setExportingExcel(true);
    setExportError(null);
    try {
      const token = getStoredToken();
      const res = await fetch('/api/data/export/csv', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error('Could not export Excel file. Please ensure you are signed in.');
      const csvText = await res.text();
      const wb = XLSX.read(csvText, { type: 'string' });
      XLSX.writeFile(wb, `pryora_transactions_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (err: any) {
      setExportError(err?.message || 'Excel export failed.');
    } finally {
      setExportingExcel(false);
    }
  };

  const handleRestoreUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async event => {
      const text = event.target?.result as string;
      try {
        const parsed = JSON.parse(text);
        setPendingRestoreData(parsed);
      } catch (err: any) {
        setRestoreResult(err.message || 'Invalid JSON backup file.');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Bar */}
      <div>
        <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
          Data Hub & Portability
        </h2>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
          Import Excel workbooks or bank CSV statements, export your records at any time, manage backups, or erase your account data.
        </p>
      </div>

      {/* Primary Module: Full-Width Step-by-Step Excel (.xlsx / .xls) & CSV Import Wizard */}
      <SpreadsheetImportWizard
        accounts={accounts}
        categories={categories}
        onDataChanged={onDataChanged}
        onNavigateToLedger={onNavigateToLedger}
      />

      {/* Secondary Modules: Exports, Backups, Reset & Account Deletion */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Card 1: Export Ledger (Excel .xlsx & CSV) */}
        <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl p-5 sm:p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-700 dark:text-blue-400 flex items-center justify-center border border-blue-500/20">
                <FileSpreadsheet className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Export Transactions
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Excel (.xlsx) or standard CSV
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Download your recorded transactions with dates, merchants, categories, accounts, and amounts for spreadsheet review or tax preparation.
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2.5 pt-1">
              <button
                type="button"
                disabled={exportingExcel}
                onClick={handleExportExcel}
                className="bg-slate-900 hover:bg-slate-800 dark:bg-emerald-500 dark:hover:bg-emerald-400 text-white dark:text-slate-950 font-bold px-3.5 py-2 rounded-xl text-xs inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 disabled:opacity-50"
              >
                {exportingExcel ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Download className="w-3.5 h-3.5" />
                )}
                <span>Export Excel (.xlsx)</span>
              </button>

              <button
                type="button"
                disabled={exportingCsv}
                onClick={handleExportCsv}
                className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-200/80 dark:border-slate-700 font-bold px-3.5 py-2 rounded-xl text-xs inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 disabled:opacity-50"
              >
                {exportingCsv ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Download className="w-3.5 h-3.5" />
                )}
                <span>Export CSV</span>
              </button>
            </div>
            {exportError && (
              <div className="p-2.5 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 text-xs rounded-xl border border-rose-200 dark:border-rose-900/50">
                {exportError}
              </div>
            )}
          </div>
        </div>

        {/* Card 2: Complete JSON Backup & Restore */}
        <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl p-5 sm:p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-700 dark:text-purple-400 flex items-center justify-center border border-purple-500/20">
                <Database className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Full JSON Backup & Restore
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Portable snapshot of your entire workspace
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Save or restore your accounts, categories, transactions, split allocations, budgets, recurring rules, and savings goals in one JSON file.
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2.5 pt-1">
              <button
                type="button"
                onClick={handleDownloadBackup}
                className="bg-slate-900 hover:bg-slate-800 dark:bg-emerald-500 dark:hover:bg-emerald-400 text-white dark:text-slate-950 font-bold px-3.5 py-2 rounded-xl text-xs inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download JSON</span>
              </button>

              <label className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200/80 dark:border-slate-700 font-bold px-3.5 py-2 rounded-xl text-xs inline-flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap shrink-0">
                <Upload className="w-3.5 h-3.5" />
                <span>Restore JSON</span>
                <input
                  type="file"
                  accept=".json,application/json"
                  onChange={handleRestoreUpload}
                  className="hidden"
                />
              </label>
            </div>

            {restoreResult && (
              <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 text-xs rounded-xl border border-emerald-200 dark:border-emerald-900/40">
                {restoreResult}
              </div>
            )}
          </div>
        </div>

        {/* Card 3: Clear Transactions */}
        <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl p-5 sm:p-6 rounded-2xl border border-amber-200/80 dark:border-amber-900/40 shadow-xs flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-700 dark:text-amber-400 flex items-center justify-center border border-amber-500/20">
                <Trash2 className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Reset Transactions
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Clear transactions while keeping accounts & categories
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Remove all recorded transactions and attached receipts, resetting account balances back to their starting amounts.
            </p>
          </div>

          <div className="space-y-2">
            <button
              id="btn_clear_dummy_data"
              type="button"
              onClick={() => setIsConfirmingClear(true)}
              disabled={clearing}
              className="bg-amber-600 hover:bg-amber-500 text-white font-bold px-3.5 py-2 rounded-xl text-xs inline-flex items-center gap-1.5 transition-colors disabled:opacity-50 whitespace-nowrap shrink-0"
            >
              {clearing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
              <span>{clearing ? 'Clearing Records...' : 'Clear All Transactions'}</span>
            </button>

            {clearResult && (
              <div className="p-2.5 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs rounded-xl border border-slate-200 dark:border-slate-700">
                {clearResult}
              </div>
            )}
          </div>
        </div>

        {/* Card 4: Permanent Account & Data Deletion */}
        <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl p-5 sm:p-6 rounded-2xl border border-rose-200/80 dark:border-rose-900/40 shadow-xs flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-rose-500/10 text-rose-700 dark:text-rose-400 flex items-center justify-center border border-rose-500/20">
                <UserX className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Delete Account & Data
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Permanently remove your profile and all records
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              {isDemoUser
                ? 'You are viewing the shared Demo Workspace. Permanent deletion is disabled for the demo account.'
                : 'Permanently delete your PRYORA account along with all accounts, transactions, receipts, budgets, recurring rules, and goals. Export a JSON backup first if you want a copy.'}
            </p>
          </div>

          <div className="space-y-2">
            <button
              id="btn_delete_account"
              type="button"
              onClick={() => setIsConfirmingDeleteAccount(true)}
              disabled={deletingAccount || isDemoUser}
              className="bg-rose-600 hover:bg-rose-500 text-white font-bold px-3.5 py-2 rounded-xl text-xs inline-flex items-center gap-1.5 transition-colors disabled:opacity-45 disabled:cursor-not-allowed whitespace-nowrap shrink-0"
            >
              {deletingAccount ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserX className="w-3.5 h-3.5" />}
              <span>{deletingAccount ? 'Deleting Account...' : 'Delete My Account'}</span>
            </button>

            {deleteAccountError && (
              <div className="p-2.5 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 text-xs rounded-xl border border-rose-200 dark:border-rose-900/50">
                {deleteAccountError}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Confirmation Dialog for Clearing Transactions */}
      <ConfirmDialog
        isOpen={isConfirmingClear}
        title="Clear All Transactions"
        message="Are you sure you want to clear all transactions and receipts and reset account balances to their starting values? Accounts and categories will be kept."
        confirmLabel="Clear Transactions"
        isLoading={clearing}
        onConfirm={confirmClearTransactions}
        onCancel={() => {
          if (!clearing) setIsConfirmingClear(false);
        }}
      />

      {/* Confirmation Dialog for Deleting Account */}
      <ConfirmDialog
        isOpen={isConfirmingDeleteAccount}
        title="Permanently Delete Account"
        message="This will permanently erase your PRYORA account, transactions, receipts, accounts, budgets, goals, and recurring rules. This action cannot be undone."
        confirmLabel="Delete Everything"
        isLoading={deletingAccount}
        onConfirm={confirmDeleteAccount}
        onCancel={() => {
          if (!deletingAccount) setIsConfirmingDeleteAccount(false);
        }}
      />

      {/* Confirmation Dialog for Restoring Backup */}
      <ConfirmDialog
        isOpen={!!pendingRestoreData}
        title="Restore JSON Backup"
        message="Restore your workspace from this backup file? Missing accounts, categories, transactions, budgets, recurring rules, and goals will be imported safely into your account."
        confirmLabel="Restore Backup"
        isDestructive={false}
        isLoading={restoring}
        onConfirm={confirmRestoreDatabase}
        onCancel={() => {
          if (!restoring) setPendingRestoreData(null);
        }}
      />
    </div>
  );
};
