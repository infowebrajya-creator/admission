import React, { useState, useEffect, useCallback } from 'react';
import {
  Building2,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Shield,
  Monitor,
  Maximize2,
  Minimize2,
  Layers,
} from 'lucide-react';
import { BRANCH_CODES, DEFAULT_EMPTY_CAPACITIES } from '../constants';
import { BranchCode, VacancySummary } from '../types';
import { subscribeSupabaseRealtime } from '../services/supabase';
import { calculateVacancies, refreshAdmissionData } from '../services/admissionStore';

interface PublicDisplayProps {
  summary?: VacancySummary;
  onRefresh?: () => void;
  onNavigate?: (route: 'admin' | 'display') => void;
  currentRoute?: 'admin' | 'display';
}

const DISPLAY_PROGRAM_NAMES: Record<BranchCode, string> = {
  CIVIL: 'Civil Engineering',
  CSE: 'Computer Science & Engineering',
  AI: 'Artificial Intelligence',
  DS: 'Data Science',
  CY: 'Cyber Security',
  IT: 'Information Technology',
  EE: 'Electrical Engineering',
  ENTC: 'Electronics & Telecommunication Engineering',
  MECH: 'Mechanical Engineering',
};

export const PublicDisplay: React.FC<PublicDisplayProps> = ({
  summary,
  onRefresh,
  onNavigate,
  currentRoute = 'display',
}) => {
  // Default selection is IL
  const [activeTab, setActiveTab] = useState<'IL' | 'A-CAP' | 'COMBINED'>('IL');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLoading, setIsLoading] = useState(!summary?.branches);
  const [dbError, setDbError] = useState<string | null>(null);

  // Authoritative internal summary state
  const [displaySummary, setDisplaySummary] = useState<VacancySummary>(() => {
    if (summary && summary.branches) return summary;
    return calculateVacancies([], DEFAULT_EMPTY_CAPACITIES);
  });

  const isSeparateDisplayWindow =
    typeof window !== 'undefined' &&
    (window.name === 'gh-raisoni-admission-display' || !!window.opener);

  // Sync if parent passes updated summary
  useEffect(() => {
    if (summary && summary.branches) {
      setDisplaySummary(summary);
      setIsLoading(false);
    }
  }, [summary]);

  // One authoritative function: refreshDisplayData (calls central refreshAdmissionData)
  const refreshDisplayData = useCallback(async () => {
    try {
      const data = await refreshAdmissionData();
      setDisplaySummary(data.vacancySummary);
      setDbError(null);
      if (onRefresh) {
        onRefresh();
      }
    } catch (err) {
      console.error('Failed to refresh display data from Supabase:', err);
      setDbError(err instanceof Error ? err.message : 'Database unavailable');
    } finally {
      setIsLoading(false);
    }
  }, [onRefresh]);

  // Lifecycle listeners & Realtime synchronization
  useEffect(() => {
    // 1. Initial authoritative fetch on mount
    refreshDisplayData();

    // 2. BroadcastChannel listener
    let channel: BroadcastChannel | null = null;
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        channel = new BroadcastChannel('gh_raisoni_admission_channel');
        channel.onmessage = (event) => {
          if (
            !event.data ||
            event.data.type === 'DISPLAY_REFRESH' ||
            event.data.type === 'DATA_UPDATED'
          ) {
            refreshDisplayData();
          }
        };
      }
    } catch {
      // BroadcastChannel optional fallback
    }

    // 3. Storage event listener (cross-window localStorage sync)
    const handleStorage = () => {
      refreshDisplayData();
    };
    window.addEventListener('storage', handleStorage);

    // 4. Custom event for same-tab updates
    const handleCustomEvent = () => {
      refreshDisplayData();
    };
    window.addEventListener('admission_data_updated', handleCustomEvent);
    window.addEventListener('admission_capacities_updated', handleCustomEvent);

    // 5. Window message listener (for postMessage from opener/reuse)
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === 'DISPLAY_REFRESH') {
        refreshDisplayData();
      }
    };
    window.addEventListener('message', handleMessage);

    // 6. Supabase Realtime subscription
    const unsubscribeSupabase = subscribeSupabaseRealtime(() => {
      refreshDisplayData();
    });

    // 7. Safety polling interval (every 3 seconds for reliable projector/TV display)
    const intervalId = setInterval(() => {
      refreshDisplayData();
    }, 3000);

    // 8. Complete cleanup on unmount
    return () => {
      if (channel) {
        channel.close();
      }
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('admission_data_updated', handleCustomEvent);
      window.removeEventListener('admission_capacities_updated', handleCustomEvent);
      window.removeEventListener('message', handleMessage);
      unsubscribeSupabase();
      clearInterval(intervalId);
    };
  }, [refreshDisplayData]);

  // Fullscreen state listener
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.error('Fullscreen request error:', err);
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch((err) => {
          console.error('Exit fullscreen error:', err);
        });
      }
    }
  };

  // Authoritative calculations per active mode
  const getBranchInitialTotal = (code: BranchCode): number => {
    const b = displaySummary.branches[code];
    if (!b) return 0;
    if (activeTab === 'IL') return b.initialIL;
    if (activeTab === 'A-CAP') return b.initialACAP;
    return b.initialIL + b.initialACAP;
  };

  const getBranchFilled = (code: BranchCode): number => {
    const b = displaySummary.branches[code];
    if (!b) return 0;
    if (activeTab === 'IL') return b.allocatedIL;
    if (activeTab === 'A-CAP') return b.allocatedACAP;
    return b.allocatedIL + b.allocatedACAP;
  };

  const getBranchVacancy = (code: BranchCode): number => {
    const b = displaySummary.branches[code];
    if (!b) return 0;
    if (activeTab === 'IL') return b.currentIL;
    if (activeTab === 'A-CAP') return b.currentACAP;
    return b.currentTotal;
  };

  const getSummaryMetrics = () => {
    if (activeTab === 'IL') {
      const totalInitial = displaySummary.initialTotalIL;
      const vacancy = displaySummary.totalIL;
      const filled = totalInitial - vacancy;
      return {
        modeName: 'IL',
        totalInitial,
        filled,
        vacancy,
      };
    }
    if (activeTab === 'A-CAP') {
      const totalInitial = displaySummary.initialTotalACAP;
      const vacancy = displaySummary.totalACAP;
      const filled = totalInitial - vacancy;
      return {
        modeName: 'A-CAP',
        totalInitial,
        filled,
        vacancy,
      };
    }
    // COMBINED
    const totalInitial = displaySummary.initialTotalCombined;
    const vacancy = displaySummary.totalCombined;
    const filled = totalInitial - vacancy;
    return {
      modeName: 'COMBINED',
      totalInitial,
      filled,
      vacancy,
    };
  };

  const metrics = getSummaryMetrics();

  return (
    <div className="min-h-screen bg-[#f1f5f9] text-slate-900 flex flex-col font-sans overflow-x-hidden select-none">
      {/* 1. Header (Compact ~66px height) */}
      <header className="bg-white border-b-2 border-orange-500 shadow-2xs shrink-0 z-30">
        <div className="max-w-[1250px] mx-auto px-4 sm:px-6 py-2">
          <div className="flex items-center justify-between gap-3">
            {/* College Crest & Title */}
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-lg bg-orange-600 text-white flex items-center justify-center font-black shadow-sm shrink-0 ring-2 ring-orange-200">
                <Building2 className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h1 className="text-sm sm:text-base md:text-lg font-black tracking-tight text-slate-900 uppercase truncate">
                  G. H. RAISONI COLLEGE OF ENGINEERING AND MANAGEMENT
                </h1>
                <p className="text-[11px] sm:text-xs font-bold text-orange-600 tracking-wide uppercase truncate">
                  {activeTab} LIVE VACANCY & SEAT AVAILABILITY DISPLAY BOARD
                </p>
              </div>
            </div>

            {/* Live Indicator, Controls & Nav Switcher */}
            <div className="flex items-center gap-2 shrink-0">
              {/* Live Status Indicator */}
              {dbError ? (
                <div className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-50 border border-red-200 text-red-800 text-[10px] font-bold shadow-2xs">
                  <span className="w-2 h-2 rounded-full bg-red-500"></span>
                  <span className="tracking-wider uppercase">DB UNAVAILABLE</span>
                </div>
              ) : (
                <div className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[10px] font-bold shadow-2xs">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  <span className="tracking-wider uppercase">
                    LIVE BROADCAST • AUTO-SYNC ACTIVE
                  </span>
                </div>
              )}

              {/* Refresh Button */}
              <button
                id="display-refresh-btn"
                onClick={refreshDisplayData}
                disabled={isLoading}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold border border-slate-300 transition-colors cursor-pointer disabled:opacity-60"
                title="Force refresh data"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-blue-600' : ''}`} />
                <span className="hidden md:inline">{isLoading ? 'Syncing...' : 'Refresh Now'}</span>
              </button>

              {/* Fullscreen Toggle Button */}
              <button
                id="display-fullscreen-btn"
                onClick={toggleFullscreen}
                className="inline-flex items-center gap-1 p-1.5 sm:px-2 sm:py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold border border-slate-300 transition-colors"
                title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
              >
                {isFullscreen ? (
                  <Minimize2 className="w-3.5 h-3.5" />
                ) : (
                  <Maximize2 className="w-3.5 h-3.5" />
                )}
                <span className="hidden lg:inline text-[11px]">
                  {isFullscreen ? 'Exit' : 'Fullscreen'}
                </span>
              </button>

              {/* Navigation Switcher: [ /admin ] [ /display ] (hidden in standalone popup/projector mode) */}
              {onNavigate && !isSeparateDisplayWindow && (
                <div className="flex items-center bg-slate-100 p-0.5 rounded-md border border-slate-300">
                  <button
                    id="nav-to-admin-btn"
                    onClick={() => onNavigate('admin')}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-bold transition-all ${
                      currentRoute === 'admin'
                        ? 'bg-blue-600 text-white shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Shield className="w-3 h-3" />
                    <span>/admin</span>
                  </button>
                  <button
                    id="nav-to-display-btn"
                    onClick={() => onNavigate('display')}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-bold transition-all ${
                      currentRoute === 'display'
                        ? 'bg-orange-600 text-white shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Monitor className="w-3 h-3" />
                    <span>/display</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* 2. Main Content Area (Compact, constrained to 100vh) */}
      <main className="max-w-[1250px] w-full mx-auto px-4 sm:px-6 py-2.5 flex-1 flex flex-col justify-between min-h-0 gap-2">
        {/* Top Control Bar: Title & Filter Tabs [ IL ] [ A-CAP ] [ COMBINED ] */}
        <div className="flex items-center justify-between shrink-0">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-orange-500"></span>
            <span>CENTRALIZED ADMISSION SEAT ALLOCATION STATUS</span>
          </div>

          {/* Filter Tabs: Compact in top-right of content area */}
          <div className="inline-flex bg-white p-1 rounded-xl border border-slate-300 shadow-2xs gap-1">
            <button
              id="display-tab-il"
              onClick={() => setActiveTab('IL')}
              className={`px-4 sm:px-5 py-1 rounded-lg font-black text-xs tracking-wider uppercase transition-all ${
                activeTab === 'IL'
                  ? 'bg-orange-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              IL
            </button>
            <button
              id="display-tab-acap"
              onClick={() => setActiveTab('A-CAP')}
              className={`hidden px-4 sm:px-5 py-1 rounded-lg font-black text-xs tracking-wider uppercase transition-all ${
                activeTab === 'A-CAP'
                  ? 'bg-orange-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              A-CAP
            </button>
            <button
              id="display-tab-combined"
              onClick={() => setActiveTab('COMBINED')}
              className={`px-4 sm:px-5 py-1 rounded-lg font-black text-xs tracking-wider uppercase transition-all ${
                activeTab === 'COMBINED'
                  ? 'bg-orange-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              COMBINED
            </button>
          </div>
        </div>

        {/* 3. Three Compact Horizontal Summary Cards (Hidden per request) */}
        <div className="hidden grid-cols-1 sm:grid-cols-3 gap-3 shrink-0">
          {/* Card 1: TOTAL APPROVED VACANCY */}
          <div
            id="display-card-total-vacancy"
            className="hidden bg-white rounded-xl border border-slate-200/90 p-3 sm:px-4 sm:py-3 shadow-xs items-center justify-between border-l-4 border-l-slate-700 shrink-0 transition-all"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center shrink-0 border border-slate-200">
                <Layers className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-[11px] sm:text-xs font-black uppercase tracking-wider text-slate-700 truncate">
                  TOTAL {metrics.modeName} VACANCY
                </div>
                <div className="text-[10px] sm:text-[11px] font-semibold text-slate-400 uppercase tracking-wider mt-0.5 truncate">
                  Approved Sanctioned Pool
                </div>
              </div>
            </div>
            <span className="text-2xl sm:text-3xl lg:text-4xl font-black font-mono text-slate-900 tracking-tight shrink-0 pl-2">
              {metrics.totalInitial}
            </span>
          </div>

          {/* Card 2: FILLED SEATS */}
          <div
            id="display-card-filled-seats"
            className="hidden bg-white rounded-xl border border-blue-100 p-3 sm:px-4 sm:py-3 shadow-xs items-center justify-between border-l-4 border-l-blue-600 shrink-0 transition-all"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-200">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-[11px] sm:text-xs font-black uppercase tracking-wider text-blue-700 truncate">
                  {metrics.modeName} FILLED SEATS
                </div>
                <div className="text-[10px] sm:text-[11px] font-semibold text-blue-400 uppercase tracking-wider mt-0.5 truncate">
                  Occupied / Confirmed
                </div>
              </div>
            </div>
            <span className="text-2xl sm:text-3xl lg:text-4xl font-black font-mono text-blue-700 tracking-tight shrink-0 pl-2">
              {metrics.filled}
            </span>
          </div>

          {/* Card 3: AVAILABLE SEATS */}
          <div
            id="display-card-available-seats"
            className="hidden bg-white rounded-xl border border-emerald-200 p-3 sm:px-4 sm:py-3 shadow-xs items-center justify-between border-l-4 border-l-emerald-500 ring-1 ring-emerald-500/10 shrink-0 transition-all"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-200">
                <Shield className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-[11px] sm:text-xs font-black uppercase tracking-wider text-emerald-800 truncate">
                  {metrics.modeName} AVAILABLE SEATS
                </div>
                <div className="text-[10px] sm:text-[11px] font-semibold text-emerald-600 uppercase tracking-wider mt-0.5 truncate">
                  Available Open Vacancy
                </div>
              </div>
            </div>
            <span
              id="display-summary-vacancy"
              className="text-2xl sm:text-3xl lg:text-4xl font-black font-mono text-emerald-600 tracking-tight shrink-0 pl-2"
            >
              {metrics.vacancy}
            </span>
          </div>
        </div>

        {/* 4. Main Institutional Vacancy Matrix (Height optimized for 9 rows on 1 screen) */}
        <div className="bg-white rounded-xl border border-slate-300 shadow-2xs overflow-hidden flex-1 flex flex-col justify-between min-h-0">
          {/* Table Header Title Bar */}
          <div className="px-4 py-2 bg-white border-b border-slate-200 flex items-center justify-between shrink-0">
            <h2 className="text-xs sm:text-sm font-black text-slate-900 tracking-tight uppercase flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-orange-600"></span>
              <span>OFFICIAL {metrics.modeName} VACANCY & SEAT AVAILABILITY MATRIX</span>
            </h2>
            <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-bold border border-slate-200">
              9 B.Tech Programs
            </span>
          </div>

          {/* Table Content */}
          <div className="w-full flex-1 flex flex-col justify-between overflow-x-auto min-h-0">
            <table className="w-full text-left border-collapse table-fixed">
              {/* Columns: Proportions strictly tuned */}
              <colgroup>
                <col className="w-[5%]" />
                <col className="w-[11%]" />
                <col className="w-[40%]" />
                <col className="w-[10%]" />
                <col className="w-[10%]" />
                <col className="w-[12%]" />
                <col className="w-[12%]" />
              </colgroup>

              <thead>
                <tr className="bg-[#1a233a] text-white text-[11px] uppercase tracking-wider font-black border-b border-slate-800">
                  <th className="py-2 px-2 text-center text-slate-300">#</th>
                  <th className="py-2 px-2 text-center text-orange-400">BRANCH CODE</th>
                  <th className="py-2 px-3 text-left">ENGINEERING PROGRAM</th>
                  <th className="py-2 px-2 text-center text-slate-300">TOTAL</th>
                  <th className="py-2 px-2 text-center text-slate-300">FILLED</th>
                  <th className="py-2 px-2 text-center bg-[#131b2e] text-emerald-400">
                    VACANCY
                  </th>
                  <th className="py-2 px-2 text-center">STATUS</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-200 text-xs sm:text-[13px] font-medium text-slate-800">
                {BRANCH_CODES.map((code, index) => {
                  const initialTotal = getBranchInitialTotal(code);
                  const filled = getBranchFilled(code);
                  const vacancy = getBranchVacancy(code);
                  const isZero = vacancy === 0;

                  return (
                    <tr
                      key={code}
                      className="hover:bg-orange-50/40 transition-colors duration-75 group h-[35px] sm:h-[38px]"
                    >
                      {/* 1. # (5%) */}
                      <td className="py-1.5 px-2 text-center font-mono text-slate-400 text-xs font-bold">
                        {index + 1}
                      </td>

                      {/* 2. BRANCH CODE (11%) */}
                      <td className="py-1.5 px-2 text-center">
                        <span className="inline-block px-2 py-0.5 rounded bg-slate-100 font-mono font-black text-slate-900 text-xs border border-slate-300">
                          {code}
                        </span>
                      </td>

                      {/* 3. ENGINEERING PROGRAM (40%) */}
                      <td className="py-1.5 px-3 font-semibold text-slate-900 text-xs sm:text-[13px] whitespace-nowrap truncate">
                        {DISPLAY_PROGRAM_NAMES[code]}
                      </td>

                      {/* 4. TOTAL (10%) */}
                      <td className="py-1.5 px-2 text-center font-mono font-bold text-slate-700 text-xs sm:text-sm">
                        {initialTotal}
                      </td>

                      {/* 5. FILLED (10%) */}
                      <td className="py-1.5 px-2 text-center font-mono font-bold text-blue-700 text-xs sm:text-sm">
                        {filled}
                      </td>

                      {/* 6. VACANCY (12% - Emphasized) */}
                      <td className="py-1.5 px-2 text-center bg-slate-50/70 group-hover:bg-orange-50/50">
                        <span
                          className={`text-base sm:text-lg font-black font-mono ${
                            isZero ? 'text-slate-400' : 'text-emerald-600'
                          }`}
                        >
                          {vacancy}
                        </span>
                      </td>

                      {/* 7. STATUS (12%) */}
                      <td className="py-1.5 px-2 text-center">
                        {!isZero ? (
                          <span className="inline-flex items-center justify-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300 tracking-wide uppercase shadow-2xs whitespace-nowrap">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                            <span>OPEN - {vacancy}</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center justify-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-rose-100 text-rose-800 border border-rose-300 tracking-wide uppercase shadow-2xs whitespace-nowrap">
                            <XCircle className="w-3 h-3 text-rose-600 shrink-0" />
                            <span>FULL</span>
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* 5. Compact Institutional Footer (~28px height) */}
      <footer className="bg-white border-t border-slate-300 py-1.5 shrink-0">
        <div className="max-w-[1250px] mx-auto px-4 sm:px-6 flex items-center justify-between text-[11px] text-slate-500">
          <div className="flex items-center gap-2 font-semibold text-slate-700">
            <span>Centralized Admission System</span>
            <span>•</span>
            <span>Live Admission Vacancy Display</span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-500">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
            <span>Auto-sync enabled</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
