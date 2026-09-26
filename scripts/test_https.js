const https = require('https');

https.get('https://woywoyamcalroster.vercel.app/version.json', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log('HTTPS Module Result:', data));
}).on('error', err => console.error('HTTPS Error:', err.message));
