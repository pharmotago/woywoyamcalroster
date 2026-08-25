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
      const { action, id, status, leaveRequest } = body;

      // 1. Action: Decide Leave Request (Approve / Reject / Pending)
      if (action === 'decide') {
        if (!id || !status) {
          return jsonRes(res, { error: 'Leave request ID and status are required.' }, 400);
        }

        const validStatuses = ['Approved', 'Rejected', 'Pending'];
        if (!validStatuses.includes(status)) {
          return jsonRes(res, { error: `Invalid status: ${status}. Must be one of ${validStatuses.join(', ')}` }, 400);
        }

        // Update leave request with service_role admin (bypasses RLS locks)
        const { data: updatedLr, error: updateErr } = await supabaseAdmin
          .from('brisk_leave_requests')
          .update({ status })
          .eq('id', id)
          .select()
          .maybeSingle();

        if (updateErr) {
          console.error('[LeaveAPI] Update error:', updateErr);
          return jsonRes(res, { error: updateErr.message }, 500);
        }

        // If Approved, handle shift unassignments for the leave period
        if (status === 'Approved' && updatedLr) {
          try {
            const empId = updatedLr.employee_id;
            const startDate = updatedLr.start_date;
            const endDate = updatedLr.end_date;

            if (empId && startDate && endDate) {
              const { data: conflictingShifts } = await supabaseAdmin
                .from('brisk_shifts')
                .select('*')
                .eq('employee_id', empId)
                .gte('date', startDate)
                .lte('date', endDate);

              if (conflictingShifts && conflictingShifts.length > 0) {
                await supabaseAdmin
                  .from('brisk_shifts')
                  .update({ employee_id: null })
                  .eq('employee_id', empId)
                  .gte('date', startDate)
                  .lte('date', endDate);
                console.log(`[LeaveAPI] Unassigned ${conflictingShifts.length} conflicting shifts for employee ${empId}`);
              }
            }
          } catch (shiftErr) {
            console.warn('[LeaveAPI] Warning: Shift unassignment note:', shiftErr);
          }
        }

        return jsonRes(res, { success: true, leaveRequest: updatedLr }, 200);
      }

      // 2. Action: Create Leave Request
      if (action === 'create' || leaveRequest) {
        const lrData = leaveRequest || body;
        const newObj = {
          id: lrData.id || `lr_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
          employee_id: lrData.employee_id || lrData.employeeId,
          start_date: lrData.start_date || lrData.startDate,
          end_date: lrData.end_date || lrData.endDate,
          reason: lrData.reason || '',
          status: lrData.status || 'Pending'
        };

        const { data: inserted, error: insertErr } = await supabaseAdmin
          .from('brisk_leave_requests')
          .insert([newObj])
          .select()
          .maybeSingle();

        if (insertErr) {
          console.error('[LeaveAPI] Insert error:', insertErr);
          return jsonRes(res, { error: insertErr.message }, 500);
        }

        return jsonRes(res, { success: true, leaveRequest: inserted }, 200);
      }

      return jsonRes(res, { error: 'Unsupported action.' }, 400);
    }

    if (req.method === 'GET') {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const windowStr = thirtyDaysAgo.toISOString().split('T')[0];

      const { data: leaveRequests, error } = await supabaseAdmin
        .from('brisk_leave_requests')
        .select('*')
        .gte('end_date', windowStr);

      if (error) throw error;
      return jsonRes(res, { success: true, leaveRequests: leaveRequests || [] }, 200);
    }

    return jsonRes(res, { error: 'Method not allowed' }, 405);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[LeaveAPI] Internal error:', msg);
    return jsonRes(res, { error: msg }, 500);
  }
}
