const https = require('https');

function postApi(path, headers, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = https.request({
      hostname: 'woywoyamcalroster.vercel.app',
      port: 443,
      path: path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
        ...headers
      }
    }, res => {
      let resData = '';
      res.on('data', chunk => resData += chunk);
      res.on('end', () => resolve(JSON.parse(resData)));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function run() {
  const sync = await postApi('/api/schedule/sync', {
    'x-user-email': 'pharmotago@gmail.com',
    'x-pharmacy-id': 'amcal_woywoy'
  }, { email: 'pharmotago@gmail.com', pharmacyId: 'amcal_woywoy' });

  const emps = sync.employees || [];
  const shifts = sync.shifts || [];
  const empMap = new Map(emps.map(e => [e.id, e]));

  console.log(`Total Amcal Employees: ${emps.length}`);
  console.log(`Total Amcal Shifts (last 14 days): ${shifts.length}`);

  const unknownShiftEmpIds = new Set();
  const shiftsByEmp = new Map();
  shifts.forEach(s => {
    if (!s.employee_id) return;
    if (!empMap.has(s.employee_id)) {
      unknownShiftEmpIds.add(s.employee_id);
    } else {
      shiftsByEmp.set(s.employee_id, (shiftsByEmp.get(s.employee_id) || 0) + 1);
    }
  });

  console.log('Shifts with unknown employee_id count:', unknownShiftEmpIds.size);
  if (unknownShiftEmpIds.size > 0) {
    console.log('Unknown employee IDs in shifts:', Array.from(unknownShiftEmpIds));
  }

  console.log('\nEmployees with shifts count:', shiftsByEmp.size);
  const empsWithoutShifts = emps.filter(e => !shiftsByEmp.has(e.id));
  console.log('Employees without shifts in window count:', empsWithoutShifts.length);
  empsWithoutShifts.forEach(e => {
    console.log(` - [${e.active ? 'ACTIVE' : 'INACTIVE'}] ${e.name} (${e.role})`);
  });
}

run().catch(console.error);
