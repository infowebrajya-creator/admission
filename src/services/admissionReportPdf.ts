import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Student } from '../types';
import { BRANCH_CODES } from '../constants';
import { getSupabase, mapDbRowToStudent } from './supabase';

function getFormattedDate(d = new Date()): string {
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

interface ReportConfig {
  title: string;
  subtitle: string;
  fileName: string;
  students: Student[];
}

function mapStudentToRow(student: Student, index: number): string[] {
  const isAdmitted = Boolean(student.allocated_branch_id);

  return [
    String(index + 1), // Sr. No.
    String(index + 1), // College Merit List No.
    student.candidate_name || '-', // Candidate Name
    String(student.merit_number || '-'), // CET General Merit No.
    String(student.pcm_percentile || '-'), // Percentile
    isAdmitted ? 'Yes' : 'No', // Admitted or Not (Yes / No)
    isAdmitted ? student.allocated_branch_id! : '-', // Allotted Branch
    isAdmitted ? '-' : 'Not Allocated', // Reason for Not Admission
  ];
}

const TABLE_HEADERS = [
  'Sr. No.',
  'College Merit\nList No.',
  'Candidate Name',
  'CET General\nMerit No.',
  'Percentile',
  'Admitted or Not\n(Yes / No)',
  'Allotted\nBranch',
  'Reason for Not\nAdmission',
];

export function generateAcapReportPdf(allStudents: Student[]): void {
  // Filter for A-CAP students
  const acapStudents = allStudents.filter((s) =>
    s.original_merit_selection.includes('A-CAP')
  );

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  buildSection(doc, {
    title: 'G. H. RAISONI COLLEGE OF ENGINEERING & MANAGEMENT',
    subtitle: 'LIST OF ATTENDED STUDENTS DATEWISE REPORT (A-CAP)',
    students: acapStudents,
    startY: 32,
  });

  addFootersAndPageNumbers(doc);
  const dateStr = new Date().toISOString().slice(0, 10);
  doc.save(`GH_Raisoni_ACAP_Report_${dateStr}.pdf`);
}

export function generateIlReportPdf(allStudents: Student[]): void {
  // Filter for IL students
  const ilStudents = allStudents.filter((s) =>
    s.original_merit_selection.includes('IL')
  );

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  buildSection(doc, {
    title: 'G. H. RAISONI COLLEGE OF ENGINEERING & MANAGEMENT',
    subtitle:
      'LIST OF ATTENDED STUDENTS DATEWISE REPORT\n(INSTITUTE LEVEL SEATS / MANAGEMENT QUOTA)',
    students: ilStudents,
    startY: 36,
  });

  addFootersAndPageNumbers(doc);
  const dateStr = new Date().toISOString().slice(0, 10);
  doc.save(`GH_Raisoni_IL_Report_${dateStr}.pdf`);
}

export function generateCombinedReportPdf(allStudents: Student[]): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const acapStudents = allStudents.filter((s) =>
    s.original_merit_selection.includes('A-CAP')
  );
  const ilStudents = allStudents.filter((s) =>
    s.original_merit_selection.includes('IL')
  );

  // SECTION 1: A-CAP Report
  buildSection(doc, {
    title: 'G. H. RAISONI COLLEGE OF ENGINEERING & MANAGEMENT',
    subtitle: 'LIST OF ATTENDED STUDENTS DATEWISE REPORT (A-CAP)',
    students: acapStudents,
    startY: 32,
  });

  // SECTION 2: IL Report (New Page)
  doc.addPage();
  buildSection(doc, {
    title: 'G. H. RAISONI COLLEGE OF ENGINEERING & MANAGEMENT',
    subtitle:
      'LIST OF ATTENDED STUDENTS DATEWISE REPORT\n(INSTITUTE LEVEL SEATS / MANAGEMENT QUOTA)',
    students: ilStudents,
    startY: 36,
  });

  addFootersAndPageNumbers(doc);
  const dateStr = new Date().toISOString().slice(0, 10);
  doc.save(`GH_Raisoni_Combined_Admission_Report_${dateStr}.pdf`);
}

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

const OFFICIAL_ALLOTTED_HEADERS = [
  'Sr. No.',
  'College Merit\nList No.',
  'Candidate Name',
  'CET General\nMerit No.',
  'Percentile',
  'Admitted or Not\n(Yes / No)',
  'Allotted Branch',
  'Reason for Not\nAdmission',
];

function mapAllottedStudentRow(s: Student, index: number): string[] {
  const srNo = String(index + 1);

  // College Merit List No. -> stored college/source merit list number
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

  // Candidate Name -> candidate_name
  const candidateName = s.candidate_name || '-';

  // CET General Merit No. -> merit_no
  const cetMeritNo = String(s.merit_number ?? s.raw_data?.merit_number ?? '-');

  // Percentile -> PCM CET percentile
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

  // Admitted or Not -> YES
  const admittedOrNot = 'YES';

  // Allotted Branch -> actual allocated branch
  const allottedBranch = s.allocated_branch_id || '-';

  // Reason for Not Admission -> -
  const reason = '-';

  return [
    srNo,
    collegeMeritNo,
    candidateName,
    cetMeritNo,
    percentile,
    admittedOrNot,
    allottedBranch,
    reason,
  ];
}

interface OfficialReportSectionConfig {
  doc: jsPDF;
  subtitle: string | string[];
  date: string;
  rows: (string | unknown)[][];
  startY: number;
}

function renderOfficialReportSection(config: OfficialReportSectionConfig): void {
  const { doc, subtitle, date, rows, startY } = config;
  const pageWidth = doc.internal.pageSize.getWidth();

  // 1. Centered Institutional Heading
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12.5);
  doc.setTextColor(0, 0, 0);
  doc.text(
    'G. H. RAISONI COLLEGE OF ENGINEERING & MANAGEMENT',
    pageWidth / 2,
    14,
    { align: 'center' }
  );

  // 2. Centered Section Heading
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);

  const subtitleLines = Array.isArray(subtitle) ? subtitle : subtitle.split('\n');
  if (subtitleLines.length === 1) {
    doc.text(subtitleLines[0], pageWidth / 2, 20.5, { align: 'center' });
    // Date aligned to right
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`Date: ${date}`, pageWidth - 14, 26, { align: 'right' });
  } else {
    doc.text(subtitleLines[0], pageWidth / 2, 19.5, { align: 'center' });
    doc.text(subtitleLines[1], pageWidth / 2, 24, { align: 'center' });
    // Date aligned to right
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`Date: ${date}`, pageWidth - 14, 29, { align: 'right' });
  }

  // 3. Official 8-column Table
  const bodyData =
    rows.length > 0
      ? rows
      : [
          [
            {
              content: 'No records found for the selected date.',
              colSpan: 8,
              styles: {
                halign: 'center',
                cellPadding: 3.5,
                textColor: [0, 0, 0],
                fontStyle: 'normal',
              },
            },
          ],
        ];

  autoTable(doc, {
    startY: startY,
    head: [OFFICIAL_ALLOTTED_HEADERS],
    body: bodyData,
    theme: 'plain',
    styles: {
      font: 'helvetica',
      fontSize: 8,
      cellPadding: { top: 1.8, right: 1.5, bottom: 1.8, left: 1.5 },
      lineColor: [0, 0, 0],
      lineWidth: 0.15,
      textColor: [0, 0, 0],
      overflow: 'linebreak',
    },
    headStyles: {
      fillColor: [238, 238, 238],
      textColor: [0, 0, 0],
      fontStyle: 'bold',
      halign: 'center',
      valign: 'middle',
      lineColor: [0, 0, 0],
      lineWidth: 0.2,
      fontSize: 7.5,
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 12 }, // Sr. No.
      1: { halign: 'center', cellWidth: 18 }, // College Merit List No.
      2: { halign: 'left', cellWidth: 48 },   // Candidate Name
      3: { halign: 'center', cellWidth: 20 }, // CET General Merit No.
      4: { halign: 'center', cellWidth: 18 }, // Percentile
      5: { halign: 'center', cellWidth: 20 }, // Admitted or Not (Yes / No)
      6: { halign: 'center', cellWidth: 20 }, // Allotted Branch
      7: { halign: 'center', cellWidth: 26 }, // Reason for Not Admission
    },
    margin: { left: 14, right: 14, bottom: 16 },
    pageBreak: 'auto',
    rowPageBreak: 'avoid',
  });
}

/**
 * Generates the official "List of Attended Students Datewise Report" PDF.
 * Authoritatively fetches live public.students from Supabase, filtering strictly
 * where allocated_branch_id IS NOT NULL, resolving against valid institutional branches,
 * and splitting into two official sections on the same PDF:
 * 1. List of Attended Students Datewise Report (ACP)
 * 2. List of Attended Students Datewise Report (Institute Level Seats/ Management Quota)
 */
export async function generateAllottedStudentsReportPdf(
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
          console.warn('[Allotted Report] Supabase query error:', error.message);
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
    console.warn('[Allotted Report] Could not query Supabase directly:', err);
  }

  // Fallback to in-memory state ONLY if Supabase could not be contacted
  if (!querySucceeded && fallbackStudents && fallbackStudents.length > 0) {
    fetchedStudents = fallbackStudents.filter((s) => Boolean(s.allocated_branch_id));
  }

  // 2. Filter strictly: ONLY students where allocated_branch_id IS NOT NULL
  // and belongs to the 9 allowed engineering branches (CIVIL, CSE, AI, DS, CY, IT, EE, ENTC, MECH)
  const allottedStudents = fetchedStudents.filter((s) => {
    if (!s.allocated_branch_id) return false;
    const branch = String(s.allocated_branch_id).trim().toUpperCase();
    return branch !== '' && branch !== 'NULL' && allowedBranches.has(branch);
  });

  // 3. Section assignment:
  // - A-CAP section: students whose admission source/current processing mode is A-CAP
  // - IL section: students whose admission source/current processing mode is IL
  // - If a student is IL + A-CAP, use the student's current processing mode to determine the section.
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

  // 5. Initialize A4 portrait document
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const currentDate = getFormattedDate();

  // SECTION 1: ACP (A-CAP) Section
  renderOfficialReportSection({
    doc,
    subtitle: 'List of Attended Students Datewise Report (ACP)',
    date: currentDate,
    rows: acapStudents.map(mapAllottedStudentRow),
    startY: 30,
  });

  // SECTION 2: IL Section on the same PDF (starts on new page)
  doc.addPage();
  renderOfficialReportSection({
    doc,
    subtitle: [
      'List of Attended Students Datewise Report',
      '(Institute Level Seats/ Management Quota)',
    ],
    date: currentDate,
    rows: ilStudents.map(mapAllottedStudentRow),
    startY: 33,
  });

  // 6. Institutional Footers & Page Numbers
  addFootersAndPageNumbers(doc);

  const dateSlug = `${String(new Date().getDate()).padStart(2, '0')}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${new Date().getFullYear()}`;
  doc.save(`Attended_Students_Report_${dateSlug}.pdf`);
}

function buildSection(
  doc: jsPDF,
  options: {
    title: string;
    subtitle: string;
    students: Student[];
    startY: number;
  }
) {
  const currentDate = getFormattedDate();
  const pageWidth = doc.internal.pageSize.getWidth();

  // Institutional Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(20, 30, 50);
  doc.text(options.title, pageWidth / 2, 14, { align: 'center' });

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(50, 60, 80);

  const subtitleLines = options.subtitle.split('\n');
  if (subtitleLines.length === 1) {
    doc.text(subtitleLines[0], pageWidth / 2, 20, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`Date: ${currentDate}`, pageWidth - 14, 26, { align: 'right' });
  } else {
    doc.text(subtitleLines[0], pageWidth / 2, 20, { align: 'center' });
    doc.text(subtitleLines[1], pageWidth / 2, 25, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`Date: ${currentDate}`, pageWidth - 14, 30, { align: 'right' });
  }

  // Thin dividing rule under header
  doc.setDrawColor(180, 190, 205);
  doc.setLineWidth(0.3);
  doc.line(14, options.startY - 3, pageWidth - 14, options.startY - 3);

  // Table Body Rows
  const rows = options.students.map((student, index) =>
    mapStudentToRow(student, index)
  );

  if (rows.length === 0) {
    rows.push([
      '-',
      '-',
      'No candidates recorded for this category.',
      '-',
      '-',
      '-',
      '-',
      '-',
    ]);
  }

  // Generate Table using autoTable
  autoTable(doc, {
    startY: options.startY,
    head: [TABLE_HEADERS],
    body: rows,
    theme: 'plain',
    styles: {
      font: 'helvetica',
      fontSize: 8,
      cellPadding: { top: 2.2, right: 1.8, bottom: 2.2, left: 1.8 },
      lineColor: [180, 190, 205],
      lineWidth: 0.2,
      textColor: [30, 40, 55],
      overflow: 'linebreak',
    },
    headStyles: {
      fillColor: [240, 243, 248],
      textColor: [15, 23, 42],
      fontStyle: 'bold',
      halign: 'center',
      valign: 'middle',
      lineColor: [140, 150, 170],
      lineWidth: 0.3,
      fontSize: 7.5,
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 12 }, // Sr. No.
      1: { halign: 'center', cellWidth: 18 }, // College Merit List No.
      2: { halign: 'left', cellWidth: 46 }, // Candidate Name
      3: { halign: 'center', cellWidth: 20 }, // CET General Merit No.
      4: { halign: 'center', cellWidth: 18 }, // Percentile
      5: { halign: 'center', cellWidth: 22 }, // Admitted or Not (Yes / No)
      6: { halign: 'center', cellWidth: 18 }, // Allotted Branch
      7: { halign: 'center', cellWidth: 28 }, // Reason for Not Admission
    },
    margin: { left: 14, right: 14, bottom: 18 },
    pageBreak: 'auto',
    rowPageBreak: 'avoid',
  });
}

function addFootersAndPageNumbers(doc: jsPDF): void {
  const totalPages = doc.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setDrawColor(200, 210, 220);
    doc.setLineWidth(0.2);
    doc.line(14, pageHeight - 12, pageWidth - 14, pageHeight - 12);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 115, 130);

    // Left Footer Text
    doc.text(
      'Centralized Admission System — Official Institutional Report',
      14,
      pageHeight - 7
    );

    // Right Footer: Page X of Y
    doc.text(`Page ${i} of ${totalPages}`, pageWidth - 14, pageHeight - 7, {
      align: 'right',
    });
  }
}
