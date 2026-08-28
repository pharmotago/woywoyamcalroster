const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL || 'https://gcslfkujlfnznedatrsn.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdjc2xma3VqbGZuem5lZGF0cnNuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0OTEwODksImV4cCI6MjA5MjA2NzA4OX0.qCfeYYF2rcqfz_t2-wxLAE0fiosy9C2sbG3BShYVIT0';

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
});

function timeToDecimal(timeStr) {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return (h || 0) + (m || 0) / 60;
}

function getShiftDuration(start, end) {
  let diff = timeToDecimal(end) - timeToDecimal(start);
  if (diff < 0) diff += 24;
  return diff;
}

function getWeekRange(dateObj) {
  const d = new Date(dateObj);
  const day = d.getDay();
  const diffToMonday = d.getDate() - day + (day === 0 ? -6 : 1);
  const mon = new Date(d.setDate(diffToMonday));
  mon.setHours(0, 0, 0, 0);
  
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  sun.setHours(23, 59, 59, 999);
  
  const format = (dt) => {
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, '0');
    const day = String(dt.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  return {
    monday: format(mon),
    sunday: format(sun)
  };
}

async function fetchWeeklyHoursJson() {
  await supabase.auth.signInWithPassword({
    email: 'pharmotago@gmail.com',
    password: 'Amcal2026!'
  });

  const { data: employees } = await supabase
    .from('brisk_employees')
    .select('id, name, role, hourly_rate, max_hours, active');

  const empMap = {};
  (employees || []).forEach(e => {
    empMap[e.id] = e;
  });

  const { data: shifts } = await supabase
    .from('brisk_shifts')
    .select('*')
    .order('date', { ascending: true });

  const weeks = {};
  
  shifts.forEach(s => {
    const shiftDate = new Date(s.date + 'T00:00:00');
    const week = getWeekRange(shiftDate);
    const weekKey = `${week.monday} ~ ${week.sunday}`;
    
    if (!weeks[weekKey]) {
      weeks[weekKey] = {
        monday: week.monday,
        sunday: week.sunday,
        shifts: [],
        totalHours: 0,
        totalCost: 0,
        byDay: {
          'Mon (월)': { hours: 0, count: 0 },
          'Tue (화)': { hours: 0, count: 0 },
          'Wed (수)': { hours: 0, count: 0 },
          'Thu (목)': { hours: 0, count: 0 },
          'Fri (금)': { hours: 0, count: 0 },
          'Sat (토)': { hours: 0, count: 0 },
          'Sun (일)': { hours: 0, count: 0 },
        },
        byEmployee: {}
      };
    }

    const dur = getShiftDuration(s.start_time || s.startTime, s.end_time || s.endTime);
    const emp = empMap[s.employee_id || s.employeeId] || { name: '미배정 (Unassigned)', hourly_rate: 0 };
    const cost = dur * (parseFloat(emp.hourly_rate) || 0);

    const dayNames = ['Sun (일)', 'Mon (월)', 'Tue (화)', 'Wed (수)', 'Thu (목)', 'Fri (금)', 'Sat (토)'];
    const dayName = dayNames[shiftDate.getDay()];

    weeks[weekKey].shifts.push(s);
    weeks[weekKey].totalHours += dur;
    weeks[weekKey].totalCost += cost;
    if (weeks[weekKey].byDay[dayName]) {
      weeks[weekKey].byDay[dayName].hours += dur;
      weeks[weekKey].byDay[dayName].count += 1;
    }

    const empId = s.employee_id || s.employeeId || 'unassigned';
    if (!weeks[weekKey].byEmployee[empId]) {
      weeks[weekKey].byEmployee[empId] = {
        name: emp.name,
        role: emp.role || s.role,
        shiftsCount: 0,
        totalHours: 0,
        totalCost: 0
      };
    }
    weeks[weekKey].byEmployee[empId].shiftsCount += 1;
    weeks[weekKey].byEmployee[empId].totalHours += dur;
    weeks[weekKey].byEmployee[empId].totalCost += cost;
  });

  console.log(JSON.stringify(weeks, null, 2));
}

fetchWeeklyHoursJson().catch(console.error);
