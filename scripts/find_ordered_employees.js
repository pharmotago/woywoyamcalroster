const fs = require('fs');
const path = require('path');

const appJs = fs.readFileSync(path.join(__dirname, '../js/app.js'), 'utf8');
const lines = appJs.split('\n');

lines.forEach((l, i) => {
  if (l.includes('function getOrderedActiveEmployees')) {
    console.log(`Found getOrderedActiveEmployees at line ${i + 1}`);
    for (let j = Math.max(0, i - 5); j < Math.min(lines.length, i + 50); j++) {
      console.log(`${j + 1}: ${lines[j]}`);
    }
  }
});
