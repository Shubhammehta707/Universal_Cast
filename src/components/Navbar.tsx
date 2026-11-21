import React, { useState } from 'react';
import {
  Cast,
  Tv,
  PlusCircle,
  Clock,
  Settings,
  Sun,
  Moon,
  LogOut,
  LogIn,
  Menu,
  X,
  Radio,
  MonitorSmartphone,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

interface NavbarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  activeSessionId?: string | null;
}

export const Navbar: React.FC<NavbarProps> = ({ currentTab, setCurrentTab, activeSessionId }) => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: MonitorSmartphone },
    { id: 'create', label: 'Start Cast', icon: PlusCircle },
    { id: 'discovery', label: 'Devices', icon: Tv },
    { id: 'history', label: 'History', icon: Clock },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <header className="sticky top-0 z-50 backdrop-blur-md bg-white/95 dark:bg-slate-900/95 border-b border-slate-200 dark:border-slate-800 shadow-xs transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <div
          className="flex items-center space-x-3 cursor-pointer select-none"
          onClick={() => setCurrentTab('landing')}
        >
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-blue-600 to-cyan-400 flex items-center justify-center text-white shadow-md shadow-indigo-500/25 shrink-0">
            <Cast className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-bold text-lg tracking-tight text-slate-900 dark:text-white">
                UniversalCast
              </span>
              <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 dark:bg-indigo-950/80 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
                10x SFU
              </span>
            </div>
            <p className="text-[11px] text-slate-600 dark:text-slate-400 -mt-0.5 hidden sm:block">
              Multi-Screen Casting Platform
            </p>
          </div>
        </div>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center space-x-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setCurrentTab(item.id)}
                className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
                  active
                    ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 border border-indigo-200/80 dark:border-indigo-800/80 shadow-xs'
                    : 'text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Right side controls */}
        <div className="flex items-center space-x-2 sm:space-x-3">
          {/* Active cast indicator */}
          {activeSessionId && (
            <button
              onClick={() => setCurrentTab('active-cast')}
              className="hidden lg:flex items-center space-x-1.5 px-3 py-1.5 rounded-full bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-900/60 text-xs font-bold animate-pulse cursor-pointer"
            >
              <Radio className="w-3.5 h-3.5" />
              <span>Live Broadcast</span>
            </button>
          )}

          {/* Direct Receiver Button */}
          <button
            onClick={() => setCurrentTab('receiver')}
            className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 text-xs sm:text-sm font-bold transition shadow-xs cursor-pointer active:scale-98"
          >
            <Tv className="w-4 h-4" />
            <span className="hidden sm:inline">Join as</span>
            <span>Receiver</span>
          </button>

          {/* Visible Theme Toggle */}
          <button
            onClick={toggleTheme}
            type="button"
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            className="flex items-center space-x-1.5 px-2.5 sm:px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/80 transition shadow-xs cursor-pointer"
          >
            {theme === 'dark' ? (
              <>
                <Sun className="w-4 h-4 text-amber-400 shrink-0" />
                <span className="text-xs font-bold hidden lg:inline">Light</span>
              </>
            ) : (
              <>
                <Moon className="w-4 h-4 text-indigo-600 shrink-0" />
                <span className="text-xs font-bold hidden lg:inline">Dark</span>
              </>
            )}
          </button>

          {/* User profile / Auth */}
          {user ? (
            <div className="flex items-center space-x-2">
              <div
                onClick={() => setCurrentTab('settings')}
                className="w-8 h-8 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center text-xs cursor-pointer border border-indigo-400 overflow-hidden shadow-xs"
                title={user.email || 'User Profile'}
              >
                {user.photoURL ? (
                  <img src={user.photoURL} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  (user.displayName || user.email || 'U').charAt(0).toUpperCase()
                )}
              </div>
              <button
                onClick={logout}
                title="Sign out"
                className="p-2 text-slate-600 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setCurrentTab('signin')}
              className="flex items-center space-x-1 px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-700 transition cursor-pointer shadow-xs"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Sign In</span>
            </button>
          )}

          {/* Mobile menu hamburger */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile navigation dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden px-4 pt-2 pb-4 space-y-1 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-md">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setCurrentTab(item.id);
                  setMobileMenuOpen(false);
                }}
                className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl text-sm font-semibold ${
                  active
                    ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{item.label}</span>
              </button>
            );
          })}

          {activeSessionId && (
            <button
              onClick={() => {
                setCurrentTab('active-cast');
                setMobileMenuOpen(false);
              }}
              className="w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl text-sm font-bold bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-900"
            >
              <Radio className="w-4 h-4" />
              <span>Resume Active Broadcast</span>
            </button>
          )}

          {/* Mobile Theme Toggle Row */}
          <div className="pt-2 mt-2 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between px-3 py-2">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Theme</span>
            <button
              onClick={toggleTheme}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-slate-200"
            >
              {theme === 'dark' ? (
                <>
                  <Sun className="w-3.5 h-3.5 text-amber-400" />
                  <span>Light Mode</span>
                </>
              ) : (
                <>
                  <Moon className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Dark Mode</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </header>
  );
};
