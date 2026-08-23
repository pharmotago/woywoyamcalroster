/**
 * Live Supabase DB Health Probe for Woy Woy Amcal Roster
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL || 'https://gcslfkujlfnznedatrsn.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdjc2xma3VqbGZuem5lZGF0cnNuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0OTEwODksImV4cCI6MjA5MjA2NzA4OX0.qCfeYYF2rcqfz_t2-wxLAE0fiosy9C2sbG3BShYVIT0';

console.log('Testing Supabase connection to:', supabaseUrl);

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
});

async function runProbe() {
  const results = {};

  // 1. Probe brisk_employees
  try {
    const { data, error, count } = await supabase
      .from('brisk_employees')
      .select('id, name, role, active', { count: 'exact' });
    results.employees = error ? { status: 'ERROR', error: error.message } : { status: 'OK', count: data?.length || 0, sample: data?.slice(0, 3).map(e => e.name) };
  } catch (e) {
    results.employees = { status: 'EXCEPTION', error: e.message };
  }

  // 2. Probe brisk_shifts
  try {
    const { data, error } = await supabase
      .from('brisk_shifts')
      .select('id, date, role, start_time, end_time')
      .limit(5);
    results.shifts = error ? { status: 'ERROR', error: error.message } : { status: 'OK', count: data?.length || 0 };
  } catch (e) {
    results.shifts = { status: 'EXCEPTION', error: e.message };
  }

  // 3. Probe brisk_settings
  try {
    const { data, error } = await supabase
      .from('brisk_settings')
      .select('*')
      .maybeSingle();
    results.settings = error ? { status: 'ERROR', error: error.message } : { status: 'OK', companyName: data?.company_name };
  } catch (e) {
    results.settings = { status: 'EXCEPTION', error: e.message };
  }

  // 5. Test brisk_users
  try {
    const { data, error } = await supabase
      .from('brisk_users')
      .select('*')
      .limit(5);
    results.users = error ? { status: 'ERROR', error: error.message } : { status: 'OK', count: data?.length || 0, rows: data };
  } catch (e) {
    results.users = { status: 'EXCEPTION', error: e.message };
  }

  // 6. Test signIn with dummy credentials to see exact Supabase Auth error response
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: 'peter@amcalwoywoy.com',
      password: 'wrongpasswordtest'
    });
    results.authTest = { data, error: error ? error.message : null };
  } catch (e) {
    results.authTest = { exception: e.message };
  }

  console.log('Database Probe Results:', JSON.stringify(results, null, 2));
}

runProbe().catch(console.error);
