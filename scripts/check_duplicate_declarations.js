const fs = require('fs');
const vm = require('vm');

const code = fs.readFileSync('js/app.js', 'utf8');

try {
  new vm.SourceTextModule(code);
  console.log('🎉 SUCCESS: js/app.js parses as ES Module with 0 errors!');
} catch (err) {
  console.error('❌ Error parsing js/app.js:', err);
}
