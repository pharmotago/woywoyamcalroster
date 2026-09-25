const fs = require('fs');
const path = require('path');

const appJs = fs.readFileSync(path.join(__dirname, '../js/app.js'), 'utf8');
const lines = appJs.split('\n');

lines.forEach((l, i) => {
  if (l.includes('state.employees =') || l.includes('state.employees=')) {
    console.log(`js/app.js:${i + 1}: ${l.trim()}`);
    for (let j = Math.max(0, i - 10); j < Math.min(lines.length, i + 35); j++) {
      console.log(`  ${j + 1}: ${lines[j]}`);
    }
  }
});
