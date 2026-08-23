// Auto-extracted Module: AI_OPS
// Injected Window Globals Access
const {
  state, DAY_NAMES, MONTH_NAMES, BriskDB, SwapDB, showToast, BriskScheduler, 
  hasManagerPermissions, renderActivePanel, formatDateISO,
  getOrderedActiveEmployees,
  opalEngine, pomelliBroadcaster, MixboardStudio
} = window;

/* ==========================================================================
   GOOGLE AI SUITE: AI OPERATIONS & AUTONOMOUS WORKFLOW HUB
   ========================================================================== */

function renderAiOpsPanel() {
  const mixboardContainer = document.getElementById('mixboard-palette-container');
  if (mixboardContainer && MixboardStudio) {
    mixboardContainer.innerHTML = MixboardStudio.renderPaletteInspector();
  }
}

function switchAiSubTab(subTab) {
  const tabs = ['opal', 'pomelli', 'mixboard'];
  tabs.forEach(t => {
    const btn = document.getElementById(`ai-tab-btn-${t}`);
    const view = document.getElementById(`ai-subview-${t}`);
    if (btn) btn.classList.toggle('active', t === subTab);
    if (view) view.classList.toggle('hide', t !== subTab);
  });
}
window.switchAiSubTab = switchAiSubTab;

async function runOpalGapDetector() {
  const container = document.getElementById('opal-results-container');
  const title = document.getElementById('opal-results-title');
  const body = document.getElementById('opal-results-body');
  if (!container || !body) return;

  container.classList.remove('hide');
  title.innerHTML = '<i class="fa-solid fa-bolt text-cyan"></i> Opal Shift Gap Auto-Detector (Running...)';
  body.innerHTML = '<div style="padding:1.5rem; text-align:center;"><div class="spinner"></div><p style="margin-top:8px; font-size:0.85rem;" class="text-muted">Evaluating roster shifts against Fair Work 2026 rules & staff fatigue caps...</p></div>';

  try {
    const result = await opalEngine.runGapDetectorWorkflow(state.shifts, state.employees, state.currentWeekStart);
    title.innerHTML = `<i class="fa-solid fa-bolt text-cyan"></i> Opal Shift Gap Auto-Detector (${result.openShiftsCount} Gaps Analyzed in ${result.executionDurationMs}ms)`;

    let html = `
      <div style="background:rgba(0,229,255,0.05); border:1px solid rgba(0,229,255,0.2); border-radius:var(--radius-sm); padding:10px; margin-bottom:12px;">
        <div style="font-size:0.85rem; font-weight:700; color:var(--accent-cyan); margin-bottom:4px;">Workflow Execution Pipeline</div>
        ${result.logs.map(l => `
          <div style="display:flex; justify-content:space-between; font-size:0.78rem; padding:3px 0;">
            <span><i class="fa-solid fa-check text-neon"></i> Step ${l.step}: ${l.title}</span>
            <span class="text-muted">${l.detail || 'Done'}</span>
          </div>
        `).join('')}
      </div>
    `;

    if (result.recommendations.length === 0) {
      html += '<div class="text-center text-neon" style="padding:1.5rem;"><i class="fa-solid fa-circle-check fa-2x"></i><h4 style="margin-top:8px;">Zero Roster Gaps!</h4><p class="text-muted" style="font-size:0.85rem;">All scheduled shifts have assigned compliant staff.</p></div>';
    } else {
      html += '<h4 style="margin-bottom:8px; font-size:0.95rem;">Recommended Staff Replacements</h4><div style="display:flex; flex-direction:column; gap:10px;">';
      result.recommendations.forEach(rec => {
        const s = rec.shift;
        const top = rec.topCandidate;
        html += `
          <div class="glass-card" style="padding:12px; border-left:4px solid var(--accent-cyan); background:rgba(255,255,255,0.02);">
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; margin-bottom:6px;">
              <div>
                <strong>${s.date}</strong> (${s.startTime || s.start || '09:00'} - ${s.endTime || s.end || '17:30'}) • <span class="badge badge-warning">${s.role || 'Staff'}</span>
              </div>
              <span class="text-muted" style="font-size:0.75rem;">${rec.shiftHours.toFixed(1)}h Net</span>
            </div>
        `;

        if (top) {
          html += `
            <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,0.25); padding:8px 12px; border-radius:var(--radius-sm); margin-top:6px;">
              <div>
                <strong style="color:var(--text-neon); font-size:0.9rem;"><i class="fa-solid fa-star"></i> ${top.employee.name}</strong>
                <span class="text-muted" style="font-size:0.75rem; margin-left:8px;">(Match Score: ${top.score} pts • Projected: ${top.projectedHours.toFixed(1)}h/38h)</span>
                <div style="font-size:0.72rem; color:var(--text-secondary); margin-top:2px;">${top.reasons.join(' • ')}</div>
              </div>
              <button class="btn btn-neon" style="font-size:0.75rem; padding:4px 10px;" onclick="applyOpalAutoFill('${s.id}', '${top.employee.id}')">
                <i class="fa-solid fa-user-check"></i> Assign Staff
              </button>
            </div>
          `;
        } else {
          html += '<div class="text-danger" style="font-size:0.8rem; margin-top:4px;">No eligible non-conflicting staff found without overtime breach.</div>';
        }
        html += '</div>';
      });
      html += '</div>';
    }

    body.innerHTML = html;
  } catch (err) {
    body.innerHTML = `<div class="text-danger" style="padding:1rem;">Workflow Failed: ${err.message}</div>`;
  }
}
window.runOpalGapDetector = runOpalGapDetector;

async function applyOpalAutoFill(shiftId, employeeId) {
  if (!hasManagerPermissions(state.currentUser)) {
    window.showToast('Unauthorized: Only Owners and Managers can auto-fill shifts.', 'error');
    return;
  }
  try {
    const shift = state.shifts.find(s => s.id === shiftId);
    const emp = state.employees.find(e => e.id === employeeId);
    if (!shift || !emp) return;

    shift.employeeId = employeeId;
    if (window.BriskDB && window.BriskDB.updateShift) {
      await window.BriskDB.updateShift(shift);
    }

    window.showToast(`Auto-assigned ${emp.name} to ${shift.date} shift!`, 'success');
    runOpalGapDetector();
    if (state.currentTab === 'scheduler') renderScheduler();
  } catch (e) {
    window.showToast(`Auto-fill error: ${e.message}`, 'error');
  }
}
window.applyOpalAutoFill = applyOpalAutoFill;

async function runOpalTimesheetReconciler() {
  const container = document.getElementById('opal-results-container');
  const title = document.getElementById('opal-results-title');
  const body = document.getElementById('opal-results-body');
  if (!container || !body) return;

  container.classList.remove('hide');
  title.innerHTML = '<i class="fa-solid fa-clock-rotate-left text-orange"></i> Timesheet & Break Reconciliation Sentinel (Running...)';
  body.innerHTML = '<div style="padding:1.5rem; text-align:center;"><div class="spinner"></div><p style="margin-top:8px; font-size:0.85rem;" class="text-muted">Correlating digital timecards against roster schedule...</p></div>';

  try {
    const result = await opalEngine.runTimesheetReconcilerWorkflow(state.timecards, state.shifts, state.employees);
    title.innerHTML = `<i class="fa-solid fa-clock-rotate-left text-orange"></i> Timesheet & Break Reconciliation (${result.flaggedVariances.length} Exceptions)`;

    let html = `
      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(160px, 1fr)); gap:8px; margin-bottom:12px;">
        <div class="glass-card" style="padding:10px; text-align:center;">
          <span class="text-muted" style="font-size:0.72rem;">Scheduled Total</span>
          <div style="font-weight:700; font-size:1.1rem; color:var(--accent-cyan);">${result.totalScheduledHours.toFixed(1)}h</div>
        </div>
        <div class="glass-card" style="padding:10px; text-align:center;">
          <span class="text-muted" style="font-size:0.72rem;">Actual Clocked Total</span>
          <div style="font-weight:700; font-size:1.1rem; color:#10b981;">${result.totalClockedHours.toFixed(1)}h</div>
        </div>
        <div class="glass-card" style="padding:10px; text-align:center;">
          <span class="text-muted" style="font-size:0.72rem;">Net Variance</span>
          <div style="font-weight:800; font-size:1.1rem; color:${result.varianceHoursTotal >= 0 ? '#f59e0b' : '#38bdf8'};">${result.varianceHoursTotal >= 0 ? '+' : ''}${result.varianceHoursTotal.toFixed(1)}h</div>
        </div>
      </div>
    `;

    if (result.flaggedVariances.length === 0) {
      html += '<div class="text-center text-neon" style="padding:1.5rem;"><i class="fa-solid fa-circle-check fa-2x"></i><h4 style="margin-top:8px;">Perfect Punctuality!</h4><p class="text-muted" style="font-size:0.85rem;">All timecards match scheduled shifts and break policies with zero variances.</p></div>';
    } else {
      html += '<div style="display:flex; flex-direction:column; gap:8px;">';
      result.flaggedVariances.forEach(v => {
        html += `
          <div class="glass-card" style="padding:10px 14px; border-left:4px solid #f59e0b; background:rgba(255,255,255,0.02);">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <strong>${v.employee.name}</strong>
              <span class="text-muted" style="font-size:0.75rem;">${v.date}</span>
            </div>
            <div style="font-size:0.8rem; margin-top:4px;">
              Scheduled: <code>${v.scheduledHours.toFixed(1)}h</code> • Clocked: <code>${v.clockedHours.toFixed(1)}h</code> (${v.varianceHours >= 0 ? '+' : ''}${v.varianceHours.toFixed(2)}h)
            </div>
            <div style="margin-top:6px; display:flex; flex-direction:column; gap:3px;">
              ${v.flags.map(f => `<span style="font-size:0.75rem; color:${f.severity === 'critical' ? '#ef4444' : '#fbbf24'};"><i class="fa-solid fa-circle-exclamation"></i> ${f.message}</span>`).join('')}
            </div>
          </div>
        `;
      });
      html += '</div>';
    }

    body.innerHTML = html;
  } catch (err) {
    body.innerHTML = `<div class="text-danger" style="padding:1rem;">Sentinel Audit Failed: ${err.message}</div>`;
  }
}
window.runOpalTimesheetReconciler = runOpalTimesheetReconciler;

async function runOpalPrePublishAudit() {
  const container = document.getElementById('opal-results-container');
  const title = document.getElementById('opal-results-title');
  const body = document.getElementById('opal-results-body');
  if (!container || !body) return;

  container.classList.remove('hide');
  title.innerHTML = '<i class="fa-solid fa-shield-halved text-neon"></i> Weekly Pre-Publish Safety Gate Audit (Running...)';
  body.innerHTML = '<div style="padding:1.5rem; text-align:center;"><div class="spinner"></div><p style="margin-top:8px; font-size:0.85rem;" class="text-muted">Verifying mandatory Pharmacist coverage and Fair Work rules...</p></div>';

  try {
    const result = await opalEngine.runPrePublishAuditWorkflow(state.shifts, state.employees, state.settings?.tradingHours);
    title.innerHTML = `<i class="fa-solid fa-shield-halved text-neon"></i> Pre-Publish Safety Gate (${result.isReadyToPublish ? 'PASSED ✅' : 'ATTENTION REQUIRED ⚠️'})`;

    let html = `
      <div style="background:rgba(0,0,0,0.3); padding:12px; border-radius:var(--radius-sm); margin-bottom:12px;">
        ${result.logs.map(l => `
          <div style="display:flex; justify-content:space-between; font-size:0.8rem; padding:4px 0; border-bottom:1px solid rgba(255,255,255,0.05);">
            <span>${l.status === 'done' ? '✅' : '⚠️'} Step ${l.step}: ${l.title}</span>
            <span class="text-muted">${l.detail}</span>
          </div>
        `).join('')}
      </div>
    `;

    if (result.isReadyToPublish) {
      html += `
        <div style="text-align:center; padding:1rem; background:rgba(16,185,129,0.08); border:1px solid rgba(16,185,129,0.3); border-radius:var(--radius-md);">
          <i class="fa-solid fa-circle-check text-neon fa-2x"></i>
          <h4 style="margin-top:6px; color:#10b981;">Ready to Publish & Broadcast</h4>
          <p style="font-size:0.85rem; color:var(--text-secondary); margin-bottom:12px;">Roster meets all Pharmacist coverage and Fair Work fatigue thresholds.</p>
          <button class="btn btn-neon" onclick="switchAiSubTab('pomelli'); generatePomelliRosterRelease();">
            <i class="fa-solid fa-paper-plane"></i> Launch Pomelli Roster Release Broadcast
          </button>
        </div>
      `;
    }

    body.innerHTML = html;
  } catch (err) {
    body.innerHTML = `<div class="text-danger" style="padding:1rem;">Pre-Publish Audit Error: ${err.message}</div>`;
  }
}
window.runOpalPrePublishAudit = runOpalPrePublishAudit;

function generatePomelliUrgentCover() {
  const openShift = state.shifts.find(s => !s.employeeId || s.status === 'open' || s.isCoverRequest) || state.shifts[0] || { date: '2026-08-22', start: '09:00', end: '17:30', role: 'Pharmacist' };
  activePomelliKit = pomelliBroadcaster.generateUrgentCoverKit(openShift, openShift.role || 'Pharmacist', openShift.notes || 'Emergency cover for Saturday shift.');
  displayPomelliKit();
}
window.generatePomelliUrgentCover = generatePomelliUrgentCover;

function generatePomelliRosterRelease() {
  const weekLabel = state.currentWeekStart ? state.currentWeekStart.toISOString().slice(0, 10) : 'Current Week';
  activePomelliKit = pomelliBroadcaster.generateWeeklyRosterReleaseKit(weekLabel, state.shifts.length, state.employees.length);
  displayPomelliKit();
}
window.generatePomelliRosterRelease = generatePomelliRosterRelease;

function generatePomelliOnboardingKit() {
  const firstStaff = state.employees[0] || { name: 'New Employee', email: 'staff@amcal.com', inviteCode: 'AMC789' };
  activePomelliKit = pomelliBroadcaster.generateStaffOnboardingKit(firstStaff.name, firstStaff.email, firstStaff.inviteCode || 'AMC789');
  displayPomelliKit();
}
window.generatePomelliOnboardingKit = generatePomelliOnboardingKit;

function generatePomelliComplianceMemo() {
  activePomelliKit = pomelliBroadcaster.generateComplianceMemoKit('Labour Day / Public Holiday', 'Monday, 5 Oct 2026', '250%');
  displayPomelliKit();
}
window.generatePomelliComplianceMemo = generatePomelliComplianceMemo;

function displayPomelliKit() {
  if (!activePomelliKit) return;
  const card = document.getElementById('pomelli-output-card');
  const title = document.getElementById('pomelli-output-title');
  const preview = document.getElementById('pomelli-broadcast-preview');
  if (!card || !preview) return;

  card.classList.remove('hide');
  if (title) title.textContent = activePomelliKit.title || 'Generated Broadcast Pack';
  switchPomelliFormatTab(activePomelliFormat);
}

function switchPomelliFormatTab(format) {
  activePomelliFormat = format;
  const formats = ['telegram', 'sms', 'whatsapp', 'email'];
  formats.forEach(f => {
    const tab = document.getElementById(`pomelli-tab-${f === 'telegram' ? 'tg' : f === 'whatsapp' ? 'wa' : f}`);
    if (tab) tab.classList.toggle('active', f === format);
  });

  const preview = document.getElementById('pomelli-broadcast-preview');
  if (!preview || !activePomelliKit) return;

  let text = '';
  switch (format) {
    case 'telegram':
      text = activePomelliKit.telegram || '';
      break;
    case 'sms':
      text = activePomelliKit.sms || '';
      break;
    case 'whatsapp':
      text = activePomelliKit.whatsApp || '';
      break;
    case 'email':
      text = `Subject: ${activePomelliKit.emailSubject}\n\n${activePomelliKit.emailBody}`;
      break;
  }
  preview.textContent = text;
}
window.switchPomelliFormatTab = switchPomelliFormatTab;

async function copyPomelliActiveText() {
  const preview = document.getElementById('pomelli-broadcast-preview');
  if (!preview || !preview.textContent) return;
  await PomelliBroadcaster.copyOrShare(preview.textContent);
  window.showToast('Copied broadcast text to clipboard!', 'success');
}
window.copyPomelliActiveText = copyPomelliActiveText;

function openPomelliTelegram() {
  if (!activePomelliKit) return;
  const text = activePomelliKit.telegram || '';
  const urls = PomelliBroadcaster.getShareUrls(text);
  window.open(urls.telegram, '_blank');
}
window.openPomelliTelegram = openPomelliTelegram;

function openPomelliWhatsApp() {
  if (!activePomelliKit) return;
  const text = activePomelliKit.whatsApp || '';
  const urls = PomelliBroadcaster.getShareUrls(text);
  window.open(urls.whatsApp, '_blank');
}
window.openPomelliWhatsApp = openPomelliWhatsApp;


window.deleteShiftRapid = async function(id, event) {
  event.stopPropagation();
  if (confirm('Delete this shift immediately?')) {
    try {
      const shiftToDelete = state.shifts.find(s => s.id === id);
      const emp = shiftToDelete ? state.employees.find(e => e.id === shiftToDelete.employeeId) : null;
      await BriskDB.deleteShift(id);
      if (typeof BriskDB.logAudit === 'function') {
        BriskDB.logAudit('SHIFT_DELETE', `Rapid deleted shift #${id} on ${shiftToDelete ? shiftToDelete.date : ''} (${emp ? emp.name : 'Unassigned'})`, id);
      }
      showToast('Shift deleted.', 'success');
      loadDataFromState();
      renderScheduler();
    } catch(err) {
      console.error(err);
      showToast('Failed to delete shift.', 'error');
    }
  }
};



/* --- AUTO-GENERATED WINDOW BINDINGS --- */
if (typeof window !== 'undefined') window.renderAiOpsPanel = renderAiOpsPanel;
if (typeof window !== 'undefined') window.switchAiSubTab = switchAiSubTab;
if (typeof window !== 'undefined') window.runOpalGapDetector = runOpalGapDetector;
if (typeof window !== 'undefined') window.applyOpalAutoFill = applyOpalAutoFill;
if (typeof window !== 'undefined') window.runOpalTimesheetReconciler = runOpalTimesheetReconciler;
if (typeof window !== 'undefined') window.runOpalPrePublishAudit = runOpalPrePublishAudit;
if (typeof window !== 'undefined') window.generatePomelliUrgentCover = generatePomelliUrgentCover;
if (typeof window !== 'undefined') window.generatePomelliRosterRelease = generatePomelliRosterRelease;
if (typeof window !== 'undefined') window.generatePomelliOnboardingKit = generatePomelliOnboardingKit;
if (typeof window !== 'undefined') window.generatePomelliComplianceMemo = generatePomelliComplianceMemo;
if (typeof window !== 'undefined') window.displayPomelliKit = displayPomelliKit;
if (typeof window !== 'undefined') window.switchPomelliFormatTab = switchPomelliFormatTab;
if (typeof window !== 'undefined') window.copyPomelliActiveText = copyPomelliActiveText;
if (typeof window !== 'undefined') window.openPomelliTelegram = openPomelliTelegram;
if (typeof window !== 'undefined') window.openPomelliWhatsApp = openPomelliWhatsApp;
