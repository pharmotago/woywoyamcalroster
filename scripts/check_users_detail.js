const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envContent = fs.readFileSync('.env.prod.local', 'utf8');
let supabaseUrl = 'https://gcslfkujlfnznedatrsn.supabase.co';
let serviceKey = '';

envContent.split('\n').forEach(line => {
  const clean = line.trim();
  if (clean.startsWith('SUPABASE_SERVICE_ROLE_KEY=')) {
    serviceKey = clean.split('=')[1].replace(/^["']|["']$/g, '').trim();
  }
  if (clean.startsWith('SUPABASE_URL=')) {
    const val = clean.split('=')[1].replace(/^["']|["']$/g, '').trim();
    if (val) supabaseUrl = val;
  }
});

const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

async function check() {
  const { data: users } = await admin.from('brisk_users').select('*');
  console.log(`=== BRISK_USERS (${users.length}) ===`);
  users.forEach(u => console.log(` - ${u.name} | ${u.email} | Role: ${u.role} | EmpId: ${u.employee_id}`));

  const { data: emps } = await admin.from('brisk_employees').select('id, name, email, role, active');
  console.log(`\n=== BRISK_EMPLOYEES TOTAL: ${emps.length} ===`);
  
  const { data: settings } = await admin.from('brisk_settings').select('*');
  console.log(`\n=== BRISK_SETTINGS (${settings.length}) ===`);
  settings.forEach(s => {
    console.log(`ID: ${s.id}, Company: ${s.company_name}`);
    console.log('Employee order:', s.trading_hours?._employee_order || s.trading_hours?.employeeOrder || 'none');
  });
}

check().catch(console.error);
