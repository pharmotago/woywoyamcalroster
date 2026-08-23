# BriskSchedules — Antigravity Execution Prompts
# Copy and paste each prompt into Antigravity in order.
# Wait for each phase to complete before starting the next.

---

## PHASE 1 — Install Firebase & Initialize (Paste this first)

```
I need to migrate BriskSchedules from Supabase to Firebase.
The project is at C:\Antigravity\BriskSchedules

Step 1: Install Firebase dependencies
Run in the project directory:
npm install firebase firebase-admin nodemailer

Step 2: Create js/firebase.js with this content:

/**
 * BriskSchedules — Firebase Client SDK Initialization
 * Reads config from window.FIREBASE_CONFIG injected by index.html
 */
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { getFirestore, collection, doc, getDoc, getDocs, setDoc, addDoc, updateDoc, deleteDoc, onSnapshot, query, where, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

const firebaseConfig = {
  apiKey: "REPLACE_WITH_YOUR_API_KEY",
  authDomain: "REPLACE_WITH_YOUR_AUTH_DOMAIN",
  projectId: "REPLACE_WITH_YOUR_PROJECT_ID",
  storageBucket: "REPLACE_WITH_YOUR_STORAGE_BUCKET",
  messagingSenderId: "REPLACE_WITH_YOUR_SENDER_ID",
  appId: "REPLACE_WITH_YOUR_APP_ID"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const ORG_ID = 'amcal_woywoy';

// Enable offline persistence
import { enableIndexedDbPersistence } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
enableIndexedDbPersistence(db).catch((err) => {
  if (err.code === 'failed-precondition') console.warn('Firestore offline persistence failed: multiple tabs open.');
  else if (err.code === 'unimplemented') console.warn('Browser does not support offline persistence.');
});

export { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged,
         collection, doc, getDoc, getDocs, setDoc, addDoc, updateDoc, deleteDoc,
         onSnapshot, query, where, serverTimestamp };

Step 3: Create firestore.rules with the security rules from FIREBASE_MIGRATION_PLAN.md

Step 4: Update the <head> section of index.html — replace the existing script tags for database.js with:
<script type="module" src="js/firebase.js"></script>
<script type="module" src="js/database.js"></script>

Confirm each file is created and show me the directory structure when done.
```

---

## PHASE 2 — Rewrite database.js with Firestore (Paste after Phase 1 is done)

```
Now rewrite C:\Antigravity\BriskSchedules\js\database.js to use Firebase Firestore instead of Supabase API calls.

Requirements:
- Keep the same BriskDB public API (getEmployees, addEmployee, addShift, etc.) so app.js doesn't need changes
- Replace all fetch('/api/schedule/data') calls with Firestore SDK calls
- Replace localStorage session with Firebase Auth state (onAuthStateChanged)
- Use onSnapshot for real-time sync instead of manual polling
- Offline support via Firestore's built-in enableIndexedDbPersistence (already set in firebase.js)
- ORG_ID = 'amcal_woywoy' (fixed for single pharmacy deployment)

Firestore collection paths:
- Employees:      /organizations/amcal_woywoy/employees/{id}
- Shifts:         /organizations/amcal_woywoy/shifts/{id}
- Timecards:      /organizations/amcal_woywoy/timecards/{id}
- Leave requests: /organizations/amcal_woywoy/leave_requests/{id}
- Invitations:    /organizations/amcal_woywoy/invitations/{code}
- User roles:     /organizations/amcal_woywoy/users/{uid}

Auth flow:
- Login: signInWithEmailAndPassword(auth, email, password)
- Logout: signOut(auth)
- Get current user: auth.currentUser
- Get user role: fetch from /organizations/amcal_woywoy/users/{uid}.role

Key rules for RBAC:
- owner/manager: can read and write all collections
- employee: can read employees + shifts, can write only own timecards and leave_requests

Keep the same exported API:
  BriskDB.apiLogin(email, password)
  BriskDB.apiRegister(email, password, name, inviteCode)
  BriskDB.apiGenerateInvite(email, role)
  BriskDB.apiSendRosterEmail(employeeId, weekStart, rosterText)
  BriskDB.getSession() → { email, role, employeeId, name, token (Firebase ID token) }
  BriskDB.setSession(null) → logout
  BriskDB.syncFromServer() → trigger Firestore fetch
  BriskDB.getEmployees(), getShifts(), getTimecards(), getLeaveRequests()
  BriskDB.addEmployee(emp), updateEmployee(emp), deleteEmployee(id)
  BriskDB.addShift(shift), updateShift(shift), deleteShift(id)
  BriskDB.addTimecard(tc), updateTimecard(tc)
  BriskDB.addLeaveRequest(lr), updateLeaveRequest(lr)

Show me the full rewritten database.js when done.
```

---

## PHASE 3 — Replace Auth API Routes with Firebase Auth (Paste after Phase 2)

```
Now update the server-side API routes in C:\Antigravity\BriskSchedules\api\

Changes needed:

1. DELETE these files (Firebase Auth client-side replaces them):
   - api/schedule/auth/login/route.ts
   - api/schedule/auth/register/route.ts
   - api/supabase.ts

2. CREATE api/firebase-admin.ts:
   Initialize Firebase Admin SDK using environment variables:
   - FIREBASE_ADMIN_PROJECT_ID
   - FIREBASE_ADMIN_CLIENT_EMAIL
   - FIREBASE_ADMIN_PRIVATE_KEY
   Export: adminAuth, adminDb (Firestore Admin)

3. UPDATE api/schedule/auth/invite/route.ts:
   - Replace supabase import with adminDb from firebase-admin.ts
   - Replace supabase.from('brisk_invitations').insert() with:
     adminDb.collection('organizations').doc('amcal_woywoy').collection('invitations').doc(code).set({...})
   - Auth check: verify Firebase ID token from Authorization header using adminAuth.verifyIdToken(token)
   - Remove all other Supabase references

4. UPDATE api/schedule/email/route.ts:
   - Replace supabase import with adminDb from firebase-admin.ts
   - Replace employee lookup with Firestore:
     adminDb.collection('organizations/amcal_woywoy/employees').where('id','==',employeeId).get()
   - Auth check: verify Firebase ID token using adminAuth.verifyIdToken(token)
   - SMTP config stays exactly the same (no changes to nodemailer setup)

5. UPDATE api/schedule/utils.ts:
   - Remove all JWT signing/verification functions (signToken, verifyToken, verifyPassword, hashPassword)
   - Keep only: jsonResponse(), CORS config, and a new verifyFirebaseToken() helper that calls adminAuth.verifyIdToken()

Show me all updated files when done.
```

---

## PHASE 4 — Create Firebase Seed Script (Paste after Phase 3)

```
Create C:\Antigravity\BriskSchedules\firebase-seed.js

This script will:
1. Initialize Firebase Admin SDK (reads from C:\Antigravity\.env)
2. Create the organization document: /organizations/amcal_woywoy
3. Create Peter Kim's Firebase Auth account using ADMIN_EMAIL and ADMIN_PASSWORD env vars
4. Create Peter Kim's employee profile in Firestore: /organizations/amcal_woywoy/employees/{uid}
5. Create Peter Kim's user role document: /organizations/amcal_woywoy/users/{uid} with role: 'owner'

Peter Kim's data:
- Email: read from process.env.ADMIN_EMAIL
- Password: read from process.env.ADMIN_PASSWORD  
- Name: 'Peter Kim'
- Role (Firestore employee): 'Pharmacist Manager'
- Hourly rate: 85.00
- Max hours: 45
- Availability: Mon-Fri 08:30-17:30, Sat 09:00-13:00, Sun closed

Safety checks:
- Abort with error if ADMIN_EMAIL or ADMIN_PASSWORD env vars are not set
- Check if user already exists before creating (idempotent)
- Print success message with masked password

Also update C:\Antigravity\BriskSchedules\.env.example to add:
ADMIN_EMAIL=pharmotago@gmail.com
ADMIN_PASSWORD=choose-a-strong-password
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
FIREBASE_ADMIN_PROJECT_ID=
FIREBASE_ADMIN_CLIENT_EMAIL=
FIREBASE_ADMIN_PRIVATE_KEY=
NEXT_PUBLIC_ORG_ID=amcal_woywoy

Show me the complete firebase-seed.js when done.
```

---

## PHASE 5 — Deploy Firestore Rules & Final Checklist (Paste after Phase 4)

```
Final deployment steps for BriskSchedules Firebase migration.

1. Create C:\Antigravity\BriskSchedules\firestore.rules with the full security rules from FIREBASE_MIGRATION_PLAN.md

2. Create C:\Antigravity\BriskSchedules\firebase.json for Firebase CLI:
{
  "firestore": {
    "rules": "firestore.rules"
  }
}

3. Create C:\Antigravity\BriskSchedules\.firebaserc:
{
  "projects": {
    "default": "REPLACE_WITH_YOUR_FIREBASE_PROJECT_ID"
  }
}

4. Run these commands in order:
   npm install -g firebase-tools
   firebase login
   firebase deploy --only firestore:rules

5. Add all environment variables from .env.example to Vercel:
   Go to: https://vercel.com/dashboard → brisk-schedules project → Settings → Environment Variables
   Add each variable from .env.example with actual values

6. Run the seed script:
   cd C:\Antigravity\BriskSchedules
   node firebase-seed.js

7. Trigger Vercel redeploy:
   vercel --prod

8. Test the live site at https://woywoyamcalroster.vercel.app:
   - Login with pharmotago@gmail.com
   - Verify employee list loads
   - Add a test shift and confirm it saves
   - Test employee invite flow

Show me the final directory structure of the project when complete.
```
