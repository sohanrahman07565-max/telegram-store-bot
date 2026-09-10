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
