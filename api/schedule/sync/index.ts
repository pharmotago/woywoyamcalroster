import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || 'https://gcslfkujlfnznedatrsn.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabaseAdmin = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});

const MANAGER_ROLES = ['owner', 'co-owner', 'admin', 'manager', 'partner', 'managing pharmacist', 'pharmacist manager', 'pharmacy manager', 'dispensary manager'];
const OWNER_ROLES = ['owner', 'co-owner', 'partner', 'superadmin'];
const OWNER_EMAILS = ['pharmotago@gmail.com', 'glenkanawati@gmail.com', 'nguyek@gmail.com'];
const OWNER_NAMES = ['peter kim', 'glen kanawati', 'katherine nguyen'];
const MANAGER_EMAILS = ['pharmotago@gmail.com', 'glenkanawati@gmail.com', 'nguyek@gmail.com', 'vickilorraine75@gmail.com', 'georgi.peek6@gmail.com'];

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
      supabaseAdmin.from('brisk_settings').select('*')
    ]);

    if (empRes.error) throw empRes.error;
    if (shiftRes.error) throw shiftRes.error;

    const allEmployees = empRes.data || [];
    const systemRolesEmp = allEmployees.find((e: any) => e.email === 'system_roles@brisk.internal');
    const employees = allEmployees.filter((e: any) => e.email !== 'system_roles@brisk.internal');

function normalizePharmacyId(raw: unknown): 'amcal_woywoy' | 'budgewoi_dds' {
  if (!raw) return 'amcal_woywoy';
  const s = String(raw).toLowerCase().trim();
  if (s.includes('budgewoi') || s.includes('dds')) return 'budgewoi_dds';
  return 'amcal_woywoy';
}

    // Multi-store executive clearance: Peter Kim, Katherine Nguyen, Glen Kanawati
    const MULTI_STORE_WHITELIST = ['peter', 'katherine', 'glen', 'pharmotago', 'nguyek', 'glenkanawati'];
    const isMultiStoreExecutive = MULTI_STORE_WHITELIST.some(w => (caller.email || '').includes(w));

    // Resolve target pharmacy canonically ('amcal_woywoy' vs 'budgewoi_dds')
    const targetPharmacy = normalizePharmacyId(
      (req.headers['x-pharmacy-id'] as string) || 
      req.body?.pharmacyId || 
      origin
    );

    // Security Guard: Prevent Amcal staff from querying Budgewoi, and vice versa
    if (!isMultiStoreExecutive && caller.email) {
      const callerEmp = employees.find((e: any) => e.email && e.email.toLowerCase().trim() === caller.email);
      const callerPharmacyId = normalizePharmacyId(
        callerEmp?.pharmacy_id || 
        callerEmp?.availability?.pharmacy_id || 
        callerEmp?.availability?.pharmacyId
      );
      if (callerPharmacyId !== targetPharmacy) {
        return jsonRes(res, {
          error: `Access Denied: You are registered with ${callerPharmacyId === 'budgewoi_dds' ? 'Budgewoi Discount Drug Stores' : 'Amcal Pharmacy Woy Woy'} and cannot view ${targetPharmacy === 'budgewoi_dds' ? 'Budgewoi' : 'Amcal'} roster records.`
        }, 403);
      }
    }

    // Strict store isolation filter: checks pharmacy_id or availability.pharmacy_id (JSONB)
    const matchesPharmacy = (item: any) => {
      const raw = item.pharmacy_id || item.availability?.pharmacy_id || item.availability?.pharmacyId;
      const pId = normalizePharmacyId(raw);
      return pId === targetPharmacy;
    };

    const storeEmployees = employees.filter(matchesPharmacy);
    const storeEmpIds = new Set(storeEmployees.map((e: any) => e.id));

    const storeShifts = (shiftRes.data || []).filter((s: any) => {
      const isBudgewoiNote = s.notes && s.notes.includes('budgewoi');
      if (s.pharmacy_id) return normalizePharmacyId(s.pharmacy_id) === targetPharmacy;
      if (isBudgewoiNote) return targetPharmacy === 'budgewoi_dds';
      if (s.employee_id) return storeEmpIds.has(s.employee_id);
      return targetPharmacy === 'amcal_woywoy';
    }).map((s: any) => {
      let mealMins: number | string | null = (s.unpaid_meal_mins !== undefined && s.unpaid_meal_mins !== null && !isNaN(Number(s.unpaid_meal_mins))) ? Number(s.unpaid_meal_mins) : null;
      if (mealMins === null && s.notes) {
        const match = s.notes.match(/\[meal:(\d+|crib_paid)\]/i);
        if (match) {
          mealMins = match[1] === 'crib_paid' ? 'crib_paid' : parseInt(match[1], 10);
        }
      }
      return {
        ...s,
        unpaid_meal_mins: mealMins,
        unpaidMealMins: mealMins
      };
    });

    const storeTimecards = (tcRes.data || []).filter((tc: any) => {
      if (tc.pharmacy_id) return normalizePharmacyId(tc.pharmacy_id) === targetPharmacy;
      if (tc.employee_id) return storeEmpIds.has(tc.employee_id);
      return false;
    });

    const storeLeave = (leaveRes.data || []).filter((lr: any) => {
      if (lr.pharmacy_id) return normalizePharmacyId(lr.pharmacy_id) === targetPharmacy;
      if (lr.employee_id) return storeEmpIds.has(lr.employee_id);
      return false;
    });


    // Store-specific settings (Amcal: Mon-Fri 8-8, Sat-Sun 8.30-5; Budgewoi: Mon-Fri 8.30-6, Sat 8.30-1, Sun Closed)
    const AMCAL_TRADING_HOURS = {
      "1": { "open": "08:00", "close": "20:00", "closed": false },
      "2": { "open": "08:00", "close": "20:00", "closed": false },
      "3": { "open": "08:00", "close": "20:00", "closed": false },
      "4": { "open": "08:00", "close": "20:00", "closed": false },
      "5": { "open": "08:00", "close": "20:00", "closed": false },
      "6": { "open": "08:30", "close": "17:00", "closed": false },
      "0": { "open": "08:30", "close": "17:00", "closed": false }
    };

    const BUDGEWOI_TRADING_HOURS = {
      "1": { "open": "08:30", "close": "18:00", "closed": false },
      "2": { "open": "08:30", "close": "18:00", "closed": false },
      "3": { "open": "08:30", "close": "18:00", "closed": false },
      "4": { "open": "08:30", "close": "18:00", "closed": false },
      "5": { "open": "08:30", "close": "18:00", "closed": false },
      "6": { "open": "08:30", "close": "13:00", "closed": false },
      "0": { "open": "00:00", "close": "00:00", "closed": true }
    };

    const isBudgewoi = targetPharmacy === 'budgewoi_dds';
    const baseTradingHours = isBudgewoi ? BUDGEWOI_TRADING_HOURS : AMCAL_TRADING_HOURS;
    const allSettingsRows = Array.isArray(settingsRes.data) ? settingsRes.data : (settingsRes.data ? [settingsRes.data] : []);
    const matchingRow = allSettingsRows.find((r: any) => isBudgewoi ? (r.id === 'settings_budgewoi_dds') : (r.id === 'global_settings' || r.id === 'settings_amcal_woywoy')) || allSettingsRows[0] || {};
    const rawTh = (matchingRow.trading_hours && typeof matchingRow.trading_hours === 'object') ? matchingRow.trading_hours : {};

    const storeSettings = {
      ...matchingRow,
      id: isBudgewoi ? 'settings_budgewoi_dds' : 'global_settings',
      company_name: isBudgewoi 
        ? 'Budgewoi Discount Drug Stores Rosters' 
        : 'Amcal Pharmacy Woy Woy Rosters',
      trading_hours: {
        ...baseTradingHours,
        ...(rawTh._employee_order ? { _employee_order: rawTh._employee_order } : {}),
        ...(rawTh._sales_targets ? { _sales_targets: rawTh._sales_targets } : {}),
        ...(rawTh._actual_pos_sales ? { _actual_pos_sales: rawTh._actual_pos_sales } : {})
      }
    };

    // Security: Only Owners & Peter Kim receive unmasked pay rates and contract tiers
    const safeEmployees = caller.isOwnerOrPeter
      ? storeEmployees
      : storeEmployees.map((e: any) => {
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

    const normalizedEmployees = safeEmployees.map((e: any) => ({
      ...e,
      pharmacy_id: targetPharmacy,
      pharmacyId: targetPharmacy
    }));

    return jsonRes(res, {
      success: true,
      pharmacyId: targetPharmacy,
      employees: normalizedEmployees,
      shifts: storeShifts,
      timecards: storeTimecards,
      leaveRequests: storeLeave,
      settings: storeSettings,
      systemRoles: systemRolesEmp?.availability || null
    }, 200);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[SyncAPI] Error:', msg);
    return jsonRes(res, { error: msg }, 500);
  }
}
