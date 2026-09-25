const fs = require('fs');

const indexHtml = fs.readFileSync('index.html', 'utf8');
const appJs = fs.readFileSync('js/app.js', 'utf8');

console.log('=== Searching all employee render functions in js/app.js ===');
const matches = appJs.match(/function\s+[a-zA-Z0-9_]*(?:Employee|Staff|User|Team|Roster|Member)[a-zA-Z0-9_]*\s*\([^)]*\)/gi) || [];
console.log('Functions:', matches);

console.log('\n=== Searching where getOrderedActiveEmployees is called ===');
appJs.split('\n').forEach((l, i) => {
  if (l.includes('getOrderedActiveEmployees(')) {
    console.log(`line ${i+1}: ${l.trim()}`);
  }
});

console.log('\n=== Searching for "3" or filters or dropdowns with employees ===');
appJs.split('\n').forEach((l, i) => {
  if (l.includes('.slice(0, 3)') || l.includes('.length === 3') || l.includes('only 3') || l.includes('limit(3)')) {
    console.log(`line ${i+1}: ${l.trim()}`);
  }
});
