const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL || 'https://gcslfkujlfnznedatrsn.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdjc2xma3VqbGZuem5lZGF0cnNuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0OTEwODksImV4cCI6MjA5MjA2NzA4OX0.qCfeYYF2rcqfz_t2-wxLAE0fiosy9C2sbG3BShYVIT0';

const client = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });

async function verifyPayRatePersistence() {
  console.log('1. Logging in as Peter Kim (Manager)...');
  const { data: auth, error: authErr } = await client.auth.signInWithPassword({
    email: 'pharmotago@gmail.com',
    password: 'Amcal2026!'
  });

  if (authErr) {
    console.error('❌ Auth error:', authErr);
    return;
  }
  console.log('✅ Authenticated.');

  // Find an employee to test (e.g. Wendy Lobb)
  const { data: emps, error: empErr } = await client
    .from('brisk_employees')
    .select('id, name, hourly_rate, role')
    .ilike('name', '%Wendy%')
    .limit(1);

  if (empErr || !emps || emps.length === 0) {
    console.error('❌ Could not find test employee:', empErr);
    return;
  }

  const testEmp = emps[0];
  const originalRate = parseFloat(testEmp.hourly_rate);
  console.log(`\nFound employee: ${testEmp.name} (Current Rate: $${originalRate})`);

  const testNewRate = 38.33; // Test with decimal
  console.log(`2. Updating hourly_rate to: $${testNewRate}...`);

  const { data: updated, error: updateErr } = await client
    .from('brisk_employees')
    .update({ hourly_rate: testNewRate })
    .eq('id', testEmp.id)
    .select()
    .single();

  if (updateErr) {
    console.error('❌ Update failed:', updateErr);
    return;
  }

  console.log(`✅ DB Update succeeded. DB Returned: $${updated.hourly_rate}`);

  // Fetch fresh from DB to verify persistence
  console.log('3. Fetching fresh from Supabase to verify persistence...');
  const { data: verified, error: verifyErr } = await client
    .from('brisk_employees')
    .select('id, name, hourly_rate')
    .eq('id', testEmp.id)
    .single();

  if (verifyErr) {
    console.error('❌ Verification fetch failed:', verifyErr);
    return;
  }

  console.log(`✅ Fresh fetch confirmed hourly_rate = $${verified.hourly_rate}`);

  // Restore original rate
  console.log(`4. Restoring original rate: $${originalRate}...`);
  await client
    .from('brisk_employees')
    .update({ hourly_rate: originalRate })
    .eq('id', testEmp.id);
  console.log(`✅ Rate restored back to $${originalRate}. Test complete!\n`);
}

verifyPayRatePersistence().catch(console.error);
