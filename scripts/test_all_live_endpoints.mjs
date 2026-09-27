async function check() {
  const base = 'https://woywoyamcalroster.vercel.app';
  console.log('Testing endpoints on:', base);
  
  // 1. Static files
  for (const path of ['/version.json', '/sw.js', '/index.html']) {
    try {
      const res = await fetch(base + path);
      const text = await res.text();
      console.log(`GET  ${path.padEnd(25)} => Status: ${res.status}, Type: ${res.headers.get('content-type')}, Snippet: ${text.slice(0, 100).replace(/\n/g, ' ')}`);
    } catch (e) {
      console.log(`GET  ${path.padEnd(25)} => Fetch Error: ${e.message}`);
    }
  }

  // 2. API Endpoints
  const apiPaths = [
    '/api/schedule/sync',
    '/api/schedule/mutate',
    '/api/schedule/auth/login',
    '/api/schedule/auth/invite',
    '/api/mcp'
  ];

  for (const path of apiPaths) {
    try {
      const res = await fetch(base + path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pharmacyId: 'amcal_woywoy' })
      });
      const text = await res.text();
      console.log(`POST ${path.padEnd(25)} => Status: ${res.status}, Type: ${res.headers.get('content-type')}, Body: ${text.slice(0, 150).replace(/\n/g, ' ')}`);
    } catch (e) {
      console.log(`POST ${path.padEnd(25)} => Fetch Error: ${e.message}`);
    }
  }
}

check();

