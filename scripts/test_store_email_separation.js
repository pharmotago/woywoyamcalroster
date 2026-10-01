// scripts/test_store_email_separation.js
// Verification suite for strict cross-store email separation & discrete delivery

async function runEmailSeparationTests() {
  console.log('========================================================');
  console.log('🧪 VERIFYING STORE EMAIL SEPARATION & ISOLATION');
  console.log('========================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(name, condition, details) {
    if (condition) {
      console.log(`✅ [PASS] ${name}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${name}: ${details}`);
      failed++;
    }
  }

  // TEST 1: Amcal Endpoint rejects Budgewoi DDS request
  console.log('--- Test 1: Cross-Store Gate (Amcal rejects Budgewoi payload) ---');
  try {
    const res = await fetch('https://woywoyamcalroster.vercel.app/api/schedule/email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-email': 'pharmotago@gmail.com'
      },
      body: JSON.stringify({
        email: 'pharmotago@gmail.com',
        pharmacyId: 'budgewoi_dds',
        weekStart: '2026-09-28',
        broadcast: true
      })
    });
    const status = res.status;
    const body = await res.json().catch(() => ({}));
    assert(
      'Amcal rejects budgewoi_dds with HTTP 400',
      status === 400 && String(body.error).includes('Store boundary mismatch'),
      `Expected HTTP 400 with boundary mismatch error, got ${status}: ${JSON.stringify(body)}`
    );
  } catch (err) {
    assert('Amcal rejects budgewoi_dds with HTTP 400', false, err.message);
  }

  // TEST 2: Budgewoi Endpoint rejects Amcal Woy Woy request
  console.log('\n--- Test 2: Cross-Store Gate (Budgewoi rejects Amcal payload) ---');
  try {
    const res = await fetch('https://budgewoiddsroster.vercel.app/api/schedule/email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-email': 'pharmotago@gmail.com'
      },
      body: JSON.stringify({
        email: 'pharmotago@gmail.com',
        pharmacyId: 'amcal_woywoy',
        weekStart: '2026-09-28',
        broadcast: true
      })
    });
    const status = res.status;
    const body = await res.json().catch(() => ({}));
    assert(
      'Budgewoi rejects amcal_woywoy with HTTP 400',
      status === 400 && String(body.error).includes('Store boundary mismatch'),
      `Expected HTTP 400 with boundary mismatch error, got ${status}: ${JSON.stringify(body)}`
    );
  } catch (err) {
    assert('Budgewoi rejects amcal_woywoy with HTTP 400', false, err.message);
  }

  // TEST 3: RBAC security gate (Non-manager cannot send emails)
  console.log('\n--- Test 3: RBAC Gate on Amcal (Non-manager rejected) ---');
  try {
    const res = await fetch('https://woywoyamcalroster.vercel.app/api/schedule/email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-email': 'unauthorized_staff@example.com'
      },
      body: JSON.stringify({
        email: 'unauthorized_staff@example.com',
        pharmacyId: 'amcal_woywoy',
        weekStart: '2026-09-28',
        broadcast: true
      })
    });
    const status = res.status;
    assert(
      'Non-manager request returns HTTP 403 Forbidden',
      status === 403,
      `Expected HTTP 403, got ${status}`
    );
  } catch (err) {
    assert('Non-manager request returns HTTP 403 Forbidden', false, err.message);
  }

  console.log('\n--------------------------------------------------------');
  console.log(`Results: ${passed} Passed | ${failed} Failed`);
  console.log('--------------------------------------------------------\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runEmailSeparationTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
