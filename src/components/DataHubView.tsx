/**
 * PRYORA Data Hub (Import / Export / Sovereign Backups)
 */

import React, { useState } from 'react';
import { Account } from '../types';
import { apiRequest } from '../lib/api';
import { ConfirmDialog } from './common/ConfirmDialog';
import {
  Upload,
  Download,
  Database,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  RefreshCw,
  Loader2,
  Trash2,
} from 'lucide-react';

interface DataHubViewProps {
  accounts: Account[];
  onDataChanged: () => void;
}

export const DataHubView: React.FC<DataHubViewProps> = ({ accounts, onDataChanged }) => {
  const [targetAccountId, setTargetAccountId] = useState<string>(accounts[0]?.id || '');
  const [csvContent, setCsvContent] = useState<string>('');
  const [fileName, setFileName] = useState<string>('');
  const [importing, setImporting] = useState<boolean>(false);
  const [importResult, setImportResult] = useState<any | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  // JSON restore
  const [restoreFile, setRestoreFile] = useState<string>('');
  const [restoring, setRestoring] = useState<boolean>(false);
  const [restoreResult, setRestoreResult] = useState<string | null>(null);
  const [pendingRestoreData, setPendingRestoreData] = useState<any | null>(null);

  // Clear demo data
  const [clearing, setClearing] = useState<boolean>(false);
  const [clearResult, setClearResult] = useState<string | null>(null);
  const [isConfirmingClear, setIsConfirmingClear] = useState<boolean>(false);

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

  const confirmRestoreDatabase = async () => {
    if (!pendingRestoreData) return;
    setRestoring(true);
    try {
      const res = await apiRequest<any>('/api/data/restore/json', {
        method: 'POST',
        body: JSON.stringify(pendingRestoreData),
      });
      setPendingRestoreData(null);
      setRestoreResult(res.message || 'Restored successfully!');
      onDataChanged();
    } catch (err: any) {
      setRestoreResult(err.message || 'Could not restore database.');
    } finally {
      setRestoring(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setImportResult(null);
    setImportError(null);

    const reader = new FileReader();
    reader.onload = event => {
      const text = event.target?.result as string;
      setCsvContent(text);
    };
    reader.readAsText(file);
  };

  const handleExecuteImport = async () => {
    if (!csvContent.trim()) {
      setImportError('Please select a valid CSV file.');
      return;
    }

    if (!targetAccountId) {
      setImportError('Please select a destination account for the imported records.');
      return;
    }

    setImporting(true);
    setImportResult(null);
    setImportError(null);

    try {
      const res = await apiRequest<any>('/api/data/import/csv', {
        method: 'POST',
        body: JSON.stringify({
          accountId: targetAccountId,
          csvContent,
        }),
      });

      setImportResult(res);
      setCsvContent('');
      setFileName('');
      onDataChanged();
    } catch (err: any) {
      setImportError(err.message || 'Import failed. Verify CSV format.');
    } finally {
      setImporting(false);
    }
  };

  const handleDownloadBackup = () => {
    window.location.href = '/api/data/backup/json';
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
        <h2 className="text-xl font-bold text-slate-900 tracking-tight">Data Hub & Sovereign Ownership</h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Zero vendor lock-in. Import bank statements, export spreadsheets, and generate complete unencrypted ledger backups.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Module 1: CSV Statement Import */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center">
              <Upload className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Import Bank / Card CSV</h3>
              <p className="text-xs text-slate-500">Supports standard HDFC, Chase, Amex, ICICI & CSV exports</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Destination Account
              </label>
              <select
                value={targetAccountId}
                onChange={e => setTargetAccountId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium"
              >
                {accounts.map(a => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({a.type})
                  </option>
                ))}
              </select>
            </div>

            {/* Drag & Drop File Input */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Select CSV File
              </label>
              <div className="border-2 border-dashed border-slate-200 hover:border-slate-400 rounded-xl p-6 text-center cursor-pointer transition-colors relative bg-slate-50/50">
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleFileUpload}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                />
                <FileSpreadsheet className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                <span className="text-xs font-semibold text-slate-700 block">
                  {fileName ? fileName : 'Click or drop your .csv statement here'}
                </span>
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Columns: Date, Payee/Description, Amount, Category (optional)
                </span>
              </div>
            </div>

            {importError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{importError}</span>
              </div>
            )}

            {importResult && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs rounded-xl flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="font-bold">{importResult.imported_count} transaction(s) imported successfully!</strong>
                  {importResult.skipped_count > 0 && (
                    <p className="text-[11px] text-emerald-700 mt-0.5">
                      ({importResult.skipped_count} row(s) skipped due to missing dates or zero values)
                    </p>
                  )}
                </div>
              </div>
            )}

            <button
              type="button"
              disabled={!csvContent || importing}
              onClick={handleExecuteImport}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold py-2.5 rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {importing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Processing CSV...</span>
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  <span>Execute Statement Import</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Module 2: CSV Export & Sovereign JSON Backup */}
        <div className="space-y-6">
          
          {/* CSV Export Card */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-800 flex items-center justify-center">
                <Download className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Export Ledger as CSV</h3>
                <p className="text-xs text-slate-500">Download formatted transactions for spreadsheets or accountants</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Generates a standardized `.csv` file containing transaction IDs, dates, payees, categorized allocations, associated accounts, and amounts in both major currency units and minor integer precision.
            </p>

            <a
              href="/api/data/export/csv"
              className="inline-flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 font-semibold px-4 py-2 rounded-xl text-xs transition-colors shadow-2xs"
            >
              <Download className="w-3.5 h-3.5" /> Download Transactions CSV
            </a>
          </div>

          {/* Full Sovereign JSON Backup Card */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-800 flex items-center justify-center">
                <Database className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Complete Sovereign JSON Backup</h3>
                <p className="text-xs text-slate-500">Unencrypted portable snapshot of your entire database</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Back up your entire personal finance state: profiles, accounts, categories, transactions, split allocations, recurring rules, and goals in a single portable JSON file.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                type="button"
                onClick={handleDownloadBackup}
                className="bg-slate-900 hover:bg-slate-800 text-white font-semibold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 transition-colors shadow-sm"
              >
                <Download className="w-3.5 h-3.5" /> Download JSON Snapshot
              </button>

              <label className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-semibold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer transition-colors shadow-2xs">
                <Upload className="w-3.5 h-3.5" /> Restore from JSON
                <input
                  type="file"
                  accept=".json,application/json"
                  onChange={handleRestoreUpload}
                  className="hidden"
                />
              </label>
            </div>

            {restoreResult && (
              <div className="p-3 bg-emerald-50 text-emerald-800 text-xs rounded-xl border border-emerald-200">
                {restoreResult}
              </div>
            )}
          </div>

          {/* Clean Slate / Wipe Dummy Records Card */}
          <div className="bg-white p-6 rounded-2xl border border-rose-200/80 shadow-xs space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-800 flex items-center justify-center">
                <Trash2 className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Clean Slate / Reset Dummy Records</h3>
                <p className="text-xs text-slate-500">Remove all sample or demo transactions to start tracking real expenses</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              If your workspace contains pre-populated dummy transactions from the initial demo tour, you can wipe them all at once. Your accounts, categories, and settings will be preserved, while account balances will be restored to their starting balances.
            </p>

            <div>
              <button
                id="btn_clear_dummy_data"
                type="button"
                onClick={() => setIsConfirmingClear(true)}
                disabled={clearing}
                className="bg-rose-600 hover:bg-rose-500 text-white font-semibold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 transition-colors shadow-sm disabled:opacity-50"
              >
                {clearing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                <span>{clearing ? 'Clearing Records...' : 'Clear All Transactions (Start Fresh)'}</span>
              </button>
            </div>

            {clearResult && (
              <div className="p-3 bg-slate-100 text-slate-800 text-xs rounded-xl border border-slate-200">
                {clearResult}
              </div>
            )}
          </div>

        </div>

      </div>

      {/* Confirmation Dialog for Clearing Transactions (Iframe-safe, replaces window.confirm) */}
      <ConfirmDialog
        isOpen={isConfirmingClear}
        title="Clear All Transactions"
        message="Are you sure you want to clear all transactions and reset account balances? This gives you a clean slate for real expense tracking. Accounts and categories will be kept."
        confirmLabel="Wipe Transactions"
        isLoading={clearing}
        onConfirm={confirmClearTransactions}
        onCancel={() => {
          if (!clearing) setIsConfirmingClear(false);
        }}
      />

      {/* Confirmation Dialog for Restoring Backup (Iframe-safe, replaces window.confirm) */}
      <ConfirmDialog
        isOpen={!!pendingRestoreData}
        title="Restore Database Backup"
        message="Are you sure you want to restore the database from this backup? Existing records will be replaced with the contents of the backup."
        confirmLabel="Restore Database"
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
