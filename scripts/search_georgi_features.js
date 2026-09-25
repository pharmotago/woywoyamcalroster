const fs = require('fs');

console.log('=== SEARCHING toggleTradingDayClosed across ALL files ===');
const files = ['js/app.js', 'js/database.js', 'index.html'];
for (const f of files) {
  const content = fs.readFileSync(f, 'utf8');
  content.split('\n').forEach((l, i) => {
    if (l.includes('toggleTradingDayClosed')) {
      console.log(`${f} Line ${i + 1}: ${l.trim()}`);
    }
  });
}
