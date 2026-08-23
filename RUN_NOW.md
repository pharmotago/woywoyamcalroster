## Run these commands in Antigravity NOW

### Step 1 — Set ADMIN_PASSWORD and ADMIN_EMAIL in your local environment
Make sure C:\Antigravity\.env has these values set:
  ADMIN_EMAIL=pharmotago@gmail.com
  ADMIN_PASSWORD=<your chosen password>
  FIREBASE_ADMIN_PROJECT_ID=schedule-amcalwoywoy
  FIREBASE_ADMIN_CLIENT_EMAIL=<from service account JSON>
  FIREBASE_ADMIN_PRIVATE_KEY=<from service account JSON>

### Step 2 — Run the Firebase seed script (CRITICAL — do this first)
  cd C:\Antigravity\BriskSchedules
  node firebase-seed.js

This creates:
  - Peter Kim's Firebase Auth account
  - /organizations/amcal_woywoy document
  - /organizations/amcal_woywoy/users/{uid} with role: owner
  - /organizations/amcal_woywoy/employees/{uid} with Peter Kim's profile

### Step 3 — Deploy to Vercel
  git add .
  git commit -m "fix: module import order, firebase text, login session handling"
  git push

### Step 4 — Verify on live site
  Open https://woywoyamcalroster.vercel.app
  Login: pharmotago@gmail.com / <ADMIN_PASSWORD>
  
  Expect to see:
  ✅ "Welcome back, Peter Kim!" (not "User")
  ✅ Today's date correct in header and dashboard
  ✅ Employees load from Firestore (not localStorage)
  ✅ Scheduler grid shows current week
