const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL || 'https://gcslfkujlfnznedatrsn.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdjc2xma3VqbGZuem5lZGF0cnNuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0OTEwODksImV4cCI6MjA5MjA2NzA4OX0.qCfeYYF2rcqfz_t2-wxLAE0fiosy9C2sbG3BShYVIT0';

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
});

async function checkSchema() {
  const { data, error } = await supabase
    .from('brisk_leave_requests')
    .select('id, employee_id, start_date, end_date, reason, status, leave_duration_type, unavailable_from, unavailable_until')
    .limit(1);

  if (error) {
    console.log('QUERY_RESULT: ERROR', error.message);
  } else {
    console.log('QUERY_RESULT: SUCCESS (Columns exist)');
  }
}

checkSchema().catch(console.error);
