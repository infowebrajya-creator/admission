import { createServerClient } from '@supabase/ssr';

const supabaseUrl =
  (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_SUPABASE_URL) ||
  'https://iiaykyanpvuszysklnky.supabase.co';

const supabaseKey =
  (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) ||
  'sb_publishable_MnCXDrieERAgjripnpX5CA_jYP3CUWV';

export interface CookieStoreLike {
  getAll: () => Array<{ name: string; value: string }>;
  set?: (name: string, value: string, options?: any) => void;
}

export const createClient = (cookieStore: CookieStoreLike) => {
  return createServerClient(
    supabaseUrl!,
    supabaseKey!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              if (cookieStore.set) {
                cookieStore.set(name, value, options);
              }
            });
          } catch {
            // Can be ignored if handled by middleware
          }
        },
      },
    },
  );
};
