/**
 * Phase 1: Budgewoi DDS Data Export Script
 * ==========================================
 * Exports all Budgewoi-specific data from the shared database via the authenticated
 * sync endpoint and generates SQL INSERT statements for the new Budgewoi Supabase project.
 *
 * Usage: npm run export:budgewoi
 * Output: scripts/budgewoi_export.sql
 */
import * as fs from 'fs';
import * as path from 'path';

function escapeSQL(val) {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'boolean') return val ? 'true' : 'false';
  if (typeof val === 'number') return String(val);
  if (typeof val === 'object') return `'${JSON.stringify(val).replace(/'/g, "''")}'::jsonb`;
  return `'${String(val).replace(/'/g, "''")}'`;
}

async function exportBudgewoiData() {
  const lines = [];
  lines.push('-- ============================================');
  lines.push('-- Budgewoi DDS Standalone Database Import Script');
  lines.push('-- Generated: ' + new Date().toISOString());
  lines.push('-- Target: NEW Standalone Budgewoi Supabase Project');
  lines.push('-- ============================================');
  lines.push('');

  console.log('Fetching live Budgewoi data via sync API (pharmotago@gmail.com)...');
  const syncResp = await fetch('https://woywoyamcalroster.vercel.app/api/schedule/sync', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-user-email': 'pharmotago@gmail.com',
      'x-pharmacy-id': 'budgewoi_dds'
    },
    body: JSON.stringify({
      email: 'pharmotago@gmail.com',
      pharmacyId: 'budgewoi_dds'
    })
  });

  if (!syncResp.ok) {
    const errText = await syncResp.text();
    console.error(`Sync API error (HTTP ${syncResp.status}):`, errText);
    process.exit(1);
  }

  const payload = await syncResp.json();
  const budgewoiEmployees = payload.employees || [];
  const budgewoiShifts = payload.shifts || [];
  const budgewoiSettings = payload.settings || {};
  const budgewoiTimecards = payload.timecards || [];
  const budgewoiLeave = payload.leaveRequests || [];

  console.log(`Received:`);
  console.log(`- Employees: ${budgewoiEmployees.length}`);
  console.log(`- Shifts: ${budgewoiShifts.length}`);
  console.log(`- Timecards: ${budgewoiTimecards.length}`);
  console.log(`- Leave Requests: ${budgewoiLeave.length}`);

  // 1. Export Employees
  lines.push('-- =====================');
  lines.push('-- 1. EMPLOYEES (' + budgewoiEmployees.length + ' records)');
  lines.push('-- =====================');
  for (const e of budgewoiEmployees) {
    // Strip multi-tenant tags from availability since this will be a single-tenant store
    const cleanAvail = { ...(e.availability || {}) };
    delete cleanAvail.pharmacy_id;
    delete cleanAvail.pharmacyId;

    lines.push(`INSERT INTO public.brisk_employees (id, name, email, role, phone, hourly_rate, max_hours, availability, active, created_at) VALUES (${escapeSQL(e.id)}, ${escapeSQL(e.name)}, ${escapeSQL(e.email)}, ${escapeSQL(e.role)}, ${escapeSQL(e.phone || null)}, ${escapeSQL(e.hourly_rate || 0)}, ${escapeSQL(e.max_hours || 38)}, ${escapeSQL(cleanAvail)}, ${escapeSQL(e.active ?? true)}, ${escapeSQL(e.created_at || new Date().toISOString())}) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, email = EXCLUDED.email, role = EXCLUDED.role, hourly_rate = EXCLUDED.hourly_rate, availability = EXCLUDED.availability;`);
  }
  lines.push('');

  // 2. Export Shifts
  lines.push('-- =====================');
  lines.push('-- 2. SHIFTS (' + budgewoiShifts.length + ' records)');
  lines.push('-- =====================');
  for (const s of budgewoiShifts) {
    // Clean store tags from notes
    let cleanNotes = s.notes || '';
    cleanNotes = cleanNotes.replace(/\[store:budgewoi_dds\]\s*/gi, '').trim() || null;

    lines.push(`INSERT INTO public.brisk_shifts (id, employee_id, date, start_time, end_time, role, status, notes, created_at) VALUES (${escapeSQL(s.id)}, ${escapeSQL(s.employee_id || s.employeeId)}, ${escapeSQL(s.date)}, ${escapeSQL(s.start_time || s.startTime)}, ${escapeSQL(s.end_time || s.endTime)}, ${escapeSQL(s.role)}, ${escapeSQL(s.status || 'published')}, ${escapeSQL(cleanNotes)}, ${escapeSQL(s.created_at || new Date().toISOString())}) ON CONFLICT (id) DO NOTHING;`);
  }
  lines.push('');

  // 3. Export Settings (as global_settings)
  lines.push('-- =====================');
  lines.push('-- 3. SETTINGS (renamed to global_settings for single-tenant Budgewoi)');
  lines.push('-- =====================');
  const companyName = 'Budgewoi Discount Drug Stores Rosters';
  const tradingHours = budgewoiSettings.trading_hours || {
    "1": { "open": "08:30", "close": "18:00", "closed": false },
    "2": { "open": "08:30", "close": "18:00", "closed": false },
    "3": { "open": "08:30", "close": "18:00", "closed": false },
    "4": { "open": "08:30", "close": "18:00", "closed": false },
    "5": { "open": "08:30", "close": "18:00", "closed": false },
    "6": { "open": "08:30", "close": "13:00", "closed": false },
    "0": { "open": "00:00", "close": "00:00", "closed": true }
  };
  lines.push(`INSERT INTO public.brisk_settings (id, company_name, trading_hours) VALUES ('global_settings', ${escapeSQL(companyName)}, ${escapeSQL(tradingHours)}) ON CONFLICT (id) DO UPDATE SET company_name = EXCLUDED.company_name, trading_hours = EXCLUDED.trading_hours;`);
  lines.push('');

  // 4. Export Users
  lines.push('-- =====================');
  lines.push('-- 4. USERS (Leadership & Registered Staff)');
  lines.push('-- =====================');
  // Georgi Peek (Dispensary Manager) and Owners (Peter, Katherine, Glen)
  const defaultUsers = [
    { email: 'pharmotago@gmail.com', name: 'Peter Kim', role: 'owner' },
    { email: 'nguyek@gmail.com', name: 'Katherine Nguyen', role: 'owner' },
    { email: 'glenkanawati@gmail.com', name: 'Glen Kanawati', role: 'owner' },
    { email: 'georgi.peek6@gmail.com', name: 'Georgi Peek', role: 'manager' }
  ];

  for (const u of defaultUsers) {
    const matchedEmp = budgewoiEmployees.find(e => (e.email || '').toLowerCase().trim() === u.email.toLowerCase());
    const empId = matchedEmp ? matchedEmp.id : null;
    lines.push(`INSERT INTO public.brisk_users (email, password_hash, role, employee_id, name) VALUES (${escapeSQL(u.email)}, 'SUPABASE_AUTH_MANAGED', ${escapeSQL(u.role)}, ${escapeSQL(empId)}, ${escapeSQL(u.name)}) ON CONFLICT (email) DO UPDATE SET role = EXCLUDED.role, employee_id = EXCLUDED.employee_id;`);
  }
  lines.push('');

  // 5. Export Timecards
  if (budgewoiTimecards.length > 0) {
    lines.push('-- =====================');
    lines.push('-- 5. TIMECARDS (' + budgewoiTimecards.length + ' records)');
    lines.push('-- =====================');
    for (const tc of budgewoiTimecards) {
      lines.push(`INSERT INTO public.brisk_timecards (id, employee_id, date, clock_in, clock_out, breaks, total_hours, approved, approved_by, created_at) VALUES (${escapeSQL(tc.id)}, ${escapeSQL(tc.employee_id || tc.employeeId)}, ${escapeSQL(tc.date)}, ${escapeSQL(tc.clock_in || tc.clockIn)}, ${escapeSQL(tc.clock_out || tc.clockOut)}, ${escapeSQL(tc.breaks || [])}, ${escapeSQL(tc.total_hours || tc.totalHours || 0)}, ${escapeSQL(tc.approved ?? false)}, ${escapeSQL(tc.approved_by || tc.approvedBy || null)}, ${escapeSQL(tc.created_at || new Date().toISOString())}) ON CONFLICT (id) DO NOTHING;`);
    }
    lines.push('');
  }

  // 6. Export Leave Requests
  if (budgewoiLeave.length > 0) {
    lines.push('-- =====================');
    lines.push('-- 6. LEAVE REQUESTS (' + budgewoiLeave.length + ' records)');
    lines.push('-- =====================');
    for (const lr of budgewoiLeave) {
      lines.push(`INSERT INTO public.brisk_leave_requests (id, employee_id, start_date, end_date, reason, status, created_at) VALUES (${escapeSQL(lr.id)}, ${escapeSQL(lr.employee_id || lr.employeeId)}, ${escapeSQL(lr.start_date || lr.startDate)}, ${escapeSQL(lr.end_date || lr.endDate)}, ${escapeSQL(lr.reason)}, ${escapeSQL(lr.status || 'Pending')}, ${escapeSQL(lr.created_at || new Date().toISOString())}) ON CONFLICT (id) DO NOTHING;`);
    }
    lines.push('');
  }

  const outputPath = path.join(process.cwd(), 'scripts', 'budgewoi_export.sql');
  fs.writeFileSync(outputPath, lines.join('\n'), 'utf-8');

  console.log('\n========================================');
  console.log('✅ EXPORT COMPLETE!');
  console.log('========================================');
  console.log(`Saved SQL to: ${outputPath}`);
  console.log(`Employees: ${budgewoiEmployees.length}`);
  console.log(`Shifts: ${budgewoiShifts.length}`);
  console.log(`Timecards: ${budgewoiTimecards.length}`);
  console.log(`Leave Requests: ${budgewoiLeave.length}`);
  console.log(`Total SQL Statements: ${lines.filter(l => l.startsWith('INSERT')).length}`);
}

exportBudgewoiData().catch(err => {
  console.error('Export failed:', err);
  process.exit(1);
});
