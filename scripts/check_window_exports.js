const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const js = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');

// Find all onclick, onsubmit, onchange handlers in index.html
const handlerRegex = /on(click|submit|change|input|keyup|keydown)=["']([^"']+)["']/g;
let match;
const inlineCalls = new Set();

while ((match = handlerRegex.exec(html)) !== null) {
  const code = match[2];
  // extract function name before (
  const fnMatch = code.match(/([a-zA-Z0-9_$]+)\s*\(/);
  if (fnMatch && fnMatch[1]) {
    const fnName = fnMatch[1];
    if (!['if', 'for', 'switch', 'alert', 'confirm', 'console', 'document', 'window', 'event', 'setTimeout'].includes(fnName)) {
      inlineCalls.add(fnName);
    }
  }
}

console.log('Total unique inline function calls in index.html:', inlineCalls.size);

const missingFromWindow = [];
inlineCalls.forEach(fn => {
  const windowRegex = new RegExp(`window\\.${fn}\\s*=`);
  if (!windowRegex.test(js)) {
    missingFromWindow.push(fn);
  }
});

console.log('\n❌ Functions called in HTML but NOT attached to window:');
missingFromWindow.forEach(fn => console.log(`   - ${fn}`));
