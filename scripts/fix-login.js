/**
 * BriskSchedules - Login Auto-Fix Script
 * Repairs the most common login blockers:
 * 1. Confirms unconfirmed auth.users emails
 * 2. Creates missing brisk_users profiles for orphaned auth users
 * 3. Resets used invite codes where auth account creation failed
 *
 * Usage: npm run fix:login
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://gcslfkujlfnznedatrsn.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('\n❌ FATAL: SUPABASE_SERVICE_ROLE_KEY env var is missing.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

async function fixLoginIssues() {
  console.log('\n🔧 BriskSchedules Login Auto-Fix\n' + '='.repeat(50));

  let fixed = 0;
  let failed = 0;

  // Fetch data
  const { data: authData } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  const authUsers = authData?.users || [];
  const { data: briskUsers } = await supabase.from('brisk_users').select('id, email, name, role, employee_id');
  const { data: employees } = await supabase.from('brisk_employees').select('id, email, name, role, active');
  const { data: invitations } = await supabase.from('brisk_invitations').select('code, email, role, used');

  const briskById = new Map((briskUsers || []).map(u => [u.id, u]));
  const briskByEmail = new Map((briskUsers || []).map(u => [u.email?.toLowerCase().trim(), u]));
  const empByEmail = new Map((employees || []).map(e => [e.email?.toLowerCase().trim(), e]));
  const authByEmail = new Map(authUsers.map(u => [u.email?.toLowerCase().trim(), u]));

  // --- Fix 1: Confirm unconfirmed emails ---
  console.log('\n[Fix 1] Confirming unconfirmed email addresses...');
  const unconfirmed = authUsers.filter(u => !u.email_confirmed_at);
  for (const u of unconfirmed) {
    const { error } = await supabase.auth.admin.updateUserById(u.id, { email_confirm: true });
    if (error) {
      console.log(`   ❌ Failed to confirm ${u.email}: ${error.message}`);
      failed++;
    } else {
      console.log(`   ✅ Confirmed: ${u.email}`);
      fixed++;
    }
  }
  if (unconfirmed.length === 0) console.log('   ✅ No unconfirmed emails');

  // --- Fix 2: Create missing brisk_users for orphaned auth users ---
  console.log('\n[Fix 2] Creating missing brisk_users profiles for orphaned auth users...');
  const orphanedAuth = authUsers.filter(u => {
    const email = u.email?.toLowerCase().trim();
    return !briskById.has(u.id) && !briskByEmail.has(email);
  });

  for (const u of orphanedAuth) {
    const email = u.email?.toLowerCase().trim();
    const emp = empByEmail.get(email);

    const isManager = (emp?.role && (
      emp.role.toLowerCase().includes('manager') ||
      emp.role.toLowerCase().includes('pharmacist manager') ||
      emp.role.toLowerCase().includes('owner')
    )) || ['peter', 'glen', 'katherine', 'vicky', 'pharmotago'].some(l => email.includes(l));

    const autoRole = isManager ? 'manager' : 'employee';
    const autoName = emp?.name || u.user_metadata?.name || email.split('@')[0] || 'Staff Member';

    const { error } = await supabase.from('brisk_users').upsert({
      id: u.id,
      email: email,
      name: autoName,
      role: autoRole,
      employee_id: emp?.id || null,
      password_hash: 'SUPABASE_AUTH_MANAGED'
    });

    if (error) {
      console.log(`   ❌ Failed to create profile for ${email}: ${error.message}`);
      failed++;
    } else {
      console.log(`   ✅ Created brisk_users profile: ${email} (${autoRole})`);
      fixed++;
    }
  }
  if (orphanedAuth.length === 0) console.log('   ✅ No orphaned auth users');

  // --- Fix 3: Reset invite codes where invite was marked used but auth never created ---
  console.log('\n[Fix 3] Resetting broken invite codes (used but no auth account created)...');
  const usedInvites = (invitations || []).filter(i => i.used);
  const brokenInvites = usedInvites.filter(inv => {
    const email = inv.email?.toLowerCase().trim();
    return email && !authByEmail.has(email);
  });

  for (const inv of brokenInvites) {
    const { error } = await supabase
      .from('brisk_invitations')
      .update({ used: false })
      .eq('code', inv.code);

    if (error) {
      console.log(`   ❌ Failed to reset invite for ${inv.email}: ${error.message}`);
      failed++;
    } else {
      console.log(`   ✅ Reset invite code for ${inv.email} — they can now re-register`);
      fixed++;
    }
  }
  if (brokenInvites.length === 0) console.log('   ✅ No broken invite codes');

  // --- Fix 4: Auto-provision auth accounts for employees stuck without any auth ---
  // Only do this for employees with NO invite at all (completely stuck)
  console.log('\n[Fix 4] Checking for employees with no auth and no invite...');
  const activeEmps = (employees || []).filter(e => e.active !== false && e.email);
  const noAuthNoInvite = activeEmps.filter(e => {
    const email = e.email?.toLowerCase().trim();
    const hasAuth = authByEmail.has(email);
    const hasInvite = (invitations || []).some(i => i.email?.toLowerCase().trim() === email);
    return !hasAuth && !hasInvite;
  });

  if (noAuthNoInvite.length === 0) {
    console.log('   ✅ All employees have auth accounts or pending invites');
  } else {
    console.log(`   ⚠️  ${noAuthNoInvite.length} employee(s) have no auth AND no invite:`);
    noAuthNoInvite.forEach(e => {
      console.log(`      → ${e.email} (${e.name}) — needs a new invite code from manager`);
    });
    console.log('   ℹ️  These employees need you to generate a new invite from the Invite Staff panel.');
  }

  // --- Summary ---
  console.log('\n' + '='.repeat(50));
  console.log(`✅ Fixed: ${fixed} issues`);
  console.log(`❌ Failed: ${failed} issues`);
  console.log('='.repeat(50));
  console.log('\nDone! Re-run npm run diagnose:login to verify.\n');
}

fixLoginIssues().catch(err => {
  console.error('\n❌ Fix script failed:', err.message);
  process.exit(1);
});
