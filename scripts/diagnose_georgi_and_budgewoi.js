const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config({ path: '.env.prod.local' });
require('dotenv').config({ path: '.env.local' });
require('dotenv').config();

async function run() {
  console.log('=== 1. CHECKING BUDGEWOI LIVE SITE ===');
  const t = Date.now();
  const verRes = await fetch('https://budgewoiddsroster.vercel.app/version.json?t=' + t);
  const verData = await verRes.json();
  console.log('Budgewoi live version.json:', verData);

  const supabaseUrl = process.env.SUPABASE_URL || 'https://gcslfkujlfnznedatrsn.supabase.co';
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdjc2xma3VqbGZuem5lZGF0cnNuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0OTEwODksImV4cCI6MjA5MjA2NzA4OX0.qCfeYYF2rcqfz_t2-wxLAE0fiosy9C2sbG3BShYVIT0';

  console.log('Supabase URL:', supabaseUrl);
  console.log('Has Service Role Key:', !!process.env.SUPABASE_SERVICE_ROLE_KEY);

  const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });

  console.log('\n=== 2. CHECKING GEORGI PEEK IN brisk_employees ===');
  const { data: employees, error: eErr } = await supabase
    .from('brisk_employees')
    .select('*')
    .ilike('name', '%georgi%');
  console.log('brisk_employees with georgi:', employees, eErr);

  console.log('\n=== 3. CHECKING GEORGI PEEK IN brisk_users ===');
  const { data: users, error: uErr } = await supabase
    .from('brisk_users')
    .select('*')
    .ilike('email', '%georgi%');
  console.log('brisk_users with georgi email:', users, uErr);

  const { data: allUsers, error: auErr } = await supabase
    .from('brisk_users')
    .select('*');
  console.log('All brisk_users count:', allUsers ? allUsers.length : 0);
  if (allUsers) {
    allUsers.forEach(u => console.log(' - User:', u.email, '| Name:', u.name, '| Role:', u.role, '| EmpId:', u.employee_id));
  }

  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.log('\n=== 4. CHECKING auth.users ===');
    const { data: { users: authUsers }, error: aErr } = await supabase.auth.admin.listUsers();
    if (authUsers) {
      const georgiAuth = authUsers.filter(u => u.email && u.email.toLowerCase().includes('georgi'));
      console.log('auth.users matching georgi:', georgiAuth.map(u => ({ id: u.id, email: u.email, confirmed: u.email_confirmed_at })));
    } else {
      console.log('auth.users error:', aErr);
    }
  }

  console.log('\n=== 5. CHECKING brisk_settings FOR BUDGEWOI ===');
  const { data: settings, error: sErr } = await supabase
    .from('brisk_settings')
    .select('*');
  if (settings) {
    settings.forEach(s => {
      console.log(' - Setting Key:', s.key, '| Updated:', s.updated_at);
      if (s.key.includes('budgewoi')) {
        console.log('   Budgewoi settings value:', JSON.stringify(s.value, null, 2));
      }
    });
  } else {
    console.log('Settings error:', sErr);
  }

  console.log('\n=== 6. CHECKING LEAVE REQUESTS / LEAVE SHIFTS ===');
  const { data: leaveRequests, error: lrErr } = await supabase
    .from('brisk_leave_requests')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10);
  console.log('Recent leave requests count:', leaveRequests ? leaveRequests.length : 0, lrErr);
  if (leaveRequests) {
    leaveRequests.forEach(lr => console.log(' - Leave:', lr.id, '| EmpId:', lr.employee_id, '| Type:', lr.type, '| Reason:', lr.reason, '| Status:', lr.status, '| Start:', lr.start_date, '| End:', lr.end_date));
  }

  const { data: leaveShifts, error: lsErr } = await supabase
    .from('brisk_shifts')
    .select('*')
    .or('type.eq.leave,notes.ilike.%leave%')
    .limit(10);
  console.log('Shifts matching leave count:', leaveShifts ? leaveShifts.length : 0, lsErr);
  if (leaveShifts) {
    leaveShifts.forEach(s => console.log(' - Shift:', s.id, '| EmpId:', s.employee_id, '| Type:', s.type, '| Date:', s.date, '| Role:', s.role, '| Notes:', s.notes));
  }
}

run().catch(console.error);
