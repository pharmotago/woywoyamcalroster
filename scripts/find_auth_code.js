const fs = require('fs');
const path = require('path');

const appJs = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');
const lines = appJs.split('\n');

lines.forEach((line, index) => {
  if (line.includes('apiLogin') || line.includes('function showLoginScreen') || line.includes('form-login') || line.includes('btn-login') || line.includes('login-form')) {
    console.log(`Line ${index + 1}: ${line}`);
  }
});
