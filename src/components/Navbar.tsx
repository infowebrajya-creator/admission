import React from 'react';
import { Building2, Monitor, Shield } from 'lucide-react';
import { VacancySummary } from '../types';
import { openOrFocusDisplayWindow } from '../utils/displayWindow';

interface NavbarProps {
  currentRoute: 'admin' | 'display';
  onNavigate: (route: 'admin' | 'display') => void;
  vacancySummary: VacancySummary;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentRoute,
  onNavigate,
  vacancySummary,
}) => {
  return (
    <header className="bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-40 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Title */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold shadow-inner">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="text-base sm:text-lg font-semibold tracking-tight text-white flex items-center gap-2">
                <span>G.H. Raisoni Admission Management</span>
                <span className="text-xs px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 font-normal border border-blue-500/30">
                  MVP
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Institutional Level (IL) & Against-CAP (A-CAP) Admission Portal
              </p>
            </div>
          </div>

          {/* Quick Route Nav & Total Vacancy */}
          <div className="flex items-center gap-3">
            {/* Live total badge */}
            <div className="hidden sm:flex items-center gap-2 bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-700 text-xs">
              <span className="text-slate-400">Total Vacancy:</span>
              <span className="font-bold text-emerald-400 text-sm">
                {vacancySummary.totalCombined}
              </span>
              <span className="text-slate-500">/ {vacancySummary.initialTotalCombined}</span>
            </div>

            {/* Open Display Window button */}
            <button
              id="nav-open-display-btn"
              onClick={openOrFocusDisplayWindow}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold transition-all shadow-xs"
              title="Open Display Board in separate window"
            >
              <Monitor className="w-3.5 h-3.5" />
              <span>🖥 Open Display</span>
            </button>

            {/* Direct Route Switchers */}
            <div className="flex bg-slate-800 p-1 rounded-lg border border-slate-700">
              <button
                id="nav-admin-btn"
                onClick={() => onNavigate('admin')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  currentRoute === 'admin'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
                }`}
              >
                <Shield className="w-3.5 h-3.5" />
                <span>/admin</span>
              </button>
              <button
                id="nav-display-btn"
                onClick={() => onNavigate('display')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  currentRoute === 'display'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
                }`}
              >
                <Monitor className="w-3.5 h-3.5" />
                <span>/display</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
