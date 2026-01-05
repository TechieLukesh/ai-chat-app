const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const migrationsDir = path.join(__dirname, '..', 'prisma', 'migrations');

function hasMigrations() {
  try {
    if (!fs.existsSync(migrationsDir)) return false;
    const items = fs.readdirSync(migrationsDir);
    return items.some((it) => fs.statSync(path.join(migrationsDir, it)).isDirectory());
  } catch (e) {
    return false;
  }
}

async function run() {
  const useMigrate = hasMigrations();
  const cmd = useMigrate ? 'npx prisma migrate deploy' : 'npx prisma db push';
  console.log('[prisma-init] Running:', cmd);
  try {
    execSync(cmd, { stdio: 'inherit' });
  } catch (err) {
    console.error('[prisma-init] Command failed:', err.message || err);
    process.exit(1);
  }
}

run();
