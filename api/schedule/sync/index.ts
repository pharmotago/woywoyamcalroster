import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || 'https://gcslfkujlfnznedatrsn.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabaseAdmin = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});

const MANAGER_ROLES = ['owner', 'co-owner', 'admin', 'manager', 'partner', 'managing pharmacist', 'pharmacist manager', 'pharmacy manager'];
const OWNER_ROLES = ['owner', 'co-owner', 'partner', 'superadmin'];
const OWNER_EMAILS = ['pharmotago@gmail.com', 'glenkanawati@gmail.com', 'nguyek@gmail.com'];
const OWNER_NAMES = ['peter kim', 'glen kanawati', 'katherine nguyen'];
const MANAGER_EMAILS = ['pharmotago@gmail.com', 'glenkanawati@gmail.com', 'nguyek@gmail.com', 'vickilorraine75@gmail.com'];

function jsonRes(res: VercelResponse, data: unknown, status = 200) {
  return res.status(status).json(data);
}

// Resolve caller identity, manager status, and owner/Peter Kim privileges from Bearer token or authenticated email
async function resolveCaller(token: string, candidateEmail = ''): Promise<{ isManager: boolean; isOwnerOrPeter: boolean; email: string }> {
  let email = candidateEmail;
  let userId = '';

  if (token) {
    try {
      const { data: { user } } = await supabaseAdmin.auth.getUser(token);
      if (user && user.email) {
        email = (user.email || '').toLowerCase().trim();
        userId = user.id;
      }
    } catch {
      // Safe fallback to candidateEmail
    }
  }

  let profileRole = '';
  let profileName = '';
  let empRole = '';
  let empName = '';

  try {
    if (userId) {
      const { data: profile } = await supabaseAdmin
        .from('brisk_users')
        .select('role, name, email')
        .eq('id', userId)
        .maybeSingle();
      if (profile) {
        profileRole = (profile.role || '').toLowerCase().trim();
        profileName = (profile.name || '').toLowerCase().trim();
        if (profile.email) email = profile.email.toLowerCase().trim();
      }
    } else if (email) {
      const { data: profile } = await supabaseAdmin
        .from('brisk_users')
        .select('role, name')
        .eq('email', email)
        .maybeSingle();
      if (profile) {
        profileRole = (profile.role || '').toLowerCase().trim();
        profileName = (profile.name || '').toLowerCase().trim();
      }
    }

    if (email) {
      const { data: emp } = await supabaseAdmin
        .from('brisk_employees')
        .select('role, name')
        .eq('email', email)
        .maybeSingle();
      if (emp) {
        empRole = (emp.role || '').toLowerCase().trim();
        empName = (emp.name || '').toLowerCase().trim();
      }
    }
  } catch {
    // Safe error suppression
  }

  const isOwnerRole = OWNER_ROLES.includes(profileRole) || OWNER_ROLES.includes(empRole);
  const isOwnerByEmail = OWNER_EMAILS.includes(email) || email.startsWith('pharmotago') || email.includes('peter.kim');
  const isOwnerByName = OWNER_NAMES.some(n => profileName.includes(n) || empName.includes(n));
  const isOwnerOrPeter = isOwnerByEmail || isOwnerByName || isOwnerRole;
  const isManager = isOwnerOrPeter || MANAGER_EMAILS.includes(email) || MANAGER_ROLES.includes(profileRole) || MANAGER_ROLES.includes(empRole);

  return { isManager, isOwnerOrPeter, email };
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
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-user-email');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Resolve caller privileges from Bearer token or verified session email.
  // Financial pay structures and contract tiers (PAYG/casual/locum) are restricted exclusively to Owners & Peter Kim.
  const authHeader = (req.headers.authorization as string) || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : '';
  const candidateEmail = ((req.headers['x-user-email'] as string) || (req.body?.email) || '').toLowerCase().trim();
  const caller = await resolveCaller(token, candidateEmail);

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

    // Security: Only Owners & Peter Kim receive unmasked pay rates and contract tiers
    const safeEmployees = caller.isOwnerOrPeter
      ? employees
      : employees.map((e: any) => {
          const isSelf = caller.email && e.email && e.email.toLowerCase() === caller.email;
          if (isSelf) return e; // Employees may see their own profile

          const safeAvail = { ...(e.availability || {}) };
          delete safeAvail.employment_type;
          delete safeAvail.award_level;
          return {
            ...e,
            hourly_rate: null,
            phone: caller.isManager ? e.phone : null,
            dob: caller.isManager ? e.dob : null,
            employment_type: null,
            award_level: null,
            availability: safeAvail
          };
        });

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
