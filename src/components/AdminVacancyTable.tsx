import React from 'react';
import { Settings } from 'lucide-react';
import { BRANCH_CODES } from '../constants';
import { VacancySummary } from '../types';

interface AdminVacancyTableProps {
  summary: VacancySummary;
  onOpenEditModal?: () => void;
}

export const AdminVacancyTable: React.FC<AdminVacancyTableProps> = ({
  summary,
  onOpenEditModal,
}) => {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 bg-slate-50/60">
        <div>
          <h2 className="text-base font-bold text-slate-800 tracking-tight">
            Admission Vacancy Status
          </h2>
          <p className="text-xs text-slate-500">
            Authoritative live seat inventory across all 9 approved B.Tech branches
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          {onOpenEditModal && (
            <button
              id="admin-edit-vacancy-btn"
              type="button"
              onClick={onOpenEditModal}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer"
              title="Edit branch vacancy total capacities"
            >
              <Settings className="w-3.5 h-3.5" />
              <span>Edit Vacancy</span>
            </button>
          )}
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            Live Calculated
          </span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="bg-slate-100/80 text-slate-600 text-xs uppercase tracking-wider font-semibold border-b border-slate-200">
              <th className="py-3 px-4">Branch</th>
              <th className="py-3 px-4 text-center">IL</th>
              <th className="py-3 px-4 text-center">A-CAP</th>
              <th className="py-3 px-4 text-center bg-slate-200/50">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700">
            {BRANCH_CODES.map((code) => {
              const b = summary.branches[code];
              const branchTotal = b.initialIL + b.initialACAP;
              const hasAllocations = b.allocatedIL > 0 || b.allocatedACAP > 0;

              return (
                <tr
                  key={code}
                  className="hover:bg-blue-50/40 transition-colors duration-150 group"
                >
                  <td className="py-3 px-4 font-semibold text-slate-900">
                    <div className="flex items-center gap-2">
                      <span className="w-16 inline-block font-mono font-bold text-blue-700">
                        {code}
                      </span>
                      <span className="text-xs text-slate-400 font-normal hidden sm:inline">
                        {b.name}
                      </span>
                    </div>
                  </td>

                  {/* IL Total */}
                  <td className="py-3 px-4 text-center font-mono">
                    <div className="flex flex-col items-center justify-center">
                      <span
                        className={`inline-flex items-center justify-center min-w-[2.25rem] px-2 py-0.5 rounded text-xs font-bold ${
                          b.initialIL === 0
                            ? 'bg-slate-100 text-slate-400'
                            : 'bg-blue-50 text-blue-700 border border-blue-200/60'
                        }`}
                      >
                        {b.initialIL}
                      </span>
                      {b.allocatedIL > 0 && (
                        <span className="text-[10px] text-emerald-600 font-medium mt-0.5">
                          {b.currentIL} avail ({b.allocatedIL} filled)
                        </span>
                      )}
                    </div>
                  </td>

                  {/* A-CAP Total */}
                  <td className="py-3 px-4 text-center font-mono">
                    <div className="flex flex-col items-center justify-center">
                      <span
                        className={`inline-flex items-center justify-center min-w-[2.25rem] px-2 py-0.5 rounded text-xs font-bold ${
                          b.initialACAP === 0
                            ? 'bg-slate-100 text-slate-400'
                            : 'bg-purple-50 text-purple-700 border border-purple-200/60'
                        }`}
                      >
                        {b.initialACAP}
                      </span>
                      {b.allocatedACAP > 0 && (
                        <span className="text-[10px] text-emerald-600 font-medium mt-0.5">
                          {b.currentACAP} avail ({b.allocatedACAP} filled)
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Combined Branch Total (IL + A-CAP) */}
                  <td className="py-3 px-4 text-center font-mono bg-slate-50/50 group-hover:bg-blue-50/60">
                    <div className="flex flex-col items-center justify-center">
                      <span
                        className={`inline-flex items-center justify-center min-w-[2.5rem] px-2.5 py-0.5 rounded text-xs font-black ${
                          branchTotal === 0
                            ? 'bg-slate-100 text-slate-400 border border-slate-200'
                            : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        }`}
                      >
                        {branchTotal}
                      </span>
                      {hasAllocations && (
                        <span className="text-[10px] text-emerald-700 font-medium mt-0.5">
                          {b.currentTotal} avail
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-slate-900 text-white font-bold border-t-2 border-slate-950">
              <td className="py-3.5 px-4 tracking-wider uppercase text-xs">
                Total
              </td>
              <td className="py-3.5 px-4 text-center font-mono text-base text-blue-300">
                {summary.initialTotalIL}
              </td>
              <td className="py-3.5 px-4 text-center font-mono text-base text-purple-300">
                {summary.initialTotalACAP}
              </td>
              <td className="py-3.5 px-4 text-center font-mono text-base text-emerald-300 bg-slate-950">
                {summary.initialTotalCombined}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
};
