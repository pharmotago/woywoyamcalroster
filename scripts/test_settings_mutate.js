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

async function testSettingsMutate() {
  console.log('Testing settings mutate for Budgewoi...');
  const res = await postApi('/api/schedule/mutate', {
    'X-User-Email': 'georgi.peek6@gmail.com',
    'x-pharmacy-id': 'budgewoi_dds'
  }, {
    entity: 'settings',
    action: 'save',
    callerEmail: 'georgi.peek6@gmail.com',
    pharmacyId: 'budgewoi_dds',
    settings: {
      trading_hours: {
        "1": { "open": "08:00", "close": "18:00", "closed": false }
      }
    }
  });
  console.log('Settings Mutate API Response:', res);
}

testSettingsMutate().catch(console.error);
