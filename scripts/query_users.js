// scripts/query_users.js
// Usage:
//   PowerShell: $env:DATABASE_URL='postgresql://user:pw@host:5432/db?sslmode=require'; node scripts/query_users.js
//   Or: node scripts/query_users.js "postgresql://..." 

const { Client } = require('pg');
const conn = process.env.DATABASE_URL || process.argv[2];
if (!conn) {
  console.error('Provide DATABASE_URL via env or as first argument');
  process.exit(1);
}

(async () => {
  const client = new Client({ connectionString: conn, ssl: { rejectUnauthorized: false } });
  try {
    await client.connect();
    const res = await client.query('SELECT id, email, name FROM "User" ORDER BY "createdAt" DESC LIMIT 10');
    console.log(JSON.stringify(res.rows, null, 2));
  } catch (err) {
    console.error('ERROR:', err.message || err);
    process.exit(1);
  } finally {
    await client.end();
  }
})();
