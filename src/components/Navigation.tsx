/**
 * PRYORA Liquid Glass Navigation Bar & Mobile Dock
 * 
 * Features:
 * - Liquid glass frosted header with backdrop blur
 * - Integrated Light / Dark / System theme toggle
 * - Responsive desktop tab bar
 * - Mobile bottom dock with quick actions & "More" sheet
 * - High-contrast accessible typography
 */

import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
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
  Sun,
  Moon,
  Cloud,
  Sparkles,
  Menu,
  X,
  ChevronRight,
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
  const { theme, resolvedTheme, setTheme, toggleTheme } = useTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);

  const primaryNavItems: Array<{ id: TabType; label: string; icon: React.ComponentType<{ className?: string }> }> = [
    { id: 'dashboard', label: 'Overview', icon: LayoutDashboard },
    { id: 'transactions', label: 'Transactions', icon: ReceiptText },
    { id: 'accounts', label: 'Accounts', icon: Landmark },
    { id: 'budgets', label: 'Budgets', icon: PieChart },
  ];

  const secondaryNavItems: Array<{ id: TabType; label: string; icon: React.ComponentType<{ className?: string }> }> = [
    { id: 'subscriptions', label: 'Subscriptions', icon: CalendarClock },
    { id: 'goals', label: 'Goals', icon: Target },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'data', label: 'Data Hub', icon: Database },
  ];

  const allNavItems = [...primaryNavItems, ...secondaryNavItems];

  const handleTabSelect = (tab: TabType) => {
    setActiveTab(tab);
    setMobileMenuOpen(false);
  };

  return (
    <>
      {/* Top Header Bar */}
      <header className="sticky top-0 z-40 bg-white/75 dark:bg-slate-950/75 backdrop-blur-xl border-b border-slate-200/80 dark:border-white/10 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            
            {/* Left: Brand Logo & Desktop Navigation */}
            <div className="flex items-center gap-6">
              <button
                type="button"
                onClick={() => handleTabSelect('dashboard')}
                className="flex items-center gap-2.5 text-left focus:outline-none group"
              >
                <div className="w-8 h-8 rounded-xl bg-emerald-500 text-slate-950 font-black text-sm flex items-center justify-center tracking-tighter shadow-sm shadow-emerald-500/20 group-hover:scale-105 transition-transform">
                  P
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="font-extrabold text-base tracking-wider text-slate-900 dark:text-white">PRYORA</span>
                  <span className="hidden sm:inline-block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60">
                    OS
                  </span>
                </div>
              </button>

              {/* Desktop Navigation Links */}
              <nav className="hidden lg:flex items-center gap-1 p-1 bg-slate-100/70 dark:bg-slate-900/60 rounded-xl border border-slate-200/60 dark:border-white/5">
                {allNavItems.map(item => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      id={`nav_tab_${item.id}`}
                      type="button"
                      onClick={() => handleTabSelect(item.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                        isActive
                          ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-2xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-slate-800/40'
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
            <div className="flex items-center gap-2.5 sm:gap-3">
              {/* Quick Record Button */}
              <button
                id="btn_header_add_transaction"
                type="button"
                onClick={onOpenTransactionModal}
                className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition-all shadow-sm hover:shadow-emerald-500/20 active:scale-95"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
                <span className="hidden sm:inline">Log Expense</span>
              </button>

              {/* Light / Dark Mode Toggle */}
              <button
                id="btn_theme_toggle"
                type="button"
                onClick={toggleTheme}
                title={`Current: ${resolvedTheme === 'dark' ? 'Dark' : 'Light'} mode. Click to toggle.`}
                aria-label="Toggle light and dark mode"
                className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100/80 dark:bg-slate-800/80 hover:bg-slate-200/80 dark:hover:bg-slate-700/80 border border-slate-200/60 dark:border-white/10 transition-colors"
              >
                {resolvedTheme === 'dark' ? (
                  <Sun className="w-4 h-4 text-amber-400 transition-transform rotate-0 hover:rotate-45" />
                ) : (
                  <Moon className="w-4 h-4 text-slate-700 transition-transform rotate-0 hover:-rotate-12" />
                )}
              </button>

              {/* Storage Backend Badge (Desktop) */}
              <div className="hidden xl:flex items-center">
                {isFirebaseAuth ? (
                  <div
                    title="Your data is saved to your private Google Firebase Firestore cloud database"
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs font-semibold"
                  >
                    <Cloud className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />
                    <span>Firebase Cloud</span>
                  </div>
                ) : (
                  <div
                    title="Demo Sandbox with pre-populated sample data. Sign in with Google to switch to real Firebase cloud storage."
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs font-semibold"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
                    <span>Demo Sandbox</span>
                  </div>
                )}
              </div>

              {/* User Profile & Sign Out */}
              <div className="hidden sm:flex items-center gap-2 pl-2 border-l border-slate-200 dark:border-slate-800">
                <div className="flex flex-col items-end text-right">
                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[120px]">
                    {user?.display_name || user?.email}
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                    {user?.currency || 'INR'}
                  </span>
                </div>

                <button
                  id="btn_logout"
                  type="button"
                  onClick={logout}
                  title="Sign out of PRYORA"
                  className="text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 p-2 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>

              {/* Mobile Menu Toggle Button */}
              <button
                type="button"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="lg:hidden p-2 rounded-xl text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200/60 dark:border-white/10"
                aria-label="Toggle navigation menu"
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>

            </div>
          </div>
        </div>

        {/* Mobile Slide-Out / Dropdown Drawer */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-slate-200 dark:border-white/10 bg-white/95 dark:bg-slate-950/95 backdrop-blur-2xl px-4 py-4 space-y-3 animate-in slide-in-from-top-2 duration-200 shadow-xl">
            <div className="grid grid-cols-2 gap-2">
              {allNavItems.map(item => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleTabSelect(item.id)}
                    className={`flex items-center gap-2.5 p-2.5 rounded-xl text-xs font-semibold transition-all ${
                      isActive
                        ? 'bg-slate-900 text-white dark:bg-emerald-500/20 dark:text-emerald-400 dark:border dark:border-emerald-500/30'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[160px]">
                  {user?.display_name || user?.email}
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  ({user?.currency || 'INR'})
                </span>
              </div>
              <button
                type="button"
                onClick={logout}
                className="text-rose-600 dark:text-rose-400 font-semibold flex items-center gap-1 py-1 px-2 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40"
              >
                <LogOut className="w-3.5 h-3.5" /> Sign Out
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Mobile Floating Bottom Dock (Quick thumb access on mobile phones) */}
      <nav aria-label="Mobile navigation" className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white/85 dark:bg-slate-950/85 backdrop-blur-xl border-t border-slate-200/80 dark:border-white/10 px-3 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] shadow-lg">
        <div className="flex items-center justify-around max-w-md mx-auto">
          {primaryNavItems.slice(0, 2).map(item => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleTabSelect(item.id)}
                className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition-all ${
                  isActive
                    ? 'text-emerald-600 dark:text-emerald-400 font-bold scale-105'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-medium'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-[10px] tracking-tight">{item.label}</span>
              </button>
            );
          })}

          {/* Center Floating Plus Button for Instant Mobile Logging */}
          <button
            type="button"
            onClick={onOpenTransactionModal}
            className="w-11 h-11 -mt-5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 flex items-center justify-center shadow-lg shadow-emerald-500/30 active:scale-95 transition-all"
            aria-label="Log new expense"
          >
            <Plus className="w-6 h-6 stroke-[2.5]" />
          </button>

          {primaryNavItems.slice(2, 4).map(item => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleTabSelect(item.id)}
                className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition-all ${
                  isActive
                    ? 'text-emerald-600 dark:text-emerald-400 font-bold scale-105'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-medium'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-[10px] tracking-tight">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
};
