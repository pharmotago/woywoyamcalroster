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
  const mon = getMondayOfCurrentWeek(state.currentWeekStart || new Date());
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);

  const monStr = formatDateISO(mon);
  const sunStr = formatDateISO(sun);

  // Find all shifts in the currently selected week (safe ISO string comparison)
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
      // Calculate target date by adding exactly 7 days to shift.date (UTC safe)
      const [y, m, d] = shift.date.split('-').map(Number);
      const targetDate = new Date(Date.UTC(y, m - 1, d + 7));
      const targetDateStr = targetDate.toISOString().split('T')[0];

      // Validate employeeId (must match an active/known employee, otherwise null)
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
        role: shift.role || 'Pharmacy Assistant',
        date: targetDateStr,
        startTime: shift.startTime,
        endTime: shift.endTime,
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
    await loadDataFromState();
    renderScheduler();

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
