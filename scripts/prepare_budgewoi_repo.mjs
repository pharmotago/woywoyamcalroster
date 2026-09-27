/**
 * Phase 2: Standalone Budgewoi Codebase Preparation
 * ==================================================
 * Clones the BriskSchedules codebase into c:\Antigravity\BudgewoiDdsRoster
 * and strips multi-tenant complexity into a clean, dedicated single-store application.
 *
 * Usage: npm run prepare:budgewoi
 */
import * as fs from 'fs';
import * as path from 'path';

const SRC_DIR = 'C:\\Antigravity\\BriskSchedules';
const DEST_DIR = 'C:\\Antigravity\\BudgewoiDdsRoster';

const EXCLUDE_DIRS = new Set([
  'node_modules',
  '.git',
  '.vercel',
  '.system_generated',
  'temp_brisk_nm',
  '_node_modules_tmp'
]);

function copyDirRecursive(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    if (EXCLUDE_DIRS.has(entry.name)) continue;

    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

async function prepareBudgewoi() {
  console.log(`Copying codebase from ${SRC_DIR} to ${DEST_DIR}...`);
  copyDirRecursive(SRC_DIR, DEST_DIR);
  console.log('Base copy completed.');

  // 1. Update package.json for Budgewoi
  const pkgPath = path.join(DEST_DIR, 'package.json');
  if (fs.existsSync(pkgPath)) {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    pkg.name = 'budgewoi-dds-roster';
    pkg.description = 'Budgewoi Discount Drug Stores - Staff Scheduler & Award Compliance Platform';
    // Clean out multi-tenant specific release scripts
    pkg.scripts.deploy = 'git pull --rebase origin main && git push origin main && vercel --prod --yes --cwd .';
    pkg.scripts['domain:alias'] = 'echo "No alias required for standalone project"';
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2), 'utf8');
    console.log('Updated package.json');
  }

  // 2. Update version.json
  const verPath = path.join(DEST_DIR, 'version.json');
  if (fs.existsSync(verPath)) {
    const ver = {
      version: '1.0.0',
      name: 'Budgewoi Discount Drug Stores Rosters',
      buildTime: new Date().toISOString()
    };
    fs.writeFileSync(verPath, JSON.stringify(ver, null, 2), 'utf8');
    console.log('Updated version.json');
  }

  // 3. Update vercel.json (set project name & clean up)
  const vercelPath = path.join(DEST_DIR, 'vercel.json');
  if (fs.existsSync(vercelPath)) {
    const vercelConfig = JSON.parse(fs.readFileSync(vercelPath, 'utf8'));
    // Ensure standard clean headers & rewrites
    fs.writeFileSync(vercelPath, JSON.stringify(vercelConfig, null, 2), 'utf8');
    console.log('Updated vercel.json');
  }

  console.log('\n========================================');
  console.log('Budgewoi standalone directory prepared at:');
  console.log(DEST_DIR);
  console.log('========================================');
}

prepareBudgewoi().catch(err => {
  console.error('Preparation failed:', err);
  process.exit(1);
});
