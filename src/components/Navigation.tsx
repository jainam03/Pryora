/**
 * PRYORA Main Navigation Bar
 */

import React from 'react';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard,
  ReceiptText,
  Landmark,
  PieChart,
  CalendarClock,
  Target,
  BarChart3,
  Database,
  Plus,
  LogOut,
  User as UserIcon,
  Cloud,
  Sparkles,
} from 'lucide-react';

export type TabType = 
  | 'dashboard' 
  | 'transactions' 
  | 'accounts' 
  | 'budgets' 
  | 'subscriptions' 
  | 'goals' 
  | 'analytics' 
  | 'data';

interface NavigationProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  onOpenTransactionModal: () => void;
}

export const Navigation: React.FC<NavigationProps> = ({
  activeTab,
  setActiveTab,
  onOpenTransactionModal,
}) => {
  const { user, logout, isFirebaseAuth } = useAuth();

  const navItems: Array<{ id: TabType; label: string; icon: React.ComponentType<{ className?: string }> }> = [
    { id: 'dashboard', label: 'Expense Tracker', icon: LayoutDashboard },
    { id: 'transactions', label: 'All Transactions', icon: ReceiptText },
    { id: 'accounts', label: 'Accounts', icon: Landmark },
    { id: 'budgets', label: 'Budgets', icon: PieChart },
    { id: 'subscriptions', label: 'Subscriptions', icon: CalendarClock },
    { id: 'goals', label: 'Goals', icon: Target },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'data', label: 'Data Hub', icon: Database },
  ];

  return (
    <header className="bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
          {/* Brand Logo & Tagline */}
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => setActiveTab('dashboard')}>
              <div className="w-8 h-8 rounded-lg bg-emerald-500 text-slate-950 font-black text-sm flex items-center justify-center tracking-tighter shadow-sm">
                P
              </div>
              <div>
                <span className="font-extrabold text-base tracking-wider text-white">PRYORA</span>
                <span className="hidden sm:inline-block ml-2 text-[10px] font-semibold text-slate-400 uppercase tracking-widest px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700">
                  OS
                </span>
              </div>
            </div>

            {/* Desktop Navigation Links */}
            <nav className="hidden lg:flex items-center gap-1">
              {navItems.map(item => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    id={`nav_tab_${item.id}`}
                    type="button"
                    onClick={() => setActiveTab(item.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors ${
                      isActive
                        ? 'bg-slate-800 text-white font-semibold shadow-sm'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Right Header Actions */}
          <div className="flex items-center gap-3">
            {/* Quick Add Expense */}
            <button
              id="btn_header_add_transaction"
              type="button"
              onClick={onOpenTransactionModal}
              className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition-all shadow-sm hover:shadow"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Log Expense</span>
            </button>

            {/* Storage Backend Badge */}
            <div className="hidden md:flex items-center">
              {isFirebaseAuth ? (
                <div
                  title="Your data is saved to your private Google Firebase Firestore cloud database"
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-[11px] font-medium"
                >
                  <Cloud className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Firebase Cloud</span>
                </div>
              ) : (
                <div
                  title="Demo Sandbox with pre-populated sample data. Sign in with Google to switch to real Firebase cloud storage."
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px] font-medium"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>Demo Sandbox</span>
                </div>
              )}
            </div>

            {/* Currency & User Badge */}
            <div className="flex items-center gap-2 pl-2 border-l border-slate-800">
              <div className="hidden sm:flex flex-col items-end text-right">
                <span className="text-xs font-semibold text-slate-200 truncate max-w-[130px]">
                  {user?.display_name || user?.email}
                </span>
                <span className="text-[10px] text-slate-400">
                  {user?.currency || 'INR'}
                </span>
              </div>

              <button
                id="btn_logout"
                type="button"
                onClick={logout}
                title="Sign out of PRYORA"
                className="text-slate-400 hover:text-slate-200 p-2 rounded-lg hover:bg-slate-800 transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>

          </div>
        </div>

        {/* Mobile Sub-Navigation Bar */}
        <div className="lg:hidden flex items-center gap-1 overflow-x-auto py-2 border-t border-slate-800 no-scrollbar">
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium shrink-0 flex items-center gap-1.5 transition-colors ${
                  isActive
                    ? 'bg-slate-800 text-white font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

      </div>
    </header>
  );
};
