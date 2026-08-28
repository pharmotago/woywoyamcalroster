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
  if (req.method !== 'POST') return jsonRes(res, { error: 'Method not allowed' }, 405);

  try {
    // =========================================================================
    // 0. AUTHENTICATION & CALLER IDENTITY VERIFICATION (C-1 Guard)
    // =========================================================================
    const authHeader = (req.headers.authorization as string) || '';
    if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
      return jsonRes(res, { error: 'Unauthorized: Missing or invalid Authorization Bearer header.' }, 401);
    }

    const token = authHeader.substring(7).trim();
    const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token);
    if (authErr || !user) {
      return jsonRes(res, { error: 'Unauthorized: Invalid or expired session token.' }, 401);
    }

    // Look up caller profile and employee mapping in database
    const callerEmail = (user.email || '').toLowerCase().trim();
    const { data: userProfile } = await supabaseAdmin
      .from('brisk_users')
      .select('id, employee_id, role, name, email')
      .eq('id', user.id)
      .maybeSingle();

    let callerEmployeeId = userProfile?.employee_id || null;
    if (!callerEmployeeId && callerEmail) {
      const { data: empMatch } = await supabaseAdmin
        .from('brisk_employees')
        .select('id')
        .eq('email', callerEmail)
        .maybeSingle();
      if (empMatch) callerEmployeeId = empMatch.id;
    }

    const callerRole = (userProfile?.role || (user.user_metadata?.role as string) || '').toLowerCase();
    const callerName = (userProfile?.name || (user.user_metadata?.name as string) || (user.user_metadata?.full_name as string) || '').toLowerCase();
    
    // Strict manager check
    const MANAGER_NAMES_EXACT = ['peter kim', 'glen kanawati', 'katherine nguyen', 'vicki duffy', 'vicky duffy'];
    const MANAGER_EMAILS_EXACT = ['pharmotago@gmail.com', 'glenkanawati@gmail.com', 'nguyek@gmail.com', 'vickilorraine75@gmail.com'];
    const isManagerOrOwner =
      ['owner', 'admin', 'manager', 'partner', 'managing pharmacist', 'pharmacist manager'].includes(callerRole) ||
      MANAGER_EMAILS_EXACT.includes(callerEmail) ||
      MANAGER_NAMES_EXACT.includes(callerName.trim()) ||
      callerEmail.startsWith('pharmotago@');

    const body = req.body || {};
    const entity = body.entity || body.type;
    const action = body.action;

    // =========================================================================
    // 1. ENTITY: EMPLOYEE (Manager Only)
    // =========================================================================
    if (entity === 'employee') {
      if (!isManagerOrOwner) {
        return jsonRes(res, { error: 'Forbidden: Only managers and owners can manage employees.' }, 403);
      }

      const empData = body.employee || body.data || body;

      if (action === 'create') {
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

        const { data, error } = await supabaseAdmin.from('brisk_employees').insert([newObj]).select().maybeSingle();
        if (error) throw error;
        return jsonRes(res, { success: true, employee: data }, 200);
      }

      if (action === 'update') {
        const targetId = empData.id || body.id;
        if (!targetId) return jsonRes(res, { error: 'Employee ID is required.' }, 400);

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

        const { data, error } = await supabaseAdmin.from('brisk_employees').update(updateObj).eq('id', targetId).select().maybeSingle();
        if (error) throw error;
        return jsonRes(res, { success: true, employee: data }, 200);
      }

      if (action === 'delete') {
        const targetId = body.id || empData.id;
        if (!targetId) return jsonRes(res, { error: 'Employee ID is required.' }, 400);
        const { data, error } = await supabaseAdmin.from('brisk_employees').update({ active: false }).eq('id', targetId).select().maybeSingle();
        if (error) throw error;
        return jsonRes(res, { success: true, employee: data }, 200);
      }
    }

    // =========================================================================
    // 2. ENTITY: SHIFT (Manager Only)
    // =========================================================================
    if (entity === 'shift') {
      if (!isManagerOrOwner) {
        return jsonRes(res, { error: 'Forbidden: Only managers and owners can modify shifts.' }, 403);
      }

      const s = body.shift || body.data || body;

      if (action === 'create') {
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

        const { data, error } = await supabaseAdmin.from('brisk_shifts').insert([newObj]).select().maybeSingle();
        if (error) throw error;
        return jsonRes(res, { success: true, shift: data }, 200);
      }

      if (action === 'update') {
        const targetId = s.id || body.id;
        if (!targetId) return jsonRes(res, { error: 'Shift ID is required.' }, 400);

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

        const { data, error } = await supabaseAdmin.from('brisk_shifts').update(updateObj).eq('id', targetId).select().maybeSingle();
        if (error) throw error;
        return jsonRes(res, { success: true, shift: data }, 200);
      }

      if (action === 'delete') {
        const targetId = body.id || s.id;
        if (!targetId) return jsonRes(res, { error: 'Shift ID is required.' }, 400);
        const { error } = await supabaseAdmin.from('brisk_shifts').delete().eq('id', targetId);
        if (error) throw error;
        return jsonRes(res, { success: true, deletedId: targetId }, 200);
      }

      if (action === 'batchUpdate' || action === 'batchInsert' || Array.isArray(body.shifts)) {
        const shiftsArray = body.shifts || [];
        const mappedShifts = shiftsArray.map((sh: any) => ({
          ...(sh.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sh.id) ? { id: sh.id } : {}),
          employee_id: sh.employee_id !== undefined ? sh.employee_id : (sh.employeeId || null),
          date: sh.date,
          start_time: formatTimeHHmm(sh.start_time || sh.startTime),
          end_time: formatTimeHHmm(sh.end_time || sh.endTime),
          role: sh.role || 'Pharmacy Assistant',
          notes: sh.notes || ''
        }));

        const { data, error } = await supabaseAdmin.from('brisk_shifts').upsert(mappedShifts).select();
        if (error) throw error;
        return jsonRes(res, { success: true, shifts: data || [] }, 200);
      }
    }

    // =========================================================================
    // 3. ENTITY: LEAVE (C-2 Guard)
    // =========================================================================
    if (entity === 'leave') {
      const lrData = body.leaveRequest || body.data || body;

      // C-2: Only managers can approve or reject leave requests
      if (action === 'decide') {
        if (!isManagerOrOwner) {
          return jsonRes(res, { error: 'Forbidden: Only managers can approve or reject leave requests.' }, 403);
        }

        const targetId = body.id || lrData.id;
        const status = body.status || lrData.status;
        const VALID_STATUSES = ['Pending', 'Approved', 'Rejected'];
        if (!targetId || !status || !VALID_STATUSES.includes(status)) {
          return jsonRes(res, { error: 'Valid ID and status (Pending, Approved, Rejected) required.' }, 400);
        }

        const { data: updatedLr, error: updateErr } = await supabaseAdmin
          .from('brisk_leave_requests')
          .update({ status })
          .eq('id', targetId)
          .select()
          .maybeSingle();

        if (updateErr) throw updateErr;

        if (status === 'Approved' && updatedLr) {
          try {
            const empId = updatedLr.employee_id;
            const startDate = updatedLr.start_date;
            const endDate = updatedLr.end_date;
            if (empId && startDate && endDate) {
              await supabaseAdmin
                .from('brisk_shifts')
                .update({ employee_id: null })
                .eq('employee_id', empId)
                .gte('date', startDate)
                .lte('date', endDate);
            }
          } catch (shiftErr) {
            console.warn('[MutateAPI] Leave shift unassignment note:', shiftErr);
          }
        }
        return jsonRes(res, { success: true, leaveRequest: updatedLr }, 200);
      }

      if (action === 'create') {
        const targetEmpId = lrData.employee_id || lrData.employeeId;
        
        // If not manager, employee can ONLY submit leave for their own employee ID
        if (!isManagerOrOwner) {
          if (!callerEmployeeId || (targetEmpId && targetEmpId !== callerEmployeeId)) {
            return jsonRes(res, { error: 'Forbidden: Employees can only submit leave requests for themselves.' }, 403);
          }
        }

        const newObj = {
          id: lrData.id || `lr_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
          employee_id: isManagerOrOwner ? (targetEmpId || callerEmployeeId) : callerEmployeeId,
          start_date: lrData.start_date || lrData.startDate,
          end_date: lrData.end_date || lrData.endDate,
          reason: lrData.reason || '',
          status: isManagerOrOwner ? (lrData.status || 'Pending') : 'Pending' // Employees cannot auto-approve
        };

        const { data: inserted, error: insertErr } = await supabaseAdmin
          .from('brisk_leave_requests')
          .insert([newObj])
          .select()
          .maybeSingle();

        if (insertErr) throw insertErr;
        return jsonRes(res, { success: true, leaveRequest: inserted }, 200);
      }
    }

    // =========================================================================
    // 4. ENTITY: TIMECARD (C-3 & C-5 Guard)
    // =========================================================================
    if (entity === 'timecard') {
      const tcData = body.timecard || body.data || body;

      // C-3: Only managers can approve or unapprove timecards
      if (action === 'approve' || action === 'unapprove') {
        if (!isManagerOrOwner) {
          return jsonRes(res, { error: 'Forbidden: Only managers can approve or unapprove timesheets.' }, 403);
        }

        const targetId = body.id || tcData.id;
        const isApproved = action === 'approve';
        const approvedBy = body.approvedBy || body.approved_by || callerName || 'Manager';

        const { data, error } = await supabaseAdmin
          .from('brisk_timecards')
          .update({ approved: isApproved, approved_by: isApproved ? approvedBy : null })
          .eq('id', targetId)
          .select()
          .maybeSingle();

        if (error) throw error;
        return jsonRes(res, { success: true, timecard: data }, 200);
      }

      if (action === 'upsert' || action === 'add' || action === 'update') {
        const targetEmpId = tcData.employee_id || tcData.employeeId;

        // C-5: If not manager, employee can ONLY clock/upsert timecards for their own employee ID
        if (!isManagerOrOwner) {
          if (!callerEmployeeId || (targetEmpId && targetEmpId !== callerEmployeeId)) {
            return jsonRes(res, { error: 'Forbidden: Employees can only record timecards for themselves.' }, 403);
          }
        }

        const obj: Record<string, unknown> = {
          id: tcData.id || body.id || `tc_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
          employee_id: isManagerOrOwner ? (targetEmpId || callerEmployeeId) : callerEmployeeId,
          date: tcData.date,
          clock_in: tcData.clock_in || tcData.clockIn || null,
          clock_out: tcData.clock_out || tcData.clockOut || null,
          breaks: tcData.breaks || [],
          total_hours: tcData.total_hours != null ? tcData.total_hours : (tcData.totalHours != null ? tcData.totalHours : 0),
          approved: isManagerOrOwner ? !!(tcData.approved) : false, // Employees cannot self-approve
          approved_by: isManagerOrOwner ? (tcData.approved_by || tcData.approvedBy || null) : null
        };

        const { data, error } = await supabaseAdmin.from('brisk_timecards').upsert([obj]).select().maybeSingle();
        if (error) throw error;
        return jsonRes(res, { success: true, timecard: data }, 200);
      }
    }

    return jsonRes(res, { error: 'Unsupported entity or action.' }, 400);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[MutateAPI] Error:', msg);
    return jsonRes(res, { error: msg }, 500);
  }
}

