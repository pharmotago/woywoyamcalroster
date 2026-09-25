async function checkToday() {
  const res = await fetch('https://woywoyamcalroster.vercel.app/api/schedule/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-user-email': 'pharmotago@gmail.com', 'x-pharmacy-id': 'amcal_woywoy' },
    body: JSON.stringify({ email: 'pharmotago@gmail.com', pharmacyId: 'amcal_woywoy' })
  });
  const data = await res.json();
  const today = '2026-09-25'; // Friday today
  const shiftsToday = data.shifts.filter(s => s.date === today);
  console.log(`Shifts on ${today} (Amcal): ${shiftsToday.length}`);
  shiftsToday.forEach(s => {
    const emp = data.employees.find(e => e.id === s.employee_id || e.id === s.employeeId);
    console.log(` - ${emp?.name || 'Unassigned'} | ${s.start_time || s.startTime} - ${s.end_time || s.endTime} | Role: ${s.role}`);
  });

  const resB = await fetch('https://woywoyamcalroster.vercel.app/api/schedule/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-user-email': 'pharmotago@gmail.com', 'x-pharmacy-id': 'budgewoi_dds' },
    body: JSON.stringify({ email: 'pharmotago@gmail.com', pharmacyId: 'budgewoi_dds' })
  });
  const dataB = await resB.json();
  const shiftsTodayB = dataB.shifts.filter(s => s.date === today);
  console.log(`\nShifts on ${today} (Budgewoi): ${shiftsTodayB.length}`);
  shiftsTodayB.forEach(s => {
    const emp = dataB.employees.find(e => e.id === s.employee_id || e.id === s.employeeId);
    console.log(` - ${emp?.name || 'Unassigned'} | ${s.start_time || s.startTime} - ${s.end_time || s.endTime} | Role: ${s.role}`);
  });
}

checkToday().catch(console.error);
