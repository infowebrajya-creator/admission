import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { BRANCH_CODES, DEFAULT_EMPTY_CAPACITIES } from '../constants';
import { BranchCode, MeritSelection, ProcessingMode, Student } from '../types';

const supabaseUrl =
  (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_SUPABASE_URL) ||
  import.meta.env.VITE_SUPABASE_URL ||
  import.meta.env.NEXT_PUBLIC_SUPABASE_URL ||
  'https://iiaykyanpvuszysklnky.supabase.co';

const supabaseAnonKey =
  (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) ||
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  import.meta.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  'sb_publishable_MnCXDrieERAgjripnpX5CA_jYP3CUWV';

let supabaseInstance: SupabaseClient | null = null;

export function isSupabaseConfigured(): boolean {
  return Boolean(supabaseUrl && supabaseAnonKey);
}

export function getSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured()) {
    return null;
  }
  if (!supabaseInstance) {
    try {
      supabaseInstance = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      });
    } catch (err) {
      console.error('Supabase initialization error:', err);
      return null;
    }
  }
  return supabaseInstance;
}

/**
 * Maps a Supabase student record row into the frontend Student model.
 */
export function mapDbRowToStudent(row: Record<string, unknown>): Student {
  const raw = (row.raw_data as Record<string, unknown>) || {};
  const appId = String(row.application_id || row.id || '').trim().toUpperCase();
  const meritNum =
    (row.merit_no as string | number) ||
    (raw.merit_number as string | number) ||
    '';

  const pcm = String(raw.pcm_percentile ?? row.pcm_percentile ?? '0.00');
  const jee = String(raw.jee_percentile ?? row.jee_percentile ?? '0.00');
  const hsc = String(raw.hsc_percentage ?? row.hsc_percentage ?? '0.00');
  const ssc = String(raw.ssc_percentage ?? row.ssc_percentage ?? '0.00');
  const signature = String(raw.signature ?? row.signature ?? 'Verified');

  let origMerit: MeritSelection = (raw.original_merit_selection as MeritSelection) || 'A-CAP ONLY';
  let procMode: ProcessingMode = (raw.current_processing_mode as ProcessingMode) || 'A-CAP';

  if (!raw.original_merit_selection) {
    if (row.allocated_quota === 'IL') {
      origMerit = 'IL ONLY';
      procMode = 'IL';
    } else if (row.allocated_quota === 'A-CAP') {
      origMerit = 'A-CAP ONLY';
      procMode = 'A-CAP';
    }
  }

  return {
    id: appId,
    application_id: appId,
    candidate_name: String(row.candidate_name || row.name || `Candidate ${appId}`),
    merit_number: meritNum,
    pcm_percentile: pcm,
    jee_percentile: jee,
    hsc_percentage: hsc,
    ssc_percentage: ssc,
    signature: signature,
    original_merit_selection: origMerit,
    current_processing_mode: procMode,
    allocated_branch_id: (row.allocated_branch_id as BranchCode) || null,
    allocated_quota: (row.allocated_quota as ProcessingMode) || null,
    allocated_at: (row.allocated_at as string) || null,
    status: (row.status as string) || (row.allocated_branch_id ? 'Admitted' : 'Pending'),
    gender: (row.gender as string) || null,
    category: (row.category as string) || null,
    raw_data: raw,
    created_at: (row.created_at as string) || undefined,
    updated_at: (row.updated_at as string) || undefined,
  };
}

/**
 * Maps a frontend Student model to the Supabase database row.
 */
export function mapStudentToDbRow(s: Student): Record<string, unknown> {
  return {
    application_id: s.application_id.trim().toUpperCase(),
    candidate_name: s.candidate_name,
    merit_no: String(s.merit_number ?? ''),
    allocated_branch_id: s.allocated_branch_id || null,
    allocated_quota: s.allocated_quota || null,
    allocated_at: s.allocated_at || null,
    status: s.status || (s.allocated_branch_id ? 'Admitted' : 'Pending'),
    gender: s.gender || null,
    category: s.category || null,
    raw_data: {
      ...(s.raw_data || {}),
      pcm_percentile: s.pcm_percentile,
      jee_percentile: s.jee_percentile,
      hsc_percentage: s.hsc_percentage,
      ssc_percentage: s.ssc_percentage,
      signature: s.signature,
      original_merit_selection: s.original_merit_selection,
      current_processing_mode: s.current_processing_mode,
      merit_number: s.merit_number,
    },
    updated_at: new Date().toISOString(),
  };
}

/**
 * Authoritatively fetches branch capacities directly from Supabase public.branch_capacities.
 * If database values change, returns the exact database state without hardcoded fallbacks.
 */
export async function fetchAuthoritativeBranchCapacities(): Promise<
  Record<BranchCode, { il: number; acap: number }>
> {
  const client = getSupabase();
  if (!client) {
    throw new Error('Supabase client is not initialized or configured.');
  }

  const { data, error } = await client
    .from('branch_capacities')
    .select('branch, il, acap, updated_at');

  if (error) {
    throw new Error(`Failed to fetch branch capacities from Supabase: ${error.message}`);
  }

  const result: Record<BranchCode, { il: number; acap: number }> = {
    ...DEFAULT_EMPTY_CAPACITIES,
  };

  if (Array.isArray(data)) {
    for (const row of data) {
      const code = String(row.branch || '').trim().toUpperCase() as BranchCode;
      if (BRANCH_CODES.includes(code)) {
        result[code] = {
          il: Math.max(0, Math.floor(Number(row.il) || 0)),
          acap: Math.max(0, Math.floor(Number(row.acap) || 0)),
        };
      }
    }
  }

  return result;
}

/**
 * Persists administrator-edited branch capacities directly to Supabase public.branch_capacities.
 */
export async function persistBranchCapacitiesToSupabase(
  capacities: Record<BranchCode, { il: number; acap: number }>
): Promise<void> {
  const client = getSupabase();
  if (!client) {
    throw new Error('Supabase client is not initialized.');
  }

  const rows = BRANCH_CODES.map((code) => ({
    branch: code,
    il: Math.max(0, Math.floor(capacities[code]?.il ?? 0)),
    acap: Math.max(0, Math.floor(capacities[code]?.acap ?? 0)),
    updated_at: new Date().toISOString(),
  }));

  const { error } = await client
    .from('branch_capacities')
    .upsert(rows, { onConflict: 'branch' });

  if (error) {
    throw new Error(`Failed to save branch capacities to Supabase: ${error.message}`);
  }
}

/**
 * Authoritatively fetches student registry from Supabase public.students.
 */
export async function fetchAuthoritativeStudents(): Promise<Student[]> {
  const client = getSupabase();
  if (!client) {
    throw new Error('Supabase client is not initialized.');
  }

  const { data, error } = await client
    .from('students')
    .select('*')
    .order('application_id', { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch students from Supabase: ${error.message}`);
  }

  if (!data || !Array.isArray(data) || data.length === 0) {
    return [];
  }

  return data.map(mapDbRowToStudent);
}

/**
 * Persists an allocation or unallocation directly to Supabase public.students.
 * Requirement 6 & 8 compliant.
 */
export async function persistAllocationToSupabase(
  applicationId: string,
  branch: BranchCode | null,
  quota: ProcessingMode | null
): Promise<void> {
  const client = getSupabase();
  if (!client) {
    throw new Error('Supabase client is not initialized.');
  }

  const updatePayload = branch
    ? {
        allocated_branch_id: branch,
        allocated_quota: quota,
        allocated_at: new Date().toISOString(),
        status: 'Admitted',
        updated_at: new Date().toISOString(),
      }
    : {
        allocated_branch_id: null,
        allocated_quota: null,
        allocated_at: null,
        status: 'Pending',
        updated_at: new Date().toISOString(),
      };

  const { error } = await client
    .from('students')
    .update(updatePayload)
    .eq('application_id', applicationId.trim().toUpperCase());

  if (error) {
    throw new Error(`Failed to persist allocation to Supabase: ${error.message}`);
  }
}

/**
 * Persists a list of students to Supabase public.students (e.g. on Excel import).
 */
export async function saveStudentsToSupabase(students: Student[]): Promise<void> {
  const client = getSupabase();
  if (!client) {
    throw new Error('Supabase client is not initialized.');
  }

  if (students.length === 0) return;

  const rows = students.map(mapStudentToDbRow);
  const batchSize = 100;

  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const { error } = await client
      .from('students')
      .upsert(batch, { onConflict: 'application_id' });

    if (error) {
      throw new Error(`Failed to save students to Supabase: ${error.message}`);
    }
  }
}

/**
 * Resets all students from Supabase public.students.
 */
export async function resetStudentsInSupabase(): Promise<void> {
  const client = getSupabase();
  if (!client) {
    throw new Error('Supabase client is not initialized.');
  }

  const { error } = await client
    .from('students')
    .delete()
    .neq('application_id', '');

  if (error) {
    throw new Error(`Failed to reset students in Supabase: ${error.message}`);
  }
}

/**
 * Subscribes to Supabase Realtime postgres_changes on branch_capacities and students tables.
 */
export function subscribeSupabaseRealtime(onChanged: () => void): () => void {
  const client = getSupabase();
  if (!client) {
    return () => {};
  }

  try {
    const channel = client
      .channel('public:admission_live_sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'students' },
        () => {
          onChanged();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'branch_capacities' },
        () => {
          onChanged();
        }
      )
      .subscribe();

    return () => {
      client.removeChannel(channel);
    };
  } catch (err) {
    console.warn('Supabase Realtime subscription error:', err);
    return () => {};
  }
}
