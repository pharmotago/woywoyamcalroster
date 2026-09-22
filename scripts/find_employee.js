async function testSync() {
  console.log('======================================================');
  console.log(' 🛡️  STORE ISOLATION AUTOMATED TEST SUITE');
  console.log('======================================================');

  // Test 1: Georgi Peek querying Budgewoi DDS
  console.log('\n[Test 1] Georgi Peek querying Budgewoi DDS:');
  const res1 = await fetch('https://budgewoiddsroster.vercel.app/api/schedule/sync', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-user-email': 'georgi.peek6@gmail.com',
      'x-pharmacy-id': 'budgewoi_dds'
    },
    body: JSON.stringify({ email: 'georgi.peek6@gmail.com', pharmacyId: 'budgewoi_dds' })
  });
  const data1 = await res1.json();
  console.log('  Status:', res1.status, '| Success:', data1.success);
  console.log('  Employees returned count:', (data1.employees || []).length);
  if (data1.employees) {
    data1.employees.forEach(e => console.log(`   - ${e.name} (${e.email}) | ${e.role}`));
  }
  if (data1.error) console.log('  Error:', data1.error);
  console.log('  Settings returned:', data1.settings);
  console.log('  Shifts returned count:', (data1.shifts || []).length);
  if (data1.shifts && data1.shifts.length > 0) {
    console.log('  Shifts sample:', data1.shifts.slice(0, 3));
  }

  // Test 2: Katherine Nguyen querying Budgewoi DDS
  console.log('\n[Test 2] Katherine Nguyen querying Budgewoi DDS (Multi-store owner):');
  const res2 = await fetch('https://budgewoiddsroster.vercel.app/api/schedule/sync', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-user-email': 'nguyek@gmail.com',
      'x-pharmacy-id': 'budgewoi_dds'
    },
    body: JSON.stringify({ email: 'nguyek@gmail.com', pharmacyId: 'budgewoi_dds' })
  });
  const data2 = await res2.json();
  console.log('  Status:', res2.status, '| Success:', data2.success);
  console.log('  Employees returned count:', (data2.employees || []).length);
  if (data2.employees) {
    data2.employees.forEach(e => console.log(`   - ${e.name} (${e.email}) | ${e.role}`));
  }

  // Test 3: Peter Kim querying Amcal Pharmacy Woy Woy
  console.log('\n[Test 3] Peter Kim querying Amcal Woy Woy:');
  const res3 = await fetch('https://woywoyamcalroster.vercel.app/api/schedule/sync', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-user-email': 'pharmotago@gmail.com',
      'x-pharmacy-id': 'amcal_woywoy'
    },
    body: JSON.stringify({ email: 'pharmotago@gmail.com', pharmacyId: 'amcal_woywoy' })
  });
  const data3 = await res3.json();
  console.log('  Status:', res3.status, '| Success:', data3.success);
  console.log('  Employees returned count:', (data3.employees || []).length);
  const mia = (data3.employees || []).filter(e => e.name.toLowerCase().includes('mia'));
  console.log('  Matching Mia:', mia);
  if (mia.length > 0) {
    const miaId = mia[0].id;
    const miaShifts = (data3.shifts || []).filter(s => (s.employeeId || s.employee_id) === miaId);
    console.log(`  Mia Staniland total shifts: ${miaShifts.length}`);
    const tuesShifts = miaShifts.filter(s => s.date === '2026-09-22' || s.date === '2026-09-29');
    console.log('  Mia Tuesday shifts:', JSON.stringify(tuesShifts, null, 2));
  }

  // Test 4: Georgi Peek attempting to query Amcal Woy Woy (Should be 403 Forbidden)
  console.log('\n[Test 4] Georgi Peek attempting unauthorized query to Amcal Woy Woy:');
  const res4 = await fetch('https://woywoyamcalroster.vercel.app/api/schedule/sync', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-user-email': 'georgi.peek6@gmail.com',
      'x-pharmacy-id': 'amcal_woywoy'
    },
    body: JSON.stringify({ email: 'georgi.peek6@gmail.com', pharmacyId: 'amcal_woywoy' })
  });
  const data4 = await res4.json();
  console.log('  Status (expect 403):', res4.status);
  console.log('  Response message:', data4.error || 'UNEXPECTED_SUCCESS');

  // Test 5: Amcal staff (Xander) attempting to query Budgewoi DDS (Should be 403 Forbidden)
  console.log('\n[Test 5] Amcal staff attempting unauthorized query to Budgewoi DDS:');
  const res5 = await fetch('https://budgewoiddsroster.vercel.app/api/schedule/sync', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-user-email': 'xander.ireland@amcal.internal',
      'x-pharmacy-id': 'budgewoi_dds'
    },
    body: JSON.stringify({ email: 'xander.ireland@amcal.internal', pharmacyId: 'budgewoi_dds' })
  });
  const data5 = await res5.json();
  console.log('  Status (expect 403):', res5.status);
  console.log('  Response message:', data5.error || 'UNEXPECTED_SUCCESS');

  console.log('\n======================================================');
}

testSync().catch(console.error);

