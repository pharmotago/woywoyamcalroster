// scripts/test_live_amcal_email.js
// Tests live email dispatch from Amcal Pharmacy Woy Woy endpoint
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://gcslfkujlfnznedatrsn.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdjc2xma3VqbGZuem5lZGF0cnNuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0OTEwODksImV4cCI6MjA5MjA2NzA4OX0.qCfeYYF2rcqfz_t2-wxLAE0fiosy9C2sbG3BShYVIT0';

const supabase = createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false } });

async function testAmcalEmailDelivery() {
  console.log('--- Testing Live Amcal Pharmacy Woy Woy Email Dispatch ---');

  // 1. Fetch active employees via sync API
  const syncRes = await fetch('https://woywoyamcalroster.vercel.app/api/schedule/sync', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-user-email': 'pharmotago@gmail.com',
      'x-pharmacy-id': 'amcal_woywoy'
    },
    body: JSON.stringify({ email: 'pharmotago@gmail.com', pharmacyId: 'amcal_woywoy' })
  });
  const syncData = await syncRes.json();
  const employees = (syncData.employees || []).filter(e => e.active !== false && e.email && e.email.includes('@'));

  if (employees.length === 0) {
    console.error('Could not find active employees via sync API:', syncData);
    process.exit(1);
  }

  const targetEmp = employees.find(e => e.email.includes('pharmotago')) || employees[0];
  console.log(`Target Employee: ${targetEmp.name} (ID: ${targetEmp.id}, Email: ${targetEmp.email})`);

  // 2. Dispatch test email to Peter Kim via production endpoint
  const res = await fetch('https://woywoyamcalroster.vercel.app/api/schedule/email', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-user-email': 'pharmotago@gmail.com'
    },
    body: JSON.stringify({
      email: 'pharmotago@gmail.com',
      employeeId: targetEmp.id,
      weekStart: '2026-09-28',
      pharmacyId: 'amcal_woywoy',
      rosterText: 'Monday 28 Sep: 08:30 - 17:00 (Pharmacist)\nTuesday 29 Sep: 08:30 - 17:00 (Pharmacist)\nStore: Amcal Pharmacy Woy Woy (Peninsula Plaza)'
    })
  });

  const status = res.status;
  const data = await res.json().catch(() => ({}));
  console.log(`Response HTTP Status: ${status}`);
  console.log('Response Body:', JSON.stringify(data, null, 2));

  if (status === 200 && data.success) {
    console.log('✅ Amcal Woy Woy live email delivery test PASSED!');
  } else {
    console.error('❌ Amcal Woy Woy live email delivery test FAILED!');
    process.exit(1);
  }
}

testAmcalEmailDelivery().catch(err => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
