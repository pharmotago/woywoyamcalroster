const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

// Output destinations
const desktopPath = path.join('C:', 'Users', 'Sung', 'Desktop', 'Amcal_Woy_Woy_Action_Timeline_Sep_Oct_2026.pdf');
const docsPath = path.join(__dirname, '..', '..', 'amcal-woywoy', 'docs', 'operations', 'Amcal_Woy_Woy_Action_Timeline_Sep_Oct_2026.pdf');
const brainPath = path.join('C:', 'Users', 'Sung', '.gemini', 'antigravity', 'brain', 'e818c360-f326-48d0-a403-1fbd6a28380c', 'Amcal_Woy_Woy_Action_Timeline_Sep_Oct_2026.pdf');

// Ensure parent directory for docsPath exists
fs.mkdirSync(path.dirname(docsPath), { recursive: true });

const doc = new PDFDocument({
  size: 'A4',
  margin: 36,
  bufferPages: true,
  info: {
    Title: 'Amcal Pharmacy Woy Woy — Operations Timeline & Leadership Action Guide',
    Author: 'Amcal Pharmacy Woy Woy Management (Peter Kim)',
    Subject: 'Simple, Actionable Timeline for Vicki, Wendy, Mia, Chantel & Peter',
    Keywords: 'Amcal, Timeline, Vicki, Wendy, Mia, Chantel, Peter, Spring Sale, Planograms, Loyalty'
  }
});

// Setup multiple write streams
const streamDesktop = fs.createWriteStream(desktopPath);
doc.pipe(streamDesktop);

// Copy to backup paths upon completion
streamDesktop.on('finish', () => {
  try {
    fs.copyFileSync(desktopPath, docsPath);
    fs.copyFileSync(desktopPath, brainPath);
    console.log('✅ PDF successfully created at:');
    console.log('  1. ' + desktopPath);
    console.log('  2. ' + docsPath);
    console.log('  3. ' + brainPath);
  } catch (err) {
    console.error('Copy error:', err);
  }
});

// --- Palette ---
const NAVY = '#0a192f';
const BLUE = '#0284c7';
const LIGHT_BLUE = '#e0f2fe';
const EMERALD = '#059669';
const LIGHT_EMERALD = '#ecfdf5';
const AMBER = '#d97706';
const LIGHT_AMBER = '#fef3c7';
const PURPLE = '#7c3aed';
const LIGHT_PURPLE = '#f5f3ff';
const ROSE = '#e11d48';
const LIGHT_ROSE = '#ffe4e6';
const SLATE = '#1e293b';
const MUTED = '#64748b';
const BORDER = '#cbd5e1';
const BG_GRAY = '#f8fafc';
const WHITE = '#ffffff';

function drawHeader(pageTitle, pageSubtitle) {
  // Banner background
  doc.rect(36, 30, 523, 54).fill(NAVY);
  
  // Brand
  doc.fillColor(WHITE).fontSize(20).font('Helvetica-Bold').text('Amcal+', 48, 42);
  doc.fillColor(BLUE).fontSize(10).font('Helvetica-Bold').text('PHARMACY WOY WOY', 125, 48);
  
  // Page Title
  doc.fillColor(WHITE).fontSize(12).font('Helvetica-Bold').text(pageTitle.toUpperCase(), 240, 42, { align: 'right', width: 305 });
  doc.fillColor(LIGHT_BLUE).fontSize(8.5).font('Helvetica').text(pageSubtitle, 240, 58, { align: 'right', width: 305 });
}

function drawTimelineCard(y, timeBadge, timeBadgeColor, title, ownerBadge, ownerColor, items) {
  const cardWidth = 523;
  const x = 36;
  const cardHeight = 22 + (items.length * 15) + 8;

  // Background
  doc.roundedRect(x, y, cardWidth, cardHeight, 5).fillAndStroke(BG_GRAY, BORDER);
  doc.rect(x, y, 4, cardHeight).fill(timeBadgeColor);

  // Time Badge
  doc.roundedRect(x + 12, y + 6, 95, 14, 3).fill(timeBadgeColor);
  doc.fillColor(WHITE).fontSize(8).font('Helvetica-Bold').text(timeBadge, x + 14, y + 9, { width: 91, align: 'center' });

  // Title
  doc.fillColor(SLATE).fontSize(10.5).font('Helvetica-Bold').text(title, x + 115, y + 7);

  // Owner Badge
  doc.roundedRect(x + cardWidth - 110, y + 6, 100, 14, 3).fill(ownerColor);
  doc.fillColor(WHITE).fontSize(7.5).font('Helvetica-Bold').text(ownerBadge, x + cardWidth - 108, y + 9, { width: 96, align: 'center' });

  // Items
  let itemY = y + 24;
  items.forEach(item => {
    doc.fillColor(SLATE).fontSize(8.5).font('Helvetica-Bold').text('•', x + 14, itemY);
    doc.fillColor(SLATE).fontSize(8.5).font('Helvetica').text(item, x + 24, itemY, { width: cardWidth - 36 });
    itemY += 15;
  });

  return cardHeight;
}

// ==========================================
// PAGE 1: MASTER TIMELINE (CHRONOLOGICAL)
// ==========================================
drawHeader('Master Execution Timeline', 'September – October 2026 Action Roadmap');

doc.moveDown(0.2);
let currentY = 96;

// Intro text
doc.fillColor(SLATE).fontSize(9.5).font('Helvetica-Bold').text('EXECUTIVE ROADMAP & KEY MILESTONES (10 SEP – 31 OCT 2026)', 36, currentY);
currentY += 14;
doc.fillColor(MUTED).fontSize(8.5).font('Helvetica').text(
  'A clean, simplified timeline synchronizing front-of-shop campaigns, planogram deadlines, dispensary generic rebates, and commercial margins for Amcal Pharmacy Woy Woy.',
  36, currentY, { width: 523, lineGap: 2 }
);
currentY += 26;

// Timeline Event 1: This Week (10–14 Sep)
const h1 = drawTimelineCard(
  currentY,
  '10 – 14 SEP 2026',
  BLUE,
  'Campaign Launches & Critical Rehearsals',
  'VICKI • WENDY • MIA',
  PURPLE,
  [
    'Amcal Spring Sale Begins (10–27 Sep): 20-page catalogue, $0.99 deals, 100 shelf tickets erected.',
    'Digital Loyalty Card Rehearsal (Sat 13 Sep close / Sun 14 Sep morning): Mandatory staff dry run at till.',
    'Digital Loyalty Card Go-Live (Sunday 14 Sep): Apple/Google Wallet via till QR portal (30-sec SMS). STRICT: No POS before 14th!',
    'October Fragrance Allocation: Confirm orders for core Christmas drivers (Dior Sauvage, Cool Water, Sabrina Carpenter).'
  ]
);
currentY += h1 + 10;

// Timeline Event 2: Week 2 (15–21 Sep)
const h2 = drawTimelineCard(
  currentY,
  '15 – 21 SEP 2026',
  EMERALD,
  'TVC Verifications & Enhanced Margin Purchasing',
  'WENDY • MIA • CHANTEL',
  EMERALD,
  [
    'Funded TVC Lines Proof (14–27 Sep): Upload shelf photos to Snap & Share (Dermal Therapy, Wart Off, Dulcolax, Zostrix, Zyrtec).',
    'Active Margin Ordering: Capitalize on improved terms (Evolution Health 38%, Pharmacare up to 25%, Level Up 58–63% GP).',
    'Weekly Cross-Dock Opt-Out: Download problem lines file Mon/Tue and submit via Sigma Connect by Thursday.',
    'Dispensary Wait-Time & Service Flow: Chantel & team enforce smooth customer flow during high Spring Sale foot traffic.'
  ]
);
currentY += h2 + 10;

// Timeline Event 3: End of Month (22–30 Sep)
const h3 = drawTimelineCard(
  currentY,
  '22 – 30 SEP 2026',
  ROSE,
  'Planogram Deadlines & Clinical Governance Cutoff',
  'WENDY • PETER • AMANDA',
  ROSE,
  [
    'Planogram Releases 1–2 Due (30 Sep): Baby, Digestive, Allergy, C&F, Kids Health, Beauty. Submit via Snap & Share.',
    'Strict Merchandising Rules: NO bottom-shelf slow movers to top shelves; NO stripping core lines; NO bay reshuffling.',
    'Pharmacist CPD 40 Points Deadline (30 Sep): Peter and all dispensary pharmacists must finalize CPD via Pharmacy IQ.',
    'MedAdvisor "60 in 60 Days" Wrap-up: Final push at dispensary till to hit customer app registration targets.'
  ]
);
currentY += h3 + 10;

// Timeline Event 4: October (1–31 Oct)
const h4 = drawTimelineCard(
  currentY,
  '01 – 31 OCT 2026',
  AMBER,
  'Genwell Foxtel Campaign, Clinics & Releases 3–4',
  'ALL TEAM LEADS',
  NAVY,
  [
    'Genwell Setup (POS by 2 Oct, Broadcast 5 Oct): Foxtel / Ch 9 series; dollar ends, floor stands & MCoBeauty units.',
    'October Hearing Clinics: Partner with Hearing Australia; schedule clinics targeting the $650 network revenue benchmark.',
    'Planogram Releases 3–4 Due (31 Oct): Dental, Quit Smoking, Personal Care, First Aid, Health Management, Vitamins.',
    'Continuous SEP Generic Rebate: Maintain >95% dispensary substitution rate to secure full 18% manufacturer rebate.'
  ]
);
currentY += h4 + 10;

// Footer Note
doc.roundedRect(36, currentY, 523, 30, 4).fill(LIGHT_BLUE);
doc.fillColor(NAVY).fontSize(8.5).font('Helvetica-Bold').text('CRITICAL COMMERCIAL RULE:', 48, currentY + 6);
doc.fillColor(SLATE).fontSize(8).font('Helvetica').text(
  'Maintain 70% Dispense / 30% Front of Shop ratio. Protect the 18% dispensary SEP rebate (>95% substitution) while converting retail catalogue traffic into long-term Amcal Rewards loyalty members.',
  48, currentY + 16, { width: 500 }
);

// ==========================================
// PAGE 2: FRONT-OF-SHOP LEADERSHIP CHECKLISTS
// ==========================================
doc.addPage();
drawHeader('Front-of-Shop Action Guide', 'Checklists for Vicki, Wendy & Mia');

currentY = 96;

function drawPersonSection(y, name, role, color, lightColor, tasks) {
  const x = 36;
  const width = 523;
  const boxHeight = 22 + (tasks.length * 20) + 6;

  // Header Box
  doc.roundedRect(x, y, width, boxHeight, 5).fillAndStroke(WHITE, BORDER);
  doc.roundedRect(x, y, width, 22, 5).fill(color);
  doc.rect(x, y + 16, width, 6).fill(color); // square bottom corners of header

  doc.fillColor(WHITE).fontSize(10.5).font('Helvetica-Bold').text(name.toUpperCase(), x + 12, y + 6);
  doc.fillColor(WHITE).fontSize(9).font('Helvetica-Bold').text(`— ${role}`, x + 12 + doc.widthOfString(name.toUpperCase()) + 8, y + 7);

  let taskY = y + 28;
  tasks.forEach(t => {
    // Checkbox box
    doc.roundedRect(x + 12, taskY, 11, 11, 2).lineWidth(1).strokeColor(color).stroke();
    
    // Timeline tag
    doc.roundedRect(x + 28, taskY, 68, 12, 2).fill(lightColor);
    doc.fillColor(color).fontSize(7).font('Helvetica-Bold').text(t.tag, x + 30, taskY + 2.5, { width: 64, align: 'center' });

    // Task text
    doc.fillColor(SLATE).fontSize(8.5).font('Helvetica').text(t.text, x + 102, taskY + 1.5, { width: width - 112, lineGap: 1.5 });

    taskY += 20;
  });

  return boxHeight;
}

// Vicki Duffy — Retail Manager
const vickiTasks = [
  { tag: '10–27 SEP', text: 'Lead Amcal Spring Sale: Direct retail staff to actively sign shoppers up for Amcal Rewards at registers.' },
  { tag: '13/14 SEP', text: 'Digital Loyalty Rehearsal: Conduct staff till practice Sat evening / Sun morning before opening.' },
  { tag: '14 SEP', text: 'Digital Loyalty Go-Live: Ensure NO loyalty POS is shown before 14th. Position laminated QR signs at front & rear checkouts.' },
  { tag: 'BY 02 OCT', text: 'Genwell Setup: Install POS kits, dollar ends, floor stands, and MCoBeauty counter displays before 5 Oct broadcast.' },
  { tag: 'WEEKLY', text: 'Brand Standards & Audits: Oversee store presentation, staff uniform adherence, and achieve 90% brand compliance.' }
];
const hVicki = drawPersonSection(currentY, 'Vicki Duffy', 'Retail Manager (Reports to Peter Kim)', PURPLE, LIGHT_PURPLE, vickiTasks);
currentY += hVicki + 14;

// Wendy Lobb — Retail Coordinator
const wendyTasks = [
  { tag: '10–14 SEP', text: 'Spring Sale Merchandising: Install 100 promotional shelf tickets and set up the front quadruple promotional end.' },
  { tag: '14–27 SEP', text: 'TVC Line Photos: Capture and upload shelf photos of 5 funded TVC brands to Snap & Share for supplier proof.' },
  { tag: 'BY 30 SEP', text: 'Planogram Releases 1–2: Complete Baby, Digestive, Allergy, C&F, Kids Health & Beauty; submit Snap & Share photos.' },
  { tag: 'ONGOING', text: 'Merchandising Compliance: Enforce NO moving slow sellers to top shelves, NO stripping core lines, NO bay reshuffling.' },
  { tag: 'WEEKLY', text: 'Weekly Compliance Audit: Perform weekly floor walk audit; maintain stock rotation ("first in, first out").' }
];
const hWendy = drawPersonSection(currentY, 'Wendy Lobb', 'Retail Coordinator (Reports to Peter Kim)', EMERALD, LIGHT_EMERALD, wendyTasks);
currentY += hWendy + 14;

// Mia Staniland — Stock Controller
const miaTasks = [
  { tag: 'THIS WEEK', text: 'October Fragrance Allocation: Review Amcal allocation file; lock orders for core volume staples (Sauvage, Cool Water).' },
  { tag: 'ACTIVE NOW', text: 'High-Margin Ordering: Prioritize Evolution Health (38%), Pharmacare lines (up to 25%), and Level Up Hydration (63% GP).' },
  { tag: 'EACH THURS', text: 'Cross-Dock Opt-Out: Download allocation opt-out file on Mon/Tue and submit via Sigma Connect by Thursday.' },
  { tag: 'ONGOING', text: 'Barcode Verification: Use Central / SharePoint product list as the source of truth (ignore Spaceman ~300 barcode errors).' },
  { tag: 'WEEKLY', text: 'Returns Management: Clear and process the returns holding area weekly for out-of-date and damaged goods.' }
];
const hMia = drawPersonSection(currentY, 'Mia Staniland', 'Stock Controller (Reports to Peter / Vicki)', AMBER, LIGHT_AMBER, miaTasks);

// ==========================================
// PAGE 3: DISPENSARY & PHARMACY GOVERNANCE
// ==========================================
doc.addPage();
drawHeader('Dispensary & Management Guide', 'Checklists for Chantel & Peter + Golden Rules');

currentY = 96;

// Chantel — Dispensary Manager
const chantelTasks = [
  { tag: 'DAILY DISP', text: 'Supervise Dispensary Flow: Oversee script queues, technician assignments, and maintain rapid, safe turnaround times.' },
  { tag: 'REBATE CORE', text: 'Enforce SEP 95%+ Generic Substitution: Protect our 18% manufacturer rebate (avoid dropping below 90% zero rebate).' },
  { tag: 'BY 30 SEP', text: 'MedAdvisor 60-in-60 Campaign: Ensure dispensing staff actively promote MedAdvisor app at script in/out counters.' },
  { tag: 'CLINICAL', text: 'Service Referrals: Identify patients eligible for MedsCheck, Diabetes MedsCheck, and clinical pharmacist interventions.' },
  { tag: 'STOCK / COLD', text: 'Dispensary Inventory & Vaccines: Manage Strive for 5 fridge temps and deploy remaining FluCelvax (exp Feb 2027).' }
];
const hChantel = drawPersonSection(currentY, 'Chantel', 'Dispensary Manager (Reports to Peter Kim)', BLUE, LIGHT_BLUE, chantelTasks);
currentY += hChantel + 14;

// Peter Kim — Managing Pharmacist & Owner
const peterTasks = [
  { tag: 'FINANCE', text: 'Sigma Account Reconciliation: Verify FluMis refund credits landed on primary Sigma statement (credited 14 Aug).' },
  { tag: 'CYBERSECURITY', text: 'Phishing Defense: Brief all staff "Pause, check, then click". Strictly BAN email auto-forwarding from store mailboxes.' },
  { tag: 'DISPENSARY', text: 'Clinical Oversight & SEP Matrix: Brief Khang, Amanda, Krystal & Chantel on monthly SEP pricing matrix in Fred Plus.' },
  { tag: 'BY 30 SEP', text: 'Pharmacist CPD Audit: Ensure personal 40 CPD points and all pharmacist staff CPD are completed on Pharmacy IQ.' },
  { tag: 'QSPP', text: 'Cultural Safety Entry: Log September briefing in QSPP calendar and implement 1–2 practical community care actions.' }
];
const hPeter = drawPersonSection(currentY, 'Peter Kim', 'Managing Pharmacist & Franchise Owner', NAVY, BG_GRAY, peterTasks);
currentY += hPeter + 14;

// Section 3: STOREWIDE NON-NEGOTIABLE GOLDEN RULES
doc.roundedRect(36, currentY, 523, 105, 5).fillAndStroke(LIGHT_ROSE, ROSE);
doc.fillColor(ROSE).fontSize(10).font('Helvetica-Bold').text('STOREWIDE NON-NEGOTIABLE GOLDEN RULES', 48, currentY + 8);

const goldenRules = [
  '1. MERCHANDISING RULE: Never move slow-selling bottom shelf items to top eye-level shelves. Top shelves are reserved for high IGP top sellers.',
  '2. RANGE RULE: Never strip core lines before they have been given a fair commercial trial. Optional lines may be added, but core must stay.',
  '3. EMBARGO RULE: Zero Digital Loyalty POS displayed before Monday 14 September. Staff rehearsal must be completed before public launch.',
  '4. CYBERSECURITY RULE: Never auto-forward store mailboxes to personal email accounts. Forwarding is the #1 cause of franchise email hacks.',
  '5. DISPENSARY REBATE RULE: Substitution rate must stay above 95% at all times. Dropping below 90% results in complete loss of the 18% rebate.'
];

let ruleY = currentY + 22;
goldenRules.forEach(gr => {
  doc.fillColor(SLATE).fontSize(7.5).font('Helvetica-Bold').text(gr, 48, ruleY, { width: 500 });
  ruleY += 16;
});

// ==========================================
// PAGE NUMBERING (Fix y to 788 to prevent auto-overflow)
// ==========================================
const pages = doc.bufferedPageRange();
for (let i = 0; i < pages.count; i++) {
  doc.switchToPage(i);
  doc.fillColor(MUTED).fontSize(8).font('Helvetica').text(
    `Amcal Pharmacy Woy Woy • September – October 2026 Operational Action Timeline • Page ${i + 1} of ${pages.count}`,
    36,
    788,
    { align: 'center', width: 523, lineBreak: false }
  );
}

// Finalize document
doc.end();
