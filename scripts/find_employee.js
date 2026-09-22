async function testVariations() {
  const tests = [
    {
      label: 'With pharmacy_id: budgewoi_dds',
      payload: {
        entity: 'employee',
        action: 'create',
        callerEmail: 'pharmotago@gmail.com',
        pharmacyId: 'budgewoi_dds',
        employee: {
          name: 'Georgi Peek',
          email: 'georgi.peek6@test1.com',
          role: 'Dispensary Manager',
          pharmacy_id: 'budgewoi_dds'
        }
      }
    },
    {
      label: 'With pharmacy_id: amcal_woywoy',
      payload: {
        entity: 'employee',
        action: 'create',
        callerEmail: 'pharmotago@gmail.com',
        pharmacyId: 'amcal_woywoy',
        employee: {
          name: 'Georgi Peek',
          email: 'georgi.peek6@test2.com',
          role: 'Dispensary Manager',
          pharmacy_id: 'amcal_woywoy'
        }
      }
    },
    {
      label: 'Minimal payload (no pharmacy_id)',
      payload: {
        entity: 'employee',
        action: 'create',
        callerEmail: 'pharmotago@gmail.com',
        employee: {
          name: 'Georgi Peek',
          email: 'georgi.peek6@test3.com',
          role: 'Dispensary Manager'
        }
      }
    }
  ];

  for (const t of tests) {
    console.log(`\n=== Testing: ${t.label} ===`);
    const res = await fetch('https://budgewoiddsroster.vercel.app/api/schedule/mutate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-email': 'pharmotago@gmail.com'
      },
      body: JSON.stringify(t.payload)
    });
    console.log('Status:', res.status);
    const text = await res.text();
    console.log('Response:', text);
  }
}

testVariations().catch(console.error);
