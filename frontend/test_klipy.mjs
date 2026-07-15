import db from 'better-sqlite3';
const sqlite = db('d:/Vsocial/database.sqlite');
const row = sqlite.prepare("SELECT value FROM system_settings WHERE key = 'klipy_api_key'").get();
import('klipy-js').then(async m => {
  const client = new m.KlipyClient({ apiKey: row.value });
  const res = await client.gifs.trending({ limit: 1 });
  console.log(JSON.stringify(res.data[0], null, 2));
}).catch(console.error);
