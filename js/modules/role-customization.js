// Auto-extracted Module: ROLES
// Dynamic Window Globals Access (Live resolution, zero stale undefined closures)
const state = new Proxy({}, {
  get(target, prop) { return window.state ? window.state[prop] : undefined; },
  set(target, prop, value) { if (!window.state) window.state = {}; window.state[prop] = value; return true; }
});
const showToast = (...args) => (window.showToast ? window.showToast(...args) : console.log(...args));
const formatDateISO = (d) => (window.formatDateISO ? window.formatDateISO(d) : (d instanceof Date ? d.toISOString().split('T')[0] : ''));
const formatTimeAmPm = (t) => (window.formatTimeAmPm ? window.formatTimeAmPm(t) : (t || ''));
const hasManagerPermissions = (u) => (window.hasManagerPermissions ? window.hasManagerPermissions(u) : false);
const renderActivePanel = () => (window.renderActivePanel ? window.renderActivePanel() : null);
const getOrderedActiveEmployees = () => (window.getOrderedActiveEmployees ? window.getOrderedActiveEmployees() : (window.state?.employees || []).filter(e => e.active));
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/* ==========================================================================
   ROLE CUSTOMIZATION HANDLERS
   ========================================================================== */

function hexToRgb(hex) {
  if (!hex || typeof hex !== 'string') return '79, 70, 229';
  const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
  const fullHex = hex.replace(shorthandRegex, (m, r, g, b) => r + r + g + g + b + b);
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(fullHex);
  return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : '79, 70, 229';
}

function renderRolesSettingsList() {
  const container = document.getElementById('roles-settings-list');
  if (!container) return;

  container.innerHTML = '';
  
  if (state.roles.length === 0) {
    container.innerHTML = '<div class="text-muted">No custom roles defined.</div>';
    return;
  }

  state.roles.forEach(role => {
    const div = document.createElement('div');
    div.className = 'role-item-row';
    div.style.display = 'flex';
    div.style.alignItems = 'center';
    div.style.gap = '8px';
    div.style.padding = '8px';
    div.style.background = 'var(--bg-card)';
    div.style.border = '1px solid var(--border-color)';
    div.style.borderRadius = 'var(--radius-sm)';

    div.innerHTML = `
      <input type="text" value="${role.name}" class="form-control" style="flex:1; height:34px; font-size:0.9rem;" onchange="handleRoleNameChange('${role.id}', this.value)">
      <input type="color" value="${role.color}" style="width:34px; height:34px; padding:0 2px; cursor:pointer; border:1px solid var(--border-color); border-radius:var(--radius-sm); background:transparent;" onchange="handleRoleColorChange('${role.id}', this.value)">
      <button class="btn btn-danger btn-icon" style="height:34px; width:34px; padding:0; display:flex; align-items:center; justify-content:center;" onclick="handleRoleDelete('${role.id}')"><i class="fa-solid fa-trash-can"></i></button>
    `;
    container.appendChild(div);
  });
}

async function handleAddRoleSubmit(event) {
  event.preventDefault();
  const nameInput = document.getElementById('new-role-name');
  const colorInput = document.getElementById('new-role-color');
  if (!nameInput || !colorInput) return;

  const name = nameInput.value.trim();
  const color = colorInput.value;

  if (!name) return;

  if (state.roles.some(r => r.name.toLowerCase() === name.toLowerCase())) {
    showToast('A role with this name already exists.', 'error');
    return;
  }

  try {
    await BriskDB.addRole({ name, color });
    nameInput.value = '';
    showToast('Role added successfully.', 'success');
    loadDataFromState();
    renderRolesSettingsList();
  } catch (err) {
    showToast('Failed to add role.', 'error');
  }
}

async function handleRoleNameChange(id, newName) {
  const name = newName.trim();
  if (!name) return;

  const role = state.roles.find(r => r.id === id);
  if (!role) return;

  if (role.name === name) return;

  if (state.roles.some(r => r.id !== id && r.name.toLowerCase() === name.toLowerCase())) {
    showToast('Another role already has this name.', 'error');
    loadDataFromState();
    renderRolesSettingsList();
    return;
  }

  try {
    role.name = name;
    await BriskDB.updateRole(role);
    showToast('Role name updated.', 'success');
    loadDataFromState();
    renderRolesSettingsList();
  } catch (err) {
    showToast('Failed to update role name.', 'error');
  }
}

async function handleRoleColorChange(id, newColor) {
  const role = state.roles.find(r => r.id === id);
  if (!role) return;

  if (role.color === newColor) return;

  try {
    role.color = newColor;
    await BriskDB.updateRole(role);
    showToast('Role color updated.', 'success');
    loadDataFromState();
    renderScheduler();
    renderRolesSettingsList();
  } catch (err) {
    showToast('Failed to update role color.', 'error');
  }
}

async function handleRoleDelete(id) {
  if (!confirm('Are you sure you want to delete this role? Any employee or shift assigned to this role will remain assigned, but the role color coding will be lost.')) {
    return;
  }

  try {
    await BriskDB.deleteRole(id);
    showToast('Role deleted successfully.', 'success');
    loadDataFromState();
    renderRolesSettingsList();
  } catch (err) {
    showToast('Failed to delete role.', 'error');
  }
}

function renderPositionsSettingsList() {
  const container = document.getElementById('positions-settings-list');
  if (!container) return;

  container.innerHTML = '';
  
  if (state.positions.length === 0) {
    container.innerHTML = '<div class="text-muted">No custom positions defined.</div>';
    return;
  }

  state.positions.forEach(pos => {
    const div = document.createElement('div');
    div.className = 'position-item-row';
    div.style.display = 'flex';
    div.style.alignItems = 'center';
    div.style.gap = '8px';
    div.style.padding = '8px';
    div.style.background = 'var(--bg-card)';
    div.style.border = '1px solid var(--border-color)';
    div.style.borderRadius = 'var(--radius-sm)';

    div.innerHTML = `
      <input type="text" value="${pos.name}" class="form-control" style="flex:1; height:34px; font-size:0.9rem;" onchange="handlePositionNameChange('${pos.id}', this.value)">
      <button class="btn btn-danger btn-icon" style="height:34px; width:34px; padding:0; display:flex; align-items:center; justify-content:center;" onclick="handlePositionDelete('${pos.id}')"><i class="fa-solid fa-trash-can"></i></button>
    `;
    container.appendChild(div);
  });
}

async function handleAddPositionSubmit(event) {
  event.preventDefault();
  const nameInput = document.getElementById('new-position-name');
  if (!nameInput) return;

  const name = nameInput.value.trim();
  if (!name) return;

  if (state.positions.some(p => p.name.toLowerCase() === name.toLowerCase())) {
    showToast('A position with this name already exists.', 'error');
    return;
  }

  try {
    await BriskDB.addPosition(name);
    nameInput.value = '';
    showToast('Position added successfully.', 'success');
    loadDataFromState();
    renderPositionsSettingsList();
  } catch (err) {
    showToast('Failed to add position.', 'error');
  }
}

async function handlePositionNameChange(id, newName) {
  const name = newName.trim();
  if (!name) return;

  const pos = state.positions.find(p => p.id === id);
  if (!pos) return;

  if (pos.name === name) return;

  if (state.positions.some(p => p.id !== id && p.name.toLowerCase() === name.toLowerCase())) {
    showToast('Another position already has this name.', 'error');
    loadDataFromState();
    renderPositionsSettingsList();
    return;
  }

  try {
    pos.name = name;
    await BriskDB.updatePosition(pos);
    showToast('Position name updated.', 'success');
    loadDataFromState();
    renderPositionsSettingsList();
  } catch (err) {
    showToast('Failed to update position name.', 'error');
  }
}

async function handlePositionDelete(id) {
  if (!confirm('Are you sure you want to delete this position? Employees with this default position will remain assigned, but it will no longer show in the register options.')) {
    return;
  }

  try {
    await BriskDB.deletePosition(id);
    showToast('Position deleted successfully.', 'success');
    loadDataFromState();
    renderPositionsSettingsList();
  } catch (err) {
    showToast('Failed to delete position.', 'error');
  }
}

function updatePasteButtonState() {
  const pasteContainer = document.getElementById('shift-paste-container');
  if (!pasteContainer) return;
  
  if (state.copiedShift) {
    pasteContainer.style.display = 'block';
    pasteContainer.innerHTML = `
      <button type="button" class="btn btn-outline btn-block" onclick="pasteCopiedShiftDetails()" style="border-style: dashed; border-color: var(--accent-cyan); display: flex; align-items: center; justify-content: center; gap: 8px;">
        <i class="fa-regular fa-clipboard"></i> Paste Copied Shift (${formatTimeAmPm(state.copiedShift.startTime)} - ${formatTimeAmPm(state.copiedShift.endTime)} ${state.copiedShift.role})
      </button>
    `;
  } else {
    pasteContainer.style.display = 'none';
  }
}

function pasteCopiedShiftDetails() {
  if (!state.copiedShift) return;
  
  const roleSelect = document.getElementById('shift-role');
  if (roleSelect) roleSelect.value = state.copiedShift.role;
  
  const startInput = document.getElementById('shift-start');
  if (startInput) startInput.value = state.copiedShift.startTime;
  
  const endInput = document.getElementById('shift-end');
  if (endInput) endInput.value = state.copiedShift.endTime;
  
  const notesInput = document.getElementById('shift-notes');
  if (notesInput) notesInput.value = state.copiedShift.notes || '';
  
  showToast('Copied shift details pasted!', 'success');
}

window.renderRolesSettingsList = renderRolesSettingsList;
window.handleAddRoleSubmit = handleAddRoleSubmit;
window.handleRoleNameChange = handleRoleNameChange;
window.handleRoleColorChange = handleRoleColorChange;
window.handleRoleDelete = handleRoleDelete;
window.renderPositionsSettingsList = renderPositionsSettingsList;
window.handleAddPositionSubmit = handleAddPositionSubmit;
window.handlePositionNameChange = handlePositionNameChange;
window.handlePositionDelete = handlePositionDelete;
window.pasteCopiedShiftDetails = pasteCopiedShiftDetails;
window.hexToRgb = hexToRgb;
window.updatePasteButtonState = updatePasteButtonState;
// in app.js
// in app.js

window.openChangePasswordModal = function() {
  document.getElementById('modal-change-password').classList.add('active');
};

window.closeChangePasswordModal = function() {
  document.getElementById('modal-change-password').classList.remove('active');
  const newPass = document.getElementById('change-new-password');
  const confirmPass = document.getElementById('change-confirm-password');
  if (newPass) newPass.value = '';
  if (confirmPass) confirmPass.value = '';
};

window.handleChangePasswordSubmit = async function(event) {
  event.preventDefault();
  const newPass = document.getElementById('change-new-password').value;
  const confirmPass = document.getElementById('change-confirm-password').value;

  if (newPass !== confirmPass) {
    showToast('Passwords do not match.', 'error');
    return;
  }

  const submitBtn = event.target.querySelector('button[type="submit"]');
  const origText = submitBtn.innerHTML;
  submitBtn.disabled = true;
  submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Updating...';

  try {
    const res = await BriskDB.apiUpdatePassword(newPass);
    if (res.error) throw new Error(res.error);

    showToast('Password changed successfully!', 'success');
    closeChangePasswordModal();
  } catch (err) {
    showToast(err.message || 'Failed to update password.', 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = origText;
  }
};

window.triggerGlobalRefresh = async function() {
  if (state.isRefreshing) return; // Prevent duplicate concurrent sync requests
  state.isRefreshing = true;

  const refreshBtn = document.getElementById('btn-global-refresh');
  const icon = refreshBtn ? refreshBtn.querySelector('i') : null;
  
  if (refreshBtn) refreshBtn.disabled = true;
  if (icon) icon.classList.add('fa-spin');
  showToast('Refreshing data from Supabase...', 'info');

  try {
    // Force sync and reload
    await BriskDB.syncFromServer();
    loadDataFromState();
    renderActivePanel();
    showToast('Data refreshed successfully!', 'success');
  } catch (err) {
    showToast('Failed to refresh: ' + err.message, 'error');
  } finally {
    state.isRefreshing = false;
    if (refreshBtn) refreshBtn.disabled = false;
    if (icon) {
      setTimeout(() => {
        icon.classList.remove('fa-spin');
      }, 700);
    }
  }
};

// --- Trading Hours and Daily View Helpers ---

const DEFAULT_TRADING_HOURS = {
  "1": { "open": "08:30", "close": "17:30", "closed": false },
  "2": { "open": "08:30", "close": "17:30", "closed": false },
  "3": { "open": "08:30", "close": "17:30", "closed": false },
  "4": { "open": "08:30", "close": "17:30", "closed": false },
  "5": { "open": "08:30", "close": "17:30", "closed": false },
  "6": { "open": "09:00", "close": "13:00", "closed": false },
  "0": { "open": "00:00", "close": "00:00", "closed": true }
};

function timeToDecimal(timeStr) {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return h + m / 60;
}
window.timeToDecimal = timeToDecimal;

function getAwardBreakEntitlements(grossHours) {
  if (grossHours < 4) {
    return { paidBreaks: 0, unpaidMealMins: 0, description: 'No breaks required (< 4h)' };
  } else if (grossHours < 5) {
    return { paidBreaks: 1, unpaidMealMins: 0, description: 'No breaks required' };
  } else if (grossHours < 7.6) {
    return { paidBreaks: 1, unpaidMealMins: 30, description: '🍱 1x 30m Unpaid Lunch' };
  } else {
    return { paidBreaks: 2, unpaidMealMins: 30, description: '🍱 1x 30m Unpaid Lunch' };
  }
}
window.getAwardBreakEntitlements = getAwardBreakEntitlements;

function calculateShiftHours(start, end, unpaidMealMins = null) {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  let diffMinutes = (eh * 60 + em) - (sh * 60 + sm);
  if (diffMinutes < 0) diffMinutes += 24 * 60; // Overnight shift midnight crossover
  
  const grossHours = diffMinutes / 60;
  let mealMins = 0;
  if (unpaidMealMins === 'crib_paid') {
    mealMins = 0; // Paid Crib Break has 0 unpaid minutes deducted
  } else if (unpaidMealMins === null || unpaidMealMins === undefined || unpaidMealMins === 'auto') {
    mealMins = grossHours >= 5 ? 30 : 0;
  } else {
    mealMins = parseInt(unpaidMealMins, 10) || 0;
  }
  
  const netMinutes = Math.max(0, diffMinutes - mealMins);
  return Math.max(0, parseFloat((netMinutes / 60).toFixed(2)));
}
window.calculateShiftHours = calculateShiftHours;

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
      const restText = '';
      summaryEl.textContent = `${mealText}`;
    }
  }

  if (netHoursInput) {
    netHoursInput.value = `${netHours.toFixed(1)}h`;
  }

  // Live Overtime Progress in Shift Modal
  const empSelect = document.getElementById('shift-employee');
  const shiftDate = document.getElementById('shift-date')?.value;
  const otText = document.getElementById('shift-weekly-ot-text');
  const otBadge = document.getElementById('shift-weekly-ot-badge');
  const shiftId = document.getElementById('shift-id')?.value;

  if (empSelect && empSelect.value && shiftDate && otText) {
    const emp = state.employees.find(e => e.id === empSelect.value);
    if (emp) {
      const maxH = emp.maxHours || 38;
      const currentWeekHours = calculateEmployeeWeekHours(emp.id, getMondayOfCurrentWeek(new Date(shiftDate)));
      
      let prevShiftHours = 0;
      if (shiftId) {
        const prevShift = state.shifts.find(s => s.id === shiftId);
        if (prevShift && prevShift.employeeId === emp.id) {
          prevShiftHours = calculateShiftHours(prevShift.startTime, prevShift.endTime, prevShift.unpaidMealMins);
        }
      }
      
      const newTotalWeekHours = Math.max(0, currentWeekHours - prevShiftHours + netHours);
      const otHours = newTotalWeekHours > maxH ? (newTotalWeekHours - maxH) : 0;
      
      if (otText) {
        otText.innerHTML = `<i class="fa-solid fa-clock-rotate-left" style="color:var(--accent-cyan);"></i> Weekly Hours: <strong>${newTotalWeekHours.toFixed(1)}h / ${maxH}h</strong> (Current: ${currentWeekHours.toFixed(1)}h + Shift: ${netHours.toFixed(1)}h)`;
      }
      if (otBadge) {
        if (otHours > 0) {
          otBadge.style.display = 'inline-block';
          otBadge.className = 'badge';
          otBadge.style.background = 'rgba(239, 68, 68, 0.2)';
          otBadge.style.color = '#f87171';
          otBadge.style.border = '1px solid rgba(239, 68, 68, 0.4)';
          otBadge.textContent = `+${otHours.toFixed(1)}h OT Incurred`;
        } else {
          otBadge.style.display = 'inline-block';
          otBadge.className = 'badge badge-success';
          otBadge.textContent = `Within Target (${(maxH - newTotalWeekHours).toFixed(1)}h rem)`;
        }
      }
    } else {
      if (otText) otText.innerHTML = `<i class="fa-solid fa-clock-rotate-left" style="color:var(--accent-cyan);"></i> Unassigned Shift: <strong>${netHours.toFixed(1)}h</strong>`;
      if (otBadge) otBadge.style.display = 'none';
    }
  } else if (otText) {
    otText.innerHTML = `<i class="fa-solid fa-clock-rotate-left" style="color:var(--accent-cyan);"></i> Unassigned Shift: <strong>${netHours.toFixed(1)}h</strong>`;
    if (otBadge) otBadge.style.display = 'none';
  }
}
window.updateShiftBreakSummary = updateShiftBreakSummary;

function renderSettingsPanel() {
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

  // Also prefill Organization Name
  const settingsName = document.getElementById('settings-company-name');
  if (settingsName) settingsName.value = state.settings.companyName || 'Amcal Pharmacy Woywoy Rosters';

  // Render recent audit logs in settings card
  const recentAuditList = document.getElementById('settings-recent-audit-list');
  if (recentAuditList) {
    recentAuditList.innerHTML = '';
    const logs = (typeof BriskDB.getAuditLogs === 'function') ? BriskDB.getAuditLogs().slice(0, 5) : [];
    if (logs.length === 0) {
      recentAuditList.innerHTML = '<span class="text-muted" style="padding:4px 0;">No audit events recorded yet.</span>';
    } else {
      logs.forEach(l => {
        const item = document.createElement('div');
        item.style.padding = '6px 8px';
        item.style.background = 'rgba(255,255,255,0.02)';
        item.style.borderRadius = 'var(--radius-sm)';
        item.style.border = '1px solid var(--border-glass)';
        item.innerHTML = `
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <strong style="color:var(--text-primary); font-size:0.78rem;">${l.actorName || 'System'} · <span style="color:var(--accent-cyan);">${l.action}</span></strong>
            <span style="font-size:0.7rem; color:var(--text-muted);">${(l.timestamp || '').slice(11, 19)}</span>
          </div>
          <div style="color:var(--text-secondary); font-size:0.74rem; margin-top:2px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${l.details}</div>
        `;
        recentAuditList.appendChild(item);
      });
    }
  }

  // Dynamic Guard: Ensure Owner option is present in invite-role dropdown (forces instant UI update even if cached HTML)
  const inviteRoleSelect = document.getElementById('invite-role');
  if (inviteRoleSelect && !inviteRoleSelect.querySelector('option[value="owner"]')) {
    const ownerOpt = document.createElement('option');
    ownerOpt.value = 'owner';
    ownerOpt.textContent = 'Owner (Full administrative access & system owner)';
    inviteRoleSelect.appendChild(ownerOpt);
  }
}
window.renderSettingsPanel = renderSettingsPanel;

function toggleTradingDayClosed(dayNum) {
  const closedCheckbox = document.getElementById(`trading-closed-${dayNum}`);
  const openInput = document.getElementById(`trading-open-${dayNum}`);
  const closeInput = document.getElementById(`trading-close-${dayNum}`);
  
  if (closedCheckbox && openInput && closeInput) {
    const isClosed = closedCheckbox.checked;
    openInput.disabled = isClosed;
    closeInput.disabled = isClosed;
  }
}
window.toggleTradingDayClosed = toggleTradingDayClosed;

async function saveTradingHours(event) {
  event.preventDefault();
  const th = {};
  
  for (let d = 0; d < 7; d++) {
    const closedCheckbox = document.getElementById(`trading-closed-${d}`);
    const openInput = document.getElementById(`trading-open-${d}`);
    const closeInput = document.getElementById(`trading-close-${d}`);
    const isClosed = closedCheckbox ? closedCheckbox.checked : false;
    const openVal = openInput ? openInput.value : '08:30';
    const closeVal = closeInput ? closeInput.value : '17:30';

    if (!isClosed && openVal >= closeVal) {
      showToast(`Trading hours for ${DAY_NAMES[d]} are invalid (Opening time must be earlier than Closing time).`, 'error');
      return;
    }

    th[String(d)] = {
      closed: isClosed,
      open: openVal,
      close: closeVal
    };
  }
  
  const submitBtn = event.target.querySelector('button[type="submit"]');
  const origText = submitBtn ? submitBtn.innerHTML : 'Save Trading Hours';
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';
  }
  
  try {
    const updatedSettings = {
      ...state.settings,
      tradingHours: th
    };
    await BriskDB.saveSettings(updatedSettings);
    state.settings = updatedSettings;
    showToast('Pharmacy Trading Hours saved successfully!', 'success');
  } catch (err) {
    console.error('Save Trading Hours Error:', err);
    showToast('Failed to save trading hours: ' + err.message, 'error');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = origText;
    }
  }
}
window.saveTradingHours = saveTradingHours;

function adjustDailyDate(offset) {
  const d = new Date(state.dailyDate);
  d.setDate(state.dailyDate.getDate() + offset);
  state.dailyDate = d;
  renderDailyPanel();
}
window.adjustDailyDate = adjustDailyDate;

function setDailyDateToday() {
  state.dailyDate = new Date();
  renderDailyPanel();
}
window.setDailyDateToday = setDailyDateToday;

function renderDailyPanel() {
  if (!window.state) window.state = {};
  if (!window.state.dailyDate || isNaN(new Date(window.state.dailyDate).getTime())) {
    window.state.dailyDate = new Date();
  }
  const dateDisplay = document.getElementById('daily-date-display');
  if (dateDisplay) {
    // Australian Date Format: Friday, 10 July 2026
    const options = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
    dateDisplay.textContent = window.state.dailyDate.toLocaleDateString('en-AU', options);
  }
  
  const dateStr = (typeof formatDateISO === 'function') ? formatDateISO(window.state.dailyDate) : window.state.dailyDate.toISOString().split('T')[0];
  const shifts = (window.state && window.state.shifts) ? window.state.shifts : [];
  const dayShifts = shifts.filter(s => s.date === dateStr);
  
  // Sort shifts by start time
  dayShifts.sort((a, b) => {
    return timeToDecimal(a.startTime) - timeToDecimal(b.startTime);
  });

  // Render Hourly Staffing Density Heatmap Matrix
  const heatmapContainer = document.getElementById('daily-hourly-heatmap');
  if (heatmapContainer) {
    heatmapContainer.innerHTML = '';
    const dayOfWeek = state.dailyDate.getDay();
    const th = (state.settings && state.settings.tradingHours) 
      ? state.settings.tradingHours[String(dayOfWeek)] 
      : DEFAULT_TRADING_HOURS[String(dayOfWeek)];
    const isClosedDay = th ? th.closed : (dayOfWeek === 0);
    const openH = th && !th.closed ? timeToDecimal(th.open) : 8.5;
    const closeH = th && !th.closed ? timeToDecimal(th.close) : 17.5;

    for (let h = 8; h <= 20; h++) {
      const slotStart = h;
      const slotEnd = h + 1;
      const hourLabel = h === 12 ? '12pm' : (h > 12 ? `${h-12}pm` : `${h}am`);
      
      const activeInSlot = dayShifts.filter(s => {
        const sStart = timeToDecimal(s.startTime);
        let sEnd = timeToDecimal(s.endTime);
        if (sEnd <= sStart) sEnd += 24;
        return sStart < slotEnd && sEnd > slotStart;
      });

      const totalCount = activeInSlot.length;
      const pharmCount = activeInSlot.filter(s => {
        const r = (s.role || '').toLowerCase();
        return r.includes('pharmacist') || r.includes('pic') || r.includes('locum') || r.includes('manager');
      }).length;
      const techCount = activeInSlot.filter(s => {
        const r = (s.role || '').toLowerCase();
        return r.includes('technician') || r.includes('dispensary') || r.includes('webster');
      }).length;
      const assistCount = Math.max(0, totalCount - pharmCount - techCount);

      const isOpenHour = !isClosedDay && (h >= Math.floor(openH) && h < Math.ceil(closeH));

      let bg = 'rgba(255,255,255,0.03)';
      let border = '1px solid var(--border-glass)';
      let statusColor = 'var(--text-muted)';
      let densityText = '0 staff';

      if (totalCount === 0) {
        if (isOpenHour) {
          bg = 'rgba(239, 68, 68, 0.18)';
          border = '1px solid #ef4444';
          statusColor = '#f87171';
          densityText = '⚠️ 0 Staff';
        } else {
          densityText = 'Closed';
        }
      } else if (pharmCount === 0 && isOpenHour) {
        bg = 'rgba(245, 158, 11, 0.15)';
        border = '1px dashed #f59e0b';
        statusColor = '#fbbf24';
        densityText = `⚠️ ${totalCount} (No Pharm)`;
      } else if (totalCount === 1) {
        bg = 'rgba(245, 158, 11, 0.12)';
        border = '1px solid rgba(245, 158, 11, 0.3)';
        statusColor = '#fbbf24';
        densityText = '1 Solo';
      } else if (totalCount <= 3) {
        bg = 'rgba(16, 185, 129, 0.12)';
        border = '1px solid rgba(16, 185, 129, 0.3)';
        statusColor = '#34d399';
        densityText = `${totalCount} Staff`;
      } else {
        bg = 'rgba(0, 229, 255, 0.15)';
        border = '1px solid rgba(0, 229, 255, 0.4)';
        statusColor = 'var(--accent-cyan)';
        densityText = `🔥 ${totalCount} Peak`;
      }

      const cell = document.createElement('div');
      cell.style.padding = '8px 4px';
      cell.style.background = bg;
      cell.style.border = border;
      cell.style.borderRadius = 'var(--radius-sm)';
      cell.style.textAlign = 'center';
      cell.style.display = 'flex';
      cell.style.flexDirection = 'column';
      cell.style.justifyContent = 'space-between';
      cell.style.minHeight = '72px';
      cell.title = `${hourLabel}: ${totalCount} active staff (${pharmCount} Pharmacists, ${techCount} Techs, ${assistCount} Assistants)`;

      cell.innerHTML = `
        <div style="font-weight:700; font-size:0.75rem; color:var(--text-primary);">${hourLabel}</div>
        <div style="font-size:0.72rem; font-weight:700; color:${statusColor}; margin:2px 0;">${densityText}</div>
        <div style="font-size:0.68rem; color:var(--text-muted); display:flex; justify-content:center; gap:2px; flex-wrap:wrap;">
          ${pharmCount > 0 ? `<span style="color:#10b981;" title="${pharmCount} Pharmacist(s)">💊${pharmCount}</span>` : ''}
          ${techCount > 0 ? `<span style="color:#a855f7;" title="${techCount} Tech/Webster">🧪${techCount}</span>` : ''}
          ${assistCount > 0 ? `<span style="color:#f59e0b;" title="${assistCount} Assistant(s)">🛒${assistCount}</span>` : ''}
        </div>
      `;
      heatmapContainer.appendChild(cell);
    }
  }

  // Calculate Daily Dispensing Safety Ratio KPI
  const scriptsInput = document.getElementById('daily-scripts-input');
  const safetyBadge = document.getElementById('daily-dispensing-safety-badge');
  const pharmHoursText = document.getElementById('daily-pharm-hours-text');

  if (safetyBadge && pharmHoursText) {
    const dailyScripts = parseInt(scriptsInput ? scriptsInput.value : '250', 10) || 250;
    
    // Sum active pharmacist hours
    let totalPharmHours = 0;
    dayShifts.forEach(s => {
      const r = (s.role || '').toLowerCase();
      if (r.includes('pharmacist') || r.includes('pic') || r.includes('locum') || r.includes('manager')) {
        totalPharmHours += calculateShiftHours(s.startTime, s.endTime, s.unpaidMealMins);
      }
    });

    pharmHoursText.textContent = `Pharmacist Coverage: ${totalPharmHours.toFixed(1)}h`;

    if (totalPharmHours === 0) {
      safetyBadge.className = 'badge badge-danger';
      safetyBadge.textContent = '🔴 0 Pharmacists Scheduled (High Clinical Risk)';
    } else {
      const scriptsPerHour = parseFloat((dailyScripts / totalPharmHours).toFixed(1));
      const scriptsPer8hShift = Math.round(scriptsPerHour * 8);

      if (scriptsPer8hShift <= 160) {
        safetyBadge.className = 'badge badge-success';
        safetyBadge.style.background = 'rgba(16, 185, 129, 0.15)';
        safetyBadge.style.color = '#34d399';
        safetyBadge.style.border = '1px solid rgba(16, 185, 129, 0.3)';
        safetyBadge.textContent = `🟢 Optimal Safety (${scriptsPerHour} scripts/h · ~${scriptsPer8hShift}/shift)`;
      } else if (scriptsPer8hShift <= 220) {
        safetyBadge.className = 'badge badge-warning';
        safetyBadge.style.background = 'rgba(245, 158, 11, 0.15)';
        safetyBadge.style.color = '#fbbf24';
        safetyBadge.style.border = '1px solid rgba(245, 158, 11, 0.3)';
        safetyBadge.textContent = `🟡 Moderate Busy (${scriptsPerHour} scripts/h · ~${scriptsPer8hShift}/shift)`;
      } else {
        safetyBadge.className = 'badge badge-danger';
        safetyBadge.style.background = 'rgba(239, 68, 68, 0.18)';
        safetyBadge.style.color = '#f87171';
        safetyBadge.style.border = '1px solid #ef4444';
        safetyBadge.textContent = `🔴 Dispensing Overload Risk (${scriptsPerHour} scripts/h · ~${scriptsPer8hShift}/shift)`;
      }
    }
  }
  
  // Render timeline visual
  const timelineVisual = document.getElementById('daily-timeline-visual');
  const timelineLabels = document.getElementById('daily-timeline-labels');
  
  if (timelineVisual && timelineLabels) {
    timelineVisual.innerHTML = '';
    timelineLabels.innerHTML = '';
    
    // Get trading hours for the active day of week
    const dayOfWeek = state.dailyDate.getDay();
    const th = (state.settings && state.settings.tradingHours) 
      ? state.settings.tradingHours[String(dayOfWeek)] 
      : DEFAULT_TRADING_HOURS[String(dayOfWeek)];
    
    if (th && th.closed) {
      timelineVisual.innerHTML = `
        <div style="text-align: center; line-height: 60px; color: var(--text-danger); font-weight: 600;">
          <i class="fa-solid fa-store-slash"></i> Pharmacy Closed Today
        </div>
      `;
      timelineVisual.style.height = '60px';
    } else {
      // Determine timeline range: start 30m before open, end 30m after close (default to 8am - 6pm if closed/missing)
      const openHour = th ? timeToDecimal(th.open) : 8.5;
      const closeHour = th ? timeToDecimal(th.close) : 17.5;
      const timelineStart = Math.floor(openHour - 0.5);
      const timelineEnd = Math.ceil(closeHour + 0.5);
      const span = timelineEnd - timelineStart;
      
      // Render hours markers/labels
      for (let h = timelineStart; h <= timelineEnd; h++) {
        const spanLabel = document.createElement('span');
        const hour12 = h % 12 === 0 ? 12 : h % 12;
        const ampm = h >= 12 ? 'pm' : 'am';
        spanLabel.textContent = `${hour12}${ampm}`;
        timelineLabels.appendChild(spanLabel);
      }
      
      // Render visual timeline bars stacked vertically to handle overlap
      let rowCount = 0;
      dayShifts.forEach((s, idx) => {
        const emp = state.employees.find(e => e.id === s.employeeId);
        const empName = emp ? emp.name : 'Unassigned Shift';
        
        const left = Math.max(0, Math.min(100, ((timeToDecimal(s.startTime) - timelineStart) / span) * 100));
        const width = Math.max(1, Math.min(100 - left, ((timeToDecimal(s.endTime) - timeToDecimal(s.startTime)) / span) * 100));
        const roleColor = state.roles.find(r => r.name.toLowerCase() === s.role.toLowerCase())?.color || '#ef4444';
        
        const rowTop = 10 + (idx * 28);
        rowCount++;
        
        const bar = document.createElement('div');
        bar.className = 'timeline-bar';
        bar.style.position = 'absolute';
        bar.style.left = `${left}%`;
        bar.style.width = `${width}%`;
        bar.style.top = `${rowTop}px`;
        bar.style.height = '22px';
        bar.style.background = roleColor;
        bar.style.opacity = '0.9';
        bar.style.borderRadius = 'var(--radius-sm)';
        bar.style.fontSize = '0.75rem';
        bar.style.color = '#fff';
        bar.style.padding = '0 8px';
        bar.style.whiteSpace = 'nowrap';
        bar.style.overflow = 'hidden';
        bar.style.textOverflow = 'ellipsis';
        bar.style.lineHeight = '22px';
        bar.style.fontWeight = '500';
        const grossHours = calculateShiftHours(s.startTime, s.endTime, 0);
        const breakEntitlement = getAwardBreakEntitlements(grossHours);
        const unpaidMeal = (s.unpaidMealMins !== undefined && s.unpaidMealMins !== null) ? s.unpaidMealMins : breakEntitlement.unpaidMealMins;

        let breakSummary = '';
        if (grossHours >= 4) {
          const parts = [];
          if (unpaidMeal > 0) parts.push(`${unpaidMeal}m Lunch`);
          
          breakSummary = parts.join(' + ');
        }

        bar.title = `${empName}: ${formatTimeAmPm(s.startTime)} - ${formatTimeAmPm(s.endTime)} (${s.role}) | ${breakEntitlement.description}`;
        bar.innerHTML = `<span style="font-weight:600;">${empName} (${s.role})</span>${breakSummary ? ` <span style="font-size:0.68rem; opacity:0.95; background:rgba(0,0,0,0.38); padding:1px 6px; border-radius:4px; margin-left:6px; display:inline-flex; align-items:center; gap:4px; vertical-align:middle;"><i class="fa-solid fa-mug-hot" style="font-size:0.65rem; color:#0ea5e9;"></i> ${breakSummary}</span>` : ''}`;
        
        timelineVisual.appendChild(bar);
      });
      
      // Adjust timeline container height dynamically
      timelineVisual.style.height = `${Math.max(60, rowCount * 28 + 20)}px`;

      // === Coverage Gap Warning (Clean & Deduplicated) ===
      // Remove any previously appended gap warnings to avoid duplicate stacking
      if (timelineVisual && timelineVisual.parentElement) {
        timelineVisual.parentElement.querySelectorAll('.daily-gap-container').forEach(el => el.remove());
      }

      if (dayShifts.length > 0 && th && !th.closed) {
        const gapWarnings = [];
        const activeOpenHour = timeToDecimal(th.open);
        const activeCloseHour = timeToDecimal(th.close);

        // Only scan during OPEN trading hours
        for (let t = activeOpenHour; t < activeCloseHour; t += 0.5) {
          const slotStart = t;
          const slotEnd = t + 0.5;
          const staffInSlot = dayShifts.filter(s => {
            const sStart = timeToDecimal(s.startTime);
            let sEnd = timeToDecimal(s.endTime);
            if (sEnd <= sStart) sEnd += 24;
            return sStart < slotEnd && sEnd > slotStart;
          });
          const pharmacistsInSlot = staffInSlot.filter(s => {
            const r = (s.role || '').toLowerCase().trim();
            return r.includes('pharmacist') || r.includes('pic') || r.includes('locum') || r.includes('manager');
          });

          if (staffInSlot.length <= 1 && staffInSlot.length > 0) {
            const h = Math.floor(slotStart);
            const m = (slotStart % 1) * 60;
            const timeLabel = formatTimeAmPm(`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`);
            gapWarnings.push({ type: 'low', time: timeLabel, detail: `${staffInSlot.length} staff only` });
          }
          if (pharmacistsInSlot.length === 0) {
            const h = Math.floor(slotStart);
            const m = (slotStart % 1) * 60;
            const timeLabel = formatTimeAmPm(`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`);
            gapWarnings.push({ type: 'pharmacist', time: timeLabel, detail: 'No Pharmacist' });
          }
        }

        if (gapWarnings.length > 0) {
          const gapContainer = document.createElement('div');
          gapContainer.className = 'daily-gap-container';
          gapContainer.style.cssText = 'margin-top:8px; display:flex; flex-wrap:wrap; gap:6px;';

          const hasLowStaff = gapWarnings.some(g => g.type === 'low');
          const hasNoPharmacist = gapWarnings.some(g => g.type === 'pharmacist');
          const pharmacistGapCount = gapWarnings.filter(g => g.type === 'pharmacist').length;
          const lowStaffCount = gapWarnings.filter(g => g.type === 'low').length;

          if (hasNoPharmacist) {
            const badge = document.createElement('span');
            badge.style.cssText = 'display:inline-flex; align-items:center; gap:5px; padding:4px 10px; background:rgba(239,68,68,0.1); border:1px solid rgba(239,68,68,0.3); color:#ef4444; border-radius:6px; font-size:0.78rem; font-weight:600;';
            badge.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> No Pharmacist coverage in ${pharmacistGapCount} time slot${pharmacistGapCount > 1 ? 's' : ''}`;
            gapContainer.appendChild(badge);
          }
          if (hasLowStaff) {
            const badge = document.createElement('span');
            badge.style.cssText = 'display:inline-flex; align-items:center; gap:5px; padding:4px 10px; background:rgba(245,158,11,0.1); border:1px solid rgba(245,158,11,0.3); color:#f59e0b; border-radius:6px; font-size:0.78rem; font-weight:600;';
            badge.innerHTML = `<i class="fa-solid fa-user-minus"></i> Only 1 staff in ${lowStaffCount} time slot${lowStaffCount > 1 ? 's' : ''}`;
            gapContainer.appendChild(badge);
          }

          timelineVisual.parentElement.appendChild(gapContainer);
        }
      }
    }
  }
  
  // Render table checklist body
  const tbody = document.getElementById('daily-shifts-tbody');
  if (tbody) {
    tbody.innerHTML = '';
    
    if (dayShifts.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" class="text-muted" style="text-align: center; padding: 24px;">
            No shifts scheduled for this date.
          </td>
        </tr>
      `;
    } else {
      dayShifts.forEach(s => {
        const emp = state.employees.find(e => e.id === s.employeeId);
        const empName = emp ? emp.name : '<span style="color:var(--text-danger);"><i class="fa-solid fa-triangle-exclamation"></i> Unassigned</span>';
        const empRole = emp ? emp.role : 'N/A';
        const roleColor = state.roles.find(r => r.name.toLowerCase() === s.role.toLowerCase())?.color || '#ef4444';
        
        const grossHours = calculateShiftHours(s.startTime, s.endTime, 0);
        const breakEntitlement = getAwardBreakEntitlements(grossHours);
        const unpaidMeal = (s.unpaidMealMins !== undefined && s.unpaidMealMins !== null) ? s.unpaidMealMins : breakEntitlement.unpaidMealMins;
        
        let breakHtml = '<span style="color:var(--text-muted); font-size:0.78rem;">No breaks (<4h)</span>';
        if (grossHours >= 4) {
          const mealBadge = unpaidMeal > 0 ? `<span class="badge" style="background:rgba(16, 185, 129, 0.12); color:#10b981; border:1px solid rgba(16, 185, 129, 0.25); font-size:0.75rem; display:inline-flex; align-items:center; gap:4px;"><i class="fa-solid fa-utensils"></i> ${unpaidMeal}m Lunch</span>` : '';
          const restBadge = '';
          breakHtml = `<div style="display:flex; flex-direction:column; align-items:center; gap:4px;">${mealBadge} ${restBadge}</div>`;
        }

        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td style="padding-left: 16px; font-weight: 500;">
            <div>${empName}</div>
            <div style="font-size: 0.75rem; color: var(--text-muted); font-weight: 400;">${empRole}</div>
          </td>
          <td style="text-align: center; font-weight: 600;">
            <i class="fa-regular fa-clock" style="margin-right: 4px; color: var(--accent-cyan);"></i> ${formatTimeAmPm(s.startTime)} - ${formatTimeAmPm(s.endTime)}
          </td>
          <td style="text-align: center;">
            <span class="badge" style="background: rgba(${hexToRgb(roleColor)}, 0.12); color: ${roleColor}; border: 1px solid rgba(${hexToRgb(roleColor)}, 0.25); font-weight: 600;">
              ${s.role}
            </span>
          </td>
          <td style="text-align: center; padding: 6px 4px;">
            ${breakHtml}
          </td>
          <td style="padding-left: 16px; font-size: 0.85rem; color: var(--text-muted); font-style: ${s.notes ? 'normal' : 'italic'};">
            ${s.notes ? s.notes : 'No special notes/instructions for this shift.'}
          </td>
        `;
        tbody.appendChild(tr);
      });
    }
  }
}
window.renderDailyPanel = renderDailyPanel;

window.openStaffDirectoryModal = function() {
  const listContainer = document.getElementById('staff-directory-list');
  if (listContainer) {
    listContainer.innerHTML = '';
    
    // Sort active employees by name
    const activeEmps = state.employees.filter(e => e.active !== false).sort((a, b) => a.name.localeCompare(b.name));
    
    if (activeEmps.length === 0) {
      listContainer.innerHTML = '<div class="text-muted text-center" style="font-size: 0.9rem; padding: 1rem 0;">No active staff records found.</div>';
    } else {
      activeEmps.forEach(emp => {
        const phone = emp.phone || 'No phone recorded';
        const email = emp.email || 'No email recorded';
        const roleColor = state.roles.find(r => r.name.toLowerCase() === emp.role.toLowerCase())?.color || '#a855f7';
        
        const card = document.createElement('div');
        card.style.background = 'rgba(255, 255, 255, 0.03)';
        card.style.padding = '12px 16px';
        card.style.borderRadius = '8px';
        card.style.border = '1px solid var(--border-glass)';
        card.style.display = 'flex';
        card.style.justifyContent = 'space-between';
        card.style.alignItems = 'center';
        card.style.gap = '12px';
        
        card.innerHTML = `
          <div style="flex: 1;">
            <div style="font-weight: 600; font-size: 0.95rem; display: flex; align-items: center; gap: 8px;">
              ${emp.name}
              <span style="font-size: 0.72rem; padding: 2px 6px; border-radius: 4px; background: rgba(${hexToRgb(roleColor)}, 0.1); color: ${roleColor}; border: 1px solid rgba(${hexToRgb(roleColor)}, 0.2); font-weight: 500;">
                ${emp.role}
              </span>
            </div>
            <div style="font-size: 0.82rem; color: var(--text-secondary); margin-top: 5px;">
              <i class="fa-solid fa-phone" style="font-size: 11px; margin-right: 4px; color: var(--accent-cyan);"></i> ${phone}
            </div>
            <div style="font-size: 0.82rem; color: var(--text-secondary); margin-top: 3px;">
              <i class="fa-solid fa-envelope" style="font-size: 11px; margin-right: 4px; color: var(--accent-gold);"></i> ${email}
            </div>
          </div>
          <div>
            ${emp.phone ? `
              <a href="tel:${emp.phone}" class="btn btn-icon" style="background: rgba(0, 229, 255, 0.1); color: var(--accent-cyan); width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 14px;">
                <i class="fa-solid fa-phone"></i>
              </a>
            ` : ''}
          </div>
        `;
        listContainer.appendChild(card);
      });
    }
  }
  document.getElementById('modal-staff-directory').classList.add('active');
};

window.closeStaffDirectoryModal = function() {
  document.getElementById('modal-staff-directory').classList.remove('active');
};

// Clean cover tags to keep shift notes clean
const cleanCoverTags = (notes) => {
  if (!notes) return '';
  return notes.replace(/\[NEEDS COVER\]|\[COVERED BY [^\]]+\]/gi, '').trim();
};

window.requestShiftCover = async function(shiftId) {
  const shift = state.shifts.find(s => s.id === shiftId);
  if (!shift) return;

  try {
    const existing = state.swaps.find(s => s.shiftId === shiftId && (s.status || '').toUpperCase() === 'PENDING');
    if (existing) {
      showToast('Cover request already exists for this shift.', 'info');
      return;
    }

    const swap = await SwapDB.createSwap(shiftId, state.currentUser.employeeId);
    state.swaps.push(swap);

    showToast('Cover request submitted to board!', 'success');
    renderSwapBoard('my');
  } catch (err) {
    console.error(err);
    showToast('Failed to submit cover request.', 'error');
  }
};

window.cancelShiftCover = async function(shiftId) {
  try {
    await SwapDB.cancelSwap(shiftId);
    state.swaps = state.swaps.filter(s => !(s.shiftId === shiftId && (s.status || '').toUpperCase() === 'PENDING'));
    
    showToast('Cover request cancelled.', 'info');
    renderSwapBoard('my');
  } catch (err) {
    console.error(err);
    showToast('Failed to cancel cover request.', 'error');
  }
};

window.offerToCover = async function(shiftId) {
  const shift = state.shifts.find(s => s.id === shiftId);
  if (!shift) return;

  // Conflict validation: Check if user has an approved leave request on the target shift date
  const hasApprovedLeave = state.leaveRequests.some(r => {
    if (r.employeeId !== state.currentUser.employeeId || r.status !== 'Approved') return false;
    return shift.date >= r.startDate && shift.date <= r.endDate;
  });

  if (hasApprovedLeave) {
    showToast('You have an approved leave request on this day. Cannot cover this shift!', 'error');
    return;
  }

  try {
    const swap = await SwapDB.coverSwap(shiftId, state.currentUser.employeeId);
    
    // Update local state
    const index = state.swaps.findIndex(s => s.shiftId === shiftId && (s.status || '').toUpperCase() === 'PENDING');
    if (index !== -1) {
      state.swaps[index] = swap;
    }
    
    // Assign shift to covering employee
    shift.employeeId = state.currentUser.employeeId;
    await BriskDB.updateShift(shift);

    showToast(`Roster Cover matched! You are now scheduled for this shift.`, 'success');
    
    loadDataFromState();
    renderActivePanel();
    closeSwapBoardModal();

    // Background sync to ensure instant multi-client state parity
    BriskDB.syncFromServer()
      .then(async () => {
        state.swaps = await SwapDB.getSwaps();
        loadDataFromState();
        renderActivePanel();
      })
      .catch(e => console.warn('Background sync after offer cover failed:', e));
  } catch (err) {
    console.error(err);
    showToast('Failed to cover this shift.', 'error');
  }
};



window.openSwapBoardModal = function() {
  document.getElementById('modal-swap-board').classList.add('active');
  switchSwapTab('available');
};

window.closeSwapBoardModal = function() {
  document.getElementById('modal-swap-board').classList.remove('active');
};

window.switchSwapTab = function(tab) {
  document.getElementById('tab-swap-available').classList.toggle('active', tab === 'available');
  document.getElementById('tab-swap-my').classList.toggle('active', tab === 'my');
  document.getElementById('tab-swap-manager').classList.toggle('active', tab === 'manager');
  
  if (!hasManagerPermissions(state.currentUser)) {
    document.getElementById('tab-swap-manager').classList.add('hide');
  } else {
    document.getElementById('tab-swap-manager').classList.remove('hide');
  }

  renderSwapBoard(tab);
};

window.renderSwapBoard = function(tab) {
  const container = document.getElementById('swap-board-content');
  if (!container) return;
  container.innerHTML = '';

  const todayStr = formatDateISO(new Date());
  
  let targetSwaps = [];
  const myEmpId = state.currentUser.employeeId;

  if (tab === 'available') {
    targetSwaps = state.swaps.filter(s => (s.status || '').toUpperCase() === 'PENDING' && s.requestingEmployeeId !== myEmpId);
  } else if (tab === 'my') {
    if (!hasManagerPermissions(state.currentUser)) {
      targetSwaps = state.swaps.filter(s => (s.status || '').toUpperCase() === 'PENDING' && s.requestingEmployeeId === myEmpId);
    }
  } else if (tab === 'manager') {
    targetSwaps = state.swaps.filter(s => {
      const st = (s.status || '').toUpperCase();
      return st === 'ACCEPTED' || st === 'COVERED';
    });
  }

  // Filter out past shifts and map to shift object
  let displayItems = targetSwaps.map(swap => {
    return {
      swap,
      shift: state.shifts.find(sh => sh.id === swap.shiftId)
    };
  }).filter(item => item.shift && item.shift.date >= todayStr);

  if (displayItems.length === 0) {
    container.innerHTML = '<div class="text-muted text-center" style="padding: 2rem 0;">No shifts found in this category.</div>';
    return;
  }

  // Sort by date ascending
  displayItems.sort((a, b) => new Date(a.shift.date) - new Date(b.shift.date));

  displayItems.forEach(item => {
    const shift = item.shift;
    const swap = item.swap;
    const origEmp = state.employees.find(e => e.id === swap.requestingEmployeeId);
    const empName = origEmp ? origEmp.name : 'Unknown';
    
    const card = document.createElement('div');
    card.style.padding = '12px 16px';
    card.style.background = 'rgba(255, 255, 255, 0.03)';
    card.style.border = '1px solid var(--border-glass)';
    card.style.borderRadius = '8px';
    card.style.display = 'flex';
    card.style.justifyContent = 'space-between';
    card.style.alignItems = 'center';

    let actionHtml = '';
    
    if (tab === 'available') {
      actionHtml = `<button class="btn btn-neon" onclick="offerToCover('${shift.id}')"><i class="fa-solid fa-handshake"></i> Offer to Cover</button>`;
    } else if (tab === 'my') {
      actionHtml = `<button class="btn btn-outline" onclick="cancelShiftCover('${shift.id}')"><i class="fa-solid fa-xmark"></i> Cancel</button>`;
    } else if (tab === 'manager') {
      const coverEmp = state.employees.find(e => e.id === swap.coveringEmployeeId);
      const coverName = coverEmp ? coverEmp.name : 'Unknown';
      actionHtml = `<span class="badge badge-success"><i class="fa-solid fa-check"></i> Covered by ${coverName}</span>`;
    }

    card.innerHTML = `
      <div>
        <div style="font-weight: 600; font-size: 1.1rem;">${shift.date} (${formatTimeAmPm(shift.startTime)} - ${formatTimeAmPm(shift.endTime)})</div>
        <div style="color: var(--text-muted); font-size: 0.9rem;">${empName} - ${shift.role}</div>
      </div>
      <div>
        ${actionHtml}
      </div>
    `;
    container.appendChild(card);
  });
};

// --- CAPACITOR PUSH NOTIFICATIONS INIT ---
document.addEventListener('DOMContentLoaded', async () => {
  if (window.Capacitor && window.Capacitor.isNativePlatform()) {
    try {
      const { PushNotifications } = window.Capacitor.Plugins;
      if (PushNotifications) {
        let permStatus = await PushNotifications.checkPermissions();
        if (permStatus.receive === 'prompt') {
          permStatus = await PushNotifications.requestPermissions();
        }
        if (permStatus.receive !== 'granted') {
          console.warn('Push permission denied');
        } else {
          await PushNotifications.register();
        }

        PushNotifications.addListener('registration', (token) => {
          console.log('Push registration success, token: ' + token.value);
          // In a real app, send token to Supabase here
        });
      }
    } catch (e) {
      console.warn('Capacitor Push API not loaded or errored:', e);
    }
  }
});

function openChangelogModal() {
  const modal = document.getElementById('modal-changelog');
  if (modal) modal.classList.add('active');
}

function closeChangelogModal() {
  const modal = document.getElementById('modal-changelog');
  if (modal) window.closeModal(modal);
}

window.openChangelogModal = openChangelogModal;
window.closeChangelogModal = closeChangelogModal;



/* --- AUTO-GENERATED WINDOW BINDINGS --- */
if (typeof window !== 'undefined') window.hexToRgb = hexToRgb;
if (typeof window !== 'undefined') window.renderRolesSettingsList = renderRolesSettingsList;
if (typeof window !== 'undefined') window.handleAddRoleSubmit = handleAddRoleSubmit;
if (typeof window !== 'undefined') window.handleRoleNameChange = handleRoleNameChange;
if (typeof window !== 'undefined') window.handleRoleColorChange = handleRoleColorChange;
if (typeof window !== 'undefined') window.handleRoleDelete = handleRoleDelete;
if (typeof window !== 'undefined') window.renderPositionsSettingsList = renderPositionsSettingsList;
if (typeof window !== 'undefined') window.handleAddPositionSubmit = handleAddPositionSubmit;
if (typeof window !== 'undefined') window.handlePositionNameChange = handlePositionNameChange;
if (typeof window !== 'undefined') window.handlePositionDelete = handlePositionDelete;
if (typeof window !== 'undefined') window.updatePasteButtonState = updatePasteButtonState;
if (typeof window !== 'undefined') window.pasteCopiedShiftDetails = pasteCopiedShiftDetails;
if (typeof window !== 'undefined') window.timeToDecimal = timeToDecimal;
if (typeof window !== 'undefined') window.getAwardBreakEntitlements = getAwardBreakEntitlements;
if (typeof window !== 'undefined') window.calculateShiftHours = calculateShiftHours;
if (typeof window !== 'undefined') window.updateShiftBreakSummary = updateShiftBreakSummary;
if (typeof window !== 'undefined') window.renderSettingsPanel = renderSettingsPanel;
if (typeof window !== 'undefined') window.toggleTradingDayClosed = toggleTradingDayClosed;
if (typeof window !== 'undefined') window.saveTradingHours = saveTradingHours;
if (typeof window !== 'undefined') window.adjustDailyDate = adjustDailyDate;
if (typeof window !== 'undefined') window.setDailyDateToday = setDailyDateToday;
if (typeof window !== 'undefined') window.renderDailyPanel = renderDailyPanel;
if (typeof window !== 'undefined') window.openChangelogModal = openChangelogModal;
if (typeof window !== 'undefined') window.closeChangelogModal = closeChangelogModal;
