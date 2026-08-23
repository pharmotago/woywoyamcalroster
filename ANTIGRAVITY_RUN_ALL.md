Run the following tasks in order for C:\Antigravity\BriskSchedules

---

TASK 1 — Check .env file exists at C:\Antigravity\.env
Read the file and confirm these keys are present (values don't need to be shown):
  - ADMIN_EMAIL
  - ADMIN_PASSWORD
  - FIREBASE_ADMIN_PROJECT_ID
  - FIREBASE_ADMIN_CLIENT_EMAIL
  - FIREBASE_ADMIN_PRIVATE_KEY

If any are missing, stop and tell me which ones.

---

TASK 2 — Install firebase-admin if not already installed
Run:
  cd C:\Antigravity\BriskSchedules
  npm install firebase-admin --save-dev

---

TASK 3 — Run the Firebase seed script
Run:
  cd C:\Antigravity\BriskSchedules
  node firebase-seed.js

Expected output:
  ✅ Organization document created.
  ✅ Created new Auth User (or "already exists")
  ✅ Employee profile document created.
  ✅ User role document created (role: owner).
  🎉 Seeding completed successfully!

If there is an error, show me the full error message and stop.

---

TASK 4 — Verify Firestore documents exist
Using firebase-admin, write a quick inline script to verify:
  node -e "
    require('dotenv').config({path:'../.env'});
    const {initializeApp,cert}=require('firebase-admin/app');
    const {getFirestore}=require('firebase-admin/firestore');
    const pk=process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\\\n/g,'\\n');
    initializeApp({credential:cert({projectId:process.env.FIREBASE_ADMIN_PROJECT_ID,clientEmail:process.env.FIREBASE_ADMIN_CLIENT_EMAIL,privateKey:pk})});
    const db=getFirestore();
    db.collection('organizations').doc('amcal_woywoy').collection('users').get().then(s=>{console.log('Users in Firestore:',s.size);s.forEach(d=>console.log(' -',d.id,d.data().role,d.data().name));process.exit(0);}).catch(e=>{console.error(e.message);process.exit(1);});
  "

Expected: Shows at least 1 user with role "owner" and name "Peter Kim"

---

TASK 5 — Git commit and push all changes
Run:
  cd C:\Antigravity\BriskSchedules
  git add .
  git commit -m "fix: module import order, catch types, firebase text, login session"
  git push

Wait for push to complete, then confirm "done".

---

TASK 6 — Check Vercel deployment
Run:
  vercel ls

Confirm the latest deployment is for woywoyamcalroster.vercel.app and show the deployment URL and status.

---

TASK 7 — Final verification
Open https://woywoyamcalroster.vercel.app in browser (use Chrome tool if available).
Check:
  1. Login page loads
  2. Login with ADMIN_EMAIL from .env
  3. Dashboard shows "Welcome back, Peter Kim!"
  4. Header shows today's correct date (Thursday, Jul 03, 2026)
  5. Active Staff count > 0

Report what you see for each check.
