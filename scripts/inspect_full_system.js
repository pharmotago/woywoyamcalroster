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
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(resData) });
        } catch (e) {
          resolve({ status: res.statusCode, raw: resData });
        }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function run() {
  console.log('=== 1. SYNC FOR AMCAL WOY WOY ===');
  const woySync = await postApi('/api/schedule/sync', {
    'x-user-email': 'pharmotago@gmail.com',
    'x-pharmacy-id': 'amcal_woywoy'
  }, { email: 'pharmotago@gmail.com', pharmacyId: 'amcal_woywoy' });

  console.log('Amcal Sync Status:', woySync.status);
  const woyEmps = woySync.data?.employees || [];
  console.log('Amcal Employees Count:', woyEmps.length);
  console.log('Amcal Employees Active:', woyEmps.filter(e => e.active !== false).length);
  console.log('Amcal Employees Inactive:', woyEmps.filter(e => e.active === false).length);
  console.log('\n--- Amcal Staff Roster List ---');
  woyEmps.forEach((e, i) => {
    console.log(`${i + 1}. [${e.active ? 'ACTIVE' : 'INACTIVE'}] ${e.name} | Role: ${e.role} | Position: ${e.position || 'None'} | Dept: ${e.department || e.availability?.department || 'None'} | ID: ${e.id} | Email: ${e.email || 'None'}`);
  });

  console.log('\n=== 2. SYNC FOR BUDGEWOI DDS ===');
  const budgSync = await postApi('/api/schedule/sync', {
    'x-user-email': 'pharmotago@gmail.com',
    'x-pharmacy-id': 'budgewoi_dds'
  }, { email: 'pharmotago@gmail.com', pharmacyId: 'budgewoi_dds' });

  console.log('Budgewoi Sync Status:', budgSync.status);
  const budgEmps = budgSync.data?.employees || [];
  console.log('Budgewoi Employees Count:', budgEmps.length);
  console.log('\n--- Budgewoi Staff Roster List ---');
  budgEmps.forEach((e, i) => {
    console.log(`${i + 1}. [${e.active ? 'ACTIVE' : 'INACTIVE'}] ${e.name} | Role: ${e.role} | Position: ${e.position || 'None'} | Dept: ${e.department || e.availability?.department || 'None'} | ID: ${e.id} | Email: ${e.email || 'None'}`);
  });

  console.log('\n=== 3. TRADING HOURS IN SETTINGS ===');
  console.log('Amcal Trading Hours:', JSON.stringify(woySync.data?.settings?.trading_hours, null, 2));
  console.log('Budgewoi Trading Hours:', JSON.stringify(budgSync.data?.settings?.trading_hours, null, 2));
}

run().catch(console.error);
