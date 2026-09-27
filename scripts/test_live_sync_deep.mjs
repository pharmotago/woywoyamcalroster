async function testLiveSync() {
  const url = 'https://woywoyamcalroster.vercel.app/api/schedule/sync';
  console.log('Fetching live sync from:', url);
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pharmacyId: 'amcal_woywoy' })
  });

  if (!res.ok) {
    console.error('Failed with status:', res.status);
    const text = await res.text();
    console.error('Body:', text);
    return;
  }

  const data = await res.json();
  console.log('Success:', data.success);
  console.log('Pharmacy ID:', data.pharmacyId);
  console.log('Total Employees:', data.employees ? data.employees.length : 0);
  console.log('Total Shifts:', data.shifts ? data.shifts.length : 0);

  if (data.shifts) {
    const sep28Shifts = data.shifts.filter(s => {
      const d = s.date || '';
      return d >= '2026-09-28' && d <= '2026-10-04';
    });
    console.log('Shifts for Week 28 Sep - 04 Oct 2026:', sep28Shifts.length);
  }

  if (data.employees) {
    const activeStaff = data.employees.filter(e => e.active !== false && !e.archived);
    console.log('Active Employees:', activeStaff.length);
    console.log('Sample Staff:');
    activeStaff.slice(0, 10).forEach(e => {
      console.log(`  - ${e.name} (${e.role || 'Staff'}, Dept: ${e.department || 'General'})`);
    });
  }

  console.log('Settings:', data.settings ? data.settings.company_name : 'None');
}

testLiveSync();
