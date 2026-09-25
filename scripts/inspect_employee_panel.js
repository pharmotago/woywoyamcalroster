const fs = require('fs');
const path = require('path');

const appJs = fs.readFileSync(path.join(__dirname, '../js/app.js'), 'utf8');
const indexHtml = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
const dbJs = fs.readFileSync(path.join(__dirname, '../js/database.js'), 'utf8');
const syncTs = fs.readFileSync(path.join(__dirname, '../api/schedule/sync/index.ts'), 'utf8');

console.log('--- 1. Searching for Employee Panel in index.html ---');
const panelMatches = indexHtml.match(/<div[^>]*id=["'][^"']*(?:employee|staff)[^"']*["'][^>]*>/gi);
console.log('Panel matches in HTML:', panelMatches);

const lines = indexHtml.split('\n');
lines.forEach((l, i) => {
  if (l.includes('id="panel-employees"') || l.includes('id="employees-table"') || l.includes('id="staff-') || l.includes('id="tab-employees"')) {
    console.log(`index.html:${i + 1}: ${l.trim()}`);
  }
});

console.log('\n--- 2. Searching for Employee Rendering in js/app.js ---');
const appLines = appJs.split('\n');
appLines.forEach((l, i) => {
  if (l.includes('function renderEmployees') || l.includes('function renderStaff') || l.includes('renderEmployees(') || l.includes('renderEmployeeList')) {
    console.log(`js/app.js:${i + 1}: ${l.trim()}`);
  }
});
