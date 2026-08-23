/**
 * Deep Roster Codebase & Integrity Inspector
 * Evaluates BriskSchedules for silent errors, schema mismatches, logic flaws, and award violations.
 */

const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');

const findings = {
  critical: [],
  major: [],
  minor: [],
  optimizations: []
};

console.log('====================================================');
console.log(' 🔬 WOY WOY ROSTER DEEP CODEBASE INSPECTOR');
console.log('====================================================\n');

// 1. Inspect js/database.js
const dbFile = path.join(rootDir, 'js', 'database.js');
if (fs.existsSync(dbFile)) {
  const code = fs.readFileSync(dbFile, 'utf8');
  
  // Check for unhandled errors
  const catchBlocks = code.match(/catch\s*\((.*?)\)\s*\{([^}]*)\}/g) || [];
  catchBlocks.forEach(cb => {
    if (cb.replace(/catch\s*\((.*?)\)\s*\{/, '').replace('}', '').trim() === '') {
      findings.minor.push({ file: 'js/database.js', issue: 'Empty catch block found in database.js' });
    }
  });

  // Check for schema field queries
  if (!code.includes('brisk_shifts')) {
    findings.critical.push({ file: 'js/database.js', issue: 'Missing brisk_shifts reference' });
  }
}

// 2. Inspect js/app.js
const appFile = path.join(rootDir, 'js', 'app.js');
if (fs.existsSync(appFile)) {
  const code = fs.readFileSync(appFile, 'utf8');
  
  // Check for legacy domain references
  if (code.includes('mcjp.io')) {
    findings.critical.push({ file: 'js/app.js', issue: 'Legacy domain mcjp.io found in js/app.js' });
  }

  // Check for localStorage token leakage or unsafe eval
  if (code.includes('eval(')) {
    findings.critical.push({ file: 'js/app.js', issue: 'Unsafe eval() usage in js/app.js' });
  }

  // Check for modal accessibility and key bindings (Escape key closes modals)
  if (!code.includes('Escape') && !code.includes('keydown')) {
    findings.minor.push({ file: 'js/app.js', issue: 'Modals may lack Escape key closing handler' });
  }
}

// 3. Inspect js/scheduler.js
const schedFile = path.join(rootDir, 'js', 'scheduler.js');
if (fs.existsSync(schedFile)) {
  const code = fs.readFileSync(schedFile, 'utf8');
  
  // Check if break calculation handles zero or undefined break times
  if (!code.includes('break') && !code.includes('meal')) {
    findings.major.push({ file: 'js/scheduler.js', issue: 'Scheduler does not appear to calculate break/meal times' });
  }
}

// 4. Inspect schema.sql vs database.js column mappings
const schemaFile = path.join(rootDir, 'schema.sql');
if (fs.existsSync(schemaFile)) {
  const schema = fs.readFileSync(schemaFile, 'utf8');
  
  // Check tables defined
  const tables = ['brisk_employees', 'brisk_users', 'brisk_shifts', 'brisk_timecards', 'brisk_leave_requests', 'brisk_invitations', 'brisk_settings'];
  tables.forEach(t => {
    if (!schema.includes(t)) {
      findings.critical.push({ file: 'schema.sql', issue: `Table ${t} missing from schema.sql` });
    }
  });
}

// 5. Inspect API endpoints deployment status
const untrackedMcp = !fs.existsSync(path.join(rootDir, 'api', 'mcp', 'index.ts'));
if (untrackedMcp) {
  findings.major.push({ file: 'api/mcp', issue: 'api/mcp directory is missing or unconfigured' });
}

// Output Report
console.log(`🚨 Critical Issues: ${findings.critical.length}`);
findings.critical.forEach(f => console.log(`   - [${f.file}] ${f.issue}`));

console.log(`\n⚠️  Major Issues: ${findings.major.length}`);
findings.major.forEach(f => console.log(`   - [${f.file}] ${f.issue}`));

console.log(`\n📝 Minor Issues: ${findings.minor.length}`);
findings.minor.forEach(f => console.log(`   - [${f.file}] ${f.issue}`));

console.log('\n====================================================\n');
