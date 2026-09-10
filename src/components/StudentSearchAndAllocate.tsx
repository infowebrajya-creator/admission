import React, { useState, useMemo } from 'react';
import { Search, UserCheck, CheckCircle2, AlertCircle, ArrowRightLeft, XCircle, ChevronRight, User } from 'lucide-react';
import { BRANCH_CODES, BRANCH_NAMES } from '../constants';
import { BranchCode, ProcessingMode, Student, VacancySummary } from '../types';

interface StudentSearchAndAllocateProps {
  students: Student[];
  selectedStudent: Student | null;
  onSelectStudent: (student: Student | null) => void;
  onAllocate: (
    applicationId: string,
    branch: BranchCode,
    quota: ProcessingMode
  ) => Promise<{ success: boolean; message: string }> | { success: boolean; message: string };
  onUnallocate: (
    applicationId: string
  ) => Promise<{ success: boolean; message: string }> | { success: boolean; message: string };
  vacancySummary: VacancySummary;
}

export const StudentSearchAndAllocate: React.FC<StudentSearchAndAllocateProps> = ({
  students,
  selectedStudent,
  onSelectStudent,
  onAllocate,
  onUnallocate,
  vacancySummary,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBranch, setSelectedBranch] = useState<BranchCode>('CSE');
  const [selectedQuota, setSelectedQuota] = useState<ProcessingMode>('IL');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sync quota when a student is selected
  React.useEffect(() => {
    if (selectedStudent) {
      if (selectedStudent.allocated_quota) {
        setSelectedQuota(selectedStudent.allocated_quota);
      } else if (selectedStudent.current_processing_mode) {
        setSelectedQuota(selectedStudent.current_processing_mode);
      } else if (selectedStudent.original_merit_selection.includes('A-CAP')) {
        setSelectedQuota('A-CAP');
      } else {
        setSelectedQuota('IL');
      }

      if (selectedStudent.allocated_branch_id) {
        setSelectedBranch(selectedStudent.allocated_branch_id);
      }
      setFeedback(null);
    }
  }, [selectedStudent]);

  // Filter students by Application ID, Candidate Name, or Merit Number
  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return students
      .filter((s) => {
        const matchAppId = s.application_id.toLowerCase().includes(q);
        const matchName = s.candidate_name.toLowerCase().includes(q);
        const matchMerit = String(s.merit_number).toLowerCase().includes(q);
        return matchAppId || matchName || matchMerit;
      })
      .slice(0, 10);
  }, [students, searchQuery]);

  const handleAllocate = async (isReassign = false) => {
    if (!selectedStudent) return;

    // Check vacancy for selected branch & quota
    const branchVacancy = vacancySummary.branches[selectedBranch];
    const availableInQuota =
      selectedQuota === 'IL' ? branchVacancy.currentIL : branchVacancy.currentACAP;

    // If student is already in this branch with same quota
    if (
      isReassign &&
      selectedStudent.allocated_branch_id === selectedBranch &&
      selectedStudent.allocated_quota === selectedQuota
    ) {
      setFeedback({
        type: 'error',
        text: `Student is already allocated to ${selectedBranch} (${selectedQuota}).`,
      });
      return;
    }

    // Zero vacancy guard: Never allow allocation when vacancy is zero
    if (availableInQuota <= 0) {
      setFeedback({
        type: 'error',
        text: `Cannot allocate: Vacancy for ${selectedBranch} under ${selectedQuota} is 0.`,
      });
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await onAllocate(selectedStudent.application_id, selectedBranch, selectedQuota);
      setIsSubmitting(false);
      if (res.success) {
        setFeedback({ type: 'success', text: res.message });
      } else {
        setFeedback({ type: 'error', text: res.message });
      }
    } catch (err) {
      setIsSubmitting(false);
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Allocation failed. Please try again.',
      });
    }
  };

  const handleUnallocate = async () => {
    if (!selectedStudent) return;
    try {
      setIsSubmitting(true);
      const res = await onUnallocate(selectedStudent.application_id);
      setIsSubmitting(false);
      if (res.success) {
        setFeedback({ type: 'success', text: res.message });
      } else {
        setFeedback({ type: 'error', text: res.message });
      }
    } catch (err) {
      setIsSubmitting(false);
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Unallocation failed. Please try again.',
      });
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 flex flex-col gap-5">
      {/* Section Header */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div>
          <h2 className="text-base font-bold text-slate-800 tracking-tight flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-blue-600" />
            Student Search & Branch Allocation
          </h2>
          <p className="text-xs text-slate-500">
            Search student by Application ID, Candidate Name, or Merit Number
          </p>
        </div>
      </div>

      {/* Search Input */}
      <div className="relative">
        <label htmlFor="student-search-input" className="block text-xs font-semibold text-slate-700 mb-1">
          Search Student
        </label>
        <div className="relative">
          <input
            id="student-search-input"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Type Application ID (e.g., EN24...), Name, or Merit No..."
            className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-2.5 text-xs text-slate-400 hover:text-slate-600"
            >
              Clear
            </button>
          )}
        </div>

        {/* Live Search Dropdown */}
        {searchResults.length > 0 && (
          <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-64 overflow-y-auto divide-y divide-slate-100">
            {searchResults.map((s) => (
              <button
                key={s.application_id}
                onClick={() => {
                  onSelectStudent(s);
                  setSearchQuery('');
                }}
                className="w-full text-left px-3.5 py-2.5 hover:bg-blue-50 flex items-center justify-between text-xs transition-colors"
              >
                <div>
                  <div className="font-semibold text-slate-900 flex items-center gap-2">
                    <span>{s.candidate_name}</span>
                    <span className="font-mono text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                      {s.application_id}
                    </span>
                  </div>
                  <div className="text-slate-500 mt-0.5 flex gap-3 text-[11px]">
                    <span>Merit No: <strong className="text-slate-700">{s.merit_number}</strong></span>
                    <span>Status: <strong className="text-slate-700">{s.original_merit_selection}</strong></span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {s.allocated_branch_id ? (
                    <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-mono font-bold text-[11px]">
                      {s.allocated_branch_id}
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 text-[11px]">
                      Unallocated
                    </span>
                  )}
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Selected Student Details Card */}
      {selectedStudent ? (
        <div className="bg-slate-50/90 rounded-xl border border-slate-200 p-4 flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm">
                <User className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">
                  {selectedStudent.candidate_name}
                </h3>
                <span className="font-mono text-xs text-slate-500">
                  App ID: <strong className="text-slate-800">{selectedStudent.application_id}</strong>
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs px-2.5 py-1 rounded-md font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                Merit #{selectedStudent.merit_number}
              </span>
              <span className="text-xs px-2.5 py-1 rounded-md font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                {selectedStudent.original_merit_selection}
              </span>
              <button
                onClick={() => onSelectStudent(null)}
                className="text-slate-400 hover:text-slate-600 text-xs ml-1"
                title="Deselect student"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Academic Percentiles Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <div className="bg-white p-2 rounded border border-slate-200">
              <span className="text-slate-400 block text-[10px]">PCM CET %ile</span>
              <span className="font-semibold text-slate-800">{selectedStudent.pcm_percentile || '—'}</span>
            </div>
            <div className="bg-white p-2 rounded border border-slate-200">
              <span className="text-slate-400 block text-[10px]">JEE %ile</span>
              <span className="font-semibold text-slate-800">{selectedStudent.jee_percentile || '—'}</span>
            </div>
            <div className="bg-white p-2 rounded border border-slate-200">
              <span className="text-slate-400 block text-[10px]">HSC %</span>
              <span className="font-semibold text-slate-800">{selectedStudent.hsc_percentage || '—'}%</span>
            </div>
            <div className="bg-white p-2 rounded border border-slate-200">
              <span className="text-slate-400 block text-[10px]">SSC %</span>
              <span className="font-semibold text-slate-800">{selectedStudent.ssc_percentage || '—'}%</span>
            </div>
          </div>

          {/* Current Allocated Branch Status */}
          <div className="bg-white rounded-lg p-3 border border-slate-200 flex items-center justify-between">
            <span className="text-xs font-medium text-slate-600">Current Status:</span>
            {selectedStudent.allocated_branch_id ? (
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-emerald-100 text-emerald-800">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  Allocated: {selectedStudent.allocated_branch_id} ({selectedStudent.allocated_quota || 'IL'})
                </span>
                <span className="text-[11px] text-slate-400">
                  {BRANCH_NAMES[selectedStudent.allocated_branch_id]}
                </span>
              </div>
            ) : (
              <span className="px-2.5 py-1 rounded-md text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                Unallocated
              </span>
            )}
          </div>

          {/* Allocation Controls */}
          <div className="pt-2 border-t border-slate-200 flex flex-col gap-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Branch Selector (Only the 9 approved branches) */}
              <div>
                <label htmlFor="branch-select" className="block text-xs font-semibold text-slate-700 mb-1">
                  Target Branch (9 Branches)
                </label>
                <select
                  id="branch-select"
                  value={selectedBranch}
                  onChange={(e) => setSelectedBranch(e.target.value as BranchCode)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-800 font-semibold focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                >
                  {BRANCH_CODES.map((code) => {
                    const b = vacancySummary.branches[code];
                    const vac = selectedQuota === 'IL' ? b.currentIL : b.currentACAP;
                    return (
                      <option key={code} value={code} disabled={vac <= 0 && selectedStudent.allocated_branch_id !== code}>
                        {code} — {BRANCH_NAMES[code]} (Vac: {vac})
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Quota Selector */}
              <div>
                <label htmlFor="quota-select" className="block text-xs font-semibold text-slate-700 mb-1">
                  Allocation Quota
                </label>
                <select
                  id="quota-select"
                  value={selectedQuota}
                  onChange={(e) => setSelectedQuota(e.target.value as ProcessingMode)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-800 font-medium focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                >
                  {selectedStudent.original_merit_selection.includes('IL') && (
                    <option value="IL">IL Quota (Available: {vacancySummary.branches[selectedBranch]?.currentIL ?? 0})</option>
                  )}
                  {selectedStudent.original_merit_selection.includes('A-CAP') && (
                    <option value="A-CAP">A-CAP Quota (Available: {vacancySummary.branches[selectedBranch]?.currentACAP ?? 0})</option>
                  )}
                  {/* If neither matched explicitly */}
                  {!selectedStudent.original_merit_selection.includes('IL') &&
                   !selectedStudent.original_merit_selection.includes('A-CAP') && (
                    <>
                      <option value="IL">IL Quota</option>
                      <option value="A-CAP">A-CAP Quota</option>
                    </>
                  )}
                </select>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-2 mt-1">
              {!selectedStudent.allocated_branch_id ? (
                <button
                  id="allocate-branch-btn"
                  onClick={() => handleAllocate(false)}
                  disabled={
                    (selectedQuota === 'IL'
                      ? vacancySummary.branches[selectedBranch]?.currentIL
                      : vacancySummary.branches[selectedBranch]?.currentACAP) <= 0
                  }
                  className="flex-1 sm:flex-none px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-xs font-bold rounded-lg shadow-xs transition-colors flex items-center justify-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Allocate Branch</span>
                </button>
              ) : (
                <>
                  <button
                    id="reassign-branch-btn"
                    onClick={() => handleAllocate(true)}
                    className="flex-1 sm:flex-none px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow-xs transition-colors flex items-center justify-center gap-2"
                  >
                    <ArrowRightLeft className="w-4 h-4" />
                    <span>Reassign Branch</span>
                  </button>

                  <button
                    id="unallocate-branch-btn"
                    onClick={handleUnallocate}
                    className="flex-1 sm:flex-none px-4 py-2 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs font-bold rounded-lg shadow-xs transition-colors flex items-center justify-center gap-2"
                  >
                    <XCircle className="w-4 h-4 text-red-500" />
                    <span>Unallocate</span>
                  </button>
                </>
              )}
            </div>

            {/* Feedback alert */}
            {feedback && (
              <div
                className={`p-3 rounded-lg text-xs flex items-center gap-2 ${
                  feedback.type === 'success'
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-red-50 text-red-800 border border-red-200'
                }`}
              >
                {feedback.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                )}
                <span>{feedback.text}</span>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="border border-dashed border-slate-200 rounded-xl p-6 text-center text-slate-400 text-xs bg-slate-50/50">
          <Search className="w-6 h-6 mx-auto mb-2 text-slate-300" />
          <p className="font-medium text-slate-600">No Student Selected</p>
          <p className="mt-1 text-slate-400">
            Use the search bar above or click any candidate from the student list below to allocate a branch.
          </p>
        </div>
      )}
    </div>
  );
};
