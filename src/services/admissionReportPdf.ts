import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Student } from '../types';

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
