import { BranchCode, BranchInitialCapacity } from './types';

export const BRANCH_CODES: BranchCode[] = [
  'CIVIL',
  'CSE',
  'AI',
  'DS',
  'CY',
  'IT',
  'EE',
  'ENTC',
  'MECH',
];

export const BRANCH_NAMES: Record<BranchCode, string> = {
  CIVIL: 'Civil Engineering',
  CSE: 'Computer Science & Engineering',
  AI: 'Artificial Intelligence',
  DS: 'Data Science',
  CY: 'Cyber Security',
  IT: 'Information Technology',
  EE: 'Electrical Engineering',
  ENTC: 'Electronics & Telecommunication',
  MECH: 'Mechanical Engineering',
};

export const DEFAULT_EMPTY_CAPACITIES: Record<BranchCode, { il: number; acap: number }> = {
  CIVIL: { il: 0, acap: 0 },
  CSE: { il: 0, acap: 0 },
  AI: { il: 0, acap: 0 },
  DS: { il: 0, acap: 0 },
  CY: { il: 0, acap: 0 },
  IT: { il: 0, acap: 0 },
  EE: { il: 0, acap: 0 },
  ENTC: { il: 0, acap: 0 },
  MECH: { il: 0, acap: 0 },
};

export const EXPECTED_EXCEL_COLUMNS = [
  'Sr. No.',
  'Application ID',
  'Candidate Name',
  'Merit Number',
  'PCM CET Total Percentile',
  'JEE Total Percentile',
  'HSC Total Percentage',
  'SSC Total Percentage',
  'Signature',
];
