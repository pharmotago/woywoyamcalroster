import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || 'https://gcslfkujlfnznedatrsn.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdjc2xma3VqbGZuem5lZGF0cnNuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0OTEwODksImV4cCI6MjA5MjA2NzA4OX0.qCfeYYF2rcqfz_t2-wxLAE0fiosy9C2sbG3BShYVIT0';

const supabaseAdmin = createClient(supabaseUrl, supabaseKey, {
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

    // 1. Check if user exists in auth.users
    let authUser: any = null;
    if (supabaseKey) {
      try {
        const listRes = await supabaseAdmin.auth.admin.listUsers();
        const users: any[] = listRes.data?.users || [];
        authUser = users.find((u: any) => u.email?.toLowerCase().trim() === cleanEmail);
      } catch (listErr) {
        console.warn('[LoginAPI] listUsers note:', listErr);
      }
    }

    // 2. If user exists but email is not confirmed, confirm it (legacy support)
    if (authUser && !authUser.email_confirmed_at && supabaseKey) {
      try {
        await supabaseAdmin.auth.admin.updateUserById(authUser.id, { email_confirm: true });
      } catch (confirmErr) {
        console.warn('[LoginAPI] confirm email note:', confirmErr);
      }
    }

    // 3. Attempt authentication with clean client
    const { data: signInData, error: signInErr } = await supabaseClient.auth.signInWithPassword({
      email: cleanEmail,
      password: password
    });

    if (signInErr) {
      if (signInErr.message.toLowerCase().includes('invalid login credentials')) {
        return jsonRes(res, { error: 'Invalid email or password. If you forgot your password, please click Forgot Password below.' }, 401);
      }
      return jsonRes(res, { error: signInErr.message }, 401);
    }

    if (!signInData?.user) {
      return jsonRes(res, { error: 'Authentication failed. Please try again.' }, 401);
    }

    // 4. Resolve User Profile & Role
    let userProfile: any = null;
    if (supabaseKey) {
      const { data: prof } = await supabaseAdmin
        .from('brisk_users')
        .select('*')
        .eq('id', signInData.user.id)
        .maybeSingle();
      userProfile = prof;

      // Self-healing: if auth user exists but brisk_users is missing (orphaned auth)
      if (!userProfile) {
        const { data: empData } = await supabaseAdmin
          .from('brisk_employees')
          .select('*')
          .ilike('email', cleanEmail)
          .maybeSingle();

        const autoRole = (empData?.role && (empData.role.toLowerCase().includes('manager') || empData.role.toLowerCase().includes('owner') || empData.role.toLowerCase().includes('admin'))) ? 'manager' : 'employee';
        const autoName = empData?.name || signInData.user.user_metadata?.name || cleanEmail.split('@')[0] || 'Staff Member';

        const { data: createdProf } = await supabaseAdmin
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

        if (createdProf) {
          userProfile = createdProf;
        }
      }
    }

    let resolvedRole = userProfile?.role || 'employee';
    if (userProfile?.employee_id && supabaseKey) {
      const { data: empData } = await supabaseAdmin
        .from('brisk_employees')
        .select('role')
        .eq('id', userProfile.employee_id)
        .maybeSingle();
      if (empData?.role && (empData.role.toLowerCase().includes('manager') || empData.role.toLowerCase().includes('owner') || empData.role.toLowerCase().includes('admin'))) {
        resolvedRole = 'manager';
      }
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
    console.error('[LoginAPI] Error:', msg);
    return jsonRes(res, { error: msg }, 500);
  }
}
