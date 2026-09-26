const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

let env = {};
try {
  const envContent = fs.readFileSync('.env.prod.local', 'utf8');
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
} catch (e) {
  console.log('No .env.prod.local, using process.env');
}

const supabaseUrl = env.SUPABASE_URL || process.env.SUPABASE_URL || 'https://gcslfkujlfnznedatrsn.supabase.co';
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = env.SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdjc2xma3VqbGZuem5lZGF0cnNuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0OTEwODksImV4cCI6MjA5MjA2NzA4OX0.qCfeYYF2rcqfz_t2-wxLAE0fiosy9C2sbG3BShYVIT0';

const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
const anon = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });

async function diagnose() {
  console.log('=== 1. Inspect brisk_settings ===');
  const { data: settingsRows, error: sErr } = await admin.from('brisk_settings').select('*');
  if (sErr) console.error('Error fetching brisk_settings:', sErr);
  else {
    console.log('Found', settingsRows?.length, 'settings rows:');
    settingsRows?.forEach(r => {
      console.log('Row ID:', r.id, '| Company:', r.company_name);
      console.log('Trading Hours Keys:', Object.keys(r.trading_hours || {}));
      console.log('Trading Hours:', JSON.stringify(r.trading_hours, null, 2));
    });
  }

  console.log('\n=== 2. Test Anon Client Upsert to brisk_settings ===');
  const testPayload = {
    id: 'settings_budgewoi_dds',
    company_name: 'Budgewoi Discount Drug Stores Rosters',
    trading_hours: {
      "1": { "open": "08:30", "close": "18:00", "closed": false },
      "2": { "open": "08:30", "close": "18:00", "closed": false },
      "3": { "open": "08:30", "close": "18:00", "closed": false },
      "4": { "open": "08:30", "close": "18:00", "closed": false },
      "5": { "open": "08:30", "close": "18:00", "closed": false },
      "6": { "open": "08:30", "close": "13:00", "closed": false },
      "0": { "open": "00:00", "close": "00:00", "closed": true }
    }
  };
  const { data: anonData, error: anonErr } = await anon.from('brisk_settings').upsert(testPayload).select();
  console.log('Anon upsert result:', { error: anonErr?.message, dataCount: anonData?.length });

  console.log('\n=== 3. Inspect All brisk_employees ===');
  const { data: emps, error: empErr } = await admin.from('brisk_employees').select('*');
  if (empErr) console.error('Error fetching employees:', empErr);
  else {
    console.log('Total employees in DB:', emps?.length);
    const woyStaff = [];
    const budgStaff = [];
    const unassigned = [];
    emps?.forEach(e => {
      const pId = e.pharmacy_id || e.availability?.pharmacy_id || e.availability?.pharmacyId;
      if (!pId) unassigned.push(e);
      else if (pId.includes('budgewoi') || pId.includes('dds')) budgStaff.push(e);
      else woyStaff.push(e);
    });
    console.log(`Woy Woy staff count: ${woyStaff.length}`);
    console.log(`Budgewoi staff count: ${budgStaff.length}`);
    console.log(`Unassigned/No pharmacyId count: ${unassigned.length}`);
    if (unassigned.length > 0) {
      console.log('Unassigned staff:', unassigned.map(e => ({ id: e.id, name: e.name, email: e.email, active: e.active })));
    }
    console.log('\nWoy Woy staff sample (first 10):');
    woyStaff.slice(0, 10).forEach(e => console.log(` - [${e.active ? 'ACTIVE' : 'INACTIVE'}] ${e.name} (${e.role}) - ID: ${e.id} - pharmacy_id: ${e.pharmacy_id}`));
    console.log('\nBudgewoi staff:');
    budgStaff.forEach(e => console.log(` - [${e.active ? 'ACTIVE' : 'INACTIVE'}] ${e.name} (${e.role}) - ID: ${e.id} - pharmacy_id: ${e.pharmacy_id}`));
  }
}

diagnose().catch(console.error);
