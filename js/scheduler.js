/**
 * BriskSchedules Auto-Scheduling Algorithm
 */
const BriskScheduler = (function() {
  
  // Helper: Convert shift to absolute start and end dates
  function shiftToDateRanges(dateStr, startStr, endStr) {
    const sStr = (startStr || '00:00').substring(0, 5);
    const eStr = (endStr || '00:00').substring(0, 5);
    const start = new Date(`${dateStr}T${sStr}:00`);
    const end = new Date(`${dateStr}T${eStr}:00`);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return { start: new Date(0), end: new Date(0) };
    }
    if (end <= start) {
      end.setDate(end.getDate() + 1); // Overnight shift
    }
    return { start, end };
  }

  // Helper: check if two time ranges overlap
  function isOverlapping(date1, start1, end1, date2, start2, end2) {
    const r1 = shiftToDateRanges(date1, start1, end1);
    const r2 = shiftToDateRanges(date2, start2, end2);
    if (r1.start.getTime() === 0 || r2.start.getTime() === 0) return false;
    return r1.start < r2.end && r2.start < r1.end;
  }

  // Helper: Parse HH:MM to decimal hours
  function timeToDecimal(timeStr) {
    if (typeof timeStr !== 'string' || !timeStr) return 0;
    const [h, m] = timeStr.split(':').map(Number);
    return (h || 0) + (m || 0) / 60;
  }

  // Helper: Calculate shift duration in hours
  function getShiftDuration(start, end) {
    let diff = timeToDecimal(end) - timeToDecimal(start);
    if (diff < 0) diff += 24; // Handle overnight shifts
    return diff;
  }

  // Helper: Check if date falls in a leave range
  function isEmployeeOnLeave(employeeId, dateStr, leaveRequests) {
    const date = new Date(dateStr + 'T00:00:00');
    if (isNaN(date.getTime())) return false;
    return leaveRequests.some(req => {
      if (req.employeeId !== employeeId || req.status !== 'Approved' || !req.startDate || !req.endDate) return false;
      const start = new Date(req.startDate + 'T00:00:00');
      const end = new Date(req.endDate + 'T00:00:00');
      if (isNaN(start.getTime()) || isNaN(end.getTime())) return false;
      // Set hours to zero for clean comparison
      date.setHours(0,0,0,0);
      start.setHours(0,0,0,0);
      end.setHours(0,0,0,0);
      return date >= start && date <= end;
    });
  }

  // Helper: Get day of week index (0 = Sun, 1 = Mon, ..., 6 = Sat)
  function getDayOfWeekIndex(dateStr) {
    const [year, month, day] = dateStr.split('-').map(Number);
    const d = new Date(Date.UTC(year, month - 1, day));
    return d.getUTCDay();
  }

  // Helper: Map Position to Daily Roles
  function getRolesForPosition(position) {
    const pos = (position || '').trim().toLowerCase();
    
    const retailRoles = [
      'tills', 'floor', 'floating/floors', 'juniors', 'scripts in/out', 'delivery',
      'stock receive & orders', 'stock control & gap scan', 'till up & banking',
      'brand strategy', 'promotions & catalogue', 'promotional ends & displays', 'counter & merchandising'
    ];

    // 1. Owner & Retail Manager can do everything
    if (pos.includes('owner') || pos.includes('retail manager') || pos.includes('partner') || pos === 'manager') {
      return ['dispensary', 'webster', ...retailRoles];
    }
    // 2. Pharmacist Manager & Pharmacist
    if (pos.includes('pharmacist') || pos.includes('pic') || pos.includes('locum')) {
      return ['dispensary', 'webster', 'scripts in/out', 'floating/floors', 'floor', 'tills', 'brand strategy'];
    }
    // 3. Dispense Technician
    if (pos.includes('technician') || pos.includes('dispensary')) {
      return ['dispensary', 'webster', 'tills', 'floor', 'floating/floors', 'scripts in/out', 'stock receive & orders', 'stock control & gap scan'];
    }
    // 4. Pharmacy Assistant & Retail Associate
    if (pos.includes('assistant') || pos.includes('associate') || pos.includes('floor') || pos.includes('till')) {
      return retailRoles;
    }
    
    // Default fallback: split by comma to support comma-separated position list or direct daily roles
    return pos.split(',').map(r => r.trim());
  }

  // Heuristic Solver for Employee Shift Assignment
  function runAutoSchedule(shifts, employees, leaveRequests, targetWeekStartStr, timecards = [], clearFuture = true) {
    // 1. Filter shifts for the target week
    const targetWeekStart = new Date(targetWeekStartStr + 'T00:00:00');
    const targetWeekEnd = new Date(targetWeekStart);
    targetWeekEnd.setDate(targetWeekStart.getDate() + 6);
    
    // Set boundaries
    targetWeekStart.setHours(0,0,0,0);
    targetWeekEnd.setHours(23,59,59,999);

    const weekShifts = shifts.filter(s => {
      const sDate = new Date(s.date + 'T00:00:00');
      sDate.setHours(0,0,0,0);
      return sDate >= targetWeekStart && sDate <= targetWeekEnd;
    });

    if (weekShifts.length === 0) {
      return { success: false, message: 'No shifts found for this week to schedule. Please add empty shifts first.' };
    }

    // Keep track of employee hours scheduled so far this week
    const scheduledHours = {};
    const employeeLeaves = new Set();
    
    // Precompute Leaves for O(1) lookup
    leaveRequests.forEach(req => {
      if (req.status !== 'Approved' || !req.startDate || !req.endDate) return;
      let d = new Date(req.startDate + 'T00:00:00');
      const end = new Date(req.endDate + 'T00:00:00');
      if (isNaN(d.getTime()) || isNaN(end.getTime())) return;
      d.setHours(0,0,0,0);
      end.setHours(0,0,0,0);
      while(d <= end) {
        const offset = d.getTimezoneOffset();
        const localDateStr = new Date(d.getTime() - offset * 60000).toISOString().split('T')[0];
        employeeLeaves.add(`${req.employeeId}_${localDateStr}`);
        d.setDate(d.getDate() + 1);
      }
    });

    const employeeSchedules = {}; // { empId_date: [shift, shift] }

    const today = new Date();
    today.setHours(0,0,0,0);

    // Save original employee ids to detect modifications correctly (fixes reference comparison bug)
    const originalEmployeeIds = {};
    weekShifts.forEach(s => {
      originalEmployeeIds[s.id] = s.employeeId;
    });

    employees.forEach(emp => {
      let pastHours = 0;
      // Actual hours from approved timecards (for past days)
      const empTimecards = timecards.filter(tc => {
        if (tc.employeeId !== emp.id || !tc.approved) return false;
        const tcDate = new Date(tc.date + 'T00:00:00');
        tcDate.setHours(0,0,0,0);
        return tcDate >= targetWeekStart && tcDate <= targetWeekEnd && tcDate < today;
      });
      empTimecards.forEach(tc => {
        pastHours += (tc.totalHours || 0);
      });

      // Also add hours for past shifts this week if they haven't been clocked (fallback)
      const pastShifts = weekShifts.filter(s => {
        if (s.employeeId !== emp.id) return false;
        const sDate = new Date(s.date + 'T00:00:00');
        sDate.setHours(0,0,0,0);
        return sDate < today;
      });
      pastShifts.forEach(s => {
        // If there's no approved timecard for this date, count the scheduled shift
        const hasTimecard = empTimecards.some(tc => tc.date === s.date);
        if (!hasTimecard) {
          pastHours += getShiftDuration(s.startTime, s.endTime);
        }
        
        // Add past shifts to schedules to prevent overlapping bugs if checked later
        const scheduleKey = `${emp.id}_${s.date}`;
        if (!employeeSchedules[scheduleKey]) employeeSchedules[scheduleKey] = [];
        employeeSchedules[scheduleKey].push(s);
      });

      scheduledHours[emp.id] = pastHours;
    });

    // Unassign shifts that are in the future/today (if clearFuture is true)
    weekShifts.forEach(s => {
      const sDate = new Date(s.date + 'T00:00:00');
      sDate.setHours(0,0,0,0);
      
      if (clearFuture && sDate >= today) {
        s.employeeId = null;
      }
      
      // If a future shift is ALREADY assigned (e.g. clearFuture=false), track its hours and schedule!
      if (s.employeeId !== null && sDate >= today) {
        scheduledHours[s.employeeId] += getShiftDuration(s.startTime, s.endTime);
        const scheduleKey = `${s.employeeId}_${s.date}`;
        if (!employeeSchedules[scheduleKey]) employeeSchedules[scheduleKey] = [];
        employeeSchedules[scheduleKey].push(s);
      }
    });

    // We only want to automatically assign shifts that have no employee
    const shiftsToAssign = weekShifts.filter(s => s.employeeId === null);

    // Sort shifts: prioritize roles with fewer available employees, or longer shifts first (Most Constrained Variable heuristic)
    // For simplicity, sort by duration descending (longer shifts are harder to place)
    const sortedShifts = [...shiftsToAssign].sort((a, b) => {
      const durA = getShiftDuration(a.startTime, a.endTime);
      const durB = getShiftDuration(b.startTime, b.endTime);
      return durB - durA;
    });

    let assignedCount = 0;
    const logs = [];
    const modifiedShifts = [];

    // 2. Loop and Assign
    sortedShifts.forEach(shift => {
      try {
        const shiftDuration = getShiftDuration(shift.startTime, shift.endTime);
        const dayIdx = getDayOfWeekIndex(shift.date);
        
        // Find candidate employees
        const candidates = employees.filter(emp => {
          if (!emp.active) return false;

          // Constraint A: Role match (via Position-to-DailyRoles mapping)
          const employeeRoles = getRolesForPosition(emp.role);
          const shiftRole = shift.role ? shift.role.toLowerCase() : '';
          if (!employeeRoles.includes(shiftRole)) return false;

          // Constraint B: Availability for that day of the week
          const dayAvail = (emp.availability && typeof emp.availability === 'object') ? emp.availability[dayIdx] : null;
          if (!dayAvail) return false; // Unavailable on this weekday

          let empStartDec = timeToDecimal(dayAvail.start);
          let empEndDec = timeToDecimal(dayAvail.end);
          let shiftStartDec = timeToDecimal(shift.startTime);
          let shiftEndDec = timeToDecimal(shift.endTime);
          
          if (empStartDec === empEndDec) empEndDec = 24; // Handle open availability

          if (shiftEndDec < shiftStartDec) shiftEndDec += 24;
          let availEndDec = empEndDec;
          if (availEndDec < empStartDec) availEndDec += 24;
          
          if (shiftStartDec < empStartDec && availEndDec > 24) { 
            shiftStartDec += 24; 
            shiftEndDec += 24; 
          }

          if (shiftStartDec < empStartDec || shiftEndDec > availEndDec) return false; // Shift falls outside employee hours

          // Constraint C: Approved Time Off (Leave)
          if (employeeLeaves.has(`${emp.id}_${shift.date}`)) return false;

          // Constraint D: Max Hours Limit
          if (scheduledHours[emp.id] + shiftDuration > (emp.maxHours || 38)) return false;

          // Constraint E: Overlapping Shifts for this employee on this day
          const adjShifts = employeeSchedules[`${emp.id}_${shift.date}`] || [];
          if (adjShifts.some(otherShift => isOverlapping(shift.date, shift.startTime, shift.endTime, otherShift.date, otherShift.startTime, otherShift.endTime))) {
            return false;
          }

          // Constraint F: Pharmacy Industry Award 2026 [MA000084] Mandatory 10-Hour Rest Break
          const curRange = shiftToDateRanges(shift.date, shift.startTime, shift.endTime);
          
          // Helper: UTC-safe date string offset
          const getOffsetDateStr = (dStr, offset) => {
            const [y, m, d] = dStr.split('-').map(Number);
            const dt = new Date(Date.UTC(y, m - 1, d + offset));
            return dt.toISOString().split('T')[0];
          };

          // Check rest break from previous day shifts
          const prevDateStr = getOffsetDateStr(shift.date, -1);
          const prevShifts = employeeSchedules[`${emp.id}_${prevDateStr}`] || [];
          for (const ps of prevShifts) {
            const pRange = shiftToDateRanges(ps.date, ps.startTime, ps.endTime);
            const restHours = (curRange.start.getTime() - pRange.end.getTime()) / (1000 * 60 * 60);
            if (restHours < 10) return false;
          }

          // Check rest break to next day shifts
          const nextDateStr = getOffsetDateStr(shift.date, 1);
          const nextShifts = employeeSchedules[`${emp.id}_${nextDateStr}`] || [];
          for (const ns of nextShifts) {
            const nRange = shiftToDateRanges(ns.date, ns.startTime, ns.endTime);
            const restHours = (nRange.start.getTime() - curRange.end.getTime()) / (1000 * 60 * 60);
            if (restHours < 10) return false;
          }

          // Constraint G: Maximum 6 Consecutive Days Limit (Pharmacy Award Clause 13.3)
          let consecutiveDays = 1;
          for (let b = 1; b <= 6; b++) {
            const checkD = getOffsetDateStr(shift.date, -b);
            const hadShift = (employeeSchedules[`${emp.id}_${checkD}`] || []).length > 0;
            if (hadShift) consecutiveDays++;
            else break;
          }
          for (let f = 1; f <= 6; f++) {
            const checkD = getOffsetDateStr(shift.date, f);
            const hadShift = (employeeSchedules[`${emp.id}_${checkD}`] || []).length > 0;
            if (hadShift) consecutiveDays++;
            else break;
          }
          if (consecutiveDays > 6) return false;

          return true;
        });

        // Sort candidates by least scheduled hours (load balancing)
        candidates.sort((a, b) => scheduledHours[a.id] - scheduledHours[b.id]);

        if (candidates.length > 0) {
          const chosen = candidates[0];
          shift.employeeId = chosen.id;
          scheduledHours[chosen.id] += shiftDuration;
          
          const scheduleKey = `${chosen.id}_${shift.date}`;
          if (!employeeSchedules[scheduleKey]) employeeSchedules[scheduleKey] = [];
          employeeSchedules[scheduleKey].push(shift);

          assignedCount++;
        } else {
          logs.push(`Could not find suitable employee for ${shift.role} on ${shift.date} (${shift.startTime}-${shift.endTime})`);
        }
      } catch (e) {
        logs.push(`Failed to process shift on ${shift.date}: ${e.message}`);
      }
    });

    // 3. Apply changes back to the original shifts array and track modified (fixes reference comparison bug)
    shifts.forEach(origShift => {
      const originalId = originalEmployeeIds[origShift.id];
      // Push any shift whose assignment was changed
      if (origShift.employeeId !== originalId) {
        modifiedShifts.push(origShift);
      }
    });

    const unassignedCount = weekShifts.filter(s => s.employeeId === null).length;

    return {
      success: true,
      assignedCount: assignedCount,
      unassignedCount: unassignedCount,
      shifts: modifiedShifts,
      logs: logs
    };
  }

  return {
    run: runAutoSchedule,
    getShiftDuration: getShiftDuration,
    isOverlapping: isOverlapping
  };
})();

export default BriskScheduler;
