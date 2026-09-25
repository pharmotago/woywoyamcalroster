const fs = require('fs');
const path = require('path');

const dbJs = fs.readFileSync(path.join(__dirname, '../js/database.js'), 'utf8');
const lines = dbJs.split('\n');

lines.forEach((l, i) => {
  if (l.includes('getEmployees:') || l.includes('function getEmployees') || l.includes('getEmployees()')) {
    console.log(`js/database.js:${i + 1}: ${l.trim()}`);
    for (let j = Math.max(0, i - 5); j < Math.min(lines.length, i + 30); j++) {
      console.log(`  ${j + 1}: ${lines[j]}`);
    }
  }
});
