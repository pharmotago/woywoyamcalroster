const fs = require('fs');

const indexHtml = fs.readFileSync('index.html', 'utf8');

console.log('=== ALL TBODY ELEMENTS IN index.html ===');
const tbodyMatches = indexHtml.match(/<tbody[^>]*id=["'][^"']*["'][^>]*>/gi) || [];
tbodyMatches.forEach(m => console.log(m));

console.log('\n=== ALL MODALS IN index.html ===');
const modalMatches = indexHtml.match(/<div[^>]*id=["']modal-[^"']*["'][^>]*>/gi) || [];
modalMatches.forEach(m => console.log(m));

console.log('\n=== SEARCHING FOR "EMPLOYEE" OR "STAFF" IN index.html ===');
const lines = indexHtml.split('\n');
lines.forEach((l, i) => {
  if (l.toLowerCase().includes('employee panel') || l.toLowerCase().includes('staff panel') || l.includes('employees-cards-container')) {
    console.log(`Line ${i+1}: ${l.trim()}`);
  }
});
