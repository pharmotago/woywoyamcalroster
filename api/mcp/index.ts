import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || 'https://gcslfkujlfnznedatrsn.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseAdmin = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});

// MCP Tools Definition
const MCP_TOOLS = [
  {
    name: 'get_today_shifts',
    description: 'Get today\'s pharmacy shift roster, scheduled employees, start/end times, and roles (e.g. Pharmacist, Assistant).',
    inputSchema: {
      type: 'object',
      properties: {
        date: {
          type: 'string',
          description: 'Date in YYYY-MM-DD format (defaults to current date if omitted)'
        }
      }
    }
  },
  {
    name: 'get_roster_schedule',
    description: 'Get pharmacy employee roster schedule for a specific date range, optionally filtered by role.',
    inputSchema: {
      type: 'object',
      properties: {
        start_date: {
          type: 'string',
          description: 'Start date in YYYY-MM-DD format (e.g., 2026-08-17)'
        },
        end_date: {
          type: 'string',
          description: 'End date in YYYY-MM-DD format (e.g., 2026-08-23)'
        },
        role: {
          type: 'string',
          description: 'Optional role filter (e.g. Pharmacist, Pharmacy Assistant, Manager)'
        }
      },
      required: ['start_date', 'end_date']
    }
  },
  {
    name: 'list_employees',
    description: 'List all pharmacy employees with their roles, contact details, hourly rates, and active status.',
    inputSchema: {
      type: 'object',
      properties: {
        active_only: {
          type: 'boolean',
          description: 'Set to true to return active employees only (default: true)'
        }
      }
    }
  },
  {
    name: 'get_timecards',
    description: 'Get employee timecard records including clock-in, clock-out, total worked hours, and approval status.',
    inputSchema: {
      type: 'object',
      properties: {
        start_date: {
          type: 'string',
          description: 'Optional start date YYYY-MM-DD'
        },
        end_date: {
          type: 'string',
          description: 'Optional end date YYYY-MM-DD'
        },
        employee_name: {
          type: 'string',
          description: 'Optional employee name filter'
        }
      }
    }
  },
  {
    name: 'get_leave_requests',
    description: 'Get leave and time-off requests submitted by pharmacy staff.',
    inputSchema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['All', 'Pending', 'Approved', 'Rejected'],
          description: 'Filter by request status (default: All)'
        }
      }
    }
  },
  {
    name: 'get_pharmacy_settings',
    description: 'Get pharmacy operating information including store name and weekly trading hours.',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'create_shift',
    description: 'Add a new shift to the pharmacy roster for a specific employee.',
    inputSchema: {
      type: 'object',
      properties: {
        employee_name: {
          type: 'string',
          description: 'Name of the employee'
        },
        date: {
          type: 'string',
          description: 'Shift date (YYYY-MM-DD)'
        },
        start_time: {
          type: 'string',
          description: 'Start time (HH:MM in 24-hour format, e.g. 08:30)'
        },
        end_time: {
          type: 'string',
          description: 'End time (HH:MM in 24-hour format, e.g. 17:30)'
        },
        role: {
          type: 'string',
          description: 'Assigned shift role (e.g. Pharmacist, Pharmacy Assistant)'
        },
        notes: {
          type: 'string',
          description: 'Optional notes for this shift'
        }
      },
      required: ['employee_name', 'date', 'start_time', 'end_time']
    }
  },
  {
    name: 'approve_leave_request',
    description: 'Approve or reject a staff leave request.',
    inputSchema: {
      type: 'object',
      properties: {
        request_id: {
          type: 'string',
          description: 'UUID of the leave request'
        },
        status: {
          type: 'string',
          enum: ['Approved', 'Rejected'],
          description: 'Status to set'
        }
      },
      required: ['request_id', 'status']
    }
  }
];

// Helper: Handle MCP Tool Execution
async function executeTool(name: string, args: Record<string, any> = {}) {
  switch (name) {
    case 'get_today_shifts': {
      const targetDate = args.date || new Date().toISOString().split('T')[0];
      const { data: shifts, error } = await supabaseAdmin
        .from('brisk_shifts')
        .select(`
          id,
          date,
          start_time,
          end_time,
          role,
          status,
          notes,
          employee:brisk_employees(id, name, email, role, phone)
        `)
        .eq('date', targetDate)
        .order('start_time', { ascending: true });

      if (error) throw error;
      return {
        date: targetDate,
        total_shifts: shifts?.length || 0,
        shifts: shifts || []
      };
    }

    case 'get_roster_schedule': {
      const { start_date, end_date, role } = args;
      let query = supabaseAdmin
        .from('brisk_shifts')
        .select(`
          id,
          date,
          start_time,
          end_time,
          role,
          status,
          notes,
          employee:brisk_employees(id, name, email, role, phone)
        `)
        .gte('date', start_date)
        .lte('date', end_date)
        .order('date', { ascending: true })
        .order('start_time', { ascending: true });

      if (role) {
        query = query.ilike('role', `%${role}%`);
      }

      const { data: shifts, error } = await query;
      if (error) throw error;

      return {
        start_date,
        end_date,
        total_shifts: shifts?.length || 0,
        shifts: shifts || []
      };
    }

    case 'list_employees': {
      const activeOnly = args.active_only !== false;
      let query = supabaseAdmin
        .from('brisk_employees')
        .select('id, name, email, role, phone, hourly_rate, max_hours, active')
        .order('name', { ascending: true });

      if (activeOnly) {
        query = query.eq('active', true);
      }

      const { data: employees, error } = await query;
      if (error) throw error;

      return {
        total_employees: employees?.length || 0,
        employees: employees || []
      };
    }

    case 'get_timecards': {
      const { start_date, end_date, employee_name } = args;
      let query = supabaseAdmin
        .from('brisk_timecards')
        .select(`
          id,
          date,
          clock_in,
          clock_out,
          breaks,
          total_hours,
          approved,
          approved_by,
          employee:brisk_employees(id, name, email, role)
        `)
        .order('date', { ascending: false });

      if (start_date) query = query.gte('date', start_date);
      if (end_date) query = query.lte('date', end_date);

      const { data: timecards, error } = await query;
      if (error) throw error;

      let result = timecards || [];
      if (employee_name) {
        const needle = employee_name.toLowerCase().trim();
        result = result.filter((tc: any) => tc.employee?.name?.toLowerCase().includes(needle));
      }

      return {
        total_records: result.length,
        timecards: result
      };
    }

    case 'get_leave_requests': {
      const status = args.status || 'All';
      let query = supabaseAdmin
        .from('brisk_leave_requests')
        .select(`
          id,
          start_date,
          end_date,
          reason,
          status,
          created_at,
          employee:brisk_employees(id, name, email, role)
        `)
        .order('created_at', { ascending: false });

      if (status && status !== 'All') {
        query = query.eq('status', status);
      }

      const { data: requests, error } = await query;
      if (error) throw error;

      return {
        total_requests: requests?.length || 0,
        requests: requests || []
      };
    }

    case 'get_pharmacy_settings': {
      const { data: settings, error } = await supabaseAdmin
        .from('brisk_settings')
        .select('*')
        .maybeSingle();

      if (error) throw error;
      return settings || { company_name: 'Amcal Pharmacy Woywoy Rosters' };
    }

    case 'create_shift': {
      const { employee_name, date, start_time, end_time, role, notes } = args;

      // Find employee by name
      const { data: emp, error: empErr } = await supabaseAdmin
        .from('brisk_employees')
        .select('id, name, role')
        .ilike('name', `%${employee_name.trim()}%`)
        .limit(1)
        .maybeSingle();

      if (empErr || !emp) {
        throw new Error(`Employee matching "${employee_name}" not found.`);
      }

      const assignedRole = role || emp.role || 'Pharmacy Assistant';
      const { data: inserted, error: insertErr } = await supabaseAdmin
        .from('brisk_shifts')
        .insert({
          employee_id: emp.id,
          date,
          start_time,
          end_time,
          role: assignedRole,
          status: 'published',
          notes: notes || null
        })
        .select()
        .single();

      if (insertErr) throw insertErr;

      return {
        success: true,
        message: `Shift scheduled successfully for ${emp.name} on ${date} (${start_time} - ${end_time}).`,
        shift: inserted
      };
    }

    case 'approve_leave_request': {
      const { request_id, status } = args;
      const { data: updated, error } = await supabaseAdmin
        .from('brisk_leave_requests')
        .update({ status })
        .eq('id', request_id)
        .select()
        .single();

      if (error) throw error;

      return {
        success: true,
        message: `Leave request ${request_id} has been marked as ${status}.`,
        request: updated
      };
    }

    default:
      throw new Error(`Unknown tool name: ${name}`);
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Broad CORS headers for Gemini Spark and remote agents
  
  const allowedOrigins = [
    'https://woywoyamcalroster.vercel.app',
    'http://localhost:3000',
    'http://localhost:3002',
    'http://127.0.0.1:3000',
    'http://localhost:5173'
  ];
  const origin = req.headers.origin || '';
  if (allowedOrigins.includes(origin) || origin.endsWith('.vercel.app')) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', 'https://woywoyamcalroster.vercel.app');
  }
  
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Handle GET (Discovery / Health / SSE)
  if (req.method === 'GET') {
    const acceptHeader = req.headers['accept'] || '';

    // If client requests SSE
    if (acceptHeader.includes('text/event-stream')) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.write(`event: endpoint\ndata: /api/mcp\n\n`);
      return res.end();
    }

    // Default JSON discovery summary
    return res.status(200).json({
      name: 'amcal-woywoy-roster-mcp',
      description: 'Amcal Pharmacy Woywoy Rosters MCP Server for Google Gemini Spark',
      version: '1.0.0',
      protocolVersion: '2024-11-05',
      endpoints: {
        mcp: '/api/mcp'
      },
      tools: MCP_TOOLS.map(t => ({ name: t.name, description: t.description }))
    });
  }

  // Handle POST (JSON-RPC 2.0 Protocol)
  if (req.method === 'POST') {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.includes('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized: MCP token required' });
    }
    const token = authHeader.replace('Bearer ', '').trim();
    
    // Verify token: Must be a valid Supabase Auth JWT or a valid MCP_SECRET
    if (token !== (process.env.MCP_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)) {
      const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token);
      if (authErr || !user) {
        return res.status(401).json({ error: 'Unauthorized: Invalid or expired token' });
      }
      
      // Ensure the user has manager/owner privileges
      const { data: prof } = await supabaseAdmin.from('brisk_users').select('role').eq('id', user.id).maybeSingle();
      if (!prof || (prof.role !== 'owner' && prof.role !== 'manager')) {
        return res.status(403).json({ error: 'Forbidden: Manager access required for MCP' });
      }
    }
    try {
      const body = req.body || {};

      // Handle single or batch JSON-RPC
      const handleSingleRequest = async (rpc: any) => {
        const { id, method, params } = rpc || {};

        if (method === 'initialize') {
          return {
            jsonrpc: '2.0',
            id,
            result: {
              protocolVersion: '2024-11-05',
              capabilities: {
                tools: { listChanged: false },
                resources: {},
                prompts: {}
              },
              serverInfo: {
                name: 'amcal-woywoy-roster-mcp',
                version: '1.0.0'
              }
            }
          };
        }

        if (method === 'notifications/initialized') {
          return null; // Notifications do not return responses
        }

        if (method === 'ping') {
          return {
            jsonrpc: '2.0',
            id,
            result: {}
          };
        }

        if (method === 'tools/list') {
          return {
            jsonrpc: '2.0',
            id,
            result: {
              tools: MCP_TOOLS
            }
          };
        }

        if (method === 'tools/call') {
          const toolName = params?.name;
          const toolArgs = params?.arguments || {};

          try {
            const toolResult = await executeTool(toolName, toolArgs);
            return {
              jsonrpc: '2.0',
              id,
              result: {
                content: [
                  {
                    type: 'text',
                    text: JSON.stringify(toolResult, null, 2)
                  }
                ],
                isError: false
              }
            };
          } catch (toolErr: any) {
            return {
              jsonrpc: '2.0',
              id,
              result: {
                content: [
                  {
                    type: 'text',
                    text: `Error executing ${toolName}: ${toolErr.message}`
                  }
                ],
                isError: true
              }
            };
          }
        }

        if (method === 'resources/list') {
          return {
            jsonrpc: '2.0',
            id,
            result: { resources: [] }
          };
        }

        if (method === 'prompts/list') {
          return {
            jsonrpc: '2.0',
            id,
            result: { prompts: [] }
          };
        }

        // Unknown method
        return {
          jsonrpc: '2.0',
          id,
          error: {
            code: -32601,
            message: `Method not found: ${method}`
          }
        };
      };

      if (Array.isArray(body)) {
        const responses = await Promise.all(body.map(handleSingleRequest));
        const filtered = responses.filter(r => r !== null);
        return res.status(200).json(filtered);
      } else {
        const response = await handleSingleRequest(body);
        if (response === null) {
          return res.status(204).end();
        }
        return res.status(200).json(response);
      }
    } catch (err: any) {
      return res.status(500).json({
        jsonrpc: '2.0',
        error: {
          code: -32603,
          message: `Internal error: ${err.message}`
        }
      });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
