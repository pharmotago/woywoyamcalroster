import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || 'https://gcslfkujlfnznedatrsn.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabaseAdmin = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});

function jsonRes(res: VercelResponse, data: unknown, status = 200) {
  return res.status(status).json(data);
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

  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const windowStr = thirtyDaysAgo.toISOString().split('T')[0];

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

    return jsonRes(res, {
      success: true,
      employees,
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
