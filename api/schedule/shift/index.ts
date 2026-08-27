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

function formatTimeHHmm(t: unknown): string {
  if (!t) return '';
  const str = String(t).trim();
  return str.length >= 5 ? str.substring(0, 5) : str;
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
      const { action, shift, shifts, id } = body;

      // 1. Action: Create Shift
      if (action === 'create') {
        const s = shift || body;
        const newObj: Record<string, unknown> = {
          employee_id: s.employee_id || s.employeeId || null,
          date: s.date,
          start_time: formatTimeHHmm(s.start_time || s.startTime),
          end_time: formatTimeHHmm(s.end_time || s.endTime),
          role: s.role || 'Pharmacy Assistant',
          notes: s.notes || ''
        };
        if (s.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s.id)) {
          newObj.id = s.id;
        }

        const { data, error } = await supabaseAdmin
          .from('brisk_shifts')
          .insert([newObj])
          .select()
          .maybeSingle();

        if (error) {
          console.error('[ShiftAPI] Create error:', error);
          return jsonRes(res, { error: error.message }, 500);
        }

        return jsonRes(res, { success: true, shift: data }, 200);
      }

      // 2. Action: Update Shift
      if (action === 'update' || (!action && shift && shift.id)) {
        const s = shift || body;
        const targetId = s.id || id;
        if (!targetId) return jsonRes(res, { error: 'Shift ID is required for update.' }, 400);

        const updateObj: Record<string, unknown> = {};
        if (s.employee_id !== undefined || s.employeeId !== undefined) {
          updateObj.employee_id = s.employee_id !== undefined ? s.employee_id : s.employeeId;
        }
        if (s.date !== undefined) updateObj.date = s.date;
        if (s.start_time !== undefined || s.startTime !== undefined) {
          updateObj.start_time = formatTimeHHmm(s.start_time || s.startTime);
        }
        if (s.end_time !== undefined || s.endTime !== undefined) {
          updateObj.end_time = formatTimeHHmm(s.end_time || s.endTime);
        }
        if (s.role !== undefined) updateObj.role = s.role;
        if (s.notes !== undefined) updateObj.notes = s.notes || '';

        const { data, error } = await supabaseAdmin
          .from('brisk_shifts')
          .update(updateObj)
          .eq('id', targetId)
          .select()
          .maybeSingle();

        if (error) {
          console.error('[ShiftAPI] Update error:', error);
          return jsonRes(res, { error: error.message }, 500);
        }

        return jsonRes(res, { success: true, shift: data }, 200);
      }

      // 3. Action: Delete Shift
      if (action === 'delete') {
        const targetId = id || body.id;
        if (!targetId) return jsonRes(res, { error: 'Shift ID is required for delete.' }, 400);

        const { error } = await supabaseAdmin
          .from('brisk_shifts')
          .delete()
          .eq('id', targetId);

        if (error) {
          console.error('[ShiftAPI] Delete error:', error);
          return jsonRes(res, { error: error.message }, 500);
        }

        return jsonRes(res, { success: true, deletedId: targetId }, 200);
      }

      // 4. Action: Batch Upsert Shifts
      if (action === 'batchUpdate' || action === 'batchInsert' || Array.isArray(shifts)) {
        const shiftsArray = shifts || body.shifts || [];
        const mappedShifts = shiftsArray.map((s: any) => ({
          ...(s.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s.id) ? { id: s.id } : {}),
          employee_id: s.employee_id !== undefined ? s.employee_id : (s.employeeId || null),
          date: s.date,
          start_time: formatTimeHHmm(s.start_time || s.startTime),
          end_time: formatTimeHHmm(s.end_time || s.endTime),
          role: s.role || 'Pharmacy Assistant',
          notes: s.notes || ''
        }));

        const { data, error } = await supabaseAdmin
          .from('brisk_shifts')
          .upsert(mappedShifts)
          .select();

        if (error) {
          console.error('[ShiftAPI] Batch upsert error:', error);
          return jsonRes(res, { error: error.message }, 500);
        }

        return jsonRes(res, { success: true, shifts: data || [] }, 200);
      }

      return jsonRes(res, { error: 'Unsupported action.' }, 400);
    }

    if (req.method === 'GET') {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const windowStr = thirtyDaysAgo.toISOString().split('T')[0];

      const { data: shifts, error } = await supabaseAdmin
        .from('brisk_shifts')
        .select('*')
        .gte('date', windowStr);

      if (error) throw error;
      return jsonRes(res, { success: true, shifts: shifts || [] }, 200);
    }

    return jsonRes(res, { error: 'Method not allowed' }, 405);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[ShiftAPI] Internal error:', msg);
    return jsonRes(res, { error: msg }, 500);
  }
}
