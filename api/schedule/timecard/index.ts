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
      const { action, timecard, id } = body;

      // 1. Action: Add or Update Timecard (Clock-in / Clock-out / Break / Approval)
      if (action === 'upsert' || action === 'update' || action === 'add' || timecard) {
        const tcData = timecard || body;
        const obj: Record<string, unknown> = {
          id: tcData.id || id || `tc_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
          employee_id: tcData.employee_id || tcData.employeeId,
          date: tcData.date,
          clock_in: tcData.clock_in || tcData.clockIn || null,
          clock_out: tcData.clock_out || tcData.clockOut || null,
          breaks: tcData.breaks || [],
          total_hours: tcData.total_hours != null ? tcData.total_hours : (tcData.totalHours != null ? tcData.totalHours : 0),
          approved: !!(tcData.approved),
          approved_by: tcData.approved_by || tcData.approvedBy || null
        };

        const { data, error } = await supabaseAdmin
          .from('brisk_timecards')
          .upsert([obj])
          .select()
          .maybeSingle();

        if (error) {
          console.error('[TimecardAPI] Upsert error:', error);
          return jsonRes(res, { error: error.message }, 500);
        }

        return jsonRes(res, { success: true, timecard: data }, 200);
      }

      // 2. Action: Approve / Unapprove Timecard
      if (action === 'approve' || action === 'unapprove') {
        const targetId = id || body.id;
        const isApproved = action === 'approve';
        const approvedBy = body.approvedBy || body.approved_by || 'Manager';

        const { data, error } = await supabaseAdmin
          .from('brisk_timecards')
          .update({ approved: isApproved, approved_by: isApproved ? approvedBy : null })
          .eq('id', targetId)
          .select()
          .maybeSingle();

        if (error) {
          console.error('[TimecardAPI] Approval error:', error);
          return jsonRes(res, { error: error.message }, 500);
        }

        return jsonRes(res, { success: true, timecard: data }, 200);
      }

      return jsonRes(res, { error: 'Unsupported action.' }, 400);
    }

    if (req.method === 'GET') {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const windowStr = thirtyDaysAgo.toISOString().split('T')[0];

      const { data: timecards, error } = await supabaseAdmin
        .from('brisk_timecards')
        .select('*')
        .gte('date', windowStr);

      if (error) throw error;
      return jsonRes(res, { success: true, timecards: timecards || [] }, 200);
    }

    return jsonRes(res, { error: 'Method not allowed' }, 405);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[TimecardAPI] Internal error:', msg);
    return jsonRes(res, { error: msg }, 500);
  }
}
