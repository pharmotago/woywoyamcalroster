/**
 * BriskSchedules - Login Diagnostic Script
 * Checks Supabase for orphaned auth users, missing brisk_users profiles,
 * used/expired invite codes, and employees without any auth account.
 *
 * Usage: npm run diagnose:login
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://gcslfkujlfnznedatrsn.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('\n❌ FATAL: SUPABASE_SERVICE_ROLE_KEY env var is missing.');
  console.error('   Run: $env:SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"; npm run diagnose:login\n');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

async function diagnose() {
  console.log('\n🔍 BriskSchedules Login Diagnostic\n' + '='.repeat(50));

  // 1. Fetch all auth users (paginated, up to 1000 — warn if more)
  console.log('\n[1] Fetching all auth.users...');
  const { data: authData, error: authErr } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  if (authErr) {
    console.error('❌ Failed to list auth users:', authErr.message);
    process.exit(1);
  }
  const authUsers = authData?.users || [];
  console.log(`   ✅ Found ${authUsers.length} auth users`);

  // 2. Fetch all brisk_users
  console.log('\n[2] Fetching brisk_users...');
  const { data: briskUsers, error: briskErr } = await supabase
    .from('brisk_users')
    .select('id, email, name, role, employee_id');
  if (briskErr) {
    console.error('❌ Failed to fetch brisk_users:', briskErr.message);
    process.exit(1);
  }
  console.log(`   ✅ Found ${(briskUsers || []).length} brisk_users records`);

  // 3. Fetch all brisk_employees
  console.log('\n[3] Fetching brisk_employees...');
  const { data: employees, error: empErr } = await supabase
    .from('brisk_employees')
    .select('id, email, name, role, active');
  if (empErr) {
    console.error('❌ Failed to fetch brisk_employees:', empErr.message);
    process.exit(1);
  }
  const activeEmps = (employees || []).filter(e => e.active !== false);
  console.log(`   ✅ Found ${activeEmps.length} active employees (${(employees || []).length} total)`);

  // 4. Fetch all brisk_invitations
  console.log('\n[4] Fetching brisk_invitations...');
  const { data: invitations, error: invErr } = await supabase
    .from('brisk_invitations')
    .select('code, email, role, used');
  if (invErr) {
    console.warn('⚠️  Failed to fetch invitations:', invErr.message);
  }
  const unusedInvites = (invitations || []).filter(i => !i.used);
  const usedInvites = (invitations || []).filter(i => i.used);
  console.log(`   ✅ ${unusedInvites.length} unused invites, ${usedInvites.length} used invites`);

  // --- Analysis ---
  const briskById = new Map((briskUsers || []).map(u => [u.id, u]));
  const briskByEmail = new Map((briskUsers || []).map(u => [u.email?.toLowerCase().trim(), u]));
  const empByEmail = new Map(activeEmps.map(e => [e.email?.toLowerCase().trim(), e]));
  const authByEmail = new Map(authUsers.map(u => [u.email?.toLowerCase().trim(), u]));

  console.log('\n\n' + '='.repeat(50));
  console.log('📊 DIAGNOSTIC RESULTS');
  console.log('='.repeat(50));

  // --- Problem 1: Auth users without brisk_users profile (orphaned auth) ---
  const orphanedAuth = authUsers.filter(u => {
    const email = u.email?.toLowerCase().trim();
    return !briskById.has(u.id) && !briskByEmail.has(email);
  });

  console.log(`\n❗ PROBLEM 1: Orphaned auth.users (auth exists but NO brisk_users profile)`);
  if (orphanedAuth.length === 0) {
    console.log('   ✅ None found');
  } else {
    orphanedAuth.forEach(u => {
      const inEmployees = empByEmail.has(u.email?.toLowerCase().trim());
      const emailConfirmed = !!u.email_confirmed_at;
      console.log(`   🔴 ${u.email} | auth_id: ${u.id.substring(0,8)}... | confirmed: ${emailConfirmed} | in_employees: ${inEmployees}`);
    });
    console.log(`   → FIX: Run npm run fix:orphans to auto-provision missing brisk_users rows`);
  }

  // --- Problem 2: Active employees with NO auth account at all ---
  const noAuthEmps = activeEmps.filter(e => {
    const email = e.email?.toLowerCase().trim();
    return email && !authByEmail.has(email);
  });

  console.log(`\n❗ PROBLEM 2: Active employees with NO auth account (cannot register or log in)`);
  if (noAuthEmps.length === 0) {
    console.log('   ✅ None found');
  } else {
    noAuthEmps.forEach(e => {
      const hasUnusedInvite = unusedInvites.some(i => i.email?.toLowerCase() === e.email?.toLowerCase());
      const hasUsedInvite = usedInvites.some(i => i.email?.toLowerCase() === e.email?.toLowerCase());
      console.log(`   🟡 ${e.email} (${e.name}) | has_unused_invite: ${hasUnusedInvite} | has_used_invite: ${hasUsedInvite}`);
    });
    console.log(`   → FIX: These employees need a fresh invite code or manager to reset via admin panel`);
  }

  // --- Problem 3: Auth users with UNCONFIRMED email ---
  const unconfirmed = authUsers.filter(u => !u.email_confirmed_at);
  console.log(`\n❗ PROBLEM 3: auth.users with UNCONFIRMED email (blocked from login)`);
  if (unconfirmed.length === 0) {
    console.log('   ✅ None found');
  } else {
    unconfirmed.forEach(u => {
      console.log(`   🔴 ${u.email} | created: ${u.created_at}`);
    });
    console.log(`   → FIX: Login API auto-confirms on next login attempt. Or run npm run fix:confirm`);
  }

  // --- Problem 4: Employees with used invite but no auth account ---
  const usedInviteNoAuth = usedInvites.filter(inv => {
    const email = inv.email?.toLowerCase().trim();
    return email && !authByEmail.has(email);
  });
  console.log(`\n❗ PROBLEM 4: Invite code USED but employee has no auth account (registration failed mid-way)`);
  if (usedInviteNoAuth.length === 0) {
    console.log('   ✅ None found');
  } else {
    usedInviteNoAuth.forEach(inv => {
      console.log(`   🔴 ${inv.email} — invite code was used but no auth account exists!`);
      console.log(`       → FIX: Mark invite as unused so they can re-register`);
    });
  }

  // --- Problem 5: brisk_users with no matching auth user ---
  const profilesWithNoAuth = (briskUsers || []).filter(u => {
    const email = u.email?.toLowerCase().trim();
    return !authByEmail.has(email) && !authUsers.find(a => a.id === u.id);
  });
  console.log(`\n❗ PROBLEM 5: brisk_users records with NO matching auth user (stale profiles)`);
  if (profilesWithNoAuth.length === 0) {
    console.log('   ✅ None found');
  } else {
    profilesWithNoAuth.forEach(u => {
      console.log(`   🟡 ${u.email} (${u.name}) — stale brisk_users record`);
    });
  }

  // --- Summary Table ---
  console.log('\n\n' + '='.repeat(50));
  console.log('📋 SUMMARY');
  console.log('='.repeat(50));
  console.log(`Auth users:          ${authUsers.length}`);
  console.log(`brisk_users:         ${(briskUsers || []).length}`);
  console.log(`Active employees:    ${activeEmps.length}`);
  console.log(`Unused invites:      ${unusedInvites.length}`);
  console.log('---');
  console.log(`Orphaned auth:       ${orphanedAuth.length}  ← Cannot login (no profile)`);
  console.log(`No auth account:     ${noAuthEmps.length}  ← Cannot login at all`);
  console.log(`Unconfirmed email:   ${unconfirmed.length}  ← Blocked from login`);
  console.log(`Invite used/no auth: ${usedInviteNoAuth.length}  ← Registration incomplete`);
  console.log(`Stale profiles:      ${profilesWithNoAuth.length}`);

  const totalIssues = orphanedAuth.length + noAuthEmps.length + unconfirmed.length + usedInviteNoAuth.length;
  if (totalIssues === 0) {
    console.log('\n✅ All clear! No login blockers detected.\n');
  } else {
    console.log(`\n⚠️  ${totalIssues} issue(s) detected. Run npm run fix:login to auto-repair.\n`);
  }
}

diagnose().catch(err => {
  console.error('\n❌ Diagnostic failed:', err.message);
  process.exit(1);
});
