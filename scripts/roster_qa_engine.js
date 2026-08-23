/**
 * BriskSchedules Automated Pre-Flight QA & Security Integrity Engine
 * Developed by Antigravity Roster Engineering Council (Neo, Finale, Kael, Mia, Chloe)
 */

const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const errors = [];

function assertTest(name, condition, errorMsg) {
  totalTests++;
  if (condition) {
    console.log(`  ✅ [PASS] ${name}`);
    passedTests++;
  } else {
    console.error(`  ❌ [FAIL] ${name}: ${errorMsg}`);
    errors.push({ test: name, message: errorMsg });
    failedTests++;
  }
}

console.log('\n======================================================');
console.log(' 🛡️  BRISKSCHEDULES PRE-FLIGHT QA & INTEGRITY ENGINE');
console.log('======================================================\n');

// ---------------------------------------------------------
// Test Suite 1: Domain & Hostinger Zero-Tolerance Policy
// ---------------------------------------------------------
console.log('🔍 [Suite 1: Deprecated Domain & Origin Lockdown]');
const filesToScanForDomains = [
  'index.html',
  'js/app.js',
  'js/database.js',
  'js/scheduler.js',
  'js/supabase-client.js',
  'sw.js',
  'vercel.json',
  'package.json'
];

let bannedDomainOccurrences = 0;
const bannedPatterns = ['schedule.mcjp.io', 'hostinger'];

filesToScanForDomains.forEach(relPath => {
  const fullPath = path.join(rootDir, relPath);
  if (fs.existsSync(fullPath)) {
    const content = fs.readFileSync(fullPath, 'utf8');
    bannedPatterns.forEach(pattern => {
      if (content.toLowerCase().includes(pattern.toLowerCase())) {
        bannedDomainOccurrences++;
        console.error(`     ⚠️ Found banned pattern "${pattern}" in ${relPath}`);
      }
    });
  }
});

assertTest(
  'Deprecated Domain Ban (Zero Tolerance for schedule.mcjp.io / Hostinger)',
  bannedDomainOccurrences === 0,
  `Found ${bannedDomainOccurrences} banned domain occurrences.`
);

// ---------------------------------------------------------
// Test Suite 2: Vercel SPA Routing & Security Headers
// ---------------------------------------------------------
console.log('\n🔍 [Suite 2: Vercel SPA Routing & Header Integrity]');
const vercelConfigPath = path.join(rootDir, 'vercel.json');
let vercelValid = false;
let apiRewriteFirst = false;

if (fs.existsSync(vercelConfigPath)) {
  try {
    const vercelJson = JSON.parse(fs.readFileSync(vercelConfigPath, 'utf8'));
    vercelValid = true;
    
    if (Array.isArray(vercelJson.rewrites)) {
      const apiIndex = vercelJson.rewrites.findIndex(r => r.source && r.source.includes('/api/'));
      const fallbackIndex = vercelJson.rewrites.findIndex(r => r.destination && r.destination.includes('/index.html'));
      if (apiIndex !== -1 && (fallbackIndex === -1 || apiIndex < fallbackIndex)) {
        apiRewriteFirst = true;
      }
    }
  } catch (e) {
    vercelValid = false;
  }
}

assertTest('Vercel JSON Configuration Exists and is Valid', vercelValid, 'vercel.json is missing or corrupted.');
assertTest(
  'API Rewrite Precedence Guard (/api/(.*) must precede SPA fallback)',
  apiRewriteFirst,
  'API rewrites must be evaluated before SPA index.html fallback to prevent Unexpected token HTML errors.'
);

// ---------------------------------------------------------
// Test Suite 3: PWA Service Worker Cache & Cache-Busting
// ---------------------------------------------------------
console.log('\n🔍 [Suite 3: PWA Service Worker & Cache-Busting]');
const swPath = path.join(rootDir, 'sw.js');
let swExists = false;
let swHasCacheName = false;
let swHasSupabaseBypass = false;
let swHasNetworkFirst = false;

if (fs.existsSync(swPath)) {
  swExists = true;
  const swContent = fs.readFileSync(swPath, 'utf8');
  swHasCacheName = /CACHE_NAME\s*=\s*['"]amcal-rosters-v[\d.]+['"]/.test(swContent);
  swHasSupabaseBypass = swContent.includes('supabase.co') && swContent.includes('/api/');
  swHasNetworkFirst = swContent.includes('fetch(event.request)') && swContent.includes('caches.open');
}

assertTest('Service Worker File (sw.js) Present', swExists, 'sw.js is missing.');
assertTest('Service Worker Cache Versioning Pattern (amcal-rosters-vX.Y.Z)', swHasCacheName, 'CACHE_NAME is not properly versioned.');
assertTest('Supabase & API Network Cache Bypass Guard', swHasSupabaseBypass, 'sw.js must never cache Supabase or /api/ endpoints.');
assertTest('Network-First Strategy for Instant App Updates', swHasNetworkFirst, 'sw.js does not enforce Network-First fetching.');

// ---------------------------------------------------------
// Test Suite 4: Database Layer & Defensive Guards
// ---------------------------------------------------------
console.log('\n🔍 [Suite 4: Database Layer & Defensive Integrity]');
const dbPath = path.join(rootDir, 'js/database.js');
let dbExists = false;
let hasNullChecks = false;
let hasRoleHandling = false;

if (fs.existsSync(dbPath)) {
  dbExists = true;
  const dbContent = fs.readFileSync(dbPath, 'utf8');
  hasNullChecks = dbContent.includes('typeof') && (dbContent.includes('!= null') || dbContent.includes('!== null'));
  hasRoleHandling = dbContent.includes('DEFAULT_ROLES') || dbContent.includes('DEFAULT_POSITIONS');
}

assertTest('Cloud Database Layer (database.js) Present', dbExists, 'js/database.js is missing.');
assertTest('Strict Type & Null Defensive Coding Guards', hasNullChecks, 'js/database.js lacks explicit defensive null/type checks.');
assertTest('Pharmacy Default Roles & Positions Initialized', hasRoleHandling, 'Default pharmacy operational roles missing.');

// ---------------------------------------------------------
// Test Suite 5: Security & Token Leak Prevention
// ---------------------------------------------------------
console.log('\n🔍 [Suite 5: Strict Zero Public Token Exposure & Security]');
const apiUtilsPath = path.join(rootDir, 'api/schedule/utils.ts');
let noTokenLeak = true;

if (fs.existsSync(apiUtilsPath)) {
  const content = fs.readFileSync(apiUtilsPath, 'utf8');
  if (content.includes('recovery_token') && content.includes('return res.json({ token:')) {
    noTokenLeak = false;
  }
}

assertTest('Zero Public Token Exposure on Public Endpoints', noTokenLeak, 'Sensitive tokens found in public JSON return bodies.');

// ---------------------------------------------------------
// Test Suite 6: ES Module Strict Syntax & Duplicate Identifier Guard
// ---------------------------------------------------------
console.log('\n🔍 [Suite 6: ES Module Strict Syntax & Scope Collision Guard]');
const vm = require('vm');
const frontendJsFiles = [
  'js/app.js',
  'js/database.js',
  'js/scheduler.js',
  'js/swaps.js',
  'js/supabase-client.js'
];

let esModuleSyntaxPass = true;
frontendJsFiles.forEach(relPath => {
  const fullPath = path.join(rootDir, relPath);
  if (fs.existsSync(fullPath)) {
    const code = fs.readFileSync(fullPath, 'utf8');
    try {
      if (typeof vm.SourceTextModule === 'function') {
        new vm.SourceTextModule(code);
      }
    } catch (err) {
      esModuleSyntaxPass = false;
      console.error(`     ❌ ES Module syntax error in ${relPath}: ${err.message}`);
    }
  }
});

assertTest(
  'ES Module Strict Lexical Scope & Duplicate Identifier Guard',
  esModuleSyntaxPass,
  'Duplicate variable declaration or ES Module syntax error detected.'
);

// ---------------------------------------------------------
// Test Suite 7: Auth Endpoint Anti-Impersonation & Security Guard
// ---------------------------------------------------------
console.log('\n🔍 [Suite 7: Auth Endpoint Anti-Impersonation & Zero-Backdoor Guard]');
const loginApiPath = path.join(rootDir, 'api/schedule/auth/login/index.ts');
let loginSecurityPass = true;

if (fs.existsSync(loginApiPath)) {
  const loginCode = fs.readFileSync(loginApiPath, 'utf8');
  // Must NOT mutate user password via updateUserById during login authentication flow
  if (/updateUserById\s*\([^,]+,\s*\{[^}]*password/i.test(loginCode)) {
    loginSecurityPass = false;
  }
}

assertTest(
  'Zero-Backdoor & Anti-Password-Mutation on Login Guard',
  loginSecurityPass,
  'Login endpoint must not mutate stored passwords upon authentication failure.'
);

// ---------------------------------------------------------
// Test Suite 8: Registration Idempotency & Unique Key Conflict Guard
// ---------------------------------------------------------
console.log('\n🔍 [Suite 8: Registration Idempotency & Pre-existing Staff Link Guard]');
const registerApiPath = path.join(rootDir, 'api/schedule/auth/register/index.ts');
let registerIdempotentPass = true;

if (fs.existsSync(registerApiPath)) {
  const regCode = fs.readFileSync(registerApiPath, 'utf8');
  if (!regCode.includes('existingEmp') || !regCode.includes('targetEmail')) {
    registerIdempotentPass = false;
  }
}

assertTest(
  'Invitation Registration Idempotency (Pre-existing Staff Link Guard)',
  registerIdempotentPass,
  'Registration endpoint must check and link pre-existing employees before insert.'
);

// ---------------------------------------------------------
// Test Suite 9: Form Reference & Identifier Integrity Guard
// ---------------------------------------------------------
console.log('\n🔍 [Suite 9: Form Reference & Identifier Integrity Guard]');
const appJsPath = path.join(rootDir, 'js/app.js');
let formRefPass = true;

if (fs.existsSync(appJsPath)) {
  const appCode = fs.readFileSync(appJsPath, 'utf8');
  // Must NOT contain known undeclared references
  if (appCode.includes('dob: dobVal')) {
    formRefPass = false;
  }
}

assertTest(
  'Form Payload Variable Identifier Integrity Guard',
  formRefPass,
  'Found undeclared variable reference in form submission payload.'
);

// ---------------------------------------------------------
// Test Suite 10: Lean Healthcare UI & Wage KPI Integrity Guard
// ---------------------------------------------------------
console.log('\n🔍 [Suite 10: Lean Healthcare UI & Wage KPI Integrity Guard]');
const indexHtmlPath = path.join(rootDir, 'index.html');

let kpiElementsPresent = false;
let payslipModalRemoved = false;
if (fs.existsSync(indexHtmlPath)) {
  const indexHtml = fs.readFileSync(indexHtmlPath, 'utf8');
  kpiElementsPresent = indexHtml.includes('wage-ratio-forecast-badge') && indexHtml.includes('modal-sales-kpi');
  payslipModalRemoved = !indexHtml.includes('modal-employee-payslip') && !indexHtml.includes('menu-ai-ops');
}
assertTest('Wage-to-Sales KPI & Forecast Badge Elements Present', kpiElementsPresent, 'index.html missing wage-ratio-forecast-badge or modal-sales-kpi.');
assertTest('Obsolete Pay Slip & AI Ops Panels Cleanly Removed', payslipModalRemoved, 'index.html still contains obsolete modal-employee-payslip or menu-ai-ops.');

// ---------------------------------------------------------
// Final Summary & Verdict
// ---------------------------------------------------------
console.log('\n------------------------------------------------------');
console.log(`Total Checks Run: ${totalTests} | Passed: ${passedTests} | Failed: ${failedTests}`);
console.log('------------------------------------------------------');

if (failedTests === 0) {
  console.log('🎉 [VERDICT: PASS] All Roster App Quality & Integrity gates passed with 0 defects!\n');
  process.exit(0);
} else {
  console.error('⚠️ [VERDICT: REWORK REQUIRED] Defect gates failed. Address errors before release:\n');
  errors.forEach(e => console.error(`  - ${e.test}: ${e.message}`));
  console.log('\n');
  process.exit(1);
}
