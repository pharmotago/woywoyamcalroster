const fs = require('fs');
const appJs = fs.readFileSync('js/app.js', 'utf8');

appJs.split('\n').forEach((l, i) => {
  if (l.includes('staff-directory-list') || l.includes('openStaffDirectoryModal')) {
    console.log(`line ${i+1}: ${l}`);
    for (let j = Math.max(0, i - 5); j < Math.min(appJs.split('\n').length, i + 35); j++) {
      console.log(`  ${j+1}: ${appJs.split('\n')[j]}`);
    }
  }
});
