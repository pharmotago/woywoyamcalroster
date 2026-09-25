const fs = require('fs');

const appJs = fs.readFileSync('js/app.js', 'utf8');
const dbJs = fs.readFileSync('js/database.js', 'utf8');

console.log('=== employeeOrder in js/app.js ===');
appJs.split('\n').forEach((l, i) => {
  if (l.includes('employeeOrder') || l.includes('employee_order')) {
    console.log(`appJs:${i+1}: ${l.trim()}`);
  }
});

console.log('\n=== employeeOrder in js/database.js ===');
dbJs.split('\n').forEach((l, i) => {
  if (l.includes('employeeOrder') || l.includes('employee_order')) {
    console.log(`dbJs:${i+1}: ${l.trim()}`);
  }
});
