/**
 * Google Pomelli Staff Communication & Multichannel Broadcast Studio
 * Inspired by Google Labs Pomelli: Automatically synthesizes on-brand,
 * crystal-clear staff communications for Telegram, SMS, WhatsApp, and Email.
 */

export class PomelliBroadcaster {
  constructor(storeName = 'Amcal Pharmacy Woy Woy') {
    this.storeName = storeName;
    this.appUrl = 'https://woywoyamcalroster.vercel.app';
  }

  /**
   * Generates Urgent Shift Cover Request Broadcasts across multiple platforms.
   */
  generateUrgentCoverKit(shift, role = 'Staff', notes = '') {
    const shiftStart = shift.startTime || shift.start || '09:00';
    const shiftEnd = shift.endTime || shift.end || '17:30';
    const shiftTimes = `${shiftStart} – ${shiftEnd}`;
    const claimUrl = `${this.appUrl}`;

    return {
      title: `🚨 Urgent Shift Cover Needed: ${role} (${shiftDate})`,
      telegram: `🚨 *URGENT SHIFT COVER REQUEST* 🚨\n\n📍 *Store*: ${this.storeName}\n📅 *Date*: ${shiftDate}\n⏰ *Time*: ${shiftTimes}\n👤 *Position*: ${role}\n${notes ? `📝 *Notes*: ${notes}\n` : ''}\n👉 *Claim Shift Now*: [Open Roster App](${claimUrl})\n\n_Please respond or claim directly in the app ASAP!_`,
      sms: `[${this.storeName}] URGENT SHIFT COVER: ${role} on ${shiftDate} (${shiftTimes}). Claim here: ${claimUrl}`,
      whatsApp: `🚨 *URGENT SHIFT COVER - ${this.storeName}*\n\n📅 Date: *${shiftDate}*\n⏰ Time: *${shiftTimes}*\n👤 Role: *${role}*\n${notes ? `📝 Notes: ${notes}\n` : ''}\n👉 Claim Shift: ${claimUrl}`,
      emailSubject: `[URGENT] Shift Coverage Needed: ${role} on ${shiftDate} (${shiftTimes})`,
      emailBody: `Hi Team,\n\nWe urgently need shift coverage for the following slot:\n\n• Store: ${this.storeName}\n• Date: ${shiftDate}\n• Time: ${shiftTimes}\n• Position: ${role}\n${notes ? `• Briefing Notes: ${notes}\n` : ''}\n\nIf you are available to take this shift, please claim it directly through the roster portal:\n${claimUrl}\n\nThank you for your support!\n\nManagement Team\n${this.storeName}`
    };
  }

  /**
   * Generates Weekly Roster Release Announcement Pack.
   */
  generateWeeklyRosterReleaseKit(weekStartDate, totalShiftsCount = 0, staffCount = 0) {
    const weekLabel = typeof weekStartDate === 'string' ? weekStartDate : new Date(weekStartDate).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
    const appLink = this.appUrl;

    return {
      title: `📅 Roster Published: Week of ${weekLabel}`,
      telegram: `📢 *NEW ROSTER PUBLISHED* 📢\n\n📍 *Store*: ${this.storeName}\n🗓️ *Week Starting*: Monday, ${weekLabel}\n👥 *Team Members*: ${staffCount} Active Staff\n📋 *Total Scheduled Shifts*: ${totalShiftsCount}\n\n📱 *Check your individual schedule here*:\n${appLink}\n\n_Reminder: If you need shift swaps, submit them via the in-app Swap Board at least 48 hours prior._`,
      sms: `[${this.storeName}] New roster published for week of ${weekLabel}. Check your shifts & clock times: ${appLink}`,
      whatsApp: `📢 *NEW ROSTER PUBLISHED - ${this.storeName}*\n\n🗓️ Week Starting: *${weekLabel}*\n📋 Total Shifts: *${totalShiftsCount}*\n\n👉 View your shifts: ${appLink}\n\nHave a great week!`,
      emailSubject: `[Roster Notice] Official Schedule Published for Week of ${weekLabel}`,
      emailBody: `Hi Everyone,\n\nThe official roster for the week starting Monday, ${weekLabel} is now published and active.\n\nKey Details:\n• Store: ${this.storeName}\n• Total Shifts: ${totalShiftsCount}\n• View & Confirm Shifts: ${appLink}\n\nPlease log in to check your assigned shifts, break timings, and trading hours. If you anticipate any conflicts, please utilize the Swap Board feature in the portal.\n\nWarm regards,\nManagement Team\n${this.storeName}`
    };
  }

  /**
   * Generates Staff Onboarding & Dispensary Handbook Kit.
   */
  generateStaffOnboardingKit(employeeName, tempEmail, inviteCode) {
    return {
      title: `👋 Welcome to ${this.storeName}: Staff Onboarding Kit`,
      telegram: `👋 *Welcome to the Team, ${employeeName}!* 🌟\n\nYour profile has been created on the *${this.storeName}* Roster System.\n\n🔑 *Your Invite Code*: \`${inviteCode || 'N/A'}\`\n📧 *Email*: \`${tempEmail}\`\n🌐 *Portal*: ${this.appUrl}\n\n📲 *How to Install the Mobile App*:\n1. Open ${this.appUrl} in Safari (iOS) or Chrome (Android).\n2. Tap *Share / Options* ➔ Select *"Add to Home Screen"*.\n3. Log in with your invite code or email.`,
      sms: `Welcome to ${this.storeName}, ${employeeName}! Access your staff roster & time clock at ${this.appUrl}. Invite Code: ${inviteCode}`,
      whatsApp: `👋 *Welcome to ${this.storeName}, ${employeeName}!* 🌟\n\nYour roster portal account is ready.\n\n🌐 Portal: ${this.appUrl}\n🔑 Invite Code: *${inviteCode || 'N/A'}*\n\nPlease install the app on your home screen and complete your registration.`,
      emailSubject: `Welcome to ${this.storeName} — Your Staff Roster & Time Clock Portal Access`,
      emailBody: `Dear ${employeeName},\n\nWelcome to ${this.storeName}! We are delighted to have you on board.\n\nYour digital profile is active on our staff portal:\n• Portal URL: ${this.appUrl}\n• Registered Email: ${tempEmail}\n• Invitation Code: ${inviteCode || 'N/A'}\n\nGetting Started:\n1. Visit ${this.appUrl} on your mobile browser.\n2. Tap "Add to Home Screen" to install the app for instant 1-tap access.\n3. Sign in or register using your Invitation Code.\n4. View your upcoming shifts, punch in/out on the digital Time Clock terminal, and submit leave requests.\n\nIf you have any questions, feel free to reach out to the management team.\n\nBest regards,\n${this.storeName}`
    };
  }

  /**
   * Generates Fair Work Pharmacy Industry Award 2020 Compliance Memo.
   */
  generateComplianceMemoKit(holidayName, holidayDate, penaltyRate = '250%') {
    return {
      title: `⚖️ Fair Work Compliance Notice: ${holidayName} (${holidayDate})`,
      telegram: `⚖️ *PUBLIC HOLIDAY ROSTER & PENALTY NOTICE* ⚖️\n\n📍 *Store*: ${this.storeName}\n🗓️ *Holiday*: ${holidayName} (${holidayDate})\n💰 *Applicable Penalty Rate*: ${penaltyRate} (Pharmacy Industry Award 2020)\n\n☕ *Break Policy Reminder*:\n• Shifts > 5 hours: Mandatory 30-min unpaid meal break.\n• Sole Pharmacist on duty: Entitled to Paid Crib Break under Clause 20.2.\n\n_Management ensures 100% compliant Single Touch Payroll & Fair Work audit compliance._`,
      sms: `[${this.storeName}] Public Holiday Notice: ${holidayName} on ${holidayDate} attracts ${penaltyRate} penalty rate under Pharmacy Award 2020.`,
      whatsApp: `⚖️ *PUBLIC HOLIDAY NOTICE - ${this.storeName}*\n\n🗓️ Holiday: *${holidayName} (${holidayDate})*\n💰 Rate: *${penaltyRate}* (Pharmacy Industry Award 2020)\n\nEnsure all clock punches and breaks are logged accurately in the app.`,
      emailSubject: `[Staff Compliance Notice] Public Holiday Operations & Penalty Rates: ${holidayName}`,
      emailBody: `Team,\n\nPlease take note of trading and wage arrangements for the upcoming public holiday:\n\n• Public Holiday: ${holidayName}\n• Date: ${holidayDate}\n• Penalty Loading: ${penaltyRate} (Fair Work Pharmacy Industry Award 2020)\n\nBreak Compliance Requirements:\n1. All staff working over 5 hours must take a 30-minute meal break.\n2. Single pharmacist shifts operate under Clause 20.2 Paid Crib Break rules.\n3. Please ensure time clock punches reflect exact commencement and completion times.\n\nThank you for your dedicated service.\n\nManagement\n${this.storeName}`
    };
  }

  /**
   * Helper: Opens Native Share Dialog or Copies text.
   */
  static async copyOrShare(text, title = 'Broadcast Message') {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return { success: true, method: 'clipboard' };
    }
    return { success: false, method: 'none' };
  }

  /**
   * Helper: Generates Telegram / WhatsApp direct share URLs.
   */
  static getShareUrls(text) {
    const encodedText = encodeURIComponent(text);
    return {
      telegram: `https://t.me/share/url?url=${encodeURIComponent('https://woywoyamcalroster.vercel.app')}&text=${encodedText}`,
      whatsApp: `https://api.whatsapp.com/send?text=${encodedText}`
    };
  }
}

// Global window registration
if (typeof window !== 'undefined') {
  window.PomelliBroadcaster = PomelliBroadcaster;
}

export default PomelliBroadcaster;
