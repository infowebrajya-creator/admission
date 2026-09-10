import ExcelJS from 'exceljs';
import { Student } from '../types';
import { BRANCH_CODES } from '../constants';
import { getSupabase, mapDbRowToStudent } from './supabase';

/**
 * Helper to determine section for allotted student: 'A-CAP' or 'IL'.
 * Follows the explicit rule:
 * - A-CAP section: students whose admission source/current processing mode is A-CAP
 * - IL section: students whose admission source/current processing mode is IL
 * - If a student is IL + A-CAP, use the student's current processing mode to determine the section.
 */
function getStudentReportSection(s: Student): 'A-CAP' | 'IL' {
  // 1. Current processing mode takes highest priority (crucial for IL + A-CAP students)
  if (s.current_processing_mode) {
    const mode = String(s.current_processing_mode).toUpperCase().trim();
    if (mode.includes('CAP') || mode.includes('ACP')) return 'A-CAP';
    if (
      mode.includes('IL') ||
      mode.includes('INSTITUTE') ||
      mode.includes('MGT') ||
      mode.includes('MANAGEMENT')
    ) {
      return 'IL';
    }
  }

  // 2. Allocated quota
  if (s.allocated_quota) {
    const quota = String(s.allocated_quota).toUpperCase().trim();
    if (quota.includes('CAP') || quota.includes('ACP')) return 'A-CAP';
    if (
      quota.includes('IL') ||
      quota.includes('INSTITUTE') ||
      quota.includes('MGT') ||
      quota.includes('MANAGEMENT')
    ) {
      return 'IL';
    }
  }

  // 3. Original merit selection
  if (s.original_merit_selection) {
    const sel = String(s.original_merit_selection).toUpperCase().trim();
    if (sel.includes('A-CAP') || sel.includes('CAP') || sel.includes('ACP')) return 'A-CAP';
    if (sel.includes('IL')) return 'IL';
  }

  // 4. Raw data source or sheet
  const rawSrc = String(s.raw_data?.source || s.raw_data?.source_sheet || '').toUpperCase().trim();
  if (rawSrc.includes('CAP') || rawSrc.includes('ACP')) return 'A-CAP';
  if (rawSrc.includes('IL')) return 'IL';

  return 'IL';
}

function parseMeritNumber(val: unknown): number {
  if (typeof val === 'number') return val;
  if (!val) return 99999999;
  const cleaned = String(val).replace(/[^\d.]/g, '');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 99999999 : parsed;
}

const TABLE_HEADERS = [
  'Sr. No.',
  'College Merit List No.',
  'Candidate Name',
  'CET General Merit No.',
  'Percentile',
  'Admitted or Not (Yes / No)',
  'Allotted Branch',
  'Reason for Not Admission',
];

interface FormattedStudentRow {
  srNo: string;
  collegeMeritNo: string;
  candidateName: string;
  cetMeritNo: string;
  percentile: string;
  admittedOrNot: string;
  allottedBranch: string;
  reason: string;
}

function mapAllottedStudentToRow(s: Student, index: number): FormattedStudentRow {
  const srNo = String(index + 1);

  // College Merit List No.
  let collegeMeritNo = '-';
  if (
    s.raw_data?.sr_no !== undefined &&
    s.raw_data?.sr_no !== null &&
    s.raw_data?.sr_no !== ''
  ) {
    collegeMeritNo = String(s.raw_data.sr_no);
  } else if (
    s.raw_data?.college_merit_no !== undefined &&
    s.raw_data?.college_merit_no !== null &&
    s.raw_data?.college_merit_no !== ''
  ) {
    collegeMeritNo = String(s.raw_data.college_merit_no);
  } else if (
    s.raw_data?.merit_number !== undefined &&
    s.raw_data?.merit_number !== null &&
    s.raw_data?.merit_number !== ''
  ) {
    collegeMeritNo = String(s.raw_data.merit_number);
  } else if (s.merit_number) {
    collegeMeritNo = String(s.merit_number);
  }

  // Candidate Name
  const candidateName = s.candidate_name || '-';

  // CET General Merit No.
  const cetMeritNo = String(s.merit_number ?? s.raw_data?.merit_number ?? '-');

  // Percentile -> PCM CET Total Percentile
  let percentile = '-';
  const rawPcm = s.raw_data?.pcm_cet_total_percentile ?? s.pcm_percentile;
  if (
    rawPcm !== undefined &&
    rawPcm !== null &&
    rawPcm !== '' &&
    rawPcm !== '—' &&
    rawPcm !== '-'
  ) {
    const num = Number(rawPcm);
    if (!isNaN(num)) {
      percentile = Number.isInteger(num) ? String(num) : num.toFixed(2);
    } else {
      percentile = String(rawPcm);
    }
  }

  // Admitted or Not -> Yes
  const admittedOrNot = 'Yes';

  // Allotted Branch -> actual allocated branch
  const allottedBranch = s.allocated_branch_id || '-';

  // Reason for Not Admission -> -
  const reason = '-';

  return {
    srNo,
    collegeMeritNo,
    candidateName,
    cetMeritNo,
    percentile,
    admittedOrNot,
    allottedBranch,
    reason,
  };
}

/**
 * Generates the official "Allotted Students Report" Excel (.xlsx) workbook.
 * - Fetches live students from Supabase (public.students) where allocated_branch_id IS NOT NULL.
 * - Filters strictly for the 9 approved B.Tech engineering branches.
 * - Produces TWO official sections on the same worksheet:
 *   1. List of Attended Students Datewise Report (ACP)
 *   2. List of Attended Students Datewise Report (Institute Level Seats/ Management Quota)
 * - Formats visually to match the official reference report (clean white background, light gray headers,
 *   crisp borders, centered text, portrait A4 print setup with official footer).
 */
export async function generateAllottedStudentsExcelReport(
  fallbackStudents?: Student[]
): Promise<void> {
  const allowedBranches = new Set<string>(BRANCH_CODES);

  // 1. Fetch live student records directly from Supabase public.students
  let fetchedStudents: Student[] = [];
  let querySucceeded = false;
  try {
    const client = getSupabase();
    if (client) {
      const allRows: Record<string, unknown>[] = [];
      const pageSize = 1000;
      let page = 0;
      let hasMore = true;

      while (hasMore) {
        const from = page * pageSize;
        const to = from + pageSize - 1;
        const { data, error } = await client
          .from('students')
          .select('*')
          .not('allocated_branch_id', 'is', null)
          .order('application_id', { ascending: true })
          .range(from, to);

        if (error) {
          console.warn('[Allotted Excel] Supabase query error:', error.message);
          break;
        }

        querySucceeded = true;
        if (!data || data.length === 0) {
          hasMore = false;
        } else {
          allRows.push(...data);
          if (data.length < pageSize) {
            hasMore = false;
          } else {
            page++;
          }
        }
      }

      if (allRows.length > 0) {
        fetchedStudents = allRows.map(mapDbRowToStudent);
      }
    }
  } catch (err) {
    console.warn('[Allotted Excel] Could not query Supabase directly:', err);
  }

  // Fallback to in-memory state ONLY if Supabase could not be contacted
  if (!querySucceeded && fallbackStudents && fallbackStudents.length > 0) {
    fetchedStudents = fallbackStudents.filter((s) => Boolean(s.allocated_branch_id));
  }

  // 2. Filter strictly: ONLY students where allocated_branch_id IS NOT NULL
  // and belongs to the 9 approved engineering branches
  const allottedStudents = fetchedStudents.filter((s) => {
    if (!s.allocated_branch_id) return false;
    const branch = String(s.allocated_branch_id).trim().toUpperCase();
    return branch !== '' && branch !== 'NULL' && allowedBranches.has(branch);
  });

  // 3. Separate into ACP (A-CAP) and IL sections
  const acapStudents = allottedStudents.filter(
    (s) => getStudentReportSection(s) === 'A-CAP'
  );
  const ilStudents = allottedStudents.filter(
    (s) => getStudentReportSection(s) === 'IL'
  );

  // 4. Sort within each section by CET General Merit No. ascending, then candidate name
  acapStudents.sort((a, b) => {
    const meritA = parseMeritNumber(a.merit_number ?? a.raw_data?.merit_number);
    const meritB = parseMeritNumber(b.merit_number ?? b.raw_data?.merit_number);
    if (meritA !== meritB) return meritA - meritB;
    return (a.candidate_name || '').localeCompare(b.candidate_name || '');
  });

  ilStudents.sort((a, b) => {
    const meritA = parseMeritNumber(a.merit_number ?? a.raw_data?.merit_number);
    const meritB = parseMeritNumber(b.merit_number ?? b.raw_data?.merit_number);
    if (meritA !== meritB) return meritA - meritB;
    return (a.candidate_name || '').localeCompare(b.candidate_name || '');
  });

  // 5. Build Excel Workbook
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'G. H. RAISONI COLLEGE OF ENGINEERING & MANAGEMENT';
  workbook.lastModifiedBy = 'Centralized Admission System';
  workbook.created = new Date();
  workbook.modified = new Date();

  // Create single worksheet: "Allotted Students Report"
  const worksheet = workbook.addWorksheet('Allotted Students Report', {
    views: [{ showGridLines: false }],
    pageSetup: {
      paperSize: 9, // A4
      orientation: 'portrait',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      horizontalCentered: true,
      showGridLines: false,
      margins: {
        left: 0.4,
        right: 0.4,
        top: 0.6,
        bottom: 0.6,
        header: 0.3,
        footer: 0.3,
      },
    },
  });

  // Footer configuration
  worksheet.headerFooter.oddFooter =
    '&L&8Centralized Admission System — Official Institutional Report&R&8Page &P of &N';
  worksheet.headerFooter.evenFooter =
    '&L&8Centralized Admission System — Official Institutional Report&R&8Page &P of &N';

  // Define column widths
  worksheet.columns = [
    { key: 'sr_no', width: 10 },
    { key: 'college_merit', width: 16 },
    { key: 'candidate_name', width: 36 },
    { key: 'cet_merit', width: 16 },
    { key: 'percentile', width: 14 },
    { key: 'admitted', width: 16 },
    { key: 'branch', width: 18 },
    { key: 'reason', width: 22 },
  ];

  // Styling helpers
  const thinBorder: Partial<ExcelJS.Borders> = {
    top: { style: 'thin', color: { argb: 'FF000000' } },
    left: { style: 'thin', color: { argb: 'FF000000' } },
    bottom: { style: 'thin', color: { argb: 'FF000000' } },
    right: { style: 'thin', color: { argb: 'FF000000' } },
  };

  const headerFill: ExcelJS.FillPattern = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFEEEEEE' },
  };

  // Date formatting: DD/MM/YYYY
  const now = new Date();
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = now.getFullYear();
  const dateStr = `${day}/${month}/${year}`;
  const dateSlug = `${day}-${month}-${year}`;

  let currentRowIndex = 1;

  // Function to render a section
  function renderSection(
    title: string,
    subtitleLines: string[],
    date: string,
    rows: FormattedStudentRow[]
  ) {
    // 1. Institutional Header
    worksheet.mergeCells(`A${currentRowIndex}:H${currentRowIndex}`);
    const instCell = worksheet.getCell(`A${currentRowIndex}`);
    instCell.value = title;
    instCell.font = { name: 'Arial', size: 12.5, bold: true, color: { argb: 'FF000000' } };
    instCell.alignment = { horizontal: 'center', vertical: 'middle' };
    worksheet.getRow(currentRowIndex).height = 24;
    currentRowIndex++;

    // 2. Subtitle lines
    for (const line of subtitleLines) {
      worksheet.mergeCells(`A${currentRowIndex}:H${currentRowIndex}`);
      const subCell = worksheet.getCell(`A${currentRowIndex}`);
      subCell.value = line;
      subCell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF000000' } };
      subCell.alignment = { horizontal: 'center', vertical: 'middle' };
      worksheet.getRow(currentRowIndex).height = 19;
      currentRowIndex++;
    }

    // 3. Date row (aligned to right across A:H)
    worksheet.mergeCells(`A${currentRowIndex}:H${currentRowIndex}`);
    const dateCell = worksheet.getCell(`A${currentRowIndex}`);
    dateCell.value = `Date: ${date}`;
    dateCell.font = { name: 'Arial', size: 9, bold: false, color: { argb: 'FF000000' } };
    dateCell.alignment = { horizontal: 'right', vertical: 'middle' };
    worksheet.getRow(currentRowIndex).height = 18;
    currentRowIndex++;

    // 4. Table Header
    const headerRow = worksheet.getRow(currentRowIndex);
    headerRow.height = 28;
    TABLE_HEADERS.forEach((th, idx) => {
      const cell = headerRow.getCell(idx + 1);
      cell.value = th;
      cell.font = { name: 'Arial', size: 8, bold: true, color: { argb: 'FF000000' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.fill = headerFill;
      cell.border = thinBorder;
    });
    currentRowIndex++;

    // 5. Table Body
    if (rows.length === 0) {
      worksheet.mergeCells(`A${currentRowIndex}:H${currentRowIndex}`);
      const emptyCell = worksheet.getCell(`A${currentRowIndex}`);
      emptyCell.value = 'No records found for the selected date.';
      emptyCell.font = { name: 'Arial', size: 8.5, italic: true, color: { argb: 'FF000000' } };
      emptyCell.alignment = { horizontal: 'center', vertical: 'middle' };
      for (let c = 1; c <= 8; c++) {
        worksheet.getRow(currentRowIndex).getCell(c).border = thinBorder;
      }
      worksheet.getRow(currentRowIndex).height = 22;
      currentRowIndex++;
    } else {
      rows.forEach((row) => {
        const dRow = worksheet.getRow(currentRowIndex);
        dRow.height = 20;

        const cellValues = [
          row.srNo,
          row.collegeMeritNo,
          row.candidateName,
          row.cetMeritNo,
          row.percentile,
          row.admittedOrNot,
          row.allottedBranch,
          row.reason,
        ];

        cellValues.forEach((val, idx) => {
          const cell = dRow.getCell(idx + 1);
          cell.value = val;
          cell.font = { name: 'Arial', size: 8, color: { argb: 'FF000000' } };
          cell.border = thinBorder;
          cell.alignment = {
            horizontal: idx === 2 ? 'left' : 'center',
            vertical: 'middle',
            wrapText: idx === 2 || idx === 6 || idx === 7,
          };
        });

        currentRowIndex++;
      });
    }
  }

  // SECTION 1: ACP Section
  renderSection(
    'G. H. RAISONI COLLEGE OF ENGINEERING & MANAGEMENT',
    ['List of Attended Students Datewise Report (ACP)'],
    dateStr,
    acapStudents.map(mapAllottedStudentToRow)
  );

  // Compact Gap between sections (2 rows)
  currentRowIndex += 2;

  // SECTION 2: IL Section
  renderSection(
    'G. H. RAISONI COLLEGE OF ENGINEERING & MANAGEMENT',
    [
      'List of Attended Students Datewise Report',
      '(Institute Level Seats/ Management Quota)',
    ],
    dateStr,
    ilStudents.map(mapAllottedStudentToRow)
  );

  // Set print area
  worksheet.pageSetup.printArea = `A1:H${currentRowIndex - 1}`;

  // Generate and download workbook
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Allotted_Students_Report_${dateSlug}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
