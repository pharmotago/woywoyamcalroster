const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

// Manually parse .env.prod.local
const envContent = fs.readFileSync('.env.prod.local', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    let val = match[2].trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    env[match[1].trim()] = val;
  }
});

const SUPABASE_URL = env.SUPABASE_URL || 'https://gcslfkujlfnznedatrsn.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

console.log('SUPABASE_URL:', SUPABASE_URL);
console.log('Has Service Key:', !!SUPABASE_SERVICE_ROLE_KEY);

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

async function main() {
  console.log('\n======================================================');
  console.log('1. BRISK_USERS (Registered User Logins in App)');
  console.log('======================================================');
  const { data: bUsers, error: uErr } = await admin.from('brisk_users').select('*');
  if (uErr) console.error('bUsers error:', uErr);
  else {
    console.log(`Total brisk_users count: ${bUsers.length}`);
    bUsers.forEach(u => {
      console.log(` - ${u.email} | name: "${u.name}" | role: "${u.role}" | emp_id: ${u.employee_id} | active: ${u.active}`);
    });
  }

  console.log('\n======================================================');
  console.log('2. AUTH.USERS (Supabase Auth Accounts)');
  console.log('======================================================');
  const { data: { users }, error: aErr } = await admin.auth.admin.listUsers();
  if (aErr) console.error('Auth error:', aErr);
  else {
    console.log(`Total auth.users count: ${users.length}`);
    users.forEach(u => {
      console.log(` - ${u.email} | confirmed: ${u.email_confirmed_at != null} | created: ${u.created_at}`);
    });
  }

  console.log('\n======================================================');
  console.log('3. BRISK_EMPLOYEES (All Employees in Database)');
  console.log('======================================================');
  const { data: emps, error: eErr } = await admin.from('brisk_employees').select('*');
  if (eErr) console.error('emps error:', eErr);
  else {
    console.log(`Total brisk_employees count: ${emps.length}`);
    
    // Group by pharmacy_id
    const amcal = [];
    const budgewoi = [];
    const neither = [];

    emps.forEach(e => {
      const raw = e.pharmacy_id || e.availability?.pharmacy_id || e.availability?.pharmacyId;
      const isBudg = raw && (String(raw).includes('budgewoi') || String(raw).includes('dds'));
      if (isBudg) budgewoi.push(e);
      else if (raw) amcal.push(e);
      else neither.push(e);
    });

    console.log(`\nAmcal employees (explicit amcal_woywoy): ${amcal.length}`);
    console.log(`Budgewoi employees (explicit budgewoi_dds): ${budgewoi.length}`);
    console.log(`Unassigned/Legacy store employees (no explicit pharmacy_id): ${neither.length}`);
    if (neither.length > 0) {
      console.log('Neither names:', neither.map(e => `${e.name} (${e.email || 'no email'})`));
    }
  }

  console.log('\n======================================================');
  console.log('4. INVESTIGATING "ONLY 3 PEOPLE ON"');
  console.log('======================================================');
  // Check who could be the 3 people:
  // Are there only 3 people with a certain role?
  // Are there only 3 owners?
  // Are there only 3 people clocked in?
  // Are there only 3 shifts scheduled today?
  const today = new Date().toISOString().split('T')[0];
  console.log(`Today's date: ${today}`);
  const { data: todayShifts } = await admin.from('brisk_shifts').select('*').eq('date', today);
  console.log(`Shifts scheduled today (${today}): ${todayShifts?.length || 0}`);
  if (todayShifts) {
    todayShifts.forEach(s => console.log(` - Shift: ${s.start_time}-${s.end_time} | role: ${s.role} | emp_id: ${s.employee_id} | notes: ${s.notes}`));
  }

  const { data: activeTimecards } = await admin.from('brisk_timecards').select('*').eq('date', today);
  console.log(`Timecards today (${today}): ${activeTimecards?.length || 0}`);
}

main().catch(console.error);
