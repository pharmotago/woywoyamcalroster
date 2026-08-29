/**
 * BriskSchedules Cloud Database & Sync Layer — Supabase PostgreSQL implementation
 */
import supabase from './supabase-client.js';

const BriskDB = (function() {
  const STORAGE_KEYS = {
    SESSION: 'brisk_session',
    CACHE_EMPLOYEES: 'brisk_cache_employees',
    CACHE_SHIFTS: 'brisk_cache_shifts',
    CACHE_TIMECARDS: 'brisk_cache_timecards',
    CACHE_SETTINGS: 'brisk_cache_settings',
    CACHE_LEAVE: 'brisk_cache_leave'
  };

  // Instant 0ms Local Cache Loader
  function loadLocalCache() {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return;
      const emps = localStorage.getItem(STORAGE_KEYS.CACHE_EMPLOYEES);
      if (emps) {
        const parsed = JSON.parse(emps);
        if (Array.isArray(parsed) && parsed.length > 0) _employees = parsed;
      }
      const shifts = localStorage.getItem(STORAGE_KEYS.CACHE_SHIFTS);
      if (shifts) {
        const parsed = JSON.parse(shifts);
        if (Array.isArray(parsed)) _shifts = parsed;
      }
      const tc = localStorage.getItem(STORAGE_KEYS.CACHE_TIMECARDS);
      if (tc) {
        const parsed = JSON.parse(tc);
        if (Array.isArray(parsed)) _timecards = parsed;
      }
      const st = localStorage.getItem(STORAGE_KEYS.CACHE_SETTINGS);
      if (st) {
        const parsed = JSON.parse(st);
        if (parsed) _settings = parsed;
      }
      const lr = localStorage.getItem(STORAGE_KEYS.CACHE_LEAVE);
      if (lr) {
        const parsed = JSON.parse(lr);
        if (Array.isArray(parsed)) _leaveRequests = parsed;
      }
    } catch (e) {
      console.warn('[DB] Local cache load note:', e);
    }
  }
  loadLocalCache();

  function saveLocalCache() {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return;
      if (_employees.length > 0) localStorage.setItem(STORAGE_KEYS.CACHE_EMPLOYEES, JSON.stringify(_employees));
      if (_shifts.length > 0) localStorage.setItem(STORAGE_KEYS.CACHE_SHIFTS, JSON.stringify(_shifts));
      if (_timecards.length > 0) localStorage.setItem(STORAGE_KEYS.CACHE_TIMECARDS, JSON.stringify(_timecards));
      if (_settings) localStorage.setItem(STORAGE_KEYS.CACHE_SETTINGS, JSON.stringify(_settings));
      if (_leaveRequests.length > 0) localStorage.setItem(STORAGE_KEYS.CACHE_LEAVE, JSON.stringify(_leaveRequests));
    } catch (e) {}
  }

  // Helper to load session
  function getSession() {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return null;
      const val = localStorage.getItem(STORAGE_KEYS.SESSION);
      return val ? JSON.parse(val) : null;
    } catch (e) {
      console.warn('[DB] Stored session parsing failed:', e);
      return null;
    }
  }

  // Helper to get a valid token (refreshes via Supabase Client SDK if expired)
  async function getValidToken() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session && session.access_token) {
        const localSession = getSession();
        if (localSession) {
          localSession.token = session.access_token;
          localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(localSession));
        }
        return session.access_token;
      }
    } catch (e) {
      console.warn('Failed to retrieve fresh session token:', e);
    }
    const localSession = getSession();
    return localSession ? localSession.token : '';
  }

  async function getMutateAuthToken() {
    try {
      const freshToken = await getValidToken();
      if (freshToken) return freshToken;
    } catch (e) {}
    const localSession = getSession();
    return localSession ? localSession.token : '';
  }

  function setSession(session) {
    if (session) {
      localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(session));
    } else {
      localStorage.removeItem(STORAGE_KEYS.SESSION);
      // Clear data on logout
      _employees = [];
      _shifts = [];
      _historicalShifts = [];
      _timecards = [];
      _historicalTimecards = [];
      _leaveRequests = [];
      _historicalLeaveRequests = [];
      
      // Detach all listeners
      _listeners.forEach(unsub => unsub());
      _listeners = [];
      
      _initialLoadCompleted = { employees: false, shifts: false, timecards: false, leaveRequests: false };

      supabase.auth.signOut().catch(err => console.warn('Supabase signOut failed:', err));
    }
  }

  // --- SQL Mapper Functions to resolve DB Snake Case vs JS Camel Case ---
  function mapEmployeeToDb(emp) {
    const avail = { ...(emp.availability || {}) };
    if (emp.dob) avail.dob = emp.dob;
    if (Array.isArray(emp.certificates)) avail.certificates = emp.certificates;
    const obj = {
      name: emp.name,
      email: emp.email,
      role: emp.role,
      phone: emp.phone || null,
      hourly_rate: (emp.hourlyRate != null && !isNaN(emp.hourlyRate)) ? emp.hourlyRate : 0,
      max_hours: (emp.maxHours != null && !isNaN(emp.maxHours)) ? emp.maxHours : 38,
      availability: avail,
      active: emp.active
    };
    if (emp.awardLevel) obj.award_level = emp.awardLevel;
    if (emp.employmentType) obj.employment_type = emp.employmentType;
    if (emp.id) obj.id = emp.id;
    return obj;
  }

  function mapEmployeeFromDb(emp) {
    if (!emp) return null;
    const avail = emp.availability || {};
    return {
      id: emp.id,
      name: emp.name,
      email: emp.email,
      role: emp.role,
      phone: emp.phone,
      hourlyRate: (!isNaN(parseFloat(emp.hourly_rate)) && emp.hourly_rate != null) ? parseFloat(emp.hourly_rate) : 0,
      maxHours: parseInt(emp.max_hours || 38) || 38,
      awardLevel: emp.award_level || emp.awardLevel || 'custom',
      employmentType: emp.employment_type || emp.employmentType || 'permanent',
      dob: avail.dob || emp.dob || null,
      certificates: Array.isArray(avail.certificates) ? avail.certificates : (Array.isArray(emp.certificates) ? emp.certificates : []),
      availability: avail,
      active: (emp.active !== undefined && emp.active !== null) ? !!emp.active : true
    };
  }

  function formatTimeHHmm(t) {
    if (!t) return '';
    const str = String(t).trim();
    return str.length >= 5 ? str.substring(0, 5) : str;
  }

  function mapShiftToDb(shift) {
    const obj = {
      employee_id: shift.employeeId || null,
      date: shift.date,
      start_time: formatTimeHHmm(shift.startTime),
      end_time: formatTimeHHmm(shift.endTime),
      role: shift.role || 'Pharmacy Assistant',
      notes: shift.notes || ''
    };
    if (shift.status && shift.status !== 'draft') obj.status = shift.status;
    if (shift.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(shift.id)) {
      obj.id = shift.id;
    }
    return obj;
  }

  function mapShiftFromDb(shift) {
    if (!shift) return null;
    return {
      id: shift.id,
      employeeId: shift.employee_id,
      date: shift.date,
      startTime: formatTimeHHmm(shift.start_time),
      endTime: formatTimeHHmm(shift.end_time),
      role: shift.role,
      status: shift.status || 'draft',
      unpaidMealMins: shift.unpaid_meal_mins,
      color: shift.color,
      notes: shift.notes
    };
  }

  function mapTimecardToDb(tc) {
    const obj = {
      employee_id: tc.employeeId,
      date: tc.date,
      clock_in: tc.clockIn,
      clock_out: tc.clockOut,
      breaks: tc.breaks,
      total_hours: tc.totalHours,
      approved: tc.approved,
      approved_by: tc.approvedBy
    };
    if (tc.id) obj.id = tc.id;
    return obj;
  }

  function mapTimecardFromDb(tc) {
    if (!tc) return null;
    return {
      id: tc.id,
      employeeId: tc.employee_id,
      date: tc.date,
      clockIn: tc.clock_in,
      clockOut: tc.clock_out,
      breaks: tc.breaks,
      totalHours: (tc.total_hours != null && !isNaN(parseFloat(tc.total_hours))) ? parseFloat(tc.total_hours) : 0,
      approved: !!tc.approved,
      approvedBy: tc.approved_by
    };
  }

  function mapLeaveRequestToDb(lr) {
    const obj = {
      employee_id: lr.employeeId,
      start_date: lr.startDate,
      end_date: lr.endDate,
      reason: lr.reason,
      status: lr.status
    };
    if (lr.id) obj.id = lr.id;
    return obj;
  }

  function mapLeaveRequestFromDb(lr) {
    if (!lr) return null;
    return {
      id: lr.id,
      employeeId: lr.employee_id,
      startDate: lr.start_date,
      endDate: lr.end_date,
      reason: lr.reason,
      status: lr.status
    };
  }

  function mapSettingsToDb(settings) {
    const th = { ...(settings.tradingHours || _settings.tradingHours || DEFAULT_TRADING_HOURS) };
    if (settings.salesTargets) {
      th._sales_targets = settings.salesTargets;
    } else if (_settings.salesTargets) {
      th._sales_targets = _settings.salesTargets;
    }
    if (settings.actualPosSales) {
      th._actual_pos_sales = settings.actualPosSales;
    } else if (_settings.actualPosSales) {
      th._actual_pos_sales = _settings.actualPosSales;
    }
    const order = settings.employeeOrder || _settings.employeeOrder;
    if (Array.isArray(order)) {
      th._employee_order = order;
    }
    const payload = {
      id: 'global_settings',
      company_name: settings.companyName || _settings.companyName || 'Amcal Pharmacy Woywoy Rosters',
      trading_hours: th
    };
    return payload;
  }

  function mapSettingsFromDb(settings) {
    if (!settings) return null;
    const rawTh = settings.trading_hours || DEFAULT_TRADING_HOURS;
    let order = rawTh._employee_order || settings.employee_order || [];
    if (!Array.isArray(order) || order.length === 0) {
      try {
        order = JSON.parse(localStorage.getItem('amcal_employee_order') || '[]');
      } catch (e) { order = []; }
    }
    const salesTargets = rawTh._sales_targets || null;
    const actualPosSales = rawTh._actual_pos_sales || null;
    return {
      companyName: settings.company_name || 'Amcal Pharmacy Woywoy Rosters',
      tradingHours: rawTh,
      employeeOrder: order,
      salesTargets: salesTargets,
      actualPosSales: actualPosSales
    };
  }

  // Offline Sync Queue Management
  let _offlineQueue = [];
  try {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem('brisk_offline_queue');
      if (saved) _offlineQueue = JSON.parse(saved);
    }
  } catch (e) {
    console.error('Failed to load offline queue:', e);
  }

  function saveOfflineQueue() {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('brisk_offline_queue', JSON.stringify(_offlineQueue));
      }
    } catch (e) {
      console.error('Failed to save offline queue:', e);
    }
  }

  function enqueueOfflineOperation(type, timecard) {
    if (!timecard || !timecard.id) return;

    // H-7 Guard: Enforce identity & approved lock for non-managers
    const currentUser = (typeof window !== 'undefined' && window.state && window.state.currentUser) ? window.state.currentUser : null;
    const isManager = currentUser && (typeof window.hasManagerPermissions === 'function' ? window.hasManagerPermissions(currentUser) : false);
    if (!isManager && currentUser && currentUser.employeeId) {
      if (timecard.employeeId && timecard.employeeId !== currentUser.employeeId) {
        console.warn('[BriskDB] Unauthorized offline timecard injection blocked for employeeId:', timecard.employeeId);
        return;
      }
      timecard.employeeId = currentUser.employeeId;
      timecard.approved = false;
      timecard.approvedBy = null;
    }

    const existingIdx = _offlineQueue.findIndex(op => op.timecard.id === timecard.id);
    if (existingIdx !== -1) {
      const existingOp = _offlineQueue[existingIdx];
      if (existingOp.type === 'add') {
        _offlineQueue[existingIdx] = { type: 'add', timecard: { ...existingOp.timecard, ...timecard } };
      } else {
        _offlineQueue[existingIdx] = { type, timecard: { ...existingOp.timecard, ...timecard } };
      }
    } else {
      _offlineQueue.push({ type, timecard });
    }
    saveOfflineQueue();
    
    // Dispatch event to notify UI
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('brisk-sync-status', { detail: { pending: _offlineQueue.length } }));
    }
  }

  function getRealtimeSecurityContext() {
    const session = getSession();
    const currentUser = (typeof window !== 'undefined' && window.state?.currentUser) ? window.state.currentUser : session;
    let isManager = false;
    if (typeof window !== 'undefined' && typeof window.hasManagerPermissions === 'function') {
      isManager = window.hasManagerPermissions(currentUser);
    }
    if (!isManager && (currentUser || session)) {
      const u = currentUser || session;
      const role = String(u?.role || '').toLowerCase().trim();
      const email = String(u?.email || '').toLowerCase().trim();
      const name = String(u?.name || '').toLowerCase().trim();
      const WHITELIST_NAMES = ['peter kim', 'glen kanawati', 'katherine nguyen', 'vicki duffy', 'vicky duffy'];
      const WHITELIST_EMAILS = ['pharmotago@gmail.com', 'glenkanawati@gmail.com', 'nguyek@gmail.com', 'vickilorraine75@gmail.com'];
      const VALID_MANAGER_ROLES = ['owner', 'co-owner', 'admin', 'manager', 'partner', 'managing pharmacist', 'pharmacist manager', 'pharmacy manager'];
      if (
        WHITELIST_NAMES.includes(name) ||
        WHITELIST_EMAILS.includes(email) ||
        email.startsWith('pharmotago') ||
        VALID_MANAGER_ROLES.includes(role)
      ) {
        isManager = true;
      }
    }
    const myEmpId = currentUser?.employeeId || session?.employeeId || null;
    return { currentUser: currentUser || session, isManager, myEmpId };
  }

  function assertManagerPermissionForFallback() {
    const { isManager } = getRealtimeSecurityContext();
    if (!isManager) {
      throw new Error('Permission denied: Only managers and owners can perform this operation.');
    }
  }

  let _isProcessingQueue = false;
  async function processOfflineQueue() {
    if (_offlineQueue.length === 0 || _isProcessingQueue) return;
    
    const session = getSession();
    if (!session) return;
    
    _isProcessingQueue = true;
    try {
      const queueToProcess = [..._offlineQueue];
      
      for (const op of queueToProcess) {
        try {
          const token = await getMutateAuthToken();
          if (token) {
            const res = await fetch('/api/schedule/mutate', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + token
              },
              body: JSON.stringify({
                entity: 'timecard',
                action: 'upsert',
                timecard: mapTimecardToDb(op.timecard)
              })
            });
            if (!res.ok) {
              const errJson = await res.json().catch(() => ({}));
              throw new Error(errJson.error || `HTTP ${res.status}`);
            }
          } else {
            break;
          }
          
          // Remove successfully processed operation
          _offlineQueue = _offlineQueue.filter(item => item.timecard.id !== op.timecard.id);
          saveOfflineQueue();
        } catch (err) {
          console.warn('[BriskDB] Offline timecard sync will retry:', err?.message || err);
          break; // retry on next interval
        }
      }
    } finally {
      _isProcessingQueue = false;
    }
    
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('brisk-sync-status', { detail: { pending: _offlineQueue.length } }));
    }
  }

  // Setup background sync workers
  if (typeof window !== 'undefined') {
    setInterval(processOfflineQueue, 15000); // Check every 15 seconds
    window.addEventListener('online', processOfflineQueue);
  }

  // Set up real-time postgres_changes listeners
  function setupListeners() {
    const session = getSession();
    if (!session) return;

    // Clear previous listeners
    _listeners.forEach(unsub => unsub());
    _listeners = [];

    // 1. Employees Listener
    const empChannel = supabase.channel('realtime:brisk_employees')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'brisk_employees' }, payload => {
        const { eventType, new: newRec, old: oldRec } = payload;
        
        // Handle virtual roles employee update
        if (newRec && newRec.email === 'system_roles@brisk.internal') {
          if (newRec.availability) {
            if (Array.isArray(newRec.availability.roles)) {
              _roles = newRec.availability.roles;
              localStorage.setItem('brisk_roles', JSON.stringify(_roles));
            }
            if (Array.isArray(newRec.availability.positions)) {
              _positions = newRec.availability.positions;
              localStorage.setItem('brisk_positions', JSON.stringify(_positions));
            }
            window.dispatchEvent(new CustomEvent('brisk-db-updated', { detail: { type: 'roles' } }));
            window.dispatchEvent(new CustomEvent('brisk-db-updated', { detail: { type: 'positions' } }));
          }
          return;
        }

        if (eventType === 'DELETE') {
          if (oldRec && oldRec.id) {
            _employees = _employees.filter(e => e.id !== oldRec.id);
            window.dispatchEvent(new CustomEvent('brisk-db-updated', { detail: { type: 'employees' } }));
          }
          return;
        }

        const mappedNew = mapEmployeeFromDb(newRec);
        if (mappedNew) {
          const { isManager } = getRealtimeSecurityContext();
          const existing = _employees.find(e => e.id === mappedNew.id);
          if (!isManager) {
            // Security: strip sensitive fields for non-managers
            // But preserve hourlyRate from existing in-memory value to prevent
            // realtime timing race from wiping the rate just set by manager save
            if (existing && existing.hourlyRate != null) {
              mappedNew.hourlyRate = existing.hourlyRate;
            } else {
              delete mappedNew.hourlyRate;
            }
            delete mappedNew.dob;
            delete mappedNew.phone;
          }
          if (eventType === 'INSERT') {
            if (!_employees.some(e => e.id === mappedNew.id)) _employees.push(mappedNew);
          } else if (eventType === 'UPDATE') {
            const idx = _employees.findIndex(e => e.id === mappedNew.id);
            // Use merge (spread) instead of full replace to prevent undefined fields
            // from wiping correctly-set values (e.g. hourlyRate) in memory
            if (idx !== -1) _employees[idx] = { ..._employees[idx], ...mappedNew };
            else _employees.push(mappedNew);
          }
          window.dispatchEvent(new CustomEvent('brisk-db-updated', { detail: { type: 'employees' } }));
        }
      })
      .subscribe();
    _listeners.push(() => supabase.removeChannel(empChannel));

    // 2. Shifts Listener
    const shiftChannel = supabase.channel('realtime:brisk_shifts')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'brisk_shifts' }, payload => {
        const { eventType, new: newRec, old: oldRec } = payload;
        if (eventType === 'DELETE') {
          if (oldRec && oldRec.id) {
            _shifts = _shifts.filter(s => s.id !== oldRec.id);
            window.dispatchEvent(new CustomEvent('brisk-db-updated', { detail: { type: 'shifts' } }));
          }
          return;
        }
        const mappedNew = mapShiftFromDb(newRec);
        if (mappedNew) {
          if (eventType === 'INSERT') {
            if (!_shifts.some(s => s.id === mappedNew.id)) _shifts.push(mappedNew);
          } else if (eventType === 'UPDATE') {
            const idx = _shifts.findIndex(s => s.id === mappedNew.id);
            if (idx !== -1) _shifts[idx] = mappedNew;
            else _shifts.push(mappedNew);
          }
          window.dispatchEvent(new CustomEvent('brisk-db-updated', { detail: { type: 'shifts' } }));
        }
      })
      .subscribe();
    _listeners.push(() => supabase.removeChannel(shiftChannel));

    // 3. Timecards Listener
    const tcChannel = supabase.channel('realtime:brisk_timecards')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'brisk_timecards' }, payload => {
        const { eventType, new: newRec, old: oldRec } = payload;
        if (eventType === 'DELETE') {
          if (oldRec && oldRec.id) {
            _timecards = _timecards.filter(t => t.id !== oldRec.id);
            window.dispatchEvent(new CustomEvent('brisk-db-updated', { detail: { type: 'timecards' } }));
          }
          return;
        }
        const mappedNew = mapTimecardFromDb(newRec);
        if (mappedNew) {
          const { isManager, myEmpId } = getRealtimeSecurityContext();
          // Non-managers should only keep their own timecards in memory
          if (!isManager && myEmpId && mappedNew.employeeId !== myEmpId) return;

          if (eventType === 'INSERT') {
            if (!_timecards.some(t => t.id === mappedNew.id)) _timecards.push(mappedNew);
          } else if (eventType === 'UPDATE') {
            const idx = _timecards.findIndex(t => t.id === mappedNew.id);
            if (idx !== -1) _timecards[idx] = mappedNew;
            else _timecards.push(mappedNew);
          }
          window.dispatchEvent(new CustomEvent('brisk-db-updated', { detail: { type: 'timecards' } }));
        }
      })
      .subscribe();
    _listeners.push(() => supabase.removeChannel(tcChannel));

    // 4. Leave Requests Listener
    const leaveChannel = supabase.channel('realtime:brisk_leave_requests')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'brisk_leave_requests' }, payload => {
        const { eventType, new: newRec, old: oldRec } = payload;
        if (eventType === 'DELETE') {
          if (oldRec && oldRec.id) {
            _leaveRequests = _leaveRequests.filter(l => l.id !== oldRec.id);
            window.dispatchEvent(new CustomEvent('brisk-db-updated', { detail: { type: 'leave_requests' } }));
          }
          return;
        }
        const mappedNew = mapLeaveRequestFromDb(newRec);
        if (mappedNew) {
          const { isManager, myEmpId } = getRealtimeSecurityContext();
          // Non-managers should only keep their own leave requests in memory
          if (!isManager && myEmpId && mappedNew.employeeId !== myEmpId) return;

          if (eventType === 'INSERT') {
            if (!_leaveRequests.some(l => l.id === mappedNew.id)) _leaveRequests.push(mappedNew);
          } else if (eventType === 'UPDATE') {
            const idx = _leaveRequests.findIndex(l => l.id === mappedNew.id);
            if (idx !== -1) _leaveRequests[idx] = mappedNew;
            else _leaveRequests.push(mappedNew);
          }
          window.dispatchEvent(new CustomEvent('brisk-db-updated', { detail: { type: 'leave_requests' } }));
        }
      })
      .subscribe();
    _listeners.push(() => supabase.removeChannel(leaveChannel));

    // 5. Settings Listener (Real-time Live Sync for Sales Targets, POS Actuals, Trading Hours)
    const settingsChannel = supabase.channel('realtime:brisk_settings')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'brisk_settings' }, payload => {
        const { new: newRec } = payload;
        if (newRec) {
          const mapped = mapSettingsFromDb(newRec);
          if (mapped) {
            _settings = { ..._settings, ...mapped };
            if (mapped.salesTargets) {
              localStorage.setItem('brisk_daily_sales_targets', JSON.stringify(mapped.salesTargets));
            }
            if (mapped.actualPosSales) {
              localStorage.setItem('brisk_actual_pos_sales_map', JSON.stringify(mapped.actualPosSales));
            }
            window.dispatchEvent(new CustomEvent('brisk-db-updated', { detail: { type: 'settings' } }));
          }
        }
      })
      .subscribe();
    _listeners.push(() => supabase.removeChannel(settingsChannel));
  }

  async function createOrUpdateSystemRolesInDb(rolesList, positionsList) {
    try {
      const { data: existing } = await supabase
        .from('brisk_employees')
        .select('*')
        .eq('email', 'system_roles@brisk.internal')
        .maybeSingle();

      const availabilityObj = {
        roles: rolesList || _roles,
        positions: positionsList || _positions
      };

      if (existing) {
        await supabase
          .from('brisk_employees')
          .update({
            availability: availabilityObj
          })
          .eq('email', 'system_roles@brisk.internal');
      } else {
        await supabase
          .from('brisk_employees')
          .insert({
            id: '00000000-0000-0000-0000-000000000001',
            name: '__system_roles__',
            email: 'system_roles@brisk.internal',
            role: 'system',
            hourly_rate: 0.00,
            max_hours: 0,
            availability: availabilityObj,
            active: false
          });
      }
    } catch (err) {
      console.warn('Failed to save roles to virtual employee in Supabase:', err);
    }
  }

  // Triggered on app load
  async function syncFromServer() {
    let session = getSession() || {};
    let token = session.token || '';
    try {
      const freshToken = await getValidToken();
      if (freshToken) token = freshToken;
    } catch (e) {}

    // 1. Primary Strategy: Serverless Data Sync (100% reliable, zero token expiry / RLS lockouts)
    try {
      const res = await fetch('/api/schedule/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? ('Bearer ' + token) : '',
          'X-User-Email': session.email || ''
        },
        body: JSON.stringify({ email: session.email || '' })
      });

      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const syncData = await res.json();
        if (syncData.success && Array.isArray(syncData.employees) && syncData.employees.length > 0) {
          const existingRateMap = new Map(_employees.map(e => [e.id, e.hourlyRate]));
          _employees = syncData.employees.map(emp => {
            const mapped = mapEmployeeFromDb(emp);
            if ((!mapped.hourlyRate || mapped.hourlyRate === 0) && existingRateMap.has(mapped.id)) {
              const prev = existingRateMap.get(mapped.id);
              if (prev && prev > 0) mapped.hourlyRate = prev;
            }
            return mapped;
          });
          _initialLoadCompleted.employees = true;

          if (Array.isArray(syncData.shifts)) {
            _shifts = syncData.shifts.map(mapShiftFromDb);
            _initialLoadCompleted.shifts = true;
          }

          if (Array.isArray(syncData.timecards)) {
            _timecards = syncData.timecards.map(mapTimecardFromDb);
            _initialLoadCompleted.timecards = true;
          }

          if (Array.isArray(syncData.leaveRequests)) {
            _leaveRequests = syncData.leaveRequests.map(mapLeaveRequestFromDb);
            _initialLoadCompleted.leaveRequests = true;
          }

          if (syncData.settings) {
            _settings = mapSettingsFromDb(syncData.settings);
          }

          if (syncData.systemRoles) {
            if (Array.isArray(syncData.systemRoles.roles)) {
              _roles = syncData.systemRoles.roles;
              localStorage.setItem('brisk_roles', JSON.stringify(_roles));
            }
            if (Array.isArray(syncData.systemRoles.positions)) {
              _positions = syncData.systemRoles.positions;
              localStorage.setItem('brisk_positions', JSON.stringify(_positions));
            }
          }

          saveLocalCache();

          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('brisk-db-updated', { detail: { type: 'all' } }));
          }
          try { setupListeners(); } catch (slErr) { console.warn('[BriskDB] setupListeners note:', slErr); }
          return true;
        }
      }
    } catch (syncApiErr) {
      console.warn('[BriskDB] Sync API route notice, falling back to direct Supabase client:', syncApiErr.message);
    }

    // 2. Fallback: Direct Supabase Client
    try {
      const { data: { session: sbSession } } = await supabase.auth.getSession();
      if (sbSession && sbSession.access_token) {
        session.token = sbSession.access_token;
        setSession(session);
      }
    } catch (authCheckErr) {
      console.warn('[BriskDB] Non-blocking session check note:', authCheckErr);
    }

    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
    const windowStr = fourteenDaysAgo.toISOString().split('T')[0];

    try {
      const { data: emps, error: empErr } = await supabase.from('brisk_employees').select('*');
      if (!empErr && emps && emps.length > 0) {
        const allEmployees = emps.map(mapEmployeeFromDb);
        _employees = allEmployees.filter(e => e.email !== 'system_roles@brisk.internal');
        _initialLoadCompleted.employees = true;
      }

      const { data: sfs, error: sfErr } = await supabase.from('brisk_shifts').select('*').gte('date', windowStr);
      if (!sfErr && sfs && sfs.length > 0) {
        _shifts = sfs.map(mapShiftFromDb);
        _initialLoadCompleted.shifts = true;
      }

      const { data: tcs, error: tcErr } = await supabase.from('brisk_timecards').select('*').gte('date', windowStr);
      if (!tcErr && tcs) {
        _timecards = tcs.map(mapTimecardFromDb);
        _initialLoadCompleted.timecards = true;
      }

      const { data: lrs, error: lrErr } = await supabase.from('brisk_leave_requests').select('*').gte('end_date', windowStr);
      if (!lrErr && lrs) {
        _leaveRequests = lrs.map(mapLeaveRequestFromDb);
        _initialLoadCompleted.leaveRequests = true;
      }

      const { data: sets } = await supabase.from('brisk_settings').select('*').limit(1).maybeSingle();
      if (sets) {
        _settings = mapSettingsFromDb(sets);
      }

      try { setupListeners(); } catch (slErr) { console.warn('[BriskDB] setupListeners note:', slErr); }
      return true;
    } catch (directErr) {
      console.warn('[BriskDB] Direct Supabase sync notice:', directErr);
      return false;
    }
  }

  // Dummy function for compatibility
  async function syncToServer() {
    return true;
  }

  // Cloud API Call wrapper for Login using Supabase Auth Client SDK
  async function apiLogin(email, password) {
    try {
      const cleanEmail = (email || '').toLowerCase().trim();
      if (!cleanEmail || !password) {
        return { error: 'Email and password are required.' };
      }

      // 1. Try serverless login API first (auto-provisions missing auth.users and confirms email)
      try {
        const res = await fetch('/api/schedule/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: cleanEmail, password })
        });

        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          const apiData = await res.json();
          if (apiData.session && apiData.success) {
            try {
              if (apiData.session.token) {
                await supabase.auth.setSession({
                  access_token: apiData.session.token,
                  refresh_token: apiData.session.refreshToken || ''
                });
              } else {
                await supabase.auth.signInWithPassword({ email: cleanEmail, password });
              }
            } catch (e) {
              console.warn('[BriskDB] Client auth setSession note:', e);
            }

            setSession(apiData.session);
            setupListeners();
            return apiData.session;
          } else if (apiData.error) {
            return { error: apiData.error };
          }
        }
      } catch (apiErr) {
        console.warn('[BriskDB] Login API route notice, falling back to direct client:', apiErr.message);
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password
      });

      if (error) {
        if (error.message && error.message.toLowerCase().includes('invalid login credentials')) {
          return { error: 'Invalid email or password. If you forgot your password, please use the Forgot Password link below.' };
        }
        if (error.message && error.message.toLowerCase().includes('email not confirmed')) {
          return { error: 'Email address has not been confirmed. Please check your inbox or request a password reset link.' };
        }
        return { error: error.message };
      }

      if (!data || !data.user) {
        return { error: 'Authentication failed. Please try again.' };
      }

      // 1. Get user profile from brisk_users (check by ID first, then by email)
      let userProfile = null;
      if (data.user.id) {
        const { data: byId } = await supabase
          .from('brisk_users')
          .select('*')
          .eq('id', data.user.id)
          .maybeSingle();
        if (byId) userProfile = byId;
      }

      if (!userProfile) {
        const { data: byEmail } = await supabase
          .from('brisk_users')
          .select('*')
          .eq('email', cleanEmail)
          .maybeSingle();
        if (byEmail) userProfile = byEmail;
      }

      // 2. Self-Healing Fallback: If brisk_users record is missing, auto-link to brisk_employees
      if (!userProfile) {
        const { data: empData } = await supabase
          .from('brisk_employees')
          .select('*')
          .eq('email', cleanEmail)
          .maybeSingle();

        const isWhitelisted = ['peter', 'glen', 'katherine', 'vicky', 'pharmotago'].some(l => cleanEmail.includes(l));
        const autoRole = (empData?.role && empData.role.toLowerCase().includes('manager')) || isWhitelisted ? 'manager' : 'employee';
        const autoName = empData?.name || data.user.user_metadata?.name || cleanEmail.split('@')[0];

        try {
          const { data: createdProf } = await supabase
            .from('brisk_users')
            .upsert({
              id: data.user.id,
              email: cleanEmail,
              name: autoName,
              role: autoRole,
              employee_id: empData?.id || null,
              password_hash: 'SUPABASE_AUTH_MANAGED'
            })
            .select()
            .maybeSingle();
          userProfile = createdProf;
        } catch (insertErr) {
          console.warn('[BriskDB] Auto-profile creation note:', insertErr);
        }

        if (!userProfile) {
          userProfile = {
            id: data.user.id,
            email: cleanEmail,
            name: autoName,
            role: autoRole,
            employee_id: empData?.id || null
          };
        }
      }

      let resolvedRole = userProfile ? (userProfile.role || 'employee') : 'employee';
      if (userProfile && userProfile.employee_id) {
        try {
          const { data: empData } = await supabase
            .from('brisk_employees')
            .select('role')
            .eq('id', userProfile.employee_id)
            .maybeSingle();
          if (empData && empData.role && empData.role.toLowerCase().trim() === 'pharmacist manager') {
            resolvedRole = 'manager';
          }
        } catch (empRoleErr) {
          console.warn('[BriskDB] Employee role lookup note:', empRoleErr);
        }
      }

      // Whitelist leaders always resolve as manager/owner
      const isWhitelistedLeader = ['peter', 'glen', 'katherine', 'vicky', 'pharmotago'].some(l => cleanEmail.includes(l));
      if (isWhitelistedLeader) {
        resolvedRole = 'owner';
      }

      const session = {
        email: data.user.email,
        role: resolvedRole,
        employeeId: userProfile ? (userProfile.employee_id || null) : null,
        name: userProfile?.name || data.user.user_metadata?.name || cleanEmail.split('@')[0] || 'Staff Member',
        token: (data.session && data.session.access_token) ? data.session.access_token : ''
      };

      setSession(session);
      setupListeners();
      return session;
    } catch (err) {
      console.error('[BriskDB] apiLogin unexpected error:', err);
      return { error: err.message || 'Login failed.' };
    }
  }

  // Registration — tries Vercel API route first, then direct Supabase client fallback
  async function apiRegister(email, password, name, inviteCode) {
    const targetEmail = (email || '').toLowerCase().trim();
    const code = (inviteCode || '').toUpperCase().trim();

    if (!targetEmail || !password || !name) {
      return { error: 'Email, password, and name are required.' };
    }
    if (!code) {
      return { error: 'An invitation code is required to register.' };
    }

    // ═══════════════════════════════════════════════════════
    // 1. Try serverless API route if available
    // ═══════════════════════════════════════════════════════
    try {
      const res = await fetch('/api/schedule/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: targetEmail, password, name, inviteCode: code })
      });

      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const data = await res.json();
        // If API returned a valid JSON response (success or specific error), return it directly.
        // Do NOT throw to client fallback if the API gave us a valid business response!
        return data;
      }
      // If not JSON (HTML 404/502 fallback page returned), fall through to client fallback
    } catch (apiErr) {
      console.warn('API route unavailable for registration, using direct Supabase client fallback:', apiErr.message);
    }

    // ═══════════════════════════════════════════════════════
    // 2. Direct Supabase Client Fallback (100% reliable)
    //    Uses supabase.auth.signUp() with anon key
    // ═══════════════════════════════════════════════════════
    try {
      // 2a. Validate invite code FIRST (before creating Auth user)
      //     This prevents orphaned Auth users if the code is invalid.
      const { data: invite, error: inviteFindErr } = await supabase
        .from('brisk_invitations')
        .select('*')
        .eq('code', code)
        .eq('used', false)
        .maybeSingle();

      if (inviteFindErr || !invite) {
        return { error: 'Invalid or expired invitation code.' };
      }

      // Check email match if invite specifies one
      if (invite.email && invite.email.toLowerCase().trim() !== targetEmail) {
        return { error: 'This invitation code is registered for a different email address.' };
      }

      const targetRole = invite.role; // 'manager' or 'employee'

      // 2b. Now it's safe to create the Auth user
      const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
        email: targetEmail,
        password: password,
        options: {
          data: { name: name },
          emailRedirectTo: 'https://woywoyamcalroster.vercel.app'
        }
      });

      if (signUpErr) {
        return { error: 'Failed to create account: ' + signUpErr.message };
      }

      if (!signUpData.user) {
        return { error: 'Failed to create account. Please try again.' };
      }

      const uid = signUpData.user.id;

      // 2c. Create Employee Profile
      const employeeData = {
        name: name,
        email: targetEmail,
        role: targetRole === 'manager' ? 'Pharmacist Manager' : 'Pharmacy Staff',
        hourly_rate: targetRole === 'manager' ? 85.00 : 25.00,
        max_hours: 38,
        availability: {
          0: null,
          1: { start: '09:00', end: '17:00' },
          2: { start: '09:00', end: '17:00' },
          3: { start: '09:00', end: '17:00' },
          4: { start: '09:00', end: '17:00' },
          5: { start: '09:00', end: '17:00' },
          6: null
        },
        active: true
      };

      const { data: employee, error: empErr } = await supabase
        .from('brisk_employees')
        .insert(employeeData)
        .select()
        .maybeSingle();

      if (empErr || !employee) {
        console.error('Employee creation failed:', empErr);
        return { error: 'Failed to create employee profile: ' + (empErr ? empErr.message : 'Unknown error') };
      }

      // 2c. Create User Role mapping
      const { error: roleErr } = await supabase
        .from('brisk_users')
        .insert({
          id: uid,
          email: targetEmail,
          password_hash: 'SUPABASE_AUTH_MANAGED',
          role: targetRole,
          employee_id: employee.id,
          name: name
        });

      if (roleErr) {
        console.error('User role mapping failed:', roleErr);
        return { error: 'Failed to set up user permissions: ' + roleErr.message };
      }

      // 2d. Mark invitation as used
      await supabase
        .from('brisk_invitations')
        .update({ used: true })
        .eq('code', code);

      return { success: true, message: 'Account registered successfully.' };
    } catch (fallbackErr) {
      return { error: 'Registration failed: ' + fallbackErr.message };
    }
  }

  // Generate Invite (H-6 Guard)
  async function apiGenerateInvite(email, role) {
    try {
      const currentUser = (typeof window !== 'undefined' && window.state && window.state.currentUser) ? window.state.currentUser : null;
      if (!currentUser || (typeof window.hasManagerPermissions === 'function' && !window.hasManagerPermissions(currentUser))) {
        return { error: 'Permission denied: Only managers and owners can generate invitation links.' };
      }

      const normalizedEmail = (email || '').toLowerCase().trim();
      const requestedRole = role || 'employee';
      // Normalize role for brisk_invitations table check constraint ('manager' or 'employee')
      const dbRole = (requestedRole === 'owner' || requestedRole === 'manager') ? 'manager' : 'employee';

      // 1. Try serverless API route if available
      try {
        const token = await getValidToken();
        const res = await fetch('/api/schedule/auth/invite', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + token
          },
          body: JSON.stringify({ email: normalizedEmail, role: dbRole })
        });

        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          const data = await res.json();
          return data;
        }
      } catch (apiErr) {
        console.warn('API route unavailable, using direct Supabase client for invite:', apiErr.message);
      }

      // 2. Direct Supabase Client Fallback (100% reliable)
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      let code = '';
      for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }

      const { error: dbErr } = await supabase
        .from('brisk_invitations')
        .insert({
          code,
          email: normalizedEmail,
          role: dbRole,
          used: false,
          created_at: new Date().toISOString()
        });

      const origin = 'https://woywoyamcalroster.vercel.app';
      return {
        success: true,
        code,
        inviteUrl: `${origin}/?invite=${code}`
      };
    } catch (err) {
      return { error: err.message };
    }
  }

  // Send Roster Email
  async function apiSendRosterEmail(employeeId, weekStart, rosterText) {
    try {
      const token = await getValidToken();
      const res = await fetch('/api/schedule/email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token
        },
        body: JSON.stringify({ employeeId, weekStart, rosterText })
      });

      const contentType = res.headers.get('content-type') || '';
      let data = {};
      if (contentType.includes('application/json')) {
        data = await res.json();
      } else {
        const text = await res.text();
        data = { error: text || 'Non-JSON server response' };
      }
      if (!res.ok) throw new Error(data.error || 'Failed to send roster email.');
      return data;
    } catch (err) {
      return { error: err.message };
    }
  }

  // Lazy-load historical data
  async function fetchHistoricalWeek(weekStartStr, weekEndStr) {
    const rangeKey = `${weekStartStr}_${weekEndStr}`;
    if (_activeFetches[rangeKey]) {
      await _activeFetches[rangeKey];
      return;
    }
    
    if (_fetchedHistoricalRanges.has(rangeKey)) {
      window.dispatchEvent(new CustomEvent('brisk-db-updated', { detail: { type: 'historical' } }));
      return;
    }

    _activeFetches[rangeKey] = (async () => {
      _historicalShifts = [];
      _historicalTimecards = [];
      _historicalLeaveRequests = [];

      try {
        const [sfsRes, tcsRes, lrsRes] = await Promise.all([
          supabase.from('brisk_shifts').select('*').gte('date', weekStartStr).lte('date', weekEndStr),
          supabase.from('brisk_timecards').select('*').gte('date', weekStartStr).lte('date', weekEndStr),
          supabase.from('brisk_leave_requests').select('*').gte('end_date', weekStartStr).lte('start_date', weekEndStr)
        ]);

        _historicalShifts = (sfsRes.data || []).map(mapShiftFromDb);
        _historicalTimecards = (tcsRes.data || []).map(mapTimecardFromDb);
        _historicalLeaveRequests = (lrsRes.data || []).map(mapLeaveRequestFromDb);

        _fetchedHistoricalRanges.clear();
        _fetchedHistoricalRanges.add(rangeKey);
      } catch (err) {
        console.error('Failed to fetch historical week:', err);
      } finally {
        delete _activeFetches[rangeKey];
        window.dispatchEvent(new CustomEvent('brisk-db-updated', { detail: { type: 'historical' } }));
      }
    })();

    await _activeFetches[rangeKey];
  }

  return {
    getSession,
    setSession,
    syncFromServer,
    fetchHistoricalWeek,
    syncToServer,
    apiLogin,
    apiRegister,
    apiGenerateInvite,
    apiSendRosterEmail,

    getEmployees: () => _employees,
    getShifts: () => [..._shifts, ..._historicalShifts],
    getTimecards: () => [..._timecards, ..._historicalTimecards],
    getLeaveRequests: () => [..._leaveRequests, ..._historicalLeaveRequests],
    getSettings: () => _settings,
    getRoles: () => _roles.length > 0 ? _roles : DEFAULT_ROLES,
    getPositions: () => _positions.length > 0 ? _positions : DEFAULT_POSITIONS,
    addPosition: async function(name) {
      assertManagerPermissionForFallback();
      const newPos = { id: 'pos_' + Date.now(), name };
      _positions.push(newPos);
      _positions.sort((a,b) => a.name.localeCompare(b.name));
      
      localStorage.setItem('brisk_positions', JSON.stringify(_positions));
      await createOrUpdateSystemRolesInDb(_roles, _positions);
      return newPos;
    },
    updatePosition: async function(updated) {
      assertManagerPermissionForFallback();
      const idx = _positions.findIndex(p => p.id === updated.id);
      if (idx !== -1) {
        _positions[idx] = { ..._positions[idx], ...updated };
        _positions.sort((a,b) => a.name.localeCompare(b.name));
      }
      
      localStorage.setItem('brisk_positions', JSON.stringify(_positions));
      await createOrUpdateSystemRolesInDb(_roles, _positions);
    },
    deletePosition: async function(id) {
      assertManagerPermissionForFallback();
      _positions = _positions.filter(p => p.id !== id);
      localStorage.setItem('brisk_positions', JSON.stringify(_positions));
      await createOrUpdateSystemRolesInDb(_roles, _positions);
    },
    addRole: async function(role) {
      assertManagerPermissionForFallback();
      const newRole = { id: 'role_' + Date.now(), ...role };
      _roles.push(newRole);
      _roles.sort((a,b) => a.name.localeCompare(b.name));
      
      localStorage.setItem('brisk_roles', JSON.stringify(_roles));
      await createOrUpdateSystemRolesInDb(_roles, _positions);
      return newRole;
    },
    updateRole: async function(updated) {
      assertManagerPermissionForFallback();
      const idx = _roles.findIndex(r => r.id === updated.id);
      if (idx !== -1) {
        _roles[idx] = { ..._roles[idx], ...updated };
        _roles.sort((a,b) => a.name.localeCompare(b.name));
      }
      
      localStorage.setItem('brisk_roles', JSON.stringify(_roles));
      await createOrUpdateSystemRolesInDb(_roles, _positions);
    },
    deleteRole: async function(id) {
      assertManagerPermissionForFallback();
      _roles = _roles.filter(r => r.id !== id);
      localStorage.setItem('brisk_roles', JSON.stringify(_roles));
      await createOrUpdateSystemRolesInDb(_roles, _positions);
    },

    addEmployee: async function(emp) {
      const newEmp = { ...emp, active: true };
      const dbObj = mapEmployeeToDb(newEmp);

      // 1. Primary Strategy: Unified Serverless Mutate API
      try {
        const token = await getMutateAuthToken();
        const res = await fetch('/api/schedule/mutate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': token ? ('Bearer ' + token) : ''
          },
          body: JSON.stringify({
            entity: 'employee',
            action: 'create',
            employee: dbObj
          })
        });

        if (res.ok) {
          const data = await res.json();
          if (data && data.success && data.employee) {
            const mapped = mapEmployeeFromDb(data.employee);
            const idx = _employees.findIndex(e => e.id === mapped.id);
            if (idx !== -1) _employees[idx] = mapped;
            else _employees.push(mapped);
            if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('brisk-db-updated', { detail: { type: 'employees' } }));
            return mapped;
          }
        }
      } catch (apiErr) {
        console.warn('[BriskDB] Serverless addEmployee notice, fallback to Supabase SDK:', apiErr);
      }

      // 2. Direct Supabase Client fallback
      assertManagerPermissionForFallback();
      let { data, error } = await supabase.from('brisk_employees').insert(dbObj).select().maybeSingle();
      if (error && error.message && (error.message.includes('award_level') || error.message.includes('employment_type'))) {
        delete dbObj.award_level;
        delete dbObj.employment_type;
        const retry = await supabase.from('brisk_employees').insert(dbObj).select().maybeSingle();
        data = retry.data;
        error = retry.error;
      }
      if (error) throw error;
      const mapped = mapEmployeeFromDb(data);
      const idx = _employees.findIndex(e => e.id === mapped.id);
      if (idx !== -1) _employees[idx] = mapped;
      else _employees.push(mapped);
      if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('brisk-db-updated', { detail: { type: 'employees' } }));
      return mapped;
    },
    updateEmployee: async function(updated) {
      const dbObj = mapEmployeeToDb(updated);

      // Optimistic in-memory update
      const mappedLocal = mapEmployeeFromDb({ ...dbObj, id: updated.id });
      const idx = _employees.findIndex(e => e.id === updated.id);
      if (idx !== -1) _employees[idx] = { ..._employees[idx], ...mappedLocal };
      else _employees.push(mappedLocal);

      // 1. Primary Strategy: Unified Serverless Mutate API
      try {
        const token = await getMutateAuthToken();
        const res = await fetch('/api/schedule/mutate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': token ? ('Bearer ' + token) : ''
          },
          body: JSON.stringify({
            entity: 'employee',
            action: 'update',
            employee: dbObj
          })
        });

        if (res.ok) {
          const data = await res.json();
          if (data && data.success && data.employee) {
            const mapped = mapEmployeeFromDb(data.employee);
            const curIdx = _employees.findIndex(e => e.id === mapped.id);
            if (curIdx !== -1) _employees[curIdx] = { ..._employees[curIdx], ...mapped };
            else _employees.push(mapped);
            if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('brisk-db-updated', { detail: { type: 'employees' } }));
            return _employees[curIdx !== -1 ? curIdx : _employees.length - 1];
          }
        }
      } catch (apiErr) {
        console.warn('[BriskDB] Serverless updateEmployee notice, fallback to Supabase SDK:', apiErr);
      }

      // 2. Direct Supabase Client fallback
      assertManagerPermissionForFallback();
      let { error } = await supabase.from('brisk_employees').update(dbObj).eq('id', updated.id);
      if (error && error.message && (error.message.includes('award_level') || error.message.includes('employment_type'))) {
        delete dbObj.award_level;
        delete dbObj.employment_type;
        const retry = await supabase.from('brisk_employees').update(dbObj).eq('id', updated.id);
        error = retry.error;
      }
      if (error) throw error;
      if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('brisk-db-updated', { detail: { type: 'employees' } }));
    },
    deleteEmployee: async function(id) {
      const idx = _employees.findIndex(e => e.id === id);
      if (idx !== -1) _employees[idx].active = false;

      // 1. Primary Strategy: Unified Serverless Mutate API
      try {
        const token = await getMutateAuthToken();
        const res = await fetch('/api/schedule/mutate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': token ? ('Bearer ' + token) : ''
          },
          body: JSON.stringify({
            entity: 'employee',
            action: 'delete',
            id
          })
        });

        if (res.ok) {
          if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('brisk-db-updated', { detail: { type: 'employees' } }));
          return;
        }
      } catch (apiErr) {
        console.warn('[BriskDB] Serverless deleteEmployee notice, fallback to Supabase SDK:', apiErr);
      }

      // 2. Fallback
      assertManagerPermissionForFallback();
      const { error } = await supabase.from('brisk_employees').update({ active: false }).eq('id', id);
      if (error) throw error;
      if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('brisk-db-updated', { detail: { type: 'employees' } }));
    },

    addShift: async function(shift) {
      const dbObj = mapShiftToDb(shift);

      // 1. Primary Strategy: Unified Serverless Mutate API
      try {
        const token = await getMutateAuthToken();
        const res = await fetch('/api/schedule/mutate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': token ? ('Bearer ' + token) : ''
          },
          body: JSON.stringify({
            entity: 'shift',
            action: 'create',
            shift: dbObj
          })
        });

        if (res.ok) {
          const data = await res.json();
          if (data && data.success && data.shift) {
            const mapped = mapShiftFromDb(data.shift);
            const existing = _shifts.findIndex(s => s.id === mapped.id);
            if (existing !== -1) _shifts[existing] = mapped;
            else _shifts.push(mapped);
            if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('brisk-db-updated', { detail: { type: 'shifts' } }));
            return mapped;
          }
        }
      } catch (apiErr) {
        console.warn('[BriskDB] Serverless addShift notice, fallback to Supabase SDK:', apiErr);
      }

      // 2. Direct Supabase Client fallback
      assertManagerPermissionForFallback();
      let { data, error } = await supabase.from('brisk_shifts').insert(dbObj).select().maybeSingle();
      if (error && (error.message.includes('status') || error.message.includes('unpaid_meal_mins') || error.message.includes('color') || error.code === 'PGRST204')) {
        delete dbObj.status;
        delete dbObj.unpaid_meal_mins;
        delete dbObj.color;
        const retry = await supabase.from('brisk_shifts').insert(dbObj).select().maybeSingle();
        data = retry.data;
        error = retry.error;
      }
      if (error) throw error;
      const mapped = mapShiftFromDb(data || shift);
      const existing = _shifts.findIndex(s => s.id === mapped.id);
      if (existing !== -1) _shifts[existing] = mapped;
      else _shifts.push(mapped);
      if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('brisk-db-updated', { detail: { type: 'shifts' } }));
      return mapped;
    },
    addShiftsBatch: async function(shiftsArray) {
      if (!shiftsArray || shiftsArray.length === 0) return [];
      let mappedShifts = shiftsArray.map(mapShiftToDb);

      // 1. Primary Strategy: Unified Serverless Mutate API
      try {
        const token = await getMutateAuthToken();
        const res = await fetch('/api/schedule/mutate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': token ? ('Bearer ' + token) : ''
          },
          body: JSON.stringify({
            entity: 'shift',
            action: 'batchInsert',
            shifts: mappedShifts
          })
        });

        if (res.ok) {
          const data = await res.json();
          if (data && data.success && Array.isArray(data.shifts)) {
            const inserted = data.shifts.map(mapShiftFromDb);
            inserted.forEach(mapped => {
              const existing = _shifts.findIndex(s => s.id === mapped.id);
              if (existing !== -1) _shifts[existing] = mapped;
              else _shifts.push(mapped);
            });
            if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('brisk-db-updated', { detail: { type: 'shifts' } }));
            return inserted;
          }
        }
      } catch (apiErr) {
        console.warn('[BriskDB] Serverless addShiftsBatch notice, fallback to Supabase SDK:', apiErr);
      }

      // 2. Direct Supabase Client fallback
      assertManagerPermissionForFallback();
      let { data, error } = await supabase.from('brisk_shifts').insert(mappedShifts).select();
      if (error && (error.message.includes('status') || error.message.includes('unpaid_meal_mins') || error.message.includes('color') || error.code === 'PGRST204')) {
        mappedShifts.forEach(s => {
          delete s.status;
          delete s.unpaid_meal_mins;
          delete s.color;
        });
        const retry = await supabase.from('brisk_shifts').insert(mappedShifts).select();
        data = retry.data;
        error = retry.error;
      }
      if (error) {
        console.warn('[DB] Batch insert failed, falling back to sequential addShift:', error);
        const results = [];
        for (const s of shiftsArray) {
          try {
            const res = await this.addShift(s);
            results.push(res);
          } catch (seqErr) {
            console.error('[DB] Sequential addShift fallback failed for shift:', s, seqErr);
          }
        }
        return results;
      }

      const inserted = (data || []).map(mapShiftFromDb);
      inserted.forEach(mapped => {
        const existing = _shifts.findIndex(s => s.id === mapped.id);
        if (existing !== -1) _shifts[existing] = mapped;
        else _shifts.push(mapped);
      });
      if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('brisk-db-updated', { detail: { type: 'shifts' } }));
      return inserted;
    },
    updateShift: async function(updated) {
      const dbObj = mapShiftToDb(updated);

      // Optimistic in-memory update
      const idx = _shifts.findIndex(s => s.id === updated.id);
      if (idx !== -1) _shifts[idx] = { ..._shifts[idx], ...updated };

      // 1. Primary Strategy: Unified Serverless Mutate API
      try {
        const token = await getMutateAuthToken();
        const res = await fetch('/api/schedule/mutate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': token ? ('Bearer ' + token) : ''
          },
          body: JSON.stringify({
            entity: 'shift',
            action: 'update',
            shift: dbObj
          })
        });

        if (res.ok) {
          const data = await res.json();
          if (data && data.success && data.shift) {
            const mapped = mapShiftFromDb(data.shift);
            if (idx !== -1) _shifts[idx] = mapped;
            if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('brisk-db-updated', { detail: { type: 'shifts' } }));
            return mapped;
          }
        }
      } catch (apiErr) {
        console.warn('[BriskDB] Serverless updateShift notice, fallback to Supabase SDK:', apiErr);
      }

      // 2. Direct Supabase Client fallback
      assertManagerPermissionForFallback();
      let { error } = await supabase.from('brisk_shifts').update(dbObj).eq('id', updated.id);
      if (error && (error.message.includes('status') || error.message.includes('unpaid_meal_mins') || error.message.includes('color') || error.code === 'PGRST204')) {
        delete dbObj.status;
        delete dbObj.unpaid_meal_mins;
        delete dbObj.color;
        const retry = await supabase.from('brisk_shifts').update(dbObj).eq('id', updated.id);
        error = retry.error;
      }
      if (error) throw error;
      if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('brisk-db-updated', { detail: { type: 'shifts' } }));
      return updated;
    },
    deleteShift: async function(id) {
      _shifts = _shifts.filter(s => s.id !== id);

      // 1. Primary Strategy: Unified Serverless Mutate API
      try {
        const token = await getMutateAuthToken();
        const res = await fetch('/api/schedule/mutate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': token ? ('Bearer ' + token) : ''
          },
          body: JSON.stringify({
            entity: 'shift',
            action: 'delete',
            id
          })
        });

        if (res.ok) {
          if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('brisk-db-updated', { detail: { type: 'shifts' } }));
          return;
        }
      } catch (apiErr) {
        console.warn('[BriskDB] Serverless deleteShift notice, fallback to Supabase SDK:', apiErr);
      }

      // 2. Fallback
      assertManagerPermissionForFallback();
      const { error } = await supabase.from('brisk_shifts').delete().eq('id', id);
      if (error) throw error;
      if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('brisk-db-updated', { detail: { type: 'shifts' } }));
    },
    batchUpdateShifts: async function(shiftsArray) {
      if (!shiftsArray || shiftsArray.length === 0) return;
      const mappedShifts = shiftsArray.map(mapShiftToDb);

      // Optimistic in-memory update
      shiftsArray.forEach(updated => {
        const mapped = mapShiftFromDb(mapShiftToDb(updated));
        const idx = _shifts.findIndex(s => s.id === updated.id);
        if (idx !== -1) _shifts[idx] = { ..._shifts[idx], ...mapped };
        else _shifts.push(mapped);
      });

      // 1. Primary Strategy: Unified Serverless Mutate API
      try {
        const token = await getMutateAuthToken();
        const res = await fetch('/api/schedule/mutate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': token ? ('Bearer ' + token) : ''
          },
          body: JSON.stringify({
            entity: 'shift',
            action: 'batchUpdate',
            shifts: mappedShifts
          })
        });

        if (res.ok) {
          if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('brisk-db-updated', { detail: { type: 'shifts' } }));
          return;
        }
      } catch (apiErr) {
        console.warn('[BriskDB] Serverless batchUpdateShifts notice, fallback to Supabase SDK:', apiErr);
      }

      // 2. Direct Supabase Client fallback
      assertManagerPermissionForFallback();
      let { error } = await supabase.from('brisk_shifts').upsert(mappedShifts);
      if (error && (error.message.includes('status') || error.message.includes('unpaid_meal_mins') || error.message.includes('color') || error.code === 'PGRST204')) {
        mappedShifts.forEach(s => {
          delete s.status;
          delete s.unpaid_meal_mins;
          delete s.color;
        });
        const retry = await supabase.from('brisk_shifts').upsert(mappedShifts);
        error = retry.error;
      }
      if (error) throw error;
      if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('brisk-db-updated', { detail: { type: 'shifts' } }));
    },

    addTimecard: async function(tc) {
      if (!tc.id) {
        tc.id = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : 'tc_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
      }

      // Optimistic in-memory update
      const existing = _timecards.findIndex(t => t.id === tc.id);
      if (existing !== -1) _timecards[existing] = tc;
      else _timecards.push(tc);

      // 1. Primary Strategy: Unified Serverless Mutate API
      try {
        const token = await getMutateAuthToken();
        const res = await fetch('/api/schedule/mutate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': token ? ('Bearer ' + token) : ''
          },
          body: JSON.stringify({
            entity: 'timecard',
            action: 'upsert',
            timecard: mapTimecardToDb(tc)
          })
        });

        if (res.ok) {
          const data = await res.json();
          if (data && data.success && data.timecard) {
            const mapped = mapTimecardFromDb(data.timecard);
            const idx = _timecards.findIndex(t => t.id === mapped.id);
            if (idx !== -1) _timecards[idx] = mapped;
            return mapped;
          }
        }
      } catch (apiErr) {
        console.warn('[BriskDB] Serverless addTimecard notice, fallback to Supabase SDK:', apiErr);
      }

      // 2. Direct Supabase Client fallback
      try {
        const { data, error } = await supabase.from('brisk_timecards').upsert([mapTimecardToDb(tc)]).select().maybeSingle();
        if (error) throw error;
        const mapped = mapTimecardFromDb(data || tc);
        const idx = _timecards.findIndex(t => t.id === mapped.id);
        if (idx !== -1) _timecards[idx] = mapped;
        return mapped;
      } catch (err) {
        console.warn('[BriskDB] addTimecard offline fallback:', err);
        enqueueOfflineOperation('add', tc);
        return tc;
      }
    },
    updateTimecard: async function(updated) {
      // Optimistic in-memory update
      const idx = _timecards.findIndex(t => t.id === updated.id);
      if (idx !== -1) _timecards[idx] = { ..._timecards[idx], ...updated };
      else _timecards.push(updated);

      // 1. Primary Strategy: Unified Serverless Mutate API
      try {
        const token = await getMutateAuthToken();
        const res = await fetch('/api/schedule/mutate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': token ? ('Bearer ' + token) : ''
          },
          body: JSON.stringify({
            entity: 'timecard',
            action: 'upsert',
            timecard: mapTimecardToDb(updated)
          })
        });

        if (res.ok) {
          const data = await res.json();
          if (data && data.success && data.timecard) {
            const mapped = mapTimecardFromDb(data.timecard);
            const curIdx = _timecards.findIndex(t => t.id === mapped.id);
            if (curIdx !== -1) _timecards[curIdx] = mapped;
            return;
          }
        }
      } catch (apiErr) {
        console.warn('[BriskDB] Serverless updateTimecard notice, fallback to Supabase SDK:', apiErr);
      }

      // 2. Direct Supabase Client fallback
      try {
        const { error } = await supabase.from('brisk_timecards').update(mapTimecardToDb(updated)).eq('id', updated.id);
        if (error) throw error;
      } catch (err) {
        console.warn('[BriskDB] updateTimecard offline fallback:', err);
        enqueueOfflineOperation('update', updated);
      }
    },

    addLeaveRequest: async function(lr) {
      const newLr = { ...lr, status: lr.status || 'Pending' };
      if (!newLr.id) {
        newLr.id = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : 'lr-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9);
      }

      // 1. Primary Strategy: Unified Serverless Mutate API
      try {
        const token = await getMutateAuthToken();
        const res = await fetch('/api/schedule/mutate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': token ? ('Bearer ' + token) : ''
          },
          body: JSON.stringify({
            entity: 'leave',
            action: 'create',
            leaveRequest: mapLeaveRequestToDb(newLr)
          })
        });

        if (res.ok) {
          const data = await res.json();
          if (data && data.success && data.leaveRequest) {
            const mapped = mapLeaveRequestFromDb(data.leaveRequest);
            const existing = _leaveRequests.findIndex(r => r.id === mapped.id);
            if (existing !== -1) _leaveRequests[existing] = mapped;
            else _leaveRequests.push(mapped);
            return mapped;
          }
        }
      } catch (apiErr) {
        console.warn('[BriskDB] Serverless addLeaveRequest notice, fallback to Supabase SDK:', apiErr);
      }

      // 2. Direct Supabase Client fallback
      const { isManager, myEmpId } = getRealtimeSecurityContext();
      if (!isManager && (!myEmpId || newLr.employeeId !== myEmpId)) {
        throw new Error('Permission denied: Employees can only submit leave requests for themselves.');
      }
      const { data, error } = await supabase.from('brisk_leave_requests').insert(mapLeaveRequestToDb(newLr)).select().maybeSingle();
      if (error) throw error;
      const mapped = mapLeaveRequestFromDb(data || newLr);
      const existing = _leaveRequests.findIndex(r => r.id === mapped.id);
      if (existing !== -1) _leaveRequests[existing] = mapped;
      else _leaveRequests.push(mapped);
      return mapped;
    },
    updateLeaveRequest: async function(updated) {
      // Optimistic in-memory update
      const idx = _leaveRequests.findIndex(r => r.id === updated.id);
      if (idx !== -1) _leaveRequests[idx] = { ..._leaveRequests[idx], ...updated };

      // 1. Primary Strategy: Unified Serverless Mutate API (Bypasses RLS locks)
      try {
        const token = await getMutateAuthToken();
        const res = await fetch('/api/schedule/mutate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': token ? ('Bearer ' + token) : ''
          },
          body: JSON.stringify({
            entity: 'leave',
            action: 'decide',
            id: updated.id,
            status: updated.status
          })
        });

        if (res.ok) {
          const data = await res.json();
          if (data && data.success && data.leaveRequest) {
            const mapped = mapLeaveRequestFromDb(data.leaveRequest);
            if (idx !== -1) _leaveRequests[idx] = { ..._leaveRequests[idx], ...mapped };
            return mapped;
          }
        }
      } catch (apiErr) {
        console.warn('[BriskDB] Serverless updateLeaveRequest notice, fallback to Supabase SDK:', apiErr);
      }

      // 2. Direct Supabase Client fallback
      assertManagerPermissionForFallback();
      const { error } = await supabase.from('brisk_leave_requests').update(mapLeaveRequestToDb(updated)).eq('id', updated.id);
      if (error) throw error;
    },

    saveSettings: async function(settings) {
      _settings = { ..._settings, ...settings };
      const { error } = await supabase.from('brisk_settings').upsert(mapSettingsToDb(_settings));
      if (error) console.error('Failed to save settings to Supabase:', error);
    },

    exportData: function() {
      const currentUser = (typeof window !== 'undefined' && window.state && window.state.currentUser) ? window.state.currentUser : null;
      if (!currentUser || (currentUser.role !== 'owner' && currentUser.role !== 'admin' && currentUser.role !== 'manager')) {
        return JSON.stringify({ error: 'Permission denied: Manager access required.' });
      }
      return JSON.stringify({
        employees: _employees,
        shifts: [..._shifts, ..._historicalShifts],
        timecards: [..._timecards, ..._historicalTimecards],
        leaveRequests: [..._leaveRequests, ..._historicalLeaveRequests],
        settings: _settings,
        exportedAt: new Date().toISOString()
      }, null, 2);
    },

    supabase: supabase,

    apiResetPasswordForEmail: async function(email) {
      try {
        const targetEmail = (email || '').toLowerCase().trim();
        if (!targetEmail) return { error: 'Email address is required.' };

        // 1. Primary Method: Call Serverless Reset API (generates instant recovery link & auto-provisions)
        try {
          const res = await fetch('/api/schedule/auth/reset', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: targetEmail })
          });

          if (res.ok) {
            const data = await res.json();
            if (data && data.success) {
              return { 
                success: true, 
                resetActionLink: data.resetActionLink, 
                message: data.message || 'Password reset link generated!' 
              };
            }
            if (data && data.error) {
              return { error: data.error };
            }
          }
        } catch (apiErr) {
          console.warn('[BriskDB] Serverless reset API fallback to Supabase SDK:', apiErr);
        }

        // 2. Secondary Fallback: Supabase Client SDK
        const { error } = await supabase.auth.resetPasswordForEmail(targetEmail, {
          redirectTo: 'https://woywoyamcalroster.vercel.app'
        });
        if (error) throw error;
        return { success: true, message: 'Password reset link sent to your email!' };
      } catch (err) {
        return { error: err.message || 'Failed to send password reset email.' };
      }
    },

    apiGenerateRecoveryLink: async function(email) {
      try {
        const token = await getValidToken();
        const res = await fetch('/api/schedule/auth/reset', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ 
            email: (email || '').toLowerCase().trim(),
            managerAction: true
          })
        });
        const data = await res.json();
        if (!res.ok || data.error) throw new Error(data.error || 'Failed to generate link');
        return { success: true, resetActionLink: data.resetActionLink, message: data.message };
      } catch (err) {
        return { error: err.message };
      }
    },

    apiManagerSetPassword: async function(email, newPassword) {
      try {
        const token = await getValidToken();
        const res = await fetch('/api/schedule/auth/reset', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ 
            email: (email || '').toLowerCase().trim(), 
            managerAction: true, 
            newPassword 
          })
        });
        const data = await res.json();
        if (!res.ok || data.error) throw new Error(data.error || 'Failed to update staff password');
        return { success: true, message: data.message };
      } catch (err) {
        return { error: err.message };
      }
    },

    apiUpdatePassword: async function(newPassword) {
      try {
        const { error } = await supabase.auth.updateUser({ password: newPassword });
        if (error) throw error;
        return { success: true };
      } catch (err) {
        return { error: err.message };
      }
    },

    exportData: function() {
      return JSON.stringify({
        employees: _employees,
        shifts: [..._shifts, ..._historicalShifts],
        timecards: [..._timecards, ..._historicalTimecards],
        leaveRequests: [..._leaveRequests, ..._historicalLeaveRequests],
        settings: _settings,
        exportedAt: new Date().toISOString()
      }, null, 2);
    },

    getOfflineQueueLength: function() {
      return _offlineQueue.length;
    },

    syncOfflineQueue: async function() {
      await processOfflineQueue();
    },

    logAudit: function(action, details, targetId) {
      try {
        const currentUser = (window.state && window.state.currentUser) ? window.state.currentUser : null;
        const auditEntry = {
          id: 'audit_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
          timestamp: new Date().toISOString(),
          action: action || 'GENERAL_MUTATION',
          actorEmail: currentUser ? currentUser.email : 'system',
          actorName: currentUser ? currentUser.name : 'System',
          actorRole: currentUser ? currentUser.role : 'system',
          targetId: targetId || null,
          details: details || ''
        };

        const existingRaw = localStorage.getItem('brisk_audit_logs');
        let logs = [];
        if (existingRaw) {
          try { logs = JSON.parse(existingRaw); } catch(e) { logs = []; }
        }
        logs.unshift(auditEntry);
        if (logs.length > 500) logs = logs.slice(0, 500);
        localStorage.setItem('brisk_audit_logs', JSON.stringify(logs));

        // Asynchronous non-blocking Supabase sync attempt
        if (supabase) {
          supabase.from('brisk_audit_logs').insert([{
            action: auditEntry.action,
            actor_email: auditEntry.actorEmail,
            actor_name: auditEntry.actorName,
            actor_role: auditEntry.actorRole,
            target_id: auditEntry.targetId,
            details: auditEntry.details,
            created_at: auditEntry.timestamp
          }]).then(() => {}).catch(() => {});
        }
        return auditEntry;
      } catch (err) {
        console.warn('Audit log write error:', err);
      }
    },

    getAuditLogs: function() {
      const currentUser = (typeof window !== 'undefined' && window.state && window.state.currentUser) ? window.state.currentUser : null;
      if (!currentUser || (typeof window.hasManagerPermissions === 'function' && !window.hasManagerPermissions(currentUser))) {
        return [];
      }
      try {
        const raw = localStorage.getItem('brisk_audit_logs');
        return raw ? JSON.parse(raw) : [];
      } catch (e) {
        return [];
      }
    },

    clearAuditLogs: function() {
      const currentUser = (typeof window !== 'undefined' && window.state && window.state.currentUser) ? window.state.currentUser : null;
      if (!currentUser || (typeof window.hasManagerPermissions === 'function' && !window.hasManagerPermissions(currentUser))) {
        return false;
      }
      try {
        localStorage.removeItem('brisk_audit_logs');
        return true;
      } catch (e) {
        return false;
      }
    }
  };
})();

window.BriskDB = BriskDB;
export default BriskDB;
