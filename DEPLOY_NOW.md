Run ALL steps in order. Show output after each step.

STEP 1 — Firebase Rules 배포 (Clock 권한 에러 즉시 해결)
cd C:\Antigravity\BriskSchedules
firebase deploy --only firestore:rules

STEP 2 — Firebase Seed (Peter Kim 이름 표시 fix)
node firebase-seed.js

STEP 3 — Git push (전체 수정사항 Vercel 배포)
git add -A
git commit -m "fix: auto-scheduler firestore save, register login flow, clock rules deployed"
git push origin main

STEP 4 — 결과 확인
각 단계 성공/실패 알려줘.
완료 후 https://woywoyamcalroster.vercel.app 열어서
- "Welcome back, Peter Kim!" 뜨는지
- Clock In/Out 정상 작동하는지
확인해줘.
