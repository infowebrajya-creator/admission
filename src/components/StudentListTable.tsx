import React, { useState, useMemo } from 'react';
import { Filter, UserCheck, ArrowUpDown, ChevronRight } from 'lucide-react';
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

  const filteredStudents = useMemo(() => {
    let list = students;

    // Filter by [ ALL ], [ IL ], [ A-CAP ]
    if (filterMode === 'IL') {
      list = list.filter((s) => s.original_merit_selection.includes('IL'));
    } else if (filterMode === 'A-CAP') {
      list = list.filter((s) => s.original_merit_selection.includes('A-CAP'));
    }

    // Filter by quick search
    if (tableSearch.trim()) {
      const q = tableSearch.toLowerCase().trim();
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

  const handleSort = (field: 'merit' | 'appId' | 'name') => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden flex flex-col">
      {/* Header & Controls */}
      <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 bg-slate-50/60">
        <div>
          <h2 className="text-base font-bold text-slate-800 tracking-tight flex items-center gap-2">
            <span>Imported Students</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 font-mono">
              {filteredStudents.length} of {students.length}
            </span>
          </h2>
          <p className="text-xs text-slate-500">
            Reconciled student registry. Click any row to allocate or reassign.
          </p>
        </div>

        {/* Filter Controls: [ ALL ] [ IL ] [ A-CAP ] */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center bg-slate-200/80 p-1 rounded-lg">
            <button
              id="filter-all-btn"
              onClick={() => setFilterMode('ALL')}
              className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${
                filterMode === 'ALL'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              ALL ({students.length})
            </button>
            <button
              id="filter-il-btn"
              onClick={() => setFilterMode('IL')}
              className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${
                filterMode === 'IL'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              IL ({students.filter((s) => s.original_merit_selection.includes('IL')).length})
            </button>
            <button
              id="filter-acap-btn"
              onClick={() => setFilterMode('A-CAP')}
              className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${
                filterMode === 'A-CAP'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              A-CAP ({students.filter((s) => s.original_merit_selection.includes('A-CAP')).length})
            </button>
          </div>

          <input
            type="text"
            placeholder="Quick filter..."
            value={tableSearch}
            onChange={(e) => setTableSearch(e.target.value)}
            className="px-3 py-1 bg-white border border-slate-300 rounded-md text-xs text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-blue-500 w-32 sm:w-40"
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
              <th className="py-2.5 px-3 text-center">Eligibility</th>
              <th className="py-2.5 px-3 text-center">Current Branch</th>
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
                        Use the "Import Students" button above to upload an Excel file or load sample data.
                      </p>
                    </div>
                  ) : (
                    <p>No students match the current filter criteria.</p>
                  )}
                </td>
              </tr>
            ) : (
              filteredStudents.map((s, idx) => {
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
                    <td className="py-2.5 px-3 text-slate-400 font-mono">{idx + 1}</td>
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
                        className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold ${
                          s.original_merit_selection === 'IL + A-CAP'
                            ? 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                            : s.original_merit_selection === 'IL ONLY'
                            ? 'bg-blue-100 text-blue-800 border border-blue-200'
                            : 'bg-purple-100 text-purple-800 border border-purple-200'
                        }`}
                      >
                        {s.original_merit_selection}
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
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
