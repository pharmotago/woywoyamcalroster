import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || 'https://gcslfkujlfnznedatrsn.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabaseAdmin = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});

const MANAGER_ROLES = ['owner', 'co-owner', 'admin', 'manager', 'partner', 'managing pharmacist', 'pharmacist manager', 'pharmacy manager'];
const MANAGER_EMAILS = ['pharmotago@gmail.com', 'glenkanawati@gmail.com', 'nguyek@gmail.com', 'vickilorraine75@gmail.com'];

function jsonRes(res: VercelResponse, data: unknown, status = 200) {
  return res.status(status).json(data);
}

// Bug #7 Fix: Resolve whether the calling user is a manager.
// Returns true only for confirmed manager/owner roles. Unauthenticated = false.
async function resolveIsManager(token: string): Promise<boolean> {
  if (!token) return false;
  try {
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !user) return false;
    const email = (user.email || '').toLowerCase().trim();
    if (MANAGER_EMAILS.includes(email) || email.startsWith('pharmotago')) return true;
    // Check brisk_users table for role
    const { data: profile } = await supabaseAdmin
      .from('brisk_users')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();
    if (profile && MANAGER_ROLES.includes((profile.role || '').toLowerCase().trim())) return true;
    // Fallback: check brisk_employees by email
    const { data: emp } = await supabaseAdmin
      .from('brisk_employees')
      .select('role')
      .eq('email', user.email)
      .maybeSingle();
    if (emp && MANAGER_ROLES.includes((emp.role || '').toLowerCase().trim())) return true;
    return false;
  } catch {
    return false;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const origin = (req.headers.origin as string) || '';
  const allowedOrigins = [
    'https://woywoyamcalroster.vercel.app',
    'http://localhost:3000',
    'http://localhost:3002',
    'http://127.0.0.1:3000',
    'http://localhost:5173'
  ];
  if (allowedOrigins.includes(origin) || origin.endsWith('.vercel.app')) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', 'https://woywoyamcalroster.vercel.app');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Resolve caller's manager status from Bearer token.
  // Non-managers receive employee data with sensitive fields (hourly_rate, phone, dob) masked as null.
  const authHeader = (req.headers.authorization as string) || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : '';
  const isManager = await resolveIsManager(token);

  res.setHeader('Cache-Control', 'private, max-age=30');

  try {
    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
    const windowStr = fourteenDaysAgo.toISOString().split('T')[0];

    const [empRes, shiftRes, tcRes, leaveRes, settingsRes] = await Promise.all([
      supabaseAdmin.from('brisk_employees').select('*'),
      supabaseAdmin.from('brisk_shifts').select('*').gte('date', windowStr),
      supabaseAdmin.from('brisk_timecards').select('*').gte('date', windowStr),
      supabaseAdmin.from('brisk_leave_requests').select('*').gte('end_date', windowStr),
      supabaseAdmin.from('brisk_settings').select('*').limit(1).maybeSingle()
    ]);

    if (empRes.error) throw empRes.error;
    if (shiftRes.error) throw shiftRes.error;

    const allEmployees = empRes.data || [];
    const systemRolesEmp = allEmployees.find((e: any) => e.email === 'system_roles@brisk.internal');
    const employees = allEmployees.filter((e: any) => e.email !== 'system_roles@brisk.internal');

    // Security: strip sensitive fields for non-managers
    const safeEmployees = isManager
      ? employees
      : employees.map((e: any) => ({ ...e, hourly_rate: null, phone: null, dob: null }));

    return jsonRes(res, {
      success: true,
      employees: safeEmployees,
      shifts: shiftRes.data || [],
      timecards: tcRes.data || [],
      leaveRequests: leaveRes.data || [],
      settings: settingsRes.data || null,
      systemRoles: systemRolesEmp?.availability || null
    }, 200);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[SyncAPI] Error:', msg);
    return jsonRes(res, { error: msg }, 500);
  }
}
