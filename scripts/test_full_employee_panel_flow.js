const fetch = require('node-fetch');

async function simulate() {
  console.log('=== SIMULATING FULL EMPLOYEE PANEL FLOW FOR PETER KIM ===');
  
  // 1. Sync for Amcal
  const resAmcal = await fetch('https://woywoyamcalroster.vercel.app/api/schedule/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-user-email': 'pharmotago@gmail.com', 'x-pharmacy-id': 'amcal_woywoy' },
    body: JSON.stringify({ email: 'pharmotago@gmail.com', pharmacyId: 'amcal_woywoy' })
  });
  const dataAmcal = await resAmcal.json();
  console.log(`1. Server returned for Amcal: ${dataAmcal.employees?.length} employees`);

  // Map employees as database.js does
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

  const _employeesAmcal = dataAmcal.employees.map(mapEmployeeFromDb).filter(Boolean);

  // Now test loadDataFromState with activeTenantId = 'amcal_woywoy'
  function testLoadData(activeTenantId, allRawEmployees) {
    const rawEmployees = allRawEmployees.filter(e => {
      const raw = e.pharmacy_id || e.availability?.pharmacy_id || e.availability?.pharmacyId;
      const pId = raw && (String(raw).includes('budgewoi') || String(raw).includes('dds')) ? 'budgewoi_dds' : 'amcal_woywoy';
      return pId === activeTenantId;
    });

    const isOwnerOrPeter = true;
    const employees = rawEmployees;

    // getOrderedActiveEmployees(true)
    const customOrder = [];
    const orderedActive = employees.filter(e => {
      if (e.active === false) return false;
      return true;
    }).sort((a, b) => a.name.localeCompare(b.name));

    return { rawCount: rawEmployees.length, activeCount: orderedActive.length, list: orderedActive.map(e => e.name) };
  }

  console.log('\n--- Test 1: Amcal Sync + Amcal Tenant ---');
  const t1 = testLoadData('amcal_woywoy', _employeesAmcal);
  console.log(`Raw: ${t1.rawCount}, Active: ${t1.activeCount}`);

  console.log('\n--- Test 2: Amcal Sync + Budgewoi Tenant ---');
  const t2 = testLoadData('budgewoi_dds', _employeesAmcal);
  console.log(`Raw: ${t2.rawCount}, Active: ${t2.activeCount}`);
  if (t2.activeCount > 0) console.log('Active employees:', t2.list);

  // 2. Sync for Budgewoi
  const resBudg = await fetch('https://woywoyamcalroster.vercel.app/api/schedule/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-user-email': 'pharmotago@gmail.com', 'x-pharmacy-id': 'budgewoi_dds' },
    body: JSON.stringify({ email: 'pharmotago@gmail.com', pharmacyId: 'budgewoi_dds' })
  });
  const dataBudg = await resBudg.json();
  console.log(`\n2. Server returned for Budgewoi: ${dataBudg.employees?.length} employees`);
  const _employeesBudg = dataBudg.employees.map(mapEmployeeFromDb).filter(Boolean);

  console.log('\n--- Test 3: Budgewoi Sync + Budgewoi Tenant ---');
  const t3 = testLoadData('budgewoi_dds', _employeesBudg);
  console.log(`Raw: ${t3.rawCount}, Active: ${t3.activeCount}`);

  console.log('\n--- Test 4: Budgewoi Sync + Amcal Tenant ---');
  const t4 = testLoadData('amcal_woywoy', _employeesBudg);
  console.log(`Raw: ${t4.rawCount}, Active: ${t4.activeCount}`);
}

simulate().catch(console.error);
