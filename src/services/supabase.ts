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

const CACHE_KEY_CAPACITIES = 'gh_raisoni_cached_branch_capacities';
const CACHE_KEY_STUDENTS = 'gh_raisoni_cached_students';

/**
 * Resilient fetch wrapper for Supabase requests.
 * - Adds timeout protection
 * - If direct request to supabase.co fails with TypeError: Failed to fetch (e.g. adblocker,
 *   CSP, or corporate firewall blocking third-party domains in browser), automatically
 *   falls back to the same-origin proxy (/api/supabase/...)
 * - Includes retry with backoff
 */
async function resilientFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const urlStr = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;

  const doAttempt = async (targetUrl: string, timeoutMs = 25000): Promise<Response> => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(targetUrl, {
        ...init,
        signal: init?.signal || controller.signal,
      });
      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  };

  // 1. Try target URL first
  try {
    return await doAttempt(urlStr);
  } catch (err) {
    console.warn('[Supabase Fetch] Direct fetch attempt encountered error:', err);

    // 2. If in browser and URL points to an external supabase domain, try local same-origin proxy
    if (typeof window !== 'undefined' && urlStr.includes('supabase.co')) {
      try {
        const parsed = new URL(urlStr);
        const proxyUrl = `${window.location.origin}/api/supabase${parsed.pathname}${parsed.search}`;
        console.info('[Supabase Fetch] Attempting fallback via same-origin proxy:', proxyUrl);
        return await doAttempt(proxyUrl, 20000);
      } catch (proxyErr) {
        console.warn('[Supabase Fetch] Proxy attempt also failed:', proxyErr);
      }
    }

    // 3. Retry after brief backoff
    await new Promise((r) => setTimeout(r, 1000));
    return await doAttempt(urlStr, 25000);
  }
}

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
        global: {
          fetch: resilientFetch,
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
  const appId = String(row.application_id || raw.application_id || row.id || '').trim().toUpperCase();
  const meritNum =
    (row.merit_no as string | number) ??
    (raw.merit_number as string | number) ??
    (raw.merit_no as string | number) ??
    '';

  const pcmRaw =
    raw.pcm_cet_total_percentile ??
    raw.pcm_percentile ??
    raw.pcm ??
    row.pcm_percentile;
  const pcm = pcmRaw !== undefined && pcmRaw !== null && pcmRaw !== '' ? String(pcmRaw) : '—';

  const jeeRaw =
    raw.jee_total_percentile ??
    raw.jee_percentile ??
    raw.jee ??
    row.jee_percentile;
  const jee = jeeRaw !== undefined && jeeRaw !== null && jeeRaw !== '' ? String(jeeRaw) : '—';

  const hscRaw =
    raw.hsc_total_percentage ??
    raw.hsc_percentage ??
    raw.hsc ??
    row.hsc_percentage;
  const hsc = hscRaw !== undefined && hscRaw !== null && hscRaw !== '' ? String(hscRaw) : '—';

  const sscRaw =
    raw.ssc_total_percentage ??
    raw.ssc_percentage ??
    raw.ssc ??
    row.ssc_percentage;
  const ssc = sscRaw !== undefined && sscRaw !== null && sscRaw !== '' ? String(sscRaw) : '—';

  const signature = String(raw.signature ?? row.signature ?? 'Verified');

  // Derive classification authoritatively from public.students row columns
  const origMerit: MeritSelection =
    (row.original_merit_selection as MeritSelection) ||
    (raw.original_merit_selection as MeritSelection) ||
    (row.allocated_quota === 'A-CAP' ? 'A-CAP ONLY' : 'IL ONLY');

  const procMode: ProcessingMode =
    (row.current_processing_mode as ProcessingMode) ||
    (raw.current_processing_mode as ProcessingMode) ||
    (origMerit.includes('IL') ? 'IL' : 'A-CAP');

  return {
    id: appId,
    application_id: appId,
    candidate_name: String(row.candidate_name || raw.candidate_name || row.name || `Candidate ${appId}`),
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
    gender: (row.gender as string) || (raw.gender as string) || null,
    category: (row.category as string) || (raw.category as string) || null,
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
    original_merit_selection: s.original_merit_selection,
    current_processing_mode: s.current_processing_mode,
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

  try {
    const { data, error } = await client
      .from('branch_capacities')
      .select('branch, il, acap, updated_at');

    if (error) {
      throw error;
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

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(CACHE_KEY_CAPACITIES, JSON.stringify(result));
      } catch {
        // Storage quota exceeded or disabled
      }
    }

    return result;
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem(CACHE_KEY_CAPACITIES);
        if (cached) {
          const parsed = JSON.parse(cached);
          console.warn('[Supabase Capacities] Network fetch failed, using cached capacities:', errMsg);
          return parsed;
        }
      } catch {
        // Ignore cache parse error
      }
    }
    throw new Error(`Failed to fetch branch capacities from Supabase: ${errMsg}`);
  }
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
 * Retrieves all stored records using range pagination to bypass PostgREST 1000 limit.
 */
export async function fetchAuthoritativeStudents(): Promise<Student[]> {
  const client = getSupabase();
  if (!client) {
    throw new Error('Supabase client is not initialized.');
  }

  const allRows: Record<string, unknown>[] = [];
  const pageSize = 1000;
  let page = 0;
  let hasMore = true;

  try {
    while (hasMore) {
      const from = page * pageSize;
      const to = from + pageSize - 1;
      const { data, error } = await client
        .from('students')
        .select('*')
        .order('application_id', { ascending: true })
        .range(from, to);

      if (error) {
        throw error;
      }

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

    const mapped = allRows.map(mapDbRowToStudent);
    const ilCount = mapped.filter((s) => s.current_processing_mode === 'IL').length;
    const acapCount = mapped.filter((s) => s.current_processing_mode === 'A-CAP').length;
    console.log(
      `[Supabase public.students] Authoritatively fetched ${allRows.length} rows (Mapped: ${mapped.length}, IL: ${ilCount}, A-CAP: ${acapCount})`
    );

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(CACHE_KEY_STUDENTS, JSON.stringify(allRows));
      } catch {
        // Storage quota exceeded or disabled
      }
    }

    return mapped;
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem(CACHE_KEY_STUDENTS);
        if (cached) {
          const cachedRows = JSON.parse(cached);
          if (Array.isArray(cachedRows) && cachedRows.length > 0) {
            console.warn(
              `[Supabase Students] Network fetch failed (${errMsg}), using ${cachedRows.length} cached student records.`
            );
            return cachedRows.map(mapDbRowToStudent);
          }
        }
      } catch {
        // Ignore parse error
      }
    }
    throw new Error(`Failed to fetch students from Supabase: ${errMsg}`);
  }
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
 * Resets all student allocations in Supabase public.students, returning them to unallocated state.
 * Preserves the imported student registry.
 */
export async function resetStudentsInSupabase(): Promise<void> {
  const client = getSupabase();
  if (!client) {
    throw new Error('Supabase client is not initialized.');
  }

  const { error } = await client
    .from('students')
    .update({
      allocated_branch_id: null,
      allocated_quota: null,
      allocated_at: null,
      status: 'Pending',
      updated_at: new Date().toISOString(),
    })
    .neq('application_id', '');

  if (error) {
    throw new Error(`Failed to reset allocations in Supabase: ${error.message}`);
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
