import React, { useState, useEffect, useCallback } from 'react';
import { Navbar } from './components/Navbar';
import { AdminDashboard } from './components/AdminDashboard';
import { PublicDisplay } from './components/PublicDisplay';
import { DEFAULT_EMPTY_CAPACITIES } from './constants';
import {
  calculateVacancies,
  refreshAdmissionData,
  allocateStudentBranch,
  unallocateStudentBranch,
} from './services/admissionStore';
import { subscribeSupabaseRealtime } from './services/supabase';
import { BranchCode, ProcessingMode, Student } from './types';
import { AlertCircle, RefreshCw } from 'lucide-react';

export default function App() {
  // Resolve initial route from window.location.pathname or hash
  const getInitialRoute = (): 'admin' | 'display' => {
    const path = window.location.pathname.toLowerCase();
    const hash = window.location.hash.toLowerCase();
    if (path.includes('display') || hash.includes('display')) {
      return 'display';
    }
    return 'admin';
  };

  const [currentRoute, setCurrentRoute] = useState<'admin' | 'display'>(getInitialRoute);
  const [students, setStudents] = useState<Student[]>([]);
  const [capacities, setCapacities] = useState<Record<BranchCode, { il: number; acap: number }>>(
    DEFAULT_EMPTY_CAPACITIES
  );
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [dbError, setDbError] = useState<string | null>(null);

  // Synchronize route with browser URL history
  const navigateTo = (route: 'admin' | 'display') => {
    setCurrentRoute(route);
    const newPath = `/${route}`;
    if (window.location.pathname !== newPath) {
      window.history.pushState(null, '', newPath);
    }
  };

  // Listen to popstate (browser back/forward)
  useEffect(() => {
    const handlePopState = () => {
      setCurrentRoute(getInitialRoute());
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Authoritative single refresh function (Requirement 19)
  const reloadData = useCallback(async () => {
    try {
      const data = await refreshAdmissionData();
      setStudents(data.students);
      setCapacities(data.capacities);
      setDbError(null);
      if (selectedStudent) {
        const updated = data.students.find(
          (s) => s.application_id === selectedStudent.application_id
        );
        setSelectedStudent(updated || null);
      }
    } catch (err) {
      console.error('Could not sync with Supabase in App:', err);
      setDbError(err instanceof Error ? err.message : 'Database error');
    } finally {
      setIsInitialLoading(false);
    }
  }, [selectedStudent]);

  // Initial mount authoritative fetch
  useEffect(() => {
    reloadData();
  }, [reloadData]);

  // Synchronize with storage updates, messages, BroadcastChannel, and Supabase realtime
  useEffect(() => {
    const handleStorageChange = () => {
      reloadData();
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('admission_data_updated', handleStorageChange);
    window.addEventListener('admission_capacities_updated', handleStorageChange);

    // Window message listener for cross-window signals
    const handleWindowMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === 'DISPLAY_REFRESH') {
        reloadData();
      }
    };
    window.addEventListener('message', handleWindowMessage);

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
            reloadData();
          }
        };
      }
    } catch {
      // BroadcastChannel optional fallback
    }

    // Supabase Realtime subscription
    const unsubscribeSupabase = subscribeSupabaseRealtime(() => {
      reloadData();
    });

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('admission_data_updated', handleStorageChange);
      window.removeEventListener('admission_capacities_updated', handleStorageChange);
      window.removeEventListener('message', handleWindowMessage);
      if (channel) {
        channel.close();
      }
      unsubscribeSupabase();
    };
  }, [reloadData]);

  // Authoritative calculated vacancies directly derived from current Supabase data
  const vacancySummary = calculateVacancies(students, capacities);

  // Authoritative allocation handler
  const handleAllocate = async (
    applicationId: string,
    branch: BranchCode,
    quota: ProcessingMode
  ) => {
    const res = await allocateStudentBranch(
      applicationId,
      branch,
      quota,
      students,
      capacities
    );
    if (res.success) {
      await reloadData();
    }
    return res;
  };

  // Authoritative unallocation handler
  const handleUnallocate = async (applicationId: string) => {
    const res = await unallocateStudentBranch(applicationId, students);
    if (res.success) {
      await reloadData();
    }
    return res;
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 flex flex-col font-sans antialiased selection:bg-blue-600 selection:text-white">
      {/* Top Navbar for Admin */}
      {currentRoute === 'admin' && (
        <Navbar
          currentRoute={currentRoute}
          onNavigate={navigateTo}
          vacancySummary={vacancySummary}
        />
      )}

      {/* Database Error Banner if Supabase request fails */}
      {dbError && (
        <div className="bg-red-500 text-white px-4 py-2.5 text-xs font-bold flex items-center justify-between shadow-md">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>Database Connection Warning: {dbError}. Showing last known state.</span>
          </div>
          <button
            onClick={() => reloadData()}
            className="px-2.5 py-1 bg-white/20 hover:bg-white/30 rounded text-white text-xs font-bold transition-colors cursor-pointer"
          >
            Retry Connection
          </button>
        </div>
      )}

      {/* Main View: /admin or /display */}
      <div className="flex-1">
        {isInitialLoading && students.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3 text-slate-500">
            <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
            <p className="text-sm font-semibold text-slate-700">
              Connecting to authoritative database...
            </p>
            <p className="text-xs text-slate-400">
              Fetching branch capacities and student records
            </p>
          </div>
        ) : currentRoute === 'admin' ? (
          <AdminDashboard
            students={students}
            vacancySummary={vacancySummary}
            selectedStudent={selectedStudent}
            onSelectStudent={setSelectedStudent}
            onAllocate={handleAllocate}
            onUnallocate={handleUnallocate}
            onReload={reloadData}
          />
        ) : (
          <PublicDisplay
            summary={vacancySummary}
            onRefresh={reloadData}
            onNavigate={navigateTo}
            currentRoute={currentRoute}
          />
        )}
      </div>
    </div>
  );
}
