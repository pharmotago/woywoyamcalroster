// Auto-extracted Module: PAYROLL
// Dynamic Window Globals Access (Live resolution, zero stale undefined closures)
const state = new Proxy({}, {
  get(target, prop) { return window.state ? window.state[prop] : undefined; },
  set(target, prop, value) { if (!window.state) window.state = {}; window.state[prop] = value; return true; }
});
const showToast = (...args) => (window.showToast ? window.showToast(...args) : console.log(...args));
const formatDateISO = (d) => (window.formatDateISO ? window.formatDateISO(d) : (d instanceof Date ? d.toISOString().split('T')[0] : ''));
const hasManagerPermissions = (u) => (window.hasManagerPermissions ? window.hasManagerPermissions(u) : false);
const renderActivePanel = () => (window.renderActivePanel ? window.renderActivePanel() : null);
const getOrderedActiveEmployees = () => (window.getOrderedActiveEmployees ? window.getOrderedActiveEmployees() : (window.state?.employees || []).filter(e => e.active));
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/* ==========================================================================
   PHARMACY LABOR COST, LOCUM INVOICING & SALES KPI FORECAST ENGINE
   ========================================================================== */

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
    // Locum Contractor invoices agreed hourly rate + 10% GST + 12% Super
    const base = hours * hourlyRate;
    const gst = base * 0.10;
    const superCost = base * 0.12;
    const total = base + gst + superCost;
    return { base, super: superCost, gst, total, isLocum: true, label: 'Locum Contractor (Invoice + GST/Super)', effectiveRate: hourlyRate };
  } else if (empType === 'locum_invoice_no_gst') {
    const base = hours * hourlyRate;
    const superCost = base * 0.12;
    const total = base + superCost;
    return { base, super: superCost, gst: 0, total, isLocum: true, label: 'Locum Contractor (Invoice + Super)', effectiveRate: hourlyRate };
  } else if (empType === 'locum_all_inclusive') {
    const base = hours * hourlyRate;
    return { base, super: 0, gst: 0, total: base, isLocum: true, label: 'Locum Contractor (All-Inclusive Invoice)', effectiveRate: hourlyRate };
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

  // Standard PAYG Employee (Pharmacy Industry Award 2026 [MA000012] Clause 21 & 22)
  let penaltyMultiplier = 1.0;
  const isCasual = empType === 'casual';
  
  if (isPubHol) {
    // NSW Public Holiday: 225% for Permanent, 250% for Casual
    penaltyMultiplier = isCasual ? 2.50 : 2.25;
  } else if (tcDay === 0) {
    // Sunday: 175% for Permanent, 200% for Casual
    penaltyMultiplier = isCasual ? 2.00 : 1.75;
  } else if (tcDay === 6) {
    // Saturday: 125% for Permanent, 150% for Casual
    penaltyMultiplier = isCasual ? 1.50 : 1.25;
  } else if (isCasual) {
    // Standard weekday casual loading (+25%)
    penaltyMultiplier = 1.25;
  }

  const base = hours * hourlyRate * penaltyMultiplier;
  const superCost = base * 0.12;
  const total = isCasual ? (base * 1.135) : (base * 1.205); // Casual: 12% Super + 1.5% Workers Comp; Permanent: 12% Super + 1.5% Comp + 7% Leave Accruals
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

function getDailySalesTargets() {
  const defaultTargets = { 1: 11000, 2: 10500, 3: 10500, 4: 12000, 5: 13500, 6: 8500, 0: 6000 }; // Mon=1..Sun=0
  try {
    if (typeof BriskDB !== 'undefined' && BriskDB.getSettings) {
      const dbSettings = BriskDB.getSettings();
      if (dbSettings && dbSettings.salesTargets) {
        return { ...defaultTargets, ...dbSettings.salesTargets };
      }
    }
    const saved = localStorage.getItem('brisk_daily_sales_targets');
    if (saved) {
      const parsed = JSON.parse(saved);
      return { ...defaultTargets, ...parsed };
    }
  } catch (e) {}
  return defaultTargets;
}
window.getDailySalesTargets = getDailySalesTargets;

async function saveDailySalesTargets(targets) {
  try {
    localStorage.setItem('brisk_daily_sales_targets', JSON.stringify(targets));
    if (typeof BriskDB !== 'undefined' && BriskDB.saveSettings) {
      await BriskDB.saveSettings({ salesTargets: targets });
    }
  } catch (e) {
    console.error('Failed to save sales targets to cloud DB:', e);
  }
}
window.saveDailySalesTargets = saveDailySalesTargets;

function getWageKpiHealth(percentage) {
  if (percentage <= 0) return { color: 'var(--text-muted)', label: 'No Data', badgeClass: 'badge-outline' };
  if (percentage < 10.5) return { color: '#10b981', label: '🟢 Optimal (<10.5%)', badgeClass: 'badge-success' };
  if (percentage <= 13.5) return { color: 'var(--accent-cyan)', label: '🔵 Healthy Benchmark (10.5–13.5%)', badgeClass: 'badge-cyan' };
  if (percentage <= 15.0) return { color: '#f59e0b', label: '🟡 Review Needed (13.5–15%)', badgeClass: 'badge-warning' };
  return { color: '#ef4444', label: '🔴 Over Budget (>15%)', badgeClass: 'badge-danger' };
}
window.getWageKpiHealth = getWageKpiHealth;

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

    // Get all shifts for the current week that are assigned
    const weekShifts = state.shifts.filter(s => {
      if (!s.employeeId) return false;
      const [y, m, d] = s.date.split('-');
      const sDate = new Date(y, m-1, d);
      sDate.setHours(0,0,0,0);
      return sDate >= mon && sDate <= sun;
    });

    let totalLaborCost = 0;
    weekShifts.forEach(shift => {
      const emp = state.employees.find(e => e.id === shift.employeeId);
      if (!emp) return;
      const hours = BriskScheduler.getShiftDuration(shift.startTime, shift.endTime);
      const breakdown = window.getEmployeeLaborCostBreakdown(emp, shift.date, hours, shift.role, shift.startTime, shift.endTime);
      totalLaborCost += breakdown.total;
    });

    const salesTargets = getDailySalesTargets();
    let totalWeeklySales = 0;
    for (let i = 0; i < 7; i++) {
      const d = new Date(state.currentWeekStart);
      d.setDate(state.currentWeekStart.getDate() + i);
      const dayOfWeek = d.getDay();
      totalWeeklySales += parseFloat(salesTargets[dayOfWeek] || 0);
    }

    const wageRatio = totalWeeklySales > 0 ? (totalLaborCost / totalWeeklySales) * 100 : 0;
    const kpiHealth = getWageKpiHealth(wageRatio);

    if (costValEl) costValEl.textContent = `$${totalLaborCost.toFixed(0)}`;
    if (wageValEl) {
      wageValEl.textContent = `${wageRatio.toFixed(1)}%`;
      wageValEl.style.color = kpiHealth.color;
    }

    // Update Reports Tab summary card
    const repSalesEl = document.getElementById('rep-kpi-total-sales');
    const repLaborEl = document.getElementById('rep-kpi-total-labor');
    const repWageEl = document.getElementById('rep-kpi-wage-percent');
    if (repSalesEl) repSalesEl.textContent = `$${totalWeeklySales.toLocaleString('en-AU', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
    if (repLaborEl) repLaborEl.textContent = `$${totalLaborCost.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    if (repWageEl) {
      repWageEl.textContent = `${wageRatio.toFixed(1)}%`;
      repWageEl.style.color = kpiHealth.color;
    }

    recalculateActualSalesReconciliation();
  } catch (err) {
    console.error('Failed to calculate labor cost forecast:', err);
  }
}

function recalculateActualSalesReconciliation() {
  try {
    if (!state.currentWeekStart) return;
    const weekKey = formatDateISO(state.currentWeekStart);
    const savedActual = localStorage.getItem('brisk_actual_pos_sales_' + weekKey);
    const inputEl = document.getElementById('rep-actual-pos-input');
    
    if (inputEl && (inputEl.value === '' || inputEl.value === null) && savedActual !== null) {
      inputEl.value = savedActual;
    }

    const actualSales = inputEl && inputEl.value ? (parseFloat(inputEl.value) || 0) : (parseFloat(savedActual) || 0);

    const salesTargets = getDailySalesTargets();
    let targetSales = 0;
    for (let i = 0; i < 7; i++) {
      const d = new Date(state.currentWeekStart);
      d.setDate(state.currentWeekStart.getDate() + i);
      const dayOfWeek = d.getDay();
      targetSales += parseFloat(salesTargets[dayOfWeek] || 0);
    }

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

    let totalLaborCost = 0;
    weekShifts.forEach(shift => {
      const emp = state.employees.find(e => e.id === shift.employeeId);
      if (!emp) return;
      const hours = BriskScheduler.getShiftDuration(shift.startTime, shift.endTime);
      const breakdown = window.getEmployeeLaborCostBreakdown(emp, shift.date, hours, shift.role, shift.startTime, shift.endTime);
      totalLaborCost += breakdown.total;
    });

    const budgetPct = targetSales > 0 ? (totalLaborCost / targetSales) * 100 : 0;
    const actualPct = actualSales > 0 ? (totalLaborCost / actualSales) * 100 : 0;
    const health = getWageKpiHealth(actualSales > 0 ? actualPct : budgetPct);

    const targetEl = document.getElementById('rep-recon-target-sales');
    const actualEl = document.getElementById('rep-recon-actual-sales');
    const laborEl = document.getElementById('rep-recon-scheduled-labor');
    const budgetPctEl = document.getElementById('rep-recon-budget-pct');
    const actualPctEl = document.getElementById('rep-recon-actual-pct');
    const healthBadgeEl = document.getElementById('rep-recon-health-badge');

    if (targetEl) targetEl.textContent = `$${targetSales.toLocaleString('en-AU', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
    if (actualEl) actualEl.textContent = actualSales > 0 ? `$${actualSales.toLocaleString('en-AU', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : '$0.00 (Pending)';
    if (laborEl) laborEl.textContent = `$${totalLaborCost.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    if (budgetPctEl) budgetPctEl.textContent = `${budgetPct.toFixed(1)}%`;
    if (actualPctEl) {
      actualPctEl.textContent = actualSales > 0 ? `${actualPct.toFixed(1)}%` : '--';
      actualPctEl.style.color = actualSales > 0 ? health.color : '#94a3b8';
    }
    if (healthBadgeEl) {
      if (actualSales > 0) {
        healthBadgeEl.innerHTML = `<span class="badge" style="background:${health.bg}; color:${health.color}; border:1px solid ${health.color}66; font-size:10px;">${health.label}</span>`;
      } else {
        healthBadgeEl.innerHTML = `<span class="badge" style="background:rgba(255,255,255,0.05); color:#94a3b8; font-size:10px;">Enter POS Sales to Reconcile</span>`;
      }
    }
  } catch (err) {
    console.error('Reconciliation calculation error:', err);
  }
}

function saveActualPosSales() {
  if (!state.currentWeekStart) return;
  const weekKey = formatDateISO(state.currentWeekStart);
  const inputEl = document.getElementById('rep-actual-pos-input');
  const val = inputEl ? (parseFloat(inputEl.value) || 0) : 0;
  localStorage.setItem('brisk_actual_pos_sales_' + weekKey, String(val));
  recalculateActualSalesReconciliation();
  showToast(`Actual POS sales ($${val.toLocaleString('en-AU')}) saved for this week!`, 'success');
}

function calculateAgeFromDob(dobString) {
  if (!dobString) return null;
  const dob = new Date(dobString + 'T00:00:00');
  if (isNaN(dob.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
    age--;
  }
  return age;
}

function onEmployeeDobChange() {
  const dobInput = document.getElementById('emp-dob');
  const levelSelect = document.getElementById('emp-award-level');
  const alertBox = document.getElementById('junior-rate-upgrade-alert');
  const alertText = document.getElementById('junior-upgrade-text');
  if (!dobInput || !levelSelect || !alertBox || !alertText) return;

  const age = calculateAgeFromDob(dobInput.value);
  if (age === null) {
    alertBox.classList.add('hide');
    return;
  }

  let recommendedCode = 'pa1';
  let recommendedLabel = 'Pharmacy Assistant Level 1 (Adult) ($27.81/h)';
  
  if (age < 16) {
    recommendedCode = 'pa1_j_u16';
    recommendedLabel = 'Junior Level 1: Under 16 yrs (45% - $12.51/h)';
  } else if (age === 16) {
    recommendedCode = 'pa1_j_16';
    recommendedLabel = 'Junior Level 1: 16 years (50% - $13.91/h)';
  } else if (age === 17) {
    recommendedCode = 'pa1_j_17';
    recommendedLabel = 'Junior Level 1: 17 years (60% - $16.69/h)';
  } else if (age === 18) {
    recommendedCode = 'pa1_j_18';
    recommendedLabel = 'Junior Level 1: 18 years (70% - $19.47/h)';
  } else if (age === 19) {
    recommendedCode = 'pa1_j_19';
    recommendedLabel = 'Junior Level 1: 19 years (80% - $22.25/h)';
  } else if (age === 20) {
    recommendedCode = 'pa1_j_20';
    recommendedLabel = 'Junior Level 1: 20 years (90% - $25.03/h)';
  }

  const currentLevel = levelSelect.value;
  const isJuniorCurrent = currentLevel.includes('_j_');

  let upgradeNeeded = false;
  if (age >= 21 && isJuniorCurrent) {
    upgradeNeeded = true;
  } else if (isJuniorCurrent && currentLevel !== recommendedCode) {
    upgradeNeeded = true;
  }

  if (upgradeNeeded) {
    alertText.innerHTML = `🎂 <strong>Birthday Progression:</strong> Staff is <strong>${age} years old</strong>. Rate upgrade to <em>${recommendedLabel}</em> is due.`;
    alertBox.dataset.recommendedCode = recommendedCode;
    alertBox.classList.remove('hide');
  } else {
    alertBox.classList.add('hide');
  }
}

function applyJuniorUpgrade() {
  const alertBox = document.getElementById('junior-rate-upgrade-alert');
  const levelSelect = document.getElementById('emp-award-level');
  if (!alertBox || !levelSelect) return;

  const targetCode = alertBox.dataset.recommendedCode || 'pa1';
  levelSelect.value = targetCode;
  onAwardClassificationChange();
  alertBox.classList.add('hide');
  showToast('Award classification updated to match staff age!', 'success');
}

function openSalesTargetsModal() {
  const isManagerOrOwner = hasManagerPermissions(state.currentUser);
  if (!isManagerOrOwner) {
    showToast('Sales figures and Wage KPIs are only visible to Managers.', 'warning');
    return;
  }

  const modal = document.getElementById('modal-sales-kpi');
  if (!modal) return;

  const salesTargets = getDailySalesTargets();
  const daysListContainer = document.getElementById('sales-kpi-days-list');
  if (daysListContainer) {
    daysListContainer.innerHTML = '';
    const DAY_NAMES_ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const DAY_IDX_MAP = [1, 2, 3, 4, 5, 6, 0];

    for (let i = 0; i < 7; i++) {
      const dayIdx = DAY_IDX_MAP[i];
      const dayName = DAY_NAMES_ORDER[i];
      const d = new Date(state.currentWeekStart);
      d.setDate(state.currentWeekStart.getDate() + i);
      const dateStr = formatDateISO(d);
      
      const dayShifts = state.shifts.filter(s => s.date === dateStr && s.employeeId);
      let dayLaborCost = 0;
      let dayHours = 0;
      dayShifts.forEach(shift => {
        const emp = state.employees.find(e => e.id === shift.employeeId);
        if (!emp) return;
        const hours = BriskScheduler.getShiftDuration(shift.startTime, shift.endTime);
        dayHours += hours;
        dayLaborCost += window.getEmployeeLaborCostBreakdown(emp, shift.date, hours, shift.role, shift.startTime, shift.endTime).total;
      });

      const currentTarget = salesTargets[dayIdx] || 10000;
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
          <span class="text-muted" style="font-size:0.75rem;">${dateStr.slice(5)} (${dayHours.toFixed(1)}h | $${dayLaborCost.toFixed(0)})</span>
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
      const hours = BriskScheduler.getShiftDuration(shift.startTime, shift.endTime);
      dayLaborCost += window.getEmployeeLaborCostBreakdown(emp, shift.date, hours, shift.role, shift.startTime, shift.endTime).total;
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

  if (laborEl) laborEl.textContent = `$${totalLabor.toFixed(2)}`;
  if (salesEl) salesEl.textContent = `$${totalSales.toLocaleString('en-AU', { minimumFractionDigits: 0 })}`;
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

async function triggerClearWeek() {
  if (!confirm('Are you sure you want to unassign all employee shifts for this week?')) return;

  const mon = new Date(state.currentWeekStart);
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  mon.setHours(0,0,0,0);
  sun.setHours(23,59,59,999);

  const weekShifts = state.shifts.filter(s => {
    const sDate = new Date(s.date);
    sDate.setHours(0,0,0,0);
    return sDate >= mon && sDate <= sun;
  });

  // Update each shift using batch operation
  try {
    const updatedShifts = weekShifts.map(s => ({ ...s, employeeId: null }));
    await BriskDB.batchUpdateShifts(updatedShifts);
    renderScheduler();
  } catch (err) {
    console.error('Clear Week Error:', err);
    showToast('Failed to clear week shifts. Please try again.', 'error');
  }
}

async function copyCurrentWeekToNextWeek() {
  if (typeof window.openCopyWeekModal === 'function') {
    window.openCopyWeekModal();
    return;
  }
}
window.copyCurrentWeekToNextWeek = copyCurrentWeekToNextWeek;

async function triggerAutoScheduler() {
  const submitBtn = document.getElementById('btn-auto-schedule');
  const origText = submitBtn ? submitBtn.innerHTML : 'Auto-Schedule';
  
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Scheduling...';
  }

  try {
    const targetWeekStr = formatDateISO(state.currentWeekStart);
    const clonedShifts = structuredClone(state.shifts);
    const result = BriskScheduler.run(clonedShifts, state.employees, state.leaveRequests, targetWeekStr, state.timecards, true);
    
    if (result.success) {
      // Save generated shifts to Supabase for target week only
      const targetWeekStart = new Date(targetWeekStr + 'T00:00:00');
      const targetWeekEnd = new Date(targetWeekStart);
      targetWeekEnd.setDate(targetWeekStart.getDate() + 6);
      targetWeekStart.setHours(0,0,0,0);
      targetWeekEnd.setHours(23,59,59,999);

      const weekShifts = result.shifts.filter(s => {
        const sDate = new Date(s.date + 'T00:00:00');
        sDate.setHours(0,0,0,0);
        return sDate >= targetWeekStart && sDate <= targetWeekEnd;
      });

      try {
        await BriskDB.batchUpdateShifts(weekShifts);
        
        // Update state.shifts in-place with the assigned shifts
        result.shifts.forEach(updatedShift => {
          const idx = state.shifts.findIndex(s => s.id === updatedShift.id);
          if (idx !== -1) {
            state.shifts[idx] = updatedShift;
          } else {
            state.shifts.push(updatedShift);
          }
        });

        renderScheduler();
        
        showToast(`📅 Auto-Scheduler Complete!\n\n- Shifts successfully assigned: ${result.assignedCount}\n- Shifts left unassigned: ${result.unassignedCount}\n\n[Placement Logs]\n${result.logs.slice(0, 10).join('\n')}\n${result.logs.length > 10 ? '...and more' : ''}`, 'success');
      } catch (err) {
        console.error('Auto-Scheduler Save Error:', err);
        showToast('Auto-Scheduler calculated the schedule, but failed to save to the database. Please try again.', 'error');
      }
    } else {
      showToast(result.message, 'success');
    }
  } catch (err) {
    console.error('Auto-Scheduler Run Error:', err);
    showToast(`Auto-Scheduler error: ${err.message}`, 'error');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = origText;
    }
  }
}

/* ==========================================================================
   KATHERINE'S WEEKLY PAYROLL SUMMARY (MONDAY TO SUNDAY)
   Gated strictly to Owners & Managers.
   Provides a clean, summarized payroll report per employee from Monday to Sunday
   so Katherine can easily put through pay via external payroll company.
   ========================================================================== */

window.katPayrollState = {
  currentWeekStart: null,
  mode: 'actual', // 'actual' (approved timecards), 'scheduled' (rostered shifts), 'reconciled' (actual with roster fallback)
  lastSummaryData: null
};

function getWeeklyPayrollSummaryForKatherine(weekStartDate = null, mode = 'actual') {
  if (!hasManagerPermissions(state.currentUser) && !hasOwnerOrPeterPermissions(state.currentUser)) {
    return { error: 'Unauthorized: Gated strictly to Owners & Managers.' };
  }

  // 1. Resolve target Monday (00:00:00) to Sunday (23:59:59)
  let mon = weekStartDate ? new Date(weekStartDate) : (state.currentWeekStart ? new Date(state.currentWeekStart) : new Date());
  if (isNaN(mon.getTime())) mon = new Date();
  
  // Align strictly to Monday
  const day = mon.getDay();
  const diff = mon.getDate() - day + (day === 0 ? -6 : 1);
  mon.setDate(diff);
  mon.setHours(0, 0, 0, 0);

  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  sun.setHours(23, 59, 59, 999);

  const monStr = formatDateISO(mon);
  const sunStr = formatDateISO(sun);

  // 2. Filter Active Employees
  const activeEmployees = (state.employees || []).filter(e => e.active);

  // Sort employees: Pharmacists first, then Dispensary, then Webster, then Retail/Front, then Casuals
  activeEmployees.sort((a, b) => {
    const roleA = (a.role || '').toLowerCase();
    const roleB = (b.role || '').toLowerCase();
    const isPharmA = roleA.includes('pharmacist') || roleA.includes('pic');
    const isPharmB = roleB.includes('pharmacist') || roleB.includes('pic');
    if (isPharmA && !isPharmB) return -1;
    if (!isPharmA && isPharmB) return 1;
    return (a.name || '').localeCompare(b.name || '');
  });

  const employeeSummaries = [];
  let totalOrdinaryHours = 0;
  let totalSaturdayHours = 0;
  let totalSundayHours = 0;
  let totalPubHolidayHours = 0;
  let totalOvertimeHours = 0;
  let totalAnnualLeaveHours = 0;
  let totalSickLeaveHours = 0;
  let totalPaidHoursAll = 0;
  let totalGrossWagesAll = 0;
  let totalSuperannuationAll = 0;
  let totalLocumInvoicesAll = 0;
  let totalTimecardsCount = 0;
  let totalApprovedTimecardsCount = 0;
  let pendingApprovalAlerts = 0;

  activeEmployees.forEach(emp => {
    const empType = emp.employmentType || 'permanent';
    const isCasual = empType === 'casual';
    const isLocum = empType.startsWith('locum');
    const hourlyRate = parseFloat(emp.hourlyRate) || 0;

    // Pull timecards for this employee in Mon-Sun
    const empTimecards = (state.timecards || []).filter(tc => {
      if (tc.employeeId !== emp.id) return false;
      const [y, m, d] = tc.date.split('-');
      const tcDate = new Date(y, m - 1, d);
      tcDate.setHours(0, 0, 0, 0);
      return tcDate >= mon && tcDate <= sun;
    });

    // Pull scheduled shifts for this employee in Mon-Sun
    const empShifts = (state.shifts || []).filter(s => {
      if (s.employeeId !== emp.id) return false;
      const [y, m, d] = s.date.split('-');
      const sDate = new Date(y, m - 1, d);
      sDate.setHours(0, 0, 0, 0);
      return sDate >= mon && sDate <= sun;
    });

    // Pull approved leave for this employee in Mon-Sun
    const empLeave = (state.leaveRequests || []).filter(lv => {
      if (lv.employeeId !== emp.id || lv.status !== 'Approved') return false;
      const lvStart = new Date(lv.startDate + 'T00:00:00');
      const lvEnd = new Date(lv.endDate + 'T23:59:59');
      return (lvStart <= sun && lvEnd >= mon);
    });

    let empOrdHours = 0;
    let empSatHours = 0;
    let empSunHours = 0;
    let empPubHolHours = 0;
    let empOtHours = 0;
    let empAnnualLeaveHours = 0;
    let empSickLeaveHours = 0;

    let unapprovedPunches = 0;
    let totalPunches = 0;

    // Calculate daily hours for all 7 days (Mon to Sun)
    for (let i = 0; i < 7; i++) {
      const dayDate = new Date(mon.getTime() + i * 86400000);
      const dateStr = formatDateISO(dayDate);
      const dayOfWeek = dayDate.getDay(); // 1..6, 0=Sun
      const isPubHol = typeof isNswPublicHoliday === 'function' ? isNswPublicHoliday(dateStr) : false;

      const dayTcs = empTimecards.filter(tc => tc.date === dateStr);
      const dayShifts = empShifts.filter(s => s.date === dateStr);

      let dayHours = 0;
      let dayPunched = false;

      if (dayTcs.length > 0) {
        totalPunches += dayTcs.length;
        dayPunched = true;
        dayTcs.forEach(tc => {
          if (!tc.approved) unapprovedPunches++;
          dayHours += parseFloat(tc.totalHours) || 0;
        });
      }

      // Mode resolution
      if (mode === 'scheduled') {
        dayHours = 0;
        dayShifts.forEach(s => {
          if (typeof calculateShiftHours === 'function') {
            dayHours += calculateShiftHours(s.startTime, s.endTime, s.unpaidMealMins);
          } else if (typeof BriskScheduler !== 'undefined' && BriskScheduler.getShiftDuration) {
            dayHours += BriskScheduler.getShiftDuration(s.startTime, s.endTime);
          }
        });
      } else if (mode === 'reconciled' && !dayPunched && dayShifts.length > 0) {
        dayShifts.forEach(s => {
          if (typeof calculateShiftHours === 'function') {
            dayHours += calculateShiftHours(s.startTime, s.endTime, s.unpaidMealMins);
          } else if (typeof BriskScheduler !== 'undefined' && BriskScheduler.getShiftDuration) {
            dayHours += BriskScheduler.getShiftDuration(s.startTime, s.endTime);
          }
        });
      }

      // Check for daily overtime (> 12.0 hours ordinary per Fair Work Award Clause 13.2)
      let normalDailyHours = dayHours;
      if (dayHours > 12.0) {
        empOtHours += (dayHours - 12.0);
        normalDailyHours = 12.0;
      }

      if (normalDailyHours > 0) {
        if (isPubHol) {
          empPubHolHours += normalDailyHours;
        } else if (dayOfWeek === 0) {
          empSunHours += normalDailyHours;
        } else if (dayOfWeek === 6) {
          empSatHours += normalDailyHours;
        } else {
          empOrdHours += normalDailyHours;
        }
      }
    }

    // Weekly Overtime (> 38 hours ordinary for the week)
    if (empOrdHours > 38.0) {
      const weeklyOt = empOrdHours - 38.0;
      empOtHours += weeklyOt;
      empOrdHours = 38.0;
    }

    // Process Approved Paid Leave (Mon-Fri ordinary days)
    if (!isCasual && !isLocum) {
      empLeave.forEach(lv => {
        const reason = (lv.reason || '').toLowerCase();
        const lvStart = new Date(lv.startDate + 'T00:00:00');
        const lvEnd = new Date(lv.endDate + 'T23:59:59');
        let leaveDaysInWeek = 0;
        for (let i = 0; i < 7; i++) {
          const d = new Date(mon.getTime() + i * 86400000);
          if (d >= lvStart && d <= lvEnd && d.getDay() >= 1 && d.getDay() <= 5) {
            leaveDaysInWeek++;
          }
        }
        const hoursPerDay = 7.6; // Standard 38h / 5 days
        const totalLvHours = leaveDaysInWeek * hoursPerDay;

        if (reason.includes('sick') || reason.includes('personal') || reason.includes('carer') || reason.includes('medical')) {
          empSickLeaveHours += totalLvHours;
        } else {
          empAnnualLeaveHours += totalLvHours;
        }
      });
    }

    const totalPaidHours = empOrdHours + empSatHours + empSunHours + empPubHolHours + empOtHours + empAnnualLeaveHours + empSickLeaveHours;

    // Financial calculations
    let grossPay = 0;
    let superAmount = 0;
    let locumInvoice = 0;

    if (isLocum) {
      locumInvoice = totalPaidHours * hourlyRate;
      if (empType === 'locum_invoice') {
        const gst = locumInvoice * 0.10;
        superAmount = locumInvoice * 0.12;
        grossPay = locumInvoice + gst + superAmount;
      } else if (empType === 'locum_invoice_no_gst') {
        superAmount = locumInvoice * 0.12;
        grossPay = locumInvoice + superAmount;
      } else {
        // all-inclusive
        grossPay = locumInvoice;
        superAmount = 0;
      }
    } else if (isCasual) {
      const ordPay = empOrdHours * hourlyRate * 1.25;
      const satPay = empSatHours * hourlyRate * 1.50;
      const sunPay = empSunHours * hourlyRate * 2.00;
      const pubPay = empPubHolHours * hourlyRate * 2.50;
      const otPay = empOtHours * hourlyRate * 2.25;
      grossPay = ordPay + satPay + sunPay + pubPay + otPay;
      superAmount = grossPay * 0.12;
    } else {
      const ordPay = empOrdHours * hourlyRate * 1.0;
      const satPay = empSatHours * hourlyRate * 1.25;
      const sunPay = empSunHours * hourlyRate * 1.75;
      const pubPay = empPubHolHours * hourlyRate * 2.25;
      const otPay = empOtHours * hourlyRate * 2.00;
      const leavePay = (empAnnualLeaveHours + empSickLeaveHours) * hourlyRate * 1.0;
      grossPay = ordPay + satPay + sunPay + pubPay + otPay + leavePay;
      superAmount = grossPay * 0.12;
    }

    // Accumulate Store Totals
    totalOrdinaryHours += empOrdHours;
    totalSaturdayHours += empSatHours;
    totalSundayHours += empSunHours;
    totalPubHolidayHours += empPubHolHours;
    totalOvertimeHours += empOtHours;
    totalAnnualLeaveHours += empAnnualLeaveHours;
    totalSickLeaveHours += empSickLeaveHours;
    totalPaidHoursAll += totalPaidHours;
    totalGrossWagesAll += grossPay;
    totalSuperannuationAll += superAmount;
    if (isLocum) totalLocumInvoicesAll += locumInvoice;

    totalTimecardsCount += totalPunches;
    totalApprovedTimecardsCount += (totalPunches - unapprovedPunches);
    pendingApprovalAlerts += unapprovedPunches;

    // Only include employees who have hours or scheduled shifts this week
    if (totalPaidHours > 0 || empShifts.length > 0 || empTimecards.length > 0) {
      employeeSummaries.push({
        id: emp.id,
        name: emp.name,
        role: emp.role || 'Staff',
        employmentType: empType,
        awardLevel: emp.awardLevel || 'Standard',
        hourlyRate,
        isLocum,
        isCasual,
        ordinaryHours: empOrdHours,
        saturdayHours: empSatHours,
        sundayHours: empSunHours,
        pubHolidayHours: empPubHolHours,
        overtimeHours: empOtHours,
        annualLeaveHours: empAnnualLeaveHours,
        sickLeaveHours: empSickLeaveHours,
        totalPaidHours,
        grossPay,
        superAmount,
        locumInvoice,
        unapprovedPunches,
        totalPunches,
        approvalStatus: totalPunches === 0 
          ? (empShifts.length > 0 ? 'Rostered Only' : 'No Punches')
          : (unapprovedPunches === 0 ? 'Approved' : `${unapprovedPunches} Pending`)
      });
    }
  });

  const result = {
    storeName: 'Amcal Pharmacy Woy Woy',
    storeAddress: 'Deepwater Plaza, Woy Woy NSW 2256',
    monDate: monStr,
    sunDate: sunStr,
    monDateObj: mon,
    periodDisplay: `${mon.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })} – ${sun.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}`,
    mode,
    activeStaffCount: employeeSummaries.length,
    totalPunches: totalTimecardsCount,
    unapprovedPunches: pendingApprovalAlerts,
    allTimecardsApproved: pendingApprovalAlerts === 0,
    employeeSummaries,
    totals: {
      ordinaryHours: totalOrdinaryHours,
      saturdayHours: totalSaturdayHours,
      sundayHours: totalSundayHours,
      pubHolidayHours: totalPubHolidayHours,
      overtimeHours: totalOvertimeHours,
      annualLeaveHours: totalAnnualLeaveHours,
      sickLeaveHours: totalSickLeaveHours,
      totalPaidHours: totalPaidHoursAll,
      grossWages: totalGrossWagesAll,
      superannuation: totalSuperannuationAll,
      locumInvoices: totalLocumInvoicesAll,
      totalPayable: totalGrossWagesAll
    }
  };

  window.katPayrollState.lastSummaryData = result;
  return result;
}

function openKatPayrollSummaryModal(targetWeekStart = null) {
  if (!hasManagerPermissions(state.currentUser) && !hasOwnerOrPeterPermissions(state.currentUser)) {
    showToast('Permission denied: Payroll Summary is restricted to Katherine and Managers.', 'warning');
    return;
  }

  const modal = document.getElementById('modal-kat-payroll-summary');
  if (!modal) {
    console.error('Modal modal-kat-payroll-summary not found in DOM.');
    return;
  }

  if (targetWeekStart) {
    window.katPayrollState.currentWeekStart = new Date(targetWeekStart);
  } else if (!window.katPayrollState.currentWeekStart) {
    window.katPayrollState.currentWeekStart = state.currentWeekStart ? new Date(state.currentWeekStart) : new Date();
  }

  renderKatPayrollSummaryModal();
  modal.classList.add('active');
}

function closeKatPayrollSummaryModal() {
  const modal = document.getElementById('modal-kat-payroll-summary');
  if (modal) modal.classList.remove('active');
}

function changeKatPayrollWeek(offsetWeeks = 0) {
  if (offsetWeeks === 0) {
    window.katPayrollState.currentWeekStart = state.currentWeekStart ? new Date(state.currentWeekStart) : new Date();
  } else {
    const current = new Date(window.katPayrollState.currentWeekStart || state.currentWeekStart || new Date());
    current.setDate(current.getDate() + (offsetWeeks * 7));
    window.katPayrollState.currentWeekStart = current;
  }
  renderKatPayrollSummaryModal();
}

function toggleKatPayrollDataMode(mode) {
  window.katPayrollState.mode = mode;
  renderKatPayrollSummaryModal();
  showToast(`Switched payroll view mode to: ${mode === 'actual' ? 'Approved Timecards (Actual Punches)' : mode === 'scheduled' ? 'Scheduled Shifts (Planned Roster)' : 'Reconciled (Actual + Roster Fallback)'}`, 'info');
}

function renderKatPayrollSummaryModal() {
  const summary = getWeeklyPayrollSummaryForKatherine(window.katPayrollState.currentWeekStart, window.katPayrollState.mode);
  if (summary.error) {
    showToast(summary.error, 'error');
    return;
  }

  // Update Period Text
  const weekDisplay = document.getElementById('kat-payroll-week-display');
  if (weekDisplay) weekDisplay.textContent = summary.periodDisplay;
  const printPeriod = document.getElementById('kat-print-period-text');
  if (printPeriod) printPeriod.textContent = `Pay Period: Monday ${summary.monDate} to Sunday ${summary.sunDate}`;

  // Mode Buttons
  const modeActualBtn = document.getElementById('kat-mode-actual');
  const modeSchedBtn = document.getElementById('kat-mode-scheduled');
  const modeReconBtn = document.getElementById('kat-mode-reconciled');
  if (modeActualBtn) modeActualBtn.className = window.katPayrollState.mode === 'actual' ? 'btn btn-primary' : 'btn btn-outline';
  if (modeSchedBtn) modeSchedBtn.className = window.katPayrollState.mode === 'scheduled' ? 'btn btn-primary' : 'btn btn-outline';
  if (modeReconBtn) modeReconBtn.className = window.katPayrollState.mode === 'reconciled' ? 'btn btn-primary' : 'btn btn-outline';

  // Status Banner
  const banner = document.getElementById('kat-payroll-status-banner');
  if (banner) {
    if (summary.unapprovedPunches > 0) {
      banner.style.background = 'rgba(245, 158, 11, 0.12)';
      banner.style.border = '1px solid rgba(245, 158, 11, 0.35)';
      banner.style.color = '#f59e0b';
      banner.innerHTML = `
        <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:10px;">
          <div>
            <i class="fa-solid fa-triangle-exclamation" style="margin-right:6px;"></i>
            <strong>Action Required:</strong> <strong>${summary.unapprovedPunches}</strong> timecard punch(es) are pending manager approval for this week.
          </div>
          <button type="button" class="btn btn-outline" style="padding:4px 12px; font-size:0.75rem; color:#10b981; border-color:rgba(16,185,129,0.4);" onclick="approveAllTimecardsForKatWeek()">
            <i class="fa-solid fa-check-double"></i> Approve All For This Week
          </button>
        </div>
      `;
    } else {
      banner.style.background = 'rgba(16, 185, 129, 0.1)';
      banner.style.border = '1px solid rgba(16, 185, 129, 0.3)';
      banner.style.color = '#10b981';
      banner.innerHTML = `<i class="fa-solid fa-circle-check" style="margin-right:6px;"></i> <strong>All Clear for Payroll:</strong> All timecards are approved and reconciled. Ready to submit via external payroll company.`;
    }
  }

  // KPI Cards
  const kpiGross = document.getElementById('kat-kpi-gross-wages');
  const kpiSuper = document.getElementById('kat-kpi-super');
  const kpiHours = document.getElementById('kat-kpi-hours');
  const kpiLocum = document.getElementById('kat-kpi-locum');

  if (kpiGross) kpiGross.textContent = `$${summary.totals.grossWages.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (kpiSuper) kpiSuper.textContent = `$${summary.totals.superannuation.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (kpiHours) kpiHours.textContent = `${summary.totals.totalPaidHours.toFixed(1)}h`;
  if (kpiLocum) kpiLocum.textContent = `$${summary.totals.locumInvoices.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  // Table Body
  const tbody = document.getElementById('kat-payroll-table-body');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (summary.employeeSummaries.length === 0) {
    tbody.innerHTML = `<tr><td colspan="13" class="text-center text-muted" style="padding: 2rem;">No shifts or timecards recorded for Monday to Sunday in this week.</td></tr>`;
    return;
  }

  summary.employeeSummaries.forEach(row => {
    let typeBadge = '<span class="badge" style="background:rgba(16,185,129,0.12); color:#10b981; font-size:0.72rem;">Permanent</span>';
    if (row.isCasual) {
      typeBadge = '<span class="badge" style="background:rgba(59,130,246,0.15); color:#60a5fa; font-size:0.72rem;">Casual (1.25x)</span>';
    } else if (row.isLocum) {
      typeBadge = '<span class="badge" style="background:rgba(168,85,247,0.15); color:#c084fc; font-size:0.72rem;">Locum Contractor</span>';
    }

    let statusPill = `<span class="badge badge-success" style="font-size:0.7rem;"><i class="fa-solid fa-check"></i> Approved</span>`;
    if (row.unapprovedPunches > 0) {
      statusPill = `<span class="badge badge-warning" style="font-size:0.7rem;">⚠️ ${row.unapprovedPunches} Pending</span>`;
    } else if (row.totalPunches === 0) {
      statusPill = `<span class="badge badge-outline" style="font-size:0.7rem;">Rostered</span>`;
    }

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>
        <strong style="color:var(--text-primary); font-size:0.88rem;">${row.name}</strong>
        <div style="font-size:0.72rem; color:var(--text-muted);">${row.role}</div>
      </td>
      <td>${typeBadge}</td>
      <td class="text-right" style="font-family:monospace;">$${row.hourlyRate.toFixed(2)}</td>
      <td class="text-right" style="font-weight:600;">${row.ordinaryHours > 0 ? row.ordinaryHours.toFixed(1) + 'h' : '—'}</td>
      <td class="text-right" style="color:#38bdf8;">${row.saturdayHours > 0 ? row.saturdayHours.toFixed(1) + 'h' : '—'}</td>
      <td class="text-right" style="color:#ec4899;">${row.sundayHours > 0 ? row.sundayHours.toFixed(1) + 'h' : '—'}</td>
      <td class="text-right" style="color:#f59e0b;">${row.pubHolidayHours > 0 ? row.pubHolidayHours.toFixed(1) + 'h' : '—'}</td>
      <td class="text-right" style="color:#ef4444;">${row.overtimeHours > 0 ? row.overtimeHours.toFixed(1) + 'h' : '—'}</td>
      <td class="text-right" style="color:#a855f7;">${(row.annualLeaveHours + row.sickLeaveHours) > 0 ? (row.annualLeaveHours + row.sickLeaveHours).toFixed(1) + 'h' : '—'}</td>
      <td class="text-right" style="font-weight:700; color:var(--accent-cyan); font-size:0.92rem;">${row.totalPaidHours.toFixed(1)}h</td>
      <td class="text-right" style="font-weight:700; color:#10b981; font-size:0.95rem;">$${row.grossPay.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
      <td class="text-right" style="color:#34d399; font-size:0.85rem;">${row.isLocum && row.superAmount === 0 ? '—' : '$' + row.superAmount.toFixed(2)}</td>
      <td class="text-center">${statusPill}</td>
    `;
    tbody.appendChild(tr);
  });

  // Table Foot
  const tfoot = document.getElementById('kat-payroll-table-foot');
  if (tfoot) {
    tfoot.innerHTML = `
      <tr class="row-total" style="background:rgba(255,255,255,0.04); font-weight:700;">
        <td colspan="3">STORE GRAND TOTALS</td>
        <td class="text-right">${summary.totals.ordinaryHours.toFixed(1)}h</td>
        <td class="text-right" style="color:#38bdf8;">${summary.totals.saturdayHours.toFixed(1)}h</td>
        <td class="text-right" style="color:#ec4899;">${summary.totals.sundayHours.toFixed(1)}h</td>
        <td class="text-right" style="color:#f59e0b;">${summary.totals.pubHolidayHours.toFixed(1)}h</td>
        <td class="text-right" style="color:#ef4444;">${summary.totals.overtimeHours.toFixed(1)}h</td>
        <td class="text-right" style="color:#a855f7;">${(summary.totals.annualLeaveHours + summary.totals.sickLeaveHours).toFixed(1)}h</td>
        <td class="text-right" style="color:var(--accent-cyan); font-size:1rem;">${summary.totals.totalPaidHours.toFixed(1)}h</td>
        <td class="text-right" style="color:#10b981; font-size:1.05rem;">$${summary.totals.grossWages.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
        <td class="text-right" style="color:#34d399; font-size:0.95rem;">$${summary.totals.superannuation.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
        <td class="text-center">${summary.allTimecardsApproved ? '✅ Verified' : '⚠️ Pending'}</td>
      </tr>
    `;
  }
}

async function approveAllTimecardsForKatWeek() {
  if (!hasManagerPermissions(state.currentUser) && !hasOwnerOrPeterPermissions(state.currentUser)) {
    showToast('Permission denied: Only managers and owners can approve timecards.', 'error');
    return;
  }

  const summary = window.katPayrollState.lastSummaryData;
  if (!summary) return;

  const mon = new Date(summary.monDate + 'T00:00:00');
  const sun = new Date(summary.sunDate + 'T23:59:59');

  const pendingTcs = (state.timecards || []).filter(tc => {
    if (tc.approved) return false;
    const tcDate = new Date(tc.date + 'T00:00:00');
    return tcDate >= mon && tcDate <= sun;
  });

  if (pendingTcs.length === 0) {
    showToast('All timecards for this week are already approved!', 'info');
    return;
  }

  if (!confirm(`Approve and lock all ${pendingTcs.length} pending timecards for the week of ${summary.periodDisplay}?`)) return;

  try {
    for (const tc of pendingTcs) {
      tc.approved = true;
      tc.approvedBy = state.currentUser.name || 'Owner (Katherine/Peter)';
      await BriskDB.updateTimecard(tc);
    }
    showToast(`Successfully approved all ${pendingTcs.length} timecards for payroll!`, 'success');
    renderKatPayrollSummaryModal();
    if (typeof renderReportsPanel === 'function') renderReportsPanel();
  } catch (err) {
    console.error('Batch approve error:', err);
    showToast(`Failed to approve all timecards: ${err.message}`, 'error');
  }
}

async function copyKatPayrollSummaryToClipboard() {
  const summary = window.katPayrollState.lastSummaryData || getWeeklyPayrollSummaryForKatherine(window.katPayrollState.currentWeekStart, window.katPayrollState.mode);
  if (!summary || summary.error) {
    showToast('Unable to copy payroll summary.', 'error');
    return;
  }

  let text = `====================================================\n`;
  text += `AMCAL PHARMACY WOY WOY — WEEKLY PAYROLL SUMMARY\n`;
  text += `Period: Monday ${summary.monDate} to Sunday ${summary.sunDate}\n`;
  text += `Store: Deepwater Plaza, Woy Woy NSW 2256\n`;
  text += `Prepared for: Katherine Nguyen (External Payroll Processing)\n`;
  text += `Mode: ${summary.mode === 'actual' ? 'Approved Timecards (Actual Punches)' : summary.mode === 'scheduled' ? 'Scheduled Roster Hours' : 'Reconciled'}\n`;
  text += `====================================================\n\n`;

  summary.employeeSummaries.forEach((emp, idx) => {
    text += `${idx + 1}. ${emp.name} — ${emp.role} (${emp.employmentType})\n`;
    text += `   • Base Hourly Rate: $${emp.hourlyRate.toFixed(2)}/h\n`;
    text += `   • Ordinary Hours (Mon-Fri): ${emp.ordinaryHours.toFixed(1)}h\n`;
    if (emp.saturdayHours > 0) text += `   • Saturday Hours: ${emp.saturdayHours.toFixed(1)}h (1.25x / 1.5x loading)\n`;
    if (emp.sundayHours > 0) text += `   • Sunday Hours: ${emp.sundayHours.toFixed(1)}h (1.75x / 2.0x loading)\n`;
    if (emp.pubHolidayHours > 0) text += `   • Public Holiday Hours: ${emp.pubHolidayHours.toFixed(1)}h (2.25x / 2.5x loading)\n`;
    if (emp.overtimeHours > 0) text += `   • Overtime Hours: ${emp.overtimeHours.toFixed(1)}h (2.0x / 2.25x penalty)\n`;
    if ((emp.annualLeaveHours + emp.sickLeaveHours) > 0) {
      text += `   • Paid Leave: ${(emp.annualLeaveHours + emp.sickLeaveHours).toFixed(1)}h (Annual: ${emp.annualLeaveHours.toFixed(1)}h | Sick: ${emp.sickLeaveHours.toFixed(1)}h)\n`;
    }
    text += `   • TOTAL PAID HOURS: ${emp.totalPaidHours.toFixed(1)}h\n`;
    text += `   • GROSS WAGES: $${emp.grossPay.toFixed(2)}\n`;
    if (!emp.isLocum || emp.superAmount > 0) {
      text += `   • Superannuation (12% SG): $${emp.superAmount.toFixed(2)}\n`;
    }
    text += `   • Status: ${emp.approvalStatus}\n\n`;
  });

  text += `====================================================\n`;
  text += `GRAND TOTALS TO PROCESS VIA OTHER COMPANY PAYROLL:\n`;
  text += `----------------------------------------------------\n`;
  text += `• Total Gross Wages Payable: $${summary.totals.grossWages.toFixed(2)}\n`;
  text += `• Total Superannuation (12% SG): $${summary.totals.superannuation.toFixed(2)}\n`;
  if (summary.totals.locumInvoices > 0) {
    text += `• Total Locum Invoices: $${summary.totals.locumInvoices.toFixed(2)}\n`;
  }
  text += `• Total Paid Hours: ${summary.totals.totalPaidHours.toFixed(1)}h\n`;
  text += `  (Ordinary: ${summary.totals.ordinaryHours.toFixed(1)}h | Sat: ${summary.totals.saturdayHours.toFixed(1)}h | Sun: ${summary.totals.sundayHours.toFixed(1)}h | Pub Hol: ${summary.totals.pubHolidayHours.toFixed(1)}h | OT: ${summary.totals.overtimeHours.toFixed(1)}h | Leave: ${(summary.totals.annualLeaveHours + summary.totals.sickLeaveHours).toFixed(1)}h)\n`;
  text += `• Timesheet Approval: ${summary.allTimecardsApproved ? '100% Approved & Locked' : `${summary.unapprovedPunches} punches pending approval`}\n`;
  text += `====================================================\n`;

  try {
    await navigator.clipboard.writeText(text);
    showToast('📋 Weekly payroll summary copied to clipboard! Ready to paste into email or WhatsApp for Katherine.', 'success');
  } catch (err) {
    console.error('Clipboard copy error:', err);
    showToast('Failed to copy to clipboard automatically. Check console.', 'error');
  }
}

function downloadKatPayrollBureauCsv() {
  const summary = window.katPayrollState.lastSummaryData || getWeeklyPayrollSummaryForKatherine(window.katPayrollState.currentWeekStart, window.katPayrollState.mode);
  if (!summary || summary.error) {
    showToast('Unable to export CSV.', 'error');
    return;
  }

  const rows = [
    ['Amcal Pharmacy Woy Woy - Weekly Payroll Bureau Summary'],
    [`Period: Monday ${summary.monDate} to Sunday ${summary.sunDate}`],
    [`Prepared for: Katherine Nguyen (External Payroll Processing)`],
    [`Generated: ${new Date().toLocaleString('en-AU')}`],
    [],
    [
      'Employee Name',
      'Role / Department',
      'Employment Type',
      'Award Level',
      'Base Hourly Rate ($/h)',
      'Ordinary Hours (Mon-Fri)',
      'Saturday Hours (h)',
      'Sunday Hours (h)',
      'Public Holiday Hours (h)',
      'Overtime Hours (h)',
      'Annual Leave Hours (h)',
      'Sick / Carer Leave Hours (h)',
      'Total Paid Hours (h)',
      'Gross Wages ($)',
      'Superannuation 12% ($)',
      'Locum Invoice Total ($)',
      'Timesheet Status'
    ]
  ];

  summary.employeeSummaries.forEach(e => {
    rows.push([
      `"${e.name}"`,
      `"${e.role}"`,
      `"${e.employmentType}"`,
      `"${e.awardLevel}"`,
      e.hourlyRate.toFixed(2),
      e.ordinaryHours.toFixed(2),
      e.saturdayHours.toFixed(2),
      e.sundayHours.toFixed(2),
      e.pubHolidayHours.toFixed(2),
      e.overtimeHours.toFixed(2),
      e.annualLeaveHours.toFixed(2),
      e.sickLeaveHours.toFixed(2),
      e.totalPaidHours.toFixed(2),
      e.grossPay.toFixed(2),
      e.superAmount.toFixed(2),
      e.locumInvoice.toFixed(2),
      `"${e.approvalStatus}"`
    ]);
  });

  // Add Grand Totals Row
  rows.push([]);
  rows.push([
    '"GRAND TOTALS"',
    '""',
    '""',
    '""',
    '""',
    summary.totals.ordinaryHours.toFixed(2),
    summary.totals.saturdayHours.toFixed(2),
    summary.totals.sundayHours.toFixed(2),
    summary.totals.pubHolidayHours.toFixed(2),
    summary.totals.overtimeHours.toFixed(2),
    summary.totals.annualLeaveHours.toFixed(2),
    summary.totals.sickLeaveHours.toFixed(2),
    summary.totals.totalPaidHours.toFixed(2),
    summary.totals.grossWages.toFixed(2),
    summary.totals.superannuation.toFixed(2),
    summary.totals.locumInvoices.toFixed(2),
    summary.allTimecardsApproved ? '"All Approved"' : `"${summary.unapprovedPunches} Pending"`
  ]);

  const csvContent = rows.map(r => r.join(',')).join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Amcal_WoyWoy_Payroll_Summary_Mon_Sun_${summary.monDate}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('📥 Downloaded Katherine\'s Payroll Bureau CSV (1 row per employee) successfully!', 'success');
}

function printKatPayrollSummary() {
  document.body.classList.add('printing-kat-payroll');
  window.print();
  setTimeout(() => {
    document.body.classList.remove('printing-kat-payroll');
  }, 1000);
}

/* --- AUTO-GENERATED WINDOW BINDINGS --- */
if (typeof window !== 'undefined') window.getHigherDutiesMinimumRate = getHigherDutiesMinimumRate;
if (typeof window !== 'undefined') window.getEmployeeLaborCostBreakdown = getEmployeeLaborCostBreakdown;
if (typeof window !== 'undefined') window.getDailySalesTargets = getDailySalesTargets;
if (typeof window !== 'undefined') window.saveDailySalesTargets = saveDailySalesTargets;
if (typeof window !== 'undefined') window.getWageKpiHealth = getWageKpiHealth;
if (typeof window !== 'undefined') window.calculateLaborCostForecast = calculateLaborCostForecast;
if (typeof window !== 'undefined') window.recalculateActualSalesReconciliation = recalculateActualSalesReconciliation;
if (typeof window !== 'undefined') window.saveActualPosSales = saveActualPosSales;
if (typeof window !== 'undefined') window.calculateAgeFromDob = calculateAgeFromDob;
if (typeof window !== 'undefined') window.onEmployeeDobChange = onEmployeeDobChange;
if (typeof window !== 'undefined') window.applyJuniorUpgrade = applyJuniorUpgrade;
if (typeof window !== 'undefined') window.openSalesTargetsModal = openSalesTargetsModal;
if (typeof window !== 'undefined') window.recalculateSalesKpiModal = recalculateSalesKpiModal;
if (typeof window !== 'undefined') window.applySalesPreset = applySalesPreset;
if (typeof window !== 'undefined') window.resetSalesToDefault = resetSalesToDefault;
if (typeof window !== 'undefined') window.closeSalesTargetsModal = closeSalesTargetsModal;
if (typeof window !== 'undefined') window.handleSaveSalesTargets = handleSaveSalesTargets;
if (typeof window !== 'undefined') window.triggerClearWeek = triggerClearWeek;
if (typeof window !== 'undefined') window.copyCurrentWeekToNextWeek = copyCurrentWeekToNextWeek;
if (typeof window !== 'undefined') window.triggerAutoScheduler = triggerAutoScheduler;

// Katherine's Weekly Payroll Summary Bindings
if (typeof window !== 'undefined') window.getWeeklyPayrollSummaryForKatherine = getWeeklyPayrollSummaryForKatherine;
if (typeof window !== 'undefined') window.openKatPayrollSummaryModal = openKatPayrollSummaryModal;
if (typeof window !== 'undefined') window.closeKatPayrollSummaryModal = closeKatPayrollSummaryModal;
if (typeof window !== 'undefined') window.changeKatPayrollWeek = changeKatPayrollWeek;
if (typeof window !== 'undefined') window.toggleKatPayrollDataMode = toggleKatPayrollDataMode;
if (typeof window !== 'undefined') window.renderKatPayrollSummaryModal = renderKatPayrollSummaryModal;
if (typeof window !== 'undefined') window.approveAllTimecardsForKatWeek = approveAllTimecardsForKatWeek;
if (typeof window !== 'undefined') window.copyKatPayrollSummaryToClipboard = copyKatPayrollSummaryToClipboard;
if (typeof window !== 'undefined') window.downloadKatPayrollBureauCsv = downloadKatPayrollBureauCsv;
if (typeof window !== 'undefined') window.printKatPayrollSummary = printKatPayrollSummary;
