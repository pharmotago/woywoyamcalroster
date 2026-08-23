import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || 'https://gcslfkujlfnznedatrsn.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseAdmin = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});

function jsonRes(res: VercelResponse, data: unknown, status = 200) {
  return res.status(status).json(data);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  const origin = req.headers.origin || '';
  const allowedOrigins = ['https://woywoyamcalroster.vercel.app', 'http://localhost:3000', 'http://localhost:3002'];
  res.setHeader('Access-Control-Allow-Origin', allowedOrigins.includes(origin) ? origin : 'https://woywoyamcalroster.vercel.app');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return jsonRes(res, { error: 'Method not allowed' }, 405);

  try {
    const { email, password, name, inviteCode } = req.body;

    if (typeof email !== 'string' || typeof password !== 'string' || typeof name !== 'string') {
      return jsonRes(res, { error: 'Email, password, and name are required strings.' }, 400);
    }
    if (typeof inviteCode !== 'string' || !inviteCode.trim()) {
      return jsonRes(res, { error: 'An invitation code is required to register.' }, 400);
    }

    const targetEmail = email.toLowerCase().trim();

    // 1. Verify invitation code
    const { data: invite, error: inviteFindErr } = await supabaseAdmin
      .from('brisk_invitations')
      .select('*')
      .eq('code', inviteCode.toUpperCase().trim())
      .maybeSingle();

    if (inviteFindErr || !invite) {
      return jsonRes(res, { error: 'Invalid invitation code.' }, 400);
    }
    if (invite.used) {
      return jsonRes(res, { error: 'This invitation code has already been used.' }, 400);
    }
    if (invite.email && invite.email.toLowerCase().trim() !== targetEmail) {
      return jsonRes(res, { error: `This invitation code is registered for email: ${invite.email}` }, 400);
    }

    const targetRole = invite.role; // 'manager' or 'employee'

    // 2. Create Auth User
    const { data: authUser, error: authCreateErr } = await supabaseAdmin.auth.admin.createUser({
      email: targetEmail,
      password: password,
      email_confirm: true,
      user_metadata: { name }
    });

    if (authCreateErr || !authUser.user) {
      const msg = authCreateErr ? authCreateErr.message : 'Unknown auth creation error';
      return jsonRes(res, { error: `Failed to create Auth user: ${msg}` }, 400);
    }

    const uid = authUser.user.id;

    // 3. Resolve or Create Employee Profile
    let employee: any = null;
    const { data: existingEmp } = await supabaseAdmin
      .from('brisk_employees')
      .select('*')
      .eq('email', targetEmail)
      .maybeSingle();

    if (existingEmp) {
      employee = existingEmp;
      if (!existingEmp.name || existingEmp.name === 'Staff Member') {
        await supabaseAdmin.from('brisk_employees').update({ name, active: true }).eq('id', existingEmp.id);
      }
    } else {
      const employeeData = {
        name,
        email: targetEmail,
        role: targetRole === 'manager' ? 'Pharmacist Manager' : 'Pharmacy Staff',
        hourly_rate: targetRole === 'manager' ? 85.00 : 25.00,
        max_hours: 38,
        availability: {
          0: null,
          1: { start: '09:00', end: '17:00' },
          2: { start: '09:00', end: '17:00' },
          3: { start: '09:00', end: '17:00' },
          4: { start: '09:00', end: '17:00' },
          5: { start: '09:00', end: '17:00' },
          6: null
        },
        active: true
      };

      const { data: newEmp, error: empErr } = await supabaseAdmin
        .from('brisk_employees')
        .insert(employeeData)
        .select()
        .single();

      if (empErr || !newEmp) {
        await supabaseAdmin.auth.admin.deleteUser(uid);
        return jsonRes(res, { error: `Failed to create employee profile: ${empErr?.message || 'Unknown'}` }, 500);
      }
      employee = newEmp;
    }

    // 4. Create User Role mapping
    const { error: roleErr } = await supabaseAdmin
      .from('brisk_users')
      .upsert({
        id: uid,
        email: targetEmail,
        password_hash: 'SUPABASE_AUTH_MANAGED',
        role: targetRole,
        employee_id: employee.id,
        name
      });

    if (roleErr) {
      if (!existingEmp) {
        await supabaseAdmin.from('brisk_employees').delete().eq('id', employee.id);
      }
      await supabaseAdmin.auth.admin.deleteUser(uid);
      return jsonRes(res, { error: `Failed to register user roles: ${roleErr.message}` }, 500);
    }

    // 5. Mark invitation as used
    await supabaseAdmin
      .from('brisk_invitations')
      .update({ used: true })
      .eq('code', invite.code);

    return jsonRes(res, { success: true, message: 'Account registered successfully.' }, 200);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return jsonRes(res, { error: message }, 500);
  }
}
