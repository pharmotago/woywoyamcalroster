/**
 * BriskSchedules Upgraded Core Frontend Application Logic
 */

// Import database layer — sets window.BriskDB and initialises Firebase
import BriskDB from './database.js';
window.BriskDB = BriskDB;
import { SwapDB } from './swaps.js';
window.SwapDB = SwapDB;

// Application State
import BriskScheduler from './scheduler.js';
window.BriskScheduler = BriskScheduler;

// Static Module Imports (Guarantees synchronous availability of all 87 handlers)
import './modules/role-customization.js';
import './modules/compliance.js';
import './modules/payroll-engine.js';
import './modules/ai-ops.js';
// Toast Notification System
function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <div class="toast-icon">
      ${type === 'success' ? '<i class="fas fa-check-circle"></i>' : 
        type === 'error' ? '<i class="fas fa-exclamation-circle"></i>' : 
        type === 'warning' ? '<i class="fas fa-triangle-exclamation"></i>' : 
        '<i class="fas fa-info-circle"></i>'}
    </div>
    <div class="toast-content" style="line-height: 1.4; font-weight: 500;">${message.replace(/\n/g, '<br>')}</div>
  `;
  container.appendChild(toast);
  requestAnimationFrame(() => {
    toast.classList.add('toast-show');
  });
  setTimeout(() => {
    toast.classList.remove('toast-show');
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}
window.showToast = showToast;


// ==========================================
// CORE UTILITIES & MODULE DELEGATORS (SYNCHRONOUS GUARANTEES)
// ==========================================
function hexToRgb(hex) {
  if (!hex || typeof hex !== 'string') return '79, 70, 229';
  const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
  const fullHex = hex.replace(shorthandRegex, (m, r, g, b) => r + r + g + g + b + b);
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(fullHex);
  return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : '79, 70, 229';
}
window.hexToRgb = hexToRgb;

function timeToDecimal(timeStr) {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return (h || 0) + (m || 0) / 60;
}
window.timeToDecimal = timeToDecimal;

function calculateShiftHours(start, end, unpaidMealMins = null) {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  let diffMinutes = (eh * 60 + em) - (sh * 60 + sm);
  if (diffMinutes < 0) diffMinutes += 24 * 60; // Overnight shift midnight crossover
  
  const grossHours = diffMinutes / 60;
  let mealMins = 0;
  if (unpaidMealMins !== null && unpaidMealMins !== undefined) {
    mealMins = Number(unpaidMealMins) || 0;
  } else {
    // Fair Work Default: 30m unpaid break if shift >= 5h
    mealMins = grossHours >= 5 ? 30 : 0;
  }
  return Math.max(0, grossHours - (mealMins / 60));
}
window.calculateShiftHours = calculateShiftHours;

function getAwardBreakEntitlements(grossHours) {
  if (grossHours < 4) {
    return { paidBreaks: 0, unpaidMealMins: 0, description: 'No breaks required (< 4h)' };
  } else if (grossHours < 5) {
    return { paidBreaks: 1, unpaidMealMins: 0, description: '☕ 1x 10m Paid Rest Break' };
  } else if (grossHours < 7.6) {
    return { paidBreaks: 1, unpaidMealMins: 30, description: '🍱 1x 30m Unpaid Lunch + ☕ 1x 10m Paid Rest' };
  } else {
    return { paidBreaks: 2, unpaidMealMins: 30, description: '🍱 1x 30m Unpaid Lunch + ☕ 2x 10m Paid Rest' };
  }
}
window.getAwardBreakEntitlements = getAwardBreakEntitlements;

function formatTradingHoursSummary(th) {
  if (!th || typeof th !== 'object') {
    return 'Mon–Fri 08:30–17:30 | Sat 09:00–13:00 | Sun Closed';
  }
  
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const getDayStr = (d) => {
    const data = th[String(d)] || th[d];
    if (!data) return (d === 0 ? 'Closed' : (d === 6 ? '09:00–13:00' : '08:30–17:30'));
    if (data.closed) return 'Closed';
    const op = data.open ? String(data.open).substring(0, 5) : '08:30';
    const cl = data.close ? String(data.close).substring(0, 5) : '17:30';
    return `${op}–${cl}`;
  };

  const mon = getDayStr(1);
  const tue = getDayStr(2);
  const wed = getDayStr(3);
  const thu = getDayStr(4);
  const fri = getDayStr(5);
  const sat = getDayStr(6);
  const sun = getDayStr(0);

  const parts = [];

  // Check if Mon-Fri are identical
  if (mon === tue && tue === wed && wed === thu && thu === fri) {
    parts.push(mon === 'Closed' ? 'Mon–Fri Closed' : `Mon–Fri ${mon}`);
  } else {
    // If weekdays differ
    for (let i = 1; i <= 5; i++) {
      parts.push(`${dayNames[i]} ${getDayStr(i)}`);
    }
  }

  // Sat & Sun
  parts.push(`Sat ${sat}`);
  parts.push(`Sun ${sun}`);

  return parts.join(' | ');
}
window.formatTradingHoursSummary = formatTradingHoursSummary;

function getDailySalesTargets() {
  const defaultTargets = { 1: 11000, 2: 10500, 3: 10500, 4: 12000, 5: 13500, 6: 8500, 0: 6000 };
  try {
    if (typeof BriskDB !== 'undefined' && BriskDB.getSettings) {
      const dbSettings = BriskDB.getSettings();
      if (dbSettings && dbSettings.salesTargets) {
        return { ...defaultTargets, ...dbSettings.salesTargets };
      }
    }
  } catch (e) {}
  return defaultTargets;
}
window.getDailySalesTargets = getDailySalesTargets;

function getWageKpiHealth(percentage) {
  if (percentage <= 0) return { color: 'var(--text-muted)', label: 'No Data', badgeClass: 'badge-outline' };
  if (percentage < 10.5) return { color: '#10b981', label: '🟢 Optimal (<10.5%)', badgeClass: 'badge-success' };
  if (percentage <= 13.5) return { color: 'var(--accent-cyan)', label: '🔵 Healthy Benchmark (10.5–13.5%)', badgeClass: 'badge-cyan' };
  if (percentage <= 16.0) return { color: '#fbbf24', label: '🟡 Warning (13.5–16.0%)', badgeClass: 'badge-warning' };
  return { color: '#f87171', label: '🔴 Critical High (>16.0%)', badgeClass: 'badge-danger' };
}
window.getWageKpiHealth = getWageKpiHealth;

function updateShiftBreakSummary() {
  const start = document.getElementById('shift-start')?.value;
  const end = document.getElementById('shift-end')?.value;
  const breakSelectVal = document.getElementById('shift-unpaid-break')?.value || 'auto';
  const summaryEl = document.getElementById('shift-award-summary');
  const netHoursInput = document.getElementById('shift-net-hours');

  if (!start || !end) {
    if (summaryEl) summaryEl.textContent = 'Select times to calculate';
    if (netHoursInput) netHoursInput.value = '0.0h';
    return;
  }

  const grossHours = calculateShiftHours(start, end, 0); // 0 meal mins to get gross duration
  const entitlements = getAwardBreakEntitlements(grossHours);
  
  let mealMins = entitlements.unpaidMealMins;
  let isCrib = false;
  if (breakSelectVal === 'crib_paid') {
    mealMins = 0;
    isCrib = true;
  } else if (breakSelectVal !== 'auto') {
    mealMins = parseInt(breakSelectVal, 10) || 0;
  }

  const netHours = calculateShiftHours(start, end, isCrib ? 'crib_paid' : mealMins);
  
  if (summaryEl) {
    if (isCrib) {
      summaryEl.innerHTML = `<span style="color:#10b981;"><i class="fa-solid fa-mug-hot"></i> 30m Paid Crib Break (Clause 20.2 - Sole Pharmacist On-Premises, 100% Paid)</span>`;
    } else {
      const mealText = mealMins > 0 ? `🍱 ${mealMins}m Unpaid Lunch` : (grossHours > 5.0 ? '⚠️ No Lunch (Clause 20: 5h+ work requires 30m break)' : '🍱 No Unpaid Lunch');
      const restText = entitlements.paidBreaks > 0 ? ` | ☕ ${entitlements.paidBreaks}x 10m Paid Rest` : '';
      summaryEl.innerHTML = `${mealText}${restText} (${grossHours.toFixed(1)}h gross)`;
    }
  }

  if (netHoursInput) {
    netHoursInput.value = `${netHours.toFixed(1)}h`;
  }
}
window.updateShiftBreakSummary = updateShiftBreakSummary;

function updatePasteButtonState() {
  const container = document.getElementById('shift-paste-container');
  if (!container) return;
  if (state.copiedShift) {
    container.style.display = 'block';
    container.innerHTML = `
      <div style="background: rgba(0, 229, 255, 0.08); border: 1px dashed var(--accent-cyan); border-radius: var(--radius-sm); padding: 8px 12px; display: flex; justify-content: space-between; align-items: center;">
        <span style="font-size: 0.8rem; color: var(--accent-cyan);"><i class="fa-regular fa-copy"></i> Copied: ${state.copiedShift.role} (${formatTimeAmPm(state.copiedShift.startTime)} - ${formatTimeAmPm(state.copiedShift.endTime)})</span>
        <button type="button" class="btn btn-primary" style="padding: 2px 8px; font-size: 0.75rem;" onclick="pasteCopiedShiftDetails()">Paste</button>
      </div>
    `;
  } else {
    container.style.display = 'none';
    container.innerHTML = '';
  }
}
window.updatePasteButtonState = updatePasteButtonState;

function pasteCopiedShiftDetails() {
  if (!state.copiedShift) return;
  if (state.copiedShift.role) document.getElementById('shift-role').value = state.copiedShift.role;
  if (state.copiedShift.startTime) document.getElementById('shift-start').value = (state.copiedShift.startTime || '09:00').substring(0, 5);
  if (state.copiedShift.endTime) document.getElementById('shift-end').value = (state.copiedShift.endTime || '17:00').substring(0, 5);
  if (state.copiedShift.notes) document.getElementById('shift-notes').value = state.copiedShift.notes;
  if (state.copiedShift.unpaidMealMins !== undefined && state.copiedShift.unpaidMealMins !== null && document.getElementById('shift-unpaid-break')) {
    document.getElementById('shift-unpaid-break').value = String(state.copiedShift.unpaidMealMins);
  }
  updateShiftBreakSummary();
  showToast('Copied shift details pasted!', 'info');
}
window.pasteCopiedShiftDetails = pasteCopiedShiftDetails;

function getHigherDutiesMinimumRate(roleName) {
  if (!roleName || typeof roleName !== 'string') return 0;
  const r = roleName.toLowerCase();
  if (r.includes('pharmacist manager')) return 52.15;
  if (r.includes('pharmacist in charge') || r.includes('pic')) return 46.50;
  if (r.includes('pharmacist')) return 41.74;
  if (r.includes('intern') || r.includes('graduate')) return 34.50;
  if (r.includes('dispense technician') || r.includes('technician') || r.includes('level 4')) return 30.66;
  if (r.includes('webster') || r.includes('level 3')) return 29.45;
  if (r.includes('level 2')) return 28.45;
  return 0;
}
window.getHigherDutiesMinimumRate = getHigherDutiesMinimumRate;

function getEmployeeLaborCostBreakdown(emp, shiftDate, hours, shiftRole) {
  if (!emp) return { base: 0, super: 0, gst: 0, total: 0, isLocum: false, label: 'PAYG' };
  let hourlyRate = parseFloat(emp.hourlyRate) || 0;
  const isPubHol = isNswPublicHoliday(shiftDate);
  const tcDay = new Date(shiftDate + 'T00:00:00').getDay();
  const empType = emp.employmentType || 'permanent';

  if (empType === 'locum_invoice') {
    const base = hours * hourlyRate;
    const gst = base * 0.10;
    const superCost = base * 0.12;
    const total = base + gst + superCost;
    return { base, super: superCost, gst, total, isLocum: true, label: 'Locum Contractor', effectiveRate: hourlyRate };
  } else if (empType === 'locum_invoice_no_gst') {
    const base = hours * hourlyRate;
    const superCost = base * 0.12;
    const total = base + superCost;
    return { base, super: superCost, gst: 0, total, isLocum: true, label: 'Locum Contractor', effectiveRate: hourlyRate };
  } else if (empType === 'locum_all_inclusive') {
    const base = hours * hourlyRate;
    return { base, super: 0, gst: 0, total: base, isLocum: true, label: 'Locum Contractor (All-Inclusive)', effectiveRate: hourlyRate };
  }

  // Pharmacy Award 2026 Clause 27 Higher Duties Allowance
  let isHigherDuties = false;
  if (shiftRole) {
    const higherRate = getHigherDutiesMinimumRate(shiftRole);
    if (higherRate > hourlyRate) {
      hourlyRate = higherRate;
      isHigherDuties = true;
    }
  }

  // Standard PAYG Employee
  let penaltyMultiplier = 1.0;
  const isCasual = empType === 'casual';
  
  if (isPubHol) {
    penaltyMultiplier = isCasual ? 2.50 : 2.25;
  } else if (tcDay === 0) {
    penaltyMultiplier = isCasual ? 2.00 : 1.75;
  } else if (tcDay === 6) {
    penaltyMultiplier = isCasual ? 1.50 : 1.25;
  } else if (isCasual) {
    penaltyMultiplier = 1.25;
  }

  const base = hours * hourlyRate * penaltyMultiplier;
  const superCost = base * 0.12;
  const total = isCasual ? (base * 1.135) : (base * 1.205);
  return { 
    base, 
    super: superCost, 
    gst: 0, 
    total, 
    isLocum: false, 
    label: isCasual ? 'PAYG Casual' : 'PAYG Permanent',
    penaltyMultiplier,
    isHigherDuties,
    effectiveRate: hourlyRate
  };
}
window.getEmployeeLaborCostBreakdown = getEmployeeLaborCostBreakdown;

function calculateLaborCostForecast() {
  try {
    const costBadge = document.getElementById('labor-cost-forecast-badge');
    const costValEl = document.getElementById('labor-cost-forecast-value');
    const wageBadge = document.getElementById('wage-ratio-forecast-badge');
    const wageValEl = document.getElementById('wage-ratio-forecast-value');
    const isManagerOrOwner = hasManagerPermissions(state.currentUser);
    
    if (!isManagerOrOwner) {
      if (costBadge) costBadge.style.display = 'none';
      if (wageBadge) wageBadge.style.display = 'none';
      const repKpiCard = document.getElementById('rep-wage-kpi-card');
      if (repKpiCard) repKpiCard.style.display = 'none';
      return;
    }

    if (costBadge) costBadge.style.display = 'flex';
    if (wageBadge) wageBadge.style.display = 'flex';
    const repKpiCard = document.getElementById('rep-wage-kpi-card');
    if (repKpiCard) repKpiCard.style.display = 'flex';

    const mon = new Date(state.currentWeekStart);
    const sun = new Date(mon);
    sun.setDate(mon.getDate() + 6);
    mon.setHours(0,0,0,0);
    sun.setHours(23,59,59,999);

    const monStr = formatDateISO(mon);
    const sunStr = formatDateISO(sun);

    const weekShifts = state.shifts.filter(s => {
      return s && s.date && s.date >= monStr && s.date <= sunStr;
    });

    let totalLaborCost = 0;
    let totalWeeklyHours = 0;

    weekShifts.forEach(shift => {
      if (!shift.employeeId) return;
      const emp = state.employees.find(e => e.id === shift.employeeId);
      if (!emp) return;
      const r = (emp.role || '').toLowerCase().trim();
      if (r === 'owner' || r === 'partner' || r === 'managing partner') return;

      const duration = calculateShiftHours(shift.startTime, shift.endTime, shift.unpaidMealMins);
      totalWeeklyHours += duration;
      const breakdown = getEmployeeLaborCostBreakdown(emp, shift.date, duration, shift.role);
      totalLaborCost += breakdown.total;
    });

    const targets = getDailySalesTargets();
    let totalSalesTarget = 0;
    for (let d = 0; d < 7; d++) {
      totalSalesTarget += Number(targets[String(d)] || 0);
    }
    if (totalSalesTarget <= 0) totalSalesTarget = 75000;

    const wageRatio = totalSalesTarget > 0 ? (totalLaborCost / totalSalesTarget) * 100 : 0;
    const health = getWageKpiHealth(wageRatio);

    if (costValEl) costValEl.textContent = `${Math.round(totalLaborCost).toLocaleString('en-AU')}`;
    if (wageValEl) {
      wageValEl.textContent = `${wageRatio.toFixed(1)}%`;
      wageValEl.style.color = health.color;
    }
  } catch (e) {
    console.warn('calculateLaborCostForecast error:', e);
  }
}
window.calculateLaborCostForecast = calculateLaborCostForecast;

async function saveDailySalesTargets(targets) {
  try {
    if (!state.settings) state.settings = {};
    state.settings.salesTargets = targets;
    localStorage.setItem('brisk_daily_sales_targets', JSON.stringify(targets));
    if (typeof BriskDB !== 'undefined' && BriskDB.saveSettings) {
      await BriskDB.saveSettings(state.settings);
    }
  } catch (e) {
    console.warn('Failed to save sales targets:', e);
  }
}
window.saveDailySalesTargets = saveDailySalesTargets;

function openSalesTargetsModal() {
  if (!hasManagerPermissions(state.currentUser)) {
    showToast('Permission denied: Sales Forecast & Wage KPI is only available to Managers and Owners.', 'warning');
    return;
  }
  const modal = document.getElementById('modal-sales-kpi');
  if (!modal) return;

  const daysListContainer = document.getElementById('sales-kpi-days-list');
  if (daysListContainer) {
    daysListContainer.innerHTML = '';
    const targets = getDailySalesTargets();
    const DAY_IDX_MAP = [1, 2, 3, 4, 5, 6, 0]; // Mon..Sun
    const DAY_NAMES_LOCAL = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    for (let i = 0; i < 7; i++) {
      const dayIdx = DAY_IDX_MAP[i];
      const dayName = DAY_NAMES_LOCAL[i];
      const d = new Date(state.currentWeekStart);
      d.setDate(state.currentWeekStart.getDate() + i);
      const dateStr = formatDateISO(d);
      
      const dayShifts = state.shifts.filter(s => s.date === dateStr && s.employeeId);
      let dayLaborCost = 0;
      let dayHours = 0;
      dayShifts.forEach(shift => {
        const emp = state.employees.find(e => e.id === shift.employeeId);
        if (!emp) return;
        const r = (emp.role || '').toLowerCase().trim();
        if (r === 'owner' || r === 'partner' || r === 'managing partner') return;

        const hours = calculateShiftHours(shift.startTime, shift.endTime, shift.unpaidMealMins);
        dayHours += hours;
        dayLaborCost += getEmployeeLaborCostBreakdown(emp, shift.date, hours, shift.role).total;
      });

      const currentTarget = targets[String(dayIdx)] !== undefined ? targets[String(dayIdx)] : 10000;
      const initialPct = currentTarget > 0 ? (dayLaborCost / currentTarget) * 100 : 0;
      const initialKpi = getWageKpiHealth(initialPct);

      const row = document.createElement('div');
      row.className = 'sales-kpi-row glass-card';
      row.style.padding = '10px 14px';
      row.style.background = 'rgba(255, 255, 255, 0.03)';
      row.style.border = '1px solid var(--border-glass)';
      row.style.borderRadius = 'var(--radius-sm)';
      row.style.display = 'flex';
      row.style.alignItems = 'center';
      row.style.justifyContent = 'space-between';
      row.style.gap = '12px';
      row.style.flexWrap = 'wrap';

      row.innerHTML = `
        <div style="min-width: 120px;">
          <strong style="display:block; font-size:0.9rem;">${dayName}</strong>
          <span class="text-muted" style="font-size:0.75rem;">${dateStr.slice(5)} (${dayHours.toFixed(1)}h | ${dayLaborCost.toFixed(0)})</span>
        </div>
        <div style="display:flex; align-items:center; gap:6px; flex:1; min-width: 150px;">
          <span style="font-size:0.85rem; color:var(--text-muted);">$</span>
          <input type="number" id="sales-target-input-${dayIdx}" class="form-control sales-target-input" style="height:34px; font-size:0.9rem; padding:4px 8px;" value="${currentTarget}" min="0" step="100" oninput="recalculateSalesKpiModal()">
        </div>
        <div style="min-width: 100px; text-align:right;">
          <span id="sales-row-pct-${dayIdx}" style="font-weight:700; font-size:1rem; color:${initialKpi.color};">${initialPct.toFixed(1)}%</span>
          <span style="font-size:0.7rem; color:var(--text-muted); display:block;">Wage Ratio</span>
        </div>
      `;
      daysListContainer.appendChild(row);
    }
  }

  recalculateSalesKpiModal();
  modal.classList.add('active');
}
window.openSalesTargetsModal = openSalesTargetsModal;

function recalculateSalesKpiModal() {
  const DAY_IDX_MAP = [1, 2, 3, 4, 5, 6, 0];
  let totalLabor = 0;
  let totalSales = 0;

  for (let i = 0; i < 7; i++) {
    const dayIdx = DAY_IDX_MAP[i];
    const d = new Date(state.currentWeekStart);
    d.setDate(state.currentWeekStart.getDate() + i);
    const dateStr = formatDateISO(d);
    
    const dayShifts = state.shifts.filter(s => s.date === dateStr && s.employeeId);
    let dayLaborCost = 0;
    dayShifts.forEach(shift => {
      const emp = state.employees.find(e => e.id === shift.employeeId);
      if (!emp) return;
      const r = (emp.role || '').toLowerCase().trim();
      if (r === 'owner' || r === 'partner' || r === 'managing partner') return;

      const hours = calculateShiftHours(shift.startTime, shift.endTime, shift.unpaidMealMins);
      dayLaborCost += getEmployeeLaborCostBreakdown(emp, shift.date, hours, shift.role).total;
    });

    const input = document.getElementById(`sales-target-input-${dayIdx}`);
    const salesVal = input ? parseFloat(input.value) || 0 : 0;
    const pct = salesVal > 0 ? (dayLaborCost / salesVal) * 100 : 0;
    const health = getWageKpiHealth(pct);

    const rowPctEl = document.getElementById(`sales-row-pct-${dayIdx}`);
    if (rowPctEl) {
      rowPctEl.textContent = `${pct.toFixed(1)}%`;
      rowPctEl.style.color = health.color;
    }

    totalLabor += dayLaborCost;
    totalSales += salesVal;
  }

  const weeklyRatio = totalSales > 0 ? (totalLabor / totalSales) * 100 : 0;
  const overallHealth = getWageKpiHealth(weeklyRatio);

  const laborEl = document.getElementById('sales-kpi-modal-labor');
  const salesEl = document.getElementById('sales-kpi-modal-sales');
  const ratioEl = document.getElementById('sales-kpi-modal-ratio');
  const statusBadge = document.getElementById('sales-kpi-modal-status-badge');

  if (laborEl) laborEl.textContent = `${totalLabor.toFixed(2)}`;
  if (salesEl) salesEl.textContent = `${totalSales.toLocaleString('en-AU', { minimumFractionDigits: 0 })}`;
  if (ratioEl) {
    ratioEl.textContent = `${weeklyRatio.toFixed(1)}%`;
    ratioEl.style.color = overallHealth.color;
  }
  if (statusBadge) {
    statusBadge.textContent = overallHealth.label;
    statusBadge.style.background = `${overallHealth.color}22`;
    statusBadge.style.color = overallHealth.color;
    statusBadge.style.border = `1px solid ${overallHealth.color}66`;
  }
}
window.recalculateSalesKpiModal = recalculateSalesKpiModal;

function applySalesPreset(amount) {
  const DAY_IDX_MAP = [1, 2, 3, 4, 5, 6, 0];
  DAY_IDX_MAP.forEach(idx => {
    const input = document.getElementById(`sales-target-input-${idx}`);
    if (input) input.value = amount;
  });
  recalculateSalesKpiModal();
}
window.applySalesPreset = applySalesPreset;

function resetSalesToDefault() {
  const defaultTargets = { 1: 11000, 2: 10500, 3: 10500, 4: 12000, 5: 13500, 6: 8500, 0: 6000 };
  Object.keys(defaultTargets).forEach(idx => {
    const input = document.getElementById(`sales-target-input-${idx}`);
    if (input) input.value = defaultTargets[idx];
  });
  recalculateSalesKpiModal();
}
window.resetSalesToDefault = resetSalesToDefault;

function closeSalesTargetsModal() {
  const modal = document.getElementById('modal-sales-kpi');
  if (modal) modal.classList.remove('active');
}
window.closeSalesTargetsModal = closeSalesTargetsModal;

async function handleSaveSalesTargets(event) {
  if (event) event.preventDefault();
  const DAY_IDX_MAP = [1, 2, 3, 4, 5, 6, 0];
  const newTargets = {};
  DAY_IDX_MAP.forEach(idx => {
    const input = document.getElementById(`sales-target-input-${idx}`);
    newTargets[idx] = input ? parseFloat(input.value) || 0 : 10000;
  });

  await saveDailySalesTargets(newTargets);
  closeSalesTargetsModal();
  calculateLaborCostForecast();
  renderScheduler();
  showToast('Sales forecast targets saved and synced live across all devices.', 'success');
}
window.handleSaveSalesTargets = handleSaveSalesTargets;

function renderSettingsPanel() {
  if (!hasManagerPermissions(state.currentUser)) {
    return;
  }
  const DEFAULT_TRADING_HOURS = {
    '0': { open: '08:30', close: '17:30', closed: false },
    '1': { open: '08:00', close: '20:00', closed: false },
    '2': { open: '08:00', close: '20:00', closed: false },
    '3': { open: '08:00', close: '20:00', closed: false },
    '4': { open: '08:00', close: '20:00', closed: false },
    '5': { open: '08:00', close: '20:00', closed: false },
    '6': { open: '08:00', close: '18:00', closed: false }
  };
  if (!state.settings) state.settings = {};
  if (!state.settings.tradingHours) {
    state.settings.tradingHours = DEFAULT_TRADING_HOURS;
  }
  const th = state.settings.tradingHours;
  
  for (let d = 0; d < 7; d++) {
    const dayData = th[String(d)] || DEFAULT_TRADING_HOURS[String(d)];
    if (!dayData) continue;
    
    const closedCheckbox = document.getElementById(`trading-closed-${d}`);
    const openInput = document.getElementById(`trading-open-${d}`);
    const closeInput = document.getElementById(`trading-close-${d}`);
    
    if (closedCheckbox) closedCheckbox.checked = !!dayData.closed;
    if (openInput) {
      openInput.value = dayData.open || '08:30';
      openInput.disabled = !!dayData.closed;
    }
    if (closeInput) {
      closeInput.value = dayData.close || '17:30';
      closeInput.disabled = !!dayData.closed;
    }
  }

  const settingsName = document.getElementById('settings-company-name');
  if (settingsName) settingsName.value = state.settings.companyName || 'Amcal Pharmacy Woywoy Rosters';
}
window.renderSettingsPanel = renderSettingsPanel;

function renderAiOpsPanel() {}
window.renderAiOpsPanel = renderAiOpsPanel;

function onEmployeeDobChange() {
  const dobVal = document.getElementById('emp-dob')?.value;
  if (!dobVal) return;
  const age = Math.floor((new Date() - new Date(dobVal)) / (365.25 * 24 * 3600 * 1000));
  const ageEl = document.getElementById('emp-calculated-age');
  if (ageEl) ageEl.textContent = `Age: ${age} years`;
}
window.onEmployeeDobChange = onEmployeeDobChange;

function renderModalCertificatesList() {
  const container = document.getElementById('emp-certificates-list');
  if (!container) return;
  const certs = state.activeEmployeeModalCerts || [];
  container.innerHTML = certs.map((c, i) => `
    <span class="badge badge-cyan" style="display:inline-flex; align-items:center; gap:4px; margin:2px;">
      ${c}
      <i class="fa-solid fa-xmark" style="cursor:pointer;" onclick="removeCertificateFromEmployeeModal(${i})"></i>
    </span>
  `).join('') || '<span style="font-size:0.8rem; color:var(--text-muted);">No compliance certificates added</span>';
}
window.renderModalCertificatesList = renderModalCertificatesList;

let state = {
  currentTab: 'dashboard',
  currentWeekStart: null, // Date object (Monday)
  dailyDate: new Date(),  // Date object for Daily View
  employees: [],
  shifts: [],
  swaps: [],
  timecards: [],
  leaveRequests: [],
  settings: {},
  currentUser: null, // Stores session user
  roles: [],
  positions: [],
  copiedShift: null
};
window.state = state;

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
window.DAY_NAMES = DAY_NAMES;
window.MONTH_NAMES = MONTH_NAMES;

/* ==========================================================================
   WHITELIST LEADERSHIP ACCESS CONTROL & RBAC
   Authorized Owners & Managers: Glen, Katherine Nguyen, Vicky Duffy, Peter Kim
   ========================================================================== */
const AUTHORIZED_MANAGERS = [
  'peter kim',
  'peter',
  'pharmotago',
  'glen',
  'katherine nguyen',
  'katherine',
  'vicky duffy',
  'vicky'
];

function hasManagerPermissions(user = state.currentUser) {
  if (!user) return false;
  
  const name = String(user.name || '').toLowerCase().trim();
  const email = String(user.email || '').toLowerCase().trim();
  const role = String(user.role || '').toLowerCase().trim();

  // 1. Explicit Named Whitelist Leaders (Exact Full Name or Verified Emails)
  const WHITELIST_NAMES = ['peter kim', 'glen kanawati', 'katherine nguyen', 'vicki duffy', 'vicky duffy'];
  const WHITELIST_EMAILS = ['pharmotago@gmail.com', 'glenkanawati@gmail.com', 'nguyek@gmail.com', 'vickilorraine75@gmail.com'];
  
  if (WHITELIST_NAMES.includes(name) || WHITELIST_EMAILS.includes(email) || email.startsWith('peter.kim') || email.startsWith('glen.kanawati') || email.startsWith('pharmotago')) {
    return true;
  }

  // 2. Explicit Management Roles (Exact Match)
  const VALID_MANAGER_ROLES = ['owner', 'co-owner', 'admin', 'manager', 'partner', 'managing pharmacist', 'pharmacist manager', 'pharmacy manager'];
  if (VALID_MANAGER_ROLES.includes(role)) {
    return true;
  }

  // 3. Match against employee record in state.employees
  if (user.employeeId && state.employees && state.employees.length > 0) {
    const emp = state.employees.find(e => e.id === user.employeeId);
    if (emp && emp.role) {
      const empRole = emp.role.toLowerCase().trim();
      if (VALID_MANAGER_ROLES.includes(empRole)) {
        return true;
      }
    }
  }

  // All other staff (Pharmacists, Techs, Assistants, Casuals) are read-only
  return false;
}
window.hasManagerPermissions = hasManagerPermissions;

// Robust Auth Session Resolver: checks localStorage and Supabase Auth client storage
async function resolveAndRestoreAuthSession() {
  // 1. Check local session
  let currentSession = BriskDB.getSession();
  if (currentSession && currentSession.email) {
    return currentSession;
  }

  // 2. Check Supabase Auth client session (auto-restores from sb-*-auth-token)
  if (BriskDB.supabase && BriskDB.supabase.auth) {
    try {
      const { data: { session: sbSession } } = await BriskDB.supabase.auth.getSession();
      if (sbSession && sbSession.user && sbSession.user.email) {
        const cleanEmail = sbSession.user.email.toLowerCase().trim();
        const isWhitelistedLeader = ['peter', 'glen', 'katherine', 'vicky', 'vicki', 'pharmotago', 'nguyek', 'glenkanawati'].some(l => cleanEmail.includes(l));
        
        let resolvedRole = isWhitelistedLeader ? 'owner' : 'employee';
        let empId = null;
        let empName = sbSession.user.user_metadata?.name || cleanEmail.split('@')[0];

        try {
          const { data: prof } = await BriskDB.supabase
            .from('brisk_users')
            .select('*')
            .eq('email', cleanEmail)
            .maybeSingle();
          if (prof) {
            resolvedRole = isWhitelistedLeader ? 'owner' : (prof.role || resolvedRole);
            empId = prof.employee_id || null;
            empName = prof.name || empName;
          }
        } catch (pErr) {}

        const restoredSession = {
          email: cleanEmail,
          role: resolvedRole,
          employeeId: empId,
          name: empName,
          token: sbSession.access_token || ''
        };

        BriskDB.setSession(restoredSession);
        return restoredSession;
      }
    } catch (sbErr) {
      console.warn('[App] Supabase session restore note:', sbErr);
    }
  }

  return null;
}

// On Page Load
document.addEventListener('DOMContentLoaded', async () => {
  // 1. Listen for Supabase Auth Events (SIGNED_IN, PASSWORD_RECOVERY, TOKEN_REFRESHED)
  if (typeof BriskDB !== 'undefined' && BriskDB.supabase && BriskDB.supabase.auth) {
    BriskDB.supabase.auth.onAuthStateChange(async (event, sbSession) => {
      console.log('[Auth Event]', event);
      if (event === 'PASSWORD_RECOVERY') {
        const modal = document.getElementById('modal-update-password');
        if (modal) modal.classList.add('active');
      }
      if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') && sbSession && sbSession.user) {
        if (!state.currentUser || state.currentUser.email !== sbSession.user.email.toLowerCase().trim()) {
          const restored = await resolveAndRestoreAuthSession();
          if (restored) {
            state.currentUser = restored;
            if (!window._modulesLoaded) { await window.bootModularSystem(); window._modulesLoaded = true; }
      await bootApplication();
          }
        }
      }
    });
  }

  // 2. Check if this is a password recovery redirect, magic link, or error
  const hash = window.location.hash;
  if (hash) {
    if (hash.includes('error_code=otp_expired') || hash.includes('error=access_denied')) {
      history.replaceState(null, '', window.location.pathname + window.location.search);
      setTimeout(() => {
        showToast('This password reset link has expired or was already used. Please request a new link below.', 'error');
        openResetPasswordModal();
      }, 500);
    } else if (hash.includes('access_token=')) {
      try {
        const hashParams = new URLSearchParams(hash.startsWith('#') ? hash.substring(1) : hash);
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');
        const type = hashParams.get('type');

        if (accessToken && BriskDB.supabase) {
          await BriskDB.supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken || ''
          });

          history.replaceState(null, '', window.location.pathname + window.location.search);

          if (type === 'recovery') {
            const modal = document.getElementById('modal-update-password');
            if (modal) modal.classList.add('active');
          }
        }
      } catch (hashErr) {
        console.error('Failed to process auth hash:', hashErr);
      }
    }
  }

  // 3. Resolve session from local storage or Supabase token
  state.currentUser = await resolveAndRestoreAuthSession();
  state.currentWeekStart = getMondayOfCurrentWeek(new Date());

  if (!state.currentUser) {
    // Show login screen
    showLoginScreen();

    // Bind forgot password button click
    const forgotBtn = document.getElementById('btn-forgot-password');
    if (forgotBtn) {
      forgotBtn.addEventListener('click', (e) => {
        e.preventDefault();
        openResetPasswordModal(e);
      });
    }

    // Check for invitation code in URL parameter (e.g. ?invite=XXXX)
    const urlParams = new URLSearchParams(window.location.search);
    const inviteCode = urlParams.get('invite');
    if (inviteCode) {
      showRegisterCard();
      document.getElementById('reg-invite-code').value = inviteCode.toUpperCase();
    }
  } else {
    // Session exists, boot application immediately
    if (!window._modulesLoaded) { await window.bootModularSystem(); window._modulesLoaded = true; }
      await bootApplication();
  }

  // Setup Sidebar Tab Events
  document.querySelectorAll('.menu-item').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.getAttribute('data-tab');
      if (tab) switchTab(tab);
    });
  });

  // Setup Week Pickers
  setupWeekPickers();
  
  // Initialize Clock in Header
  startLiveClock();

  // Listen for real-time DB changes with a light debounce.
  // GUARD: Only process if user is authenticated to prevent race-condition crash.
  let dbUpdateTimeout;
  window.addEventListener('brisk-db-updated', () => {
    if (!state.currentUser) return; // Auth guard: don't render before login completes
    clearTimeout(dbUpdateTimeout);
    dbUpdateTimeout = setTimeout(() => {
      loadDataFromState(); // also updates sidebar badges
      renderActivePanel();
    }, 50);
  });

  // Listen for offline queue sync status updates
  window.addEventListener('brisk-sync-status', (e) => {
    const pendingCount = e.detail.pending;
    const badge = document.getElementById('sync-pending-badge');
    const countSpan = document.getElementById('sync-pending-count');
    
    if (badge && countSpan) {
      if (pendingCount > 0) {
        countSpan.textContent = pendingCount;
        badge.style.display = 'inline-flex';
      } else {
        badge.style.display = 'none';
      }
    }
  });

  // ───────────────────────────────────────────────────────────
  // LIVE SYNC GUARDIAN & BACKGROUND HEARTBEAT (ZERO DATA LOSS)
  // ───────────────────────────────────────────────────────────
  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState === 'visible' && state.currentUser && typeof BriskDB !== 'undefined' && BriskDB.syncFromServer) {
      try {
        await BriskDB.syncFromServer();
        loadDataFromState();
        renderActivePanel();
      } catch (e) {
        console.warn('[LiveSync] Visibility sync note:', e);
      }
    }
  });

  window.addEventListener('focus', async () => {
    if (state.currentUser && typeof BriskDB !== 'undefined' && BriskDB.syncFromServer) {
      try {
        await BriskDB.syncFromServer();
        loadDataFromState();
        renderActivePanel();
      } catch (e) {
        console.warn('[LiveSync] Window focus sync note:', e);
      }
    }
  });

  window.addEventListener('online', async () => {
    showToast('Internet connection restored. Syncing data with cloud...', 'success');
    if (typeof BriskDB !== 'undefined' && BriskDB.syncFromServer) {
      try {
        await BriskDB.syncFromServer();
        loadDataFromState();
        renderActivePanel();
      } catch (e) {}
    }
  });

  // Background Heartbeat Sync every 30s (non-intrusive)
  setInterval(async () => {
    if (state.currentUser && document.visibilityState === 'visible' && !document.hidden && typeof BriskDB !== 'undefined' && BriskDB.syncFromServer) {
      try {
        await BriskDB.syncFromServer();
      } catch (e) {
        // silent background sync catch
      }
    }
  }, 30000);

  // Check initial offline queue
  if (typeof BriskDB !== 'undefined' && BriskDB.getOfflineQueueLength) {
    const initialPending = BriskDB.getOfflineQueueLength();
    const badge = document.getElementById('sync-pending-badge');
    const countSpan = document.getElementById('sync-pending-count');
    if (badge && countSpan && initialPending > 0) {
      countSpan.textContent = initialPending;
      badge.style.display = 'inline-flex';
    }
  }

  // Form Validation UX limits
  document.getElementById('shift-start')?.addEventListener('change', function(e) {
    document.getElementById('shift-end').min = e.target.value;
  });
  document.getElementById('leave-start-date')?.addEventListener('change', function(e) {
    document.getElementById('leave-end-date').min = e.target.value;
  });

  // Modal accessibility & dismissal
  window.closeModal = function(modalEl) {
    if (!modalEl) return;
    modalEl.classList.add('closing');
    setTimeout(() => {
      modalEl.classList.remove('active');
      modalEl.classList.remove('closing');
    }, 200);
  };


  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal.active').forEach(m => window.closeModal(m));
    }
  });
  document.querySelectorAll('.modal').forEach(m => {
    m.addEventListener('click', (e) => {
      if (e.target === m) window.closeModal(m);
    });
  });
});

// Boot the application: load data and apply role-based views
async function bootApplication() {
  state.currentWeekStart = getMondayOfCurrentWeek(new Date());
  try {
    // Show app layout, hide login
    document.getElementById('login-screen').classList.remove('active');

    // Show a temporary loading placeholder while we fetch the real name
    const cachedName = state.currentUser.name || '';
    const displayName = cachedName || '…';
    document.getElementById('sidebar-user-name').textContent = displayName;
    document.getElementById('dash-user-name').textContent = displayName;

    // Sync data from cloud (employees, shifts, timecards, leave, swaps)
    await BriskDB.syncFromServer();
    try {
      state.swaps = (typeof SwapDB !== 'undefined' && SwapDB.getSwaps) ? await SwapDB.getSwaps() : [];
      state.swapsLoaded = true;
    } catch (swapErr) {
      console.warn('Swap sync note:', swapErr);
      state.swaps = [];
    }
    loadDataFromState();

    // BUG 4 FIX: Re-read the actual user profile name from freshly synced brisk_users
    // This resolves stale localStorage or missing name fallback showing "User"
    const freshSession = BriskDB.getSession();
    if (freshSession && freshSession.name) {
      state.currentUser.name = freshSession.name;
      document.getElementById('sidebar-user-name').textContent = freshSession.name;
      document.getElementById('dash-user-name').textContent = freshSession.name;
    } else if (!cachedName) {
      // Fallback: query from loaded employee list if name still missing
      const myEmployee = state.employees.find(e => e.email === state.currentUser.email);
      if (myEmployee && myEmployee.name) {
        state.currentUser.name = myEmployee.name;
        document.getElementById('sidebar-user-name').textContent = myEmployee.name;
        document.getElementById('dash-user-name').textContent = myEmployee.name;
      }
    }

    // Apply Role-Based Access Control (RBAC)
    applyRoleAccessControl();

    // Ensure Owner option is present in invite-role dropdown (forces instant UI update even if cached HTML)
    const inviteRoleSelect = document.getElementById('invite-role');
    if (inviteRoleSelect && !inviteRoleSelect.querySelector('option[value="owner"]')) {
      const ownerOpt = document.createElement('option');
      ownerOpt.value = 'owner';
      ownerOpt.textContent = 'Owner (Full administrative access & system owner)';
      inviteRoleSelect.appendChild(ownerOpt);
    }

    // Render active panel
    renderActivePanel();
  } catch (err) {
    console.error('Failed to sync from server on boot:', err);
    showToast('Syncing is taking longer than expected. Loading in background...', 'info');
    loadDataFromState();
    applyRoleAccessControl();
    renderActivePanel();
  } finally {
    // Hide loading overlay
    const loadingOverlay = document.getElementById('loading-overlay');
    if (loadingOverlay) loadingOverlay.classList.add('hide');
    document.getElementById('app-root').style.display = '';
  }
}


function loadDataFromState() {
  const isManager = hasManagerPermissions(state.currentUser);
  const myEmpId = state.currentUser?.employeeId || state.currentUser?.id;

  const rawEmployees = BriskDB.getEmployees();
  if (isManager) {
    state.employees = rawEmployees;
    state.leaveRequests = BriskDB.getLeaveRequests();
    state.timecards = BriskDB.getTimecards();
  } else {
    // C-4 Guard: Sanitize employee list for non-managers (mask colleague wages, DOB, phone)
    state.employees = rawEmployees.map(e => {
      if (e.id === myEmpId) return { ...e };
      return {
        ...e,
        hourlyRate: 0,
        awardLevel: '',
        dob: undefined,
        phone: undefined,
        availability: { ...(e.availability || {}) }
      };
    });
    // C-4 Guard: Non-managers only access their own leave requests in memory
    state.leaveRequests = BriskDB.getLeaveRequests().filter(lr => lr.employeeId === myEmpId);
    // C-4 Guard: Non-managers only access their own timecards in memory
    state.timecards = BriskDB.getTimecards().filter(tc => tc.employeeId === myEmpId);
  }
  state.shifts = BriskDB.getShifts();
  state.settings = BriskDB.getSettings();
  state.roles = BriskDB.getRoles();
  state.positions = BriskDB.getPositions();
  
  if (!state.swapsLoaded) {
    state.swapsLoaded = true;
    try {
      if (typeof SwapDB !== 'undefined' && SwapDB && SwapDB.getSwaps) {
        SwapDB.getSwaps().then(swaps => { state.swaps = swaps || []; }).catch(() => {});
      }
    } catch (e) {}
  }
  
  if (typeof renderRolesSettingsList === 'function') {
    window.renderRolesSettingsList();
  }
  if (typeof renderPositionsSettingsList === 'function') {
    window.renderPositionsSettingsList();
  }

  const sidebarName = document.getElementById('sidebar-company-name');
  if (sidebarName) sidebarName.textContent = state.settings.companyName || 'Amcal Pharmacy Woywoy Rosters';
  const settingsName = document.getElementById('settings-company-name');
  if (settingsName) settingsName.value = state.settings.companyName || 'Amcal Pharmacy Woywoy Rosters';

  if (state.currentUser) {
    if (hasManagerPermissions(state.currentUser)) {
      const pendingTimecards = state.timecards.filter(tc => !tc.approved).length;
      const badgeTc = document.getElementById('badge-timeclock');
      if (badgeTc) { badgeTc.style.display = pendingTimecards > 0 ? 'inline-block' : 'none'; badgeTc.textContent = pendingTimecards; }
      // BUG 5 FIX: Also update mobile badge
      const badgeTcMobile = document.getElementById('badge-timeclock-mobile');
      if (badgeTcMobile) { badgeTcMobile.style.display = pendingTimecards > 0 ? 'inline-block' : 'none'; badgeTcMobile.textContent = pendingTimecards; }
      
      const pendingLeave = state.leaveRequests.filter(lr => lr.status === 'Pending').length;
      const badgeLeave = document.getElementById('badge-timeoff');
      if (badgeLeave) { badgeLeave.style.display = pendingLeave > 0 ? 'inline-block' : 'none'; badgeLeave.textContent = pendingLeave; }
      // BUG 5 FIX: Also update mobile badge
      const badgeLeaveMobile = document.getElementById('badge-timeoff-mobile');
      if (badgeLeaveMobile) { badgeLeaveMobile.style.display = pendingLeave > 0 ? 'inline-block' : 'none'; badgeLeaveMobile.textContent = pendingLeave; }

      // Hide cover badges for managers
      const badgeCover = document.getElementById('badge-cover-requests');
      if (badgeCover) badgeCover.style.display = 'none';
      const badgeCoverMobile = document.getElementById('badge-cover-requests-mobile');
      if (badgeCoverMobile) badgeCoverMobile.style.display = 'none';
    } else {
      // For employees, calculate active cover requests from other staff
      const todayStr = formatDateISO(new Date());
      const activeCovers = state.swaps.filter(swap => {
        if ((swap.status || '').toUpperCase() !== 'PENDING') return false;
        if (swap.requestingEmployeeId === state.currentUser.employeeId) return false;
        const shift = state.shifts.find(s => s.id === swap.shiftId);
        return shift && shift.date >= todayStr;
      }).length;

      const badgeCover = document.getElementById('badge-cover-requests');
      if (badgeCover) {
        badgeCover.style.display = activeCovers > 0 ? 'inline-block' : 'none';
        badgeCover.textContent = activeCovers;
      }
      const badgeCoverMobile = document.getElementById('badge-cover-requests-mobile');
      if (badgeCoverMobile) {
        badgeCoverMobile.style.display = activeCovers > 0 ? 'inline-block' : 'none';
        badgeCoverMobile.textContent = activeCovers;
      }
      // Employees don't see timeclock/timeoff manager badges
      const badgeTcMobile = document.getElementById('badge-timeclock-mobile');
      if (badgeTcMobile) badgeTcMobile.style.display = 'none';
      const badgeLeaveMobile = document.getElementById('badge-timeoff-mobile');
      if (badgeLeaveMobile) badgeLeaveMobile.style.display = 'none';
    }
  }
}


function toggleTheme() {
  const isLight = document.body.classList.toggle('theme-light');
  localStorage.setItem('theme', isLight ? 'light' : 'dark');
}

// Initial theme load
if (localStorage.getItem('theme') === 'light') {
  document.body.classList.add('theme-light');
}

// Role-Based UI visibility
function applyRoleAccessControl() {
  const isManager = hasManagerPermissions(state.currentUser);

  // Set global body class for CSS-level privacy lockdown
  if (document.body) {
    document.body.classList.toggle('role-employee', !isManager);
    document.body.classList.toggle('role-manager', isManager);
  }

  const menuEmployees = document.getElementById('menu-employees');
  const menuReports = document.getElementById('menu-reports');
  const menuSettings = document.getElementById('menu-settings');
  const schedulerControls = document.getElementById('scheduler-manager-controls');
  const quickActionsCard = document.getElementById('dash-quick-actions-card');
  const staffActionsCard = document.getElementById('dash-staff-actions-card');
  const personalSummaryCard = document.getElementById('dash-personal-summary-card');
  const nextShiftCard = document.getElementById('dash-next-shift-card');
  const personalLeavesCard = document.getElementById('dash-personal-leaves-card');
  const personalTimeclockCard = document.getElementById('dash-personal-timeclock-card');
  const clockTerminalDesc = document.getElementById('clock-terminal-description');
  const clockEmpSelect = document.getElementById('clock-emp-select');
  const adminPanel = document.getElementById('timeclock-admin-panel');
  const leaveSelectorGroup = document.getElementById('leave-employee-selector-group');
  const costBadge = document.getElementById('labor-cost-forecast-badge');
  const wageBadge = document.getElementById('wage-ratio-forecast-badge');
  const repKpiCard = document.getElementById('rep-wage-kpi-card');
  const repReconcileCard = document.getElementById('rep-sales-reconcile-card');

  if (!isManager) {
    // Hide manager menus & financial metrics, show staff actions
    if (menuEmployees) menuEmployees.classList.add('hide');
    if (menuReports) menuReports.classList.add('hide');
    if (menuSettings) menuSettings.classList.add('hide');
    if (schedulerControls) schedulerControls.classList.add('hide');
    if (quickActionsCard) quickActionsCard.classList.add('hide');
    if (costBadge) { costBadge.classList.add('hide'); costBadge.style.display = 'none'; }
    if (wageBadge) { wageBadge.classList.add('hide'); wageBadge.style.display = 'none'; }
    if (repKpiCard) { repKpiCard.classList.add('hide'); repKpiCard.style.display = 'none'; }
    if (repReconcileCard) { repReconcileCard.classList.add('hide'); repReconcileCard.style.display = 'none'; }

    if (staffActionsCard) staffActionsCard.classList.remove('hide');
    if (personalSummaryCard) personalSummaryCard.classList.remove('hide');
    if (nextShiftCard) nextShiftCard.classList.remove('hide');
    if (personalLeavesCard) personalLeavesCard.classList.remove('hide');
    if (personalTimeclockCard) personalTimeclockCard.classList.remove('hide');
    if (adminPanel) adminPanel.classList.add('hide');
    if (leaveSelectorGroup) leaveSelectorGroup.classList.add('hide');

    // Restrict clock actions only to self
    if (clockTerminalDesc) clockTerminalDesc.textContent = 'Register your clock stamps here.';
    if (clockEmpSelect) {
      clockEmpSelect.disabled = true;
    }
  } else {
    // Show manager menus & financial metrics, hide staff actions
    if (menuEmployees) menuEmployees.classList.remove('hide');
    if (menuReports) menuReports.classList.remove('hide');
    if (menuSettings) menuSettings.classList.remove('hide');
    if (schedulerControls) schedulerControls.classList.remove('hide');
    if (quickActionsCard) quickActionsCard.classList.remove('hide');
    if (costBadge) { costBadge.classList.remove('hide'); costBadge.style.display = 'inline-flex'; }
    if (wageBadge) { wageBadge.classList.remove('hide'); wageBadge.style.display = 'inline-flex'; }
    if (repKpiCard) { repKpiCard.classList.remove('hide'); repKpiCard.style.display = 'flex'; }
    if (repReconcileCard) { repReconcileCard.classList.remove('hide'); repReconcileCard.style.display = 'block'; }

    if (staffActionsCard) staffActionsCard.classList.add('hide');
    if (personalSummaryCard) personalSummaryCard.classList.add('hide');
    if (nextShiftCard) nextShiftCard.classList.add('hide');
    if (personalLeavesCard) personalLeavesCard.classList.add('hide');
    if (personalTimeclockCard) personalTimeclockCard.classList.add('hide');
    if (adminPanel) adminPanel.classList.remove('hide');
    if (leaveSelectorGroup) leaveSelectorGroup.classList.remove('hide');
    
    if (clockTerminalDesc) clockTerminalDesc.textContent = 'Select your name to log clock stamps.';
    if (clockEmpSelect) {
      clockEmpSelect.disabled = false;
    }
  }
}

// Switch tabs routing
function switchTab(tabName) {
  const isManager = hasManagerPermissions(state.currentUser);
  if (!isManager && (tabName === 'employees' || tabName === 'reports' || tabName === 'settings')) {
    showToast('Access restricted: Only Owners and Managers can access this panel.', 'warning');
    tabName = 'dashboard';
  }

  state.currentTab = tabName;

  // Toggle active class and ARIA selected on menu buttons
  document.querySelectorAll('.menu-item').forEach(btn => {
    const isSelected = btn.getAttribute('data-tab') === tabName;
    btn.classList.toggle('active', isSelected);
    btn.setAttribute('aria-selected', isSelected ? 'true' : 'false');
  });

  // Toggle active class on mobile navigation items
  document.querySelectorAll('.mobile-nav-item').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-mobile-tab') === tabName);
  });

  // Toggle active class on panels
  document.querySelectorAll('.tab-panel').forEach(panel => {
    panel.classList.toggle('active', panel.id === `panel-${tabName}`);
  });

  // Set Panel Title Header
  const titles = {
    dashboard: 'Dashboard',
    scheduler: 'Scheduler',
    daily: 'Daily View',
    employees: 'Employees',
    timeclock: 'Time Clock',
    timeoff: 'Time Off',
    reports: 'Reports & Payroll',
    'ai-ops': 'AI Operations & Autonomous Hub',
    settings: 'Data & Backup'
  };
  const titleEl = document.getElementById('current-panel-title');
  if (titleEl) titleEl.textContent = titles[tabName] || 'Dashboard';

  // Render active panel
  renderActivePanel();
  
  // Close sidebar on mobile after navigating
  if (window.innerWidth <= 1024) {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.getElementById('mobile-overlay');
    if (sidebar) sidebar.classList.remove('open');
    if (overlay) overlay.classList.remove('active');
  }
}

// Mobile Sidebar Toggle
function toggleSidebar() {
  const sidebar = document.querySelector('.sidebar');
  const overlay = document.getElementById('mobile-overlay');
  
  if (sidebar && overlay) {
    sidebar.classList.toggle('open');
    overlay.classList.toggle('active');
  }
}
window.toggleSidebar = toggleSidebar;

// Render active panel based on routing state
function renderActivePanel() {
  loadDataFromState();
  applyRoleAccessControl();

  switch (state.currentTab) {
    case 'dashboard':
      renderDashboard();
      break;
    case 'scheduler':
      renderScheduler();
      break;
    case 'daily':
      window.renderDailyPanel();
      break;
    case 'employees':
      renderEmployeesList();
      break;
    case 'timeclock':
      renderTimeClockPanel();
      break;
    case 'timeoff':
      renderTimeOffPanel();
      break;
    case 'reports':
      renderReportsPanel();
      break;
    case 'settings':
      renderSettingsPanel(); // Let's also render settings inputs on load
      break;
  }
}

/* ==========================================================================
   AUTHENTICATION VIEW HANDLERS
   ========================================================================== */

function showLoginScreen() {
  document.getElementById('login-screen').classList.add('active');
  document.getElementById('app-root').style.display = 'none';
  showLoginCard();
}

function showLoginCard() {
  document.getElementById('login-card').classList.remove('hide');
  document.getElementById('register-card').classList.add('hide');
}

function showRegisterCard() {
  document.getElementById('login-card').classList.add('hide');
  document.getElementById('register-card').classList.remove('hide');
}

async function handleLoginSubmit(event) {
  event.preventDefault();
  const email = (document.getElementById('login-email').value || '').trim();
  const password = document.getElementById('login-password').value;

  const btn = event.target ? event.target.querySelector('button[type="submit"]') : null;
  const origText = btn ? btn.innerHTML : 'Log In';
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Logging in...';
  }

  try {
    const res = await BriskDB.apiLogin(email, password);

    if (res.error) {
      showToast(res.error, 'error');
      return;
    }

    if (res.email) {
      state.currentUser = res;
      document.getElementById('login-form').reset();
      if (!window._modulesLoaded) { await window.bootModularSystem(); window._modulesLoaded = true; }
      await bootApplication();
    }
  } catch (err) {
    showToast(err.message || 'Login failed. Please check network connection.', 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = origText;
    }
  }
}

async function handleRegisterSubmit(event) {
  event.preventDefault();
  const inviteCode = document.getElementById('reg-invite-code').value;
  const name = document.getElementById('reg-name').value;
  const email = document.getElementById('reg-email').value;
  const password = document.getElementById('reg-password').value;

  const res = await BriskDB.apiRegister(email, password, name, inviteCode);

  if (res.error) {
    showToast(res.error, 'error');
    return;
  }

  showToast('Registration successful! Logging you in...', 'success');
  
  // Call apiLogin to get proper session data
  const loginRes = await BriskDB.apiLogin(email, password);
  if (loginRes.error) {
    showToast(loginRes.error, 'error');
    return;
  }
  
  state.currentUser = loginRes;

  document.getElementById('register-form').reset();
  document.getElementById('invite-code-group').classList.remove('hide'); // restore field
  if (!window._modulesLoaded) { await window.bootModularSystem(); window._modulesLoaded = true; }
      await bootApplication();
}

function handleLogout() {
  if (confirm('Are you sure you want to log out?')) {
    BriskDB.setSession(null);
    state.currentUser = null;
    state.employees = [];
    state.shifts = [];
    state.swaps = [];
    state.timecards = [];
    state.leaveRequests = [];
    state.roles = [];
    state.positions = [];
    showLoginScreen();
  }
}

// Manager generate invitation submit
async function handleInviteSubmit(event) {
  event.preventDefault();
  const submitBtn = event.target.querySelector('button[type="submit"]');
  const originalBtnText = submitBtn ? submitBtn.innerHTML : 'Generate Invite';
  if (submitBtn) { submitBtn.disabled = true; submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Generating...'; }

  const email = document.getElementById('invite-email').value;
  const role = document.getElementById('invite-role').value;

  try {
    const res = await BriskDB.apiGenerateInvite(email, role);

    if (res.error) {
      showToast(res.error, 'error');
      return;
    }

    document.getElementById('invite-code-val').textContent = res.code;
    document.getElementById('invite-url-val').value = res.inviteUrl;
    document.getElementById('invite-result-box').classList.remove('hide');
    document.getElementById('invite-form').reset();
    showToast(`Invitation sent to ${email}!`, 'success');
  } catch (err) {
    showToast('Failed to generate invitation.', 'error');
  } finally {
    if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = originalBtnText; }
  }
}

async function copyInviteUrl() {
  const code = document.getElementById('invite-code-val')?.textContent;
  if (!code || code === 'None') return;
  
  const url = document.getElementById('invite-url-val')?.value || `${window.location.origin}?invite=${code}`;
  try {
    await navigator.clipboard.writeText(url);
    showToast('Invite link copied to clipboard!', 'success');
  } catch (err) {
    showToast('Failed to copy to clipboard.', 'error');
  }
}

/* ==========================================================================
   DATE HELPER FUNCTIONS
   ========================================================================== */

function getMondayOfCurrentWeek(d) {
  let date;
  if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)) {
    const [y, m, dayNum] = d.split('-').map(Number);
    date = new Date(y, m - 1, dayNum);
  } else {
    date = new Date(d);
  }
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  const mon = new Date(date.setDate(diff));
  mon.setHours(0,0,0,0);
  return mon;
}

function formatDateISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Convert 24h time string (HH:MM or HH:MM:SS) to 12h AM/PM format
function formatTimeAmPm(timeStr) {
  if (!timeStr) return '';
  const parts = timeStr.split(':');
  let h = parseInt(parts[0], 10);
  if (h >= 24) h = h - 24; // Handle 24:00 as midnight
  const m = parts[1] || '00';
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${m} ${ampm}`;
}
window.formatTimeAmPm = formatTimeAmPm;

function getFormattedDateString(date) {
  const y = date.getFullYear();
  const m = MONTH_NAMES[date.getMonth()];
  const d = String(date.getDate()).padStart(2, '0');
  const dayName = DAY_NAMES[date.getDay()];
  return `${dayName}, ${d} ${m} ${y}`;
}

function getWeekRangeText(monday) {
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  
  const formatDate = (d) => {
    return `${String(d.getDate()).padStart(2, '0')} ${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
  };
  return `${formatDate(monday)} - ${formatDate(sunday)}`;
}
window.getMondayOfCurrentWeek = getMondayOfCurrentWeek;
window.formatDateISO = formatDateISO;
window.getFormattedDateString = getFormattedDateString;
window.getWeekRangeText = getWeekRangeText;
window.checkLeaveStatus = checkLeaveStatus;
window.loadDataFromState = loadDataFromState;

let renderGeneration = 0;
async function checkHistoricalDataAndRender(renderCallback) {
  const currentGen = ++renderGeneration;
  const fourteenDaysAgo = new Date();
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
  
  if (state.currentWeekStart < fourteenDaysAgo) {
    const endOfWeek = new Date(state.currentWeekStart);
    endOfWeek.setDate(endOfWeek.getDate() + 6);
    try {
      await BriskDB.fetchHistoricalWeek(formatDateISO(state.currentWeekStart), formatDateISO(endOfWeek));
    } catch (e) {
      console.error("Failed to lazy-load historical shifts", e);
    }
  }
  if (currentGen === renderGeneration) {
    renderCallback();
  }
}

function setupWeekPickers() {
  // BUG 2 FIX: Create a NEW Date object instead of mutating state.currentWeekStart in-place.
  // Previously: state.currentWeekStart.setDate(...) mutated the shared Date object,
  // causing scheduler + reports to share the same reference and corrupt each other's week.
  document.getElementById('btn-prev-week').addEventListener('click', async () => {
    const newDate = new Date(state.currentWeekStart);
    newDate.setDate(newDate.getDate() - 7);
    state.currentWeekStart = newDate;
    await checkHistoricalDataAndRender(renderScheduler);
  });
  document.getElementById('btn-next-week').addEventListener('click', async () => {
    const newDate = new Date(state.currentWeekStart);
    newDate.setDate(newDate.getDate() + 7);
    state.currentWeekStart = newDate;
    await checkHistoricalDataAndRender(renderScheduler);
  });

  document.getElementById('btn-report-prev-week').addEventListener('click', async () => {
    const newDate = new Date(state.currentWeekStart);
    newDate.setDate(newDate.getDate() - 7);
    state.currentWeekStart = newDate;
    await checkHistoricalDataAndRender(renderReportsPanel);
  });
  document.getElementById('btn-report-next-week').addEventListener('click', async () => {
    const newDate = new Date(state.currentWeekStart);
    newDate.setDate(newDate.getDate() + 7);
    state.currentWeekStart = newDate;
    await checkHistoricalDataAndRender(renderReportsPanel);
  });

  const btnAuto = document.getElementById('btn-auto-schedule');
  if (btnAuto) {
    btnAuto.addEventListener('click', () => {
      if (typeof window.triggerAutoScheduler === 'function') window.triggerAutoScheduler();
    });
  }
  const btnClear = document.getElementById('btn-clear-week');
  if (btnClear) {
    btnClear.addEventListener('click', () => {
      if (typeof window.triggerClearWeek === 'function') window.triggerClearWeek();
    });
  }
}


function startLiveClock() {
  const clockTime = document.getElementById('clock-time');
  const clockDate = document.getElementById('clock-date');

  function tick() {
    const now = new Date();
    clockDate.textContent = getFormattedDateString(now);
    
    const h = String(now.getHours()).padStart(2, '0');
    const m = String(now.getMinutes()).padStart(2, '0');
    const s = String(now.getSeconds()).padStart(2, '0');
    clockTime.textContent = `${h}:${m}:${s}`;
    
    const mobileClock = document.getElementById('mobile-live-clock');
    if (mobileClock) {
      mobileClock.textContent = `${h}:${m}:${s}`;
    }
  }
  
  tick();
  setInterval(tick, 1000);
}


/* ==========================================================================
   PANEL: DASHBOARD
   ========================================================================== */

function renderDashboard() {
  const now = new Date();
  const todayStr = formatDateISO(now);
  // Always re-compute today's date on each render — never cache or hardcode
  document.getElementById('dash-today-date').textContent = todayStr;

  const activeEmployees = state.employees.filter(e => e.active);
  document.getElementById('dash-emp-count').textContent = activeEmployees.length;

  const mon = new Date(state.currentWeekStart);
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  mon.setHours(0,0,0,0);
  sun.setHours(23,59,59,999);

  const weekShifts = state.shifts.filter(s => {
    const sDate = new Date(s.date + 'T00:00:00');
    sDate.setHours(0,0,0,0);
    return sDate >= mon && sDate <= sun;
  });
  document.getElementById('dash-shifts-count').textContent = weekShifts.length;

  // Calculate employee personal weekly summary
  if (state.currentUser && !hasManagerPermissions(state.currentUser)) {
    const empRecord = state.employees.find(e => e.id === state.currentUser.employeeId);
    const hourlyRate = empRecord ? Number(empRecord.hourlyRate || 0) : 0;
    
    // Filter shifts for this specific employee this week
    const myWeekShifts = weekShifts.filter(s => s.employeeId === state.currentUser.employeeId);
    
    let totalHours = 0;
    myWeekShifts.forEach(s => {
      const netHours = calculateShiftHours(s.startTime, s.endTime, s.unpaidMealMins);
      totalHours += netHours;
    });

    const estEarnings = totalHours * hourlyRate;
    
    const summaryHoursEl = document.getElementById('personal-summary-hours');
    const summaryPayEl = document.getElementById('personal-summary-pay');
    const summaryRangeEl = document.getElementById('personal-summary-week-range');
    
    if (summaryHoursEl) summaryHoursEl.textContent = `${totalHours.toFixed(1)}h`;
    if (summaryPayEl) summaryPayEl.textContent = `$${estEarnings.toFixed(2)}`;
    if (summaryRangeEl) {
      const formatDateShort = (d) => {
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return `${d.getDate()} ${months[d.getMonth()]}`;
      };
      summaryRangeEl.textContent = `${formatDateShort(mon)} - ${formatDateShort(sun)}`;
    }

    // Filter and compute next upcoming shift
    const myUpcomingShifts = state.shifts.filter(s => {
      if (s.employeeId !== state.currentUser.employeeId) return false;
      if (s.date > todayStr) return true;
      if (s.date === todayStr) {
        const nowTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        return s.endTime > nowTime;
      }
      return false;
    });

    myUpcomingShifts.sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return a.startTime.localeCompare(b.startTime);
    });

    const nextShift = myUpcomingShifts[0];
    const nextShiftDetailsEl = document.getElementById('next-shift-details');
    if (nextShiftDetailsEl) {
      if (nextShift) {
        const sDate = new Date(nextShift.date);
        const dayNamesShort = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const monthsShort = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const formattedDate = `${sDate.getDate()} ${monthsShort[sDate.getMonth()]} (${dayNamesShort[sDate.getDay()]})`;

        nextShiftDetailsEl.innerHTML = `
          <div style="display:flex; justify-content:space-between; align-items:center; gap: 12px;">
            <div>
              <div style="font-weight:700; font-size:0.98rem; color:var(--accent-cyan);">${formattedDate}</div>
              <div style="font-size:0.85rem; color:var(--text-secondary); margin-top:4px;">
                <i class="fa-regular fa-clock" style="color:var(--accent-cyan); margin-right:4px;"></i> ${formatTimeAmPm(nextShift.startTime)} - ${formatTimeAmPm(nextShift.endTime)}
              </div>
            </div>
            <span class="badge" style="background:rgba(0, 229, 255, 0.1); color:var(--accent-cyan); border:1px solid rgba(0, 229, 255, 0.2); font-weight:600; font-size: 0.72rem; padding: 4px 8px; border-radius: 4px;">
              ${nextShift.role}
            </span>
          </div>
        `;
      } else {
        nextShiftDetailsEl.innerHTML = `<span class="text-muted" style="font-size: 0.85rem;">No upcoming shifts scheduled.</span>`;
      }
    }

    // Render employee personal leave requests
    const personalLeavesListEl = document.getElementById('personal-leaves-list');
    if (personalLeavesListEl) {
      const myLeaves = state.leaveRequests
        .filter(r => r.employeeId === state.currentUser.employeeId)
        .sort((a, b) => b.startDate.localeCompare(a.startDate)) // Show newest first
        .slice(0, 3); // Top 3

      if (myLeaves.length === 0) {
        personalLeavesListEl.innerHTML = '<span class="text-muted" style="font-size: 0.85rem; padding: 4px 0; display:block;">No recent time off requests.</span>';
      } else {
        personalLeavesListEl.innerHTML = '';
        myLeaves.forEach(lv => {
          let badgeColor = '#f97316'; // Pending (Orange)
          let badgeColorRgb = '249, 115, 22';
          if (lv.status === 'Approved') {
            badgeColor = '#10b981'; // Green
            badgeColorRgb = '16, 185, 129';
          } else if (lv.status === 'Rejected') {
            badgeColor = '#ef4444'; // Red
            badgeColorRgb = '239, 68, 68';
          }

          const container = document.createElement('div');
          container.style.display = 'flex';
          container.style.justifyContent = 'space-between';
          container.style.alignItems = 'center';
          container.style.padding = '8px 12px';
          container.style.background = 'rgba(255, 255, 255, 0.02)';
          container.style.borderRadius = '6px';
          container.style.border = '1px solid var(--border-glass)';
          container.style.fontSize = '0.85rem';

          const dateStr = lv.startDate === lv.endDate || !lv.endDate 
            ? lv.startDate 
            : `${lv.startDate} ~ ${lv.endDate}`;

          container.innerHTML = `
            <div>
              <div style="font-weight:600; color: var(--text-primary);">${dateStr}</div>
              <div style="font-size:0.75rem; color:var(--text-muted); margin-top:2px;">Type: ${lv.type}</div>
            </div>
            <span class="badge" style="background:rgba(${badgeColorRgb}, 0.12); color:${badgeColor}; border:1px solid rgba(${badgeColorRgb}, 0.25); font-size: 10px; font-weight:600; padding: 2px 6px; border-radius:4px;">
              ${lv.status}
            </span>
          `;
          personalLeavesListEl.appendChild(container);
        });
      }
    }

    // Render employee personal timeclock status
    const personalTimeclockDetailsEl = document.getElementById('personal-timeclock-details');
    const personalTimeclockPulseEl = document.getElementById('personal-timeclock-pulse');
    if (personalTimeclockDetailsEl) {
      const myTodayTc = state.timecards.find(tc => tc.employeeId === state.currentUser.employeeId && tc.date === todayStr);
      
      if (myTodayTc) {
        if (myTodayTc.clockIn && !myTodayTc.clockOut) {
          if (personalTimeclockPulseEl) personalTimeclockPulseEl.classList.remove('hide');
          personalTimeclockDetailsEl.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; gap: 12px;">
              <div>
                <div style="font-weight:700; font-size:0.98rem; color:#10b981;">Currently Clocked In</div>
                <div style="font-size:0.82rem; color:var(--text-secondary); margin-top:4px;">
                  <i class="fa-solid fa-right-to-bracket" style="color:#10b981; margin-right:4px;"></i> Started today at <strong>${myTodayTc.clockIn.includes('T') ? formatTimeAmPm(new Date(myTodayTc.clockIn).toTimeString().slice(0,5)) : formatTimeAmPm(myTodayTc.clockIn)}</strong>
                </div>
              </div>
              <div style="text-align:right;">
                <span class="badge" style="background:rgba(16, 185, 129, 0.12); color:#10b981; border:1px solid rgba(16, 185, 129, 0.25); font-weight:700; font-size:0.72rem; padding: 4px 8px; border-radius: 4px;">
                  Active
                </span>
              </div>
            </div>
          `;
        } else if (myTodayTc.clockIn && myTodayTc.clockOut) {
          if (personalTimeclockPulseEl) personalTimeclockPulseEl.classList.add('hide');
          
          const workedHours = calculateTimecardHours(myTodayTc);
          const formattedIn = (myTodayTc.clockIn.includes('T') ? formatTimeDisplay(new Date(myTodayTc.clockIn)) : myTodayTc.clockIn);
          const formattedOut = (myTodayTc.clockOut.includes('T') ? formatTimeDisplay(new Date(myTodayTc.clockOut)) : myTodayTc.clockOut);

          personalTimeclockDetailsEl.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; gap: 12px;">
              <div>
                <div style="font-weight:600; font-size:0.95rem; color:var(--text-muted);">Shift Completed</div>
                <div style="font-size:0.82rem; color:var(--text-muted); margin-top:4px;">
                  Clocked out today at <strong>${formattedOut}</strong> (Worked ${workedHours.toFixed(1)}h)
                </div>
              </div>
              <div style="text-align:right;">
                <span class="badge" style="background:rgba(255, 255, 255, 0.05); color:var(--text-muted); border:1px solid var(--border-glass); font-weight:600; font-size:0.7rem; padding: 4px 8px; border-radius: 4px;">
                  Offline
                </span>
              </div>
            </div>
          `;
        }
      } else {
        if (personalTimeclockPulseEl) personalTimeclockPulseEl.classList.add('hide');
        personalTimeclockDetailsEl.innerHTML = `
          <div style="display:flex; justify-content:space-between; align-items:center; gap: 12px;">
            <div>
              <div style="font-weight:600; font-size:0.95rem; color:var(--text-secondary);">Offline / Clock Out</div>
              <div style="font-size:0.82rem; color:var(--text-muted); margin-top:4px;">
                No active clock stamp found for today.
              </div>
            </div>
            <div style="text-align:right;">
              <span class="badge" style="background:rgba(239, 68, 68, 0.08); color:#ef4444; border:1px solid rgba(239, 68, 68, 0.2); font-weight:600; font-size:0.7rem; padding: 4px 8px; border-radius: 4px;">
                Not Clocked In
              </span>
            </div>
          </div>
        `;
      }
    }
  }

  const todayActiveClockins = state.timecards.filter(tc => {
    return tc.date === todayStr && tc.clockIn && !tc.clockOut;
  });
  document.getElementById('dash-active-clockins').textContent = todayActiveClockins.length;

  const pendingLeaves = state.leaveRequests.filter(r => r.status === 'Pending');
  document.getElementById('dash-pending-leaves').textContent = pendingLeaves.length;

  // Today's roster list (restricted based on role)
  let todayShifts = state.shifts.filter(s => s.date === todayStr);
  if (!hasManagerPermissions(state.currentUser)) {
    // Employees can see everyone working today (team awareness)
  }

  const todayLeaveRequests = state.leaveRequests.filter(r => {
    return (r.status || '').toLowerCase() === 'approved' && todayStr >= r.startDate && todayStr <= r.endDate;
  });

  const tbody = document.getElementById('dash-today-shifts');
  tbody.innerHTML = '';

  // === IMPROVEMENT #3: Dashboard Today's Coverage Summary Banner ===
  if (todayShifts.length > 0) {
    const pharmacistRoles = ['pharmacist', 'pharmacist manager'];
    const pharmacistCount = todayShifts.filter(s => {
      const roleLower = s.role.toLowerCase();
      return pharmacistRoles.some(pr => roleLower.includes(pr));
    }).length;
    const startTimes = todayShifts.map(s => s.startTime).sort();
    const endTimes = todayShifts.map(s => s.endTime).sort();
    const coverageWindow = `${formatTimeAmPm(startTimes[0])} – ${formatTimeAmPm(endTimes[endTimes.length - 1])}`;

    const summaryBanner = document.createElement('div');
    summaryBanner.id = 'dash-coverage-summary-banner';
    summaryBanner.style.cssText = 'display:flex; align-items:center; justify-content:center; gap:16px; padding:10px 16px; margin:0 1.25rem 1rem; background:rgba(2,132,199,0.06); border:1px solid rgba(2,132,199,0.2); border-radius:8px; font-size:0.85rem; flex-wrap:wrap;';
    summaryBanner.innerHTML = `
      <span style="font-weight:700; color:var(--accent-cyan);"><i class="fa-solid fa-users" style="margin-right:4px;"></i> ${todayShifts.length} staff rostered</span>
      <span style="color:var(--text-muted);">|</span>
      <span style="font-weight:600; color:${pharmacistCount > 0 ? '#10b981' : '#ef4444'};"><i class="fa-solid fa-user-doctor" style="margin-right:4px;"></i> ${pharmacistCount} Pharmacist${pharmacistCount !== 1 ? 's' : ''}</span>
      <span style="color:var(--text-muted);">|</span>
      <span style="font-weight:500; color:var(--text-secondary);"><i class="fa-regular fa-clock" style="margin-right:4px;"></i> ${coverageWindow}</span>
    `;
    // Insert before the table
    const existingBanner = document.getElementById('dash-coverage-summary-banner');
    if (existingBanner) {
      if (typeof existingBanner.remove === 'function') existingBanner.remove();
      else if (existingBanner.parentElement) existingBanner.parentElement.removeChild(existingBanner);
    }
    const shiftListScroll = tbody.closest('.shift-list-scroll');
    if (shiftListScroll && shiftListScroll.parentElement) shiftListScroll.parentElement.insertBefore(summaryBanner, shiftListScroll);
  }

  if (todayShifts.length === 0 && todayLeaveRequests.length === 0) {
    const existingBanner = document.getElementById('dash-coverage-summary-banner');
    if (existingBanner) {
      if (typeof existingBanner.remove === 'function') existingBanner.remove();
      else if (existingBanner.parentElement) existingBanner.parentElement.removeChild(existingBanner);
    }
    tbody.innerHTML = `<tr><td colspan="4" style="padding: 0;"><div class="empty-state"><i class="fa-solid fa-mug-hot text-neon" style="animation: activeTerminalPulse 1.8s infinite alternate;"></i><h4>No shifts today</h4><p>Enjoy your day! All staff are scheduled off today.</p></div></td></tr>`;
    return;
  }

  // Render active shifts
  todayShifts.forEach(shift => {
    const emp = state.employees.find(e => e.id === shift.employeeId);
    const empName = emp ? emp.name : '<span class="text-danger">Unassigned</span>';
    
    let statusBadge = '<span class="badge">Not Clocked In</span>';
    if (emp) {
      const tc = state.timecards.find(t => t.employeeId === emp.id && t.date === todayStr);
      if (tc) {
        if (tc.clockOut) {
          statusBadge = '<span class="badge badge-success">Finished</span>';
        } else if (tc.breaks && tc.breaks.length > 0 && tc.breaks[tc.breaks.length - 1].start && !tc.breaks[tc.breaks.length - 1].end) {
          statusBadge = '<span class="badge badge-warning">On Break</span>';
        } else if (tc.clockIn) {
          statusBadge = '<span class="badge badge-info">Working</span>';
        }
      }
    }

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${empName}</strong></td>
      <td>${shift.role}</td>
      <td>${formatTimeAmPm(shift.startTime)} - ${formatTimeAmPm(shift.endTime)}</td>
      <td>${statusBadge}</td>
    `;
    tbody.appendChild(tr);
  });

  // Render employees on leave today
  todayLeaveRequests.forEach(req => {
    const emp = state.employees.find(e => e.id === req.employeeId);
    if (!emp) return;
    
    const tr = document.createElement('tr');
    tr.style.opacity = '0.82';
    tr.innerHTML = `
      <td><strong>${emp.name}</strong></td>
      <td><span style="color:var(--text-muted); font-size:0.85rem;">Leave</span></td>
      <td><span style="font-size:0.85rem; color:var(--accent-gold);"><i class="fa-solid fa-umbrella-beach"></i> Vacation</span></td>
      <td><span class="badge" style="background:rgba(168, 85, 247, 0.12); color:#a855f7; border:1px solid rgba(168, 85, 247, 0.25);">On Leave</span></td>
    `;
    tbody.appendChild(tr);
  });
}


/* ==========================================================================
   PANEL: SCHEDULER
   ========================================================================== */

function getOrderedActiveEmployees(includeOwners = false) {
  const customOrder = (state.settings && Array.isArray(state.settings.employeeOrder)) ? state.settings.employeeOrder : [];
  return state.employees.filter(e => {
    if (e.active === false) return false;
    if (!includeOwners) {
      const r = (e.role || '').toLowerCase().trim();
      if (r === 'owner' || r === 'partner' || r === 'managing partner') return false;
    }
    return true;
  }).sort((a, b) => {
    const idxA = customOrder.indexOf(a.id);
    const idxB = customOrder.indexOf(b.id);
    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;
    return a.name.localeCompare(b.name);
  });
}

async function moveEmployeeOrder(empId, direction) {
  const activeEmps = getOrderedActiveEmployees();
  const index = activeEmps.findIndex(e => e.id === empId);
  if (index === -1) return;

  const targetIndex = direction === 'up' ? index - 1 : index + 1;
  if (targetIndex < 0 || targetIndex >= activeEmps.length) return;

  const newOrderEmps = [...activeEmps];
  const temp = newOrderEmps[index];
  newOrderEmps[index] = newOrderEmps[targetIndex];
  newOrderEmps[targetIndex] = temp;

  const newOrderIds = newOrderEmps.map(e => e.id);

  if (!state.settings) state.settings = {};
  state.settings.employeeOrder = newOrderIds;
  try {
    localStorage.setItem('amcal_employee_order', JSON.stringify(newOrderIds));
  } catch (e) {}

  try {
    await BriskDB.saveSettings(state.settings);
    showToast('Staff display order updated.', 'success');
    renderScheduler();
    if (typeof renderEmployeesList === 'function') renderEmployeesList();
  } catch (err) {
    console.error('Error updating staff order:', err);
    showToast('Failed to update staff order.', 'error');
  }
}

window.getOrderedActiveEmployees = getOrderedActiveEmployees;
window.moveEmployeeOrder = moveEmployeeOrder;

function renderScheduler() {
  const weekRange = getWeekRangeText(state.currentWeekStart);
  const weekRangeEl = document.getElementById('scheduler-week-range');
  if (weekRangeEl) weekRangeEl.textContent = weekRange;

  const printWeekRangeEl = document.getElementById('print-roster-week-range');
  if (printWeekRangeEl) printWeekRangeEl.textContent = `Week: ${weekRange}`;

  const printTimestampEl = document.getElementById('print-roster-timestamp');
  if (printTimestampEl) {
    const now = new Date();
    printTimestampEl.textContent = `${formatDateISO(now)} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  }

  const printTradingHoursEl = document.getElementById('print-roster-trading-hours');
  if (printTradingHoursEl) {
    const summary = formatTradingHoursSummary(state.settings?.tradingHours);
    printTradingHoursEl.innerHTML = `<strong>Trading Hours:</strong> ${summary}`;
  }

  const printTitleEl = document.getElementById('print-roster-title');
  if (printTitleEl) {
    printTitleEl.textContent = `${state.settings?.companyName || 'Amcal Pharmacy Woy Woy'} — Staff Roster`;
  }

  for (let i = 0; i < 7; i++) {
    const d = new Date(state.currentWeekStart);
    d.setDate(state.currentWeekStart.getDate() + i);
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const dateStr = formatDateISO(d);
    const dayOfWeek = d.getDay();

    const th = (state.settings && state.settings.tradingHours) ? state.settings.tradingHours[String(dayOfWeek)] : null;
    const isOpen = th ? !th.closed : (dayOfWeek !== 0);

    const pharmacistShifts = state.shifts.filter(s => {
      if (s.date !== dateStr || !s.employeeId) return false;
      const r = (s.role || '').toLowerCase();
      return r.includes('pharmacist') || r.includes('pic') || r.includes('locum') || r.includes('manager');
    });

    let pharmacistCoverageBadge = '';
    if (isOpen) {
      if (pharmacistShifts.length === 0) {
        pharmacistCoverageBadge = `<span class="badge" style="background:rgba(239,68,68,0.2); color:#f87171; border:1px solid rgba(239,68,68,0.5); font-size:8px; padding:1px 3px; display:block; margin-top:2px; font-weight:700;" title="Clinical Warning: No Pharmacist scheduled while pharmacy is open">⚠️ No Pharmacist</span>`;
      } else if (pharmacistShifts.length >= 2) {
        pharmacistShifts.sort((a, b) => a.startTime.localeCompare(b.startTime));
        const p1 = pharmacistShifts[0];
        const p2 = pharmacistShifts[1];
        const overlapStart = p1.startTime > p2.startTime ? p1.startTime : p2.startTime;
        const overlapEnd = p1.endTime < p2.endTime ? p1.endTime : p2.endTime;
        if (overlapEnd > overlapStart) {
          const overlapH = BriskScheduler.getShiftDuration(overlapStart, overlapEnd);
          pharmacistCoverageBadge = `<span class="badge" style="background:rgba(0,229,255,0.12); color:var(--accent-cyan); border:1px solid rgba(0,229,255,0.3); font-size:8px; padding:1px 3px; display:block; margin-top:2px;" title="Dual Pharmacist Overlap: ${overlapStart} - ${overlapEnd} (${overlapH.toFixed(1)}h)">👨‍⚕️ 2x (${overlapH.toFixed(1)}h)</span>`;
        } else {
          pharmacistCoverageBadge = `<span class="badge" style="background:rgba(16,185,129,0.1); color:#10b981; font-size:8px; padding:1px 3px; display:block; margin-top:2px;">👨‍⚕️ 1x Active</span>`;
        }
      } else {
        pharmacistCoverageBadge = `<span class="badge" style="background:rgba(16,185,129,0.1); color:#10b981; font-size:8px; padding:1px 3px; display:block; margin-top:2px;">👨‍⚕️ 1x Active</span>`;
      }
    }

    const elId = `head-date-${d.getDay()}`;
    const headerEl = document.getElementById(elId);
    if (headerEl) {
      headerEl.innerHTML = `${dd}/${mm} ${pharmacistCoverageBadge}`;
    }
  }

  const tbody = document.getElementById('scheduler-grid-body');
  tbody.innerHTML = '';

  const activeEmployees = getOrderedActiveEmployees();

function getEffectiveShiftHourlyRate(shift) {
  if (shift.employeeId) {
    const emp = state.employees.find(e => e.id === shift.employeeId);
    if (emp && emp.hourlyRate > 0) return emp.hourlyRate;
  }
  const roleLower = (shift.role || '').toLowerCase();
  if (roleLower.includes('pharmacist manager')) return 52.15;
  if (roleLower.includes('pharmacist in charge') || roleLower.includes('pic')) return 46.50;
  if (roleLower.includes('pharmacist')) return 41.74;
  if (roleLower.includes('intern') || roleLower.includes('graduate')) return 34.50;
  if (roleLower.includes('dispense technician') || roleLower.includes('technician') || roleLower.includes('level 4')) return 30.66;
  if (roleLower.includes('webster') || roleLower.includes('level 3')) return 29.45;
  if (roleLower.includes('level 2')) return 28.45;
  return 27.81; // Pharmacy Assistant Level 1 base award rate
}

  const dispTotals = Array(7).fill(0);
  const frontTotals = Array(7).fill(0);
  const websterTotals = Array(7).fill(0);
  const grandTotals = Array(7).fill(0);

  const dispCosts = Array(7).fill(0);
  const frontCosts = Array(7).fill(0);
  const websterCosts = Array(7).fill(0);
  const grandCosts = Array(7).fill(0);

  // Accumulate hours and fully loaded costs (including Super 12% + On-costs) for table cells
  for (let i = 0; i < 7; i++) {
    const d = new Date(state.currentWeekStart);
    d.setDate(state.currentWeekStart.getDate() + i);
    const dateStr = formatDateISO(d);
    const dayShifts = state.shifts.filter(s => s.date === dateStr);
    const dayOfWeek = d.getDay();

    // Weekend Award Penalty Multiplier (Pharmacy Award MA000012)
    let penaltyMultiplier = 1.0;
    if (dayOfWeek === 0) penaltyMultiplier = 1.5;      // Sunday 150%
    else if (dayOfWeek === 6) penaltyMultiplier = 1.25; // Saturday 125%
    
    dayShifts.forEach(s => {
      const hours = calculateShiftHours(s.startTime, s.endTime);
      const emp = state.employees.find(e => e.id === s.employeeId);
      let fullyLoadedCost = 0;
      if (emp) {
        fullyLoadedCost = window.getEmployeeLaborCostBreakdown(emp, s.date, hours).total;
      }

      const roleLower = (s.role || '').toLowerCase();
      
      if (roleLower.includes('dispensary') || roleLower.includes('pharmacist') || roleLower.includes('dispense technician') || roleLower.includes('locum')) {
        dispTotals[i] += hours;
        dispCosts[i] += fullyLoadedCost;
      } else if (roleLower.includes('webster')) {
        websterTotals[i] += hours;
        websterCosts[i] += fullyLoadedCost;
      } else {
        frontTotals[i] += hours;
        frontCosts[i] += fullyLoadedCost;
      }
      grandTotals[i] += hours;
      grandCosts[i] += fullyLoadedCost;
    });
  }

  // If user is employee, they see all staff rosters, but cannot click to add or edit
  activeEmployees.forEach((emp, empIdx) => {
    const tr = document.createElement('tr');
    
    const tdProfile = document.createElement('td');
    tdProfile.className = 'grid-employee-cell';
    
    const empWeekHours = calculateEmployeeWeekHours(emp.id, state.currentWeekStart);
    const isFirst = empIdx === 0;
    const isLast = empIdx === activeEmployees.length - 1;
    const isManagerOrOwner = hasManagerPermissions(state.currentUser);
    const reorderBtns = isManagerOrOwner ? `
      <span class="staff-reorder-btn-group print-hide" style="display:inline-flex; gap:2px; margin-left:4px; vertical-align:middle;">
        <button class="btn-icon staff-reorder-btn" style="padding:1px 4px; font-size:9px;" onclick="moveEmployeeOrder('${emp.id}', 'up')" title="Move Up" ${isFirst ? 'disabled style="opacity:0.2;"' : ''}>
          <i class="fa-solid fa-chevron-up"></i>
        </button>
        <button class="btn-icon staff-reorder-btn" style="padding:1px 4px; font-size:9px;" onclick="moveEmployeeOrder('${emp.id}', 'down')" title="Move Down" ${isLast ? 'disabled style="opacity:0.2;"' : ''}>
          <i class="fa-solid fa-chevron-down"></i>
        </button>
      </span>
    ` : '';

    const maxH = emp.maxHours || 38;
    const otH = empWeekHours > maxH ? (empWeekHours - maxH) : 0;
    const otBadge = otH > 0 ? ` <span class="badge" style="background:rgba(239,68,68,0.2); color:#f87171; border:1px solid rgba(239,68,68,0.4); font-size:9px; padding:1px 4px; font-weight:700;" title="Overtime: ${otH.toFixed(1)}h exceeding ${maxH}h ordinary limit">+${otH.toFixed(1)}h OT</span>` : '';

    tdProfile.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:flex-start; width:100%;">
        <span class="grid-emp-name" ${isManagerOrOwner ? `onclick="openEditEmployeeModal('${emp.id}')" style="cursor:pointer; text-decoration: underline;"` : ''}>${emp.name}</span>
        ${reorderBtns}
      </div>
      <span class="grid-emp-role">${emp.role}</span>
      <span class="grid-emp-hours"><i class="fa-solid fa-clock"></i> ${empWeekHours.toFixed(1)}h / ${maxH}h${otBadge}</span>
    `;
    tr.appendChild(tdProfile);

    for (let i = 0; i < 7; i++) {
      const tdDay = document.createElement('td');
      tdDay.className = 'calendar-grid-cell';
      tdDay.setAttribute('data-employee-id', emp.id);
      
      const d = new Date(state.currentWeekStart);
      d.setDate(state.currentWeekStart.getDate() + i);
      const dateStr = formatDateISO(d);
      tdDay.setAttribute('data-date', dateStr);

      // Drag & Drop event handlers on target cell
      if (hasManagerPermissions(state.currentUser)) {
        tdDay.addEventListener('dragover', (e) => {
          e.preventDefault();
          tdDay.classList.add('drag-hover');
        });
        tdDay.addEventListener('dragenter', (e) => {
          e.preventDefault();
          tdDay.classList.add('drag-hover');
        });
        tdDay.addEventListener('dragleave', () => {
          tdDay.classList.remove('drag-hover');
        });
        tdDay.addEventListener('drop', async (e) => {
          e.preventDefault();
          tdDay.classList.remove('drag-hover');
          const shiftId = e.dataTransfer.getData('text/plain');
          if (!shiftId) return;
          const shift = state.shifts.find(s => s.id === shiftId);
          if (!shift) return;

          const targetEmpId = tdDay.getAttribute('data-employee-id') || null;
          const targetDate = tdDay.getAttribute('data-date');

          if (e.altKey) {
            // Duplicate shift
            const duplicated = {
              employeeId: targetEmpId,
              role: shift.role,
              date: targetDate,
              startTime: shift.startTime,
              endTime: shift.endTime,
              notes: shift.notes
            };
            try {
              await BriskDB.addShift(duplicated);
              showToast('Shift duplicated successfully.', 'success');
              loadDataFromState();
              renderScheduler();
            } catch (err) {
              showToast('Failed to duplicate shift.', 'error');
            }
          } else {
            // Move shift
            if (targetEmpId) {
              // Leave check
              if (checkLeaveStatus(targetEmpId, targetDate)) {
                if (!confirm('This employee has an approved leave request on this date. Move shift anyway?')) {
                  return;
                }
              }

              const empShifts = state.shifts.filter(s => s.employeeId === targetEmpId && s.id !== shift.id);
              const hasOverlap = empShifts.some(s => BriskScheduler.isOverlapping(targetDate, shift.startTime, shift.endTime, s.date, s.startTime, s.endTime));
              if (hasOverlap) {
                showToast('Cannot move: shift overlaps with another shift for this employee.', 'error');
                return;
              }

              // 10-hour rest break warning
              const shiftStartMs = new Date(`${targetDate}T${shift.startTime}:00`).getTime();
              const shiftEndMs = new Date(`${targetDate}T${shift.endTime}:00`).getTime();
              for (const s of empShifts) {
                const sStartMs = new Date(`${s.date}T${(s.startTime || '00:00').substring(0, 5)}:00`).getTime();
                const sEndMs = new Date(`${s.date}T${(s.endTime || '00:00').substring(0, 5)}:00`).getTime();
                let gapHours = 999;
                if (shiftStartMs >= sEndMs) gapHours = (shiftStartMs - sEndMs) / (1000 * 60 * 60);
                else if (sStartMs >= shiftEndMs) gapHours = (sStartMs - shiftEndMs) / (1000 * 60 * 60);
                if (gapHours < 10) {
                  if (!confirm(`Warning (Pharmacy Industry Award 2026 [MA000012]): This employee has another shift on ${s.date} (${formatTimeAmPm(s.startTime)} - ${formatTimeAmPm(s.endTime)}), leaving only ${gapHours.toFixed(1)}h rest (minimum 10h required). Move anyway?`)) {
                    return;
                  }
                  break;
                }
              }
            }
            try {
              shift.employeeId = targetEmpId;
              shift.date = targetDate;
              await BriskDB.updateShift(shift);
              showToast('Shift moved successfully.', 'success');
              loadDataFromState();
              renderScheduler();
            } catch (err) {
              showToast('Failed to move shift.', 'error');
            }
          }
        });
      }
      
      const cellShifts = state.shifts.filter(s => s.employeeId === emp.id && s.date === dateStr);
      cellShifts.forEach(shift => {
        const div = document.createElement('div');
        div.className = 'shift-card';
        if (hasManagerPermissions(state.currentUser)) {
          div.draggable = true;
          div.style.cursor = 'pointer';
          div.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', shift.id);
            div.classList.add('dragging');
          });
          div.addEventListener('dragend', () => {
            div.classList.remove('dragging');
          });
          div.addEventListener('click', (e) => {
            if (e.target.closest('button')) return;
            openEditShiftModal(shift);
          });
        }

        // Color coding style
        const roleColor = state.roles.find(r => r.name.toLowerCase() === shift.role.toLowerCase())?.color || '#0284c7';
        div.style.borderLeft = `4px solid ${roleColor}`;
        div.style.background = `rgba(${hexToRgb(roleColor)}, 0.12)`;

        const shiftDuration = calculateShiftHours(shift.startTime, shift.endTime, 0);
        const breakEntitlement = getAwardBreakEntitlements(shiftDuration);
        const unpaidMeal = (shift.unpaidMealMins !== undefined && shift.unpaidMealMins !== null) ? shift.unpaidMealMins : breakEntitlement.unpaidMealMins;
        
        let breakBadgeHtml = '';
        if (shiftDuration >= 4) {
          const mealText = unpaidMeal > 0 ? `${unpaidMeal}m Lunch` : '';
          const restText = '';
          const combined = [mealText, restText].filter(Boolean).join(' | ');
          if (combined) {
            breakBadgeHtml = `<div class="shift-card-breaks" style="font-size: 7.5pt; color: var(--text-muted); margin-top: 2px;"><i class="fa-solid fa-mug-hot"></i> ${combined}</div>`;
          }
        }

        div.innerHTML = `
          <div class="shift-card-header" style="display:flex; justify-content:space-between; align-items:center;">
            <span class="shift-role-title" style="color:${roleColor}; font-weight:700;">${shift.role}</span>
            <button class="btn-icon text-danger" onclick="deleteShiftRapid('${shift.id}', event)" title="Delete Shift" style="padding:0; margin:0; font-size:12px; opacity:0.6;"><i class="fa-solid fa-trash"></i></button>
          </div>
          <div class="shift-card-time"><i class="fa-regular fa-clock"></i> ${formatTimeAmPm(shift.startTime)} - ${formatTimeAmPm(shift.endTime)}</div>
          ${breakBadgeHtml}
          ${shift.notes ? `<div class="shift-card-notes">${shift.notes}</div>` : ''}
        `;
        
        const btnGroup = document.createElement('div');
        btnGroup.className = 'flex gap-2 align-center';

        if (hasManagerPermissions(state.currentUser)) {
          const dupBtn = document.createElement('button');
          dupBtn.className = 'btn-icon';
          dupBtn.innerHTML = '<i class="fa-regular fa-copy"></i>';
          dupBtn.title = 'Copy Shift';
          dupBtn.onclick = (e) => {
            e.stopPropagation();
            state.copiedShift = { ...shift };
            showToast('Shift copied. Click "+" on any cell to paste!', 'success');
            updatePasteButtonState();
          };
          btnGroup.appendChild(dupBtn);

          const editBtn = document.createElement('button');
          editBtn.className = 'btn-icon';
          editBtn.innerHTML = '<i class="fa-solid fa-pen"></i>';
          editBtn.onclick = (e) => { e.stopPropagation(); openEditShiftModal(shift); };
          btnGroup.appendChild(editBtn);
        }

        div.appendChild(btnGroup);
        tdDay.appendChild(div);
      });

      const isLeave = checkLeaveStatus(emp.id, dateStr);
      if (isLeave) {
        const leaveDiv = document.createElement('div');
        leaveDiv.className = 'badge badge-danger';
        leaveDiv.style.fontSize = '9px';
        leaveDiv.style.width = '100%';
        leaveDiv.style.textAlign = 'center';
        leaveDiv.style.marginTop = '4px';
        leaveDiv.textContent = '🏖️ On Leave';
        tdDay.appendChild(leaveDiv);
      } else if (hasManagerPermissions(state.currentUser)) {
        const addBtn = document.createElement('div');
        addBtn.className = 'cell-add-btn';
        addBtn.innerHTML = '<i class="fa-solid fa-plus"></i>';
        addBtn.addEventListener('click', () => {
          openAddShiftModal(emp.id, dateStr);
        });
        tdDay.appendChild(addBtn);
      }

      tr.appendChild(tdDay);
    }
    tbody.appendChild(tr);
  });

  // Render Unassigned row (only managers see or manipulate this)
  if (hasManagerPermissions(state.currentUser)) {
    const trUnassigned = document.createElement('tr');
    const tdUnassignedProfile = document.createElement('td');
    tdUnassignedProfile.className = 'grid-employee-cell';
    tdUnassignedProfile.style.background = 'rgba(231, 76, 60, 0.05)';
    tdUnassignedProfile.innerHTML = `
      <span class="grid-emp-name text-danger">⚠️ Unassigned Shifts</span>
      <span class="grid-emp-role">Awaiting placement</span>
    `;
    trUnassigned.appendChild(tdUnassignedProfile);

    for (let i = 0; i < 7; i++) {
      const tdDay = document.createElement('td');
      tdDay.className = 'calendar-grid-cell';
      tdDay.style.background = 'rgba(231, 76, 60, 0.02)';
      tdDay.setAttribute('data-employee-id', '');
      
      const d = new Date(state.currentWeekStart);
      d.setDate(state.currentWeekStart.getDate() + i);
      const dateStr = formatDateISO(d);
      tdDay.setAttribute('data-date', dateStr);

      if (hasManagerPermissions(state.currentUser)) {
        tdDay.addEventListener('dragover', (e) => {
          e.preventDefault();
          tdDay.classList.add('drag-hover');
        });
        tdDay.addEventListener('dragenter', (e) => {
          e.preventDefault();
          tdDay.classList.add('drag-hover');
        });
        tdDay.addEventListener('dragleave', () => {
          tdDay.classList.remove('drag-hover');
        });
        tdDay.addEventListener('drop', async (e) => {
          e.preventDefault();
          tdDay.classList.remove('drag-hover');
          const shiftId = e.dataTransfer.getData('text/plain');
          if (!shiftId) return;
          const shift = state.shifts.find(s => s.id === shiftId);
          if (!shift) return;

          const targetDate = tdDay.getAttribute('data-date');

          if (e.altKey) {
            // Duplicate shift to unassigned
            const duplicated = {
              employeeId: null,
              role: shift.role,
              date: targetDate,
              startTime: shift.startTime,
              endTime: shift.endTime,
              notes: shift.notes
            };
            try {
              await BriskDB.addShift(duplicated);
              showToast('Shift duplicated to Unassigned.', 'success');
              loadDataFromState();
              renderScheduler();
            } catch (err) {
              showToast('Failed to duplicate shift.', 'error');
            }
          } else {
            // Move shift to unassigned
            try {
              shift.employeeId = null;
              shift.date = targetDate;
              await BriskDB.updateShift(shift);
              showToast('Shift unassigned.', 'success');
              loadDataFromState();
              renderScheduler();
            } catch (err) {
              showToast('Failed to unassign shift.', 'error');
            }
          }
        });
      }

      const cellShifts = state.shifts.filter(s => (s.employeeId === null || !state.employees.find(e => e.id === s.employeeId)?.active) && s.date === dateStr);
      cellShifts.forEach(shift => {
        const div = document.createElement('div');
        div.className = 'shift-card unassigned';
        if (hasManagerPermissions(state.currentUser)) {
          div.draggable = true;
          div.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', shift.id);
            div.classList.add('dragging');
          });
          div.addEventListener('dragend', () => {
            div.classList.remove('dragging');
          });
        }

        // Color coding
        const roleColor = state.roles.find(r => r.name.toLowerCase() === shift.role.toLowerCase())?.color || '#ef4444';
        div.style.borderLeft = `4px solid ${roleColor}`;
        div.style.background = `rgba(${hexToRgb(roleColor)}, 0.08)`;

        div.innerHTML = `
          <div class="shift-card-header" style="display:flex; justify-content:space-between; align-items:center;">
            <span>${shift.role}</span>
            <button class="btn-icon text-danger" onclick="deleteShiftRapid('${shift.id}', event)" title="Delete Shift" style="padding:0; margin:0; font-size:12px; opacity:0.6;"><i class="fa-solid fa-trash"></i></button>
          </div>
          <div class="shift-card-time"><i class="fa-regular fa-clock"></i> ${formatTimeAmPm(shift.startTime)} - ${formatTimeAmPm(shift.endTime)}</div>
          ${shift.notes ? `<div class="shift-card-notes">${shift.notes}</div>` : ''}
        `;

        const btnGroup = document.createElement('div');
        btnGroup.className = 'flex gap-2 align-center';

        if (hasManagerPermissions(state.currentUser)) {
          const dupBtn = document.createElement('button');
          dupBtn.className = 'btn-icon';
          dupBtn.innerHTML = '<i class="fa-regular fa-copy"></i>';
          dupBtn.title = 'Copy Shift';
          dupBtn.onclick = (e) => {
            e.stopPropagation();
            state.copiedShift = { ...shift };
            showToast('Shift copied. Click "+" on any cell to paste!', 'success');
            updatePasteButtonState();
          };
          btnGroup.appendChild(dupBtn);

          const editBtn = document.createElement('button');
          editBtn.className = 'btn-icon';
          editBtn.innerHTML = '<i class="fa-solid fa-pen"></i>';
          editBtn.onclick = (e) => { e.stopPropagation(); openEditShiftModal(shift); };
          btnGroup.appendChild(editBtn);
        }
        div.appendChild(btnGroup);
        tdDay.appendChild(div);
      });

      const addBtn = document.createElement('div');
      addBtn.className = 'cell-add-btn';
      addBtn.innerHTML = '<i class="fa-solid fa-plus"></i>';
      addBtn.addEventListener('click', () => {
        openAddShiftModal('', dateStr);
      });
      tdDay.appendChild(addBtn);

      trUnassigned.appendChild(tdDay);
    }
    tbody.appendChild(trUnassigned);
  }

  const isManagerOrOwner = hasManagerPermissions(state.currentUser);

  const tfoot = document.getElementById('scheduler-grid-foot');
  if (tfoot) {
    // === IMPROVEMENT #4: Headcount badges per day ===
    const headcountCells = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(state.currentWeekStart);
      d.setDate(state.currentWeekStart.getDate() + i);
      const dateStr = formatDateISO(d);
      const dayStaffIds = new Set(state.shifts.filter(s => s.date === dateStr && s.employeeId).map(s => s.employeeId));
      const dayStaffCount = dayStaffIds.size;
      headcountCells.push(`<td style="text-align:center;">${dayStaffCount > 0 ? `<span style="display:inline-flex; align-items:center; gap:4px; font-size:0.78rem; font-weight:600; color:var(--accent-cyan);"><i class="fa-solid fa-user" style="font-size:0.65rem;"></i>${dayStaffCount}</span>` : '<span style="color:var(--text-muted); font-size:0.75rem;">-</span>'}</td>`);
    }
    const headcountRow = `<tr class="summary-row"><td style="font-weight:600;"><i class="fa-solid fa-users" style="margin-right:4px; color:var(--accent-cyan);"></i>Staff Count</td>${headcountCells.join('')}</tr>`;

    if (isManagerOrOwner) {
      const salesTargets = getDailySalesTargets();
      const wagePctCells = grandTotals.map((h, i) => {
        const d = new Date(state.currentWeekStart);
        d.setDate(state.currentWeekStart.getDate() + i);
        const dayOfWeek = d.getDay();
        const sales = parseFloat(salesTargets[dayOfWeek] || 0);
        if (sales <= 0 || grandCosts[i] <= 0) return '<td>-</td>';
        const pct = (grandCosts[i] / sales) * 100;
        const health = getWageKpiHealth(pct);
        return `<td><span style="font-size:11px; font-weight:700; color:${health.color};">${pct.toFixed(1)}%</span><br><span style="font-size:9px; color:var(--text-muted);">$${sales.toLocaleString()}</span></td>`;
      }).join('');

      tfoot.innerHTML = headcountRow + `
        <tr class="summary-row">
          <td>Dispensary Hours <span class="wage-val print-hide-wage">(Labor Cost)</span></td>
          ${dispTotals.map((h, i) => `<td>${h > 0 ? `${h.toFixed(1)}h<span class="wage-val print-hide-wage"><br><span style="font-size:10px; color:#10b981; font-weight:600;">$${dispCosts[i].toFixed(0)}</span></span>` : '-'}</td>`).join('')}
        </tr>
        <tr class="summary-row">
          <td>Front of Shop Hours <span class="wage-val print-hide-wage">(Labor Cost)</span></td>
          ${frontTotals.map((h, i) => `<td>${h > 0 ? `${h.toFixed(1)}h<span class="wage-val print-hide-wage"><br><span style="font-size:10px; color:#f59e0b; font-weight:600;">$${frontCosts[i].toFixed(0)}</span></span>` : '-'}</td>`).join('')}
        </tr>
        <tr class="summary-row">
          <td>Webster Hours <span class="wage-val print-hide-wage">(Labor Cost)</span></td>
          ${websterTotals.map((h, i) => `<td>${h > 0 ? `${h.toFixed(1)}h<span class="wage-val print-hide-wage"><br><span style="font-size:10px; color:#a855f7; font-weight:600;">$${websterCosts[i].toFixed(0)}</span></span>` : '-'}</td>`).join('')}
        </tr>
        <tr class="summary-row grand-total">
          <td>Total Scheduled Hours <span class="wage-val print-hide-wage">& Total Labor Cost</span></td>
          ${grandTotals.map((h, i) => `<td>${h > 0 ? `${h.toFixed(1)}h<span class="wage-val print-hide-wage"><br><span style="font-size:11px; color:var(--accent-cyan); font-weight:700;">$${grandCosts[i].toFixed(0)}</span></span>` : '-'}</td>`).join('')}
        </tr>
        <tr class="summary-row print-hide-wage" style="background: rgba(0, 229, 255, 0.04); border-top: 1px dashed rgba(0, 229, 255, 0.2);">
          <td style="font-weight:700; color:var(--accent-cyan);"><i class="fa-solid fa-chart-pie" style="margin-right:4px;"></i> Wage % of Projected Sales (Benchmark: 10.5–13.5%)</td>
          ${wagePctCells}
        </tr>
      `;
    } else {
      tfoot.innerHTML = headcountRow + `
        <tr class="summary-row">
          <td>Dispensary Hours</td>
          ${dispTotals.map(h => `<td>${h > 0 ? h.toFixed(1) + 'h' : '-'}</td>`).join('')}
        </tr>
        <tr class="summary-row">
          <td>Front of Shop Hours</td>
          ${frontTotals.map(h => `<td>${h > 0 ? h.toFixed(1) + 'h' : '-'}</td>`).join('')}
        </tr>
        <tr class="summary-row">
          <td>Webster Hours</td>
          ${websterTotals.map(h => `<td>${h > 0 ? h.toFixed(1) + 'h' : '-'}</td>`).join('')}
        </tr>
        <tr class="summary-row grand-total">
          <td>Total Scheduled Hours</td>
          ${grandTotals.map(h => `<td>${h > 0 ? h.toFixed(1) + 'h' : '-'}</td>`).join('')}
        </tr>
      `;
    }
  }

  // --- MOBILE TIMELINE RENDERING ---
  const mobileContainer = document.getElementById('scheduler-mobile-view');
  if (mobileContainer) {
    mobileContainer.innerHTML = '';
    const DAY_LONG_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    for (let i = 0; i < 7; i++) {
      const d = new Date(state.currentWeekStart);
      d.setDate(state.currentWeekStart.getDate() + i);
      const dateStr = formatDateISO(d);
      const dayName = DAY_LONG_NAMES[d.getDay()];
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');

      const dayCard = document.createElement('div');
      dayCard.className = 'mobile-day-card';

      let shiftsHtml = '';
      
      // 1. Regular Shifts for active employees
      const dayShifts = state.shifts.filter(s => s.date === dateStr && s.employeeId !== null);
      dayShifts.forEach(shift => {
        const emp = state.employees.find(e => e.id === shift.employeeId);
        if (!emp || !emp.active) return;

        const isNeedsCover = state.swaps.some(swap => swap.shiftId === shift.id && swap.status === 'PENDING');
        const cleanNotes = shift.notes || '';
        const roleColor = state.roles.find(r => r.name.toLowerCase() === shift.role.toLowerCase())?.color || '#4f46e5';

        const borderLeftStyle = isNeedsCover ? '4px solid #f97316' : `4px solid ${roleColor}`;
        const bgStyle = isNeedsCover ? 'rgba(249, 115, 22, 0.04)' : `rgba(${hexToRgb(roleColor)}, 0.04)`;

        let actionBtnHtml = '';
        if (hasManagerPermissions(state.currentUser)) {
          actionBtnHtml = `
            <button class="btn btn-outline" style="padding: 2px 8px; font-size: 11px;" onclick="openEditShiftModalById('${shift.id}')">
              <i class="fa-solid fa-pen"></i> Edit
            </button>
          `;
        } else {
          const isMyShift = state.currentUser && (shift.employeeId === state.currentUser.employeeId);
          if (isMyShift) {
            if (isNeedsCover) {
              actionBtnHtml = `
                <button class="btn btn-outline" style="padding: 2px 8px; font-size: 11px; border-color:var(--border-glass);" onclick="cancelShiftCover('${shift.id}')">
                  <i class="fa-solid fa-xmark"></i> Cancel Request
                </button>
              `;
            } else {
              actionBtnHtml = `
                <button class="btn btn-outline" style="padding: 2px 8px; font-size: 11px; color:#f97316; border-color:rgba(249,115,22,0.4);" onclick="requestShiftCover('${shift.id}')">
                  <i class="fa-solid fa-hand-holding-hand"></i> Request Cover
                </button>
              `;
            }
          } else if (isNeedsCover) {
            actionBtnHtml = `
              <button class="btn btn-neon" style="padding: 2px 8px; font-size: 11px;" onclick="offerToCover('${shift.id}')">
                <i class="fa-solid fa-handshake"></i> Cover Shift
              </button>
            `;
          }
        }

        shiftsHtml += `
          <div class="mobile-shift-item" style="border-left: ${borderLeftStyle}; background: ${bgStyle}; cursor: ${hasManagerPermissions(state.currentUser) ? 'pointer' : 'default'};" onclick="${hasManagerPermissions(state.currentUser) ? `if (!event.target.closest('button')) openEditShiftModalById('${shift.id}')` : ''}">
            <div class="mobile-shift-header">
              <span class="mobile-shift-staff">${emp.name}</span>
              <span class="mobile-shift-role">${shift.role}</span>
            </div>
            ${isNeedsCover ? `
              <div>
                <span class="badge" style="background:rgba(249,115,22,0.12); color:#f97316; border:1px solid rgba(249,115,22,0.25); font-size:10px; padding:2px 6px; border-radius:4px; margin-top:2px; display:inline-block; font-weight:600;">
                  <i class="fa-solid fa-triangle-exclamation"></i> Cover Requested
                </span>
              </div>
            ` : ''}
            <div class="mobile-shift-time" style="margin-top: 6px;">
              <i class="fa-regular fa-clock"></i> ${formatTimeAmPm(shift.startTime)} - ${formatTimeAmPm(shift.endTime)}
            </div>
            ${cleanNotes ? `<div class="mobile-shift-notes">${cleanNotes}</div>` : ''}
            ${actionBtnHtml ? `
              <div class="mobile-shift-actions" style="margin-top: 8px;">
                ${actionBtnHtml}
              </div>
            ` : ''}
          </div>
        `;
      });

      // 2. Unassigned Shifts (Only visible to manager/owner)
      if (hasManagerPermissions(state.currentUser)) {
        const unassignedShifts = state.shifts.filter(s => s.date === dateStr && (s.employeeId === null || !state.employees.find(e => e.id === s.employeeId)?.active));
        unassignedShifts.forEach(shift => {
          const roleColor = state.roles.find(r => r.name.toLowerCase() === shift.role.toLowerCase())?.color || '#ef4444';
          shiftsHtml += `
            <div class="mobile-shift-item unassigned" style="border-left: 4px solid ${roleColor}; background: rgba(${hexToRgb(roleColor)}, 0.04);">
              <div class="mobile-shift-header">
                <span class="mobile-shift-staff text-danger"><i class="fa-solid fa-triangle-exclamation"></i> Unassigned Shift</span>
                <span class="mobile-shift-role">${shift.role}</span>
              </div>
              <div class="mobile-shift-time">
                <i class="fa-regular fa-clock"></i> ${formatTimeAmPm(shift.startTime)} - ${formatTimeAmPm(shift.endTime)}
              </div>
              ${shift.notes ? `<div class="mobile-shift-notes">${shift.notes}</div>` : ''}
              <div class="mobile-shift-actions">
                <button class="btn btn-primary" style="padding: 2px 8px; font-size: 11px;" onclick="openEditShiftModalById('${shift.id}')">
                  <i class="fa-solid fa-user-plus"></i> Assign
                </button>
              </div>
            </div>
          `;
        });
      }

      // 3. On Leave Badges
      let leaveHtml = '';
      state.employees.forEach(emp => {
        if (!emp.active) return;
        const isLeave = checkLeaveStatus(emp.id, dateStr);
        if (isLeave) {
          leaveHtml += `
            <div class="badge" style="margin-top: 6px; display: inline-block; font-size: 10px; padding: 4px 8px; background: rgba(168, 85, 247, 0.12); color: #a855f7; border: 1px solid rgba(168, 85, 247, 0.25); border-radius: 4px; font-weight: 500;">
              🌴 ${emp.name} (On Leave)
            </div>
          `;
        }
      });

      if (!shiftsHtml && !leaveHtml) {
        shiftsHtml = `<div class="text-muted" style="font-size: 0.9rem; text-align: center; padding: 0.5rem 0;">No shifts scheduled</div>`;
      }

      // Add Day Action button (Add Shift) for Managers
      let addBtnHtml = '';
      if (hasManagerPermissions(state.currentUser)) {
        addBtnHtml = `
          <button class="btn btn-outline" style="width: 100%; margin-top: 8px; padding: 6px; font-size: 12px;" onclick="openAddShiftModal('', '${dateStr}')">
            <i class="fa-solid fa-plus"></i> Add Shift for ${dayName}
          </button>
        `;
      }

      let dispHours = 0;
      let frontHours = 0;
      let websterHours = 0;
      
      const dayAllShifts = state.shifts.filter(s => s.date === dateStr);
      dayAllShifts.forEach(s => {
        const hours = calculateShiftHours(s.startTime, s.endTime);
        const roleLower = s.role.toLowerCase();
        
        if (roleLower.includes('dispensary') || roleLower.includes('pharmacist') || roleLower.includes('technician')) {
          dispHours += hours;
        } else if (roleLower.includes('webster')) {
          websterHours += hours;
        } else {
          frontHours += hours;
        }
      });
      const totalHoursForDay = dispHours + frontHours + websterHours;
      let hoursSummaryHtml = '';
      if (totalHoursForDay > 0) {
        hoursSummaryHtml = `
          <div class="mobile-day-summary" style="margin-top: 12px; padding: 10px; border-top: 1px solid var(--border-color); font-size: 0.8rem; display: flex; flex-wrap: wrap; gap: 8px; background: rgba(255,255,255,0.01); border-radius: var(--radius-sm);">
            <div style="flex: 1 1 40%;">Disp: <strong style="color: #10b981;">${dispHours.toFixed(1)}h</strong></div>
            <div style="flex: 1 1 40%;">Front: <strong style="color: #f59e0b;">${frontHours.toFixed(1)}h</strong></div>
            <div style="flex: 1 1 40%;">Webster: <strong style="color: #a855f7;">${websterHours.toFixed(1)}h</strong></div>
            <div style="flex: 1 1 40%;">Total: <strong style="color: var(--accent-cyan); font-weight: 700;">${totalHoursForDay.toFixed(1)}h</strong></div>
          </div>
        `;
      }

      dayCard.innerHTML = `
        <div class="mobile-day-header">
          <span class="mobile-day-name">${dayName}</span>
          <span class="mobile-day-date">${dd}/${mm}</span>
        </div>
        <div class="mobile-shift-list">
          ${shiftsHtml}
          ${leaveHtml}
        </div>
        ${hoursSummaryHtml}
        ${addBtnHtml}
      `;
      mobileContainer.appendChild(dayCard);
    }
  }

  calculateLaborCostForecast();
}

window.openEditShiftModalById = function(id) {
  const shift = state.shifts.find(s => String(s.id) === String(id));
  if (shift) openEditShiftModal(shift);
};

window.openEditShiftModal = openEditShiftModal;
window.openAddShiftModal = openAddShiftModal;

window.deleteShiftRapid = async function(id, event) {
  if (event) event.stopPropagation();
  if (!hasManagerPermissions(state.currentUser)) {
    showToast('Permission denied: Only Owners and Managers can delete shifts.', 'error');
    return;
  }
  if (!confirm('Delete this shift?')) return;
  try {
    const shiftToDelete = state.shifts.find(s => String(s.id) === String(id));
    const emp = shiftToDelete ? state.employees.find(e => e.id === shiftToDelete.employeeId) : null;
    await BriskDB.deleteShift(id);
    if (typeof BriskDB.logAudit === 'function') {
      BriskDB.logAudit('SHIFT_DELETE', `Deleted shift #${id} on ${shiftToDelete ? shiftToDelete.date : ''} (${emp ? emp.name : 'Unassigned'})`, id);
    }
    loadDataFromState();
    renderScheduler();
    calculateLaborCostForecast();
    showToast('Shift deleted.', 'info');
  } catch (error) {
    console.error('Rapid delete failed:', error);
    showToast('Failed to delete shift: ' + error.message, 'error');
  }
};

function calculateEmployeeWeekHours(employeeId, weekStart) {
  const mon = new Date(weekStart);
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  mon.setHours(0,0,0,0);
  sun.setHours(23,59,59,999);
  
  const today = new Date();
  today.setHours(0,0,0,0);

  let total = 0;
  // Track dates we have timecards for
  const daysWithTimecards = new Set();

  // 1. Actual hours from timecards (for past days)
  const empTimecards = state.timecards.filter(tc => {
    if (tc.employeeId !== employeeId) return false;
    const tcDate = new Date(tc.date + 'T00:00:00');
    tcDate.setHours(0,0,0,0);
    return tcDate >= mon && tcDate <= sun && tcDate < today;
  });
  
  empTimecards.forEach(tc => {
    if (tc.totalHours) {
      total += tc.totalHours;
      daysWithTimecards.add(tc.date);
    }
  });

  // 2. Scheduled hours from shifts (for today, future days, OR past days with no timecard)
  const empShifts = state.shifts.filter(s => {
    if (s.employeeId !== employeeId) return false;
    const sDate = new Date(s.date + 'T00:00:00');
    sDate.setHours(0,0,0,0);
    return sDate >= mon && sDate <= sun;
  });
  
  empShifts.forEach(s => {
    const sDate = new Date(s.date + 'T00:00:00');
    sDate.setHours(0,0,0,0);
    if (sDate >= today || !daysWithTimecards.has(s.date)) {
      const netHrs = calculateShiftHours(s.startTime, s.endTime, s.unpaidMealMins);
      total += netHrs;
    }
  });

  return Math.round((total + Number.EPSILON) * 100) / 100;
}

function checkLeaveStatus(employeeId, dateStr) {
  const date = new Date(dateStr + 'T00:00:00');
  date.setHours(0,0,0,0);

  return state.leaveRequests.some(req => {
    if (req.employeeId !== employeeId || req.status !== 'Approved') return false;
    const start = new Date(req.startDate + 'T00:00:00');
    const end = new Date(req.endDate + 'T00:00:00');
    start.setHours(0,0,0,0);
    end.setHours(0,0,0,0);
    return date >= start && date <= end;
  });
}

/* ==========================================================================
   MODAL: SHIFT ADD/EDIT FORM
   ========================================================================== */

function openAddShiftModal(employeeId = '', dateStr = '') {
  if (!hasManagerPermissions(state.currentUser)) {
    showToast('Permission denied: Only Owners and Managers can add or edit shifts.', 'warning');
    return;
  }
  document.getElementById('shift-modal-title').textContent = 'Add New Shift';
  document.getElementById('shift-id').value = '';
  document.getElementById('shift-notes').value = '';
  document.getElementById('btn-delete-shift').classList.add('hide');

  document.getElementById('shift-date').value = dateStr || formatDateISO(new Date());
  document.getElementById('shift-start').value = '09:00';
  document.getElementById('shift-end').value = '17:00';

  // Comprehensive Roles select
  const roleSelect = document.getElementById('shift-role');
  roleSelect.innerHTML = '<option value="">-- Select Roster Role --</option>';
  const allRolesSet = new Set([
    'Pharmacist 1', 'Pharmacist 2', 'Dispensary', 'Webster',
    'Floor', 'Tills', 'Scripts In/Out', 'Deliveries',
    'Stock Receive & Orders', 'Stock Control & Gap Scan',
    'Till Up & Banking', 'Brand Strategy', 'Promotions & Catalogue',
    'Promotional Ends & Displays', 'Counter & Merchandising',
    'Owner / Partner'
  ]);
  if (state.roles && Array.isArray(state.roles)) {
    state.roles.forEach(r => allRolesSet.add(r.name));
  }
  allRolesSet.forEach(rName => {
    const opt = document.createElement('option');
    opt.value = rName;
    opt.textContent = rName;
    roleSelect.appendChild(opt);
  });

  // Pre-select role if employee has default role
  if (employeeId) {
    const emp = state.employees.find(e => e.id === employeeId);
    if (emp && emp.role) {
      if (emp.role.toLowerCase().includes('pharmacist')) roleSelect.value = 'Pharmacist 1';
      else if (emp.role.toLowerCase().includes('technician')) roleSelect.value = 'Dispensary';
      else if (allRolesSet.has(emp.role)) roleSelect.value = emp.role;
      else roleSelect.value = 'Floor';
    }
  }

  const select = document.getElementById('shift-employee');
  select.innerHTML = '<option value="">-- Unassigned --</option>';
  
  getOrderedActiveEmployees(false).forEach(emp => {
    const opt = document.createElement('option');
    opt.value = emp.id;
    opt.textContent = `${emp.name} (${emp.role})`;
    if (emp.id === employeeId) opt.selected = true;
    select.appendChild(opt);
  });

  select.onchange = updateShiftBreakSummary;
  const dateInput = document.getElementById('shift-date');
  if (dateInput) dateInput.onchange = updateShiftBreakSummary;

  updatePasteButtonState();
  if (document.getElementById('shift-unpaid-break')) {
    document.getElementById('shift-unpaid-break').value = 'auto';
  }
  updateShiftBreakSummary();

  document.getElementById('modal-shift').classList.add('active');
}

function openEditShiftModal(shift) {
  if (!hasManagerPermissions(state.currentUser)) {
    showToast('Permission denied: Only Owners and Managers can add or edit shifts.', 'warning');
    return;
  }
  document.getElementById('shift-modal-title').textContent = 'Edit Shift';
  document.getElementById('shift-id').value = shift.id;
  document.getElementById('shift-date').value = shift.date;
  document.getElementById('shift-start').value = (shift.startTime || '09:00').substring(0, 5);
  document.getElementById('shift-end').value = (shift.endTime || '17:00').substring(0, 5);
  document.getElementById('shift-notes').value = shift.notes || '';
  
  if (document.getElementById('shift-unpaid-break')) {
    document.getElementById('shift-unpaid-break').value = (shift.unpaidMealMins !== undefined && shift.unpaidMealMins !== null) ? String(shift.unpaidMealMins) : 'auto';
  }

  document.getElementById('btn-delete-shift').classList.remove('hide');

  // Populate Roles select
  const roleSelect = document.getElementById('shift-role');
  roleSelect.innerHTML = '<option value="">-- Select Roster Role --</option>';
  const allRolesSet = new Set([
    'Pharmacist 1', 'Pharmacist 2', 'Dispensary', 'Webster',
    'Floor', 'Tills', 'Scripts In/Out', 'Deliveries',
    'Stock Receive & Orders', 'Stock Control & Gap Scan',
    'Till Up & Banking', 'Brand Strategy', 'Promotions & Catalogue',
    'Promotional Ends & Displays', 'Counter & Merchandising',
    'Owner / Partner'
  ]);
  if (state.roles && Array.isArray(state.roles)) {
    state.roles.forEach(r => allRolesSet.add(r.name));
  }
  if (shift && shift.role) {
    allRolesSet.add(shift.role);
  }
  allRolesSet.forEach(rName => {
    const opt = document.createElement('option');
    opt.value = rName;
    opt.textContent = rName;
    if (shift && shift.role === rName) opt.selected = true;
    roleSelect.appendChild(opt);
  });
  if (shift && shift.role) {
    roleSelect.value = shift.role;
  }

  const select = document.getElementById('shift-employee');
  select.innerHTML = '<option value="">-- Unassigned --</option>';
  
  state.employees.forEach(emp => {
    if (!emp.active && emp.id !== shift.employeeId) return;
    const r = (emp.role || '').toLowerCase().trim();
    if ((r === 'owner' || r === 'partner' || r === 'managing partner') && emp.id !== shift.employeeId) return;
    const opt = document.createElement('option');
    opt.value = emp.id;
    opt.textContent = `${emp.name} (${emp.role || 'Staff'})`;
    if (emp.id === shift.employeeId) opt.selected = true;
    select.appendChild(opt);
  });
  if (shift.employeeId) select.value = shift.employeeId;

  select.onchange = updateShiftBreakSummary;
  const dateInput = document.getElementById('shift-date');
  if (dateInput) dateInput.onchange = updateShiftBreakSummary;

  updateShiftBreakSummary();
  updatePasteButtonState();

  document.getElementById('modal-shift').classList.add('active');
}

function closeShiftModal() {
  const modal = document.getElementById('modal-shift');
  if (modal) {
    if (typeof window.closeModal === 'function') {
      window.closeModal(modal);
    } else {
      modal.classList.remove('active');
    }
  }
}

async function handleShiftSubmit(event) {
  event.preventDefault();
  if (!hasManagerPermissions(state.currentUser)) {
    showToast('Permission denied: Only Owners and Managers can save shifts.', 'error');
    return;
  }
  const submitBtn = event.target.querySelector('button[type="submit"]');
  const originalBtnText = submitBtn ? submitBtn.innerHTML : 'Save Shift';
  if (submitBtn) { submitBtn.disabled = true; submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...'; }

  try {
    const id = document.getElementById('shift-id').value;
    const empId = document.getElementById('shift-employee').value || null;
    const role = document.getElementById('shift-role').value;
    const date = document.getElementById('shift-date').value;
    const start = document.getElementById('shift-start').value;
    const end = document.getElementById('shift-end').value;
    const notes = document.getElementById('shift-notes').value;

    if (start === end) {
      showToast('Shift start time and end time cannot be identical. (Tip: For 8:00 PM, enter 20:00 in 24-hour format)', 'error');
      return;
    }

    if (empId) {
      // Strict Overlap validation only if assigned
      const empShifts = state.shifts.filter(s => s.employeeId === empId && String(s.id) !== String(id));
      const hasOverlap = empShifts.some(s => BriskScheduler.isOverlapping(date, start, end, s.date, s.startTime, s.endTime));
      if (hasOverlap) {
        showToast('This shift overlaps with another shift for this employee.', 'error');
        return;
      }

      // Fair Work MA000012 / Pharmacy Industry Award 2026 10-Hour Rest Break Warning
      const shiftStartMs = new Date(`${date}T${start.substring(0, 5)}:00`).getTime();
      let shiftEndMs = new Date(`${date}T${end.substring(0, 5)}:00`).getTime();
      if (shiftEndMs <= shiftStartMs) shiftEndMs += 86400000;

      for (const s of empShifts) {
        const sStartMs = new Date(`${s.date}T${(s.startTime || '00:00').substring(0, 5)}:00`).getTime();
        let sEndMs = new Date(`${s.date}T${(s.endTime || '00:00').substring(0, 5)}:00`).getTime();
        if (sEndMs <= sStartMs) sEndMs += 86400000;
        
        let gapHours = 999;
        if (shiftStartMs >= sEndMs) {
          gapHours = (shiftStartMs - sEndMs) / (1000 * 60 * 60);
        } else if (sStartMs >= shiftEndMs) {
          gapHours = (sStartMs - shiftEndMs) / (1000 * 60 * 60);
        }
        
        if (gapHours < 10) {
          if (!confirm(`Warning (Pharmacy Industry Award 2026 [MA000012]): This employee has another shift on ${s.date} (${formatTimeAmPm(s.startTime)} - ${formatTimeAmPm(s.endTime)}), leaving only ${gapHours.toFixed(1)}h rest (minimum 10h required). Assign anyway?`)) {
            return;
          }
          break;
        }
      }
    }

    // Award Compliance Checks: Casual 3h minimum (Clause 11.4) & Daily 12h max ordinary hours (Clause 13.2)
    const singleShiftDuration = BriskScheduler.getShiftDuration(start, end);
    if (empId) {
      const emp = state.employees.find(e => e.id === empId);
      if (emp) {
        if (emp.employmentType === 'casual' && singleShiftDuration < 3.0) {
          if (!confirm(`Notice (Pharmacy Industry Award 2026 [MA000012] Clause 11.4): Casual employees have a minimum engagement of 3 hours per shift (scheduled: ${singleShiftDuration.toFixed(1)}h).\n\nAssign this shift anyway?`)) {
            return;
          }
        }
        if (singleShiftDuration > 12.0) {
          if (!confirm(`Notice (Pharmacy Industry Award 2026 [MA000012] Clause 13.2): Maximum ordinary daily shift length is 12.0 hours (scheduled: ${singleShiftDuration.toFixed(1)}h).\n\nOvertime penalty rates may apply for hours exceeding 12 hours. Schedule anyway?`)) {
            return;
          }
        }
      }

      // Check Maximum 6 Consecutive Days Worked (Clause 13.3)
      const consec = checkConsecutiveDaysWorked(empId, date, id);
      if (consec.exceeded) {
        if (!confirm(`Warning (Pharmacy Industry Award 2026 [MA000012] Clause 13.3): Scheduling this shift will result in ${consec.count} consecutive days worked (maximum 6 consecutive days permitted).\n\nSchedule this shift anyway?`)) {
          return;
        }
      }

      // Clinical Governance: AHPRA Registration & CPR Expiration Guard
      if (emp && emp.certificates && Array.isArray(emp.certificates)) {
        const todayStr = formatDateISO(new Date());
        const expiredAhpra = emp.certificates.find(c => (c.type || '').includes('AHPRA') && c.expiryDate && c.expiryDate < todayStr);
        if (expiredAhpra && (role.toLowerCase().includes('pharmacist') || role.toLowerCase().includes('dispensary'))) {
          if (!confirm(`⚠️ Clinical Governance Warning: ${emp.name}'s AHPRA Registration expired on ${expiredAhpra.expiryDate}.\n\nAre you sure you want to schedule this employee for ${role}?`)) {
            return;
          }
        }
      }
    }

    if (empId && checkLeaveStatus(empId, date)) {
      if (!confirm('This employee has an approved leave request on this date. Force schedule this shift anyway?')) {
        return;
      }
    }

    // Trading Hours Validation
    if (state.settings && state.settings.tradingHours) {
      const shiftDateObj = new Date(date);
      const dayOfWeek = shiftDateObj.getDay();
      const tradingHours = state.settings.tradingHours[String(dayOfWeek)];
      
      if (tradingHours) {
        if (tradingHours.closed) {
          if (!confirm(`Warning: The pharmacy is marked as CLOSED on this day (${shiftDateObj.toLocaleDateString('en-AU', { weekday: 'long' })}). Do you want to schedule this shift anyway?`)) {
            return;
          }
        } else {
          const shiftStartDec = timeToDecimal(start);
          const shiftEndDec = timeToDecimal(end);
          const tradingOpenDec = timeToDecimal(tradingHours.open);
          const tradingCloseDec = timeToDecimal(tradingHours.close);
          
          if (shiftStartDec < tradingOpenDec || shiftEndDec > tradingCloseDec) {
            if (!confirm(`Warning: Shift hours (${formatTimeAmPm(start)} - ${formatTimeAmPm(end)}) fall outside the pharmacy trading hours (${formatTimeAmPm(tradingHours.open)} - ${formatTimeAmPm(tradingHours.close)}) on this day. Do you want to schedule this shift anyway?`)) {
              return;
            }
          }
        }
      }
    }

    // Employee Availability Check
    if (empId) {
      const emp = state.employees.find(e => e.id === empId);
      if (emp && emp.availability) {
        const shiftDateObj = new Date(date + 'T00:00:00');
        const dayOfWeek = shiftDateObj.getDay();
        const avail = emp.availability[dayOfWeek];
        if (!avail) {
          if (!confirm(`Notice: ${emp.name} is marked as UNAVAILABLE on ${shiftDateObj.toLocaleDateString('en-AU', { weekday: 'long' })}s in their profile.\n\nSchedule this shift anyway?`)) {
            return;
          }
        } else if (avail.start && avail.end) {
          const shiftStartDec = timeToDecimal(start);
          const shiftEndDec = timeToDecimal(end);
          const availStartDec = timeToDecimal(avail.start);
          const availEndDec = timeToDecimal(avail.end);
          if (shiftStartDec < availStartDec || shiftEndDec > availEndDec) {
            if (!confirm(`Notice: Shift hours (${formatTimeAmPm(start)} - ${formatTimeAmPm(end)}) fall outside ${emp.name}'s declared availability (${formatTimeAmPm(avail.start)} - ${formatTimeAmPm(avail.end)}).\n\nSchedule this shift anyway?`)) {
              return;
            }
          }
        }
      }
    }

    if (empId) {
      const emp = state.employees.find(e => e.id === empId);
      const duration = BriskScheduler.getShiftDuration(start, end);
      const currentWeekHours = calculateEmployeeWeekHours(empId, getMondayOfCurrentWeek(new Date(date)));
      
      let prevDuration = 0;
      if (id) {
        const prevShift = state.shifts.find(s => s.id === id);
        if (prevShift && prevShift.employeeId === empId) {
          prevDuration = BriskScheduler.getShiftDuration(prevShift.startTime, prevShift.endTime);
        }
      }

      if (currentWeekHours - prevDuration + duration > emp.maxHours) {
        if (!confirm(`Adding this shift will exceed ${emp.name}'s weekly limit of ${emp.maxHours} hours. Continue?`)) {
          return;
        }
      }
    }

    const unpaidMealVal = document.getElementById('shift-unpaid-break') ? document.getElementById('shift-unpaid-break').value : 'auto';
    let unpaidMealMins = null;
    if (unpaidMealVal === 'crib_paid') {
      unpaidMealMins = 0; // 0 unpaid minutes for Paid Crib Break
    } else if (unpaidMealVal !== 'auto') {
      unpaidMealMins = parseInt(unpaidMealVal, 10);
    }

    // Clause 20 5-Hour Work Meal Break Guard
    const grossShiftDuration = BriskScheduler.getShiftDuration(start, end);
    if (grossShiftDuration > 5.0 && unpaidMealVal === '0') {
      if (!confirm(`⚠️ Fair Work Award Notice (Pharmacy Award Clause 20):\n\nEmployees working more than 5 continuous hours (${grossShiftDuration.toFixed(1)}h) must be rostered for a meal break of at least 30 minutes (or Paid Crib Break for sole pharmacists).\n\nProceed without scheduling a meal break?`)) {
        return;
      }
    }

    const targetEmp = state.employees.find(e => e.id === empId);
    const empName = targetEmp ? targetEmp.name : 'Unassigned';

    // Clause 23: Mandatory 10-Hour Rest Gap / Clopening Guard
    if (empId && date && start && end) {
      const getOffsetDateStr = (dStr, offset) => {
        const [y, m, d] = dStr.split('-').map(Number);
        const dt = new Date(Date.UTC(y, m - 1, d + offset));
        return dt.toISOString().split('T')[0];
      };
      
      const prevDate = getOffsetDateStr(date, -1);
      const nextDate = getOffsetDateStr(date, 1);
      
      // Check yesterday's shifts for this employee
      const prevShifts = state.shifts.filter(s => s.employeeId === empId && s.date === prevDate && String(s.id) !== String(id));
      for (const ps of prevShifts) {
        const prevEndDt = new Date(`${prevDate}T${(ps.endTime || '00:00').substring(0, 5)}:00`);
        const curStartDt = new Date(`${date}T${start.substring(0, 5)}:00`);
        const gapHrs = (curStartDt - prevEndDt) / (1000 * 3600);
        if (gapHrs > 0 && gapHrs < 10.0) {
          if (!confirm(`⚠️ Fair Work Award Notice (Pharmacy Award Clause 23 - 10h Rest Gap):\n\n${empName} finished their shift yesterday at ${ps.endTime} and starts today at ${start}, providing only ${gapHrs.toFixed(1)} hours of rest (Minimum required: 10.0 hours).\n\nIf rostered with < 10h rest, overtime rates (200%) apply until a 10h break is provided.\n\nProceed with this schedule?`)) {
            return;
          }
        }
      }

      // Check tomorrow's shifts for this employee
      const nextShifts = state.shifts.filter(s => s.employeeId === empId && s.date === nextDate && String(s.id) !== String(id));
      for (const ns of nextShifts) {
        const curEndDt = new Date(`${date}T${end.substring(0, 5)}:00`);
        const nextStartDt = new Date(`${nextDate}T${(ns.startTime || '00:00').substring(0, 5)}:00`);
        const gapHrs = (nextStartDt - curEndDt) / (1000 * 3600);
        if (gapHrs > 0 && gapHrs < 10.0) {
          if (!confirm(`⚠️ Fair Work Award Notice (Pharmacy Award Clause 23 - 10h Rest Gap):\n\n${empName} will finish this shift at ${end} and start tomorrow at ${ns.startTime}, providing only ${gapHrs.toFixed(1)} hours of rest (Minimum required: 10.0 hours).\n\nIf rostered with < 10h rest, overtime rates (200%) apply until a 10h break is provided.\n\nProceed with this schedule?`)) {
            return;
          }
        }
      }
    }

    const shiftData = {
      employeeId: empId,
      role: role,
      date: date,
      startTime: start,
      endTime: end,
      unpaidMealMins: unpaidMealMins,
      notes: notes
    };

    if (id) {
      shiftData.id = id;
      await BriskDB.updateShift(shiftData);
      if (typeof BriskDB.logAudit === 'function') {
        BriskDB.logAudit('SHIFT_UPDATE', `Updated shift for ${empName} on ${date} (${start}-${end}, ${role}${unpaidMealVal === 'crib_paid' ? ', Paid Crib' : ''})`, id);
      }
      showToast('Shift updated successfully.', 'success');
    } else {
      const created = await BriskDB.addShift(shiftData);
      if (typeof BriskDB.logAudit === 'function') {
        BriskDB.logAudit('SHIFT_CREATE', `Created shift for ${empName} on ${date} (${start}-${end}, ${role}${unpaidMealVal === 'crib_paid' ? ', Paid Crib' : ''})`, created ? created.id : null);
      }
      showToast('Shift added successfully.', 'success');
    }
    loadDataFromState();
    renderScheduler();
    calculateLaborCostForecast();
    closeShiftModal();
  } catch (err) {
    console.error('Save Shift Error:', err);
    showToast(err.message || 'Failed to save shift.', 'error');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalBtnText;
    }
  }
}

async function handleShiftDelete() {
  if (!hasManagerPermissions(state.currentUser)) {
    showToast('Permission denied: Only Owners and Managers can delete shifts.', 'error');
    return;
  }
  const id = document.getElementById('shift-id').value;
  if (id && confirm('Delete this shift permanently?')) {
    try {
      const shiftToDelete = state.shifts.find(s => s.id === id);
      const emp = shiftToDelete ? state.employees.find(e => e.id === shiftToDelete.employeeId) : null;
      await BriskDB.deleteShift(id);
      if (typeof BriskDB.logAudit === 'function') {
        BriskDB.logAudit('SHIFT_DELETE', `Deleted shift #${id} on ${shiftToDelete ? shiftToDelete.date : ''} (${emp ? emp.name : 'Unassigned'}, ${shiftToDelete ? shiftToDelete.startTime + '-' + shiftToDelete.endTime : ''})`, id);
      }
      loadDataFromState();
      renderScheduler();
      calculateLaborCostForecast();
      closeShiftModal();
    } catch (error) {
      console.error('Failed to delete shift:', error);
      showToast('Failed to delete shift: ' + error.message, 'error');
    }
  }
}

async function copyCurrentWeekToNextWeek() {
  const mon = getMondayOfCurrentWeek(state.currentWeekStart || new Date());
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);

  const monStr = formatDateISO(mon);
  const sunStr = formatDateISO(sun);

  // Find all shifts in the currently selected week
  const currentWeekShifts = state.shifts.filter(s => {
    return s && s.date && s.date >= monStr && s.date <= sunStr;
  });

  if (currentWeekShifts.length === 0) {
    showToast('No shifts found in the current week to copy.', 'warning');
    return;
  }

  // Calculate next week's Monday & Sunday
  const nextMon = new Date(mon);
  nextMon.setDate(mon.getDate() + 7);
  const nextSun = new Date(nextMon);
  nextSun.setDate(nextMon.getDate() + 6);

  const nextMonStr = formatDateISO(nextMon);
  const nextSunStr = formatDateISO(nextSun);

  const currentWeekRange = getWeekRangeText(mon);
  const nextWeekRange = getWeekRangeText(nextMon);

  const existingNextWeekShifts = state.shifts.filter(s => s && s.date && s.date >= nextMonStr && s.date <= nextSunStr);
  if (existingNextWeekShifts.length > 0) {
    if (!confirm(`Warning: Next week (${nextWeekRange}) already has ${existingNextWeekShifts.length} scheduled shift(s).\n\nDo you want to proceed and copy ${currentWeekShifts.length} shift(s) into next week?`)) {
      return;
    }
  } else {
    const confirmMsg = `Copy all ${currentWeekShifts.length} shift(s) from current week (${currentWeekRange}) to next week (${nextWeekRange})?`;
    if (!confirm(confirmMsg)) return;
  }

  const btn = document.getElementById('btn-copy-week');
  const origBtnHtml = btn ? btn.innerHTML : '<i class="fa-solid fa-copy text-cyan"></i> Copy to Next Week';
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Copying...';
  }

  try {
    let leaveConflictCount = 0;
    const duplicatedShifts = currentWeekShifts.map(shift => {
      const [y, m, d] = shift.date.split('-').map(Number);
      const targetDate = new Date(Date.UTC(y, m - 1, d + 7));
      const targetDateStr = targetDate.toISOString().split('T')[0];

      let empId = null;
      if (shift.employeeId && state.employees.some(e => e.id === shift.employeeId)) {
        if (checkLeaveStatus(shift.employeeId, targetDateStr)) {
          empId = null; // Auto unassign to protect approved leave!
          leaveConflictCount++;
        } else {
          empId = shift.employeeId;
        }
      }

      const newShift = {
        employeeId: empId,
        role: shift.role || 'Floor',
        date: targetDateStr,
        startTime: (shift.startTime || '09:00').substring(0, 5),
        endTime: (shift.endTime || '17:00').substring(0, 5),
        notes: shift.notes || ''
      };
      if (shift.unpaidMealMins !== undefined && shift.unpaidMealMins !== null) {
        newShift.unpaidMealMins = shift.unpaidMealMins;
      }
      return newShift;
    });

    let createdCount = 0;
    if (typeof BriskDB.addShiftsBatch === 'function') {
      const addedList = await BriskDB.addShiftsBatch(duplicatedShifts);
      createdCount = (addedList && addedList.length) ? addedList.length : duplicatedShifts.length;
    } else {
      for (const s of duplicatedShifts) {
        const added = await BriskDB.addShift(s);
        if (added) createdCount++;
      }
    }

    // Switch view to next week automatically
    state.currentWeekStart = nextMon;
    
    // Refresh local state and UI
    loadDataFromState();
    renderScheduler();
    calculateLaborCostForecast();

    const leaveNote = leaveConflictCount > 0 ? `\n(⚠️ ${leaveConflictCount} shift(s) moved to Unassigned due to approved leave)` : '';
    showToast(`Successfully copied ${createdCount} shift(s) to next week! (${nextWeekRange})${leaveNote}`, 'success');
  } catch (err) {
    console.error('Copy Week Error:', err);
    showToast('Failed to copy roster: ' + (err.message || 'Unknown error'), 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = origBtnHtml;
    }
  }
}
window.copyCurrentWeekToNextWeek = copyCurrentWeekToNextWeek;

async function triggerClearWeek() {
  if (!confirm('Are you sure you want to unassign all employee shifts for this week?')) return;

  const mon = new Date(state.currentWeekStart);
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  mon.setHours(0,0,0,0);
  sun.setHours(23,59,59,999);

  const weekShifts = state.shifts.filter(s => {
    const sDate = new Date(s.date + 'T00:00:00');
    return sDate >= mon && sDate <= sun;
  });

  try {
    const updatedShifts = weekShifts.map(s => ({ ...s, employeeId: null }));
    if (typeof BriskDB.batchUpdateShifts === 'function') {
      await BriskDB.batchUpdateShifts(updatedShifts);
    } else {
      for (const s of updatedShifts) {
        await BriskDB.updateShift(s);
      }
    }
    loadDataFromState();
    renderScheduler();
    calculateLaborCostForecast();
    showToast('Week shifts unassigned successfully.', 'info');
  } catch (err) {
    console.error('Clear Week Error:', err);
    showToast('Failed to clear week shifts: ' + (err.message || 'Unknown error'), 'error');
  }
}
window.triggerClearWeek = triggerClearWeek;


/* ==========================================================================
   PANEL: EMPLOYEES DIRECTORY
   ========================================================================== */

function renderEmployeesList() {
  const container = document.getElementById('employees-cards-container');
  if (!container) return;
  container.innerHTML = '';

  if (!hasManagerPermissions(state.currentUser)) {
    container.innerHTML = `<div style="grid-column: 1/-1;"><div class="empty-state"><i class="fa-solid fa-lock"></i><h4>Access Restricted</h4><p>Employee management is restricted to Managers and Owners.</p></div></div>`;
    return;
  }

  const searchInput = document.getElementById('employee-search-input');
  const searchVal = searchInput ? searchInput.value.toLowerCase() : '';
  const orderedActive = getOrderedActiveEmployees(true);
  
  const filtered = orderedActive.filter(emp => {
    return emp.name.toLowerCase().includes(searchVal) || 
           emp.role.toLowerCase().includes(searchVal);
  });

  if (filtered.length === 0) {
    container.innerHTML = `<div style="grid-column: 1/-1;"><div class="empty-state"><i class="fa-solid fa-users-slash"></i><h4>No employees found</h4><p>Add a team member to start building your roster.</p></div></div>`;
    return;
  }

  const isManagerOrOwner = hasManagerPermissions(state.currentUser);

  filtered.forEach(emp => {
    const card = document.createElement('div');
    card.className = 'employee-card';

    const empIdx = orderedActive.findIndex(e => e.id === emp.id);
    const isFirst = empIdx === 0;
    const isLast = empIdx === orderedActive.length - 1;

    let availBubbles = '';
    const dayInitialList = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
    for (let i = 0; i < 7; i++) {
      const hasAvail = emp.availability[i] != null;
      availBubbles += `<div class="avail-day-bubble ${hasAvail ? 'active' : ''}">${dayInitialList[i]}</div>`;
    }

    const reorderBtns = isManagerOrOwner ? `
      <div style="display:flex; gap:4px; margin-top:8px;">
        <button class="btn btn-outline" style="flex:1; padding:4px 8px; font-size:11px;" onclick="moveEmployeeOrder('${emp.id}', 'up')" ${isFirst ? 'disabled style="opacity:0.3;"' : ''}>
          <i class="fa-solid fa-arrow-up"></i> Move Up
        </button>
        <button class="btn btn-outline" style="flex:1; padding:4px 8px; font-size:11px;" onclick="moveEmployeeOrder('${emp.id}', 'down')" ${isLast ? 'disabled style="opacity:0.3;"' : ''}>
          <i class="fa-solid fa-arrow-down"></i> Move Down
        </button>
      </div>
    ` : '';

    card.innerHTML = `
      <div class="employee-card-header">
        <div class="emp-details">
          <h4>${emp.name}</h4>
          <p>${emp.role}</p>
        </div>
        <span class="badge badge-success">Active</span>
      </div>
      <div class="employee-card-meta">
        <span>Email: <strong>${emp.email}</strong></span>
        <span>Limit: <strong>Max ${emp.maxHours}h / week</strong></span>
        ${isManagerOrOwner ? `
          <span style="grid-column: 1/-1; color: var(--accent-cyan);">
            Pay Structure: <strong>$${(emp.hourlyRate || 0).toFixed(2)}/h</strong> 
            <span class="badge" style="font-size:10px; margin-left:4px; ${emp.employmentType && emp.employmentType.startsWith('locum') ? 'background:rgba(168,85,247,0.15); color:#c084fc; border:1px solid rgba(168,85,247,0.3);' : 'background:rgba(0,229,255,0.1); color:var(--accent-cyan);'}">
              ${emp.employmentType === 'locum_invoice' ? 'Locum Invoice (+GST+Super)' : (emp.employmentType === 'locum_invoice_no_gst' ? 'Locum (No GST)' : (emp.employmentType === 'locum_all_inclusive' ? 'Locum (Flat Rate)' : (emp.employmentType === 'casual' ? 'PAYG Casual' : 'PAYG Permanent')))}
            </span>
          </span>
        ` : ''}
      </div>
      ${(() => {
        let certBadges = '';
        const todayStr = formatDateISO(new Date());
        if (emp.certificates && Array.isArray(emp.certificates) && emp.certificates.length > 0) {
          certBadges = '<div style="display:flex; flex-wrap:wrap; gap:4px; margin: 8px 0 4px 0;">';
          emp.certificates.forEach(c => {
            const isExpired = c.expiryDate && c.expiryDate < todayStr;
            const daysLeft = c.expiryDate ? Math.round((new Date(c.expiryDate + 'T00:00:00') - new Date(todayStr + 'T00:00:00')) / (1000 * 3600 * 24)) : null;
            const isExpiringSoon = daysLeft !== null && daysLeft >= 0 && daysLeft <= 30;

            let bg = 'rgba(16,185,129,0.12)';
            let color = '#10b981';
            let border = '1px solid rgba(16,185,129,0.3)';
            let text = c.type.split(' ')[0] + (c.certNumber ? ` #${c.certNumber}` : '');

            if (isExpired) {
              bg = 'rgba(239,68,68,0.15)';
              color = '#f87171';
              border = '1px solid rgba(239,68,68,0.4)';
              text = `🔴 Expired: ${c.type}`;
            } else if (isExpiringSoon) {
              bg = 'rgba(245,158,11,0.15)';
              color = '#fbbf24';
              border = '1px solid rgba(245,158,11,0.4)';
              text = `⚠️ ${daysLeft}d left: ${c.type}`;
            }
            certBadges += `<span class="badge" style="background:${bg}; color:${color}; border:${border}; font-size:10px; padding:2px 6px;" title="${c.type} (${c.expiryDate ? 'Expires: ' + c.expiryDate : 'No Expiry'})">${text}</span>`;
          });
          certBadges += '</div>';
        }
        return certBadges;
      })()}
      <div class="employee-card-avail">
        <span>Work Availability:</span>
        <div class="avail-list">
          ${availBubbles}
        </div>
      </div>
      ${reorderBtns}
      <div class="employee-card-actions" style="margin-top: 8px; display:flex; gap:6px;">
        <button class="btn btn-outline" style="flex:1;" onclick="openEditEmployeeModal('${emp.id}')">
          <i class="fa-solid fa-user-pen"></i> Edit Profile
        </button>
        ${isManagerOrOwner ? `
        ` : ''}
      </div>
    `;
    container.appendChild(card);
  });
}

function renderAvailabilityFormInputs(availability = {}) {
  const container = document.querySelector('.availability-inputs-grid');
  container.innerHTML = '';
  
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  
  for (let i = 0; i < 7; i++) {
    const current = availability[i] || null;
    const isChecked = current !== null;
    const startTime = current ? current.start : '09:00';
    const endTime = current ? current.end : '17:00';

    const row = document.createElement('div');
    row.className = 'avail-input-row';
    row.innerHTML = `
      <div class="avail-inputs-row-meta">
        <input type="checkbox" id="avail-check-${i}" ${isChecked ? 'checked' : ''} onchange="toggleAvailTimeInputs(${i})">
        <label for="avail-check-${i}" class="avail-input-label" style="cursor:pointer; margin-left: 6px;">${dayNames[i]}</label>
      </div>
      <div class="avail-inputs-row-times ${isChecked ? '' : 'hide'}" id="avail-times-container-${i}">
        <input type="time" id="avail-start-${i}" class="form-control" value="${startTime}">
        <span>~</span>
        <input type="time" id="avail-end-${i}" class="form-control" value="${endTime}">
      </div>
    `;
    container.appendChild(row);
  }
}

function toggleAvailTimeInputs(dayIdx) {
  const isChecked = document.getElementById(`avail-check-${dayIdx}`).checked;
  const container = document.getElementById(`avail-times-container-${dayIdx}`);
  if (isChecked) {
    container.classList.remove('hide');
  } else {
    container.classList.add('hide');
  }
}


function onAwardClassificationChange() {
  const levelSelect = document.getElementById('emp-award-level');
  const typeSelect = document.getElementById('emp-employment-type');
  const rateInput = document.getElementById('emp-rate');
  const locumBadge = document.getElementById('locum-indicator-badge');
  const locumNote = document.getElementById('locum-details-note');
  if (!levelSelect || !typeSelect || !rateInput) return;

  const selectedOpt = levelSelect.options[levelSelect.selectedIndex];
  const isLocum = (selectedOpt && selectedOpt.value.startsWith('locum')) || typeSelect.value.startsWith('locum');

  if (locumBadge) locumBadge.style.display = isLocum ? 'inline-block' : 'none';
  if (locumNote) locumNote.classList.toggle('hide', !isLocum);

  if (selectedOpt && (selectedOpt.value === 'locum' || selectedOpt.value === 'locum_weekend')) {
    if (!typeSelect.value.startsWith('locum_')) {
      typeSelect.value = 'locum_invoice';
    }
  }

  if (!selectedOpt || selectedOpt.value === 'custom') return;

  const baseRate = parseFloat(selectedOpt.getAttribute('data-rate') || 0);
  if (!baseRate) return;

  if (typeSelect.value.startsWith('locum_')) {
    rateInput.value = baseRate.toFixed(2);
  } else {
    const isCasual = typeSelect.value === 'casual';
    const finalRate = isCasual ? (baseRate * 1.25) : baseRate;
    rateInput.value = finalRate.toFixed(2);
  }
}
window.onAwardClassificationChange = onAwardClassificationChange;

/* ==========================================================================
   MODAL: EMPLOYEE ADD/EDIT FORM
   ========================================================================== */

function openAddEmployeeModal() {
  if (!hasManagerPermissions(state.currentUser)) {
    showToast('Permission denied: Only Owners and Managers can add new employees.', 'warning');
    return;
  }
  document.getElementById('employee-modal-title').textContent = 'Register New Employee';
  document.getElementById('employee-id').value = '';
  document.getElementById('emp-name').value = '';
  document.getElementById('emp-email').value = '';
  document.getElementById('emp-phone').value = '';
  document.getElementById('emp-rate').value = '';
  document.getElementById('emp-max-hours').value = '38';
  
  const levelSelect = document.getElementById('emp-award-level');
  const typeSelect = document.getElementById('emp-employment-type');
  if (levelSelect) levelSelect.value = 'custom';
  if (typeSelect) typeSelect.value = 'permanent';

  onAwardClassificationChange();

  document.getElementById('btn-delete-employee').classList.add('hide');

  const roleSelect = document.getElementById('emp-role');
  roleSelect.innerHTML = '<option value="">-- Select Default Position --</option>';
  state.positions.forEach(pos => {
    const opt = document.createElement('option');
    opt.value = pos.name;
    opt.textContent = pos.name;
    roleSelect.appendChild(opt);
  });

  const defaultAvail = {
    0: null,
    1: { start: '09:00', end: '17:00' },
    2: { start: '09:00', end: '17:00' },
    3: { start: '09:00', end: '17:00' },
    4: { start: '09:00', end: '17:00' },
    5: { start: '09:00', end: '17:00' },
    6: null
  };
  renderAvailabilityFormInputs(defaultAvail);

  const dobInput = document.getElementById('emp-dob');
  if (dobInput) dobInput.value = '';
  const alertBox = document.getElementById('junior-rate-upgrade-alert');
  if (alertBox) alertBox.classList.add('hide');

  window.currentEditingCertificates = [];
  renderModalCertificatesList();

  document.getElementById('modal-employee').classList.add('active');
}

function openEditEmployeeModal(empId) {
  if (!hasManagerPermissions(state.currentUser)) {
    showToast('Permission denied: Only Owners and Managers can edit employee profiles.', 'warning');
    return;
  }
  const emp = state.employees.find(e => e.id === empId);
  if (!emp) return;

  document.getElementById('employee-modal-title').textContent = 'Edit Employee Profile';
  document.getElementById('employee-id').value = emp.id;
  document.getElementById('emp-name').value = emp.name;
  document.getElementById('emp-email').value = emp.email;
  document.getElementById('emp-phone').value = emp.phone || '';
  document.getElementById('emp-rate').value = emp.hourlyRate != null ? emp.hourlyRate : '';
  document.getElementById('emp-max-hours').value = emp.maxHours;

  const dobInput = document.getElementById('emp-dob');
  if (dobInput) dobInput.value = emp.dob || '';

  const levelSelect = document.getElementById('emp-award-level');
  const typeSelect = document.getElementById('emp-employment-type');
  if (levelSelect) levelSelect.value = emp.awardLevel || 'custom';
  if (typeSelect) typeSelect.value = emp.employmentType || 'permanent';

  onAwardClassificationChange();
  onEmployeeDobChange();

  const isManagerOrOwner = hasManagerPermissions(state.currentUser);
  const rateInput = document.getElementById('emp-rate');
  if (rateInput) rateInput.disabled = !isManagerOrOwner;

  const roleSelect = document.getElementById('emp-role');
  roleSelect.innerHTML = '<option value="">-- Select Default Position --</option>';
  state.positions.forEach(pos => {
    const opt = document.createElement('option');
    opt.value = pos.name;
    opt.textContent = pos.name;
    roleSelect.appendChild(opt);
  });
  roleSelect.value = emp.role;

  if (emp.id === state.currentUser.employeeId) {
    document.getElementById('btn-delete-employee').classList.add('hide'); 
  } else {
    document.getElementById('btn-delete-employee').classList.remove('hide');
  }

  renderAvailabilityFormInputs(emp.availability);

  window.currentEditingCertificates = Array.isArray(emp.certificates) ? [...emp.certificates] : [];
  renderModalCertificatesList();

  document.getElementById('modal-employee').classList.add('active');
}

function closeEmployeeModal() {
  window.closeModal(document.getElementById('modal-employee'));
  renderEmployeesList();
}

async function handleEmployeeSubmit(event) {
  event.preventDefault();
  const submitBtn = event.target.querySelector('button[type="submit"]');
  const originalBtnText = submitBtn ? submitBtn.innerHTML : 'Save Employee';
  if (submitBtn) { submitBtn.disabled = true; submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...'; }

  const id = document.getElementById('employee-id').value;
  const name = document.getElementById('emp-name').value;
  const role = document.getElementById('emp-role').value;
  const email = document.getElementById('emp-email').value;
  const phone = document.getElementById('emp-phone').value;
  const hourlyRate = parseFloat(document.getElementById('emp-rate').value) || 0;
  const rawMax = parseInt(document.getElementById('emp-max-hours').value, 10);
  const maxHours = isNaN(rawMax) ? 38 : rawMax;
  const awardLevel = document.getElementById('emp-award-level') ? document.getElementById('emp-award-level').value : 'custom';
  const employmentType = document.getElementById('emp-employment-type') ? document.getElementById('emp-employment-type').value : 'permanent';
  const dob = document.getElementById('emp-dob') ? document.getElementById('emp-dob').value : null;

  const availability = {};
  for (let i = 0; i < 7; i++) {
    const isChecked = document.getElementById(`avail-check-${i}`).checked;
    if (isChecked) {
      const start = document.getElementById(`avail-start-${i}`).value;
      const end = document.getElementById(`avail-end-${i}`).value;
      
      if (start >= end) {
        showToast(`Availability times for ${DAY_NAMES[i]} are invalid.`, 'error');
        if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = originalBtnText; }
        return;
      }
      availability[i] = { start: start, end: end };
    } else {
      availability[i] = null;
    }
  }

  const existingEmp = id ? state.employees.find(e => e.id === id) : null;
  const employeeData = {
    name,
    role,
    email,
    phone,
    hourlyRate,
    maxHours,
    awardLevel,
    employmentType,
    dob: dob,
    certificates: window.currentEditingCertificates || [],
    availability,
    active: existingEmp ? existingEmp.active : true
  };

  try {
    if (id) {
      employeeData.id = id;
      await BriskDB.updateEmployee(employeeData);
      if (typeof BriskDB.logAudit === 'function') {
        BriskDB.logAudit('EMPLOYEE_UPDATE', `Updated staff profile for ${name} (${role}, Rate: $${hourlyRate.toFixed(2)}/h, ${employmentType})`, id);
      }
      showToast('Employee updated successfully.', 'success');
    } else {
      const added = await BriskDB.addEmployee(employeeData);
      if (typeof BriskDB.logAudit === 'function') {
        BriskDB.logAudit('EMPLOYEE_CREATE', `Created staff profile for ${name} (${role}, Rate: $${hourlyRate.toFixed(2)}/h, ${employmentType})`, added ? added.id : null);
      }
      showToast('Employee added successfully.', 'success');
    }
    closeEmployeeModal();
    loadDataFromState();
    renderEmployeesList();
    renderScheduler();
    calculateLaborCostForecast();
  } catch (err) {
    showToast('Failed to save employee.', 'error');
  } finally {
    if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = originalBtnText; }
  }
}

async function handleEmployeeDelete() {
  const id = document.getElementById('employee-id').value;
  if (id && confirm('Delete this employee permanently? Future shifts will be unassigned.')) {
    try {
      const todayStr = formatDateISO(new Date());
      const empShifts = state.shifts.filter(s => s.employeeId === id && s.date >= todayStr).map(s => ({ ...s, employeeId: null }));
      await BriskDB.batchUpdateShifts(empShifts);
      await BriskDB.deleteEmployee(id);
      if (typeof BriskDB.logAudit === 'function') {
        BriskDB.logAudit('EMPLOYEE_DELETE', `Deleted staff profile #${id}`, id);
      }
      closeEmployeeModal();
      renderActivePanel();
    } catch (error) {
      console.error('Failed to delete employee:', error);
      showToast('Failed to delete employee: ' + error.message, 'error');
    }
  }
}


/* ==========================================================================
   PANEL: TIME CLOCK (출퇴근기록)
   ========================================================================== */

function renderTimeClockPanel() {
  const select = document.getElementById('clock-emp-select');
  select.innerHTML = '';
  
  if (!hasManagerPermissions(state.currentUser)) {
    if (!state.currentUser || !state.currentUser.employeeId) {
      select.innerHTML = '<option>Profile not found</option>';
      return;
    }
    // Only add self
    const opt = document.createElement('option');
    opt.value = state.currentUser.employeeId;
    opt.textContent = state.currentUser.name || 'Current User';
    opt.selected = true;
    select.appendChild(opt);
  } else {
    // Add all active employees
    state.employees.filter(e => e.active).forEach(emp => {
      const opt = document.createElement('option');
      opt.value = emp.id;
      opt.textContent = `${emp.name} (${emp.role})`;
      if (state.currentUser && emp.id === state.currentUser.employeeId) opt.selected = true;
      select.appendChild(opt);
    });
  }



  updateTerminalStatus();
  renderAdminTimesheets();
}

function updateTerminalStatus() {
  const empId = document.getElementById('clock-emp-select').value;
  if (!empId) return;

  const todayStr = formatDateISO(new Date());
  
  // Fetch timecards for employee
  const empTcs = state.timecards.filter(t => t.employeeId === empId);
  empTcs.sort((a, b) => new Date(b.clockIn || b.date) - new Date(a.clockIn || a.date));
  
  // Find the most recent active (no clockOut) or today's timecard
  let tc = empTcs.find(t => !t.clockOut) || empTcs.find(t => t.date === todayStr);

  const dot = document.getElementById('terminal-status-dot');
  const txt = document.getElementById('terminal-status-text');
  const sub = document.getElementById('terminal-sub-status');

  const btnIn = document.getElementById('btn-clock-in');
  const btnOut = document.getElementById('btn-clock-out');
  const btnStartLunch = document.getElementById('btn-start-lunch');
  const btnStartPaid = document.getElementById('btn-start-paid-break');
  const btnBEnd = document.getElementById('btn-end-break');

  if (btnIn) btnIn.disabled = false;
  if (btnOut) btnOut.disabled = false;
  if (btnStartLunch) btnStartLunch.disabled = false;
  if (btnStartPaid) btnStartPaid.disabled = false;
  if (btnBEnd) btnBEnd.disabled = false;

  if (!tc) {
    dot.className = 'status-indicator status-offline';
    txt.textContent = 'Not Clocked In';
    sub.textContent = 'No stamps recorded today.';

    if (btnOut) btnOut.disabled = true;
    if (btnStartLunch) btnStartLunch.disabled = true;
    if (btnStartPaid) btnStartPaid.disabled = true;
    if (btnBEnd) btnBEnd.disabled = true;
  } else {
    const formatTime = (isoStr) => {
      const d = new Date(isoStr);
      if (isNaN(d.getTime())) return formatTimeAmPm(isoStr);
      return formatTimeAmPm(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`);
    };

    if (tc.clockOut) {
      dot.className = 'status-indicator status-offline';
      txt.textContent = 'Clocked Out';
      sub.textContent = `Completed today (In: ${formatTime(tc.clockIn)} ~ Out: ${formatTime(tc.clockOut)})`;

      if (btnIn) btnIn.disabled = true;
      if (btnOut) btnOut.disabled = true;
      if (btnStartLunch) btnStartLunch.disabled = true;
      if (btnStartPaid) btnStartPaid.disabled = true;
      if (btnBEnd) btnBEnd.disabled = true;
    } else {
      const lastBreak = tc.breaks && tc.breaks.length > 0 ? tc.breaks[tc.breaks.length - 1] : null;
      const onBreak = lastBreak && lastBreak.start && !lastBreak.end;

      if (onBreak) {
        const isPaidRest = lastBreak.type === 'paid_rest';
        dot.className = 'status-indicator status-break';
        txt.textContent = isPaidRest ? 'On 10m Paid Rest Break' : 'On 30m Unpaid Lunch Break';
        sub.textContent = `Break began at: ${formatTime(lastBreak.start)}`;

        if (btnIn) btnIn.disabled = true;
        if (btnOut) btnOut.disabled = true;
        if (btnStartLunch) btnStartLunch.disabled = true;
        if (btnStartPaid) btnStartPaid.disabled = true;
      } else {
        dot.className = 'status-indicator status-online';
        txt.textContent = 'Working (Clocked In)';
        sub.textContent = `Clocked in at: ${formatTime(tc.clockIn)}`;

        if (btnIn) btnIn.disabled = true;
        if (btnBEnd) btnBEnd.disabled = true;
      }
    }
  }
}

async function handleClockAction(action) {
  const isManager = hasManagerPermissions(state.currentUser);
  const empId = isManager
    ? document.getElementById('clock-emp-select').value
    : (state.currentUser?.employeeId || state.currentUser?.id);

  if (!empId) {
    showToast('Employee profile not identified for timeclock.', 'error');
    return;
  }

  // Disable all clock buttons immediately to prevent double-tap
  const btns = ['btn-clock-in','btn-clock-out','btn-start-lunch','btn-start-paid-break','btn-end-break'];
  btns.forEach(id => { const el = document.getElementById(id); if (el) el.disabled = true; });

  const todayStr = formatDateISO(new Date());
  const nowISO = new Date().toISOString();

  // Fetch timecards for employee
  const empTcs = BriskDB.getTimecards().filter(t => t.employeeId === empId);
  empTcs.sort((a, b) => new Date(b.clockIn || b.date) - new Date(a.clockIn || a.date));
  
  // Find the most recent active timecard (no clockOut)
  let tc = empTcs.find(t => !t.clockOut);

  // Auto-clock-out failsafe (cap at 14 hours) for abandoned timecards before starting a new action
  if (tc && !tc.clockOut) {
    const elapsedMs = new Date(nowISO).getTime() - new Date(tc.clockIn).getTime();
    if (elapsedMs > 14 * 60 * 60 * 1000) {
      // Auto-close it
      tc.clockOut = new Date(new Date(tc.clockIn).getTime() + 14 * 60 * 60 * 1000).toISOString();
      tc.totalHours = calculateTimecardHours(tc);
      await BriskDB.updateTimecard(tc);
      tc = null; // Reset to null so they can clock in again
    }
  }


  try {
    if (action === 'in') {
      if (tc) {
        showToast('Already clocked in.', 'warning');
        return;
      }

      tc = {
        employeeId: empId,
        date: todayStr,
        clockIn: nowISO,
        clockOut: null,
        breaks: [],
        totalHours: 0,
        approved: false,
        approvedBy: ''
      };
      await BriskDB.addTimecard(tc);
      showToast('Clocked in successfully!', 'success');

    } else if (action === 'out') {
      if (!tc || tc.clockOut) {
        showToast('No active clock-in session found to clock out.', 'warning');
        return;
      }
      const lastBreak = tc.breaks && tc.breaks.length > 0 ? tc.breaks[tc.breaks.length - 1] : null;
      if (lastBreak && !lastBreak.end) lastBreak.end = nowISO;
      tc.clockOut = nowISO;
      tc.totalHours = calculateTimecardHours(tc);
      await BriskDB.updateTimecard(tc);
      showToast('Clocked out successfully!', 'success');

    } else if (action === 'break-start' || action === 'break-start-lunch' || action === 'break-start-paid') {
      if (!tc || tc.clockOut) return;
      if (!tc.breaks) tc.breaks = [];
      const breakType = action === 'break-start-paid' ? 'paid_rest' : 'unpaid_lunch';
      tc.breaks.push({ start: nowISO, end: null, type: breakType });
      await BriskDB.updateTimecard(tc);
      showToast(action === 'break-start-paid' ? 'Paid 10-min rest break started.' : '30-min unpaid meal break started.', 'info');

    } else if (action === 'break-end') {
      if (!tc || tc.clockOut) return;
      const lastBreak = tc.breaks && tc.breaks.length > 0 ? tc.breaks[tc.breaks.length - 1] : null;
      if (lastBreak && !lastBreak.end) lastBreak.end = nowISO;
      tc.totalHours = calculateTimecardHours(tc);
      await BriskDB.updateTimecard(tc);
      showToast('Break ended.', 'info');
    }
  } catch (err) {
    showToast('Clock action failed: ' + err.message, 'error');
  }

  // Refresh UI immediately from live BriskDB data
  loadDataFromState();
  updateTerminalStatus();
  renderAdminTimesheets();
  renderActivePanel();
}

function calculateTimecardHours(tc) {
  if (!tc.clockIn || !tc.clockOut) return 0;

  let start = new Date(tc.clockIn);
  let end = new Date(tc.clockOut);

  // If time-only string (e.g. "09:00"), prepend date
  if (isNaN(start.getTime()) && tc.date) {
    start = new Date(`${tc.date}T${tc.clockIn}`);
  }
  if (isNaN(end.getTime()) && tc.date) {
    end = new Date(`${tc.date}T${tc.clockOut}`);
  }
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0;

  let diffMs = end.getTime() - start.getTime();
  if (diffMs < 0) diffMs += (24 * 60 * 60 * 1000); // Midnight crossing protection

  let unpaidBreakMs = 0;
  if (tc.breaks && Array.isArray(tc.breaks)) {
    tc.breaks.forEach(b => {
      // ONLY deduct unpaid breaks (unpaid_lunch / meal breaks). Paid rest breaks (10m) are paid by law!
      if (b.start && b.end && b.type !== 'paid_rest') {
        let bStart = new Date(b.start);
        let bEnd = new Date(b.end);
        if (isNaN(bStart.getTime()) && tc.date) bStart = new Date(`${tc.date}T${b.start}`);
        if (isNaN(bEnd.getTime()) && tc.date) bEnd = new Date(`${tc.date}T${b.end}`);
        if (!isNaN(bStart.getTime()) && !isNaN(bEnd.getTime())) {
          unpaidBreakMs += Math.max(0, bEnd.getTime() - bStart.getTime());
        }
      }
    });
  }

  const netHours = (diffMs - unpaidBreakMs) / (1000 * 60 * 60);
  return Math.max(0, parseFloat(netHours.toFixed(2)));
}

function renderAdminTimesheets() {
  const tbody = document.getElementById('timesheet-table-body');
  tbody.innerHTML = '';

  const mon = new Date(state.currentWeekStart);
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  mon.setHours(0,0,0,0);
  sun.setHours(23,59,59,999);

  let weekCards = state.timecards.filter(tc => {
    const tcDate = new Date(tc.date);
    tcDate.setHours(0,0,0,0);
    return tcDate >= mon && tcDate <= sun;
  });

  if (!hasManagerPermissions(state.currentUser)) {
    // Employees can't see the admin panel list at all (handled in applyRoleAccessControl)
    return;
  }

  if (weekCards.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="padding: 0;"><div class="empty-state"><i class="fa-solid fa-clock-rotate-left"></i><h4>No timesheets recorded</h4><p>No clock-in data found for this week.</p></div></td></tr>`;
    return;
  }

  weekCards.sort((a,b) => b.date.localeCompare(a.date));

  weekCards.forEach(tc => {
    const emp = state.employees.find(e => e.id === tc.employeeId);
    const empName = emp ? emp.name : 'Unknown';

    const formatTimeHM = (isoStr) => {
      if (!isoStr) return '-';
      const d = new Date(isoStr);
      if (isNaN(d.getTime())) return formatTimeAmPm(isoStr);
      return formatTimeAmPm(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`);
    };

    let statusHtml = '';
    let actionHtml = '';

    if (tc.approved) {
      statusHtml = `<span class="badge badge-success"><i class="fa-solid fa-lock"></i> Approved</span>`;
      actionHtml = `
        <div class="action-group">
          <button class="btn btn-outline" style="padding: 4px 8px; font-size:11px; color:#f87171; border-color:rgba(239,68,68,0.4);" onclick="unapproveTimecard('${tc.id}')" title="Unlock timecard to allow adjustments">
            <i class="fa-solid fa-lock-open"></i> Unlock
          </button>
        </div>
      `;
    } else {
      statusHtml = `<span class="badge badge-warning"><i class="fa-solid fa-clock"></i> Pending</span>`;
      actionHtml = `
        <div class="action-group">
          <button class="btn btn-primary" style="padding: 4px 8px; font-size:11px;" onclick="approveTimecard('${tc.id}')">
            Approve
          </button>
          <button class="btn btn-outline" style="padding: 4px 8px; font-size:11px;" onclick="openTimecardEditModal('${tc.id}')">Edit</button>
        </div>
      `;
    }

    const empTimecardsForWeek = weekCards.filter(c => c.employeeId === emp.id);
    const empActualWeekHours = empTimecardsForWeek.reduce((sum, c) => sum + c.totalHours, 0);
    const otBadge = (empActualWeekHours > emp.maxHours) ? ' <span class="badge badge-danger">OT Exceeded</span>' : '';

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${tc.date}</td>
      <td><strong>${empName}</strong></td>
      <td>${formatTimeHM(tc.clockIn)}</td>
      <td>${formatTimeHM(tc.clockOut)}</td>
      <td>
        <div style="font-weight: 500;">Total: ${tc.totalHours.toFixed(1)}h${otBadge}${tc.totalHours >= 14 || (!tc.clockOut && tc.totalHours === 0) ? ' <span class="badge badge-danger" style="font-size:10px; margin-left:4px;" title="Abnormal duration or missing clock-out. Please review before approving."><i class="fa-solid fa-triangle-exclamation"></i> Review Hours</span>' : ''}
        ${!tc.approved ? `<button class="btn btn-icon" onclick="openTimecardEditModal('${tc.id}')" style="padding: 2px 6px; margin-left: 8px;"><i class="fa-solid fa-pen"></i></button>` : ''}
        </div>
      </td>
      <td>${statusHtml}</td>
      <td>${actionHtml}</td>
    `;
    tbody.appendChild(tr);
  });
}

function checkConsecutiveDaysWorked(employeeId, targetDateStr, excludeShiftId) {
  if (!employeeId || !targetDateStr) return { exceeded: false, count: 1 };
  
  const getOffsetDateStr = (dStr, offset) => {
    const [y, m, d] = dStr.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d + offset));
    return dt.toISOString().split('T')[0];
  };

  const otherShifts = state.shifts.filter(s => s.employeeId === employeeId && s.id !== excludeShiftId);
  const workedDates = new Set(otherShifts.map(s => s.date));
  
  let backwardCount = 0;
  for (let b = 1; b <= 7; b++) {
    const prevD = getOffsetDateStr(targetDateStr, -b);
    if (workedDates.has(prevD)) backwardCount++;
    else break;
  }

  let forwardCount = 0;
  for (let f = 1; f <= 7; f++) {
    const nextD = getOffsetDateStr(targetDateStr, f);
    if (workedDates.has(nextD)) forwardCount++;
    else break;
  }

  const totalConsecutive = backwardCount + 1 + forwardCount;
  return {
    exceeded: totalConsecutive > 6,
    count: totalConsecutive
  };
}

async function approveTimecard(tcId) {
  const isManagerOrOwner = hasManagerPermissions(state.currentUser);
  if (!isManagerOrOwner) {
    showToast('Permission denied: Only managers can approve timecards.', 'error');
    return;
  }
  const tc = state.timecards.find(t => t.id === tcId);
  if (!tc) return;

  tc.approved = true;
  tc.approvedBy = state.currentUser.name;
  
  await BriskDB.updateTimecard(tc);
  const tcEmp = state.employees.find(e => e.id === tc.employeeId);
  if (typeof BriskDB.logAudit === 'function') {
    BriskDB.logAudit('TIMECARD_APPROVE', `Approved & locked timecard for ${tcEmp ? tcEmp.name : tc.employeeId} on ${tc.date} (${tc.totalHours}h)`, tc.id);
  }
  loadDataFromState();
  renderAdminTimesheets();
  showToast('Timecard approved and locked for payroll.', 'success');
}

async function unapproveTimecard(tcId) {
  const isManagerOrOwner = hasManagerPermissions(state.currentUser);
  if (!isManagerOrOwner) {
    showToast('Only managers can unlock approved timecards.', 'error');
    return;
  }
  const tc = state.timecards.find(t => t.id === tcId);
  if (!tc) return;
  
  if (!confirm('Unlock this approved timecard to allow editing?')) return;
  
  tc.approved = false;
  tc.approvedBy = null;
  await BriskDB.updateTimecard(tc);
  const tcEmp = state.employees.find(e => e.id === tc.employeeId);
  if (typeof BriskDB.logAudit === 'function') {
    BriskDB.logAudit('TIMECARD_UNLOCK', `Unlocked approved timecard for ${tcEmp ? tcEmp.name : tc.employeeId} on ${tc.date}`, tc.id);
  }
  loadDataFromState();
  renderAdminTimesheets();
  showToast('Timecard unlocked for editing.', 'info');
}

function openTimecardEditModal(tcId) {
  if (!hasManagerPermissions(state.currentUser)) {
    showToast('Permission denied: Only managers can edit timesheet records.', 'warning');
    return;
  }
  const tc = state.timecards.find(t => t.id === tcId);
  if (!tc) return;

  document.getElementById('timecard-edit-id').value = tc.id;
  
  // Format for datetime-local: YYYY-MM-DDThh:mm
  const formatForInput = (isoString) => {
    if (!isoString) return '';
    const d = new Date(isoString);
    if (isNaN(d)) return '';
    // Use local time for datetime-local input
    const tzoffset = d.getTimezoneOffset() * 60000;
    const localISOTime = (new Date(d.getTime() - tzoffset)).toISOString().slice(0, 16);
    return localISOTime;
  };

  document.getElementById('timecard-edit-in').value = formatForInput(tc.clockIn);
  document.getElementById('timecard-edit-out').value = formatForInput(tc.clockOut);
  
  document.getElementById('modal-timecard-edit').classList.add('active');
}

function closeTimecardEditModal() {
  window.closeModal(document.getElementById('modal-timecard-edit'));
  renderReportsPanel();
}

async function saveTimecardEdit() {
  if (!hasManagerPermissions(state.currentUser)) {
    showToast('Permission denied: Only managers can edit timesheets.', 'error');
    return;
  }
  const tcId = document.getElementById('timecard-edit-id').value;
  const inVal = document.getElementById('timecard-edit-in').value;
  const outVal = document.getElementById('timecard-edit-out').value;
  
  const tc = state.timecards.find(t => t.id === tcId);
  if (!tc) return;
  
  if (!tc.originalClockIn) tc.originalClockIn = tc.clockIn;
    if (!tc.originalClockOut) tc.originalClockOut = tc.clockOut;
    if (inVal) tc.clockIn = new Date(inVal).toISOString();
  if (outVal) tc.clockOut = new Date(outVal).toISOString();
  
  if (tc.breaks && tc.breaks.length > 0) {
    const shiftStart = new Date(tc.clockIn).getTime();
    const shiftEnd = tc.clockOut ? new Date(tc.clockOut).getTime() : Infinity;
    tc.breaks = tc.breaks.filter(b => {
      const bStart = new Date(b.start).getTime();
      const bEnd = b.end ? new Date(b.end).getTime() : Infinity;
      return bStart < shiftEnd && bEnd > shiftStart;
    });
  }
  
  tc.totalHours = calculateTimecardHours(tc);
  tc.approved = false;
  tc.approvedBy = null;
  
  try {
    await BriskDB.updateTimecard(tc);
    showToast('Timecard updated', 'success');
    closeTimecardEditModal();
    loadDataFromState();
    renderAdminTimesheets();
    renderActivePanel();
  } catch (err) {
    showToast('Failed to update timecard', 'error');
  }
}

window.openTimecardEditModal = openTimecardEditModal;
window.closeTimecardEditModal = closeTimecardEditModal;
window.saveTimecardEdit = saveTimecardEdit;


/* ==========================================================================
   PANEL: TIME OFF REQUESTS
   ========================================================================== */

function renderTimeOffPanel() {
  const tbody = document.getElementById('leave-table-body');
  tbody.innerHTML = '';

  const todayISO = formatDateISO(new Date());
  const startDateInput = document.getElementById('leave-start-date');
  const endDateInput = document.getElementById('leave-end-date');
  if (startDateInput) startDateInput.setAttribute('min', todayISO);
  if (endDateInput) endDateInput.setAttribute('min', todayISO);

  const isManager = hasManagerPermissions(state.currentUser);
  const myEmpId = state.currentUser?.employeeId || state.currentUser?.id;

  const leaveSelect = document.getElementById('leave-emp-select');
  const leaveSelectorGroup = document.getElementById('leave-employee-selector-group');
  if (leaveSelect) {
    if (isManager) {
      if (leaveSelectorGroup) leaveSelectorGroup.classList.remove('hide');
      leaveSelect.disabled = false;
      leaveSelect.innerHTML = '<option value="">Select Employee</option>' + 
        state.employees.map(e => `<option value="${e.id}">${e.name}</option>`).join('');
    } else {
      if (leaveSelectorGroup) leaveSelectorGroup.classList.add('hide');
      leaveSelect.disabled = true;
      const myEmp = state.employees.find(e => e.id === myEmpId);
      leaveSelect.innerHTML = myEmp 
        ? `<option value="${myEmp.id}">${myEmp.name}</option>`
        : `<option value="${myEmpId || ''}">My Profile</option>`;
      leaveSelect.value = myEmpId || '';
    }
  }

  // Employees only see their own leave requests; managers/owners see all
  let requests;
  if (isManager) {
    requests = [...state.leaveRequests];
  } else {
    requests = state.leaveRequests.filter(lr => lr.employeeId === myEmpId);
  }
  
  requests.sort((a,b) => {
    if (a.status === 'Pending' && b.status !== 'Pending') return -1;
    if (a.status !== 'Pending' && b.status === 'Pending') return 1;
    return b.startDate.localeCompare(a.startDate);
  });

  // Hide Decisions header column if employee
  const thDec = document.querySelector('.manager-action-th');
  if (thDec) {
    if (isManager) thDec.classList.remove('hide');
    else thDec.classList.add('hide');
  }

  if (requests.length === 0) {
    const emptyMsg = isManager ? 'There are no leave requests filed at this time.' : 'You have no leave requests. Submit one using the form above.';
    tbody.innerHTML = `<tr><td colspan="${isManager ? 5 : 4}" style="padding: 0;"><div class="empty-state"><i class="fa-solid fa-plane-slash"></i><h4>No leave requests</h4><p>${emptyMsg}</p></div></td></tr>`;
    return;
  }

  requests.forEach(req => {
    const emp = state.employees.find(e => e.id === req.employeeId);
    const empName = emp ? emp.name : 'Unknown';

    let statusBadge = '';
    let actionsHtml = '';

    if (req.status === 'Pending') {
      statusBadge = '<span class="badge badge-warning" style="font-weight:700;">PENDING</span>';
      actionsHtml = `
        <div class="action-group" style="display:flex; gap:6px; flex-wrap:wrap;">
          <button class="btn btn-success" style="padding: 6px 12px; font-size:12px; font-weight:700; border-radius:6px; display:inline-flex; align-items:center; gap:4px;" onclick="decideLeaveRequest('${req.id}', 'Approved')"><i class="fa-solid fa-check"></i> Approve</button>
          <button class="btn btn-danger" style="padding: 6px 12px; font-size:12px; font-weight:700; border-radius:6px; display:inline-flex; align-items:center; gap:4px;" onclick="decideLeaveRequest('${req.id}', 'Rejected')"><i class="fa-solid fa-xmark"></i> Reject</button>
        </div>
      `;
    } else if (req.status === 'Approved') {
      statusBadge = '<span class="badge badge-success" style="font-weight:700;">APPROVED</span>';
      actionsHtml = `<button class="btn btn-outline" style="padding: 5px 10px; font-size:11px; border-radius:6px; display:inline-flex; align-items:center; gap:4px;" onclick="decideLeaveRequest('${req.id}', 'Pending')"><i class="fa-solid fa-rotate-left"></i> Set Pending</button>`;
    } else {
      statusBadge = '<span class="badge badge-danger" style="font-weight:700;">REJECTED</span>';
      actionsHtml = `<button class="btn btn-outline" style="padding: 5px 10px; font-size:11px; border-radius:6px; display:inline-flex; align-items:center; gap:4px;" onclick="decideLeaveRequest('${req.id}', 'Pending')"><i class="fa-solid fa-rotate-left"></i> Set Pending</button>`;
    }

    const certBadge = req.medicalCertSighted ? `<span class="badge" style="background:rgba(16,185,129,0.12); color:#10b981; border:1px solid rgba(16,185,129,0.3); font-size:10px; margin-top:4px; display:inline-flex; align-items:center; gap:4px;"><i class="fa-solid fa-file-medical"></i> Cert Sighted</span>` : '';

    const tr = document.createElement('tr');
    tr.className = 'leave-request-row';
    tr.innerHTML = `
      <td data-label="Staff Name"><strong style="color:var(--text-primary); font-size:0.95rem;">${empName}</strong></td>
      <td data-label="Period"><span style="color:var(--accent-gold); font-weight:600;">${req.startDate} ~ ${req.endDate}</span></td>
      <td data-label="Reason" style="max-width: 260px; overflow: hidden; text-overflow: ellipsis; white-space: normal;">
        <div style="font-size:0.88rem; color:var(--text-secondary);">${req.reason || 'No reason provided'}</div>
        ${certBadge}
      </td>
      <td data-label="Status">${statusBadge}</td>
      ${isManager ? `<td data-label="Action" class="leave-actions-cell">${actionsHtml}</td>` : ''}
    `;
    tbody.appendChild(tr);
  });
}

async function handleLeaveSubmit(event) {
  event.preventDefault();

  // If employee role, automatically set empId to current user employeeId
  const isManager = hasManagerPermissions(state.currentUser);
  const myEmpId = state.currentUser?.employeeId || state.currentUser?.id;
  const empId = isManager ? document.getElementById('leave-emp-select').value : myEmpId;
  if (!empId) {
    showToast('Employee profile not identified for leave request.', 'error');
    return;
  }
  const start = document.getElementById('leave-start-date').value;
  const end = document.getElementById('leave-end-date').value;
  const reason = document.getElementById('leave-reason').value;
  const medCertSighted = document.getElementById('leave-med-cert') ? document.getElementById('leave-med-cert').checked : false;

  if (start > end) {
    showToast('End date cannot be earlier than start date.', 'error');
    return;
  }

  const todayStr = formatDateISO(new Date());
  if (start < todayStr) {
    showToast('Start date cannot be in the past.', 'error');
    return;
  }

  // Conflict validation: Prevent leave requests on days where the employee is already scheduled to work
  const hasConflictingShifts = state.shifts.some(s => {
    if (s.employeeId !== empId) return false;
    return s.date >= start && s.date <= end;
  });

  if (hasConflictingShifts) {
    const proceed = confirm('⚠️ Warning: You have scheduled shifts within this date range.\n\nSubmit leave request anyway? The manager can reassign affected shifts later.');
    if (!proceed) return;
  }

  const req = {
    employeeId: empId,
    startDate: start,
    endDate: end,
    reason: reason,
    medicalCertSighted: !!medCertSighted
  };

  try {
    const addedReq = await BriskDB.addLeaveRequest(req);
    const targetEmp = state.employees.find(e => e.id === empId);
    if (typeof BriskDB.logAudit === 'function') {
      BriskDB.logAudit('LEAVE_REQUEST', `Submitted leave for ${targetEmp ? targetEmp.name : empId} (${start} ~ ${end}, Reason: ${reason}, Med Cert: ${medCertSighted ? 'Yes' : 'No'})`, addedReq ? addedReq.id : null);
    }
    showToast('Leave request submitted successfully!', 'success');
    document.getElementById('leave-request-form').reset();
    
    // Auto-close the timeoff modal
    const modal = document.getElementById('modal-timeoff');
    if (modal) modal.classList.remove('active');

    loadDataFromState();
    renderTimeOffPanel();
    renderActivePanel();

    // Trigger instant background sync to ensure instant multi-client parity
    BriskDB.syncFromServer()
      .then(() => {
        loadDataFromState();
        renderTimeOffPanel();
        renderActivePanel();
      })
      .catch(e => console.warn('Background sync after submitting leave failed:', e));
  } catch (err) {
    showToast('Failed to submit leave request: ' + err.message, 'error');
  }
}

async function decideLeaveRequest(reqId, decision) {
  const isManagerOrOwner = hasManagerPermissions(state.currentUser);
  if (!isManagerOrOwner) {
    showToast('Permission denied: Only managers can approve or reject leave requests.', 'error');
    return;
  }
  const req = state.leaveRequests.find(r => r.id === reqId);
  if (!req) return;

  try {
    req.status = decision;
    await BriskDB.updateLeaveRequest(req);
    const reqEmp = state.employees.find(e => e.id === req.employeeId);
    const empDisplayName = reqEmp ? reqEmp.name : 'Employee';

    if (typeof BriskDB.logAudit === 'function') {
      BriskDB.logAudit('LEAVE_DECIDE', `Leave request for ${empDisplayName} (${req.startDate} ~ ${req.endDate}) set to '${decision}'`, req.id);
    }

    if (decision === 'Approved') {
      showToast(`Leave request for ${empDisplayName} approved!`, 'success');
      const start = new Date(req.startDate + 'T00:00:00');
      const end = new Date(req.endDate + 'T00:00:00');
      start.setHours(0,0,0,0);
      end.setHours(23,59,59,999);

      const conflictingShifts = state.shifts.filter(s => {
        if (s.employeeId !== req.employeeId) return false;
        const sDate = new Date(s.date + 'T00:00:00');
        sDate.setHours(0,0,0,0);
        return sDate >= start && sDate <= end;
      });

      if (conflictingShifts.length > 0) {
        try {
          const updatedShifts = conflictingShifts.map(s => ({ ...s, employeeId: null }));
          await BriskDB.batchUpdateShifts(updatedShifts);
          
          // Partial auto-schedule to fill the gaps using the leave's week
          const targetWeekStart = getMondayOfCurrentWeek(new Date(req.startDate + 'T00:00:00'));
          const targetWeekStr = formatDateISO(targetWeekStart);
          // Refresh state.shifts to reflect the unassignments locally before running scheduler
          state.shifts = state.shifts.map(s => {
            if (updatedShifts.find(us => us.id === s.id)) return { ...s, employeeId: null };
            return s;
          });
          const result = BriskScheduler.run(state.shifts, state.employees, state.leaveRequests, targetWeekStr, state.timecards, false);
          
          if (result.success && result.assignedCount > 0) {
            const reAssignedShifts = result.shifts.filter(s => updatedShifts.find(us => us.id === s.id && s.employeeId !== null));
            if (reAssignedShifts.length > 0) {
               await BriskDB.batchUpdateShifts(reAssignedShifts);
               showToast(`Automatically unassigned ${updatedShifts.length} conflicting shifts.\nAuto-scheduler backfilled ${reAssignedShifts.length} shifts!`, 'success');
            }
          } else {
            showToast(`Unassigned ${updatedShifts.length} conflicting shifts for ${empDisplayName}.`, 'info');
          }
        } catch(err) {
          console.error('Failed to unassign conflicting shifts:', err);
        }
      }
    } else if (decision === 'Rejected') {
      showToast(`Leave request for ${empDisplayName} rejected.`, 'info');
    } else {
      showToast(`Leave request for ${empDisplayName} set to pending.`, 'info');
    }

    loadDataFromState();
    renderTimeOffPanel();

    // Trigger instant background sync to match server state parity
    BriskDB.syncFromServer()
      .then(() => {
        loadDataFromState();
        renderTimeOffPanel();
      })
      .catch(e => console.warn('Background sync after decide leave failed:', e));
  } catch (err) {
    console.error('Failed to decide leave request:', err);
    showToast('Failed to update leave status: ' + (err.message || err), 'error');
  }
}


/* ==========================================================================
   PANEL: REPORTS & PAYROLL (Roster Emailing Trigger)
   ========================================================================== */

function renderReportsPanel() {
  if (!hasManagerPermissions(state.currentUser)) {
    const tbody = document.getElementById('report-table-body');
    if (tbody) tbody.innerHTML = `<tr><td colspan="8" class="text-center text-muted" style="padding: 2rem;">🔒 Access Denied: Payroll & Financial Reports are restricted to Managers and Owners only.</td></tr>`;
    return;
  }

  document.getElementById('report-week-range').textContent = getWeekRangeText(state.currentWeekStart);
  
  const printDatesText = `Period: ${formatDateISO(state.currentWeekStart)} ~ ${formatDateISO(new Date(state.currentWeekStart.getTime() + 6 * 24 * 60 * 60 * 1000))}`;
  document.getElementById('report-print-dates').textContent = printDatesText;

  const tbody = document.getElementById('report-table-body');
  tbody.innerHTML = '';

  const mon = new Date(state.currentWeekStart);
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  mon.setHours(0,0,0,0);
  sun.setHours(23,59,59,999);

  let totalSchedHoursSum = 0;
  let totalActualHoursSum = 0;
  let totalActualCostSum = 0;
  let totalSuperCostSum = 0;
  let totalLoadedCostSum = 0;

  const activeEmployees = state.employees.filter(e => e.active);

  activeEmployees.forEach(emp => {
    const empWeekHours = calculateEmployeeWeekHours(emp.id, state.currentWeekStart);

    const empTimecards = state.timecards.filter(tc => {
      if (tc.employeeId !== emp.id) return false;
      const tcDate = new Date(tc.date + 'T00:00:00');
      tcDate.setHours(0,0,0,0);
      return tcDate >= mon && tcDate <= sun && tc.approved;
    });

    let actualHours = 0;
    let grossPay = 0;
    let superCost = 0;
    let loadedCost = 0;
    const hourlyRate = emp.hourlyRate || 0;
    const isLocum = emp.employmentType && emp.employmentType.startsWith('locum');

    empTimecards.forEach(tc => {
      actualHours += tc.totalHours;
      const breakdown = window.getEmployeeLaborCostBreakdown(emp, tc.date, tc.totalHours, null, tc.clockIn, tc.clockOut);
      grossPay += breakdown.base;
      superCost += breakdown.super;
      loadedCost += breakdown.total;
      totalSuperCostSum += breakdown.super;
      totalLoadedCostSum += breakdown.total;
    });

    totalSchedHoursSum += empWeekHours;
    totalActualHoursSum += actualHours;
    totalActualCostSum += grossPay;

    const otBadge = (actualHours > (emp.maxHours || 38) + 0.001) ? ' <span class="badge badge-danger">OT Exceeded</span>' : '';

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>
        <strong>${emp.name}</strong> <span class="text-muted" style="font-size:11px;">(${emp.role})</span>
        ${isLocum ? '<span class="badge" style="font-size:9px; margin-left:4px; background:rgba(168,85,247,0.15); color:#c084fc; border:1px solid rgba(168,85,247,0.3);">Locum Contractor</span>' : '<span class="badge" style="font-size:9px; margin-left:4px; background:rgba(16,185,129,0.1); color:#10b981;">PAYG</span>'}
      </td>
      <td class="text-right">$${hourlyRate.toFixed(2)}</td>
      <td class="text-right">${empWeekHours.toFixed(1)}h</td>
      <td class="text-right">${actualHours.toFixed(1)}h${otBadge}</td>
      <td class="text-right text-neon">$${grossPay.toFixed(2)}</td>
      <td class="text-right" style="color: #10b981;">$${superCost.toFixed(2)}</td>
      <td class="text-right" style="color: #a855f7; font-weight: 600;">$${loadedCost.toFixed(2)}</td>
      <td class="text-center print-hide">
        <div style="display:flex; justify-content:center; gap:4px; flex-wrap:wrap;">
          <button class="btn btn-outline" style="padding:4px 8px; font-size:11px;" onclick="openEmailRosterModal('${emp.id}')" ${empWeekHours === 0 ? 'disabled' : ''}>
            <i class="fa-solid fa-envelope"></i> Email
          </button>
          ${isLocum ? `
          <button class="btn btn-outline" style="padding:4px 8px; font-size:11px; color:#c084fc; border-color:rgba(168,85,247,0.4);" onclick="openLocumRemittanceModal('${emp.id}')" title="Generate Locum Contractor Remittance Slip">
            <i class="fa-solid fa-file-invoice-dollar"></i> Remittance
          </button>
          ` : ''}
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });

  document.getElementById('rep-total-sched-hours').textContent = `${totalSchedHoursSum.toFixed(1)}h`;
  document.getElementById('rep-total-actual-hours').textContent = `${totalActualHoursSum.toFixed(1)}h`;
  document.getElementById('rep-total-actual-cost').textContent = `$${totalActualCostSum.toFixed(2)}`;
  const repSuperEl = document.getElementById('rep-total-super-cost');
  if (repSuperEl) repSuperEl.textContent = `$${totalSuperCostSum.toFixed(2)}`;
  const repLoadedEl = document.getElementById('rep-total-loaded-cost');
  if (repLoadedEl) repLoadedEl.textContent = `$${totalLoadedCostSum.toFixed(2)}`;
  
  // Sync Reports Sales & Wage Ratio summary card
  calculateLaborCostForecast();
}

// Gazetted NSW Public Holidays (Pharmacy Industry Award 2026 [MA000012] Clause 21)
function isNswPublicHoliday(dateStr) {
  if (!dateStr) return false;
  const parts = dateStr.split('-');
  if (parts.length !== 3) return false;
  const year = parseInt(parts[0], 10);
  const mmdd = `${parts[1]}-${parts[2]}`;

  const fixedHolidays = ['01-01', '01-26', '04-25', '12-25', '12-26'];
  if (fixedHolidays.includes(mmdd)) return true;

  const nswHolidays = {
    2026: [
      '2026-01-01', '2026-01-26', '2026-04-03', '2026-04-04', '2026-04-05', '2026-04-06',
      '2026-04-25', '2026-06-08', '2026-08-03', '2026-10-05', '2026-12-25', '2026-12-26', '2026-12-28'
    ],
    2027: [
      '2027-01-01', '2027-01-26', '2027-03-26', '2027-03-27', '2027-03-28', '2027-03-29',
      '2027-04-25', '2027-04-26', '2027-06-14', '2027-08-02', '2027-10-04', '2027-12-25', '2027-12-27', '2027-12-28'
    ]
  };

  return !!(nswHolidays[year] && nswHolidays[year].includes(dateStr));
}
window.isNswPublicHoliday = isNswPublicHoliday;

// Export approved weekly timesheets to Australian Xero / MYOB (STP Phase 2 Standard) CSV
function exportToXeroCsv() {
  const mon = new Date(state.currentWeekStart);
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  mon.setHours(0,0,0,0);
  sun.setHours(23,59,59,999);

  const activeEmployees = state.employees.filter(e => e.active);
  const rows = [
    ['Employee Name', 'Email', 'Position', 'Award Classification', 'Shift Date', 'Day', 'Pay Rate Category', 'Base Rate ($/h)', 'Approved Hours (h)', 'Penalty Multiplier', 'Gross Pay ($)', 'Superannuation 12% ($)', 'Timesheet Status']
  ];

  let totalExportedRecords = 0;

  activeEmployees.forEach(emp => {
    const empTimecards = state.timecards.filter(tc => {
      if (tc.employeeId !== emp.id) return false;
      const tcDate = new Date(tc.date + 'T00:00:00');
      tcDate.setHours(0,0,0,0);
      return tcDate >= mon && tcDate <= sun && tc.approved;
    });

    const hourlyRate = emp.hourlyRate || 0;
    const isLocum = emp.employmentType && emp.employmentType.startsWith('locum');

    empTimecards.forEach(tc => {
      const tcDate = new Date(tc.date + 'T00:00:00');
      const isPubHol = isNswPublicHoliday(tc.date);
      const dayIdx = tcDate.getDay();
      const isCasual = emp.employmentType === 'casual';
      let multiplier = 1.0;
      let payCategory = 'Ordinary Hours (1.0x)';

      if (isLocum) {
        payCategory = emp.employmentType === 'locum_all_inclusive' ? 'Locum Contractor (All-Inclusive Invoice)' : 'Locum Contractor Invoicing';
        multiplier = 1.0;
      } else if (isPubHol) {
        multiplier = isCasual ? 2.50 : 2.25;
        payCategory = `Public Holiday Loading (${multiplier}x)`;
      } else if (dayIdx === 0) {
        multiplier = isCasual ? 2.00 : 1.75;
        payCategory = `Sunday Penalty (${multiplier}x)`;
      } else if (dayIdx === 6) {
        multiplier = isCasual ? 1.50 : 1.25;
        payCategory = `Saturday Penalty (${multiplier}x)`;
      } else if (isCasual) {
        multiplier = 1.25;
        payCategory = 'Casual Loading (1.25x)';
      }
      
      // Calculate Overtime
      let cumulativeWeeklyHours = (empTimecards._cumul = (empTimecards._cumul || 0) + tc.totalHours);
      if (tc.totalHours > 12 || cumulativeWeeklyHours > 38) {
         multiplier = isCasual ? 2.25 : 2.00;
         payCategory = 'Overtime Penalty (' + multiplier + 'x)';
      }

      const gross = tc.totalHours * hourlyRate * multiplier;
      const superAmount = (emp.employmentType === 'locum_all_inclusive') ? 0 : (gross * 0.12);

      rows.push([
        `"${emp.name}"`,
        `"${emp.email || ''}"`,
        `"${emp.role || ''}"`,
        `"${emp.awardLevel || (isLocum ? 'Locum Contractor' : 'Standard Award')}"`,
        tc.date,
        DAY_NAMES[dayIdx],
        `"${payCategory}"`,
        hourlyRate.toFixed(2),
        tc.totalHours.toFixed(2),
        `${multiplier}x`,
        gross.toFixed(2),
        superAmount.toFixed(2),
        'Approved'
      ]);
      totalExportedRecords++;
    });
  });

  if (totalExportedRecords === 0) {
    showToast('No approved timecards found for this week to export.', 'warning');
    return;
  }

  const csvContent = rows.map(r => r.join(',')).join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Amcal_WoyWoy_STP2_Timesheet_${formatDateISO(state.currentWeekStart)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast(`Successfully exported ${totalExportedRecords} timesheet records to Xero / MYOB STP2 CSV!`, 'success');
}
window.exportToXeroCsv = exportToXeroCsv;

// Open specific staff member's roster email modal
function openEmailRosterModal(employeeId) {
  const emp = state.employees.find(e => e.id === employeeId);
  if (!emp) return;

  const mon = new Date(state.currentWeekStart);

  document.getElementById('email-roster-emp-id').value = employeeId;
  // BUG 3 FIX: Populate name AND email address so modal shows "sending it to Peter Kim (peter@example.com)"
  document.getElementById('email-roster-emp-name').textContent = emp.name || '(unknown)';
  const empEmailSpan = document.getElementById('email-roster-emp-email');
  if (empEmailSpan) {
    empEmailSpan.textContent = emp.email ? `(${emp.email})` : '(no email on record)';
  }

  let text = `Here is your roster for the week of ${getWeekRangeText(mon)}:\n\n`;

  for (let i = 0; i < 7; i++) {
    const d = new Date(mon);
    d.setDate(mon.getDate() + i);
    const dateStr = formatDateISO(d);
    
    const dayShifts = state.shifts.filter(s => s.employeeId === employeeId && s.date === dateStr);
    if (dayShifts.length > 0) {
      dayShifts.forEach(s => {
        text += `📅 [${DAY_NAMES[d.getDay()]}] ${dateStr}\n`;
        text += `   - Time: ${formatTimeAmPm(s.startTime)} ~ ${formatTimeAmPm(s.endTime)}\n`;
        text += `   - Role: ${s.role}\n`;
        if (s.notes) text += `   - Notes: ${s.notes}\n`;
        text += `\n`;
      });
    }
  }

  document.getElementById('email-roster-textarea').value = text;
  document.getElementById('modal-email-roster').classList.add('active');
}


function closeEmailRosterModal() {
  document.getElementById('modal-email-roster').classList.remove('active');
}

// Call backend API route to send SMTP email
async function sendRosterEmail() {
  const empId = document.getElementById('email-roster-emp-id').value;
  const text = document.getElementById('email-roster-textarea').value;
  const weekStart = formatDateISO(state.currentWeekStart);

  const btn = document.querySelector('#modal-email-roster .btn-neon');
  const originalText = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Sending...';

  try {
    const res = await BriskDB.apiSendRosterEmail(empId, weekStart, text);

    if (res.error) {
      showToast(`Error: ${res.error}`, 'error');
    } else {
      showToast(res.message, 'success');
      closeEmailRosterModal();
    }
  } catch (err) {
    showToast(`Unexpected error: ${err.message || err}`, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = originalText;
  }
}

async function publishSchedule() {
  const mon = new Date(state.currentWeekStart);
  let hasDrafts = false;
  let hasUnassigned = false;
  
  const updates = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(mon);
    d.setDate(mon.getDate() + i);
    const dateStr = formatDateISO(d);
    
    const dayShifts = state.shifts.filter(s => s.date === dateStr);
    dayShifts.forEach(s => {
      if (s.employeeId === null) {
        hasUnassigned = true;
      } else if (s.status !== 'published') {
        hasDrafts = true;
        updates.push({ ...s, status: 'published' });
      }
    });
  }

  if (!hasDrafts && !hasUnassigned) {
    showToast('All shifts this week are already published.', 'info');
    return;
  }
  
  if (hasUnassigned && !confirm('You have unassigned shifts. Publish the rest anyway?')) {
    return;
  }

  try {
    const btn = document.querySelector('button[onclick="publishSchedule()"]');
    const originalText = btn ? btn.innerHTML : 'Publish Schedule';
    if (btn) btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Publishing...';
    
    await BriskDB.batchUpdateShifts(updates);
    
    // Update local state shifts in-place
    updates.forEach(upShift => {
      const idx = state.shifts.findIndex(s => s.id === upShift.id);
      if (idx !== -1) state.shifts[idx].status = 'published';
    });

    renderScheduler();
    showToast('Schedule published and employees notified!', 'success');
    
    if (btn) btn.innerHTML = originalText;
  } catch (err) {
    console.error(err);
    showToast('Failed to publish schedule.', 'error');
  }
}

window.publishSchedule = publishSchedule;


/* ==========================================================================
   PANEL: SETTINGS & DATABASE
   ========================================================================== */

async function saveCompanySetting() {
  const name = document.getElementById('settings-company-name').value;
  if (!name.trim()) return;

  state.settings.companyName = name;
  BriskDB.saveSettings(state.settings);
  
  loadDataFromState();
  showToast('Organization name saved.', 'success');
}

async function exportDatabaseFile() {
  const jsonStr = await BriskDB.exportData();
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = `brisk_schedules_backup_${formatDateISO(new Date())}.json`;
  document.body.appendChild(a);
  a.click();
  
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* ==========================================================================
   PASSWORD RESET FLOW
   ========================================================================== */
function openResetPasswordModal(event) {
  if (event) event.preventDefault();
  const loginEmail = document.getElementById('login-email')?.value;
  const resetEmailInput = document.getElementById('reset-email');
  if (loginEmail && resetEmailInput && !resetEmailInput.value) {
    resetEmailInput.value = loginEmail;
  }

  const modal = document.getElementById('modal-reset-password');
  if (modal) {
    modal.classList.add('active');
    setTimeout(() => {
      const input = document.getElementById('reset-email');
      if (input) input.focus();
    }, 100);
  }
}

function closeResetPasswordModal() {
  const modal = document.getElementById('modal-reset-password');
  if (modal) modal.classList.remove('active');
}

async function handleResetPasswordSubmit(event) {
  event.preventDefault();
  const emailInput = document.getElementById('reset-email');
  const email = (emailInput ? emailInput.value : '').toLowerCase().trim();
  if (!email) return;

  const btn = document.getElementById('btn-submit-reset') || document.querySelector('#modal-reset-password button[type="submit"]');
  const origText = btn ? btn.innerHTML : 'Send Reset Link';
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Sending...';
  }

  try {
    const res = await BriskDB.apiResetPasswordForEmail(email);
    if (res.error) {
      showToast('Error: ' + res.error, 'error');
    } else {
      showToast('Password reset instructions sent to your email inbox.', 'success');
      closeResetPasswordModal();
    }
  } catch (err) {
    showToast('Failed to send reset request.', 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = origText;
    }
  }
}

async function handleManagerGenerateStaffLink() {
  const emailInput = document.getElementById('emp-email');
  const nameInput = document.getElementById('emp-name');
  const email = (emailInput ? emailInput.value : '').toLowerCase().trim();
  const name = nameInput ? nameInput.value : 'Staff';

  if (!email) {
    showToast('Please enter an employee email address first.', 'error');
    return;
  }

  const choice = prompt(
    `Manager Password Reset for ${name} (${email}):\n\n` +
    `Type "1" to Generate 1-Click Instant Login Link (Copy to clipboard for SMS/WhatsApp)\n` +
    `Type "2" to Set a New Password directly (e.g. Amcal2026!)`,
    "1"
  );

  if (!choice) return;

  if (choice.trim() === '2') {
    const newPass = prompt(`Enter new password for ${name} (min 6 characters):`, "Amcal2026!");
    if (!newPass || newPass.trim().length < 6) {
      showToast('Password must be at least 6 characters.', 'error');
      return;
    }
    showToast('Updating staff password...', 'info');
    const res = await BriskDB.apiManagerSetPassword(email, newPass.trim());
    if (res.error) {
      showToast('Error: ' + res.error, 'error');
    } else {
      showToast(`Password for ${name} set to "${newPass.trim()}"!`, 'success');
    }
  } else {
    showToast('Generating instant login link...', 'info');
    const res = await BriskDB.apiGenerateRecoveryLink(email);
    if (res.error) {
      showToast('Error: ' + res.error, 'error');
    } else if (res.resetActionLink) {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(res.resetActionLink);
        alert(`🎉 1-Click Login Link for ${name} has been COPIED to your clipboard!\n\nYou can now paste and send it to ${name} via SMS, WhatsApp, or iMessage.`);
      } else {
        prompt(`1-Click Login Link for ${name}:`, res.resetActionLink);
      }
      showToast('1-Click Login Link copied!', 'success');
    }
  }
}

async function handleUpdatePasswordSubmit(event) {
  event.preventDefault();
  const password = document.getElementById('update-new-password').value;
  if (!password || password.length < 6) {
    showToast('Password must be at least 6 characters.', 'error');
    return;
  }

  const btn = document.querySelector('#modal-update-password button[type="submit"]');
  const origText = btn ? btn.innerHTML : 'Save Password';
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';
  }

  try {
    const res = await BriskDB.apiUpdatePassword(password);
    if (res.error) {
      showToast('Error: ' + res.error, 'error');
    } else {
      showToast('Password updated successfully!', 'success');
      window.location.hash = ''; // Clear recovery hash
      const updateModal = document.getElementById('modal-update-password');
      if (updateModal) updateModal.classList.remove('active');

      if (!state.currentUser) {
        state.currentUser = BriskDB.getSession();
        if (state.currentUser) {
          if (!window._modulesLoaded) { await window.bootModularSystem(); window._modulesLoaded = true; }
      await bootApplication();
        } else {
          showLoginScreen();
        }
      }
    }
  } catch (err) {
    showToast('Failed to update password.', 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = origText;
    }
  }
}

/* ==========================================================================
   GLOBAL WINDOW BINDINGS — Required because app.js is loaded as type="module"
   ========================================================================== */
window.state = state;
window.DAY_NAMES = DAY_NAMES;
window.MONTH_NAMES = MONTH_NAMES;
window.hasManagerPermissions = hasManagerPermissions;
window.renderActivePanel = renderActivePanel;
window.formatDateISO = formatDateISO;
if (typeof getOrderedActiveEmployees !== 'undefined') window.getOrderedActiveEmployees = getOrderedActiveEmployees;
window.handleLoginSubmit = handleLoginSubmit;
window.handleRegisterSubmit = handleRegisterSubmit;
window.handleLogout = handleLogout;
window.handleInviteSubmit = handleInviteSubmit;
window.handleShiftSubmit = handleShiftSubmit;
window.handleShiftDelete = handleShiftDelete;
window.handleEmployeeSubmit = handleEmployeeSubmit;
window.handleEmployeeDelete = handleEmployeeDelete;
window.handleClockAction = handleClockAction;
window.handleLeaveSubmit = handleLeaveSubmit;
window.showLoginCard = showLoginCard;
window.showRegisterCard = showRegisterCard;
window.switchTab = switchTab;
window.openAddShiftModal = openAddShiftModal;
window.openEditShiftModal = openEditShiftModal;
window.closeShiftModal = closeShiftModal;
window.openAddEmployeeModal = openAddEmployeeModal;
window.openEditEmployeeModal = openEditEmployeeModal;
window.closeEmployeeModal = closeEmployeeModal;
window.openEmailRosterModal = openEmailRosterModal;
window.closeEmailRosterModal = closeEmailRosterModal;
window.sendRosterEmail = sendRosterEmail;
window.copyInviteUrl = copyInviteUrl;
window.exportDatabaseFile = exportDatabaseFile;
window.saveCompanySetting = saveCompanySetting;
window.toggleAvailTimeInputs = toggleAvailTimeInputs;
window.toggleTheme = toggleTheme;
window.updateTerminalStatus = updateTerminalStatus;
window.renderEmployeesList = renderEmployeesList;
window.renderScheduler = renderScheduler;
// Removed moved binding: triggerClearWeek
// Removed moved binding: triggerAutoScheduler
window.openResetPasswordModal = openResetPasswordModal;
window.closeResetPasswordModal = closeResetPasswordModal;
window.handleResetPasswordSubmit = handleResetPasswordSubmit;
window.handleUpdatePasswordSubmit = handleUpdatePasswordSubmit;
window.handleManagerGenerateStaffLink = handleManagerGenerateStaffLink;
// Removed moved binding: openSalesTargetsModal
// Removed moved binding: closeSalesTargetsModal
// Removed moved binding: handleSaveSalesTargets
// Removed moved binding: applySalesPreset
// Removed moved binding: resetSalesToDefault
// Removed moved binding: recalculateSalesKpiModal
window.onAwardClassificationChange = onAwardClassificationChange;
// Removed moved binding: recalculateActualSalesReconciliation
// Removed moved binding: saveActualPosSales
// Removed moved binding: onEmployeeDobChange
// Removed moved binding: applyJuniorUpgrade
window.unapproveTimecard = unapproveTimecard;
window.approveTimecard = approveTimecard;
window.decideLeaveRequest = decideLeaveRequest;
window.openLocumRemittanceModal = openLocumRemittanceModal;
window.closeLocumRemittanceModal = closeLocumRemittanceModal;
window.printLocumRemittance = printLocumRemittance;
window.openAuditTrailModal = openAuditTrailModal;
window.closeAuditTrailModal = closeAuditTrailModal;
window.renderAuditTrailList = renderAuditTrailList;
window.exportAuditTrailCsv = exportAuditTrailCsv;
window.clearAuditTrailLogs = clearAuditTrailLogs;
// Removed moved binding: renderModalCertificatesList
// Removed moved binding: addCertificateToEmployeeModal
// Removed moved binding: removeCertificateFromEmployeeModal
// Removed moved binding: openEmployeePaySlipModal
// Removed moved binding: closeEmployeePaySlipModal
// Removed moved binding: printEmployeePaySlip
// Removed moved binding: exportRosterIcs
// Removed moved binding: copyRosterBriefToClipboard
// Removed moved binding: copyDailyBriefToClipboard
window.openShiftReplacementMatcher = openShiftReplacementMatcher;
window.closeShiftReplacementMatcher = closeShiftReplacementMatcher;
window.assignCandidateToShiftModal = assignCandidateToShiftModal;
window.loadDataFromState = loadDataFromState;
window.showLoginScreen = showLoginScreen;
window.bootApplication = bootApplication;
if (typeof isNswPublicHoliday !== 'undefined') window.isNswPublicHoliday = isNswPublicHoliday;
if (typeof getMondayOfCurrentWeek !== 'undefined') window.getMondayOfCurrentWeek = getMondayOfCurrentWeek;

/* ==========================================================================
   LOCUM REMITTANCE ADVICE & REPLACEMENT STAFF MATCHER
   ========================================================================== */

function openShiftReplacementMatcher() {
  const box = document.getElementById('shift-replacement-matcher-box');
  const list = document.getElementById('shift-replacement-candidates-list');
  const shiftDate = document.getElementById('shift-date')?.value;
  const shiftStart = document.getElementById('shift-start')?.value;
  const shiftEnd = document.getElementById('shift-end')?.value;
  const shiftRole = document.getElementById('shift-role')?.value || '';

  if (!box || !list) return;
  if (!shiftDate || !shiftStart || !shiftEnd) {
    showToast('Please specify shift date, start time, and end time first.', 'warning');
    return;
  }

  list.innerHTML = '';
  const shiftHours = BriskScheduler.getShiftDuration(shiftStart, shiftEnd);
  const shiftDayIdx = new Date(shiftDate + 'T00:00:00').getDay();
  const shiftMonday = getMondayOfCurrentWeek(new Date(shiftDate + 'T00:00:00'));

  const activeEmployees = state.employees.filter(e => e.active);
  const candidateScores = [];

  activeEmployees.forEach(emp => {
    const maxH = emp.maxHours || 38;
    const currentWeekHours = calculateEmployeeWeekHours(emp.id, shiftMonday);
    const onLeave = checkLeaveStatus(emp.id, shiftDate);
    
    // Check weekday availability
    const avail = (emp.availability && typeof emp.availability === 'object') ? emp.availability[shiftDayIdx] : null;
    let isAvail = false;
    let availLabel = 'No availability set';
    if (avail && avail.start && avail.end) {
      isAvail = (shiftStart >= avail.start && shiftEnd <= avail.end);
      availLabel = `${avail.start} - ${avail.end}`;
    } else if (avail === null || avail === undefined) {
      isAvail = true;
      availLabel = 'Open Availability';
    }

    const roleMatch = emp.role.toLowerCase() === shiftRole.toLowerCase() || (shiftRole.toLowerCase().includes('assistant') && emp.role.toLowerCase().includes('assistant'));
    const resultingHours = currentWeekHours + shiftHours;
    const causesOt = resultingHours > maxH;
    const otAmount = causesOt ? (resultingHours - maxH) : 0;

    candidateScores.push({
      emp,
      currentWeekHours,
      resultingHours,
      maxH,
      onLeave,
      isAvail,
      availLabel,
      roleMatch,
      causesOt,
      otAmount
    });
  });

  candidateScores.sort((a, b) => {
    if (a.onLeave !== b.onLeave) return a.onLeave ? 1 : -1;
    if (a.isAvail !== b.isAvail) return a.isAvail ? -1 : 1;
    if (a.roleMatch !== b.roleMatch) return a.roleMatch ? -1 : 1;
    if (a.causesOt !== b.causesOt) return a.causesOt ? 1 : -1;
    return a.resultingHours - b.resultingHours;
  });

  if (candidateScores.length === 0) {
    list.innerHTML = '<div style="font-size:0.78rem; color:var(--text-muted); padding:4px;">No active staff found.</div>';
  } else {
    candidateScores.forEach(c => {
      const card = document.createElement('div');
      card.style.padding = '6px 8px';
      card.style.background = 'rgba(255,255,255,0.03)';
      card.style.border = '1px solid var(--border-glass)';
      card.style.borderRadius = 'var(--radius-sm)';
      card.style.display = 'flex';
      card.style.justifyContent = 'space-between';
      card.style.alignItems = 'center';
      card.style.gap = '8px';

      const leaveTag = c.onLeave ? '<span class="badge badge-danger" style="font-size:8px;">On Leave</span>' : '';
      const availTag = c.isAvail ? '<span class="badge badge-success" style="font-size:8px;">Avail</span>' : '<span class="badge badge-warning" style="font-size:8px;">Partial/Unavail</span>';
      const otTag = c.causesOt ? `<span class="badge badge-danger" style="font-size:8px;">+${c.otAmount.toFixed(1)}h OT</span>` : `<span class="badge" style="font-size:8px; background:rgba(16,185,129,0.1); color:#10b981;">${(c.maxH - c.resultingHours).toFixed(1)}h rem</span>`;

      card.innerHTML = `
        <div style="flex:1; min-width:0;">
          <div style="display:flex; align-items:center; gap:4px;">
            <strong style="font-size:0.82rem; color:var(--text-primary);">${c.emp.name}</strong>
            <span class="text-muted" style="font-size:0.72rem;">(${c.emp.role})</span>
          </div>
          <div style="display:flex; gap:4px; margin-top:2px; flex-wrap:wrap;">
            ${leaveTag} ${availTag} ${otTag}
            <span class="text-muted" style="font-size:0.7rem;">(Week: ${c.currentWeekHours.toFixed(1)}h ➔ ${c.resultingHours.toFixed(1)}h / ${c.maxH}h)</span>
          </div>
        </div>
        <button type="button" class="btn btn-primary" style="padding:2px 8px; font-size:0.75rem; white-space:nowrap;" onclick="assignCandidateToShiftModal('${c.emp.id}')">
          Select
        </button>
      `;
      list.appendChild(card);
    });
  }

  box.style.display = 'block';
}

function closeShiftReplacementMatcher() {
  const box = document.getElementById('shift-replacement-matcher-box');
  if (box) box.style.display = 'none';
}

function assignCandidateToShiftModal(empId) {
  const select = document.getElementById('shift-employee');
  if (select) {
    select.value = empId;
    updateShiftBreakSummary();
    closeShiftReplacementMatcher();
    showToast('Employee selected for shift.', 'info');
  }
}

function openLocumRemittanceModal(empId) {
  const isManagerOrOwner = hasManagerPermissions(state.currentUser);
  if (!isManagerOrOwner) {
    showToast('Locum Remittance Statements are restricted to Managers.', 'warning');
    return;
  }

  const emp = state.employees.find(e => e.id === empId);
  if (!emp) return;

  const modal = document.getElementById('modal-locum-remittance');
  if (!modal) return;

  document.getElementById('locum-slip-contractor-name').textContent = emp.name;
  document.getElementById('locum-slip-contractor-email').textContent = `${emp.email} ${emp.phone ? `· ${emp.phone}` : ''}`;
  document.getElementById('locum-slip-contractor-type').textContent = `${emp.role} · ${emp.employmentType || 'Locum Contractor'}`;

  const mon = new Date(state.currentWeekStart);
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  mon.setHours(0,0,0,0);
  sun.setHours(23,59,59,999);

  document.getElementById('locum-slip-period').textContent = `Period: ${formatDateISO(mon)} ~ ${formatDateISO(sun)}`;

  const weekShifts = state.shifts.filter(s => {
    if (s.employeeId !== emp.id) return false;
    const sDate = new Date(s.date + 'T00:00:00');
    sDate.setHours(0,0,0,0);
    return sDate >= mon && sDate <= sun;
  });

  weekShifts.sort((a,b) => a.date.localeCompare(b.date));

  const tbody = document.getElementById('locum-slip-table-body');
  const tfoot = document.getElementById('locum-slip-table-foot');
  tbody.innerHTML = '';

  let totalHours = 0;
  let totalBase = 0;
  let totalGst = 0;
  let totalSuper = 0;
  let totalPayable = 0;

  if (weekShifts.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="text-center text-muted" style="padding:16px;">No shifts scheduled for this locum in the selected period.</td></tr>`;
  } else {
    weekShifts.forEach(s => {
      const hours = BriskScheduler.getShiftDuration(s.startTime, s.endTime);
      const b = window.getEmployeeLaborCostBreakdown(emp, s.date, hours, s.role, s.startTime, s.endTime);
      
      totalHours += hours;
      totalBase += b.base;
      totalGst += b.gst;
      totalSuper += b.super;
      totalPayable += b.total;

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${s.date}</strong></td>
        <td>${s.startTime} - ${s.endTime} (${s.role || 'Pharmacist'})</td>
        <td class="text-right">${hours.toFixed(1)}h</td>
        <td class="text-right">$${parseFloat(emp.hourlyRate || 0).toFixed(2)}/h</td>
        <td class="text-right">$${b.base.toFixed(2)}</td>
        <td class="text-right" style="color:#c084fc;">$${b.gst.toFixed(2)}</td>
        <td class="text-right" style="color:#10b981;">$${b.super.toFixed(2)}</td>
        <td class="text-right" style="font-weight:700;">$${b.total.toFixed(2)}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  tfoot.innerHTML = `
    <tr>
      <td colspan="2"><strong>Grand Totals (${weekShifts.length} Shifts)</strong></td>
      <td class="text-right">${totalHours.toFixed(1)}h</td>
      <td class="text-right">-</td>
      <td class="text-right">$${totalBase.toFixed(2)}</td>
      <td class="text-right" style="color:#c084fc;">$${totalGst.toFixed(2)}</td>
      <td class="text-right" style="color:#10b981;">$${totalSuper.toFixed(2)}</td>
      <td class="text-right text-neon" style="font-size:0.95rem;">$${totalPayable.toFixed(2)}</td>
    </tr>
  `;

  modal.classList.add('active');
}

function closeLocumRemittanceModal() {
  const modal = document.getElementById('modal-locum-remittance');
  if (modal) modal.classList.remove('active');
}

function printLocumRemittance() {
  window.print();
}

/* ==========================================================================
   SECURITY & AUDIT TRAIL LOG SYSTEM
   ========================================================================== */

function openAuditTrailModal() {
  const isManagerOrOwner = hasManagerPermissions(state.currentUser);
  if (!isManagerOrOwner) {
    showToast('Audit logs are restricted to Managers & Owners.', 'warning');
    return;
  }
  const modal = document.getElementById('modal-audit-trail');
  if (!modal) return;
  renderAuditTrailList();
  modal.classList.add('active');
}

function closeAuditTrailModal() {
  const modal = document.getElementById('modal-audit-trail');
  if (modal) modal.classList.remove('active');
}

function renderAuditTrailList() {
  const tbody = document.getElementById('audit-trail-tbody');
  const searchInput = document.getElementById('audit-search-input');
  if (!tbody) return;

  const logs = (typeof BriskDB.getAuditLogs === 'function') ? BriskDB.getAuditLogs() : [];
  const query = (searchInput ? searchInput.value : '').toLowerCase().trim();

  const filtered = logs.filter(l => {
    if (!query) return true;
    const txt = `${l.action} ${l.actorName} ${l.actorEmail} ${l.details} ${l.timestamp}`.toLowerCase();
    return txt.includes(query);
  });

  tbody.innerHTML = '';
  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" class="text-center text-muted" style="padding:24px;">No audit events found.</td></tr>`;
    return;
  }

  filtered.forEach(item => {
    const d = new Date(item.timestamp);
    const dateFormatted = !isNaN(d.getTime()) ? `${formatDateISO(d)} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}` : item.timestamp;

    let actionBadgeColor = 'var(--accent-cyan)';
    let actionBg = 'rgba(0, 229, 255, 0.1)';
    if (item.action.includes('DELETE') || item.action.includes('REJECT')) {
      actionBadgeColor = '#f87171';
      actionBg = 'rgba(239, 68, 68, 0.15)';
    } else if (item.action.includes('APPROVE') || item.action.includes('CREATE')) {
      actionBadgeColor = '#34d399';
      actionBg = 'rgba(16, 185, 129, 0.15)';
    } else if (item.action.includes('UNLOCK')) {
      actionBadgeColor = '#fbbf24';
      actionBg = 'rgba(245, 158, 11, 0.15)';
    }

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="padding-left:12px; font-family:monospace; font-size:0.75rem; color:var(--text-muted);">${dateFormatted}</td>
      <td>
        <strong style="color:var(--text-primary);">${item.actorName || 'System'}</strong>
        <span style="font-size:0.72rem; color:var(--text-muted); display:block;">${item.actorEmail || ''}</span>
      </td>
      <td style="text-align:center;">
        <span class="badge" style="background:${actionBg}; color:${actionBadgeColor}; border:1px solid ${actionBadgeColor}44; font-size:0.72rem;">
          ${item.action}
        </span>
      </td>
      <td style="padding-left:12px; font-size:0.8rem; color:var(--text-secondary); line-height:1.4;">${item.details}</td>
    `;
    tbody.appendChild(tr);
  });
}

function exportAuditTrailCsv() {
  const logs = (typeof BriskDB.getAuditLogs === 'function') ? BriskDB.getAuditLogs() : [];
  if (logs.length === 0) {
    showToast('No audit logs to export.', 'warning');
    return;
  }

  const rows = [
    ['Audit_ID', 'Timestamp_ISO', 'Action', 'Actor_Name', 'Actor_Email', 'Actor_Role', 'Target_ID', 'Details']
  ];

  logs.forEach(l => {
    rows.push([
      `"${l.id || ''}"`,
      `"${l.timestamp || ''}"`,
      `"${l.action || ''}"`,
      `"${l.actorName || ''}"`,
      `"${l.actorEmail || ''}"`,
      `"${l.actorRole || ''}"`,
      `"${l.targetId || ''}"`,
      `"${(l.details || '').replace(/"/g, '""')}"`
    ]);
  });

  const csvContent = 'data:text/csv;charset=utf-8,' + rows.map(e => e.join(',')).join('\n');
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', `amcal_audit_trail_${formatDateISO(new Date())}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast(`Exported ${logs.length} audit records to CSV!`, 'success');
}

function clearAuditTrailLogs() {
  const isOwner = hasManagerPermissions(state.currentUser);
  if (!isOwner) {
    showToast('Only Organization Owners and Managers can clear audit history.', 'error');
    return;
  }

  if (confirm('Permanently clear all local audit trail logs? This action cannot be undone.')) {
    if (typeof BriskDB.clearAuditLogs === 'function') {
      BriskDB.clearAuditLogs();
      renderAuditTrailList();
      renderSettingsPanel();
      showToast('Audit trail logs cleared.', 'info');
    }
  }
}

// ==========================================
// DYNAMIC MODULE LOADER
// ==========================================
window.bootModularSystem = async function() {
  try {
    await import('./modules/payroll-engine.js');
    await import('./modules/compliance.js');
    await import('./modules/role-customization.js');
    await import('./modules/ai-ops.js');
    console.log('[BriskSchedules] Modular system fully booted.');
  } catch (err) {
    console.error('[BriskSchedules] Failed to load modules:', err);
  }
}
