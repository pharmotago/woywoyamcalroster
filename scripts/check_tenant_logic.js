const fs = require('fs');

const dbJs = fs.readFileSync('js/database.js', 'utf8');
const appJs = fs.readFileSync('js/app.js', 'utf8');

console.log('=== getActiveTenant in js/database.js ===');
dbJs.split('\n').forEach((l, i) => {
  if (l.includes('function getActiveTenant') || l.includes('getActiveTenant =')) {
    console.log(`dbJs:${i + 1}: ${l}`);
    for (let j = i; j < i + 30; j++) {
      console.log(`  ${j + 1}: ${dbJs.split('\n')[j]}`);
    }
  }
});

console.log('=== detectAndApplyTenant in js/app.js ===');
appJs.split('\n').forEach((l, i) => {
  if (l.includes('function detectAndApplyTenant')) {
    console.log(`appJs:${i + 1}: ${l}`);
    for (let j = i; j < i + 40; j++) {
      console.log(`  ${j + 1}: ${appJs.split('\n')[j]}`);
    }
  }
});
