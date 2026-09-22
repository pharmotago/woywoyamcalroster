const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const envContent = fs.readFileSync('.env.prod.local', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const clean = line.trim();
  if (!clean || clean.startsWith('#')) return;
  const idx = clean.indexOf('=');
  if (idx !== -1) {
    const key = clean.substring(0, idx).trim();
    let val = clean.substring(idx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.substring(1, val.length - 1);
    }
    env[key] = val;
  }
});

const supabaseUrl = env.SUPABASE_URL || 'https://gcslfkujlfnznedatrsn.supabase.co';
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY;

console.log('Supabase URL:', supabaseUrl);
console.log('Has Service Key:', !!supabaseKey);

if (!supabaseKey) {
  console.error('No service role key found in .env.prod.local');
  process.exit(1);
}

const admin = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});

async function run() {
  // 1. Check pharmacies table
  console.log('\n--- 1. Query public.pharmacies ---');
  const { data: pharmData, error: pharmErr } = await admin.from('pharmacies').select('*');
  if (pharmErr) {
    console.error('Error querying pharmacies:', pharmErr);
  } else {
    console.log('Pharmacies found:', pharmData);
  }

  // 2. Query columns/sample of brisk_employees
  console.log('\n--- 2. Sample from brisk_employees ---');
  const { data: empSample, error: empErr } = await admin.from('brisk_employees').select('*').limit(1);
  if (empErr) {
    console.error('Error querying brisk_employees:', empErr);
  } else {
    console.log('Sample employee keys:', Object.keys(empSample[0] || {}));
    console.log('Sample employee:', empSample[0]);
  }

  // 3. Test exact insert for Georgi Peek
  console.log('\n--- 3. Test insert Georgi Peek (dry run / test) ---');
  const testObj = {
    name: 'Georgi Peek',
    email: 'georgi.peek6@test.com',
    role: 'Dispensary Manager',
    phone: '0400 000 000',
    hourly_rate: 28.45,
    max_hours: 38,
    availability: {
      0: null,
      1: { start: '09:00', end: '17:00' },
      2: null, 3: null, 4: null, 5: null, 6: null
    },
    active: true,
    employment_type: 'permanent',
    award_level: 'custom',
    pharmacy_id: 'budgewoi_dds'
  };

  const { data: insertData, error: insertErr } = await admin
    .from('brisk_employees')
    .insert([testObj])
    .select()
    .maybeSingle();

  if (insertErr) {
    console.error('❌ Insert Error Details:', JSON.stringify(insertErr, null, 2));
  } else {
    console.log('✅ Insert Success! ID:', insertData.id);
    // Delete test record
    await admin.from('brisk_employees').delete().eq('id', insertData.id);
    console.log('Cleaned up test record.');
  }
}

run().catch(console.error);
