import initSqlJs from 'sql.js';
import fs from 'fs';

const DB_FILE = fs.existsSync('database.db') ? 'database.db' : (fs.existsSync('bot.db') ? 'bot.db' : 'database.db');

const SQL = await initSqlJs();
let fileBuffer = null;
if (fs.existsSync(DB_FILE)) {
  fileBuffer = fs.readFileSync(DB_FILE);
}
const rawDb = fileBuffer ? new SQL.Database(fileBuffer) : new SQL.Database();

function persist() {
  const data = rawDb.export();
  fs.writeFileSync(DB_FILE, Buffer.from(data));
}

const db = {
  prepare(sql) {
    return {
      get(...params) {
        const stmt = rawDb.prepare(sql);
        stmt.bind(params);
        let row = null;
        if (stmt.step()) {
          row = stmt.getAsObject();
        }
        stmt.free();
        return row;
      },
      all(...params) {
        const stmt = rawDb.prepare(sql);
        stmt.bind(params);
        const rows = [];
        while (stmt.step()) {
          rows.push(stmt.getAsObject());
        }
        stmt.free();
        return rows;
      },
      run(...params) {
        rawDb.run(sql, params);
        persist();
        const lastId = rawDb.exec("SELECT last_insert_rowid() AS id")[0]?.values[0][0] || null;
        return { lastInsertRowid: lastId };
      }
    };
  },
  exec(sql) {
    rawDb.exec(sql);
    persist();
  }
};

export function isAdmin(userId) {
  const row = db.prepare('SELECT user_id FROM admins WHERE user_id = ?').get(userId);
  return !!row;
}

export function isBanned(userId) {
  const row = db.prepare('SELECT banned FROM users WHERE id = ?').get(userId);
  return row ? Boolean(row.banned) : false;
}

export default db;


// Auto create required tables if they don't exist
rawDb.run(`
  CREATE TABLE IF NOT EXISTS users (
    user_id INTEGER PRIMARY KEY,
    first_name TEXT,
    username TEXT,
    balance REAL DEFAULT 0,
    role TEXT DEFAULT 'user',
    banned INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS admins (
    user_id INTEGER PRIMARY KEY,
    role TEXT DEFAULT 'admin'
  );

  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    price REAL,
    duration TEXT,
    status TEXT DEFAULT 'on'
  );

  CREATE TABLE IF NOT EXISTS keys (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_name TEXT,
    duration TEXT,
    key_value TEXT UNIQUE,
    status TEXT DEFAULT 'unused'
  );

  CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    amount REAL,
    method TEXT,
    trx_id TEXT,
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS payment_methods (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    number TEXT,
    status TEXT DEFAULT 'on'
  );

  CREATE TABLE IF NOT EXISTS redeem_codes (
    code TEXT PRIMARY KEY,
    amount REAL,
    max_uses INTEGER DEFAULT 1,
    used_count INTEGER DEFAULT 0,
    expiry DATETIME
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );
`);
persist();

rawDb.run(`
  DROP TABLE IF EXISTS users;
  CREATE TABLE users (
    id INTEGER PRIMARY KEY,
    user_id INTEGER,
    first_name TEXT,
    username TEXT,
    balance REAL DEFAULT 0,
    role TEXT DEFAULT 'user',
    banned INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);
persist();