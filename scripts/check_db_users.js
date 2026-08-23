const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '../.env.local' });
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL || 'https://gcslfkujlfnznedatrsn.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

console.log('Supabase URL:', supabaseUrl);
console.log('Has Service Role Key:', !!supabaseKey);

if (supabaseKey) {
  const admin = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });

  async function checkUsers() {
    console.log('\n--- 1. auth.users ---');
    const { data: { users }, error: authErr } = await admin.auth.admin.listUsers();
    if (authErr) console.error('Auth error:', authErr);
    else {
      console.log(`Total Auth Users: ${users.length}`);
      users.forEach(u => console.log(` - ID: ${u.id} | Email: ${u.email} | Confirmed: ${u.email_confirmed_at != null}`));
    }

    console.log('\n--- 2. brisk_users ---');
    const { data: bUsers, error: bErr } = await admin.from('brisk_users').select('*');
    if (bErr) console.error('brisk_users error:', bErr);
    else {
      console.log(`Total brisk_users: ${bUsers.length}`);
      bUsers.forEach(u => console.log(` - ID: ${u.id} | Email: ${u.email} | Name: ${u.name} | Role: ${u.role} | EmpId: ${u.employee_id}`));
    }

    console.log('\n--- 3. brisk_employees ---');
    const { data: emps, error: eErr } = await admin.from('brisk_employees').select('id, name, email, role, active');
    if (eErr) console.error('brisk_employees error:', eErr);
    else {
      console.log(`Total brisk_employees: ${emps.length}`);
      emps.forEach(e => console.log(` - ID: ${e.id} | Name: ${e.name} | Email: ${e.email} | Role: ${e.role}`));
    }
  }

  checkUsers().catch(console.error);
} else {
  console.log('SUPABASE_SERVICE_ROLE_KEY not in local environment. Checking via anon key...');
  const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdjc2xma3VqbGZuem5lZGF0cnNuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0OTEwODksImV4cCI6MjA5MjA2NzA4OX0.qCfeYYF2rcqfz_t2-wxLAE0fiosy9C2sbG3BShYVIT0';
  const client = createClient(supabaseUrl, anonKey);
  console.log('Anon client initialized.');
}
