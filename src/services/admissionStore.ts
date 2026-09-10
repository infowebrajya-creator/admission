import * as XLSX from 'xlsx';
import { BRANCH_CODES, BRANCH_NAMES, DEFAULT_EMPTY_CAPACITIES } from '../constants';
import {
  AdmissionData,
  BranchCode,
  ProcessingMode,
  Student,
  VacancySummary,
} from '../types';
import {
  fetchAuthoritativeBranchCapacities,
  fetchAuthoritativeStudents,
  persistAllocationToSupabase,
  saveStudentsToSupabase,
  resetStudentsInSupabase,
} from './supabase';
import { notifyDisplayRefresh } from '../utils/displayWindow';

/**
 * Calculates authoritative vacancy summary entirely derived from Supabase
 * branch capacities and student allocation records.
 * NEVER hardcodes 102, 113, 215 or permanent branch quotas.
 */
export function calculateVacancies(
  students: Student[],
  capacities: Record<BranchCode, { il: number; acap: number }> = DEFAULT_EMPTY_CAPACITIES
): VacancySummary {
  const branchesRecord = {} as VacancySummary['branches'];

  let totalAllocatedIL = 0;
  let totalAllocatedACAP = 0;
  let initialTotalIL = 0;
  let initialTotalACAP = 0;

  for (const branch of BRANCH_CODES) {
    const initial = capacities[branch] || { il: 0, acap: 0 };
    initialTotalIL += initial.il;
    initialTotalACAP += initial.acap;

    // Count students allocated to this branch by quota
    const allocatedIL = students.filter(
      (s) => s.allocated_branch_id === branch && s.allocated_quota === 'IL'
    ).length;

    const allocatedACAP = students.filter(
      (s) => s.allocated_branch_id === branch && s.allocated_quota === 'A-CAP'
    ).length;

    totalAllocatedIL += allocatedIL;
    totalAllocatedACAP += allocatedACAP;

    const currentIL = Math.max(0, initial.il - allocatedIL);
    const currentACAP = Math.max(0, initial.acap - allocatedACAP);

    branchesRecord[branch] = {
      branch,
      name: BRANCH_NAMES[branch],
      initialIL: initial.il,
      initialACAP: initial.acap,
      allocatedIL,
      allocatedACAP,
      currentIL,
      currentACAP,
      currentTotal: currentIL + currentACAP,
    };
  }

  const totalIL = Math.max(0, initialTotalIL - totalAllocatedIL);
  const totalACAP = Math.max(0, initialTotalACAP - totalAllocatedACAP);

  return {
    branches: branchesRecord,
    totalIL,
    totalACAP,
    totalCombined: totalIL + totalACAP,
    initialTotalIL,
    initialTotalACAP,
    initialTotalCombined: initialTotalIL + initialTotalACAP,
  };
}

/**
 * Central authoritative data refresh function (Requirement 19).
 * Fetches branch_capacities and students from Supabase, derives totals, and returns
 * the synchronized application state.
 */
export async function refreshAdmissionData(): Promise<AdmissionData> {
  const [capacities, students] = await Promise.all([
    fetchAuthoritativeBranchCapacities(),
    fetchAuthoritativeStudents(),
  ]);

  const vacancySummary = calculateVacancies(students, capacities);

  return {
    capacities,
    students,
    vacancySummary,
  };
}

/**
 * Imports Excel or CSV student list and reconciles directly with Supabase public.students.
 * Requirement 4 compliant:
 * - Reconciles by application_id
 * - NEVER destroys existing allocations
 * - Saves resulting records to Supabase
 * - Dispatches display synchronization
 */
export async function parseStudentsExcel(
  file: File,
  importMode: ProcessingMode
): Promise<{ added: number; updated: number; errors: string[] }> {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new Error('Workbook contains no sheets.');
  }

  const worksheet = workbook.Sheets[firstSheetName];
  const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(worksheet, {
    defval: '',
  });

  if (!rows || rows.length === 0) {
    throw new Error('Sheet is empty.');
  }

  // 1. Authoritative fetch of current student registry from Supabase
  const currentStudents = await fetchAuthoritativeStudents();
  const studentMap = new Map<string, Student>();
  for (const s of currentStudents) {
    studentMap.set(s.application_id.trim().toUpperCase(), { ...s });
  }

  let addedCount = 0;
  let updatedCount = 0;
  const errors: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    let appId = '';
    let candidateName = '';
    let meritNumber: number | string = '';
    let pcm = '';
    let jee = '';
    let hsc = '';
    let ssc = '';
    let signature = '';

    for (const [rawKey, val] of Object.entries(row)) {
      const key = rawKey.trim().toLowerCase().replace(/[._\-\s]+/g, ' ');
      const strVal = String(val ?? '').trim();

      if (key.includes('application') && (key.includes('id') || key.includes('no'))) {
        appId = strVal;
      } else if (key === 'application id' || key === 'app id' || key === 'applicationid') {
        appId = strVal;
      } else if (key.includes('candidate') || key.includes('student name') || key === 'name') {
        candidateName = strVal;
      } else if (key.includes('merit')) {
        meritNumber = strVal;
      } else if (key.includes('pcm')) {
        pcm = strVal;
      } else if (key.includes('jee')) {
        jee = strVal;
      } else if (key.includes('hsc')) {
        hsc = strVal;
      } else if (key.includes('ssc')) {
        ssc = strVal;
      } else if (key.includes('sign') || key.includes('signture')) {
        signature = strVal;
      }
    }

    if (!appId) {
      continue;
    }

    const normAppId = appId.trim().toUpperCase();
    const existing = studentMap.get(normAppId);

    if (existing) {
      // Reconcile and preserve existing allocations
      const wasIL = existing.original_merit_selection.includes('IL');
      const wasACAP = existing.original_merit_selection.includes('A-CAP');

      let newMeritSelection = existing.original_merit_selection;
      let newProcessingMode = existing.current_processing_mode;

      if (importMode === 'IL' && !wasIL) {
        newMeritSelection = 'IL + A-CAP';
        newProcessingMode = 'IL';
        updatedCount++;
      } else if (importMode === 'A-CAP' && !wasACAP) {
        newMeritSelection = 'IL + A-CAP';
        newProcessingMode = 'IL';
        updatedCount++;
      }

      studentMap.set(normAppId, {
        ...existing,
        candidate_name: candidateName || existing.candidate_name,
        merit_number: meritNumber || existing.merit_number,
        pcm_percentile: pcm || existing.pcm_percentile,
        jee_percentile: jee || existing.jee_percentile,
        hsc_percentage: hsc || existing.hsc_percentage,
        ssc_percentage: ssc || existing.ssc_percentage,
        signature: signature || existing.signature,
        original_merit_selection: newMeritSelection,
        current_processing_mode: newProcessingMode,
        // Critical: Never destroy an existing allocation during import
        allocated_branch_id: existing.allocated_branch_id,
        allocated_quota: existing.allocated_quota,
        allocated_at: existing.allocated_at,
        status: existing.status,
      });
    } else {
      // New candidate record
      const newStudent: Student = {
        id: normAppId,
        application_id: normAppId,
        candidate_name: candidateName || `Candidate ${normAppId}`,
        merit_number: meritNumber || addedCount + 1,
        pcm_percentile: pcm || '0.00',
        jee_percentile: jee || '0.00',
        hsc_percentage: hsc || '0.00',
        ssc_percentage: ssc || '0.00',
        signature: signature || 'Verified',
        original_merit_selection: importMode === 'IL' ? 'IL ONLY' : 'A-CAP ONLY',
        current_processing_mode: importMode === 'IL' ? 'IL' : 'A-CAP',
        allocated_branch_id: null,
        allocated_quota: null,
        allocated_at: null,
        status: 'Pending',
      };
      studentMap.set(normAppId, newStudent);
      addedCount++;
    }
  }

  const updatedStudents = Array.from(studentMap.values());

  // 2. Persist directly to Supabase public.students
  await saveStudentsToSupabase(updatedStudents);

  // 3. Notify all display windows and cross-tab listeners
  notifyDisplayRefresh();

  return { added: addedCount, updated: updatedCount, errors };
}

/**
 * Allocates or reassigns a student to a branch and quota.
 * Persists immediately to Supabase and notifies listeners.
 */
export async function allocateStudentBranch(
  applicationId: string,
  newBranch: BranchCode,
  quota: ProcessingMode,
  currentStudents: Student[],
  currentCapacities: Record<BranchCode, { il: number; acap: number }>
): Promise<{ success: boolean; message: string }> {
  const normId = applicationId.trim().toUpperCase();
  const student = currentStudents.find((s) => s.application_id.toUpperCase() === normId);

  if (!student) {
    return { success: false, message: `Student ${applicationId} not found in database.` };
  }

  const targetQuota: ProcessingMode =
    quota || student.current_processing_mode || 'IL';

  // If student is already allocated to the same branch and quota
  if (
    student.allocated_branch_id === newBranch &&
    student.allocated_quota === targetQuota
  ) {
    return {
      success: true,
      message: `Student is already allocated to ${newBranch} (${targetQuota}).`,
    };
  }

  // Check available vacancy derived from Supabase
  const currentVacancies = calculateVacancies(currentStudents, currentCapacities);
  const targetBranchVacancy = currentVacancies.branches[newBranch];
  const availableVacancy =
    targetQuota === 'IL'
      ? targetBranchVacancy.currentIL
      : targetBranchVacancy.currentACAP;

  if (availableVacancy <= 0) {
    return {
      success: false,
      message: `Cannot allocate: Vacancy for ${newBranch} under ${targetQuota} quota is zero (0).`,
    };
  }

  const oldBranch = student.allocated_branch_id;

  // Persist update directly to Supabase public.students
  await persistAllocationToSupabase(student.application_id, newBranch, targetQuota);

  // Notify listeners
  notifyDisplayRefresh();

  return {
    success: true,
    message: oldBranch
      ? `Reassigned from ${oldBranch} to ${newBranch} (${targetQuota}).`
      : `Successfully allocated to ${newBranch} (${targetQuota}).`,
  };
}

/**
 * Unallocates a student seat and increases branch vacancy.
 * Persists immediately to Supabase and notifies listeners.
 */
export async function unallocateStudentBranch(
  applicationId: string,
  currentStudents: Student[]
): Promise<{ success: boolean; message: string }> {
  const normId = applicationId.trim().toUpperCase();
  const student = currentStudents.find((s) => s.application_id.toUpperCase() === normId);

  if (!student) {
    return { success: false, message: `Student ${applicationId} not found in database.` };
  }

  if (!student.allocated_branch_id) {
    return { success: false, message: `Student is already unallocated.` };
  }

  const oldBranch = student.allocated_branch_id;
  const oldQuota = student.allocated_quota;

  // Persist unallocation directly to Supabase public.students
  await persistAllocationToSupabase(student.application_id, null, null);

  // Notify listeners
  notifyDisplayRefresh();

  return {
    success: true,
    message: `Successfully unallocated seat for ${oldBranch} (${oldQuota}). Vacancy increased.`,
  };
}

/**
 * Exports current authoritative students list to Excel format.
 */
export async function exportStudentsToExcel(existingStudents?: Student[]): Promise<void> {
  const students = existingStudents || (await fetchAuthoritativeStudents());

  const exportRows = students.map((s, index) => ({
    'Sr. No.': index + 1,
    'Application ID': s.application_id,
    'Candidate Name': s.candidate_name,
    'Merit Number': s.merit_number,
    'PCM CET Total Percentile': s.pcm_percentile,
    'JEE Total Percentile': s.jee_percentile,
    'HSC Total Percentage': s.hsc_percentage,
    'SSC Total Percentage': s.ssc_percentage,
    'IL/A-CAP status': s.original_merit_selection,
    'Current Branch': s.allocated_branch_id ? s.allocated_branch_id : 'UNALLOCATED',
    'Allocated Quota': s.allocated_quota || 'NONE',
    'Status': s.status || (s.allocated_branch_id ? 'Admitted' : 'Pending'),
  }));

  const worksheet = XLSX.utils.json_to_sheet(exportRows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Students');

  const dateStr = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(workbook, `GH_Raisoni_Students_Export_${dateStr}.xlsx`);
}

/**
 * Downloads template Excel file for IL or A-CAP.
 */
export function downloadTemplateExcel(mode: ProcessingMode): void {
  const sampleRows = [
    {
      'Sr. No.': 1,
      'Application ID': mode === 'IL' ? 'EN24101001' : 'EN24102001',
      'Candidate Name': mode === 'IL' ? 'Aarav Sharma' : 'Ananya Deshmukh',
      'Merit Number': mode === 'IL' ? 101 : 205,
      'PCM CET Total Percentile': 95.84,
      'JEE Total Percentile': 92.4,
      'HSC Total Percentage': 86.5,
      'SSC Total Percentage': 91.2,
      'Signature': 'Signed',
    },
    {
      'Sr. No.': 2,
      'Application ID': mode === 'IL' ? 'EN24101002' : 'EN24102002',
      'Candidate Name': mode === 'IL' ? 'Rohan Kulkarni' : 'Sneha Patil',
      'Merit Number': mode === 'IL' ? 142 : 310,
      'PCM CET Total Percentile': 89.25,
      'JEE Total Percentile': 84.1,
      'HSC Total Percentage': 82.0,
      'SSC Total Percentage': 88.4,
      'Signature': 'Signed',
    },
  ];

  const worksheet = XLSX.utils.json_to_sheet(sampleRows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, `${mode}_Merit_List`);
  XLSX.writeFile(workbook, `GH_Raisoni_${mode}_Template.xlsx`);
}

/**
 * Resets all student allocations in Supabase public.students.
 */
export async function resetAllAdmissionData(): Promise<void> {
  await resetStudentsInSupabase();
  notifyDisplayRefresh();
}
