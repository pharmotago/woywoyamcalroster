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

async function testMutate() {
  console.log('Testing mutate as Georgi Peek...');
  const res = await postApi('/api/schedule/mutate', {
    'X-User-Email': 'georgi.peek6@gmail.com',
    'x-pharmacy-id': 'budgewoi_dds'
  }, {
    entity: 'shift',
    action: 'update',
    callerEmail: 'georgi.peek6@gmail.com',
    pharmacyId: 'budgewoi_dds',
    shift: {
      id: '00000000-0000-0000-0000-000000000000', // dummy ID
      notes: 'test'
    }
  });
  console.log('Mutate API Response for Georgi:', res);
}

testMutate().catch(console.error);
