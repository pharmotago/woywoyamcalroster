import type { VercelRequest, VercelResponse } from '@vercel/node';
import nodemailer from 'nodemailer';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || 'https://gcslfkujlfnznedatrsn.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
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
    const user = await getRequestUser(req);

    // Permission check: Only managers or owners can send roster emails
    if (!user.isAuthenticated || (user.role !== 'owner' && user.role !== 'manager')) {
      return jsonRes(res, { error: 'Access denied. Managers or owners only.' }, 403);
    }

    const { employeeId, weekStart, rosterText } = req.body;

    if (!employeeId || !rosterText) {
      return jsonRes(res, { error: 'employeeId and rosterText are required.' }, 400);
    }

    // Fetch employee details from Supabase brisk_employees
    const { data: employee, error: empErr } = await supabaseAdmin
      .from('brisk_employees')
      .select('*')
      .eq('id', employeeId)
      .maybeSingle();

    if (empErr || !employee) {
      return jsonRes(res, { error: 'Employee not found.' }, 404);
    }

    if (!employee.email) {
      return jsonRes(res, { error: 'Employee profile has no email address.' }, 400);
    }

    if (!process.env.SMTP_PASS || !process.env.SMTP_USER) {
      return jsonRes(res, { error: 'SMTP server not configured' }, 500);
    }

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '465', 10),
      secure: parseInt(process.env.SMTP_PORT || '465', 10) === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });

    const mailOptions = {
      from: `"Amcal Woy Woy Roster" <${process.env.SMTP_USER || 'amcalwoywoy@gmail.com'}>`,
      to: employee.email,
      subject: `📅 Your Work Schedule Briefing — Week of ${weekStart}`,
      text: rosterText,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
          <h2 style="color: #e67e22;">Hello, ${employee.name}!</h2>
          <p>Your work schedule for the week of <strong>${weekStart}</strong> is ready.</p>
          <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #e67e22;">
            <pre style="font-family: monospace; font-size: 14px; margin: 0; white-space: pre-wrap;">${rosterText}</pre>
          </div>
          <p>Please log in to your dashboard if you need to request any time off.</p>
          <p style="color: #888; font-size: 12px; margin-top: 30px;">This is an automated message from Amcal Woy Woy Roster.</p>
        </div>
      `
    };

    // Send email
    await transporter.sendMail(mailOptions);

    return jsonRes(res, {
      success: true,
      message: `Roster email successfully sent to ${employee.name} (${employee.email}).`
    }, 200);

  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error occurred';
    return jsonRes(res, { error: message }, 500);
  }
}
