import React, { useState, useMemo } from 'react';
import { Filter, UserCheck, ArrowUpDown, ChevronRight, ChevronLeft, FileCode, X } from 'lucide-react';
import { Student } from '../types';

interface StudentListTableProps {
  students: Student[];
  selectedStudent: Student | null;
  onSelectStudent: (student: Student) => void;
}

export const StudentListTable: React.FC<StudentListTableProps> = ({
  students,
  selectedStudent,
  onSelectStudent,
}) => {
  const [filterMode, setFilterMode] = useState<'ALL' | 'IL' | 'A-CAP'>('ALL');
  const [tableSearch, setTableSearch] = useState('');
  const [sortField, setSortField] = useState<'merit' | 'appId' | 'name'>('merit');
  const [sortAsc, setSortAsc] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number | 'ALL'>(50);
  const [rawViewStudent, setRawViewStudent] = useState<Student | null>(null);

  // Derive counts dynamically from public.students loaded registry
  const allCount = students.length;
  const ilCount = useMemo(
    () => students.filter((s) => s.current_processing_mode === 'IL').length,
    [students]
  );
  const acapCount = useMemo(
    () => students.filter((s) => s.current_processing_mode === 'A-CAP').length,
    [students]
  );

  const filteredStudents = useMemo(() => {
    let list = students;

    // Filter by [ ALL ], [ IL ], [ A-CAP ] based on current_processing_mode
    if (filterMode === 'IL') {
      list = list.filter((s) => s.current_processing_mode === 'IL');
    } else if (filterMode === 'A-CAP') {
      list = list.filter((s) => s.current_processing_mode === 'A-CAP');
    }

    // Filter by quick search: Application ID, Candidate Name, or Merit Number
    if (tableSearch.trim()) {
      const q = tableSearch.toLowerCase().trim().replace(/^#/, '');
      list = list.filter(
        (s) =>
          s.application_id.toLowerCase().includes(q) ||
          s.candidate_name.toLowerCase().includes(q) ||
          String(s.merit_number).toLowerCase().includes(q)
      );
    }

    // Sort
    return [...list].sort((a, b) => {
      if (sortField === 'merit') {
        const numA = Number(a.merit_number) || 999999;
        const numB = Number(b.merit_number) || 999999;
        return sortAsc ? numA - numB : numB - numA;
      }
      if (sortField === 'appId') {
        return sortAsc
          ? a.application_id.localeCompare(b.application_id)
          : b.application_id.localeCompare(a.application_id);
      }
      if (sortField === 'name') {
        return sortAsc
          ? a.candidate_name.localeCompare(b.candidate_name)
          : b.candidate_name.localeCompare(a.candidate_name);
      }
      return 0;
    });
  }, [students, filterMode, tableSearch, sortField, sortAsc]);

  const totalPages =
    pageSize === 'ALL'
      ? 1
      : Math.max(1, Math.ceil(filteredStudents.length / (pageSize as number)));

  const paginatedStudents = useMemo(() => {
    if (pageSize === 'ALL') return filteredStudents;
    const start = (currentPage - 1) * pageSize;
    return filteredStudents.slice(start, start + pageSize);
  }, [filteredStudents, currentPage, pageSize]);

  const handleSort = (field: 'merit' | 'appId' | 'name') => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const handleFilterChange = (mode: 'ALL' | 'IL' | 'A-CAP') => {
    setFilterMode(mode);
    setCurrentPage(1);
  };

  const handleSearchChange = (val: string) => {
    setTableSearch(val);
    setCurrentPage(1);
  };

  const startIdx = pageSize === 'ALL' ? 0 : (currentPage - 1) * (pageSize as number);
  const endIdx =
    pageSize === 'ALL'
      ? filteredStudents.length
      : Math.min(startIdx + (pageSize as number), filteredStudents.length);

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden flex flex-col">
      {/* Header & Controls */}
      <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 bg-slate-50/60">
        <div>
          <h2 className="text-base font-bold text-slate-800 tracking-tight flex items-center gap-2">
            <span>Imported Students</span>
            <span className="text-sm px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-900 font-mono font-bold">
              {allCount}
            </span>
            {filteredStudents.length !== allCount && (
              <span className="text-xs text-slate-500 font-normal">
                ({filteredStudents.length} of {allCount} filtered)
              </span>
            )}
          </h2>
          <p className="text-xs text-slate-500">
            Reconciled student registry. Click any row to allocate or view raw data.
          </p>
        </div>

        {/* Filter Controls: [ ALL (1558) ] [ IL (1558) ] [ A-CAP (0) ] */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center bg-slate-200/80 p-1 rounded-lg">
            <button
              id="filter-all-btn"
              onClick={() => handleFilterChange('ALL')}
              className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${
                filterMode === 'ALL'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              ALL ({allCount})
            </button>
            <button
              id="filter-il-btn"
              onClick={() => handleFilterChange('IL')}
              className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${
                filterMode === 'IL'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              IL ({ilCount})
            </button>
            <button
              id="filter-acap-btn"
              onClick={() => handleFilterChange('A-CAP')}
              className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${
                filterMode === 'A-CAP'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              A-CAP ({acapCount})
            </button>
          </div>

          <input
            id="student-table-search-input"
            type="text"
            aria-label="Filter students by Application ID, Candidate Name, or Merit Number"
            placeholder="Search App ID, Name, Merit..."
            value={tableSearch}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="px-3 py-1 bg-white border border-slate-300 rounded-md text-xs text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-blue-500 w-36 sm:w-48"
          />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-100 text-slate-600 uppercase tracking-wider font-semibold border-b border-slate-200">
              <th className="py-2.5 px-3">#</th>
              <th
                className="py-2.5 px-3 cursor-pointer hover:text-slate-900"
                onClick={() => handleSort('merit')}
              >
                <div className="flex items-center gap-1">
                  <span>Merit No</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </div>
              </th>
              <th
                className="py-2.5 px-3 cursor-pointer hover:text-slate-900"
                onClick={() => handleSort('appId')}
              >
                <div className="flex items-center gap-1">
                  <span>Application ID</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </div>
              </th>
              <th
                className="py-2.5 px-3 cursor-pointer hover:text-slate-900"
                onClick={() => handleSort('name')}
              >
                <div className="flex items-center gap-1">
                  <span>Candidate Name</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </div>
              </th>
              <th className="py-2.5 px-3 text-center">PCM CET %</th>
              <th className="py-2.5 px-3 text-center">JEE %</th>
              <th className="py-2.5 px-3 text-center">IL / A-CAP Status</th>
              <th className="py-2.5 px-3 text-center">Allocation</th>
              <th className="py-2.5 px-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700">
            {filteredStudents.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-8 text-center text-slate-400 bg-slate-50/50">
                  {students.length === 0 ? (
                    <div>
                      <p className="font-semibold text-slate-600">No students imported yet.</p>
                      <p className="text-xs text-slate-400 mt-1">
                        Student records will appear once synchronized from Supabase.
                      </p>
                    </div>
                  ) : filterMode === 'IL' ? (
                    <div>
                      <p className="font-semibold text-slate-600">No IL candidates found in registry.</p>
                      <p className="text-xs text-slate-400 mt-1">
                        All {allCount} registered candidates are in A-CAP mode. Click &quot;A-CAP ({acapCount})&quot; or &quot;ALL ({allCount})&quot; above to view.
                      </p>
                    </div>
                  ) : filterMode === 'A-CAP' ? (
                    <div>
                      <p className="font-semibold text-slate-600">No A-CAP students in registry.</p>
                      <p className="text-xs text-slate-400 mt-1">
                        A-CAP records will appear here when an A-CAP dataset is synchronized.
                      </p>
                    </div>
                  ) : (
                    <p>No students match the current search criteria.</p>
                  )}
                </td>
              </tr>
            ) : (
              paginatedStudents.map((s, idx) => {
                const globalIdx = startIdx + idx + 1;
                const isSelected = selectedStudent?.application_id === s.application_id;
                return (
                  <tr
                    key={s.application_id}
                    onClick={() => onSelectStudent(s)}
                    className={`cursor-pointer transition-colors duration-100 ${
                      isSelected
                        ? 'bg-blue-50/80 font-medium'
                        : 'hover:bg-slate-50'
                    }`}
                  >
                    <td className="py-2.5 px-3 text-slate-400 font-mono">{globalIdx}</td>
                    <td className="py-2.5 px-3 font-semibold text-slate-900 font-mono">
                      #{s.merit_number}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-blue-700 font-medium">
                      {s.application_id}
                    </td>
                    <td className="py-2.5 px-3 text-slate-900 font-medium">
                      {s.candidate_name}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono text-slate-600">
                      {s.pcm_percentile || '—'}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono text-slate-600">
                      {s.jee_percentile || '—'}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded text-[11px] font-bold ${
                          s.current_processing_mode === 'IL'
                            ? 'bg-blue-100 text-blue-800 border border-blue-200'
                            : 'bg-purple-100 text-purple-800 border border-purple-200'
                        }`}
                        title={`Original Selection: ${s.original_merit_selection}`}
                      >
                        {s.current_processing_mode}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      {s.allocated_branch_id ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                          {s.allocated_branch_id} ({s.allocated_quota || 'IL'})
                        </span>
                      ) : (
                        <span className="inline-block px-2 py-0.5 rounded text-[10px] bg-slate-100 text-slate-500 font-medium">
                          Unallocated
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setRawViewStudent(s);
                          }}
                          className="px-2 py-1 rounded text-[10px] font-mono text-slate-600 hover:text-blue-700 bg-slate-100 hover:bg-slate-200 transition-colors"
                          title="View raw_data JSON"
                        >
                          <FileCode className="w-3 h-3 inline mr-0.5" />
                          <span>Raw</span>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectStudent(s);
                          }}
                          className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-all inline-flex items-center gap-1 ${
                            isSelected
                              ? 'bg-blue-600 text-white'
                              : 'bg-slate-100 hover:bg-blue-100 text-slate-700 hover:text-blue-800'
                          }`}
                        >
                          <span>{s.allocated_branch_id ? 'Reassign' : 'Allocate'}</span>
                          <ChevronRight className="w-3 h-3" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {filteredStudents.length > 0 && (
        <div className="p-3 border-t border-slate-100 bg-slate-50/70 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <span>
              Showing <strong className="text-slate-800">{startIdx + 1}</strong> to{' '}
              <strong className="text-slate-800">{endIdx}</strong> of{' '}
              <strong className="text-slate-800">{filteredStudents.length}</strong> students
            </span>
            <div className="flex items-center gap-1 ml-3 border-l border-slate-200 pl-3">
              <span className="text-[11px] text-slate-500">Per page:</span>
              {[50, 100, 250, 'ALL'].map((size) => (
                <button
                  key={size}
                  onClick={() => {
                    setPageSize(size as number | 'ALL');
                    setCurrentPage(1);
                  }}
                  className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                    pageSize === size
                      ? 'bg-slate-800 text-white font-bold'
                      : 'text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>

          {pageSize !== 'ALL' && totalPages > 1 && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-2.5 py-1 rounded bg-white border border-slate-200 text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors inline-flex items-center gap-1"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Prev</span>
              </button>

              <span className="px-2 font-mono text-slate-700 text-xs">
                Page {currentPage} of {totalPages}
              </span>

              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-2.5 py-1 rounded bg-white border border-slate-200 text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors inline-flex items-center gap-1"
              >
                <span>Next</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Raw Data Inspect Modal */}
      {rawViewStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-2xl w-full p-5 space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <FileCode className="w-4 h-4 text-blue-600" />
                  <span>Student Stored Raw Data</span>
                  <span className="font-mono text-xs px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                    {rawViewStudent.application_id}
                  </span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Candidate: <strong>{rawViewStudent.candidate_name}</strong> • Merit #{rawViewStudent.merit_number} • {rawViewStudent.original_merit_selection}
                </p>
              </div>
              <button
                onClick={() => setRawViewStudent(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs bg-slate-50 p-2.5 rounded-lg border border-slate-200 font-mono">
              <div>
                <span className="text-slate-400 block text-[10px]">Source</span>
                <span className="font-bold text-slate-800">{String(rawViewStudent.raw_data?.source || 'IL')}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Sheet</span>
                <span className="font-bold text-slate-800">{String(rawViewStudent.raw_data?.source_sheet || 'ILQ')}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Row</span>
                <span className="font-bold text-slate-800">{String(rawViewStudent.raw_data?.source_row || '—')}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Sr No</span>
                <span className="font-bold text-slate-800">{String(rawViewStudent.raw_data?.sr_no || '—')}</span>
              </div>
            </div>

            <div className="flex-1 overflow-auto bg-slate-900 text-emerald-400 p-3 rounded-lg text-xs font-mono">
              <pre>{JSON.stringify(rawViewStudent.raw_data || {}, null, 2)}</pre>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => {
                  onSelectStudent(rawViewStudent);
                  setRawViewStudent(null);
                }}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg text-xs transition-colors"
              >
                Select for Allocation
              </button>
              <button
                onClick={() => setRawViewStudent(null)}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-xs transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
