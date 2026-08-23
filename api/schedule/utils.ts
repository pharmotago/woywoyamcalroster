import { supabaseAdmin } from '../supabase-admin';

// Simple Helper to return JSON Response with CORS Headers
export function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, PUT, DELETE',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    }
  });
}

// Authentication Check Helper - extracts and verifies Supabase JWT Token from Authorization header
export async function getRequestUser(req: Request) {
  const authHeader = req.headers.get('Authorization') || req.headers.get('authorization') || '';
  if (!authHeader.toLowerCase().startsWith('bearer ')) {
    return {
      role: '',
      employeeId: '',
      email: '',
      isAuthenticated: false
    };
  }
  
  const token = authHeader.substring(7).trim(); // strip "Bearer " and trim
  try {
    const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token);
    if (authErr || !user) throw authErr || new Error('No user found');
    
    // Fetch the user role document from brisk_users table
    const { data: userData, error: dbErr } = await supabaseAdmin
      .from('brisk_users')
      .select('*')
      .eq('email', user.email?.toLowerCase().trim())
      .maybeSingle();
      
    if (dbErr || !userData) {
      return {
        role: '',
        employeeId: '',
        email: user.email || '',
        isAuthenticated: false
      };
    }
    
    let resolvedRole = userData.role || '';
    
    // Normalize role: check if employee role is 'Pharmacist Manager' → resolve to 'manager'
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

    return {
      role: resolvedRole,
      employeeId: userData.employee_id || '',
      email: user.email || '',
      isAuthenticated: true
    };
  } catch (err) {
    return {
      role: '',
      employeeId: '',
      email: '',
      isAuthenticated: false
    };
  }
}
