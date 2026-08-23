const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3040;

// Security headers and sensitive file blocking middleware
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');

  const forbiddenPaths = [/^\/\.env/i, /^\/\.git/i, /\.sql$/i, /^\/seed\.js$/i, /^\/package.*\.json$/i, ];
  if (forbiddenPaths.some(pattern => pattern.test(req.path))) {
    return res.status(403).send('Access Denied');
  }
  next();
});

// Serve static assets
app.use(express.static(__dirname));

// Default route for SPA index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log('\x1b[33m%s\x1b[0m', ' ==========================================');
  console.log('\x1b[36m%s\x1b[0m', '   BRISK SCHEDULES COMMAND CENTER ');
  console.log('\x1b[33m%s\x1b[0m', ' ==========================================');
  console.log(` ??Web Client Server Ignited on Port \x1b[32m${PORT}\x1b[0m`);
  console.log(` ?‘‰ http://localhost:${PORT}`);
  console.log('\x1b[33m%s\x1b[0m', ' ==========================================');
});
