const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://gcslfkujlfnznedatrsn.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdjc2xma3VqbGZuem5lZGF0cnNuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0OTEwODksImV4cCI6MjA5MjA2NzA4OX0.qCfeYYF2rcqfz_t2-wxLAE0fiosy9C2sbG3BShYVIT0';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function main() {
  console.log('=== 1. Direct Supabase Query (Anon Key) ===');
  const { data: dbEmployees, error: dbErr } = await supabase.from('brisk_employees').select('*');
  if (dbErr) {
    console.error('Supabase query error:', dbErr);
  } else {
    console.log(`Direct DB employees count: ${dbEmployees.length}`);
  }

  console.log('\n=== 2. Sync API Query for amcal_woywoy ===');
  const resAmcal = await fetch('https://woywoyamcalroster.vercel.app/api/schedule/sync', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-user-email': 'pharmotago@gmail.com',
      'x-pharmacy-id': 'amcal_woywoy'
    },
    body: JSON.stringify({ email: 'pharmotago@gmail.com', pharmacyId: 'amcal_woywoy' })
  });
  const dataAmcal = await resAmcal.json();
  console.log(`Sync amcal_woywoy returned count: ${dataAmcal.employees?.length}`);

  console.log('\n=== 3. Sync API Query for budgewoi_dds ===');
  const resBudg = await fetch('https://woywoyamcalroster.vercel.app/api/schedule/sync', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-user-email': 'pharmotago@gmail.com',
      'x-pharmacy-id': 'budgewoi_dds'
    },
    body: JSON.stringify({ email: 'pharmotago@gmail.com', pharmacyId: 'budgewoi_dds' })
  });
  const dataBudg = await resBudg.json();
  console.log(`Sync budgewoi_dds returned count: ${dataBudg.employees?.length}`);

  console.log('\n=== 4. Inspecting budgewoi_dds employees ===');
  console.log(dataBudg.employees.map(e => `${e.name} (${e.role}) [active: ${e.active}]`));

  console.log('\n=== 5. Simulating renderEmployeesList() logic for both stores ===');
  function simulateRender(employees, activeTenantId, storeName) {
    console.log(`\n--- Simulating for ${storeName} (activeTenantId = ${activeTenantId}) ---`);
    // Step 1: filter in loadDataFromState
    const rawEmployees = employees.filter(e => {
      const raw = e.pharmacy_id || e.availability?.pharmacy_id || e.availability?.pharmacyId;
      const isBudgewoi = raw && (String(raw).includes('budgewoi') || String(raw).includes('dds'));
      const pId = isBudgewoi ? 'budgewoi_dds' : 'amcal_woywoy';
      return pId === activeTenantId;
    });
    console.log(`rawEmployees after tenant filter: ${rawEmployees.length}`);

    // Step 2: getOrderedActiveEmployees(true)
    const orderedActive = rawEmployees.filter(e => {
      if (e.active === false) return false;
      // includeOwners is true for renderEmployeesList(true)
      return true;
    });
    console.log(`orderedActive count: ${orderedActive.length}`);
    console.log(`Rendered employee cards count: ${orderedActive.length}`);
    if (orderedActive.length <= 5) {
      console.log('Employees in this list:', orderedActive.map(e => e.name));
    }
  }

  simulateRender(dataAmcal.employees, 'amcal_woywoy', 'Amcal Woy Woy (when on amcal_woywoy)');
  simulateRender(dataAmcal.employees, 'budgewoi_dds', 'Amcal Woy Woy data with budgewoi_dds tenant');
  simulateRender(dataBudg.employees, 'budgewoi_dds', 'Budgewoi DDS (when on budgewoi_dds)');
  simulateRender(dataBudg.employees, 'amcal_woywoy', 'Budgewoi DDS data with amcal_woywoy tenant');
}

main().catch(console.error);
