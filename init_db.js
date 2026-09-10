import db from './database.js';

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    username TEXT,
    first_name TEXT,
    balance INTEGER DEFAULT 0,
    banned INTEGER DEFAULT 0,
    join_date TEXT,
    ref_by INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS admins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER UNIQUE,
    role TEXT DEFAULT 'normal',
    added_by INTEGER,
    created_at TEXT
  );

  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    duration TEXT,
    price INTEGER,
    status TEXT DEFAULT 'on'
  );

  CREATE TABLE IF NOT EXISTS keys (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product TEXT,
    duration TEXT,
    key TEXT UNIQUE,
    status TEXT DEFAULT 'unused',
    buyer_id INTEGER,
    used_at TEXT,
    expire_at TEXT
  );

  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user INTEGER,
    product TEXT,
    duration TEXT,
    amount INTEGER,
    key TEXT,
    status TEXT,
    purchase_date TEXT,
    expire_date TEXT,
    order_no TEXT,
    product_id INTEGER,
    key_id INTEGER,
    payment_id INTEGER,
    transaction_id TEXT,
    delivery_status TEXT DEFAULT 'pending',
    replaced INTEGER DEFAULT 0,
    replaced_key_id INTEGER,
    admin_id INTEGER,
    note TEXT,
    created_at TEXT,
    completed_at TEXT
  );

  CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user INTEGER,
    amount INTEGER,
    method TEXT,
    trxid TEXT,
    screenshot TEXT,
    status TEXT DEFAULT 'pending',
    date TEXT
  );

  CREATE TABLE IF NOT EXISTS payment_methods (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE,
    number TEXT,
    status INTEGER DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS contacts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT,
    display_name TEXT,
    username TEXT,
    status INTEGER DEFAULT 1,
    created_at TEXT
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );

  CREATE TABLE IF NOT EXISTS redeem (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE,
    amount INTEGER,
    limit_count INTEGER DEFAULT 1,
    used_count INTEGER DEFAULT 0,
    per_user INTEGER DEFAULT 1,
    expire_at TEXT,
    status INTEGER DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS redeem_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    redeem_id INTEGER,
    user_id INTEGER,
    code TEXT,
    amount INTEGER,
    used_at TEXT
  );

  CREATE TABLE IF NOT EXISTS logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    admin_id INTEGER,
    action TEXT,
    details TEXT,
    date TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS broadcast_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    admin_id INTEGER,
    media_type TEXT,
    content TEXT,
    caption TEXT,
    total INTEGER DEFAULT 0,
    processed INTEGER DEFAULT 0,
    success INTEGER DEFAULT 0,
    failed INTEGER DEFAULT 0,
    stopped INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
`);

console.log("✅ All Database Tables Created Successfully!");
