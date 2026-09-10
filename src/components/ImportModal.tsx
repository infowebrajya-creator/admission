import React, { useState, useRef } from 'react';
import { Upload, X, FileSpreadsheet, Download, CheckCircle2, AlertCircle, Info } from 'lucide-react';
import { EXPECTED_EXCEL_COLUMNS } from '../constants';
import { ProcessingMode } from '../types';
import { downloadTemplateExcel, parseStudentsExcel } from '../services/admissionStore';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: () => void;
}

export const ImportModal: React.FC<ImportModalProps> = ({
  isOpen,
  onClose,
  onImportComplete,
}) => {
  const [importMode, setImportMode] = useState<ProcessingMode>('IL');
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<{ added: number; updated: number; message?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFile = async (file: File) => {
    setIsProcessing(true);
    setError(null);
    setResult(null);

    try {
      const res = await parseStudentsExcel(file, importMode);
      setResult({
        added: res.added,
        updated: res.updated,
        message: `Successfully processed ${file.name}. Added: ${res.added} new student(s). Updated/Reconciled: ${res.updated} dual-eligible student(s).`,
      });
      onImportComplete();
    } catch (err) {
      console.error(err);
      setError((err as Error).message || 'Failed to parse Excel file.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-2xl max-w-2xl w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
              <Upload className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800">
                Import Student Merit List
              </h2>
              <p className="text-xs text-slate-500">
                Upload common format Excel (.xlsx, .xls, .csv) for IL or A-CAP
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-md transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-5">
          {/* Target Quota Mode Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Select Merit List Type to Import
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                id="select-il-import-mode"
                onClick={() => setImportMode('IL')}
                className={`p-3 rounded-xl border text-left flex flex-col gap-1 transition-all ${
                  importMode === 'IL'
                    ? 'border-blue-600 bg-blue-50/50 ring-2 ring-blue-500/20'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-slate-900">IL List</span>
                  {importMode === 'IL' && <CheckCircle2 className="w-4 h-4 text-blue-600" />}
                </div>
                <span className="text-xs text-slate-500">
                  Institutional Level merit applicants
                </span>
              </button>

              <button
                type="button"
                id="select-acap-import-mode"
                onClick={() => setImportMode('A-CAP')}
                className={`p-3 rounded-xl border text-left flex flex-col gap-1 transition-all ${
                  importMode === 'A-CAP'
                    ? 'border-purple-600 bg-purple-50/50 ring-2 ring-purple-500/20'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-slate-900">A-CAP List</span>
                  {importMode === 'A-CAP' && <CheckCircle2 className="w-4 h-4 text-purple-600" />}
                </div>
                <span className="text-xs text-slate-500">
                  Against-CAP merit applicants
                </span>
              </button>
            </div>
          </div>

          {/* Common Excel Format Information Banner (Requirement #3) */}
          <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-4 text-xs space-y-2">
            <div className="flex items-center gap-2 font-bold text-amber-900">
              <Info className="w-4 h-4 text-amber-700 shrink-0" />
              <span>Common Excel Import Format Information</span>
            </div>
            <p className="text-amber-800 leading-relaxed">
              Both IL and A-CAP use ONE single common format. <strong>Application ID</strong> is the reconciliation key.
              If an Application ID appears in both IL and A-CAP, ONE unified student record is created with status <code>IL + A-CAP</code>.
            </p>
            <div className="bg-white/80 p-2.5 rounded-lg border border-amber-200 font-mono text-[11px] text-slate-700">
              <span className="font-bold block text-slate-900 mb-1">Expected Columns (Exact Order or Headers):</span>
              <div className="flex flex-wrap gap-1.5">
                {EXPECTED_EXCEL_COLUMNS.map((col) => (
                  <span key={col} className="px-2 py-0.5 rounded bg-slate-100 border border-slate-300">
                    {col}
                  </span>
                ))}
              </div>
            </div>
            <p className="text-[11px] text-amber-900 font-medium">
              * Note: There is NO Course or Branch column. Imported students remain unallocated.
              Typo <em>"Signture"</em> is accepted automatically.
            </p>
          </div>

          {/* Drag and Drop Zone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2 ${
              isDragging
                ? 'border-blue-500 bg-blue-50/50'
                : 'border-slate-300 hover:border-blue-400 bg-slate-50/50'
            }`}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".xlsx,.xls,.csv"
              className="hidden"
            />
            <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mb-1">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div className="text-sm font-bold text-slate-800">
              {isProcessing ? 'Processing Excel Sheet...' : `Click or Drag & Drop ${importMode} Excel File`}
            </div>
            <p className="text-xs text-slate-500">
              Supports .xlsx, .xls, or .csv files
            </p>
          </div>

          {/* Quick Template Download Helpers */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <span className="text-xs text-slate-500">Need sample files to test?</span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => downloadTemplateExcel('IL')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Sample IL Excel</span>
              </button>
              <button
                type="button"
                onClick={() => downloadTemplateExcel('A-CAP')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Sample A-CAP Excel</span>
              </button>
            </div>
          </div>

          {/* Status feedback */}
          {result && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-start gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">{result.message}</p>
                <p className="text-slate-600 text-[11px] mt-0.5">
                  Imported students are unallocated and ready for branch assignment.
                </p>
              </div>
            </div>
          )}

          {error && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-900 text-xs flex items-center gap-2.5">
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-bold transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
