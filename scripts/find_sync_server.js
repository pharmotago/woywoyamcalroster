const fs = require('fs');
const path = require('path');

const dbJs = fs.readFileSync(path.join(__dirname, '../js/database.js'), 'utf8');
const lines = dbJs.split('\n');

lines.forEach((l, i) => {
  if (l.includes('async function syncFromServer') || l.includes('syncFromServer:')) {
    console.log(`js/database.js:${i + 1}: ${l.trim()}`);
    for (let j = Math.max(0, i - 5); j < Math.min(lines.length, i + 100); j++) {
      console.log(`  ${j + 1}: ${lines[j]}`);
    }
  }
});
