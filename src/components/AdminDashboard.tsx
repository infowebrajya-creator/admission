import React, { useState, useRef, useEffect } from 'react';
import {
  Upload,
  Download,
  RotateCcw,
  RefreshCw,
  Info,
  Layers,
  FileSpreadsheet,
  FileText,
  ChevronDown,
} from 'lucide-react';
import { AdminVacancyTable } from './AdminVacancyTable';
import { StudentSearchAndAllocate } from './StudentSearchAndAllocate';
import { StudentListTable } from './StudentListTable';
import { ImportModal } from './ImportModal';
import { EditVacancyModal } from './EditVacancyModal';
import { EXPECTED_EXCEL_COLUMNS } from '../constants';
import { BranchCode, ProcessingMode, Student, VacancySummary } from '../types';
import {
  exportStudentsToExcel,
  resetAllAdmissionData,
} from '../services/admissionStore';
import {
  generateAcapReportPdf,
  generateIlReportPdf,
  generateCombinedReportPdf,
  generateAllottedStudentsReportPdf,
} from '../services/admissionReportPdf';
import { generateAllottedStudentsExcelReport } from '../services/allottedStudentsExcel';
import { notifyDisplayRefresh } from '../utils/displayWindow';
import { persistBranchCapacitiesToSupabase } from '../services/supabase';

interface AdminDashboardProps {
  students: Student[];
  vacancySummary: VacancySummary;
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
  onReload: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  students,
  vacancySummary,
  selectedStudent,
  onSelectStudent,
  onAllocate,
  onUnallocate,
  onReload,
}) => {
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isEditVacancyModalOpen, setIsEditVacancyModalOpen] = useState(false);
  const [showFormatInfo, setShowFormatInfo] = useState(false);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isExportingAllotted, setIsExportingAllotted] = useState(false);
  const [isExportingAllottedExcel, setIsExportingAllottedExcel] = useState(false);
  const exportDropdownRef = useRef<HTMLDivElement>(null);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      await onReload();
    } finally {
      setTimeout(() => setIsRefreshing(false), 300);
    }
  };

  const handleSaveCapacities = async (
    newCapacities: Record<BranchCode, { il: number; acap: number }>
  ) => {
    await persistBranchCapacitiesToSupabase(newCapacities);
    onReload();
    notifyDisplayRefresh();
  };

  // Close export dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        exportDropdownRef.current &&
        !exportDropdownRef.current.contains(event.target as Node)
      ) {
        setIsExportMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleExportExcel = () => {
    exportStudentsToExcel(students);
    setIsExportMenuOpen(false);
  };

  const handleExportAcapPdf = () => {
    generateAcapReportPdf(students);
    setIsExportMenuOpen(false);
  };

  const handleExportIlPdf = () => {
    generateIlReportPdf(students);
    setIsExportMenuOpen(false);
  };

  const handleExportCombinedPdf = () => {
    generateCombinedReportPdf(students);
    setIsExportMenuOpen(false);
  };

  const handleExportAllottedPdf = async () => {
    setIsExportingAllotted(true);
    try {
      await generateAllottedStudentsReportPdf(students);
    } catch (err) {
      console.error('Failed to generate Allotted Students Report PDF:', err);
    } finally {
      setIsExportingAllotted(false);
      setIsExportMenuOpen(false);
    }
  };

  const handleExportAllottedExcel = async () => {
    setIsExportingAllottedExcel(true);
    try {
      await generateAllottedStudentsExcelReport(students);
    } catch (err) {
      console.error('Failed to generate Allotted Students Report Excel:', err);
    } finally {
      setIsExportingAllottedExcel(false);
      setIsExportMenuOpen(false);
    }
  };

  const handleResetData = async () => {
    if (
      confirm(
        'Are you sure you want to reset all student allocations in Supabase? All students will return to unallocated status and vacancies will return to full capacity.'
      )
    ) {
      await resetAllAdmissionData();
      onSelectStudent(null);
      onReload();
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Top Action Bar */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight">
            Admin Admission Dashboard
          </h1>
          <p className="text-xs text-slate-500">
            Direct access • No login required • Authoritative branch seat management
          </p>
        </div>

        {/* Action Buttons: 1. Import Students, 2. Refresh, 3. Export Dropdown */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            id="admin-import-btn"
            onClick={() => setIsImportModalOpen(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors"
          >
            <Upload className="w-4 h-4" />
            <span>Import Students</span>
          </button>

          <button
            id="admin-refresh-btn"
            onClick={handleManualRefresh}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold shadow-xs transition-colors"
            title="Refetch authoritative student records from Supabase"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-blue-600' : ''}`} />
            <span>Refresh</span>
          </button>

          {/* Export Menu Dropdown */}
          <div className="relative" ref={exportDropdownRef}>
            <button
              id="admin-export-dropdown-btn"
              onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-bold shadow-xs transition-colors"
            >
              <Download className="w-4 h-4" />
              <span>Export</span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isExportMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {isExportMenuOpen && (
              <div className="absolute right-0 mt-1.5 w-60 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-50 text-xs animate-in fade-in">
                <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider font-bold text-slate-400 border-b border-slate-100">
                  Export Options
                </div>

                <button
                  id="export-option-excel"
                  onClick={handleExportExcel}
                  className="w-full text-left px-3 py-2.5 hover:bg-slate-50 flex items-center gap-2.5 text-slate-700 transition-colors"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600 shrink-0" />
                  <div>
                    <div className="font-semibold text-slate-900">1. Student Excel</div>
                    <div className="text-[11px] text-slate-400">All registered candidates (.xlsx)</div>
                  </div>
                </button>

                <button
                  id="export-option-acap-pdf"
                  onClick={handleExportAcapPdf}
                  className="w-full text-left px-3 py-2.5 hover:bg-slate-50 flex items-center gap-2.5 text-slate-700 transition-colors"
                >
                  <FileText className="w-4 h-4 text-purple-600 shrink-0" />
                  <div>
                    <div className="font-semibold text-slate-900">2. A-CAP Report PDF</div>
                    <div className="text-[11px] text-slate-400">Official A-CAP attended report</div>
                  </div>
                </button>

                <button
                  id="export-option-il-pdf"
                  onClick={handleExportIlPdf}
                  className="w-full text-left px-3 py-2.5 hover:bg-slate-50 flex items-center gap-2.5 text-slate-700 transition-colors"
                >
                  <FileText className="w-4 h-4 text-blue-600 shrink-0" />
                  <div>
                    <div className="font-semibold text-slate-900">3. IL Report PDF</div>
                    <div className="text-[11px] text-slate-400">Official Institute Level report</div>
                  </div>
                </button>

                <button
                  id="export-option-combined-pdf"
                  onClick={handleExportCombinedPdf}
                  className="w-full text-left px-3 py-2.5 hover:bg-slate-50 flex items-center gap-2.5 text-slate-700 border-t border-slate-100 transition-colors"
                >
                  <FileText className="w-4 h-4 text-indigo-600 shrink-0" />
                  <div>
                    <div className="font-semibold text-slate-900">4. Combined Report PDF</div>
                    <div className="text-[11px] text-slate-400">Both A-CAP & IL with page breaks</div>
                  </div>
                </button>

                <button
                  id="export-option-allotted-pdf"
                  onClick={handleExportAllottedPdf}
                  disabled={isExportingAllotted}
                  className="w-full text-left px-3 py-2.5 hover:bg-slate-50 flex items-center gap-2.5 text-slate-700 border-t border-slate-100 transition-colors disabled:opacity-50"
                >
                  <FileText className="w-4 h-4 text-emerald-600 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-slate-900 flex items-center justify-between">
                      <span>5. Allotted Students Report PDF</span>
                      {isExportingAllotted && (
                        <RefreshCw className="w-3 h-3 animate-spin text-emerald-600 ml-1 shrink-0" />
                      )}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Official datewise report of allotted students
                    </div>
                  </div>
                </button>

                <button
                  id="export-option-allotted-excel"
                  onClick={handleExportAllottedExcel}
                  disabled={isExportingAllottedExcel}
                  className="w-full text-left px-3 py-2.5 hover:bg-slate-50 flex items-center gap-2.5 text-slate-700 border-t border-slate-100 transition-colors disabled:opacity-50"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-slate-900 flex items-center justify-between">
                      <span>6. Allotted Students Report Excel</span>
                      {isExportingAllottedExcel && (
                        <RefreshCw className="w-3 h-3 animate-spin text-emerald-600 ml-1 shrink-0" />
                      )}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Official institutional Excel (.xlsx) report
                    </div>
                  </div>
                </button>
              </div>
            )}
          </div>

          <button
            onClick={() => setShowFormatInfo(!showFormatInfo)}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors"
            title="Excel Format Information"
          >
            <Info className="w-4 h-4 text-slate-500" />
            <span className="hidden md:inline">Format Info</span>
          </button>

          {students.length > 0 && (
            <button
              onClick={handleResetData}
              className="inline-flex items-center gap-1 px-2.5 py-2 text-slate-400 hover:text-red-600 rounded-lg text-xs transition-colors"
              title="Reset all student allocations"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* 3. Common Excel import format information callout */}
      {showFormatInfo && (
        <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-4 text-xs space-y-2 animate-in fade-in">
          <div className="flex items-center justify-between">
            <span className="font-bold text-blue-900 flex items-center gap-1.5">
              <FileSpreadsheet className="w-4 h-4 text-blue-600" />
              Common Excel Import Format Specifications
            </span>
            <button
              onClick={() => setShowFormatInfo(false)}
              className="text-slate-400 hover:text-slate-600 font-bold"
            >
              ✕
            </button>
          </div>
          <p className="text-blue-950">
            Both IL and A-CAP files must follow this common format. <strong>Application ID</strong> is the reconciliation key.
            If the same student exists in both files, ONE record is created with <code>original_merit_selection = "IL + A-CAP"</code> and <code>current_processing_mode = "IL"</code>.
          </p>
          <div className="flex flex-wrap gap-1.5 font-mono text-[11px] pt-1">
            {EXPECTED_EXCEL_COLUMNS.map((col) => (
              <span key={col} className="px-2 py-0.5 rounded bg-white text-slate-800 border border-blue-200 shadow-2xs">
                {col}
              </span>
            ))}
          </div>
          <p className="text-[11px] text-blue-800">
            * Accepts typo: <code>Signture</code>. No Course/Branch columns are expected or parsed. Imported students remain unallocated.
          </p>
        </div>
      )}

      {/* Grid: 8. Admission Vacancy Display & 5/6. Student Search & Allocation Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Vacancy Display (9 Branches) */}
        <div className="lg:col-span-6">
          <AdminVacancyTable
            summary={vacancySummary}
            onOpenEditModal={() => setIsEditVacancyModalOpen(true)}
          />
        </div>

        {/* 4. Student Search & 6. Allocation Controls */}
        <div className="lg:col-span-6">
          <StudentSearchAndAllocate
            students={students}
            selectedStudent={selectedStudent}
            onSelectStudent={onSelectStudent}
            onAllocate={onAllocate}
            onUnallocate={onUnallocate}
            vacancySummary={vacancySummary}
          />
        </div>
      </div>

      {/* 7. IL / A-CAP Filter Buttons & Student Registry Table */}
      <div>
        <StudentListTable
          students={students}
          selectedStudent={selectedStudent}
          onSelectStudent={onSelectStudent}
        />
      </div>

      {/* Import Modal */}
      <ImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImportComplete={() => {
          onReload();
        }}
      />

      {/* Edit Vacancy Modal */}
      <EditVacancyModal
        isOpen={isEditVacancyModalOpen}
        onClose={() => setIsEditVacancyModalOpen(false)}
        summary={vacancySummary}
        onSave={handleSaveCapacities}
      />
    </div>
  );
};
