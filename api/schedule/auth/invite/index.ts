import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || 'https://gcslfkujlfnznedatrsn.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseAdmin = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});

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
      .eq('email', user.email?.toLowerCase().trim())
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

async function sendInviteEmail(toEmail: string, code: string, inviteUrl: string, role: string, pharmacyId: string = 'amcal_woywoy') {
  const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com';
  const smtpPort = parseInt(process.env.SMTP_PORT || '465', 10);
  const smtpUser = process.env.SMTP_USER || '';
  const smtpPass = process.env.SMTP_PASS || '';

  if (!smtpPass || !smtpUser) {
    console.warn('SMTP not configured, skipping invite email');
    return { sent: false, error: 'SMTP not configured' };
  }

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: { user: smtpUser, pass: smtpPass }
  });

  const roleName = role === 'manager' ? 'Manager' : 'Staff Member';
  const isBudgewoi = pharmacyId === 'budgewoi_dds';
  const pharmacyName = isBudgewoi ? 'Budgewoi Discount Drug Stores' : 'Amcal Pharmacy Woy Woy';
  const gradientHeader = isBudgewoi ? 'linear-gradient(135deg, #7a2682 0%, #ff6b00 100%)' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';

  const mailOptions = {
    from: `"${pharmacyName} Roster" <${smtpUser}>`,
    to: toEmail,
    subject: `🎉 You're Invited to Join ${pharmacyName} Roster!`,
    text: `You have been invited to join ${pharmacyName} Roster as a ${roleName}.\n\nYour invitation code: ${code}\n\nClick the link below to register:\n${inviteUrl}\n\nOr enter the code manually when registering.\n\nThis invitation is for ${toEmail} only.`,
    html: `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
        <div style="background: ${gradientHeader}; padding: 40px 30px; border-radius: 12px 12px 0 0; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 28px;">🎉 You're Invited!</h1>
          <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 16px;">Join ${pharmacyName} Roster as a ${roleName}</p>
        </div>
        <div style="padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
          <p style="color: #374151; font-size: 16px; line-height: 1.6;">Hello!</p>
          <p style="color: #374151; font-size: 16px; line-height: 1.6;">You've been invited to join <strong>${pharmacyName} Roster</strong> — the employee scheduling system for our pharmacy team.</p>
          
          <div style="background: #f3f4f6; border-radius: 8px; padding: 20px; margin: 25px 0; text-align: center;">
            <p style="color: #6b7280; font-size: 14px; margin: 0 0 8px 0;">Your Invitation Code</p>
            <p style="font-size: 32px; font-weight: bold; color: ${isBudgewoi ? '#7a2682' : '#667eea'}; letter-spacing: 4px; margin: 0;">${code}</p>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${inviteUrl}" style="display: inline-block; background: ${gradientHeader}; color: #ffffff; text-decoration: none; padding: 14px 40px; border-radius: 8px; font-size: 16px; font-weight: 600;">Register Now →</a>
          </div>

          <p style="color: #9ca3af; font-size: 13px; text-align: center; margin-top: 30px; border-top: 1px solid #e5e7eb; padding-top: 20px;">
            This invitation is for <strong>${toEmail}</strong> only.<br>
            If you didn't expect this email, please ignore it.
          </p>
        </div>
      </div>
    `
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    return { sent: true, messageId: info.messageId };
  } catch (err: any) {
    console.error('Failed to send invite email:', err.message, err.code, err.response);
    return { sent: false, error: err.message, code: err.code };
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  const origin = req.headers.origin || '';
  const allowedOrigins = ['https://woywoyamcalroster.vercel.app', 'https://budgewoiddsroster.vercel.app', 'http://localhost:3000', 'http://localhost:3002'];
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
    const requester = await getRequestUser(req);
    if (!requester.isAuthenticated || (requester.role !== 'owner' && requester.role !== 'manager')) {
      return jsonRes(res, { error: 'Access denied. Managers or owners only.' }, 403);
    }

    const { email, role, store, tenant, pharmacyId } = req.body;
    if (!email || !role) {
      return jsonRes(res, { error: 'Email and role are required.' }, 400);
    }

    function normalizePharmacyId(raw: unknown): 'amcal_woywoy' | 'budgewoi_dds' {
      if (!raw) return 'amcal_woywoy';
      const s = String(raw).toLowerCase().trim();
      if (s.includes('budgewoi') || s.includes('dds')) return 'budgewoi_dds';
      return 'amcal_woywoy';
    }

    const targetPharmacy = normalizePharmacyId(
      (req.headers['x-pharmacy-id'] as string) ||
      store ||
      tenant ||
      pharmacyId ||
      origin
    );

    const dbRole = (role === 'owner' || role === 'manager') ? 'manager' : 'employee';
    const code = crypto.randomBytes(3).toString('hex').toUpperCase();
    const targetEmail = email.toLowerCase().trim();

    const { error } = await supabaseAdmin
      .from('brisk_invitations')
      .insert({
        code,
        email: targetEmail,
        role: dbRole,
        used: false
      });

    if (error) throw error;

    const isBudgewoi = targetPharmacy === 'budgewoi_dds';
    const baseOrigin = isBudgewoi 
      ? 'https://budgewoiddsroster.vercel.app' 
      : (origin && !origin.includes('localhost') ? origin : 'https://woywoyamcalroster.vercel.app');
    const inviteUrl = `${baseOrigin}/?invite=${code}&store=${targetPharmacy}`;

    // Send invitation email
    const emailResult = await sendInviteEmail(targetEmail, code, inviteUrl, dbRole, targetPharmacy);

    return jsonRes(res, {
      success: true,
      code,
      inviteUrl,
      pharmacyId: targetPharmacy,
      emailSent: emailResult.sent,
      emailError: emailResult.sent ? undefined : emailResult.error
    }, 200);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return jsonRes(res, { error: message }, 500);
  }
}
