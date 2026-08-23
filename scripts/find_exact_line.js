const fs = require('fs');
const vm = require('vm');

const code = fs.readFileSync('js/app.js', 'utf8');
const lines = code.split('\n');

// Find which lines declare emp
const empLines = [];
lines.forEach((l, idx) => {
  if (/\b(const|let|var)\s+.*?emp\b/.test(l) || /\bemp\s*=/.test(l)) {
    empLines.push(idx + 1);
  }
});

console.log('Lines referencing emp declaration:', empLines);

// Let's do a binary search or comment out lines to see which line causes SyntaxError
let low = 0;
let high = lines.length;

function testCode(testLines) {
  try {
    new vm.SourceTextModule(testLines.join('\n'));
    return true;
  } catch (err) {
    if (err.message.includes("Identifier 'emp' has already been declared")) {
      return false;
    }
    return true;
  }
}

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (/\b(const|let)\s+.*?\bemp\b/.test(line)) {
    const copy = [...lines];
    copy[i] = '// ' + line;
    try {
      new vm.SourceTextModule(copy.join('\n'));
      console.log(`🎯 FOUND IT! Line ${i + 1} was causing duplicate declaration: ${line.trim()}`);
    } catch (e) {
      if (!e.message.includes("Identifier 'emp' has already been declared")) {
        console.log(`🎯 Line ${i + 1} eliminated the duplicate error!`);
      }
    }
  }
}
