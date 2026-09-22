async function testCreateGeorgi() {
  console.log('\n--- 1. Creating Georgi Peek (Dispensary Manager) for Budgewoi DDS ---');
  const payload = {
    entity: 'employee',
    action: 'create',
    callerEmail: 'nguyek@gmail.com',
    pharmacyId: 'budgewoi_dds',
    employee: {
      name: 'Georgi Peek',
      email: 'georgi.peek6@gmail.com',
      role: 'Dispensary Manager',
      phone: '0400 000 000',
      max_hours: 38,
      hourly_rate: 28.45,
      employment_type: 'permanent',
      award_level: 'custom',
      pharmacy_id: 'budgewoi_dds',
      availability: {
        0: null,
        1: { start: '09:00', end: '17:00' },
        2: null, 3: null, 4: null, 5: null, 6: null
      }
    }
  };

  const res = await fetch('https://budgewoiddsroster.vercel.app/api/schedule/mutate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-user-email': 'nguyek@gmail.com',
      'x-pharmacy-id': 'budgewoi_dds'
    },
    body: JSON.stringify(payload)
  });

  console.log('Mutate Status:', res.status, res.statusText);
  const text = await res.text();
  console.log('Mutate Response:', text);

  console.log('\n--- 2. Verifying Budgewoi DDS sync ---');
  const budgeRes = await fetch('https://budgewoiddsroster.vercel.app/api/schedule/sync', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-pharmacy-id': 'budgewoi_dds'
    },
    body: JSON.stringify({ pharmacyId: 'budgewoi_dds' })
  });
  const bData = await budgeRes.json();
  const bEmps = bData.employees || [];
  console.log(`Total Budgewoi Employees: ${bEmps.length}`);
  const foundInBudgewoi = bEmps.find(e => e.name === 'Georgi Peek');
  console.log('Found Georgi in Budgewoi:', foundInBudgewoi ? `YES (ID: ${foundInBudgewoi.id}, Role: ${foundInBudgewoi.role})` : 'NO');

  console.log('\n--- 3. Verifying Amcal Woy Woy store isolation (should NOT contain Georgi) ---');
  const amcalRes = await fetch('https://budgewoiddsroster.vercel.app/api/schedule/sync', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-pharmacy-id': 'amcal_woywoy'
    },
    body: JSON.stringify({ pharmacyId: 'amcal_woywoy' })
  });
  const aData = await amcalRes.json();
  const aEmps = aData.employees || [];
  console.log(`Total Amcal Employees: ${aEmps.length}`);
  const foundInAmcal = aEmps.find(e => e.name === 'Georgi Peek');
  console.log('Found Georgi in Amcal:', foundInAmcal ? 'LEAKAGE DETECTED!' : 'NO (Perfect store isolation!)');
}

testCreateGeorgi().catch(console.error);
