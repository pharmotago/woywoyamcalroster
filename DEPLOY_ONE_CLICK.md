Run ALL of these steps in order. Do not skip any step. Show output for each.

---

STEP 1 — Navigate to project
cd C:\Antigravity\BriskSchedules

---

STEP 2 — Check git status (show what files changed)
git status

---

STEP 3 — Run Firebase seed to create Peter Kim's account in Firestore
node firebase-seed.js

If error "ADMIN_PASSWORD not set": read C:\Antigravity\.env and check if ADMIN_PASSWORD exists. If missing, tell me.
If error "Cannot find module 'firebase-admin'": run "npm install firebase-admin" first, then retry seed.
If error about FIREBASE_ADMIN credentials: the .env file at C:\Antigravity\.env may be missing Firebase Admin keys. Read the file and tell me which keys are missing.

Expected success output:
  ✅ Organization document created.
  ✅ Created new Auth User OR "already exists"
  ✅ Employee profile document created.
  ✅ User role document created (role: owner).
  🎉 Seeding completed successfully!

---

STEP 4 — Commit all changes
git add -A
git commit -m "fix: invite api catch type, utils any type, module import, login session, date render, firebase text"

---

STEP 5 — Push to trigger Vercel auto-deploy
git push origin main

If branch is not "main", try: git push origin master

---

STEP 6 — Wait 30 seconds then check deployment
timeout /t 30
vercel ls --scope=schedule-mcjp-io 2>nul || echo "Check Vercel dashboard manually at https://vercel.com/dashboard"

---

STEP 7 — Test the invite API directly
curl -X OPTIONS https://woywoyamcalroster.vercel.app/api/schedule/auth/invite -I

Expected: HTTP 200 with JSON headers (not HTML)
If you get HTML back: the API route is not deployed yet, wait another 60 seconds and retry.

---

STEP 8 — Report results
Tell me:
1. Did seed.js succeed? (yes/no + any errors)
2. Did git push succeed? (yes/no)
3. What did the curl test return? (HTTP status code)
