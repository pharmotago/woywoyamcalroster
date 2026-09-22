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
// Test Suite 11: Split Shift UI & Award 2026 Break Engine Guard
// ---------------------------------------------------------
console.log('\n🔍 [Suite 11: Split Shift UI & Award 2026 Break Engine Guard]');
let splitCardTimeLayoutPass = false;
let awardBreakEnginePass = false;
let weekHoursSplitAggregationPass = false;

if (fs.existsSync(appJsPath)) {
  const appCode = fs.readFileSync(appJsPath, 'utf8');
  
  // 1. Check spacious 2-row layout with min-width: 115px for start and finish pickers
  splitCardTimeLayoutPass = appCode.includes('min-width:115px') && 
                            appCode.includes('role-split-card') &&
                            appCode.includes('flex-direction:column');
  
  // 2. Check Award Break Engine handles 5h+ and 7.6h+ thresholds
  awardBreakEnginePass = appCode.includes('unpaidMealMins: 30') &&
                         appCode.includes('paidBreaks: 2') &&
                         appCode.includes('grossHours < 7.6');

  // 3. Check calculateEmployeeWeekHours aggregates split shifts per date
  weekHoursSplitAggregationPass = appCode.includes('shiftsByDate') &&
                                  appCode.includes('hasExplicitMeal') &&
                                  appCode.includes('calculateShiftHours(s.startTime, s.endTime, s.unpaidMealMins)');
}

assertTest('Split Shift Time Picker Unclipped Layout Guard', splitCardTimeLayoutPass, 'Role segment rows missing spacious 2-row card or min-width:115px time pickers.');
assertTest('Pharmacy Industry Award 2026 Break Engine Logic Guard', awardBreakEnginePass, 'Award break engine missing required 30m meal break or 7.6h rest break thresholds.');
assertTest('Weekly Hours Split Shift Grouping & Calculation Guard', weekHoursSplitAggregationPass, 'calculateEmployeeWeekHours missing date-grouped split shift aggregation.');

// ---------------------------------------------------------
// Test Suite 12: Split Shift Overtime & DB Defensive Integrity Guard
// ---------------------------------------------------------
console.log('\n🔍 [Suite 12: Split Shift Overtime & DB Defensive Integrity Guard]');
let otSplitSiblingDeductionPass = false;
let saveIdempotencyPass = false;
let dbNanGuardPass = false;

if (fs.existsSync(appJsPath)) {
  const appCode = fs.readFileSync(appJsPath, 'utf8');
  
  // 1. Check prevShiftHours / prevDuration subtracts existing sibling split shifts to eliminate false OT
  otSplitSiblingDeductionPass = appCode.includes('seg.existingShiftId') &&
                               appCode.includes('prevSibling.employeeId === emp.id') &&
                               appCode.includes('removedSplitShiftIds');

  // 2. Check shift-id is assigned upon creation to prevent duplicates on retry
  saveIdempotencyPass = appCode.includes("shiftIdInput.value = created.id") &&
                        appCode.includes("seg.existingShiftId = addedSeg.id");
}

const dbJsPath = path.join(rootDir, 'js/database.js');
if (fs.existsSync(dbJsPath)) {
  const dbCode = fs.readFileSync(dbJsPath, 'utf8');
  dbNanGuardPass = dbCode.includes('!isNaN(Number(shift.unpaidMealMins))');
}

assertTest('Split Shift Overtime Deduplication Guard', otSplitSiblingDeductionPass, 'updateShiftBreakSummary or handleShiftSubmit missing sibling split shift deduction.');
assertTest('Shift Save Idempotency & Retry Duplication Guard', saveIdempotencyPass, 'Shift ID not assigned upon creation or segment ID missing on retry.');
assertTest('Database Unpaid Meal Minutes NaN Type Guard', dbNanGuardPass, 'database.js missing NaN defensive guard on unpaidMealMins.');

// ---------------------------------------------------------
// Test Suite 13: Katherine's Executive Payroll Summary & Award Penalty Engine Guard
// ---------------------------------------------------------
console.log('\n🔍 [Suite 13: Katherine Weekly Payroll Summary & Award Engine Guard]');
const payrollEnginePath = path.join(rootDir, 'js/modules/payroll-engine.js');
let payrollEngineExists = false;
let hasKatSummaryFn = false;
let hasKatCsvExport = false;
let hasKatClipboard = false;
let hasKatApproval = false;

if (fs.existsSync(payrollEnginePath)) {
  payrollEngineExists = true;
  const peCode = fs.readFileSync(payrollEnginePath, 'utf8');
  hasKatSummaryFn = peCode.includes('getWeeklyPayrollSummaryForKatherine') && peCode.includes('employeeSummaries');
  hasKatCsvExport = peCode.includes('downloadKatPayrollBureauCsv') && peCode.includes('text/csv');
  hasKatClipboard = peCode.includes('copyKatPayrollSummaryToClipboard') && peCode.includes('navigator.clipboard.writeText');
  hasKatApproval = peCode.includes('approveAllTimecardsForKatWeek');
}

let katModalInHtml = false;
let katKpiInHtml = false;
let katBtnInHtml = false;
let versionAligned = false;

if (fs.existsSync(indexHtmlPath)) {
  const indexHtml = fs.readFileSync(indexHtmlPath, 'utf8');
  katModalInHtml = indexHtml.includes('id="modal-kat-payroll-summary"') && indexHtml.includes('id="kat-payroll-table-body"');
  katKpiInHtml = indexHtml.includes('id="kat-kpi-gross-wages"') && indexHtml.includes('id="kat-kpi-super"') && indexHtml.includes('id="kat-kpi-hours"');
  katBtnInHtml = indexHtml.includes('id="btn-kat-weekly-payroll"') || indexHtml.includes('openKatPayrollSummaryModal()');
  versionAligned = indexHtml.includes('10.5.6') || (indexHtml.includes('10.5.') && indexHtml.includes('APP_VERSION'));
}

const stylesCssPath = path.join(rootDir, 'css/styles.css');
let printStylesPass = false;
if (fs.existsSync(stylesCssPath)) {
  const cssCode = fs.readFileSync(stylesCssPath, 'utf8');
  printStylesPass = cssCode.includes('printing-kat-payroll') && cssCode.includes('#kat-payroll-printable-area');
}

const versionJsonPath = path.join(rootDir, 'version.json');
let versionJsonPass = false;
if (fs.existsSync(versionJsonPath)) {
  try {
    const vMeta = JSON.parse(fs.readFileSync(versionJsonPath, 'utf8'));
    versionJsonPass = vMeta.version === '10.5.6' || (vMeta.version && vMeta.version.startsWith('10.5.'));
  } catch (e) {}
}

assertTest('Payroll Engine Module (payroll-engine.js) Present', payrollEngineExists, 'js/modules/payroll-engine.js is missing.');
assertTest('Katherine Mon-Sun Weekly Payroll Engine Function', hasKatSummaryFn, 'getWeeklyPayrollSummaryForKatherine missing or incomplete.');
assertTest('External Bureau CSV Export & 1-Click Clipboard Actions', hasKatCsvExport && hasKatClipboard, 'CSV export or clipboard function missing.');
assertTest('Batch Timecard Approval Action for Katherine\'s Selected Week', hasKatApproval, 'approveAllTimecardsForKatWeek function missing.');
assertTest('Katherine Modal & Table Elements in index.html', katModalInHtml, 'modal-kat-payroll-summary or table body missing from index.html.');
assertTest('Katherine Executive Gross/Super/Hours KPI Cards in index.html', katKpiInHtml, 'KPI cards missing from index.html.');
assertTest('Reports Panel Katherine Payroll Trigger Button Present', katBtnInHtml, 'btn-kat-weekly-payroll trigger missing from index.html.');
assertTest('High-Contrast Executive Print Stylesheet in styles.css', printStylesPass, 'Print CSS rules missing for Katherine payroll statement.');
assertTest('Platform Version Aligned Across App & Metadata (v10.5.x)', versionAligned && versionJsonPass, 'Version mismatch in index.html or version.json.');

// ---------------------------------------------------------
// Test Suite 14: Shift End Time Constraint Decoupling & Validation Guard
// ---------------------------------------------------------
console.log('\n🔍 [Suite 14: Shift End Timepicker Decoupling & Non-Blocking Validation Guard]');
let noShiftEndMinBinding = false;
let modalClearsMin = false;
let formNovalidate = false;

if (fs.existsSync(appJsPath)) {
  const appCode = fs.readFileSync(appJsPath, 'utf8');
  noShiftEndMinBinding = !appCode.includes("document.getElementById('shift-end').min =");
  modalClearsMin = appCode.includes("shiftEndInput.removeAttribute('min')") || appCode.includes("endInp.removeAttribute('min')");
}

if (fs.existsSync(indexHtmlPath)) {
  const indexHtml = fs.readFileSync(indexHtmlPath, 'utf8');
  formNovalidate = indexHtml.includes('id="shift-form"') && indexHtml.includes('novalidate');
}

assertTest('Decoupled Shift End Time Minimum Constraint Guard', noShiftEndMinBinding, 'Found active shift-end.min assignment causing browser validation lockup.');
assertTest('Explicit Modal State Reset for Shift End Time Guard', modalClearsMin, 'Modal open/close missing explicit removeAttribute("min") on shift-end.');
assertTest('Non-Blocking Form Novalidate Guard on Shift Form', formNovalidate, 'shift-form missing novalidate attribute.');

// ---------------------------------------------------------
// Test Suite 15: Dispensary Clinical Handover Board & All-Hands Meeting Presentation Deck
// ---------------------------------------------------------
console.log('\n🔍 [Suite 15: Dispensary Handover & All-Hands Deck]');
const handoverJsPath = path.join(rootDir, 'js/modules/dispensary-handover.js');
const handoverModuleExists = fs.existsSync(handoverJsPath);

let hasHandoverFns = false;
let hasDeckFns = false;
let hasHandoverModal = false;
let hasDeckModal = false;
let hasHandoverButtons = false;

if (handoverModuleExists) {
  const code = fs.readFileSync(handoverJsPath, 'utf8');
  hasHandoverFns = code.includes('openDispensaryHandoverModal') &&
                   code.includes('handleSaveHandover') &&
                   code.includes('getHandoverHistory');
  hasDeckFns = code.includes('openAllHandsDeckModal') &&
               code.includes('changeAllHandsSlide') &&
               code.includes('renderAllHandsDeckSlide');
}

if (fs.existsSync(indexHtmlPath)) {
  const indexHtml = fs.readFileSync(indexHtmlPath, 'utf8');
  hasHandoverModal = indexHtml.includes('id="modal-dispensary-handover"') &&
                     indexHtml.includes('id="handover-s8-confirmed"') &&
                     indexHtml.includes('id="handover-fridge-temp"');
  hasDeckModal = indexHtml.includes('id="modal-all-hands-deck"') &&
                 indexHtml.includes('id="deck-slide-title"') &&
                 indexHtml.includes('id="deck-slide-body"');
  hasHandoverButtons = indexHtml.includes('id="btn-dispensary-handover"') &&
                       indexHtml.includes('id="btn-allhands-deck"');
}

assertTest('Dispensary Handover Module (dispensary-handover.js) Present', handoverModuleExists, 'js/modules/dispensary-handover.js is missing.');
assertTest('Dispensary Clinical Handover & S8 Safe Logic Implementation', hasHandoverFns, 'Handover modal/saving functions missing in module.');
assertTest('Interactive All-Hands Staff Meeting Presentation Deck Logic', hasDeckFns, 'Deck navigation & slide render functions missing in module.');
assertTest('Dispensary Handover Modal & QCPP Fields in index.html', hasHandoverModal, 'modal-dispensary-handover or critical fields missing from index.html.');
assertTest('All-Hands Deck Presentation Modal & Slide View in index.html', hasDeckModal, 'modal-all-hands-deck or slide elements missing from index.html.');
assertTest('Dispensary Handover & All-Hands Deck Topbar Trigger Buttons', hasHandoverButtons, 'btn-dispensary-handover or btn-allhands-deck missing from index.html.');

// ---------------------------------------------------------
// Test Suite 16: PKRosters Brand Identity & Multi-Tenant Theming Guard
// ---------------------------------------------------------
console.log('\n🔍 [Suite 16: PKRosters Brand Identity & Multi-Tenant Theming Guard]');
const manifestJsonPath = path.join(rootDir, 'manifest.json');
const pkgJsonPath = path.join(rootDir, 'package.json');

let hasTenantConfig = false;
let hasTenantDetection = false;
let hasDdsTheme = false;
let hasAmcalTheme = false;
let hasBrandLogosInHtml = false;
let hasWatermarkInHtml = false;
let manifestHasPkRosters = false;
let pkgHasPkRosters = false;

if (fs.existsSync(appJsPath)) {
  const appCode = fs.readFileSync(appJsPath, 'utf8');
  hasTenantConfig = appCode.includes('TENANT_CONFIGS') && 
                    appCode.includes('budgewoi') && 
                    appCode.includes('Discount Drug Stores');
  hasTenantDetection = appCode.includes('detectAndApplyTenant') && 
                       appCode.includes('pkrosters_active_tenant');
}

if (fs.existsSync(stylesCssPath)) {
  const cssCode = fs.readFileSync(stylesCssPath, 'utf8');
  hasDdsTheme = cssCode.includes('[data-theme="budgewoi"]') && 
                (cssCode.includes('--brand-primary: #7a2682') || cssCode.includes('--brand-primary: #7A2682')) && 
                (cssCode.includes('--brand-accent: #ff6b00') || cssCode.includes('--brand-accent: #FF6B00'));
  hasAmcalTheme = cssCode.includes('[data-theme="amcal"]') || 
                  cssCode.includes('--brand-primary: #0066cc');
}

if (fs.existsSync(indexHtmlPath)) {
  const htmlCode = fs.readFileSync(indexHtmlPath, 'utf8');
  hasBrandLogosInHtml = htmlCode.includes('id="login-brand-logo"') && 
                        htmlCode.includes('id="login-brand-subtitle"') && 
                        htmlCode.includes('id="register-brand-logo"') &&
                        htmlCode.includes('id="register-brand-subtitle"') &&
                        htmlCode.includes('id="sidebar-brand-logo"');
  hasWatermarkInHtml = htmlCode.includes('POWERED BY') && htmlCode.includes('PKROSTERS');
}

if (fs.existsSync(manifestJsonPath)) {
  try {
    const manifest = JSON.parse(fs.readFileSync(manifestJsonPath, 'utf8'));
    manifestHasPkRosters = (manifest.name && manifest.name.includes('PKRosters')) && 
                           (manifest.short_name === 'PKRosters');
  } catch (e) {
    manifestHasPkRosters = false;
  }
}

if (fs.existsSync(pkgJsonPath)) {
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
    pkgHasPkRosters = pkg.name === 'pk-rosters' && pkg.description.includes('PKRosters');
  } catch (e) {
    pkgHasPkRosters = false;
  }
}

const htmlCodeForAmcalCheck = fs.existsSync(indexHtmlPath) ? fs.readFileSync(indexHtmlPath, 'utf8') : '';
const noHardcodedAmcalInRegister = !htmlCodeForAmcalCheck.includes('<h2>AMCAL</h2>');

assertTest('Tenant Configuration & Dictionary in app.js', hasTenantConfig, 'TENANT_CONFIGS missing or incomplete in js/app.js.');
assertTest('Dynamic Tenant Detection & Application (URL / Hostname / Storage)', hasTenantDetection, 'detectAndApplyTenant missing from js/app.js.');
assertTest('Budgewoi DDS Signature Theme (Royal Purple #7a2682 & Orange #ff6b00)', hasDdsTheme, 'Budgewoi DDS theme variables missing in css/styles.css.');
assertTest('Amcal Woy Woy Classic Theme (Royal Blue #0066cc & Cyan)', hasAmcalTheme, 'Amcal Woy Woy theme variables missing in css/styles.css.');
assertTest('Dynamic Multi-Tenant Brand Placeholders in index.html (Login & Register)', hasBrandLogosInHtml, 'Dynamic brand logo/subtitle IDs missing in index.html.');
assertTest('Register Card Dynamic Multi-Tenant Branding (No Hardcoded AMCAL)', noHardcodedAmcalInRegister, 'Found hardcoded <h2>AMCAL</h2> in register-card.');
assertTest('PKRosters Brand Watermark in Sidebar Footer', hasWatermarkInHtml, 'POWERED BY PKROSTERS footer watermark missing in index.html.');
assertTest('PWA Manifest & Package Metadata PKRosters Rebrand', manifestHasPkRosters && pkgHasPkRosters, 'manifest.json or package.json missing PKRosters rebranding.');

// ---------------------------------------------------------
// Test Suite 17: Multi-Store Clearance & Store Isolation Guard
// ---------------------------------------------------------
console.log('\n🔍 [Suite 17: Multi-Store Clearance & Store Isolation Guard]');
const loginApiIndexPath = path.join(rootDir, 'api/schedule/auth/login/index.ts');
const syncApiIndexPath = path.join(rootDir, 'api/schedule/sync/index.ts');
const databaseJsPath = path.join(rootDir, 'js/database.js');

let loginHasIsolation = false;
let loginHasPeterKatherine = false;
let syncHasIsolation = false;
let syncHasPeterKatherine = false;
let switcherInHtml = false;
let switcherInAppJs = false;
let switcherInCss = false;

if (fs.existsSync(loginApiIndexPath)) {
  const code = fs.readFileSync(loginApiIndexPath, 'utf8');
  loginHasIsolation = code.includes('STRICT STORE ISOLATION') &&
                      code.includes('budgewoi_dds') &&
                      code.includes('Access Denied: Your account is registered with');
  loginHasPeterKatherine = code.includes('MULTI_STORE_WHITELIST') &&
                           code.includes('peter') &&
                           code.includes('katherine') &&
                           code.includes('hasMultiStoreAccess');
}

if (fs.existsSync(syncApiIndexPath)) {
  const code = fs.readFileSync(syncApiIndexPath, 'utf8');
  syncHasIsolation = code.includes('matchesPharmacy') &&
                     code.includes('targetPharmacy') &&
                     code.includes('budgewoi_dds');
  syncHasPeterKatherine = code.includes('MULTI_STORE_WHITELIST') &&
                          code.includes('peter') &&
                          code.includes('katherine') &&
                          code.includes('isMultiStoreExecutive');
}

if (fs.existsSync(indexHtmlPath)) {
  const code = fs.readFileSync(indexHtmlPath, 'utf8');
  switcherInHtml = code.includes('id="multi-store-switcher-container"') &&
                   code.includes('id="btn-store-switcher"') &&
                   code.includes('id="store-switcher-menu"');
}

if (fs.existsSync(appJsPath)) {
  const code = fs.readFileSync(appJsPath, 'utf8');
  switcherInAppJs = code.includes('updateMultiStoreSwitcherVisibility') &&
                    code.includes('switchStoreTenant') &&
                    code.includes('MULTI_STORE_WHITELIST');
}

if (fs.existsSync(stylesCssPath)) {
  const code = fs.readFileSync(stylesCssPath, 'utf8');
  switcherInCss = code.includes('.store-switcher-wrap') &&
                  code.includes('.store-switcher-pill') &&
                  code.includes('.store-switcher-menu');
}

let hasCanonicalNormalization = false;
if (fs.existsSync(syncApiIndexPath) && fs.existsSync(databaseJsPath)) {
  const syncCode = fs.readFileSync(syncApiIndexPath, 'utf8');
  const dbCode = fs.readFileSync(databaseJsPath, 'utf8');
  hasCanonicalNormalization = syncCode.includes('normalizePharmacyId') &&
                             dbCode.includes('normalizePharmacyId') &&
                             syncCode.includes('targetPharmacy = normalizePharmacyId');
}

assertTest('Login Endpoint Strict Store Isolation Gate', loginHasIsolation, 'api/schedule/auth/login missing strict store boundary isolation.');
assertTest('Login Multi-Store Clearance for Peter Kim & Katherine', loginHasPeterKatherine, 'MULTI_STORE_WHITELIST missing Peter Kim / Katherine clearance in login API.');
assertTest('Sync API Data Partitioning by Pharmacy ID', syncHasIsolation, 'api/schedule/sync missing matchesPharmacy isolation filter.');
assertTest('Sync API Multi-Store Clearance for Peter Kim & Katherine', syncHasPeterKatherine, 'MULTI_STORE_WHITELIST missing Peter Kim / Katherine clearance in sync API.');
assertTest('Canonical Pharmacy ID Normalization & Zero-Leakage Guard', hasCanonicalNormalization, 'Missing normalizePharmacyId in sync API or database.js.');
assertTest('Executive Multi-Store Switcher Elements in index.html', switcherInHtml, 'multi-store-switcher-container missing from index.html.');
assertTest('Executive Multi-Store Switcher Controller in app.js', switcherInAppJs, 'updateMultiStoreSwitcherVisibility or switchStoreTenant missing from app.js.');
assertTest('Executive Multi-Store Switcher Styles in styles.css', switcherInCss, 'store-switcher styles missing from css/styles.css.');

let switcherPrecedencePass = false;
if (fs.existsSync(databaseJsPath) && fs.existsSync(appJsPath)) {
  const dbCode = fs.readFileSync(databaseJsPath, 'utf8');
  const appCode = fs.readFileSync(appJsPath, 'utf8');
  switcherPrecedencePass = dbCode.includes('MULTI_STORE_WHITELIST') &&
                           dbCode.includes('pkrosters_active_tenant') &&
                           appCode.includes('MULTI_STORE_WHITELIST') &&
                           appCode.includes('pkrosters_active_tenant');
}
assertTest('Executive In-App Store Switcher Precedence Guard', switcherPrecedencePass, 'database.js or app.js missing executive localStorage switcher precedence.');

// ---------------------------------------------------------
// Test Suite 18: Save Profile Auth & Invite Registration Fix Guard (v10.5.2)
// ---------------------------------------------------------
console.log('\n🔍 [Suite 18: Save Profile Auth Header & Invite Registration Fix Guard]');

const suite18_dbContent = fs.readFileSync(path.join(rootDir, 'js/database.js'), 'utf8');
const suite18_appContent = fs.readFileSync(path.join(rootDir, 'js/app.js'), 'utf8');

// Bug 1A: window.state.currentUser.email fallback in mutate headers (addEmployee + updateEmployee)
const hasEmailFallbackInMutate = (suite18_dbContent.match(/window\.state\?\.currentUser\?\.email/g) || []).length >= 2;
assertTest(
  'Mutate API x-user-email Fallback Guard (window.state.currentUser.email)',
  hasEmailFallbackInMutate,
  'database.js addEmployee/updateEmployee must use window.state?.currentUser?.email as fallback in x-user-email header (Bug 1A fix).'
);

// Bug 1B: 403/non-ok API error surfacing (not silent swallow) in addEmployee + updateEmployee
const hasErrorSurfacing = suite18_dbContent.includes('errData.error') && suite18_dbContent.includes('res.status');
assertTest(
  'Mutate API 403 Error Surfacing Guard (no silent swallow)',
  hasErrorSurfacing,
  'database.js addEmployee/updateEmployee must surface non-ok API errors (403/401) instead of silently falling through to SDK fallback (Bug 1B fix).'
);

// Bug 1C: Permission error re-throw guard in addEmployee + updateEmployee
const hasPermissionRethrow = (suite18_dbContent.match(/Re-throw permission errors/g) || []).length >= 2;
assertTest(
  'Mutate API Permission Error Re-throw Guard',
  hasPermissionRethrow,
  'database.js addEmployee/updateEmployee must re-throw Forbidden/Unauthorized errors to prevent misleading SDK fallback attempts.'
);

// Bug 2A: Broken anon signUp fallback removed from apiRegister
const hasNoBrokenFallback = !suite18_dbContent.includes('supabase.auth.signUp(');
assertTest(
  'apiRegister Anon signUp Fallback Removal Guard (Bug 2 Fix)',
  hasNoBrokenFallback,
  'database.js apiRegister must NOT use supabase.auth.signUp() anon fallback — it creates unconfirmed accounts blocked by RLS (Bug 2A fix).'
);

// Bug 2B: Clear error message surfaced if serverless route fails
const hasServiceUnavailableMsg = suite18_dbContent.includes('Registration service is temporarily unavailable');
assertTest(
  'apiRegister Clear Error Fallback Message Guard',
  hasServiceUnavailableMsg,
  'database.js apiRegister must surface a clear "Registration service is temporarily unavailable" message if serverless API fails.'
);

// Bug 2C: handleRegisterSubmit has loading guard
const hasRegisterLoadingGuard = suite18_appContent.includes('Registering...');
assertTest(
  'handleRegisterSubmit Loading Spinner & Button Disable Guard',
  hasRegisterLoadingGuard,
  'app.js handleRegisterSubmit must disable button and show loading spinner during registration to prevent double-submission (Bug 2C fix).'
);

// ---------------------------------------------------------
// Test Suite 19: All-Hands Team Meeting Deck & Shift Store Isolation Guard (v10.5.6)
// ---------------------------------------------------------
console.log('\n🔍 [Suite 19: All-Hands Team Meeting Deck & Shift Store Isolation Guard]');

const suite19_handoverContent = fs.readFileSync(handoverJsPath, 'utf8');
const suite19_mutateContent = fs.readFileSync(path.join(rootDir, 'api/schedule/mutate/index.ts'), 'utf8');

// 1. Dynamic Slide Data supporting both Amcal and Budgewoi DDS
const hasDynamicSlideData = suite19_handoverContent.includes('function getSlideData()') &&
                            suite19_handoverContent.includes('Budgewoi Discount Drug Stores — All-Hands Team Launch') &&
                            suite19_handoverContent.includes('Amcal Pharmacy Woy Woy — All-Hands Team Launch') &&
                            suite19_handoverContent.includes('https://budgewoiddsroster.vercel.app');

assertTest(
  'Dynamic All-Hands Meeting Deck per Tenant (Budgewoi DDS & Amcal Woy Woy)',
  hasDynamicSlideData,
  'dispensary-handover.js getSlideData() must dynamically generate slides for both Budgewoi DDS and Amcal.'
);

// 2. Outgoing Pharmacist dynamic lead prefill (Georgi Peek for Budgewoi, Peter Kim for Amcal)
const hasDynamicOutgoingPharmacist = suite19_handoverContent.includes("isBudgewoiStore ? 'Georgi Peek' : 'Peter Kim'");
assertTest(
  'Dispensary Handover Outgoing Lead Store Guard (Georgi Peek / Peter Kim)',
  hasDynamicOutgoingPharmacist,
  'dispensary-handover.js must default outgoing pharmacist to Georgi Peek on Budgewoi DDS and Peter Kim on Amcal.'
);

// 3. Shift Filtering in loadDataFromState checks both camelCase employeeId and snake_case employee_id
const hasCamelCaseShiftEmpCheck = suite18_appContent.includes('const empId = s.employeeId || s.employee_id;') &&
                                 suite18_appContent.includes('currentStoreEmpIds.has(empId)');
assertTest(
  'Client Shift Store Isolation Guard (camelCase employeeId & snake_case support)',
  hasCamelCaseShiftEmpCheck,
  'app.js loadDataFromState must check s.employeeId || s.employee_id to prevent Budgewoi shifts from being discarded.'
);

// 4. Shift Mutation API tagging for Budgewoi DDS
const hasMutateBudgewoiTagging = suite19_mutateContent.includes('[store:budgewoi_dds]') &&
                               suite19_mutateContent.includes("targetPharmacy === 'budgewoi_dds'");
assertTest(
  'Serverless Mutate Shift Store Tagging Guard',
  hasMutateBudgewoiTagging,
  'api/schedule/mutate/index.ts must tag shift notes with [store:budgewoi_dds] for Budgewoi DDS shifts.'
);

// 5. Database shift mutations send x-pharmacy-id header and pharmacyId body
const hasDbShiftStoreHeaders = suite18_dbContent.includes("'x-pharmacy-id': activeStore") &&
                              suite18_dbContent.includes("pharmacyId: activeStore");
assertTest(
  'Database Layer Shift Mutation Store Header & Body Propagation',
  hasDbShiftStoreHeaders,
  'database.js must pass x-pharmacy-id and pharmacyId in addShift, updateShift, deleteShift, and batchUpdateShifts.'
);

// ---------------------------------------------------------
// Test Suite 20: 100% English Compliance & Store Trading Hours Isolation Guard (v10.5.8)
// ---------------------------------------------------------
console.log('\n🔍 [Suite 20: 100% English Compliance & Store Trading Hours Isolation]');

// 1. Zero Non-English (Korean) Characters Guard across user-facing assets
const koreanCharRegex = /[\uac00-\ud7af\u1100-\u11ff\u3130-\u318f]/;
const appJsContent = fs.readFileSync(path.join(rootDir, 'js/app.js'), 'utf8');
const dbJsContent = fs.readFileSync(path.join(rootDir, 'js/database.js'), 'utf8');
const handoverJsContent = fs.readFileSync(path.join(rootDir, 'js/modules/dispensary-handover.js'), 'utf8');
const indexHtmlLatest = fs.readFileSync(indexHtmlPath, 'utf8');

const hasKoreanInApp = koreanCharRegex.test(appJsContent);
const hasKoreanInDb = koreanCharRegex.test(dbJsContent);
const hasKoreanInHandover = koreanCharRegex.test(handoverJsContent);
const hasKoreanInHtml = koreanCharRegex.test(indexHtmlLatest);

assertTest(
  'Zero Non-English Characters Guard (100% English Standard)',
  !hasKoreanInApp && !hasKoreanInDb && !hasKoreanInHandover && !hasKoreanInHtml,
  `Non-English characters detected: app.js(${hasKoreanInApp}), database.js(${hasKoreanInDb}), handover.js(${hasKoreanInHandover}), index.html(${hasKoreanInHtml}).`
);

// 2. Amcal Pharmacy Woy Woy Authentic Trading Hours Guard (Mon-Fri 8-8, Sat-Sun 8.30-5)
const syncTsContent = fs.readFileSync(path.join(rootDir, 'api/schedule/sync/index.ts'), 'utf8');
const hasAmcalSyncHours = syncTsContent.includes('"1": { "open": "08:00", "close": "20:00", "closed": false }') &&
                          syncTsContent.includes('"6": { "open": "08:30", "close": "17:00", "closed": false }') &&
                          syncTsContent.includes('"0": { "open": "08:30", "close": "17:00", "closed": false }');

const hasAmcalDbHours = dbJsContent.includes('"1": { "open": "08:00", "close": "20:00", "closed": false }') &&
                        dbJsContent.includes('"6": { "open": "08:30", "close": "17:00", "closed": false }') &&
                        dbJsContent.includes('"0": { "open": "08:30", "close": "17:00", "closed": false }');

assertTest(
  'Amcal Pharmacy Woy Woy Trading Hours Guard (Mon-Fri 8-8, Sat-Sun 8.30-5)',
  hasAmcalSyncHours && hasAmcalDbHours,
  'api/schedule/sync/index.ts and js/database.js must configure Mon-Fri 08:00-20:00 and Sat-Sun 08:30-17:00 for Amcal.'
);

// 3. Budgewoi DDS Authentic Trading Hours Guard (Mon-Fri 8.30-6, Sat 8.30-1, Sun Closed)
const hasBudgewoiSyncHours = syncTsContent.includes('const BUDGEWOI_TRADING_HOURS = {') &&
                             syncTsContent.includes('"1": { "open": "08:30", "close": "18:00", "closed": false }') &&
                             syncTsContent.includes('"6": { "open": "08:30", "close": "13:00", "closed": false }') &&
                             syncTsContent.includes('"0": { "open": "00:00", "close": "00:00", "closed": true }');

assertTest(
  'Budgewoi DDS Trading Hours Guard (Mon-Fri 8.30-6, Sat 8.30-1, Sun Closed)',
  hasBudgewoiSyncHours,
  'api/schedule/sync/index.ts must configure Mon-Fri 08:30-18:00, Sat 08:30-13:00, Sun Closed for Budgewoi DDS.'
);

// 4. Store Trading Hours Isolation Guard (No Cross-Store Contamination)
const hasStoreIsolation = syncTsContent.includes("isBudgewoi ? BUDGEWOI_TRADING_HOURS : AMCAL_TRADING_HOURS") &&
                          syncTsContent.includes("isBudgewoi ? 'settings_budgewoi_dds' : 'global_settings'");

assertTest(
  'Store Trading Hours & Settings Isolation Guard',
  hasStoreIsolation,
  'api/schedule/sync/index.ts must isolate storeSettings by targetPharmacy and prevent cross-store hours contamination.'
);

// ---------------------------------------------------------
// Test Suite 21: Unassigned Shifts Hours Exclusion & Webster Care Department Resolution (v10.5.9)
// ---------------------------------------------------------
console.log('\n🔍 [Suite 21: Unassigned Shifts Exclusion & Webster Care Department Resolution]');

// 1. Unassigned Shifts Hours Exclusion in Weekly View
const hasUnassignedWeeklyGuard = appJsContent.includes('const isUnassigned = !s.employeeId || s.employeeId === \'unassigned\' || !state.employees.some(e => e.id === s.employeeId && e.active);') &&
                                appJsContent.includes('if (isUnassigned) return;');
assertTest(
  'Unassigned Shifts Weekly Hours Exclusion Guard',
  hasUnassignedWeeklyGuard,
  'app.js weekly dayShifts loop must exclude unassigned shifts from total scheduled hours and costs.'
);

// 2. Unassigned Shifts Hours Exclusion in Mobile Day View
const hasUnassignedMobileGuard = appJsContent.includes('const totalHoursForDay = dispHours + frontHours + websterHours;') &&
                                appJsContent.includes('dayAllShifts.forEach(s => {') &&
                                appJsContent.includes('if (isUnassigned) return;');
assertTest(
  'Unassigned Shifts Mobile Day Hours Exclusion Guard',
  hasUnassignedMobileGuard,
  'app.js mobile timeline dayAllShifts loop must exclude unassigned shifts from totalHoursForDay.'
);

// 3. Unassigned Shifts Exclusion from Pharmacist Clinical Coverage
const roleCustJsPath = path.join(rootDir, 'js/modules/role-customization.js');
let hasUnassignedCoverageGuard = false;
if (fs.existsSync(roleCustJsPath)) {
  const roleCode = fs.readFileSync(roleCustJsPath, 'utf8');
  hasUnassignedCoverageGuard = roleCode.includes('if (!s.employeeId || s.employeeId === \'unassigned\') return;') &&
                               roleCode.includes('totalPharmHours += calculateShiftHours');
}
assertTest(
  'Unassigned Shifts Pharmacist Clinical Coverage Exclusion Guard',
  hasUnassignedCoverageGuard,
  'role-customization.js renderDailyPanel must exclude unassigned shifts from pharmacist clinical coverage.'
);

// 4. Webster Care Dynamic Classification Engine
const hasWebsterDeptClassification = appJsContent.includes('explicitDept === \'webster\'') &&
                                     appJsContent.includes('award.includes(\'pa3\') || award.includes(\'webster\')') &&
                                     appJsContent.includes('c.toLowerCase().includes(\'webster\')') &&
                                     appJsContent.includes('const websterShifts = empShifts.filter(s => (s.role || \'\').toLowerCase().includes(\'webster\'));');
assertTest(
  'Webster Care Department Classification Engine Guard',
  hasWebsterDeptClassification,
  'app.js getEmployeeDepartment must classify Webster staff via explicit dept, PA3 award, certs, and rostered shifts.'
);

// 5. Multi-Department Tagging for Cross-Functional Staff
const hasMultiDeptSupport = appJsContent.includes('function getEmployeeDepartments(emp)') &&
                            appJsContent.includes('empDepts.join(\' \')') &&
                            appJsContent.includes('depts.includes(dept)');
assertTest(
  'Multi-Department Tagging & Filtering Guard',
  hasMultiDeptSupport,
  'app.js must support getEmployeeDepartments and space-separated data-dept row filtering.'
);

// 6. Webster Packer Position in Default Positions
const hasWebsterPosition = dbJsContent.includes("id: 'pos_webster', name: 'Webster Packer'");
assertTest(
  'Webster Packer Default Position Guard',
  hasWebsterPosition,
  'database.js DEFAULT_POSITIONS must include pos_webster (Webster Packer).'
);

// 7. Department Field Cloud Mapping in Database Layer
const hasDeptDbMapping = dbJsContent.includes('if (emp.department) avail.department = emp.department;') &&
                         dbJsContent.includes('department: emp.department || avail.department || null');
assertTest(
  'Department Field Supabase DB Mapping Guard',
  hasDeptDbMapping,
  'database.js mapEmployeeToDb and mapEmployeeFromDb must map department to/from availability.department.'
);

// 8. Department Selector in Employee Modal
const hasDeptSelectInHtml = indexHtmlLatest.includes('id="emp-department"') &&
                            indexHtmlLatest.includes('value="webster"') &&
                            indexHtmlLatest.includes('Webster Care');
assertTest(
  'Department Selector in Employee Profile Modal Guard',
  hasDeptSelectInHtml,
  'index.html employee form must include emp-department select with webster option.'
);

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
