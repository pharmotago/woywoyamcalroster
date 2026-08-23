let supabase;

if (!window.supabase || typeof window.supabase.createClient !== 'function') {
  console.error('[FATAL] Supabase JS library not loaded. Ensure the script tag is present in index.html before this module.');
  // Create a stub to prevent cascading crashes
  supabase = new Proxy({}, {
    get: (target, prop) => {
      if (prop === 'from') return () => new Proxy({}, {
        get: () => () => ({ data: null, error: { message: 'Supabase not loaded' } })
      });
      if (prop === 'auth') return {
        signInWithPassword: async () => ({ data: null, error: { message: 'Supabase not loaded' } }),
        signUp: async () => ({ data: null, error: { message: 'Supabase not loaded' } }),
        signOut: async () => ({ error: null }),
        getSession: async () => ({ data: { session: null }, error: null }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } })
      };
      return () => ({ data: null, error: { message: 'Supabase not loaded' } });
    }
  });
} else {
  const { createClient } = window.supabase;

  const SUPABASE_URL = 'https://gcslfkujlfnznedatrsn.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdjc2xma3VqbGZuem5lZGF0cnNuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0OTEwODksImV4cCI6MjA5MjA2NzA4OX0.qCfeYYF2rcqfz_t2-wxLAE0fiosy9C2sbG3BShYVIT0';

  supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      flowType: 'implicit',
      detectSessionInUrl: true,
      persistSession: true,
      autoRefreshToken: true
    }
  });
}

export { supabase };
export default supabase;
