export type BranchCode =
  | 'CIVIL'
  | 'CSE'
  | 'AI'
  | 'DS'
  | 'CY'
  | 'IT'
  | 'EE'
  | 'ENTC'
  | 'MECH';

export type MeritSelection = 'IL ONLY' | 'A-CAP ONLY' | 'IL + A-CAP';
export type ProcessingMode = 'IL' | 'A-CAP';

export interface BranchInitialCapacity {
  code: BranchCode;
  name: string;
  il: number;
  acap: number;
  total: number;
}

export interface Student {
  id: string; // usually application_id
  application_id: string;
  candidate_name: string;
  merit_number: number | string;
  pcm_percentile: number | string;
  jee_percentile: number | string;
  hsc_percentage: number | string;
  ssc_percentage: number | string;
  signature?: string;
  original_merit_selection: MeritSelection;
  current_processing_mode: ProcessingMode;
  allocated_branch_id: BranchCode | null;
  allocated_quota: ProcessingMode | null;
  allocated_at?: string | null;
  status?: string;
  gender?: string | null;
  category?: string | null;
  raw_data?: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
}

export interface AdmissionData {
  capacities: Record<BranchCode, { il: number; acap: number }>;
  students: Student[];
  vacancySummary: VacancySummary;
}

export interface BranchVacancy {
  branch: BranchCode;
  name: string;
  initialIL: number;
  initialACAP: number;
  allocatedIL: number;
  allocatedACAP: number;
  currentIL: number;
  currentACAP: number;
  currentTotal: number;
}

export interface VacancySummary {
  branches: Record<BranchCode, BranchVacancy>;
  totalIL: number;
  totalACAP: number;
  totalCombined: number;
  initialTotalIL: number;
  initialTotalACAP: number;
  initialTotalCombined: number;
}
