const fs = require('fs');
const path = require('path');

function searchDir(dir) {
  const files = fs.readdirSync(dir, { withFileTypes: true });
  for (const f of files) {
    const full = path.join(dir, f.name);
    if (f.isDirectory() && f.name !== 'node_modules' && !f.name.startsWith('.')) {
      searchDir(full);
    } else if (f.isFile() && (f.name.endsWith('.js') || f.name.endsWith('.ts') || f.name.endsWith('.html'))) {
      const content = fs.readFileSync(full, 'utf8');
      if (content.includes('brisk_users')) {
        console.log(`Found brisk_users in ${full}`);
      }
    }
  }
}

searchDir('.');
