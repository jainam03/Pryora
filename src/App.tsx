/**
 * PRYORA Personal Finance OS — Master Entry Point
 */

import React, { useState, useEffect, useCallback } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { Navigation, TabType } from './components/Navigation';
import { DashboardView } from './components/DashboardView';
import { TransactionsView } from './components/TransactionsView';
import { AccountsView } from './components/AccountsView';
import { BudgetsView } from './components/BudgetsView';
import { SubscriptionsView } from './components/SubscriptionsView';
import { GoalsView } from './components/GoalsView';
import { AnalyticsView } from './components/AnalyticsView';
import { DataHubView } from './components/DataHubView';
import { AuthScreen } from './components/AuthScreen';
import { OnboardingModal } from './components/OnboardingModal';
import { TransactionModal } from './components/TransactionModal';
import { ReceiptViewerModal } from './components/ReceiptViewerModal';
import { Account, Category, DashboardData, Transaction } from './types';
import { apiRequest } from './lib/api';
import { Loader2 } from 'lucide-react';

const MainApp: React.FC = () => {
  const { user, isLoading, refreshUser } = useAuth();

  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loadingData, setLoadingData] = useState<boolean>(true);

  // Transaction Modal State
  const [isTxModalOpen, setIsTxModalOpen] = useState<boolean>(false);
  const [txToEdit, setTxToEdit] = useState<Transaction | null>(null);
  const [initialTxData, setInitialTxData] = useState<Partial<Transaction> | undefined>(undefined);

  // Receipt Modal State
  const [receiptTxId, setReceiptTxId] = useState<string | null>(null);
  const [receiptMerchant, setReceiptMerchant] = useState<string>('');

  const loadAllData = useCallback(async () => {
    if (!user) return;
    setLoadingData(true);
    try {
      const [dashRes, accRes, catRes] = await Promise.all([
        apiRequest<DashboardData>('/api/analytics/dashboard'),
        apiRequest<{ accounts: Account[] }>('/api/accounts'),
        apiRequest<{ categories: Category[] }>('/api/categories'),
      ]);

      setDashboardData(dashRes);
      setAccounts(accRes.accounts || []);
      setCategories(catRes.categories || []);
    } catch (err) {
      console.error('Error loading PRYORA data:', err);
    } finally {
      setLoadingData(false);
    }
  }, [user]);

  useEffect(() => {
    if (user && user.onboarding_completed) {
      loadAllData();
    }
  }, [user, loadAllData]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white">
        <div className="w-12 h-12 rounded-2xl bg-emerald-500 text-slate-950 font-black text-xl flex items-center justify-center tracking-tighter mb-4 shadow-lg shadow-emerald-500/20">
          P
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-400 font-medium">
          <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
          <span>Starting PRYORA Ledger...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthScreen />;
  }

  // Show Onboarding if user hasn't completed setup yet
  if (!user.onboarding_completed) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <OnboardingModal
          isOpen={true}
          onCompleted={() => {
            refreshUser();
            loadAllData();
          }}
        />
      </div>
    );
  }

  const handleOpenTransactionModal = (initial?: Partial<Transaction>) => {
    setTxToEdit(null);
    setInitialTxData(initial);
    setIsTxModalOpen(true);
  };

  const handleEditTransaction = (tx: Transaction) => {
    setTxToEdit(tx);
    setInitialTxData(undefined);
    setIsTxModalOpen(true);
  };

  const handleViewReceipt = (txId: string, merchant: string) => {
    setReceiptTxId(txId);
    setReceiptMerchant(merchant);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans antialiased transition-colors relative selection:bg-emerald-500 selection:text-slate-950">
      {/* Ambient background glows for liquid glass aesthetic */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden z-0 opacity-40 dark:opacity-20" aria-hidden="true">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[650px] h-[350px] bg-gradient-to-tr from-emerald-500/25 via-teal-400/20 to-blue-500/15 rounded-full blur-3xl" />
        <div className="absolute top-1/3 -right-20 w-[450px] h-[300px] bg-gradient-to-br from-indigo-500/15 to-purple-500/15 rounded-full blur-3xl" />
      </div>

      {/* Navigation Header */}
      <Navigation
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenTransactionModal={() => handleOpenTransactionModal()}
      />

      {/* Main Content Area (extra bottom padding on mobile for floating dock) */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3.5 sm:px-6 lg:px-8 pt-4 sm:pt-6 pb-24 lg:pb-12 relative z-10">
        {activeTab === 'dashboard' && (
          <DashboardView
            data={dashboardData}
            onRefresh={loadAllData}
            onOpenTransactionModal={handleOpenTransactionModal}
            onNavigateTab={setActiveTab}
            onViewReceipt={handleViewReceipt}
          />
        )}

        {activeTab === 'transactions' && (
          <TransactionsView
            accounts={accounts}
            categories={categories}
            onOpenCreateModal={() => handleOpenTransactionModal()}
            onEditTransaction={handleEditTransaction}
            onViewReceipt={handleViewReceipt}
            onDataChanged={loadAllData}
          />
        )}

        {activeTab === 'accounts' && (
          <AccountsView accounts={accounts} onRefresh={loadAllData} />
        )}

        {activeTab === 'budgets' && (
          <BudgetsView categories={categories} onDataChanged={loadAllData} />
        )}

        {activeTab === 'subscriptions' && (
          <SubscriptionsView
            accounts={accounts}
            categories={categories}
            onDataChanged={loadAllData}
          />
        )}

        {activeTab === 'goals' && (
          <GoalsView onDataChanged={loadAllData} />
        )}

        {activeTab === 'analytics' && (
          <AnalyticsView />
        )}

        {activeTab === 'data' && (
          <DataHubView accounts={accounts} onDataChanged={loadAllData} />
        )}
      </main>

      {/* Transaction Modal (Add / Edit / Split / Receipt) */}
      <TransactionModal
        isOpen={isTxModalOpen}
        onClose={() => setIsTxModalOpen(false)}
        onSaved={loadAllData}
        accounts={accounts}
        categories={categories}
        transactionToEdit={txToEdit}
        initialData={initialTxData}
      />

      {/* Receipt Viewer Modal */}
      <ReceiptViewerModal
        transactionId={receiptTxId}
        merchantName={receiptMerchant}
        onClose={() => setReceiptTxId(null)}
      />
    </div>
  );
};

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <MainApp />
      </AuthProvider>
    </ThemeProvider>
  );
}
