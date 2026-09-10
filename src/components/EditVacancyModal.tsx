import React, { useState, useEffect } from 'react';
import { X, AlertCircle, Save, CheckCircle2, Building2 } from 'lucide-react';
import { BRANCH_CODES, BRANCH_NAMES } from '../constants';
import { BranchCode, VacancySummary } from '../types';

interface EditVacancyModalProps {
  isOpen: boolean;
  onClose: () => void;
  summary: VacancySummary;
  onSave: (newCapacities: Record<BranchCode, { il: number; acap: number }>) => Promise<void> | void;
}

export const EditVacancyModal: React.FC<EditVacancyModalProps> = ({
  isOpen,
  onClose,
  summary,
  onSave,
}) => {
  // Input states for each branch
  const [formValues, setFormValues] = useState<Record<BranchCode, { il: string; acap: string }>>(
    () => {
      const initial = {} as Record<BranchCode, { il: string; acap: string }>;
      for (const code of BRANCH_CODES) {
        const b = summary.branches[code];
        initial[code] = {
          il: String(b?.initialIL ?? 0),
          acap: String(b?.initialACAP ?? 0),
        };
      }
      return initial;
    }
  );

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Sync inputs whenever modal opens or summary changes
  useEffect(() => {
    if (isOpen) {
      const updated = {} as Record<BranchCode, { il: string; acap: string }>;
      for (const code of BRANCH_CODES) {
        const b = summary.branches[code];
        updated[code] = {
          il: String(b?.initialIL ?? 0),
          acap: String(b?.initialACAP ?? 0),
        };
      }
      setFormValues(updated);
      setErrorMessage(null);
      setIsSaving(false);
    }
  }, [isOpen, summary]);

  if (!isOpen) return null;

  const handleInputChange = (branch: BranchCode, field: 'il' | 'acap', value: string) => {
    setErrorMessage(null);
    setFormValues((prev) => ({
      ...prev,
      [branch]: {
        ...prev[branch],
        [field]: value,
      },
    }));
  };

  // Calculate live preview totals
  let previewTotalIL = 0;
  let previewTotalACAP = 0;
  for (const code of BRANCH_CODES) {
    const ilNum = parseInt(formValues[code]?.il || '0', 10);
    const acapNum = parseInt(formValues[code]?.acap || '0', 10);
    if (!isNaN(ilNum) && ilNum >= 0) previewTotalIL += ilNum;
    if (!isNaN(acapNum) && acapNum >= 0) previewTotalACAP += acapNum;
  }
  const previewCombinedTotal = previewTotalIL + previewTotalACAP;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const validatedCapacities = {} as Record<BranchCode, { il: number; acap: number }>;

    // Validate all 9 branches
    for (const code of BRANCH_CODES) {
      const b = summary.branches[code];
      const ilStr = (formValues[code]?.il ?? '').trim();
      const acapStr = (formValues[code]?.acap ?? '').trim();

      // Check for empty, non-integer or negative IL
      if (ilStr === '' || !/^\d+$/.test(ilStr)) {
        setErrorMessage(
          `Invalid value for ${code} IL Total. Please enter a valid non-negative whole number.`
        );
        return;
      }
      const ilVal = parseInt(ilStr, 10);
      if (isNaN(ilVal) || ilVal < 0) {
        setErrorMessage(`IL Total for ${code} cannot be negative.`);
        return;
      }

      // Check if IL Total < currently filled seats
      const ilFilled = b?.allocatedIL ?? 0;
      if (ilVal < ilFilled) {
        setErrorMessage(
          `Total vacancy cannot be less than currently filled seats (${ilFilled}) for ${code} IL.`
        );
        return;
      }

      // Check for empty, non-integer or negative A-CAP
      if (acapStr === '' || !/^\d+$/.test(acapStr)) {
        setErrorMessage(
          `Invalid value for ${code} A-CAP Total. Please enter a valid non-negative whole number.`
        );
        return;
      }
      const acapVal = parseInt(acapStr, 10);
      if (isNaN(acapVal) || acapVal < 0) {
        setErrorMessage(`A-CAP Total for ${code} cannot be negative.`);
        return;
      }

      // Check if A-CAP Total < currently filled seats
      const acapFilled = b?.allocatedACAP ?? 0;
      if (acapVal < acapFilled) {
        setErrorMessage(
          `Total vacancy cannot be less than currently filled seats (${acapFilled}).`
        );
        return;
      }

      validatedCapacities[code] = {
        il: ilVal,
        acap: acapVal,
      };
    }

    try {
      setIsSaving(true);
      await onSave(validatedCapacities);
      setIsSaving(false);
      onClose();
    } catch (err) {
      setIsSaving(false);
      setErrorMessage(
        err instanceof Error ? err.message : 'Failed to save vacancy totals. Please try again.'
      );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-slate-900 via-slate-800 to-blue-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/30 border border-blue-400/40 flex items-center justify-center text-blue-300">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-tight uppercase">
                EDIT ADMISSION VACANCY
              </h2>
              <p className="text-xs text-slate-300">
                Set authoritative branch total seat capacities. Available seats = Total minus Filled.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
            title="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSave}>
          <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
            {/* Error Message Banner */}
            {errorMessage && (
              <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5 text-xs text-red-700 animate-in fade-in">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <div className="font-semibold">{errorMessage}</div>
              </div>
            )}

            {/* Explanatory notice */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-900 flex items-center justify-between">
              <div>
                <strong>Capacity Control:</strong> Editing branch totals modifies capacity without touching existing student allocations.
              </div>
              <span className="text-[11px] text-blue-700 font-mono font-bold bg-white px-2 py-0.5 rounded border border-blue-200">
                Rule: TOTAL ≥ FILLED
              </span>
            </div>

            {/* Table of 9 Branches */}
            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 font-bold uppercase tracking-wider border-b border-slate-200">
                    <th className="py-3 px-4">Branch</th>
                    <th className="py-3 px-4 text-center w-36">IL Total</th>
                    <th className="py-3 px-4 text-center w-36">A-CAP Total</th>
                    <th className="py-3 px-4 text-center w-28 bg-slate-200/50">Combined</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {BRANCH_CODES.map((code) => {
                    const b = summary.branches[code];
                    const ilFilled = b?.allocatedIL ?? 0;
                    const acapFilled = b?.allocatedACAP ?? 0;

                    const currentIlNum = parseInt(formValues[code]?.il || '0', 10);
                    const currentAcapNum = parseInt(formValues[code]?.acap || '0', 10);
                    const rowCombined =
                      (!isNaN(currentIlNum) && currentIlNum >= 0 ? currentIlNum : 0) +
                      (!isNaN(currentAcapNum) && currentAcapNum >= 0 ? currentAcapNum : 0);

                    return (
                      <tr key={code} className="hover:bg-slate-50 transition-colors">
                        <td className="py-2.5 px-4">
                          <div className="font-bold text-slate-900 text-sm font-mono text-blue-700">
                            {code}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {BRANCH_NAMES[code]}
                          </div>
                        </td>

                        {/* IL Input */}
                        <td className="py-2.5 px-4 text-center">
                          <div className="flex flex-col items-center">
                            <input
                              id={`edit-il-${code}`}
                              type="number"
                              min="0"
                              step="1"
                              value={formValues[code]?.il ?? '0'}
                              onChange={(e) => handleInputChange(code, 'il', e.target.value)}
                              className="w-24 text-center font-mono font-bold text-sm px-2 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
                              required
                            />
                            <span className="text-[10px] text-slate-400 mt-1 font-mono">
                              Filled: <strong className="text-slate-600">{ilFilled}</strong>
                            </span>
                          </div>
                        </td>

                        {/* A-CAP Input */}
                        <td className="py-2.5 px-4 text-center">
                          <div className="flex flex-col items-center">
                            <input
                              id={`edit-acap-${code}`}
                              type="number"
                              min="0"
                              step="1"
                              value={formValues[code]?.acap ?? '0'}
                              onChange={(e) => handleInputChange(code, 'acap', e.target.value)}
                              className="w-24 text-center font-mono font-bold text-sm px-2 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 focus:outline-none"
                              required
                            />
                            <span className="text-[10px] text-slate-400 mt-1 font-mono">
                              Filled: <strong className="text-slate-600">{acapFilled}</strong>
                            </span>
                          </div>
                        </td>

                        {/* Combined Live Preview */}
                        <td className="py-2.5 px-4 text-center bg-slate-50/50">
                          <span className="font-mono font-bold text-sm text-slate-800">
                            {rowCombined}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-900 text-white font-bold border-t border-slate-900">
                    <td className="py-3 px-4 tracking-wider uppercase text-xs">
                      Summary Total
                    </td>
                    <td className="py-3 px-4 text-center font-mono text-base text-blue-300">
                      {previewTotalIL}
                    </td>
                    <td className="py-3 px-4 text-center font-mono text-base text-purple-300">
                      {previewTotalACAP}
                    </td>
                    <td className="py-3 px-4 text-center font-mono text-base text-emerald-300 bg-slate-950">
                      {previewCombinedTotal}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3">
            <button
              id="edit-vacancy-cancel-btn"
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-bold transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              id="edit-vacancy-save-btn"
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
            >
              {isSaving ? (
                <span>Saving Changes...</span>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Save Changes</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
