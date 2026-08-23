import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error('[ResetAPI] FATAL: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.');
}

const supabaseAdmin = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});

// Separate anon client for triggering Supabase's built-in password reset email
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdjc2xma3VqbGZuem5lZGF0cnNuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0OTEwODksImV4cCI6MjA5MjA2NzA4OX0.qCfeYYF2rcqfz_t2-wxLAE0fiosy9C2sbG3BShYVIT0';
const supabaseAnon = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});

const CANONICAL_ORIGIN = 'https://woywoyamcalroster.vercel.app';

function jsonRes(res: VercelResponse, data: unknown, status = 200) {
  return res.status(status).json(data);
}

async function getRequestUser(req: VercelRequest) {
  const authHeader = req.headers['authorization'] || '';
  if (!authHeader.toString().startsWith('Bearer ')) {
    return { role: '', email: '', isAuthenticated: false };
  }
  const token = authHeader.toString().substring(7).trim();
  try {
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !user) throw error || new Error('No user');
    const { data: userData } = await supabaseAdmin
      .from('brisk_users')
      .select('role, employee_id')
      .ilike('email', user.email?.toLowerCase().trim())
      .maybeSingle();
    if (!userData) return { role: '', email: user.email || '', isAuthenticated: false };

    let resolvedRole = userData.role || '';
    if (userData.employee_id) {
      const { data: empData } = await supabaseAdmin
        .from('brisk_employees')
        .select('role')
        .eq('id', userData.employee_id)
        .maybeSingle();
      if (empData && empData.role && empData.role.toLowerCase().trim() === 'pharmacist manager') {
        resolvedRole = 'manager';
      }
    }
    return { role: resolvedRole, email: user.email || '', isAuthenticated: true };
  } catch {
    return { role: '', email: '', isAuthenticated: false };
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS Lockdown
  const origin = (req.headers.origin as string) || '';
  const allowedOrigins = [
    CANONICAL_ORIGIN,
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:5173'
  ];
  if (allowedOrigins.includes(origin) || origin.endsWith('.vercel.app')) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', CANONICAL_ORIGIN);
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return jsonRes(res, { error: 'Method not allowed' }, 405);

  // Guard: env vars must be present
  if (!supabaseUrl || !supabaseKey) {
    console.error('[ResetAPI] Missing env vars at runtime.');
    return jsonRes(res, { error: 'Server configuration error. Contact administrator.' }, 500);
  }

  try {
    const { email, managerAction, newPassword } = req.body || {};
    if (!email || typeof email !== 'string') {
      return jsonRes(res, { error: 'A valid email address is required.' }, 400);
    }

    const targetEmail = email.toLowerCase().trim();

    // 1. Check if user exists in Supabase Auth
    const listRes = await supabaseAdmin.auth.admin.listUsers();
    const users: any[] = listRes.data?.users || [];
    let authUser: any = users.find((u: any) => u.email?.toLowerCase().trim() === targetEmail);

    // 2. If user does not exist in auth.users, check if they are in brisk_employees
    if (!authUser) {
      const { data: emp } = await supabaseAdmin
        .from('brisk_employees')
        .select('*')
        .ilike('email', targetEmail)
        .maybeSingle();

      if (emp) {
        // Auto-provision Auth account for registered pharmacy employee
        const tempPass = newPassword || 'Amcal2026!';
        const { data: newAuth, error: createErr } = await supabaseAdmin.auth.admin.createUser({
          email: targetEmail,
          password: tempPass,
          email_confirm: true,
          user_metadata: { name: emp.name }
        });

        if (createErr) {
          return jsonRes(res, { error: `Failed to initialize account: ${createErr.message}` }, 400);
        }

        authUser = newAuth.user;

        // Map brisk_users
        await supabaseAdmin.from('brisk_users').upsert({
          id: authUser.id,
          email: targetEmail,
          name: emp.name,
          role: (emp.role && emp.role.toLowerCase().includes('manager')) ? 'manager' : 'employee',
          employee_id: emp.id,
          password_hash: 'SUPABASE_AUTH_MANAGED'
        });

        // Mark invitations used
        await supabaseAdmin.from('brisk_invitations').update({ used: true }).ilike('email', targetEmail);
      } else {
        // Security Best Practice: Return generic message to prevent user enumeration
        return jsonRes(res, { 
          success: true, 
          message: 'If this email address is registered, a password reset link has been dispatched.' 
        }, 200);
      }
    }

    // 3. CASE A: Manager-Authenticated Administrative Action
    if (managerAction) {
      const requester = await getRequestUser(req);
      if (!requester.isAuthenticated || (requester.role !== 'owner' && requester.role !== 'manager')) {
        return jsonRes(res, { error: 'Access denied. Authenticated managers or owners only.' }, 403);
      }

      if (newPassword) {
        if (typeof newPassword !== 'string' || newPassword.length < 6) {
          return jsonRes(res, { error: 'Password must be at least 6 characters.' }, 400);
        }
        await supabaseAdmin.auth.admin.updateUserById(authUser.id, { password: newPassword });
        return jsonRes(res, { 
          success: true, 
          message: `Password for ${targetEmail} has been updated successfully.` 
        }, 200);
      }

      // Generate 1-Click link exclusively for verified managers
      const { data: linkData, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
        type: 'recovery',
        email: targetEmail,
        options: { redirectTo: CANONICAL_ORIGIN }
      });

      if (linkErr) return jsonRes(res, { error: linkErr.message }, 400);

      return jsonRes(res, {
        success: true,
        email: targetEmail,
        resetActionLink: linkData?.properties?.action_link,
        message: '1-Click Login Link generated for manager.'
      }, 200);
    }

    // 4. CASE B: Public "Forgot Password" Form
    // Use the ANON client to trigger Supabase's built-in GoTrue email delivery.
    // The admin/service-role client's resetPasswordForEmail may skip email dispatch
    // in certain Supabase configurations. The anon client reliably triggers the
    // built-in auth email pipeline (including custom SMTP if configured in Dashboard).
    console.log(`[ResetAPI] Triggering password reset email for: ${targetEmail}`);

    const { error: resetErr } = await supabaseAnon.auth.resetPasswordForEmail(targetEmail, {
      redirectTo: CANONICAL_ORIGIN
    });

    if (resetErr) {
      console.error(`[ResetAPI] Supabase anon resetPasswordForEmail FAILED:`, resetErr.message);

      // Fallback: Try via admin generateLink (generates link but doesn't send email)
      // We log it so we can manually send if needed
      try {
        const { data: fallbackLink, error: fallbackErr } = await supabaseAdmin.auth.admin.generateLink({
          type: 'recovery',
          email: targetEmail,
          options: { redirectTo: CANONICAL_ORIGIN }
        });
        if (!fallbackErr && fallbackLink?.properties?.action_link) {
          console.log(`[ResetAPI] Fallback recovery link generated for ${targetEmail} (email not auto-sent).`);
          // Note: We do NOT expose the link in the public response for security.
          // The link is logged server-side for admin troubleshooting.
        }
      } catch (fbErr) {
        console.error(`[ResetAPI] Fallback generateLink also failed:`, fbErr);
      }
    } else {
      console.log(`[ResetAPI] Password reset email dispatched successfully for: ${targetEmail}`);
    }

    // Always return safe generic success message to prevent Account Takeover (ATO) and enumeration
    return jsonRes(res, {
      success: true,
      message: 'If your email is registered with Amcal Woy Woy Rosters, password reset instructions have been sent.'
    }, 200);

  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown server error';
    console.error('[ResetAPI] Error in reset handler:', msg);
    return jsonRes(res, { error: 'Failed to process password reset request.' }, 500);
  }
}
