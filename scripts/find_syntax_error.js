const fs = require('fs');

// We can test line by line or binary search to find which function has the duplicate declaration
const code = fs.readFileSync('js/app.js', 'utf8');

// Use native Function or import()
async function findError() {
  // Let's write code to a temp mjs file and import it to get exact line number
  fs.writeFileSync('js/temp_test.mjs', code);
  try {
    await import('../js/temp_test.mjs');
  } catch (err) {
    console.error('Exact error stack:', err);
  } finally {
    try { fs.unlinkSync('js/temp_test.mjs'); } catch (e) {}
  }
}

findError();
