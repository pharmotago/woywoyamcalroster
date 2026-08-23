const fs = require('fs');
const path = require('path');

const appJs = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');
const lines = appJs.split('\n');

lines.forEach((line, index) => {
  if (line.includes('window.handleLoginSubmit') || line.includes('window.handleRegisterSubmit') || line.includes('window.showLoginCard') || line.includes('window.showRegisterCard') || line.includes('window.handleLogout')) {
    console.log(`Line ${index + 1}: ${line}`);
  }
});
