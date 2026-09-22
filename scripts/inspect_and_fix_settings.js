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
  console.warn('Could not read .env.prod.local:', e.message);
}

console.log('Parsed env keys:', Object.keys(env));
const supabaseUrl = env.SUPABASE_URL || process.env.SUPABASE_URL || 'https://gcslfkujlfnznedatrsn.supabase.co';
const supabaseKey = (env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

if (!supabaseKey) {
  console.error('No service role key found.');
  process.exit(1);
}

const admin = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});

async function run() {
  console.log('Querying current brisk_settings...');
  const { data: rows, error: qErr } = await admin.from('brisk_settings').select('*');
  if (qErr) {
    console.error('Error querying brisk_settings:', qErr);
    return;
  }
  console.log('Found rows:', JSON.stringify(rows, null, 2));

  // Amcal genuine trading hours: Mon-Fri 08:00-20:00, Sat-Sun 08:30-17:00
  const amcalTradingHours = {
    "1": { "open": "08:00", "close": "20:00", "closed": false },
    "2": { "open": "08:00", "close": "20:00", "closed": false },
    "3": { "open": "08:00", "close": "20:00", "closed": false },
    "4": { "open": "08:00", "close": "20:00", "closed": false },
    "5": { "open": "08:00", "close": "20:00", "closed": false },
    "6": { "open": "08:30", "close": "17:00", "closed": false },
    "0": { "open": "08:30", "close": "17:00", "closed": false }
  };

  // Preserve _employee_order if present
  const globalRow = rows.find(r => r.id === 'global_settings') || {};
  const existingTh = globalRow.trading_hours || {};
  if (existingTh._employee_order) amcalTradingHours._employee_order = existingTh._employee_order;
  if (existingTh._sales_targets) amcalTradingHours._sales_targets = existingTh._sales_targets;
  if (existingTh._actual_pos_sales) amcalTradingHours._actual_pos_sales = existingTh._actual_pos_sales;

  console.log('\nRestoring Amcal Pharmacy Woy Woy global_settings...');
  const { error: upErr } = await admin.from('brisk_settings').upsert({
    id: 'global_settings',
    company_name: 'Amcal Pharmacy Woy Woy Rosters',
    trading_hours: amcalTradingHours
  });
  if (upErr) {
    console.error('Error restoring global_settings:', upErr);
  } else {
    console.log('✅ Successfully restored global_settings for Amcal Pharmacy Woy Woy!');
  }

  // Also check if we can insert/upsert a separate row for Budgewoi DDS
  const budgewoiTradingHours = {
    "1": { "open": "08:30", "close": "18:00", "closed": false },
    "2": { "open": "08:30", "close": "18:00", "closed": false },
    "3": { "open": "08:30", "close": "18:00", "closed": false },
    "4": { "open": "08:30", "close": "18:00", "closed": false },
    "5": { "open": "08:30", "close": "18:00", "closed": false },
    "6": { "open": "08:30", "close": "13:00", "closed": false },
    "0": { "open": "00:00", "close": "00:00", "closed": true }
  };
  const { error: bErr } = await admin.from('brisk_settings').upsert({
    id: 'settings_budgewoi_dds',
    company_name: 'Budgewoi Discount Drug Stores Rosters',
    trading_hours: budgewoiTradingHours
  });
  if (bErr) {
    console.log('Note: settings_budgewoi_dds insert result:', bErr.message);
  } else {
    console.log('✅ Successfully inserted settings_budgewoi_dds as dedicated store row!');
  }

  const { data: updatedRows } = await admin.from('brisk_settings').select('*');
  console.log('\nFinal brisk_settings rows:', JSON.stringify(updatedRows, null, 2));
}

run().catch(console.error);
