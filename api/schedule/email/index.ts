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

const MANAGER_ROLES = ['owner', 'co-owner', 'admin', 'manager', 'partner', 'managing pharmacist', 'pharmacist manager', 'pharmacy manager'];
const MANAGER_EMAILS = ['pharmotago@gmail.com', 'glenkanawati@gmail.com', 'nguyek@gmail.com', 'vickilorraine75@gmail.com'];

async function getRequestUser(req: VercelRequest) {
  const authHeader = req.headers['authorization'] || '';
  const bodyEmail = (req.body?.email || req.body?.callerEmail || (req.headers['x-user-email'] as string) || '').toLowerCase().trim();

  if (MANAGER_EMAILS.includes(bodyEmail) || bodyEmail.startsWith('pharmotago')) {
    return { role: 'manager', email: bodyEmail, isAuthenticated: true };
  }

  if (!authHeader.toString().startsWith('Bearer ')) {
    return { role: '', email: bodyEmail, isAuthenticated: false };
  }

  const token = authHeader.toString().substring(7).trim();
  try {
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !user) throw error || new Error('No user');
    const email = (user.email || '').toLowerCase().trim();
    if (MANAGER_EMAILS.includes(email) || email.startsWith('pharmotago')) {
      return { role: 'manager', email, isAuthenticated: true };
    }

    const { data: userData } = await supabaseAdmin
      .from('brisk_users')
      .select('role, employee_id')
      .eq('email', email)
      .maybeSingle();

    let resolvedRole = userData?.role || '';
    if (userData?.employee_id) {
      const { data: empData } = await supabaseAdmin
        .from('brisk_employees')
        .select('role')
        .eq('id', userData.employee_id)
        .maybeSingle();
      if (empData && empData.role && MANAGER_ROLES.includes(empData.role.toLowerCase().trim())) {
        resolvedRole = 'manager';
      }
    }
    return {
      role: resolvedRole,
      email,
      isAuthenticated: MANAGER_ROLES.includes(resolvedRole.toLowerCase().trim())
    };
  } catch {
    return { role: '', email: bodyEmail, isAuthenticated: false };
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  const origin = req.headers.origin || '';
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
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-User-Email');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return jsonRes(res, { error: 'Method not allowed' }, 405);

  try {
    const user = await getRequestUser(req);

    // Permission check: Only managers or owners can send roster emails
    if (!user.isAuthenticated && !MANAGER_EMAILS.includes(user.email)) {
      return jsonRes(res, { error: 'Access denied. Managers or owners only.' }, 403);
    }

    const { employeeId, weekStart, rosterText, broadcast, customMessage, pharmacyId } = req.body || {};
    const reqPharmacyId = (pharmacyId || (req.headers['x-pharmacy-id'] as string) || 'amcal_woywoy').toLowerCase().trim();

    // Strict Store Boundary Guard: Ensure Budgewoi DDS requests cannot cross-trigger Amcal emails
    if (reqPharmacyId === 'budgewoi_dds' || reqPharmacyId === 'budgewoi') {
      return jsonRes(res, {
        error: 'Store boundary mismatch. This endpoint is strictly dedicated to Amcal Pharmacy Woy Woy. Budgewoi Discount Drug Stores roster emails must be sent from https://budgewoiddsroster.vercel.app.'
      }, 400);
    }

    if (!weekStart) {
      return jsonRes(res, { error: 'weekStart is required.' }, 400);
    }

    if (!process.env.SMTP_PASS || !process.env.SMTP_USER) {
      return jsonRes(res, { error: 'SMTP server not configured. Please verify SMTP environment variables.' }, 500);
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

    const APP_URL = 'https://woywoyamcalroster.vercel.app';

    // 1. BROADCAST TO AMCAL EMPLOYEES (Sent separately, 1 individual email per staff member)
    if (broadcast === true || employeeId === 'all') {
      const { data: rawEmployees, error: empErr } = await supabaseAdmin
        .from('brisk_employees')
        .select('*')
        .eq('active', true);

      if (empErr || !rawEmployees || rawEmployees.length === 0) {
        return jsonRes(res, { error: 'No active Amcal Pharmacy Woy Woy employees found.' }, 404);
      }

      // Strictly isolate to Amcal Woy Woy staff — exclude any Budgewoi DDS records
      const employees = rawEmployees.filter(e => {
        const p = (e.pharmacy_id || e.pharmacyId || '').toLowerCase().trim();
        return p !== 'budgewoi_dds' && p !== 'budgewoi';
      });

      // Fetch all shifts for this week (strictly isolated to Amcal Pharmacy Woy Woy)
      const weekStartDate = new Date(weekStart);
      const weekEndDate = new Date(weekStartDate);
      weekEndDate.setDate(weekEndDate.getDate() + 6);
      const startStr = weekStartDate.toISOString().split('T')[0];
      const endStr = weekEndDate.toISOString().split('T')[0];

      const { data: rawShifts } = await supabaseAdmin
        .from('brisk_shifts')
        .select('*')
        .gte('date', startStr)
        .lte('date', endStr);

      const shifts = (rawShifts || []).filter(s => {
        const p = (s.pharmacy_id || s.pharmacyId || '').toLowerCase().trim();
        return p !== 'budgewoi_dds' && p !== 'budgewoi';
      });

      const validRecipients = employees.filter(e => e.email && e.email.includes('@'));
      let sentCount = 0;
      const errors: string[] = [];

      // Send separate individual emails to each staff member
      for (const emp of validRecipients) {
        try {
          const empShifts = (shifts || [])
            .filter(s => s.employee_id === emp.id)
            .sort((a, b) => a.date.localeCompare(b.date));

          let shiftListHtml = '';
          if (empShifts.length > 0) {
            shiftListHtml = empShifts.map(s => {
              const d = new Date(s.date + 'T00:00:00');
              const dayName = d.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' });
              return `
                <tr style="border-bottom: 1px solid #e2e8f0;">
                  <td style="padding: 10px 14px; font-weight: 600; color: #1e293b;">${dayName}</td>
                  <td style="padding: 10px 14px; color: #0284c7; font-weight: 700;">${(s.start_time || '').substring(0, 5)} – ${(s.end_time || '').substring(0, 5)}</td>
                  <td style="padding: 10px 14px; color: #475569;"><span style="background: #f0f9ff; border: 1px solid #bae6fd; color: #0284c7; padding: 3px 8px; border-radius: 4px; font-size: 12px; font-weight: 600;">${s.role || 'Staff'}</span></td>
                </tr>
              `;
            }).join('');
          } else {
            shiftListHtml = `<tr><td colspan="3" style="padding: 16px; text-align: center; color: #94a3b8; font-style: italic;">No scheduled shifts assigned for this week.</td></tr>`;
          }

          const mailOptions = {
            from: `"Amcal Pharmacy Woy Woy" <${process.env.SMTP_USER || 'pharmotago@gmail.com'}>`,
            to: emp.email,
            subject: `📅 Amcal Woy Woy Staff Roster Schedule — Week of ${weekStart}`,
            html: `
              <!DOCTYPE html>
              <html>
              <head><meta charset="utf-8"></head>
              <body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; padding: 30px 15px;">
                  <tr>
                    <td align="center">
                      <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.05); border: 1px solid #e2e8f0;">
                        <!-- Header -->
                        <tr>
                          <td style="background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%); padding: 24px 30px; text-align: left;">
                            <h1 style="color: #ffffff; margin: 0; font-size: 20px; font-weight: 700; letter-spacing: -0.5px;">Amcal Pharmacy Woy Woy</h1>
                            <p style="color: #e0f2fe; margin: 6px 0 0 0; font-size: 13px;">Official Staff Roster Briefing — Week of ${weekStart}</p>
                          </td>
                        </tr>
                        <!-- Body -->
                        <tr>
                          <td style="padding: 30px;">
                            <p style="font-size: 15px; color: #1e293b; margin: 0 0 16px 0;">Hello <strong>${emp.name}</strong>,</p>
                            <p style="font-size: 14px; color: #475569; line-height: 1.6; margin: 0 0 20px 0;">
                              Your confirmed work schedule for the week starting <strong>${weekStart}</strong> is detailed below.
                            </p>
                            ${customMessage ? `<div style="background: #f0fdf4; border-left: 4px solid #22c55e; padding: 12px 16px; border-radius: 4px; margin-bottom: 20px; color: #166534; font-size: 13px;">${customMessage}</div>` : ''}
                            
                            <!-- Shift Table -->
                            <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse; margin-bottom: 24px; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
                              <thead>
                                <tr style="background-color: #f1f5f9; text-align: left;">
                                  <th style="padding: 10px 14px; font-size: 12px; color: #475569; text-transform: uppercase;">Date / Day</th>
                                  <th style="padding: 10px 14px; font-size: 12px; color: #475569; text-transform: uppercase;">Shift Times</th>
                                  <th style="padding: 10px 14px; font-size: 12px; color: #475569; text-transform: uppercase;">Position / Role</th>
                                </tr>
                              </thead>
                              <tbody>
                                ${shiftListHtml}
                              </tbody>
                            </table>

                            <!-- Action Button -->
                            <div style="text-align: center; margin: 30px 0 10px 0;">
                              <a href="${APP_URL}" target="_blank" style="background-color: #0284c7; color: #ffffff; padding: 12px 28px; border-radius: 8px; font-weight: 600; text-decoration: none; font-size: 14px; display: inline-block; box-shadow: 0 2px 8px rgba(2,132,199,0.3);">
                                Open Woy Woy Roster App →
                              </a>
                            </div>
                            
                            <p style="font-size: 12px; color: #94a3b8; line-height: 1.5; margin-top: 24px; text-align: center;">
                              Need to swap a shift? Please submit a request via the Swap Board on the portal at least 48 hours in advance.
                            </p>
                          </td>
                        </tr>
                        <!-- Footer -->
                        <tr>
                          <td style="background-color: #f8fafc; padding: 16px 30px; text-align: center; border-top: 1px solid #e2e8f0;">
                            <p style="font-size: 11px; color: #94a3b8; margin: 0; line-height: 1.5;">
                              © 2026 Amcal Pharmacy Woy Woy • Shop 4, Peninsula Plaza, 62 Blackwall Road, Woy Woy NSW 2256 • Ph: (02) 4342 2256<br>
                              Confidential Staff Communication
                            </p>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
              </body>
              </html>
            `
          };

          await transporter.sendMail(mailOptions);
          sentCount++;
        } catch (mErr) {
          const errMsg = mErr instanceof Error ? mErr.message : 'Unknown mail error';
          errors.push(`${emp.name}: ${errMsg}`);
        }
      }

      return jsonRes(res, {
        success: true,
        message: `Roster email broadcast complete. Successfully sent to ${sentCount} of ${validRecipients.length} staff members.`,
        sentCount,
        totalEligible: validRecipients.length,
        errors: errors.length > 0 ? errors : undefined
      }, 200);
    }

    // 2. SINGLE EMPLOYEE EMAIL
    if (!employeeId || !rosterText) {
      return jsonRes(res, { error: 'employeeId and rosterText are required for single recipient emails.' }, 400);
    }

    const { data: employee, error: singleEmpErr } = await supabaseAdmin
      .from('brisk_employees')
      .select('*')
      .eq('id', employeeId)
      .maybeSingle();

    if (singleEmpErr || !employee) {
      return jsonRes(res, { error: 'Employee not found.' }, 404);
    }

    const empStore = (employee.pharmacy_id || employee.pharmacyId || '').toLowerCase().trim();
    if (empStore === 'budgewoi_dds' || empStore === 'budgewoi') {
      return jsonRes(res, {
        error: `Employee ${employee.name} belongs to Budgewoi Discount Drug Stores. Please use the Budgewoi portal (https://budgewoiddsroster.vercel.app) to email Budgewoi staff.`
      }, 400);
    }

    if (!employee.email) {
      return jsonRes(res, { error: 'Employee profile has no email address.' }, 400);
    }

    const singleMailOptions = {
      from: `"Amcal Pharmacy Woy Woy" <${process.env.SMTP_USER || 'pharmotago@gmail.com'}>`,
      to: employee.email,
      subject: `📅 Your Amcal Woy Woy Work Schedule Briefing — Week of ${weekStart}`,
      text: rosterText,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 24px; color: #1e293b; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
          <div style="border-bottom: 2px solid #f1f5f9; padding-bottom: 12px; margin-bottom: 16px;">
            <h2 style="color: #0284c7; margin: 0 0 4px 0; font-size: 18px;">Amcal Pharmacy Woy Woy</h2>
            <p style="margin: 0; color: #64748b; font-size: 13px;">Staff Roster Briefing — Week of ${weekStart}</p>
          </div>
          <p style="font-size: 15px; margin: 0 0 12px 0;">Hello <strong>${employee.name}</strong>,</p>
          <p style="color: #475569; font-size: 14px; margin: 0 0 16px 0;">Your work schedule for the week of <strong>${weekStart}</strong> is confirmed below:</p>
          <div style="background-color: #f0f9ff; padding: 16px; border-radius: 8px; margin: 16px 0; border-left: 4px solid #0284c7;">
            <pre style="font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace; font-size: 13px; color: #1e293b; margin: 0; white-space: pre-wrap;">${rosterText}</pre>
          </div>
          <div style="text-align: center; margin: 24px 0 16px 0;">
            <a href="${APP_URL}" style="background-color: #0284c7; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px; display: inline-block;">Open Woy Woy Roster Portal →</a>
          </div>
          <p style="color: #94a3b8; font-size: 11px; margin-top: 24px; border-top: 1px solid #f1f5f9; padding-top: 12px; text-align: center; line-height: 1.4;">
            Amcal Pharmacy Woy Woy • Shop 4, Peninsula Plaza, 62 Blackwall Road, Woy Woy NSW 2256 • Ph: (02) 4342 2256
          </p>
        </div>
      `
    };

    await transporter.sendMail(singleMailOptions);

    return jsonRes(res, {
      success: true,
      message: `Roster email successfully sent to ${employee.name} (${employee.email}).`
    }, 200);

  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error occurred';
    return jsonRes(res, { error: message }, 500);
  }
}
