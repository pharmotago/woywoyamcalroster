Run ALL steps in order. Show output for each step.

STEP 1 — Firebase Rules 배포 (Clock Out 에러 즉시 해결)
cd C:\Antigravity\BriskSchedules
firebase deploy --only firestore:rules

STEP 2 — Firebase seed 실행 (Peter Kim 이름 표시 fix)
node firebase-seed.js

STEP 3 — git push (Vercel 재배포)
git add -A
git commit -m "fix: employee delete, clear week firebase, clock optimistic, date render"
git push origin main

STEP 4 — 결과 확인
각 단계 성공/실패 여부를 알려줘.
