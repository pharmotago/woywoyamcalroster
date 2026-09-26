/**
 * Amcal Pharmacy Woy Woy — Dispensary Clinical Handover & All-Hands Meeting Deck Engine
 * Governance Standard: Pharmacy Industry Award 2026 & QCPP Clinical Standards
 */

// Dynamic Window Globals Access
const state = new Proxy({}, {
  get(target, prop) { return window.state ? window.state[prop] : undefined; },
  set(target, prop, value) { if (!window.state) window.state = {}; window.state[prop] = value; return true; }
});

const showToast = (...args) => (window.showToast ? window.showToast(...args) : console.log(...args));
const hasManagerPermissions = (u) => (window.hasManagerPermissions ? window.hasManagerPermissions(u) : false);

function getHandoverStorageKey() {
  const isBudgewoi = (typeof getActiveTenant === 'function' && getActiveTenant() === 'budgewoi_dds') ||
    (typeof window !== 'undefined' && window.currentTenant && (window.currentTenant.key === 'budgewoi' || window.currentTenant.id === 'budgewoi_dds')) ||
    (typeof window !== 'undefined' && window.location && window.location.hostname && (window.location.hostname.includes('budgewoi') || window.location.hostname.includes('dds')));
  return isBudgewoi ? 'budgewoi_dispensary_handovers' : 'amcal_dispensary_handovers';
}

function getHandoverHistory() {
  try {
    const key = getHandoverStorageKey();
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error('Failed to parse dispensary handover history:', e);
    return [];
  }
}

function saveHandoverHistory(records) {
  try {
    const key = getHandoverStorageKey();
    localStorage.setItem(key, JSON.stringify(Array.isArray(records) ? records : []));
  } catch (e) {
    console.error('Failed to save dispensary handover history:', e);
  }
}

function openDispensaryHandoverModal() {
  const modal = document.getElementById('modal-dispensary-handover');
  if (!modal) return;

  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];
  const timeStr = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');

  const dateInp = document.getElementById('handover-date');
  const timeInp = document.getElementById('handover-time');
  if (dateInp) dateInp.value = dateStr;
  if (timeInp) timeInp.value = timeStr;

  // Pre-fill outgoing pharmacist with logged-in user or active store lead
  const outgoingInp = document.getElementById('handover-outgoing-pharmacist');
  if (outgoingInp && (!outgoingInp.value || outgoingInp.value.trim() === '')) {
    const isBudgewoiStore = (typeof getActiveTenant === 'function' && getActiveTenant() === 'budgewoi_dds') ||
      (window.currentTenant && (window.currentTenant.key === 'budgewoi' || window.currentTenant.id === 'budgewoi_dds'));
    outgoingInp.value = state.currentUser?.name || (isBudgewoiStore ? 'Georgi Peek' : 'Peter Kim');
  }

  // Pre-populate pharmacists list in dropdowns if available
  const pharmacistOptions = (state.employees || [])
    .filter(e => e.role && e.role.toLowerCase().includes('pharmacist'))
    .map(e => e.name);

  const incomingSelect = document.getElementById('handover-incoming-select');
  if (incomingSelect) {
    incomingSelect.innerHTML = '<option value="">-- Select or Type Below --</option>';
    pharmacistOptions.forEach(name => {
      const opt = document.createElement('option');
      opt.value = name;
      opt.textContent = name;
      incomingSelect.appendChild(opt);
    });
  }

  renderHandoverHistoryList();
  modal.classList.add('active');
}

function closeDispensaryHandoverModal() {
  const modal = document.getElementById('modal-dispensary-handover');
  if (modal) modal.classList.remove('active');
}

function onIncomingSelectChange(val) {
  const customInp = document.getElementById('handover-incoming-pharmacist');
  if (customInp && val) customInp.value = val;
}

async function handleSaveHandover(event) {
  if (event && event.preventDefault) event.preventDefault();

  const date = document.getElementById('handover-date')?.value || new Date().toISOString().split('T')[0];
  const time = document.getElementById('handover-time')?.value || '12:00';
  const outgoing = document.getElementById('handover-outgoing-pharmacist')?.value?.trim();
  const incoming = document.getElementById('handover-incoming-pharmacist')?.value?.trim();
  const shiftType = document.getElementById('handover-shift-type')?.value || 'morning_to_afternoon';
  
  const s8Confirmed = document.getElementById('handover-s8-confirmed')?.checked || false;
  const fridgeTempInput = document.getElementById('handover-fridge-temp');
  const fridgeTempRaw = fridgeTempInput ? fridgeTempInput.value.trim() : '';
  const fridgeTemp = fridgeTempRaw !== '' && !isNaN(Number(fridgeTempRaw)) ? Number(fridgeTempRaw) : null;
  
  const doctorQueries = document.getElementById('handover-doctor-queries')?.value?.trim() || '';
  const owingScripts = document.getElementById('handover-owing-scripts')?.value?.trim() || '';
  const websterStatus = document.getElementById('handover-webster-status')?.value?.trim() || '';
  const stagedSupply = document.getElementById('handover-staged-supply')?.value?.trim() || '';
  const notes = document.getElementById('handover-general-notes')?.value?.trim() || '';

  if (!outgoing || !incoming) {
    showToast('Please specify both Outgoing and Incoming Pharmacists.', 'warning');
    return;
  }

  if (!s8Confirmed) {
    if (!confirm('Warning: Schedule 8 Safe balance check is not ticked. Proceed without confirming S8 physical count?')) {
      return;
    }
  }

  // Cold Chain Warning
  let tempAlert = false;
  if (fridgeTemp !== null && (fridgeTemp < 2.0 || fridgeTemp > 8.0)) {
    tempAlert = true;
    showToast(`⚠️ Alert: Fridge temperature ${fridgeTemp}°C is outside the safe 2°C–8°C cold-chain window!`, 'error');
  }

  const isBudgewoiStore = (typeof getActiveTenant === 'function' && getActiveTenant() === 'budgewoi_dds') ||
    (window.currentTenant && (window.currentTenant.key === 'budgewoi' || window.currentTenant.id === 'budgewoi_dds')) ||
    (typeof window !== 'undefined' && window.location && window.location.hostname && (window.location.hostname.includes('budgewoi') || window.location.hostname.includes('dds')));

  const storeId = isBudgewoiStore ? 'budgewoi_dds' : 'amcal_woywoy';

  const newRecord = {
    id: 'hov_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
    pharmacyId: storeId,
    date,
    time,
    outgoing,
    incoming,
    shiftType,
    s8Confirmed,
    fridgeTemp,
    tempAlert,
    doctorQueries,
    owingScripts,
    websterStatus,
    stagedSupply,
    notes,
    createdAt: new Date().toISOString()
  };

  const history = getHandoverHistory();
  history.unshift(newRecord);
  saveHandoverHistory(history);

  // Sync to Supabase if table exists
  if (typeof window.BriskDB !== 'undefined' && window.BriskDB.supabase) {
    try {
      await window.BriskDB.supabase.from('brisk_dispensary_handovers').insert([{
        pharmacy_id: storeId,
        handover_date: date,
        handover_time: time,
        outgoing_pharmacist: outgoing,
        incoming_pharmacist: incoming,
        shift_type: shiftType,
        s8_confirmed: s8Confirmed,
        fridge_temp: fridgeTemp,
        details: {
          pharmacyId: storeId,
          doctorQueries,
          owingScripts,
          websterStatus,
          stagedSupply,
          notes
        }
      }]);
    } catch (dbErr) {
      // Graceful local-first fallback
    }
  }

  showToast('💊 Dispensary Shift Handover recorded successfully!', 'success');
  
  // Clear notes fields for next entry
  if (document.getElementById('handover-doctor-queries')) document.getElementById('handover-doctor-queries').value = '';
  if (document.getElementById('handover-owing-scripts')) document.getElementById('handover-owing-scripts').value = '';
  if (document.getElementById('handover-webster-status')) document.getElementById('handover-webster-status').value = '';
  if (document.getElementById('handover-staged-supply')) document.getElementById('handover-staged-supply').value = '';
  if (document.getElementById('handover-general-notes')) document.getElementById('handover-general-notes').value = '';

  renderHandoverHistoryList();
}

function renderHandoverHistoryList() {
  const container = document.getElementById('handover-history-container');
  if (!container) return;

  const history = getHandoverHistory();
  if (history.length === 0) {
    container.innerHTML = `
      <div style="padding: 1.5rem; text-align: center; color: var(--text-muted); font-size: 0.85rem;">
        <i class="fa-solid fa-clipboard-list" style="font-size: 1.5rem; opacity: 0.5; margin-bottom: 6px;"></i>
        <p>No dispensary shift handovers logged yet. Complete the form above to record your first handover.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = history.slice(0, 10).map((h, idx) => {
    const s8Badge = h.s8Confirmed
      ? '<span class="badge badge-success" style="font-size:0.7rem;"><i class="fa-solid fa-shield-check"></i> S8 Safe Balanced</span>'
      : '<span class="badge badge-warning" style="font-size:0.7rem;">⚠️ S8 Unchecked</span>';
    
    let tempBadge = '<span class="badge" style="background:rgba(255,255,255,0.05); color:var(--text-muted); font-size:0.7rem;">No Temp Log</span>';
    if (h.fridgeTemp !== null && !isNaN(h.fridgeTemp)) {
      if (h.fridgeTemp >= 2.0 && h.fridgeTemp <= 8.0) {
        tempBadge = `<span class="badge" style="background:rgba(56,189,248,0.15); color:#38bdf8; border:1px solid rgba(56,189,248,0.3); font-size:0.7rem;"><i class="fa-solid fa-snowflake"></i> ${h.fridgeTemp.toFixed(1)}°C (Cold-Chain OK)</span>`;
      } else {
        tempBadge = `<span class="badge" style="background:rgba(239,68,68,0.2); color:#ef4444; border:1px solid rgba(239,68,68,0.4); font-size:0.7rem;">⚠️ ${h.fridgeTemp.toFixed(1)}°C (OUT OF RANGE)</span>`;
      }
    }

    return `
      <div class="glass-card" style="padding: 12px; margin-bottom: 10px; border: 1px solid var(--border-glass); border-radius: var(--radius-sm); font-size: 0.82rem;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 8px; margin-bottom: 8px;">
          <div>
            <strong style="color: var(--accent-cyan); font-size: 0.9rem;">${h.date} @ ${h.time}</strong>
            <span style="color: var(--text-muted); font-size: 0.75rem; margin-left: 6px;">(${h.shiftType === 'morning_to_afternoon' ? 'Morning → Afternoon' : h.shiftType === 'day_to_closing' ? 'Day → Closing' : 'Weekend Locum Handover'})</span>
          </div>
          <div style="display: flex; gap: 6px; align-items: center;">
            ${s8Badge}
            ${tempBadge}
            <button type="button" class="btn btn-icon text-danger" style="padding: 2px 6px; font-size: 0.75rem;" onclick="deleteHandoverRecord('${h.id}')" title="Delete Entry"><i class="fa-solid fa-trash"></i></button>
          </div>
        </div>

        <div style="display: flex; gap: 16px; margin-bottom: 8px; font-size: 0.8rem; background: rgba(0,0,0,0.15); padding: 6px 10px; border-radius: 4px;">
          <div><span class="text-muted">Outgoing PIC:</span> <strong>${h.outgoing}</strong></div>
          <div><span class="text-muted">Incoming PIC:</span> <strong>${h.incoming}</strong></div>
        </div>

        ${h.doctorQueries ? `<div style="margin-bottom: 4px;"><strong style="color: #f59e0b;"><i class="fa-solid fa-user-doctor"></i> Doctor Queries:</strong> ${h.doctorQueries}</div>` : ''}
        ${h.owingScripts ? `<div style="margin-bottom: 4px;"><strong style="color: #ec4899;"><i class="fa-solid fa-file-prescription"></i> Owing Scripts:</strong> ${h.owingScripts}</div>` : ''}
        ${h.websterStatus ? `<div style="margin-bottom: 4px;"><strong style="color: #38bdf8;"><i class="fa-solid fa-box-archive"></i> Webster Packs:</strong> ${h.websterStatus}</div>` : ''}
        ${h.stagedSupply ? `<div style="margin-bottom: 4px;"><strong style="color: #a855f7;"><i class="fa-solid fa-capsules"></i> Staged Supply / OTD:</strong> ${h.stagedSupply}</div>` : ''}
        ${h.notes ? `<div style="margin-top: 6px; padding-top: 6px; border-top: 1px solid rgba(255,255,255,0.05); color: var(--text-secondary);"><i class="fa-solid fa-note-sticky"></i> ${h.notes}</div>` : ''}
      </div>
    `;
  }).join('');
}

function deleteHandoverRecord(id) {
  if (!confirm('Are you sure you want to delete this clinical handover record?')) return;
  let history = getHandoverHistory();
  history = history.filter(h => h.id !== id);
  saveHandoverHistory(history);
  renderHandoverHistoryList();
  showToast('Handover record deleted.', 'info');
}

function printDispensaryHandoverHistory() {
  window.print();
}

/* ==========================================================================
   PART 2: INTERACTIVE ALL-HANDS STAFF MEETING PRESENTATION DECK
   ========================================================================== */

let deckCurrentSlide = 0;
const TOTAL_SLIDES = 6;

function getSlideData() {
  const isBudgewoi = (typeof getActiveTenant === 'function' && getActiveTenant() === 'budgewoi_dds') ||
    (typeof window !== 'undefined' && window.currentTenant && (window.currentTenant.key === 'budgewoi' || window.currentTenant.id === 'budgewoi_dds')) ||
    (typeof window !== 'undefined' && window.location && window.location.hostname && (window.location.hostname.includes('budgewoi') || window.location.hostname.includes('dds')));

  if (isBudgewoi) {
    return [
      {
        title: "Welcome & Leadership Vision",
        subtitle: "Budgewoi Discount Drug Stores — All-Hands Team Launch",
        speakers: "Katherine Nguyen & Glen Kanawati (Owners)",
        badge: "Slide 1 of 6: Vision",
        contentHtml: `
          <div style="padding: 16px; background: rgba(122, 38, 130, 0.08); border: 1px solid rgba(122, 38, 130, 0.35); border-radius: 8px; margin-bottom: 16px;">
            <h4 style="margin: 0 0 8px 0; color: #ff6b00; font-size: 1.15rem;">
              <i class="fa-solid fa-heart-pulse"></i> Our Team is Our Greatest Strength
            </h4>
            <p style="font-size: 0.92rem; line-height: 1.6; color: var(--text-secondary); margin: 0;">
              Budgewoi Discount Drug Stores is our community’s trusted healthcare and discount pharmacy destination. We are launching this custom-engineered platform to give every team member complete schedule transparency, guaranteed Fair Work protections, predictable work-life balance, and frictionless mobile access.
            </p>
          </div>
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-top: 14px; text-align: center;">
            <div class="glass-card" style="padding: 14px; border: 1px solid rgba(16, 185, 129, 0.25);">
              <div style="font-size: 1.5rem; color: #10b981; margin-bottom: 4px;"><i class="fa-solid fa-mobile-screen-button"></i></div>
              <strong style="display: block; font-size: 0.9rem;">Mobile First</strong>
              <span style="font-size: 0.75rem; color: var(--text-muted);">24/7 access on your phone</span>
            </div>
            <div class="glass-card" style="padding: 14px; border: 1px solid rgba(255, 107, 0, 0.25);">
              <div style="font-size: 1.5rem; color: #ff6b00; margin-bottom: 4px;"><i class="fa-solid fa-scale-balanced"></i></div>
              <strong style="display: block; font-size: 0.9rem;">Fair Work 2026</strong>
              <span style="font-size: 0.75rem; color: var(--text-muted);">Protected breaks & loadings</span>
            </div>
            <div class="glass-card" style="padding: 14px; border: 1px solid rgba(168, 85, 247, 0.25);">
              <div style="font-size: 1.5rem; color: #c084fc; margin-bottom: 4px;"><i class="fa-solid fa-calendar-check"></i></div>
              <strong style="display: block; font-size: 0.9rem;">Predictable Life</strong>
              <span style="font-size: 0.75rem; color: var(--text-muted);">Advance published rosters</span>
            </div>
          </div>
        `
      },
      {
        title: "Why We Built This for You",
        subtitle: "Say Goodbye to Paper Rosters & Text Clutter",
        speakers: "Georgi Peek (Dispensary Manager) & Owners",
        badge: "Slide 2 of 6: The Why",
        contentHtml: `
          <div style="display: flex; flex-direction: column; gap: 12px;">
            <div style="display: flex; align-items: flex-start; gap: 12px; padding: 12px; background: rgba(255, 255, 255, 0.02); border: 1px solid var(--border-glass); border-radius: 8px;">
              <div style="width: 32px; height: 32px; border-radius: 50%; background: rgba(239, 68, 68, 0.15); color: #ef4444; display: flex; align-items: center; justify-content: center; font-weight: 700; flex-shrink: 0;"><i class="fa-solid fa-ban"></i></div>
              <div>
                <strong style="font-size: 0.92rem; color: var(--text-primary);">No More Paper Rosters or Group Chat Screenshots</strong>
                <p style="font-size: 0.82rem; color: var(--text-muted); margin: 2px 0 0 0;">No more blurry photos of paper rotas stuck to the dispensary fridge door. Check your exact shifts anytime on your phone.</p>
              </div>
            </div>
            <div style="display: flex; align-items: flex-start; gap: 12px; padding: 12px; background: rgba(255, 255, 255, 0.02); border: 1px solid var(--border-glass); border-radius: 8px;">
              <div style="width: 32px; height: 32px; border-radius: 50%; background: rgba(16, 185, 129, 0.15); color: #10b981; display: flex; align-items: center; justify-content: center; font-weight: 700; flex-shrink: 0;"><i class="fa-solid fa-clock"></i></div>
              <div>
                <strong style="font-size: 0.92rem; color: var(--text-primary);">Explicit Working Times & Clear Roles</strong>
                <p style="font-size: 0.82rem; color: var(--text-muted); margin: 2px 0 0 0;">Every shift displays your start and finish time, scheduled break allocation, and specific role (Dispensary, Webster Packing, Floor Customer Service, or Tills).</p>
              </div>
            </div>
            <div style="display: flex; align-items: flex-start; gap: 12px; padding: 12px; background: rgba(255, 255, 255, 0.02); border: 1px solid var(--border-glass); border-radius: 8px;">
              <div style="width: 32px; height: 32px; border-radius: 50%; background: rgba(255, 107, 0, 0.15); color: #ff6b00; display: flex; align-items: center; justify-content: center; font-weight: 700; flex-shrink: 0;"><i class="fa-solid fa-calendar-plus"></i></div>
              <div>
                <strong style="font-size: 0.92rem; color: var(--text-primary);">1-Tap Personal Calendar Sync</strong>
                <p style="font-size: 0.82rem; color: var(--text-muted); margin: 2px 0 0 0;">Easily export your rostered shifts straight into your iPhone Apple Calendar or Google Calendar so your personal life stays synchronized.</p>
              </div>
            </div>
          </div>
        `
      },
      {
        title: "Live Mobile App Walkthrough",
        subtitle: "Simple, Fast, and Built for Everyday Store Life",
        speakers: "Georgi Peek (Demonstration)",
        badge: "Slide 3 of 6: How It Works",
        contentHtml: `
          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px;">
            <div class="glass-card" style="padding: 14px; border: 1px solid rgba(255, 107, 0, 0.25);">
              <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                <span style="width: 24px; height: 24px; border-radius: 50%; background: #ff6b00; color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 0.75rem;">1</span>
                <strong style="font-size: 0.9rem; color: var(--text-primary);">View Your Roster</strong>
              </div>
              <p style="font-size: 0.8rem; color: var(--text-secondary); margin: 0; line-height: 1.4;">
                Log in to see your weekly shifts. Colored badges highlight your department and shift duration.
              </p>
            </div>
            <div class="glass-card" style="padding: 14px; border: 1px solid rgba(16, 185, 129, 0.2);">
              <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                <span style="width: 24px; height: 24px; border-radius: 50%; background: #10b981; color: #000; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 0.75rem;">2</span>
                <strong style="font-size: 0.9rem; color: var(--text-primary);">1-Tap Clock-In</strong>
              </div>
              <p style="font-size: 0.8rem; color: var(--text-secondary); margin: 0; line-height: 1.4;">
                Arrive at Budgewoi Discount Drug Stores, open the app, and tap <strong>"Clock In"</strong>. Geofence confirms your attendance.
              </p>
            </div>
            <div class="glass-card" style="padding: 14px; border: 1px solid rgba(245, 158, 11, 0.2);">
              <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                <span style="width: 24px; height: 24px; border-radius: 50%; background: #f59e0b; color: #000; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 0.75rem;">3</span>
                <strong style="font-size: 0.9rem; color: var(--text-primary);">Record Your Break</strong>
              </div>
              <p style="font-size: 0.8rem; color: var(--text-secondary); margin: 0; line-height: 1.4;">
                Heading on lunch? Tap <strong>"Start Break"</strong>; tap <strong>"End Break"</strong> when returning. 100% transparent.
              </p>
            </div>
            <div class="glass-card" style="padding: 14px; border: 1px solid rgba(168, 85, 247, 0.2);">
              <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                <span style="width: 24px; height: 24px; border-radius: 50%; background: #c084fc; color: #000; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 0.75rem;">4</span>
                <strong style="font-size: 0.9rem; color: var(--text-primary);">Request Time Off</strong>
              </div>
              <p style="font-size: 0.8rem; color: var(--text-secondary); margin: 0; line-height: 1.4;">
                Need university study time or annual leave? Submit partial-day or full-day leave with instant status tracking.
              </p>
            </div>
          </div>
        `
      },
      {
        title: "Respecting Your Time & Fair Work Rights",
        subtitle: "Pharmacy Industry Award 2026 Guarantees",
        speakers: "Katherine Nguyen (Owner & Finance)",
        badge: "Slide 4 of 6: Compliance",
        contentHtml: `
          <div style="padding: 14px; background: rgba(16, 185, 129, 0.08); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 8px; margin-bottom: 14px;">
            <strong style="color: #10b981; font-size: 0.95rem;"><i class="fa-solid fa-shield-halved"></i> Our Promise as Store Owners:</strong>
            <p style="font-size: 0.85rem; color: var(--text-secondary); margin: 4px 0 0 0; line-height: 1.5;">
              Every hour, loading, and break is tracked with 100% precision. Katherine and Georgi review approved timesheets weekly to ensure prompt, accurate payment through our payroll bureau.
            </p>
          </div>
          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; font-size: 0.82rem;">
            <div style="padding: 10px; background: rgba(255,255,255,0.02); border: 1px solid var(--border-glass); border-radius: 6px;">
              <strong style="color: #ff6b00;">🍱 Guaranteed 30m Meal Break</strong>
              <div style="color: var(--text-muted); font-size: 0.75rem; margin-top: 2px;">Shifts of 5+ hours are legally guaranteed a 30–60 min meal break.</div>
            </div>
            <div style="padding: 10px; background: rgba(255,255,255,0.02); border: 1px solid var(--border-glass); border-radius: 6px;">
              <strong style="color: #c084fc;">☕ Paid 10m Rest Intervals</strong>
              <div style="color: var(--text-muted); font-size: 0.75rem; margin-top: 2px;">4h+ shifts receive 1x paid tea break; 7.6h+ shifts receive 2x paid tea breaks.</div>
            </div>
            <div style="padding: 10px; background: rgba(255,255,255,0.02); border: 1px solid var(--border-glass); border-radius: 6px;">
              <strong style="color: #f59e0b;">🌙 10-Hour Rest Between Shifts</strong>
              <div style="color: var(--text-muted); font-size: 0.75rem; margin-top: 2px;">The system protects you from finishing late and starting early without proper rest.</div>
            </div>
            <div style="padding: 10px; background: rgba(255,255,255,0.02); border: 1px solid var(--border-glass); border-radius: 6px;">
              <strong style="color: #ec4899;">⚡ Automated Penalty Loadings</strong>
              <div style="color: var(--text-muted); font-size: 0.75rem; margin-top: 2px;">Saturday (125%/150%), Sunday (175%/200%), and Public Holiday rates tracked automatically.</div>
            </div>
          </div>
        `
      },
      {
        title: "Flexibility & Peer Shift Swaps",
        subtitle: "Empowering Staff with Easy, Transparent Shift Trades",
        speakers: "Georgi Peek & Team Leads",
        badge: "Slide 5 of 6: Swaps",
        contentHtml: `
          <div style="padding: 14px; background: rgba(122, 38, 130, 0.1); border: 1px solid rgba(122, 38, 130, 0.35); border-radius: 8px; margin-bottom: 14px;">
            <h4 style="margin: 0 0 6px 0; color: #ff6b00; font-size: 1rem;"><i class="fa-solid fa-right-left"></i> Shift Swap Marketplace</h4>
            <p style="font-size: 0.85rem; color: var(--text-secondary); margin: 0; line-height: 1.5;">
              Life happens! If you have an exam, family appointment, or sudden clash, you can trade shifts with a qualified teammate directly inside the app.
            </p>
          </div>
          <div style="display: flex; flex-direction: column; gap: 8px;">
            <div style="display: flex; align-items: center; gap: 10px; font-size: 0.82rem;">
              <span class="badge badge-warning" style="width: 70px; text-align: center; background: #ff6b00; color: #fff;">Step 1</span>
              <span>Tap your scheduled shift and click <strong>"Request Swap"</strong>.</span>
            </div>
            <div style="display: flex; align-items: center; gap: 10px; font-size: 0.82rem;">
              <span class="badge badge-warning" style="width: 70px; text-align: center; background: #ff6b00; color: #fff;">Step 2</span>
              <span>Pick an eligible colleague (app checks that neither exceeds 38 hours or breaks rest rules).</span>
            </div>
            <div style="display: flex; align-items: center; gap: 10px; font-size: 0.82rem;">
              <span class="badge badge-warning" style="width: 70px; text-align: center; background: #ff6b00; color: #fff;">Step 3</span>
              <span>Your teammate accepts on their phone; Georgi or Katherine clicks <strong>Approve</strong>. Done!</span>
            </div>
          </div>
        `
      },
      {
        title: "1-Click Setup: Add to Home Screen",
        subtitle: "Let's Get Everyone Installed Right Now!",
        speakers: "All Staff Interactive Setup",
        badge: "Slide 6 of 6: Launch",
        contentHtml: `
          <div style="padding: 16px; background: linear-gradient(135deg, rgba(122, 38, 130, 0.2) 0%, rgba(255, 107, 0, 0.15) 100%); border: 1px solid rgba(255, 107, 0, 0.35); border-radius: 8px; text-align: center; margin-bottom: 16px;">
            <h3 style="margin: 0 0 6px 0; font-size: 1.25rem; color: #fff;">Everyone Take Out Your Smartphone Now 📱</h3>
            <p style="font-size: 0.88rem; color: #ff6b00; font-weight: 700; margin: 0;">
              https://budgewoiddsroster.vercel.app
            </p>
          </div>
          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px;">
            <div class="glass-card" style="padding: 14px; border: 1px solid rgba(255,255,255,0.15);">
              <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
                <i class="fa-brands fa-apple" style="font-size: 1.2rem; color: #fff;"></i>
                <strong style="font-size: 0.9rem;">iPhone (Safari)</strong>
              </div>
              <ol style="margin: 0; padding-left: 18px; font-size: 0.8rem; color: var(--text-secondary); line-height: 1.5;">
                <li>Open the URL in <strong>Safari</strong>.</li>
                <li>Tap the <strong>Share</strong> button (box with up arrow).</li>
                <li>Scroll down and tap <strong>"Add to Home Screen"</strong>.</li>
                <li>The Budgewoi DDS Rosters icon will appear on your home screen!</li>
              </ol>
            </div>
            <div class="glass-card" style="padding: 14px; border: 1px solid rgba(255,255,255,0.15);">
              <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
                <i class="fa-brands fa-android" style="font-size: 1.2rem; color: #10b981;"></i>
                <strong style="font-size: 0.9rem;">Android (Chrome)</strong>
              </div>
              <ol style="margin: 0; padding-left: 18px; font-size: 0.8rem; color: var(--text-secondary); line-height: 1.5;">
                <li>Open the URL in <strong>Chrome</strong>.</li>
                <li>Tap the <strong>Three Dots</strong> (top right).</li>
                <li>Tap <strong>"Install app"</strong> or <strong>"Add to Home screen"</strong>.</li>
                <li>Tap Install to save the official Budgewoi DDS app.</li>
              </ol>
            </div>
          </div>
        `
      }
    ];
  }

  // Default Amcal Pharmacy Woy Woy Slide Data
  return [
    {
      title: "Welcome & Leadership Vision",
      subtitle: "Amcal Pharmacy Woy Woy — All-Hands Team Launch",
      speakers: "Glen Kanawati, Katherine Nguyen & Peter Kim",
      badge: "Slide 1 of 6: Vision",
      contentHtml: `
        <div style="padding: 16px; background: rgba(0, 229, 255, 0.05); border: 1px solid rgba(0, 229, 255, 0.25); border-radius: 8px; margin-bottom: 16px;">
          <h4 style="margin: 0 0 8px 0; color: var(--accent-cyan); font-size: 1.15rem;">
            <i class="fa-solid fa-heart-pulse"></i> Our Team is Our Greatest Strength
          </h4>
          <p style="font-size: 0.92rem; line-height: 1.6; color: var(--text-secondary); margin: 0;">
            Amcal Pharmacy Woy Woy is Peninsula Plaza’s premier community healthcare hub. We are launching this custom-engineered platform to give every team member complete schedule transparency, guaranteed Fair Work protections, predictable work-life balance, and frictionless mobile access.
          </p>
        </div>
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-top: 14px; text-align: center;">
          <div class="glass-card" style="padding: 14px; border: 1px solid rgba(16, 185, 129, 0.25);">
            <div style="font-size: 1.5rem; color: #10b981; margin-bottom: 4px;"><i class="fa-solid fa-mobile-screen-button"></i></div>
            <strong style="display: block; font-size: 0.9rem;">Mobile First</strong>
            <span style="font-size: 0.75rem; color: var(--text-muted);">24/7 access on your phone</span>
          </div>
          <div class="glass-card" style="padding: 14px; border: 1px solid rgba(56, 189, 248, 0.25);">
            <div style="font-size: 1.5rem; color: #38bdf8; margin-bottom: 4px;"><i class="fa-solid fa-scale-balanced"></i></div>
            <strong style="display: block; font-size: 0.9rem;">Fair Work 2026</strong>
            <span style="font-size: 0.75rem; color: var(--text-muted);">Protected breaks & loadings</span>
          </div>
          <div class="glass-card" style="padding: 14px; border: 1px solid rgba(168, 85, 247, 0.25);">
            <div style="font-size: 1.5rem; color: #c084fc; margin-bottom: 4px;"><i class="fa-solid fa-calendar-check"></i></div>
            <strong style="display: block; font-size: 0.9rem;">Predictable Life</strong>
            <span style="font-size: 0.75rem; color: var(--text-muted);">Advance published rosters</span>
          </div>
        </div>
      `
    },
    {
      title: "Why We Built This for You",
      subtitle: "Say Goodbye to Paper Rosters & Text Clutter",
      speakers: "Peter Kim (Managing Pharmacist)",
      badge: "Slide 2 of 6: The Why",
      contentHtml: `
        <div style="display: flex; flex-direction: column; gap: 12px;">
          <div style="display: flex; align-items: flex-start; gap: 12px; padding: 12px; background: rgba(255, 255, 255, 0.02); border: 1px solid var(--border-glass); border-radius: 8px;">
            <div style="width: 32px; height: 32px; border-radius: 50%; background: rgba(239, 68, 68, 0.15); color: #ef4444; display: flex; align-items: center; justify-content: center; font-weight: 700; flex-shrink: 0;"><i class="fa-solid fa-ban"></i></div>
            <div>
              <strong style="font-size: 0.92rem; color: var(--text-primary);">No More Paper Rosters or Group Chat Screenshots</strong>
              <p style="font-size: 0.82rem; color: var(--text-muted); margin: 2px 0 0 0;">No more blurry photos of paper rotas stuck to the dispensary fridge door. Check your exact shifts anytime on your phone.</p>
            </div>
          </div>
          <div style="display: flex; align-items: flex-start; gap: 12px; padding: 12px; background: rgba(255, 255, 255, 0.02); border: 1px solid var(--border-glass); border-radius: 8px;">
            <div style="width: 32px; height: 32px; border-radius: 50%; background: rgba(16, 185, 129, 0.15); color: #10b981; display: flex; align-items: center; justify-content: center; font-weight: 700; flex-shrink: 0;"><i class="fa-solid fa-clock"></i></div>
            <div>
              <strong style="font-size: 0.92rem; color: var(--text-primary);">Explicit Working Times & Clear Roles</strong>
              <p style="font-size: 0.82rem; color: var(--text-muted); margin: 2px 0 0 0;">Every shift displays your start and finish time, scheduled break allocation, and specific role (Dispensary, Webster Packing, Floor Customer Service, or Tills).</p>
            </div>
          </div>
          <div style="display: flex; align-items: flex-start; gap: 12px; padding: 12px; background: rgba(255, 255, 255, 0.02); border: 1px solid var(--border-glass); border-radius: 8px;">
            <div style="width: 32px; height: 32px; border-radius: 50%; background: rgba(56, 189, 248, 0.15); color: #38bdf8; display: flex; align-items: center; justify-content: center; font-weight: 700; flex-shrink: 0;"><i class="fa-solid fa-calendar-plus"></i></div>
            <div>
              <strong style="font-size: 0.92rem; color: var(--text-primary);">1-Tap Personal Calendar Sync</strong>
              <p style="font-size: 0.82rem; color: var(--text-muted); margin: 2px 0 0 0;">Easily export your rostered shifts straight into your iPhone Apple Calendar or Google Calendar so your personal life stays synchronized.</p>
            </div>
          </div>
        </div>
      `
    },
    {
      title: "Live Mobile App Walkthrough",
      subtitle: "Simple, Fast, and Built for Everyday Store Life",
      speakers: "Peter Kim (Demonstration)",
      badge: "Slide 3 of 6: How It Works",
      contentHtml: `
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px;">
          <div class="glass-card" style="padding: 14px; border: 1px solid rgba(0, 229, 255, 0.2);">
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
              <span style="width: 24px; height: 24px; border-radius: 50%; background: var(--accent-cyan); color: #000; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 0.75rem;">1</span>
              <strong style="font-size: 0.9rem; color: var(--text-primary);">View Your Roster</strong>
            </div>
            <p style="font-size: 0.8rem; color: var(--text-secondary); margin: 0; line-height: 1.4;">
              Log in to see your weekly shifts. Colored badges highlight your department and shift duration.
            </p>
          </div>
          <div class="glass-card" style="padding: 14px; border: 1px solid rgba(16, 185, 129, 0.2);">
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
              <span style="width: 24px; height: 24px; border-radius: 50%; background: #10b981; color: #000; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 0.75rem;">2</span>
              <strong style="font-size: 0.9rem; color: var(--text-primary);">1-Tap Clock-In</strong>
            </div>
            <p style="font-size: 0.8rem; color: var(--text-secondary); margin: 0; line-height: 1.4;">
              Arrive at Peninsula Plaza, open the app, and tap <strong>"Clock In"</strong>. Geofence confirms your attendance.
            </p>
          </div>
          <div class="glass-card" style="padding: 14px; border: 1px solid rgba(245, 158, 11, 0.2);">
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
              <span style="width: 24px; height: 24px; border-radius: 50%; background: #f59e0b; color: #000; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 0.75rem;">3</span>
              <strong style="font-size: 0.9rem; color: var(--text-primary);">Record Your Break</strong>
            </div>
            <p style="font-size: 0.8rem; color: var(--text-secondary); margin: 0; line-height: 1.4;">
              Heading on lunch? Tap <strong>"Start Break"</strong>; tap <strong>"End Break"</strong> when returning. 100% transparent.
            </p>
          </div>
          <div class="glass-card" style="padding: 14px; border: 1px solid rgba(168, 85, 247, 0.2);">
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
              <span style="width: 24px; height: 24px; border-radius: 50%; background: #c084fc; color: #000; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 0.75rem;">4</span>
              <strong style="font-size: 0.9rem; color: var(--text-primary);">Request Time Off</strong>
            </div>
            <p style="font-size: 0.8rem; color: var(--text-secondary); margin: 0; line-height: 1.4;">
              Need university study time or annual leave? Submit partial-day or full-day leave with instant status tracking.
            </p>
          </div>
        </div>
      `
    },
    {
      title: "Respecting Your Time & Fair Work Rights",
      subtitle: "Pharmacy Industry Award 2026 Guarantees",
      speakers: "Katherine Nguyen (Owner & Finance)",
      badge: "Slide 4 of 6: Compliance",
      contentHtml: `
        <div style="padding: 14px; background: rgba(16, 185, 129, 0.08); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 8px; margin-bottom: 14px;">
          <strong style="color: #10b981; font-size: 0.95rem;"><i class="fa-solid fa-shield-halved"></i> Our Promise as Store Owners:</strong>
          <p style="font-size: 0.85rem; color: var(--text-secondary); margin: 4px 0 0 0; line-height: 1.5;">
            Every hour, loading, and break is tracked with 100% precision. Katherine and Peter review approved timesheets weekly to ensure prompt, accurate payment through our payroll bureau.
          </p>
        </div>
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; font-size: 0.82rem;">
          <div style="padding: 10px; background: rgba(255,255,255,0.02); border: 1px solid var(--border-glass); border-radius: 6px;">
            <strong style="color: #38bdf8;">🍱 Guaranteed 30m Meal Break</strong>
            <div style="color: var(--text-muted); font-size: 0.75rem; margin-top: 2px;">Shifts of 5+ hours are legally guaranteed a 30–60 min meal break.</div>
          </div>
          <div style="padding: 10px; background: rgba(255,255,255,0.02); border: 1px solid var(--border-glass); border-radius: 6px;">
            <strong style="color: #c084fc;">☕ Paid 10m Rest Intervals</strong>
            <div style="color: var(--text-muted); font-size: 0.75rem; margin-top: 2px;">4h+ shifts receive 1x paid tea break; 7.6h+ shifts receive 2x paid tea breaks.</div>
          </div>
          <div style="padding: 10px; background: rgba(255,255,255,0.02); border: 1px solid var(--border-glass); border-radius: 6px;">
            <strong style="color: #f59e0b;">🌙 10-Hour Rest Between Shifts</strong>
            <div style="color: var(--text-muted); font-size: 0.75rem; margin-top: 2px;">The system protects you from finishing late and starting early without proper rest.</div>
          </div>
          <div style="padding: 10px; background: rgba(255,255,255,0.02); border: 1px solid var(--border-glass); border-radius: 6px;">
            <strong style="color: #ec4899;">⚡ Automated Penalty Loadings</strong>
            <div style="color: var(--text-muted); font-size: 0.75rem; margin-top: 2px;">Saturday (125%/150%), Sunday (175%/200%), and Public Holiday rates tracked automatically.</div>
          </div>
        </div>
      `
    },
    {
      title: "Flexibility & Peer Shift Swaps",
      subtitle: "Empowering Staff with Easy, Transparent Shift Trades",
      speakers: "Peter Kim & Team Leads",
      badge: "Slide 5 of 6: Swaps",
      contentHtml: `
        <div style="padding: 14px; background: rgba(168, 85, 247, 0.08); border: 1px solid rgba(168, 85, 247, 0.3); border-radius: 8px; margin-bottom: 14px;">
          <h4 style="margin: 0 0 6px 0; color: #c084fc; font-size: 1rem;"><i class="fa-solid fa-right-left"></i> Shift Swap Marketplace</h4>
          <p style="font-size: 0.85rem; color: var(--text-secondary); margin: 0; line-height: 1.5;">
            Life happens! If you have an exam, family appointment, or sudden clash, you can trade shifts with a qualified teammate directly inside the app.
          </p>
        </div>
        <div style="display: flex; flex-direction: column; gap: 8px;">
          <div style="display: flex; align-items: center; gap: 10px; font-size: 0.82rem;">
            <span class="badge badge-cyan" style="width: 70px; text-align: center;">Step 1</span>
            <span>Tap your scheduled shift and click <strong>"Request Swap"</strong>.</span>
          </div>
          <div style="display: flex; align-items: center; gap: 10px; font-size: 0.82rem;">
            <span class="badge badge-cyan" style="width: 70px; text-align: center;">Step 2</span>
            <span>Pick an eligible colleague (app checks that neither exceeds 38 hours or breaks rest rules).</span>
          </div>
          <div style="display: flex; align-items: center; gap: 10px; font-size: 0.82rem;">
            <span class="badge badge-cyan" style="width: 70px; text-align: center;">Step 3</span>
            <span>Your teammate accepts on their phone; Peter clicks <strong>Approve</strong>. Done!</span>
          </div>
        </div>
      `
    },
    {
      title: "1-Click Setup: Add to Home Screen",
      subtitle: "Let's Get Everyone Installed Right Now!",
      speakers: "All Staff Interactive Setup",
      badge: "Slide 6 of 6: Launch",
      contentHtml: `
        <div style="padding: 16px; background: linear-gradient(135deg, rgba(0, 229, 255, 0.1) 0%, rgba(168, 85, 247, 0.08) 100%); border: 1px solid rgba(0, 229, 255, 0.3); border-radius: 8px; text-align: center; margin-bottom: 16px;">
          <h3 style="margin: 0 0 6px 0; font-size: 1.25rem; color: #fff;">Everyone Take Out Your Smartphone Now 📱</h3>
          <p style="font-size: 0.88rem; color: var(--accent-cyan); font-weight: 700; margin: 0;">
            https://woywoyamcalroster.vercel.app
          </p>
        </div>
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px;">
          <div class="glass-card" style="padding: 14px; border: 1px solid rgba(255,255,255,0.15);">
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
              <i class="fa-brands fa-apple" style="font-size: 1.2rem; color: #fff;"></i>
              <strong style="font-size: 0.9rem;">iPhone (Safari)</strong>
            </div>
            <ol style="margin: 0; padding-left: 18px; font-size: 0.8rem; color: var(--text-secondary); line-height: 1.5;">
              <li>Open the URL in <strong>Safari</strong>.</li>
              <li>Tap the <strong>Share</strong> button (box with up arrow).</li>
              <li>Scroll down and tap <strong>"Add to Home Screen"</strong>.</li>
              <li>The Amcal Rosters icon will appear on your home screen!</li>
            </ol>
          </div>
          <div class="glass-card" style="padding: 14px; border: 1px solid rgba(255,255,255,0.15);">
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
              <i class="fa-brands fa-android" style="font-size: 1.2rem; color: #10b981;"></i>
              <strong style="font-size: 0.9rem;">Android (Chrome)</strong>
            </div>
            <ol style="margin: 0; padding-left: 18px; font-size: 0.8rem; color: var(--text-secondary); line-height: 1.5;">
              <li>Open the URL in <strong>Chrome</strong>.</li>
              <li>Tap the <strong>Three Dots</strong> (top right).</li>
              <li>Tap <strong>"Install app"</strong> or <strong>"Add to Home screen"</strong>.</li>
              <li>Tap Install to save the official Amcal Woy Woy app.</li>
            </ol>
          </div>
        </div>
      `
    }
  ];
}

// Proxy wrapper for backward compatibility with direct SLIDE_DATA array access
const SLIDE_DATA = new Proxy([], {
  get: (target, prop) => {
    const list = getSlideData();
    if (prop === 'length') return list.length;
    return list[prop];
  }
});

function openAllHandsDeckModal(startSlide = 0) {
  const modal = document.getElementById('modal-all-hands-deck');
  if (!modal) return;
  deckCurrentSlide = Math.max(0, Math.min(TOTAL_SLIDES - 1, startSlide));

  const isBudgewoi = (typeof getActiveTenant === 'function' && getActiveTenant() === 'budgewoi_dds') ||
    (typeof window !== 'undefined' && window.currentTenant && (window.currentTenant.key === 'budgewoi' || window.currentTenant.id === 'budgewoi_dds'));

  const headerTitleEl = document.getElementById('deck-modal-header-title');
  if (headerTitleEl) {
    headerTitleEl.textContent = isBudgewoi ? 'Budgewoi DDS All-Hands Meeting Deck' : 'Amcal Woy Woy All-Hands Meeting Deck';
  }

  renderAllHandsDeckSlide();
  modal.classList.add('active');
}

function closeAllHandsDeckModal() {
  const modal = document.getElementById('modal-all-hands-deck');
  if (modal) modal.classList.remove('active');
}

function changeAllHandsSlide(delta) {
  const target = deckCurrentSlide + delta;
  if (target >= 0 && target < TOTAL_SLIDES) {
    deckCurrentSlide = target;
    renderAllHandsDeckSlide();
  }
}

function jumpToAllHandsSlide(idx) {
  if (idx >= 0 && idx < TOTAL_SLIDES) {
    deckCurrentSlide = idx;
    renderAllHandsDeckSlide();
  }
}

function renderAllHandsDeckSlide() {
  const slides = getSlideData();
  const slide = slides[deckCurrentSlide] || slides[0];
  if (!slide) return;

  const badgeEl = document.getElementById('deck-slide-badge');
  const titleEl = document.getElementById('deck-slide-title');
  const subEl = document.getElementById('deck-slide-subtitle');
  const speakersEl = document.getElementById('deck-slide-speakers');
  const bodyEl = document.getElementById('deck-slide-body');
  const prevBtn = document.getElementById('deck-btn-prev');
  const nextBtn = document.getElementById('deck-btn-next');
  const dotsContainer = document.getElementById('deck-slide-dots');

  if (badgeEl) badgeEl.textContent = slide.badge;
  if (titleEl) titleEl.textContent = slide.title;
  if (subEl) subEl.textContent = slide.subtitle;
  if (speakersEl) speakersEl.textContent = slide.speakers;
  if (bodyEl) bodyEl.innerHTML = slide.contentHtml;

  if (prevBtn) prevBtn.disabled = deckCurrentSlide === 0;
  if (nextBtn) nextBtn.disabled = deckCurrentSlide === TOTAL_SLIDES - 1;

  const isBudgewoi = (typeof getActiveTenant === 'function' && getActiveTenant() === 'budgewoi_dds') ||
    (typeof window !== 'undefined' && window.currentTenant && (window.currentTenant.key === 'budgewoi' || window.currentTenant.id === 'budgewoi_dds'));
  const activeDotColor = isBudgewoi ? '#ff6b00' : 'var(--accent-cyan)';

  if (dotsContainer) {
    dotsContainer.innerHTML = Array.from({ length: TOTAL_SLIDES }).map((_, i) => `
      <button type="button" class="deck-dot ${i === deckCurrentSlide ? 'active' : ''}" onclick="jumpToAllHandsSlide(${i})" title="Slide ${i + 1}" style="width: ${i === deckCurrentSlide ? '22px' : '8px'}; height: 8px; border-radius: 4px; border: none; background: ${i === deckCurrentSlide ? activeDotColor : 'rgba(255,255,255,0.25)'}; transition: all 0.2s ease; cursor: pointer; padding: 0;"></button>
    `).join('');
  }
}

function toggleDeckFullscreen() {
  const modalContent = document.querySelector('#modal-all-hands-deck .modal-content');
  if (!modalContent) return;
  modalContent.classList.toggle('deck-fullscreen');
}

/* ==========================================================================
   GLOBAL WINDOW EXPORTS
   ========================================================================== */
if (typeof window !== 'undefined') {
  window.getHandoverHistory = getHandoverHistory;
  window.saveHandoverHistory = saveHandoverHistory;
  window.openDispensaryHandoverModal = openDispensaryHandoverModal;
  window.closeDispensaryHandoverModal = closeDispensaryHandoverModal;
  window.onIncomingSelectChange = onIncomingSelectChange;
  window.handleSaveHandover = handleSaveHandover;
  window.renderHandoverHistoryList = renderHandoverHistoryList;
  window.deleteHandoverRecord = deleteHandoverRecord;
  window.printDispensaryHandoverHistory = printDispensaryHandoverHistory;

  window.openAllHandsDeckModal = openAllHandsDeckModal;
  window.closeAllHandsDeckModal = closeAllHandsDeckModal;
  window.openAllHandsModal = openAllHandsDeckModal;
  window.closeAllHandsModal = closeAllHandsDeckModal;
  window.changeAllHandsSlide = changeAllHandsSlide;
  window.jumpToAllHandsSlide = jumpToAllHandsSlide;
  window.toggleDeckFullscreen = toggleDeckFullscreen;
}
