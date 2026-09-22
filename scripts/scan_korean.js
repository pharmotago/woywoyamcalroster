const fs = require('fs');
const path = require('path');

const koreanRegex = /[\uac00-\ud7af\u1100-\u11ff\u3130-\u318f]/;
const extensions = ['.html', '.js', '.ts', '.json', '.css'];
const excludeDirs = ['node_modules', '.git', '.gemini', '.system_generated', 'dist'];

let matches = [];
let totalFiles = 0;

function scanDir(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!excludeDirs.includes(entry.name)) {
        scanDir(fullPath);
      }
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (extensions.includes(ext)) {
        totalFiles++;
        try {
          const content = fs.readFileSync(fullPath, 'utf8');
          const lines = content.split(/\r?\n/);
          lines.forEach((line, index) => {
            // Ignore the regex definition line itself if in a test script or qa engine
            if (line.includes('[\\uac00-\\ud7af') || line.includes('koreanCharRegex') || line.includes('koreanRegex')) {
              return;
            }
            if (koreanRegex.test(line)) {
              matches.push({
                file: path.relative(process.cwd(), fullPath),
                lineNum: index + 1,
                content: line.trim()
              });
            }
          });
        } catch (err) {
          console.error(`Error reading ${fullPath}:`, err.message);
        }
      }
    }
  }
}

console.log('🔍 Starting comprehensive Korean character scan across HTML, JS, TS, JSON, CSS...');
scanDir(process.cwd());

console.log(`Total files scanned: ${totalFiles}`);
if (matches.length === 0) {
  console.log('✅ PASS: Zero Korean characters found across all source files! 100% English Compliant.');
  process.exit(0);
} else {
  console.log(`❌ FAIL: Found ${matches.length} lines with Korean characters:`);
  matches.forEach(m => {
    console.log(`  [${m.file}:${m.lineNum}] ${m.content}`);
  });
  process.exit(1);
}
