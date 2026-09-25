const fetch = require('node-fetch');

async function testFields() {
  const res = await fetch('https://woywoyamcalroster.vercel.app/api/schedule/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-user-email': 'pharmotago@gmail.com', 'x-pharmacy-id': 'amcal_woywoy' },
    body: JSON.stringify({ email: 'pharmotago@gmail.com', pharmacyId: 'amcal_woywoy' })
  });
  const data = await res.json();
  console.log(`Amcal employees from API: ${data.employees.length}`);
  
  data.employees.forEach((emp, i) => {
    console.log(`${i+1}. ${emp.name} | emp.pharmacy_id: ${emp.pharmacy_id} | avail.pharmacy_id: ${emp.availability?.pharmacy_id} | active: ${emp.active}`);
  });
}

testFields().catch(console.error);
