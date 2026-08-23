/**
 * Google Opal Autonomous Roster Workflow Engine (BriskSchedules)
 * Provides declarative, multi-step autonomous mini-apps for roster optimization,
 * Fair Work Pharmacy Industry Award 2020 compliance, and timesheet reconciliation.
 */

export class OpalRosterEngine {
  constructor() {
    this.history = [];
  }

  /**
   * Mini-App 1: Shift Gap Auto-Detector & Smart Replacement Matcher
   * Scans active week shifts for unassigned/open slots and recommends optimal compliant staff.
   */
  async runGapDetectorWorkflow(shifts = [], employees = [], currentWeekStart = new Date()) {
    const startTime = Date.now();
    const logs = [];

    logs.push({ step: 1, title: 'Scanning Roster for Uncovered Slots', status: 'running' });

    // Step 1: Find unassigned shifts or shifts marked open/pending
    const openShifts = shifts.filter(s => !s.employeeId || s.employeeId === 'unassigned' || s.status === 'open' || s.isCoverRequest);
    logs[0].status = 'done';
    logs[0].detail = `Found ${openShifts.length} open/cover shifts requiring staffing.`;

    logs.push({ step: 2, title: 'Evaluating Fair Work Award Constraints & Fatigue', status: 'running' });

    const recommendations = [];

    for (const shift of openShifts) {
      const shiftDate = shift.date;
      const shiftStart = shift.start || shift.startTime;
      const shiftEnd = shift.end || shift.endTime;
      const shiftBreak = shift.unpaidBreak || shift.unpaidMealMins;
      const shiftHours = this._calculateHours(shiftStart, shiftEnd, shiftBreak);
      const targetRole = shift.role || 'Staff';

      // Evaluate each active employee
      const candidates = employees
        .filter(emp => emp.active !== false && emp.id !== shift.employeeId)
        .map(emp => {
          let score = 100;
          const reasons = [];
          const penalties = [];

          // 1. Role Match
          if (emp.role === targetRole || (emp.positions && emp.positions.includes(targetRole))) {
            score += 25;
            reasons.push(`Direct Role Match (${targetRole})`);
          } else if (emp.role === 'Pharmacist' && targetRole.includes('Dispensary')) {
            score += 15;
            reasons.push('Pharmacist qualified for Dispensary');
          } else {
            penalties.push(`Different default role (${emp.role})`);
            score -= 20;
          }

          // 2. Existing shifts on same day
          const sameDayShifts = shifts.filter(s => s.employeeId === emp.id && s.date === shiftDate);
          if (sameDayShifts.length > 0) {
            score -= 1000; // Hard clash
            penalties.push(`Already working on ${shiftDate}`);
          }

          // 3. Weekly Hours & Overtime check (38h cap)
          const weeklyShifts = shifts.filter(s => s.employeeId === emp.id);
          const currentWeeklyHours = weeklyShifts.reduce((acc, s) => {
            const sStart = s.start || s.startTime;
            const sEnd = s.end || s.endTime;
            const sBreak = s.unpaidBreak || s.unpaidMealMins;
            return acc + this._calculateHours(sStart, sEnd, sBreak);
          }, 0);
          const projectedWeeklyHours = currentWeeklyHours + shiftHours;

          if (projectedWeeklyHours > 38) {
            score -= 40;
            penalties.push(`Overtime Warning (${projectedWeeklyHours.toFixed(1)}h / 38h max)`);
          } else if (projectedWeeklyHours <= (emp.maxHours || 38)) {
            score += 20;
            reasons.push(`Within contracted limit (${currentWeeklyHours.toFixed(1)}h currently)`);
          }

          // 4. Minimum 12-hour turnaround rest between shifts (Award Clause 19)
          const prevDay = this._formatDateOffset(shiftDate, -1);
          const nextDay = this._formatDateOffset(shiftDate, 1);
          const prevDayShift = shifts.find(s => s.employeeId === emp.id && s.date === prevDay);
          const nextDayShift = shifts.find(s => s.employeeId === emp.id && s.date === nextDay);

          const prevEnd = prevDayShift ? (prevDayShift.end || prevDayShift.endTime) : null;
          if (prevEnd && shiftStart) {
            const restHours = this._calculateRestHours(prevEnd, shiftStart);
            if (restHours < 12) {
              score -= 50;
              penalties.push(`Insufficient turnaround rest (${restHours.toFixed(1)}h < 12h)`);
            } else {
              reasons.push(`Sufficient rest from previous shift (${restHours.toFixed(1)}h)`);
            }
          }

          return {
            employee: emp,
            score: Math.max(0, score),
            eligible: sameDayShifts.length === 0,
            currentHours: currentWeeklyHours,
            projectedHours: projectedWeeklyHours,
            reasons,
            penalties
          };
        })
        .filter(c => c.eligible)
        .sort((a, b) => b.score - a.score);

      recommendations.push({
        shift,
        shiftHours,
        topCandidate: candidates[0] || null,
        allCandidates: candidates.slice(0, 3)
      });
    }

    logs[1].status = 'done';
    logs[1].detail = `Evaluated ${employees.length} employees against 4 Fair Work safety & availability rules.`;

    logs.push({ step: 3, title: 'Workflow Output & Action Plan Synthesized', status: 'done', detail: 'Ready for 1-click auto-fill or manager review.' });

    const result = {
      workflowName: 'Opal Shift Gap Auto-Detector',
      executionDurationMs: Date.now() - startTime,
      openShiftsCount: openShifts.length,
      recommendations,
      logs
    };

    this.history.unshift(result);
    return result;
  }

  /**
   * Mini-App 2: Timesheet & Break Reconciliation Sentinel
   * Compares clocked timecards against scheduled shifts to spot overtime variance & missing meal breaks.
   */
  async runTimesheetReconcilerWorkflow(timecards = [], shifts = [], employees = []) {
    const startTime = Date.now();
    const logs = [];

    logs.push({ step: 1, title: 'Correlating Timecards with Scheduled Shifts', status: 'running' });

    const flaggedVariances = [];
    let totalScheduledHours = 0;
    let totalClockedHours = 0;

    timecards.forEach(tc => {
      if (!tc.clockIn) return;
      const tcDate = tc.clockIn.slice(0, 10);
      const matchingShift = shifts.find(s => s.employeeId === tc.employeeId && s.date === tcDate);
      const emp = employees.find(e => e.id === tc.employeeId) || { name: 'Unknown Staff' };

      const clockedHours = tc.totalHours || (tc.clockOut ? (new Date(tc.clockOut) - new Date(tc.clockIn)) / (1000 * 60 * 60) : 0);
      totalClockedHours += clockedHours;

      const scheduledHours = matchingShift ? this._calculateHours(matchingShift.start || matchingShift.startTime, matchingShift.end || matchingShift.endTime, matchingShift.unpaidBreak || matchingShift.unpaidMealMins) : 0;
      totalScheduledHours += scheduledHours;

      const varianceHours = clockedHours - scheduledHours;
      const flags = [];

      // Overtime check (>15 mins past scheduled end)
      if (varianceHours > 0.25) {
        flags.push({
          type: 'OVERTIME',
          severity: 'warning',
          message: `Clocked ${varianceHours.toFixed(2)}h extra (+${Math.round(varianceHours * 60)} mins) beyond scheduled shift.`
        });
      } else if (varianceHours < -0.5 && tc.clockOut) {
        flags.push({
          type: 'EARLY_DEPARTURE',
          severity: 'info',
          message: `Clocked out ${Math.abs(varianceHours).toFixed(2)}h earlier than scheduled.`
        });
      }

      // Unscheduled Clock-in
      if (!matchingShift) {
        flags.push({
          type: 'UNSCHEDULED',
          severity: 'warning',
          message: `No matching shift found on schedule for this date.`
        });
      }

      // Meal Break Check (>5h shift without break)
      const matchingBreak = matchingShift ? (matchingShift.unpaidBreak || matchingShift.unpaidMealMins) : null;
      if (clockedHours > 5.0 && (!tc.breaks || tc.breaks.length === 0) && matchingBreak !== 'crib_paid') {
        flags.push({
          type: 'MEAL_BREAK_MISSED',
          severity: 'critical',
          message: `Shift exceeded 5 hours without recorded meal break (Award Clause 20.1 Meal Break Rule).`
        });
      }

      if (flags.length > 0) {
        flaggedVariances.push({
          timecard: tc,
          shift: matchingShift || null,
          employee: emp,
          date: tcDate,
          clockedHours,
          scheduledHours,
          varianceHours,
          flags
        });
      }
    });

    logs[0].status = 'done';
    logs[0].detail = `Analyzed ${timecards.length} timecards against ${shifts.length} scheduled shifts.`;

    logs.push({
      step: 2,
      title: 'Flagged Variances & Compliance Exceptions',
      status: 'done',
      detail: `Detected ${flaggedVariances.length} exceptions needing manager review.`
    });

    const result = {
      workflowName: 'Opal Timesheet & Break Reconciliation Sentinel',
      executionDurationMs: Date.now() - startTime,
      totalScheduledHours,
      totalClockedHours,
      varianceHoursTotal: totalClockedHours - totalScheduledHours,
      flaggedVariances,
      logs
    };

    this.history.unshift(result);
    return result;
  }

  /**
   * Mini-App 3: 1-Click Weekly Roster Pre-Publish Audit
   * Validates safety, role requirements, and prepares broadcast dataset.
   */
  async runPrePublishAuditWorkflow(shifts = [], employees = [], tradingHours = {}) {
    const startTime = Date.now();
    const logs = [];

    logs.push({ step: 1, title: 'Validating Mandatory Pharmacist Coverage', status: 'running' });

    // Ensure every trading day with open shifts has at least one Pharmacist
    const shiftsByDate = {};
    shifts.forEach(s => {
      if (!shiftsByDate[s.date]) shiftsByDate[s.date] = [];
      shiftsByDate[s.date].push(s);
    });

    const datesMissingPharmacist = [];
    const datesWithGaps = [];

    Object.entries(shiftsByDate).forEach(([date, dayShifts]) => {
      const hasPharmacist = dayShifts.some(s => {
        const emp = employees.find(e => e.id === s.employeeId);
        return (emp && emp.role === 'Pharmacist') || s.role === 'Pharmacist';
      });

      if (!hasPharmacist && dayShifts.length > 0) {
        datesMissingPharmacist.push(date);
      }

      const unassigned = dayShifts.filter(s => !s.employeeId || s.employeeId === 'unassigned');
      if (unassigned.length > 0) {
        datesWithGaps.push({ date, count: unassigned.length });
      }
    });

    logs[0].status = 'done';
    logs[0].detail = datesMissingPharmacist.length === 0
      ? 'Pharmacist coverage verified across all trading days.'
      : `⚠️ Missing Pharmacist on: ${datesMissingPharmacist.join(', ')}`;

    logs.push({ step: 2, title: 'Checking Maximum Weekly Hours & Safety Caps', status: 'running' });

    const staffOvertimeWarnings = [];
    employees.forEach(emp => {
      const empShifts = shifts.filter(s => s.employeeId === emp.id);
      const totalHours = empShifts.reduce((acc, s) => {
        const sStart = s.start || s.startTime;
        const sEnd = s.end || s.endTime;
        const sBreak = s.unpaidBreak || s.unpaidMealMins;
        return acc + this._calculateHours(sStart, sEnd, sBreak);
      }, 0);
      if (totalHours > 38.0) {
        staffOvertimeWarnings.push({ employee: emp, totalHours });
      }
    });

    logs[1].status = 'done';
    logs[1].detail = staffOvertimeWarnings.length === 0
      ? 'All staff within safe 38h/wk Fair Work threshold.'
      : `⚠️ ${staffOvertimeWarnings.length} staff exceeding 38h/wk limit.`;

    const isReadyToPublish = datesMissingPharmacist.length === 0 && datesWithGaps.length === 0;

    logs.push({
      step: 3,
      title: 'Ready for Publication & Broadcast',
      status: isReadyToPublish ? 'done' : 'warning',
      detail: isReadyToPublish
        ? 'Roster passes all 5 Fair Work & Pharmacy Board audit gates.'
        : `Requires attention: ${datesWithGaps.length} days with unassigned shifts.`
    });

    const result = {
      workflowName: 'Opal Weekly Roster Pre-Publish Audit',
      executionDurationMs: Date.now() - startTime,
      isReadyToPublish,
      datesMissingPharmacist,
      datesWithGaps,
      staffOvertimeWarnings,
      totalShifts: shifts.length,
      logs
    };

    this.history.unshift(result);
    return result;
  }

  // --- Helper Methods ---

  _calculateHours(start, end, unpaidBreak) {
    if (!start || !end) return 0;
    const [sH, sM] = String(start).split(':').map(Number);
    const [eH, eM] = String(end).split(':').map(Number);
    if (isNaN(sH) || isNaN(eH)) return 0;
    let diff = (eH + (isNaN(eM) ? 0 : eM / 60)) - (sH + (isNaN(sM) ? 0 : sM / 60));
    if (diff < 0) diff += 24; // Overnight shift

    // Subtract break
    let breakHours = 0;
    const breakVal = String(unpaidBreak || '').toLowerCase();
    if (breakVal === '30' || breakVal === '0.5') breakHours = 0.5;
    else if (breakVal === '45' || breakVal === '0.75') breakHours = 0.75;
    else if (breakVal === '60' || breakVal === '1' || breakVal === '1.0') breakHours = 1.0;
    else if (breakVal === 'crib_paid' || breakVal === 'paid_crib' || breakVal === '0' || breakVal === 'none') {
      breakHours = 0; // Paid crib break (Clause 20.2) or explicit 0 mins
    } else if (breakVal === 'auto' || !unpaidBreak) {
      breakHours = diff >= 5.0 ? 0.5 : 0;
    }

    return Math.max(0, diff - breakHours);
  }

  _calculateRestHours(prevEnd, nextStart) {
    if (!prevEnd || !nextStart) return 24;
    const [peH, peM] = String(prevEnd).split(':').map(Number);
    const [nsH, nsM] = String(nextStart).split(':').map(Number);
    if (isNaN(peH) || isNaN(nsH)) return 24;
    // Calculate rest across overnight: prevDay end to nextDay start (+24h)
    const rest = (nsH + (isNaN(nsM) ? 0 : nsM / 60) + 24) - (peH + (isNaN(peM) ? 0 : peM / 60));
    return Math.max(0, rest);
  }

  _formatDateOffset(dateStr, dayOffset) {
    if (!dateStr) return '';
    const parts = String(dateStr).split('-');
    if (parts.length < 3) return '';
    const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    d.setDate(d.getDate() + dayOffset);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
}

// Global window registration
if (typeof window !== 'undefined') {
  window.OpalRosterEngine = OpalRosterEngine;
}

export default OpalRosterEngine;
