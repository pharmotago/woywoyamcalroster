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
    'x-pharmacy-id': 'budgewoi_dds'
  }, { email: 'pharmotago@gmail.com', pharmacyId: 'budgewoi_dds' });

  const georgi = (sync.employees || []).find(e => (e.email || '').toLowerCase().includes('georgi'));
  console.log('Georgi Peek full record:', JSON.stringify(georgi, null, 2));
}

run().catch(console.error);
