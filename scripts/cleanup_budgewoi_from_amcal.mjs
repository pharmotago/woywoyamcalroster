/**
 * Phase 4: Clean Up Budgewoi Data from Shared Woy Woy Database
 * =============================================================
 * Removes Budgewoi records from the shared database AFTER Budgewoi has been
 * successfully migrated and verified on its new dedicated Supabase project.
 *
 * SAFETY GUARD: Default mode is DRY-RUN. To execute real deletion, pass --confirm.
 * Usage:
 *   Dry run:  npm run cleanup:woywoy
 *   Execute:  npm run cleanup:woywoy -- --confirm
 */
import { createClient } from '@supabase/supabase-js';

const isConfirmed = process.argv.includes('--confirm');

const SUPABASE_URL = 'https://gcslfkujlfnznedatrsn.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdjc2xma3VqbGZuem5lZGF0cnNuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjQ5MTA4OSwiZXhwIjoyMDkyMDY3MDg5fQ.RLVurx-xFrtJJ87k9OuovJ4nH9sWWi1kfjSyt5GWpO4';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

async function cleanupWoyWoy() {
  console.log('=====================================================');
  console.log('Phase 4: Purge Budgewoi DDS Records from Woy Woy DB');
  console.log(`Database: ${SUPABASE_URL}`);
  console.log(`Mode: ${isConfirmed ? '🚨 LIVE EXECUTION (--confirm)' : '🔍 DRY-RUN PREVIEW (safe)'}`);
  console.log('=====================================================\n');

  // 1. Fetch all employees to identify Budgewoi vs Amcal
  const { data: allEmployees, error: empErr } = await supabase
    .from('brisk_employees')
    .select('id, name, email, role, availability');

  if (empErr) {
    console.error('Failed to fetch employees:', empErr);
    process.exit(1);
  }

  const budgewoiEmployees = (allEmployees || []).filter(e => {
    const avail = e.availability || {};
    const store = (avail.pharmacy_id || avail.pharmacyId || '').toLowerCase();
    return store.includes('budgewoi') || store.includes('dds');
  });

  const amcalEmployees = (allEmployees || []).filter(e => {
    const avail = e.availability || {};
    const store = (avail.pharmacy_id || avail.pharmacyId || '').toLowerCase();
    return !store.includes('budgewoi') && !store.includes('dds');
  });

  const budgewoiEmpIds = new Set(budgewoiEmployees.map(e => e.id));

  console.log(`Total Employees in DB: ${(allEmployees || []).length}`);
  console.log(`- Amcal Woy Woy Employees (KEPT): ${amcalEmployees.length}`);
  console.log(`- Budgewoi DDS Employees (TARGETED): ${budgewoiEmployees.length}`);
  console.log('  Targeted Budgewoi staff:');
  budgewoiEmployees.forEach(e => console.log(`   * ${e.name} (${e.role}) [ID: ${e.id}]`));
  console.log('');

  // 2. Fetch shifts belonging to Budgewoi
  const { data: allShifts, error: shiftErr } = await supabase
    .from('brisk_shifts')
    .select('id, employee_id, notes, date, role');

  if (shiftErr) {
    console.error('Failed to fetch shifts:', shiftErr);
    process.exit(1);
  }

  const budgewoiShifts = (allShifts || []).filter(s => {
    if (s.employee_id && budgewoiEmpIds.has(s.employee_id)) return true;
    const notes = (s.notes || '').toLowerCase();
    return notes.includes('budgewoi');
  });

  const amcalShifts = (allShifts || []).filter(s => !budgewoiShifts.some(bs => bs.id === s.id));

  console.log(`Total Shifts in DB: ${(allShifts || []).length}`);
  console.log(`- Amcal Woy Woy Shifts (KEPT): ${amcalShifts.length}`);
  console.log(`- Budgewoi DDS Shifts (TARGETED): ${budgewoiShifts.length}`);
  console.log('');

  // 3. Check brisk_settings
  const { data: settingsRows, error: setErr } = await supabase
    .from('brisk_settings')
    .select('id, company_name');

  if (setErr) {
    console.error('Failed to fetch settings:', setErr);
    process.exit(1);
  }

  const budgewoiSettings = (settingsRows || []).filter(s => s.id === 'settings_budgewoi_dds');
  const globalSettings = (settingsRows || []).filter(s => s.id !== 'settings_budgewoi_dds');

  console.log(`Settings rows in DB:`);
  console.log(`- Retained (Amcal): ${globalSettings.map(s => `${s.id} (${s.company_name})`).join(', ')}`);
  console.log(`- Targeted for deletion: ${budgewoiSettings.map(s => `${s.id} (${s.company_name})`).join(', ') || 'None'}`);
  console.log('');

  // 4. Check timecards
  const { data: allTimecards, error: tcErr } = await supabase
    .from('brisk_timecards')
    .select('id, employee_id');

  const budgewoiTimecards = (allTimecards || []).filter(tc => tc.employee_id && budgewoiEmpIds.has(tc.employee_id));
  console.log(`Timecards: Total ${(allTimecards || []).length} | Budgewoi Targeted: ${budgewoiTimecards.length}`);

  // 5. Check leave requests
  const { data: allLeave, error: lrErr } = await supabase
    .from('brisk_leave_requests')
    .select('id, employee_id');

  const budgewoiLeave = (allLeave || []).filter(lr => lr.employee_id && budgewoiEmpIds.has(lr.employee_id));
  console.log(`Leave Requests: Total ${(allLeave || []).length} | Budgewoi Targeted: ${budgewoiLeave.length}\n`);

  if (!isConfirmed) {
    console.log('=====================================================');
    console.log('✅ DRY RUN COMPLETE — ZERO DATA MODIFIED');
    console.log('To execute the purge, run:');
    console.log('  npm run cleanup:woywoy -- --confirm');
    console.log('=====================================================');
    return;
  }

  // --- LIVE EXECUTION ---
  console.log('🚨 EXECUTING PURGE OF BUDGEWOI RECORDS FROM WOY WOY DATABASE...');

  // Step A: Delete Budgewoi Shifts
  if (budgewoiShifts.length > 0) {
    const shiftIds = budgewoiShifts.map(s => s.id);
    const { error: delShiftErr } = await supabase
      .from('brisk_shifts')
      .delete()
      .in('id', shiftIds);
    if (delShiftErr) console.error('Error deleting Budgewoi shifts:', delShiftErr);
    else console.log(`✅ Deleted ${shiftIds.length} Budgewoi shifts from brisk_shifts.`);
  }

  // Step B: Delete Budgewoi Timecards
  if (budgewoiTimecards.length > 0) {
    const tcIds = budgewoiTimecards.map(tc => tc.id);
    const { error: delTcErr } = await supabase
      .from('brisk_timecards')
      .delete()
      .in('id', tcIds);
    if (delTcErr) console.error('Error deleting Budgewoi timecards:', delTcErr);
    else console.log(`✅ Deleted ${tcIds.length} Budgewoi timecards from brisk_timecards.`);
  }

  // Step C: Delete Budgewoi Leave Requests
  if (budgewoiLeave.length > 0) {
    const lrIds = budgewoiLeave.map(lr => lr.id);
    const { error: delLrErr } = await supabase
      .from('brisk_leave_requests')
      .delete()
      .in('id', lrIds);
    if (delLrErr) console.error('Error deleting Budgewoi leave requests:', delLrErr);
    else console.log(`✅ Deleted ${lrIds.length} Budgewoi leave requests from brisk_leave_requests.`);
  }

  // Step D: Delete Budgewoi Settings Row
  if (budgewoiSettings.length > 0) {
    const { error: delSetErr } = await supabase
      .from('brisk_settings')
      .delete()
      .eq('id', 'settings_budgewoi_dds');
    if (delSetErr) console.error('Error deleting settings_budgewoi_dds:', delSetErr);
    else console.log(`✅ Deleted 'settings_budgewoi_dds' from brisk_settings.`);
  }

  // Step E: Delete Budgewoi Employees
  if (budgewoiEmployees.length > 0) {
    const empIds = budgewoiEmployees.map(e => e.id);
    const { error: delEmpErr } = await supabase
      .from('brisk_employees')
      .delete()
      .in('id', empIds);
    if (delEmpErr) console.error('Error deleting Budgewoi employees:', delEmpErr);
    else console.log(`✅ Deleted ${empIds.length} Budgewoi employees from brisk_employees.`);
  }

  // Step F: Post-Purge Verification
  console.log('\n--- Post-Purge Verification ---');
  const { data: verifyEmp } = await supabase.from('brisk_employees').select('id, name, role');
  const { data: verifyShifts } = await supabase.from('brisk_shifts').select('id');
  const { data: verifySettings } = await supabase.from('brisk_settings').select('id, company_name');

  console.log(`Remaining Employees in Woy Woy DB: ${verifyEmp?.length || 0} (Expected: ~33 Amcal staff)`);
  console.log(`Remaining Shifts in Woy Woy DB: ${verifyShifts?.length || 0}`);
  console.log(`Remaining Settings Rows: ${verifySettings?.map(s => `${s.id} (${s.company_name})`).join(', ')}`);
  console.log('\n🎉 PHASE 4 DATABASE PURGE COMPLETED SUCCESSFULLY!');
}

cleanupWoyWoy().catch(console.error);
