import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export function createSupabaseBrowserClient() {
  if (typeof window === 'undefined') {
    throw new Error(
      'createSupabaseBrowserClient must be called in the browser'
    );
  }

  const globalForSupabase = globalThis as unknown as {
    __supabaseBrowserClient?: SupabaseClient;
  };
  if (globalForSupabase.__supabaseBrowserClient)
    return globalForSupabase.__supabaseBrowserClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY'
    );
  }

  globalForSupabase.__supabaseBrowserClient = createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  return globalForSupabase.__supabaseBrowserClient;
}
