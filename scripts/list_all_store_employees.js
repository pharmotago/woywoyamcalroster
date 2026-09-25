async function check() {
  const resAmcal = await fetch('https://woywoyamcalroster.vercel.app/api/schedule/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-user-email': 'pharmotago@gmail.com', 'x-pharmacy-id': 'amcal_woywoy' },
    body: JSON.stringify({ email: 'pharmotago@gmail.com', pharmacyId: 'amcal_woywoy' })
  });
  const dataAmcal = await resAmcal.json();

  const resBudg = await fetch('https://woywoyamcalroster.vercel.app/api/schedule/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-user-email': 'pharmotago@gmail.com', 'x-pharmacy-id': 'budgewoi_dds' },
    body: JSON.stringify({ email: 'pharmotago@gmail.com', pharmacyId: 'budgewoi_dds' })
  });
  const dataBudg = await resBudg.json();

  console.log('=== AMCAL WOY WOY EMPLOYEES (' + dataAmcal.employees.length + ') ===');
  dataAmcal.employees.forEach((e, i) => {
    console.log(`${i+1}. ${e.name} | Role: ${e.role} | Active: ${e.active} | Dept: ${e.department || e.availability?.department || 'none'} | Email: ${e.email}`);
  });

  console.log('\n=== BUDGEWOI DDS EMPLOYEES (' + dataBudg.employees.length + ') ===');
  dataBudg.employees.forEach((e, i) => {
    console.log(`${i+1}. ${e.name} | Role: ${e.role} | Active: ${e.active} | Dept: ${e.department || e.availability?.department || 'none'} | Email: ${e.email}`);
  });
}

check().catch(console.error);
