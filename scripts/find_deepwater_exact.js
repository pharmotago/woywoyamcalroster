const fs = require('fs');
const path = require('path');

const targetDirs = [
  path.resolve(__dirname, '..'), // BriskSchedules
];

const specificFiles = [
  path.resolve('c:/Antigravity/AGENTS.md'),
  path.resolve('c:/Antigravity/Sovereign_Desk.md')
];

const ignoreDirs = ['node_modules', '.git', '.system_generated', 'temp_brisk_nm', 'dist'];

let matches = [];

function searchFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split(/\r?\n/);
    lines.forEach((line, idx) => {
      if (/deepwater/i.test(line)) {
        matches.push({
          file: filePath,
          line: idx + 1,
          text: line.trim()
        });
      }
    });
  } catch (err) {}
}

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (!ignoreDirs.includes(entry.name)) {
        walk(path.join(dir, entry.name));
      }
    } else if (entry.isFile()) {
      if (/\.(js|ts|html|json|md|css)$/i.test(entry.name)) {
        searchFile(path.join(dir, entry.name));
      }
    }
  }
}

targetDirs.forEach(walk);
specificFiles.forEach(searchFile);

console.log(`Found ${matches.length} occurrences of Deepwater:`);
matches.forEach(m => {
  console.log(`[${path.relative(path.resolve(__dirname, '..'), m.file)}:${m.line}] ${m.text}`);
});
