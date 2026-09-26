const fs = require('fs');
const appJs = fs.readFileSync('js/app.js', 'utf8');

appJs.split('\n').forEach((l, i) => {
  if (l.includes('getEmployeeDepartment')) {
    console.log(`line ${i+1}: ${l}`);
  }
});
