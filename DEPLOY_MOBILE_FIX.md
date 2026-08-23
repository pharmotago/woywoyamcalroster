Run ALL steps in order:

STEP 1 — Firebase seed (Peter Kim 계정 생성)
cd C:\Antigravity\BriskSchedules
node firebase-seed.js

STEP 2 — Firebase Rules 배포 (Clock 권한 + users 읽기 권한)
firebase deploy --only firestore:rules

STEP 3 — Git push (모바일 전체 수정 + 모든 버그 fix)
git add -A
git commit -m "fix: mobile sidebar toggle, dashboard layout, modal scroll, scheduler touch, firestore rules users read"
git push origin main

STEP 4 — 결과 확인
각 단계 성공/실패 알려줘.
