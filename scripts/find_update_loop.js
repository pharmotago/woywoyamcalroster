const fs = require('fs');
const path = require('path');

console.log('--- SCANNING FOR 10.5.10 ACROSS REPO ---');

function scanDir(dir) {
  const files = fs.readdirSync(dir);
  for (const f of files) {
    if (f === 'node_modules' || f === '.git' || f === 'dist' || f.endsWith('.png') || f.endsWith('.jpg') || f.endsWith('.pdf')) continue;
    const full = path.join(dir, f);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      scanDir(full);
    } else if (stat.isFile() && (f.endsWith('.js') || f.endsWith('.html') || f.endsWith('.json') || f.endsWith('.ts') || f.endsWith('.css'))) {
      const txt = fs.readFileSync(full, 'utf8');
      if (txt.includes('10.5.10')) {
        console.log(`Found in: ${full}`);
        const lines = txt.split('\n');
        lines.forEach((l, idx) => {
          if (l.includes('10.5.10')) {
            console.log(`  Line ${idx+1}: ${l.trim()}`);
          }
        });
      }
    }
  }
}

scanDir('.');
