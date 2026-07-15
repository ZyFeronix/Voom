import { createClient } from '@libsql/client';
import fs from 'fs';

const DB_URL = process.env.DB_URL || 'file:d:/Vsocial/vsocial.db';

async function runCleanup() {
  const rawClient = createClient({ url: DB_URL });
  const sql = fs.readFileSync('C:/Users/HardLight/.gemini/antigravity/brain/f8b9746d-9b5f-40ff-9e32-de428b4b57b0/scratch/cleanup_legacy_db.sql', 'utf8');
  
  // split and execute each command
  const statements = sql.split(';').map(s => s.trim()).filter(s => s.length > 0);
  for (const statement of statements) {
    await rawClient.execute(statement);
  }
  console.log('Legacy tables dropped.');
}

runCleanup().catch(console.error);
