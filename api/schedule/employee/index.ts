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
    if (req.method === 'POST') {
      const body = req.body || {};
      const { action, employee, id } = body;

      // 1. Action: Create Employee
      if (action === 'create') {
        const empData = employee || body;
        const newObj: Record<string, unknown> = {
          name: empData.name,
          email: (empData.email || '').toLowerCase().trim(),
          role: empData.role || 'Pharmacy Assistant',
          phone: empData.phone || null,
          hourly_rate: empData.hourly_rate != null ? empData.hourly_rate : (empData.hourlyRate || 0),
          max_hours: empData.max_hours != null ? empData.max_hours : (empData.maxHours || 38),
          availability: empData.availability || {},
          active: empData.active !== undefined ? !!empData.active : true
        };
        if (empData.id) newObj.id = empData.id;

        const { data, error } = await supabaseAdmin
          .from('brisk_employees')
          .insert([newObj])
          .select()
          .maybeSingle();

        if (error) {
          console.error('[EmployeeAPI] Create error:', error);
          return jsonRes(res, { error: error.message }, 500);
        }

        return jsonRes(res, { success: true, employee: data }, 200);
      }

      // 2. Action: Update Employee (Name, Role, Rate, Availability, etc.)
      if (action === 'update' || (!action && employee && employee.id)) {
        const empData = employee || body;
        const targetId = empData.id || id;
        if (!targetId) return jsonRes(res, { error: 'Employee ID is required for update.' }, 400);

        const updateObj: Record<string, unknown> = {};
        if (empData.name !== undefined) updateObj.name = empData.name;
        if (empData.email !== undefined) updateObj.email = (empData.email || '').toLowerCase().trim();
        if (empData.role !== undefined) updateObj.role = empData.role;
        if (empData.phone !== undefined) updateObj.phone = empData.phone || null;
        if (empData.hourly_rate !== undefined) updateObj.hourly_rate = empData.hourly_rate;
        else if (empData.hourlyRate !== undefined) updateObj.hourly_rate = empData.hourlyRate;
        if (empData.max_hours !== undefined) updateObj.max_hours = empData.max_hours;
        else if (empData.maxHours !== undefined) updateObj.max_hours = empData.maxHours;
        if (empData.availability !== undefined) updateObj.availability = empData.availability;
        if (empData.active !== undefined) updateObj.active = !!empData.active;

        const { data, error } = await supabaseAdmin
          .from('brisk_employees')
          .update(updateObj)
          .eq('id', targetId)
          .select()
          .maybeSingle();

        if (error) {
          console.error('[EmployeeAPI] Update error:', error);
          return jsonRes(res, { error: error.message }, 500);
        }

        return jsonRes(res, { success: true, employee: data }, 200);
      }

      // 3. Action: Soft Delete / Deactivate Employee
      if (action === 'delete') {
        const targetId = id || body.id;
        if (!targetId) return jsonRes(res, { error: 'Employee ID is required for delete.' }, 400);

        const { data, error } = await supabaseAdmin
          .from('brisk_employees')
          .update({ active: false })
          .eq('id', targetId)
          .select()
          .maybeSingle();

        if (error) {
          console.error('[EmployeeAPI] Delete error:', error);
          return jsonRes(res, { error: error.message }, 500);
        }

        return jsonRes(res, { success: true, employee: data }, 200);
      }

      return jsonRes(res, { error: 'Unsupported action.' }, 400);
    }

    if (req.method === 'GET') {
      const { data: employees, error } = await supabaseAdmin
        .from('brisk_employees')
        .select('*')
        .neq('email', 'system_roles@brisk.internal');

      if (error) throw error;
      return jsonRes(res, { success: true, employees: employees || [] }, 200);
    }

    return jsonRes(res, { error: 'Method not allowed' }, 405);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[EmployeeAPI] Internal error:', msg);
    return jsonRes(res, { error: msg }, 500);
  }
}
