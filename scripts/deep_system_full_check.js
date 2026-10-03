// scripts/deep_system_full_check.js
// Comprehensive full-system diagnostic and health audit for PKRosters platform

const fs = require('fs');
const path = require('path');

async function fullCheck() {
  console.log('========================================================');
  console.log('🔍 FULL SYSTEM HEALTH & ARCHITECTURAL INTEGRITY AUDIT');
  console.log('========================================================\n');

  let totalChecks = 0;
  let passedChecks = 0;
  let failedChecks = 0;
  const issues = [];

  function check(title, condition, details) {
    totalChecks++;
    if (condition) {
      console.log(`✅ [PASS] ${title}`);
      passedChecks++;
    } else {
      console.error(`❌ [FAIL] ${title}: ${details}`);
      failedChecks++;
      issues.push({ title, details });
    }
  }

  // ---------------------------------------------------------
  // SECTION 1: AMCAL PHARMACY WOY WOY LIVE PRODUCTION HEALTH
  // ---------------------------------------------------------
  console.log('--- 1. Amcal Pharmacy Woy Woy Live Production Health ---');
  
  // 1.1 Version Metadata
  try {
    const vRes = await fetch('https://woywoyamcalroster.vercel.app/version.json');
    const vData = await vRes.json();
    check(
      'Amcal version.json accessible & valid',
      vRes.status === 200 && vData.version === '10.5.17',
      `Expected version 10.5.17, got ${vData?.version} (HTTP ${vRes.status})`
    );
  } catch (err) {
    check('Amcal version.json accessible & valid', false, err.message);
  }

  // 1.2 Sync Endpoint
  let amcalEmployees = [];
  let amcalShifts = [];
  try {
    const sRes = await fetch('https://woywoyamcalroster.vercel.app/api/schedule/sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-email': 'pharmotago@gmail.com',
        'x-pharmacy-id': 'amcal_woywoy'
      },
      body: JSON.stringify({ email: 'pharmotago@gmail.com', pharmacyId: 'amcal_woywoy' })
    });
    const sData = await sRes.json();
    amcalEmployees = sData.employees || [];
    amcalShifts = sData.shifts || [];

    check(
      'Amcal /api/schedule/sync returns HTTP 200 with employees & shifts',
      sRes.status === 200 && amcalEmployees.length >= 28 && amcalShifts.length > 0,
      `Employees: ${amcalEmployees.length}, Shifts: ${amcalShifts.length} (HTTP ${sRes.status})`
    );

    // Verify 0 Budgewoi DDS contamination in Amcal
    const contaminatedAmcalEmps = amcalEmployees.filter(e => {
      const p = (e.pharmacy_id || e.pharmacyId || e.availability?.pharmacy_id || '').toLowerCase();
      return p.includes('budgewoi') || p.includes('dds');
    });
    check(
      'Amcal employee roster has ZERO Budgewoi DDS contamination',
      contaminatedAmcalEmps.length === 0,
      `Found ${contaminatedAmcalEmps.length} contaminated employees in Amcal`
    );

    const contaminatedAmcalShifts = amcalShifts.filter(s => {
      const p = (s.pharmacy_id || s.pharmacyId || '').toLowerCase();
      return p.includes('budgewoi') || p.includes('dds');
    });
    check(
      'Amcal shifts table has ZERO Budgewoi DDS contamination',
      contaminatedAmcalShifts.length === 0,
      `Found ${contaminatedAmcalShifts.length} contaminated shifts in Amcal`
    );

    // Verify Amcal store settings
    const amcalSettings = sData.settings || {};
    check(
      'Amcal store settings row exists and is configured for Amcal',
      amcalSettings.id === 'global_settings' || String(amcalSettings.company_name).includes('Amcal'),
      `Settings ID: ${amcalSettings.id}, Company: ${amcalSettings.company_name}`
    );
  } catch (err) {
    check('Amcal /api/schedule/sync check', false, err.message);
  }

  // ---------------------------------------------------------
  // SECTION 2: BUDGEWOI DISCOUNT DRUG STORES LIVE HEALTH
  // ---------------------------------------------------------
  console.log('\n--- 2. Budgewoi Discount Drug Stores Live Production Health ---');

  // 2.1 Version Metadata
  try {
    const bVRes = await fetch('https://budgewoiddsroster.vercel.app/version.json');
    const bVData = await bVRes.json();
    check(
      'Budgewoi version.json accessible & valid',
      bVRes.status === 200 && bVData.version === '1.0.0',
      `Expected version 1.0.0, got ${bVData?.version} (HTTP ${bVRes.status})`
    );
  } catch (err) {
    check('Budgewoi version.json accessible & valid', false, err.message);
  }

  // 2.2 Sync Endpoint
  let budgewoiEmployees = [];
  let budgewoiShifts = [];
  try {
    const bSRes = await fetch('https://budgewoiddsroster.vercel.app/api/schedule/sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-email': 'georgi.peek6@gmail.com',
        'x-pharmacy-id': 'budgewoi_dds'
      },
      body: JSON.stringify({ email: 'georgi.peek6@gmail.com', pharmacyId: 'budgewoi_dds' })
    });
    const bSData = await bSRes.json();
    budgewoiEmployees = bSData.employees || [];
    budgewoiShifts = bSData.shifts || [];

    check(
      'Budgewoi /api/schedule/sync returns HTTP 200 with dedicated workforce',
      bSRes.status === 200 && budgewoiEmployees.length === 15 && budgewoiShifts.length > 0,
      `Employees: ${budgewoiEmployees.length}, Shifts: ${budgewoiShifts.length} (HTTP ${bSRes.status})`
    );

    // Verify 0 Amcal contamination in Budgewoi
    const contaminatedBudgEmps = budgewoiEmployees.filter(e => {
      const p = (e.pharmacy_id || e.pharmacyId || e.availability?.pharmacy_id || '').toLowerCase();
      return p.includes('woywoy') || p.includes('amcal');
    });
    check(
      'Budgewoi employee roster has ZERO Amcal contamination',
      contaminatedBudgEmps.length === 0,
      `Found ${contaminatedBudgEmps.length} contaminated employees in Budgewoi`
    );

    const contaminatedBudgShifts = budgewoiShifts.filter(s => {
      const p = (s.pharmacy_id || s.pharmacyId || '').toLowerCase();
      return p.includes('woywoy') || p.includes('amcal');
    });
    check(
      'Budgewoi shifts table has ZERO Amcal contamination',
      contaminatedBudgShifts.length === 0,
      `Found ${contaminatedBudgShifts.length} contaminated shifts in Budgewoi`
    );

    // Verify Georgi Peek exists in Budgewoi staff
    const georgi = budgewoiEmployees.find(e => e.email === 'georgi.peek6@gmail.com' || e.name === 'Georgi Peek');
    check(
      'Budgewoi roster contains Dispensary Manager Georgi Peek',
      !!georgi,
      `Georgi Peek found: ${!!georgi}`
    );
  } catch (err) {
    check('Budgewoi /api/schedule/sync check', false, err.message);
  }

  // ---------------------------------------------------------
  // SECTION 3: EMAIL SEPARATION & CROSS-STORE REJECTION
  // ---------------------------------------------------------
  console.log('\n--- 3. Email Separation & Cross-Store Boundaries ---');

  try {
    const amcalCrossRes = await fetch('https://woywoyamcalroster.vercel.app/api/schedule/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-email': 'pharmotago@gmail.com' },
      body: JSON.stringify({ email: 'pharmotago@gmail.com', pharmacyId: 'budgewoi_dds', weekStart: '2026-09-28', broadcast: true })
    });
    check(
      'Amcal rejects budgewoi_dds requests with HTTP 400',
      amcalCrossRes.status === 400,
      `Expected HTTP 400, got ${amcalCrossRes.status}`
    );
  } catch (err) {
    check('Amcal rejects budgewoi_dds requests with HTTP 400', false, err.message);
  }

  try {
    const budgCrossRes = await fetch('https://budgewoiddsroster.vercel.app/api/schedule/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-email': 'pharmotago@gmail.com' },
      body: JSON.stringify({ email: 'pharmotago@gmail.com', pharmacyId: 'amcal_woywoy', weekStart: '2026-09-28', broadcast: true })
    });
    check(
      'Budgewoi rejects amcal_woywoy requests with HTTP 400',
      budgCrossRes.status === 400,
      `Expected HTTP 400, got ${budgCrossRes.status}`
    );
  } catch (err) {
    check('Budgewoi rejects amcal_woywoy requests with HTTP 400', false, err.message);
  }

  // ---------------------------------------------------------
  // SECTION 4: LOCAL ARTIFACT & PWA VERSION ALIGNMENT
  // ---------------------------------------------------------
  console.log('\n--- 4. Local File Alignment & Anti-Update Loop Guards ---');

  const amcalDir = path.join(__dirname, '..');
  const budgDir = 'C:\\Antigravity\\BudgewoiDdsRoster';

  // Amcal Index HTML version tags
  const amcalIndexHtml = fs.readFileSync(path.join(amcalDir, 'index.html'), 'utf8');
  const amcalSwJs = fs.readFileSync(path.join(amcalDir, 'sw.js'), 'utf8');
  const amcalVersionJson = JSON.parse(fs.readFileSync(path.join(amcalDir, 'version.json'), 'utf8'));

  check(
    'Amcal local version alignment across HTML, SW, and metadata (v10.5.17)',
    amcalIndexHtml.includes("APP_VERSION = '10.5.17'") &&
    amcalIndexHtml.includes('app.js?v=10.5.17') &&
    amcalSwJs.includes("CACHE_NAME = 'amcal-rosters-v10.5.17'") &&
    amcalVersionJson.version === '10.5.17',
    'Amcal version mismatch across assets'
  );

  // Budgewoi Index HTML version tags
  if (fs.existsSync(budgDir)) {
    const budgIndexHtml = fs.readFileSync(path.join(budgDir, 'index.html'), 'utf8');
    const budgSwJs = fs.readFileSync(path.join(budgDir, 'sw.js'), 'utf8');
    const budgVersionJson = JSON.parse(fs.readFileSync(path.join(budgDir, 'version.json'), 'utf8'));

    check(
      'Budgewoi local version alignment across HTML, SW, and metadata (v1.0.0)',
      budgIndexHtml.includes("APP_VERSION = '1.0.0'") &&
      budgIndexHtml.includes('app.js?v=1.0.0') &&
      budgSwJs.includes("CACHE_NAME = 'budgewoi-dds-rosters-v1.0.0'") &&
      budgVersionJson.version === '1.0.0',
      'Budgewoi version mismatch across assets'
    );
  }

  // ---------------------------------------------------------
  // SECTION 5: ADDRESS & BRANDING INTEGRITY
  // ---------------------------------------------------------
  console.log('\n--- 5. Address & Branding Standards ---');

  // Verify Deepwater Plaza is 0% present in Amcal source files
  const amcalAuditFiles = ['index.html', 'js/app.js', 'js/modules/payroll-engine.js', 'api/schedule/email/index.ts'];
  let deepwaterCount = 0;
  amcalAuditFiles.forEach(f => {
    const p = path.join(amcalDir, f);
    if (fs.existsSync(p)) {
      const text = fs.readFileSync(p, 'utf8');
      if (/deepwater/i.test(text)) deepwaterCount++;
    }
  });
  check(
    'Deepwater Plaza zero-tolerance ban in Amcal source files',
    deepwaterCount === 0,
    `Found Deepwater Plaza in ${deepwaterCount} files`
  );

  // Verify Peninsula Plaza address present in Amcal configs
  const amcalAppJs = fs.readFileSync(path.join(amcalDir, 'js/app.js'), 'utf8');
  check(
    'Amcal authentic address (Peninsula Plaza, 62 Blackwall Road) in app.js',
    amcalAppJs.includes('Peninsula Plaza') && amcalAppJs.includes('62 Blackwall Road') && amcalAppJs.includes('(02) 4342 2256'),
    'Peninsula Plaza address missing or misconfigured in app.js'
  );

  // ---------------------------------------------------------
  // SUMMARY REPORT
  // ---------------------------------------------------------
  console.log('\n========================================================');
  console.log(`TOTAL AUDIT CHECKS: ${totalChecks} | PASSED: ${passedChecks} | FAILED: ${failedChecks}`);
  console.log('========================================================\n');

  if (failedChecks === 0) {
    console.log('🎉 [FULL SYSTEM AUDIT: PERFECT PASS] All systems operational with zero defects!\n');
    process.exit(0);
  } else {
    console.error('⚠️ [FULL SYSTEM AUDIT: ISSUES DETECTED] Failures:');
    issues.forEach(i => console.error(`  - ${i.title}: ${i.details}`));
    console.log('\n');
    process.exit(1);
  }
}

fullCheck().catch(err => {
  console.error('Fatal audit failure:', err);
  process.exit(1);
});
