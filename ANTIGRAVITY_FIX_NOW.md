You are running inside the Antigravity agentic coding environment.
Execute ALL tasks below in order. After each task, show the output before proceeding.

=== TASK 1: CHECK ENVIRONMENT ===

Run:
  cd C:\Antigravity\BriskSchedules
  node --version
  cat C:\Antigravity\.env | grep -E "FIREBASE|ADMIN" | sed 's/=.*/=***HIDDEN***/'

Tell me which env vars exist (keys only, not values).

=== TASK 2: INSTALL DEPENDENCIES ===

Run:
  npm install firebase-admin dotenv

=== TASK 3: RUN FIREBASE SEED ===

Run:
  node firebase-seed.js

Expected output:
  ✅ Organization document created.
  ✅ Created new Auth User  (or "User already exists")
  ✅ Employee profile document created.
  ✅ User role document created (role: owner).
  🎉 Seeding completed successfully!

If error "ADMIN_PASSWORD not set" → read C:\Antigravity\.env, tell me what's missing.
If error "Cannot find module" → run npm install again for that module.
If any Firebase error → show full error and STOP.

=== TASK 4: VERIFY FIRESTORE ===

Run this inline verification:
  node -e "
  require('dotenv').config({path:'C:/Antigravity/.env'});
  const admin=require('firebase-admin');
  if(!admin.apps.length){
    admin.initializeApp({credential:admin.credential.cert({
      projectId:process.env.FIREBASE_ADMIN_PROJECT_ID,
      clientEmail:process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey:process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\\\n/g,'\n')
    })});
  }
  const db=admin.firestore();
  Promise.all([
    db.collection('organizations/amcal_woywoy/users').get(),
    db.collection('organizations/amcal_woywoy/employees').get()
  ]).then(([u,e])=>{
    console.log('Users in Firestore:',u.size);
    u.forEach(d=>console.log('  user:',d.data().name,d.data().role));
    console.log('Employees in Firestore:',e.size);
    e.forEach(d=>console.log('  emp:',d.data().name));
    process.exit(0);
  }).catch(err=>{console.error(err.message);process.exit(1);});
  "

Expected: Shows Peter Kim with role owner.

=== TASK 5: GIT COMMIT AND PUSH ===

Run:
  git add -A
  git status
  git commit -m "fix: catch types, invite api, module import, login session, firebase text, date render"
  git push origin main

If branch is not main try: git push origin master
Show the push output.

=== TASK 6: WAIT FOR VERCEL DEPLOY ===

Wait 45 seconds then test:
  curl -s -o /dev/null -w "%{http_code}" https://woywoyamcalroster.vercel.app/api/schedule/auth/invite -X OPTIONS

Expected: 200
If still getting HTML (not 200): wait another 30 seconds and retry once.

=== TASK 7: FINAL REPORT ===

Tell me:
1. Did firebase-seed.js succeed? YES/NO
2. Did Firestore verification show Peter Kim with role owner? YES/NO
3. Did git push succeed? YES/NO
4. What HTTP status did the invite API return? (200 = fixed, anything else = still broken)
