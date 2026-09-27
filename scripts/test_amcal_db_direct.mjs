import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://gcslfkujlfnznedatrsn.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdjc2xma3VqbGZuem5lZGF0cnNuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjQ5MTA4OSwiZXhwIjoyMDkyMDY3MDg5fQ.RLVurx-xFrtJJ87k9OuovJ4nH9sWWi1kfjSyt5GWpO4';

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

async function check() {
  console.log('Testing connection to Amcal Woy Woy Supabase DB:', SUPABASE_URL);

  const tables = ['brisk_employees', 'brisk_shifts', 'brisk_settings', 'brisk_users', 'brisk_timecards', 'brisk_leave_requests'];
  for (const t of tables) {
    const { count, error } = await admin.from(t).select('*', { count: 'exact', head: true });
    if (error) console.log(`${t}: Error ${error.message}`);
    else console.log(`${t}: ${count} rows`);
  }

  const { data: emps } = await admin.from('brisk_employees').select('id, name, role, active').limit(5);
  console.log('Sample employees:', emps);

  // Check shifts for current week (starting Monday 2026-09-28)
  const { data: shifts } = await admin.from('brisk_shifts').select('id, date, start_time, end_time, role').gte('date', '2026-09-28').lte('date', '2026-10-04');
  console.log(`Shifts for week 2026-09-28 to 2026-10-04: ${shifts?.length}`);
}

check().catch(console.error);
