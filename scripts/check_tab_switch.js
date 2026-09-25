const fs = require('fs');
const appJs = fs.readFileSync('js/app.js', 'utf8');

appJs.split('\n').forEach((l, i) => {
  if (l.includes('employees') && (l.includes('switchTab') || l.includes('renderActivePanel') || l.includes('panel-employees'))) {
    console.log(`line ${i+1}: ${l.trim()}`);
  }
});

console.log('\n=== renderActivePanel definition ===');
appJs.split('\n').forEach((l, i) => {
  if (l.includes('function renderActivePanel')) {
    for (let j = i; j < i + 40; j++) {
      console.log(`  ${j+1}: ${appJs.split('\n')[j]}`);
    }
  }
});
