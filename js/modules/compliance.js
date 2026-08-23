// Auto-extracted Module: COMPLIANCE
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
   COMPLIANCE CERTIFICATES VAULT, PAY SLIP GENERATOR & ICAL EXPORTS
   ========================================================================== */

window.currentEditingCertificates = [];

function renderModalCertificatesList() {
  const container = document.getElementById('emp-certificates-list');
  if (!container) return;
  container.innerHTML = '';
  
  const certs = window.currentEditingCertificates || [];
  if (certs.length === 0) {
    container.innerHTML = `<span class="text-muted" style="font-size:0.75rem; padding:4px 0;">No certificates attached yet.</span>`;
    return;
  }

  const todayStr = formatDateISO(new Date());

  certs.forEach((cert, idx) => {
    const isExpired = cert.expiryDate && cert.expiryDate < todayStr;
    const daysLeft = cert.expiryDate ? Math.round((new Date(cert.expiryDate + 'T00:00:00') - new Date(todayStr + 'T00:00:00')) / (1000 * 3600 * 24)) : null;
    const isExpiringSoon = daysLeft !== null && daysLeft >= 0 && daysLeft <= 30;

    let badgeClass = 'badge badge-success';
    let badgeText = cert.expiryDate ? `Expires: ${cert.expiryDate}` : 'Active / Lifetime';
    if (isExpired) {
      badgeClass = 'badge badge-danger';
      badgeText = `🔴 Expired (${cert.expiryDate})`;
    } else if (isExpiringSoon) {
      badgeClass = 'badge badge-warning';
      badgeText = `⚠️ Expiring in ${daysLeft}d (${cert.expiryDate})`;
    }

    const card = document.createElement('div');
    card.style.cssText = 'display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.03); border:1px solid var(--border-glass); border-radius:4px; padding:6px 10px; font-size:0.78rem;';
    card.innerHTML = `
      <div>
        <strong style="color:var(--text-primary);">${cert.type}</strong>
        ${cert.certNumber ? `<span style="color:var(--accent-cyan); font-family:monospace; margin-left:6px;">#${cert.certNumber}</span>` : ''}
        ${cert.notes ? `<div style="color:var(--text-muted); font-size:0.72rem; margin-top:2px;">${cert.notes}</div>` : ''}
      </div>
      <div style="display:flex; align-items:center; gap:8px;">
        <span class="${badgeClass}" style="font-size:0.7rem;">${badgeText}</span>
        <button type="button" class="btn btn-icon" style="padding:2px 4px; font-size:0.75rem; color:#f87171;" onclick="removeCertificateFromEmployeeModal(${idx})" title="Remove Certificate">
          <i class="fa-solid fa-trash-can"></i>
        </button>
      </div>
    `;
    container.appendChild(card);
  });
}

function addCertificateToEmployeeModal() {
  const type = document.getElementById('new-cert-type')?.value;
  const certNumber = document.getElementById('new-cert-number')?.value?.trim() || '';
  const expiry = document.getElementById('new-cert-expiry')?.value || null;
  const notes = document.getElementById('new-cert-notes')?.value?.trim() || '';

  if (!type) {
    showToast('Please select a certificate type.', 'warning');
    return;
  }

  if (!window.currentEditingCertificates) window.currentEditingCertificates = [];
  window.currentEditingCertificates.push({
    id: 'cert_' + Date.now(),
    type,
    certNumber,
    expiryDate: expiry,
    notes
  });

  if (document.getElementById('new-cert-number')) document.getElementById('new-cert-number').value = '';
  if (document.getElementById('new-cert-expiry')) document.getElementById('new-cert-expiry').value = '';
  if (document.getElementById('new-cert-notes')) document.getElementById('new-cert-notes').value = '';

  renderModalCertificatesList();
  showToast('Certificate attached to profile.', 'success');
}

function removeCertificateFromEmployeeModal(idx) {
  if (window.currentEditingCertificates && window.currentEditingCertificates[idx]) {
    window.currentEditingCertificates.splice(idx, 1);
    renderModalCertificatesList();
  }
}

// Pay Slip generator removed per request

function exportRosterIcs(targetEmployeeId = null, isDaily = false) {
  let targetShifts = [];
  let filename = '';

  if (isDaily) {
    const dayStr = formatDateISO(state.dailyDate);
    targetShifts = state.shifts.filter(s => s.date === dayStr && s.employeeId !== null);
    filename = `amcal_roster_${dayStr}.ics`;
  } else {
    const mon = new Date(state.currentWeekStart);
    const sun = new Date(mon);
    sun.setDate(mon.getDate() + 6);
    mon.setHours(0,0,0,0);
    sun.setHours(23,59,59,999);
    
    targetShifts = state.shifts.filter(s => {
      if (s.employeeId === null) return false;
      const sDate = new Date(s.date + 'T00:00:00');
      sDate.setHours(0,0,0,0);
      return sDate >= mon && sDate <= sun;
    });
    filename = `amcal_roster_week_${formatDateISO(mon)}.ics`;
  }

  if (targetEmployeeId) {
    targetShifts = targetShifts.filter(s => s.employeeId === targetEmployeeId);
    const emp = state.employees.find(e => e.id === targetEmployeeId);
    if (emp) filename = `amcal_roster_${emp.name.replace(/\s+/g, '_')}_${isDaily ? formatDateISO(state.dailyDate) : formatDateISO(state.currentWeekStart)}.ics`;
  }

  if (targetShifts.length === 0) {
    showToast('No assigned shifts found to export for this period.', 'warning');
    return;
  }

  let icsLines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Amcal Pharmacy Woy Woy//Roster System//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH'
  ];

  targetShifts.forEach(s => {
    const emp = state.employees.find(e => e.id === s.employeeId);
    const empName = emp ? emp.name : 'Staff';
    const dateFormatted = s.date.replace(/-/g, '');
    const startTimeFormatted = s.startTime.replace(/:/g, '') + '00';
    const endTimeFormatted = s.endTime.replace(/:/g, '') + '00';

    icsLines.push('BEGIN:VEVENT');
    icsLines.push(`UID:shift_${s.id}_${s.date}@amcalwoywoy.com`);
    icsLines.push(`DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z`);
    icsLines.push(`DTSTART:${dateFormatted}T${startTimeFormatted}`);
    icsLines.push(`DTEND:${dateFormatted}T${endTimeFormatted}`);
    icsLines.push(`SUMMARY:Shift: ${s.role || 'Staff'} (${empName})`);
    icsLines.push(`DESCRIPTION:Role: ${s.role}\\nEmployee: ${empName}\\nStore: Amcal Pharmacy Woy Woy\\nNotes: ${(s.notes || '').replace(/\n/g, ' ')}`);
    icsLines.push('LOCATION:Amcal Pharmacy Woy Woy, Deepwater Plaza, NSW 2256');
    icsLines.push('STATUS:CONFIRMED');
    icsLines.push('END:VEVENT');
  });

  icsLines.push('END:VCALENDAR');

  const icsBlob = new Blob([icsLines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(icsBlob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast(`Exported ${targetShifts.length} shifts to ${filename}!`, 'success');
}


window.deleteShiftRapid = async function(id, event) {
  if (event) event.stopPropagation();
  if (confirm('Delete this shift permanently?')) {
    try {
      const shiftToDelete = state.shifts.find(s => s.id === id);
      const emp = shiftToDelete ? state.employees.find(e => e.id === shiftToDelete.employeeId) : null;
      await BriskDB.deleteShift(id);
      if (typeof BriskDB.logAudit === 'function') {
        BriskDB.logAudit('SHIFT_DELETE', `Deleted shift #${id} on ${shiftToDelete ? shiftToDelete.date : ''} (${emp ? emp.name : 'Unassigned'}, ${shiftToDelete ? shiftToDelete.startTime + '-' + shiftToDelete.endTime : ''})`, id);
      }
      renderActivePanel();
    } catch (error) {
      console.error('Failed to delete shift:', error);
      showToast('Failed to delete shift: ' + error.message, 'error');
    }
  }
}

async function copyRosterBriefToClipboard(isDaily = false) {
  try {
    let brief = '';
    if (isDaily) {
      const dayStr = formatDateISO(state.dailyDate);
      const dayShifts = state.shifts.filter(s => s.date === dayStr);
      dayShifts.sort((a,b) => a.startTime.localeCompare(b.startTime));
      brief = `📅 *Amcal Woy Woy - Daily Roster*\n${state.dailyDate.toLocaleDateString('en-AU', {weekday:'long', day:'numeric', month:'short'})} 🚀\n\n`;
      const days = {};
      days[dayStr] = dayShifts;
      brief += formatGroupedShifts(days);
    } else {
      const weekStartStr = state.currentWeekStart.toISOString().split('T')[0];
      const weekShifts = state.shifts.filter(s => {
        const d = new Date(s.date);
        return d >= state.currentWeekStart && d < new Date(state.currentWeekStart.getTime() + 7 * 86400000);
      });
      
      if (weekShifts.length === 0) {
        showToast('No shifts scheduled for this week.', 'info');
        return;
      }
  
      weekShifts.sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        return a.startTime.localeCompare(b.startTime);
      });
  
      const days = {};
      weekShifts.forEach(s => {
        if (!days[s.date]) days[s.date] = [];
        days[s.date].push(s);
      });
  
      brief = `📅 *Amcal Woy Woy - Roster*\n`;
      brief += `Week of ${new Date(weekStartStr).toLocaleDateString('en-AU', {day:'numeric', month:'short'})} - ${new Date(new Date(weekStartStr).getTime() + 6*86400000).toLocaleDateString('en-AU', {day:'numeric', month:'short'})} 🚀\n\n`;
      brief += formatGroupedShifts(days);
    }
    
    brief += '📱 View full roster: https://woywoyamcalroster.vercel.app';
    
    await navigator.clipboard.writeText(brief);
    showToast('Roster brief formatted and copied to clipboard!', 'success');
  } catch (err) {
    console.error('Copy brief failed:', err);
    showToast('Failed to copy. See console for details.', 'error');
  }
}

function formatGroupedShifts(days) {
  let brief = '';
  Object.keys(days).forEach(date => {
    const d = new Date(date);
    brief += `*__${d.toLocaleDateString('en-AU', {weekday:'long', day:'numeric', month:'short'})}__*\n`;
    
    const shifts = days[date];
    
    const pharmacists = shifts.filter(s => { const r = (s.role||'').toLowerCase(); return r.includes('pharmacist') || r.includes('pic') || r.includes('locum'); });
    const fos = shifts.filter(s => { const r = (s.role||'').toLowerCase(); return !r.includes('pharmacist') && !r.includes('pic') && !r.includes('locum') && !r.includes('webster'); });
    const others = shifts.filter(s => { const r = (s.role||'').toLowerCase(); return r.includes('webster'); });
    
    const formatShift = (s) => {
      const emp = state.employees.find(e => e.id === s.employeeId);
      const name = emp ? emp.name.split(' ')[0] : 'Unassigned';
      const roleStr = s.role ? ` (${s.role})` : '';
      let res = `• ${name}${roleStr}: ${formatTimeAmPm(s.startTime)} - ${formatTimeAmPm(s.endTime)}`;
      if (s.notes) res += `\n  📝 Note: ${s.notes}`;
      return res;
    };

    if (pharmacists.length > 0) {
      brief += `💊 PHARMACISTS:\n`;
      pharmacists.forEach(s => brief += formatShift(s) + '\n');
    }
    if (fos.length > 0) {
      brief += `🛍️ FRONT OF SHOP:\n`;
      fos.forEach(s => brief += formatShift(s) + '\n');
    }
    if (others.length > 0) {
      brief += `📦 OTHER ROLES:\n`;
      others.forEach(s => brief += formatShift(s) + '\n');
    }
    brief += '\n';
  });
  return brief;
}


function copyDailyBriefToClipboard() {
  copyRosterBriefToClipboard(true);
}



/* --- AUTO-GENERATED WINDOW BINDINGS --- */
if (typeof window !== 'undefined') window.renderModalCertificatesList = renderModalCertificatesList;
if (typeof window !== 'undefined') window.addCertificateToEmployeeModal = addCertificateToEmployeeModal;
if (typeof window !== 'undefined') window.removeCertificateFromEmployeeModal = removeCertificateFromEmployeeModal;
if (typeof window !== 'undefined') window.exportRosterIcs = exportRosterIcs;
if (typeof window !== 'undefined') window.copyRosterBriefToClipboard = copyRosterBriefToClipboard;
if (typeof window !== 'undefined') window.formatGroupedShifts = formatGroupedShifts;
if (typeof window !== 'undefined') window.copyDailyBriefToClipboard = copyDailyBriefToClipboard;
