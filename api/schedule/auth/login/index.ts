import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || 'https://gcslfkujlfnznedatrsn.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdjc2xma3VqbGZuem5lZGF0cnNuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0OTEwODksImV4cCI6MjA5MjA2NzA4OX0.qCfeYYF2rcqfz_t2-wxLAE0fiosy9C2sbG3BShYVIT0';

const supabaseAdmin = createClient(supabaseUrl, supabaseKey!, {
  auth: { persistSession: false, autoRefreshToken: false }
});

const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
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
  if (req.method !== 'POST') return jsonRes(res, { error: 'Method not allowed' }, 405);

  try {
    const { email, password } = req.body || {};
    if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
      return jsonRes(res, { error: 'Email and password are required.' }, 400);
    }

    const cleanEmail = email.toLowerCase().trim();

    // 1. Auto-confirm unconfirmed email if the user exists in auth.users
    //    This handles cases where email confirmation was bypassed during registration.
    if (supabaseKey) {
      try {
        const listRes = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
        const users: any[] = listRes.data?.users || [];
        const authUser = users.find((u: any) => u.email?.toLowerCase().trim() === cleanEmail);
        if (authUser && !authUser.email_confirmed_at) {
          await supabaseAdmin.auth.admin.updateUserById(authUser.id, { email_confirm: true });
          console.log(`[LoginAPI] Auto-confirmed email for: ${cleanEmail}`);
        }
      } catch (listErr) {
        console.warn('[LoginAPI] Pre-auth check note (non-fatal):', listErr);
      }
    }

    // 2. Attempt authentication
    const { data: signInData, error: signInErr } = await supabaseClient.auth.signInWithPassword({
      email: cleanEmail,
      password: password
    });

    if (signInErr) {
      if (signInErr.message.toLowerCase().includes('invalid login credentials')) {
        return jsonRes(res, { error: 'Invalid email or password. If you forgot your password, please click Forgot Password below.' }, 401);
      }
      if (signInErr.message.toLowerCase().includes('email not confirmed')) {
        return jsonRes(res, { error: 'Email address not confirmed. Please use Forgot Password to reset and verify your account.' }, 401);
      }
      console.error(`[LoginAPI] signInWithPassword error for ${cleanEmail}:`, signInErr.message);
      return jsonRes(res, { error: signInErr.message }, 401);
    }

    if (!signInData?.user) {
      return jsonRes(res, { error: 'Authentication failed. Please try again.' }, 401);
    }

    // 3. Resolve User Profile & Role
    let userProfile: any = null;
    if (supabaseKey) {
      const { data: prof, error: profErr } = await supabaseAdmin
        .from('brisk_users')
        .select('*')
        .eq('id', signInData.user.id)
        .maybeSingle();

      if (profErr) {
        console.warn(`[LoginAPI] brisk_users lookup error for ${cleanEmail}:`, profErr.message);
      }
      userProfile = prof;

      // Self-healing: brisk_users row missing — auto-create it
      if (!userProfile) {
        console.log(`[LoginAPI] No brisk_users profile for ${cleanEmail}. Auto-provisioning...`);
        const { data: empData } = await supabaseAdmin
          .from('brisk_employees')
          .select('*')
          .ilike('email', cleanEmail)
          .maybeSingle();

        const isManagerRole = empData?.role && (
          empData.role.toLowerCase().includes('manager') ||
          empData.role.toLowerCase().includes('owner') ||
          empData.role.toLowerCase().includes('admin')
        );
        const isWhitelisted = ['peter', 'glen', 'katherine', 'vicky', 'pharmotago'].some(l => cleanEmail.includes(l));
        const autoRole = (isManagerRole || isWhitelisted) ? 'manager' : 'employee';
        const autoName = empData?.name || signInData.user.user_metadata?.name || cleanEmail.split('@')[0] || 'Staff Member';

        const { data: createdProf, error: createErr } = await supabaseAdmin
          .from('brisk_users')
          .upsert({
            id: signInData.user.id,
            email: cleanEmail,
            name: autoName,
            role: autoRole,
            employee_id: empData?.id || null,
            password_hash: 'SUPABASE_AUTH_MANAGED'
          })
          .select()
          .maybeSingle();

        if (createErr) {
          console.error(`[LoginAPI] Failed to auto-provision brisk_users for ${cleanEmail}:`, createErr.message);
        } else {
          console.log(`[LoginAPI] Auto-provisioned brisk_users profile for: ${cleanEmail} (role: ${autoRole})`);
          userProfile = createdProf;
        }
      }
    }

    // 4. Resolve final role (cross-check brisk_employees role)
    let resolvedRole = userProfile?.role || 'employee';
    if (userProfile?.employee_id && supabaseKey) {
      const { data: empData } = await supabaseAdmin
        .from('brisk_employees')
        .select('role')
        .eq('id', userProfile.employee_id)
        .maybeSingle();
      if (empData?.role && (
        empData.role.toLowerCase().includes('manager') ||
        empData.role.toLowerCase().includes('owner') ||
        empData.role.toLowerCase().includes('admin')
      )) {
        resolvedRole = 'manager';
      }
    }

    // Whitelist override for store leadership
    const isWhitelistedLeader = ['peter', 'glen', 'katherine', 'vicky', 'pharmotago'].some(l => cleanEmail.includes(l));
    if (isWhitelistedLeader) {
      resolvedRole = 'owner';
    }

    const sessionPayload = {
      email: signInData.user.email,
      role: resolvedRole,
      employeeId: userProfile?.employee_id || null,
      name: userProfile?.name || signInData.user.user_metadata?.name || cleanEmail.split('@')[0] || 'Staff Member',
      token: signInData.session?.access_token || '',
      refreshToken: signInData.session?.refresh_token || ''
    };

    return jsonRes(res, {
      success: true,
      session: sessionPayload,
      user: signInData.user
    }, 200);

  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[LoginAPI] Unexpected error:', msg);
    return jsonRes(res, { error: msg }, 500);
  }
}
