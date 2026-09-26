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
  console.log('Employees 1 to 17:');
  emps.slice(0, 17).forEach((e, i) => {
    console.log(`${i + 1}. [${e.active ? 'ACTIVE' : 'INACTIVE'}] ${e.name} | Role: ${e.role} | Position: ${e.position || 'None'} | Dept: ${e.department || e.availability?.department || 'None'} | ID: ${e.id} | Email: ${e.email || 'None'}`);
  });
}

run().catch(console.error);
