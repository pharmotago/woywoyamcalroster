const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');
const app = fs.readFileSync('js/app.js', 'utf8');

const regex = /on[a-z]+="([a-zA-Z0-9_]+)\(/gi;
const handlers = new Set();
let match;

while ((match = regex.exec(html)) !== null) {
  handlers.add(match[1]);
}
while ((match = regex.exec(app)) !== null) {
  handlers.add(match[1]);
}

const missing = [];
handlers.forEach(h => {
  const isAttached = app.includes('window.' + h + ' =') || app.includes('window[\"' + h + '\"]') || app.includes('window[\'' + h + '\']');
  if (!isAttached) {
    if (app.includes('function ' + h) || app.includes('const ' + h + ' =') || app.includes('let ' + h + ' =')) {
      missing.push(h);
    }
  }
});

console.log('Total event handlers checked:', handlers.size);
console.log('Missing from window:', missing);
