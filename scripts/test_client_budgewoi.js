async function checkBudg() {
  const resB = await fetch('https://woywoyamcalroster.vercel.app/api/schedule/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-user-email': 'pharmotago@gmail.com', 'x-pharmacy-id': 'budgewoi_dds' },
    body: JSON.stringify({ email: 'pharmotago@gmail.com', pharmacyId: 'budgewoi_dds' })
  });
  const dataB = await resB.json();
  console.log(`Budgewoi employees returned from sync API: ${dataB.employees.length}`);

  // Now simulate mapEmployeeFromDb on each employee
  function mapEmployeeFromDb(emp) {
    if (!emp) return null;
    const avail = emp.availability || {};
    return {
      id: emp.id,
      name: emp.name,
      email: emp.email,
      role: emp.role,
      department: emp.department || avail.department || null,
      phone: emp.phone,
      hourlyRate: (!isNaN(parseFloat(emp.hourly_rate)) && emp.hourly_rate != null) ? parseFloat(emp.hourly_rate) : 0,
      maxHours: parseInt(emp.max_hours || 38) || 38,
      awardLevel: emp.award_level || avail.award_level || emp.awardLevel || 'custom',
      employmentType: emp.employment_type || avail.employment_type || emp.employmentType || 'permanent',
      dob: avail.dob || emp.dob || null,
      certificates: Array.isArray(avail.certificates) ? avail.certificates : (Array.isArray(emp.certificates) ? emp.certificates : []),
      availability: avail,
      active: (emp.active !== undefined && emp.active !== null) ? !!emp.active : true,
      pharmacyId: emp.pharmacy_id || avail.pharmacy_id || avail.pharmacyId || 'amcal_woywoy'
    };
  }

  const mapped = dataB.employees.map(mapEmployeeFromDb);

  // Now test js/app.js line 1484:
  // const raw = e.pharmacy_id || e.availability?.pharmacy_id || e.availability?.pharmacyId;
  // const pId = raw && (String(raw).includes('budgewoi') || String(raw).includes('dds')) ? 'budgewoi_dds' : 'amcal_woywoy';
  // return pId === activeTenantId;

  console.log('\n--- Testing with activeTenantId = "budgewoi_dds" ---');
  mapped.forEach((e, idx) => {
    const raw = e.pharmacy_id || e.availability?.pharmacy_id || e.availability?.pharmacyId;
    const isBudg = raw && (String(raw).includes('budgewoi') || String(raw).includes('dds'));
    const pId = isBudg ? 'budgewoi_dds' : 'amcal_woywoy';
    const matches = pId === 'budgewoi_dds';
    console.log(`${idx+1}. ${e.name}: raw=${raw} -> pId=${pId} -> MATCHES BUDGEWOI: ${matches}`);
  });

  const matchingCount = mapped.filter(e => {
    const raw = e.pharmacy_id || e.availability?.pharmacy_id || e.availability?.pharmacyId;
    const pId = raw && (String(raw).includes('budgewoi') || String(raw).includes('dds')) ? 'budgewoi_dds' : 'amcal_woywoy';
    return pId === 'budgewoi_dds';
  }).length;

  console.log(`\nTOTAL MATCHING BUDGEWOI IN CLIENT APP: ${matchingCount} of ${mapped.length}`);
}

checkBudg().catch(console.error);
