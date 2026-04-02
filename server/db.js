import Database from 'better-sqlite3'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DB_PATH = join(__dirname, 'estoque.db')

const db = new Database(DB_PATH)

// Enable WAL mode for better concurrency
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

// ===== Schema =====
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    role TEXT NOT NULL CHECK(role IN ('admin','operador','visitante')),
    pin_hash TEXT NOT NULL,
    active INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS items (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    group_name TEXT NOT NULL,
    category TEXT,
    subcategory TEXT,
    unit TEXT NOT NULL DEFAULT 'UN',
    min_stock REAL NOT NULL DEFAULT 0,
    attributes TEXT NOT NULL DEFAULT '[]',
    location TEXT DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS variations (
    id TEXT PRIMARY KEY,
    item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    vals TEXT NOT NULL DEFAULT '{}',
    stock REAL NOT NULL DEFAULT 0,
    min_stock REAL NOT NULL DEFAULT 0,
    initial_stock REAL NOT NULL DEFAULT 0,
    extras TEXT NOT NULL DEFAULT '{}',
    location TEXT DEFAULT '',
    destinations TEXT NOT NULL DEFAULT '[]'
  );

  CREATE TABLE IF NOT EXISTS movements (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL CHECK(type IN ('entrada','saida')),
    variation_id TEXT NOT NULL,
    item_id TEXT NOT NULL,
    item_name TEXT,
    item_group TEXT,
    item_category TEXT,
    item_subcategory TEXT,
    item_unit TEXT,
    variation_values TEXT DEFAULT '{}',
    variation_extras TEXT DEFAULT '{}',
    qty REAL NOT NULL,
    stock_before REAL NOT NULL DEFAULT 0,
    stock_after REAL NOT NULL DEFAULT 0,
    date TEXT NOT NULL,
    supplier TEXT DEFAULT '',
    requested_by TEXT DEFAULT '',
    destination TEXT DEFAULT '',
    doc_ref TEXT DEFAULT '',
    note TEXT DEFAULT '',
    operator_id TEXT DEFAULT '',
    operator_name TEXT DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS locations (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    active INTEGER NOT NULL DEFAULT 1,
    parent_id TEXT REFERENCES locations(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS destinations (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    active INTEGER NOT NULL DEFAULT 1,
    parent_id TEXT REFERENCES destinations(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS people (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    role_text TEXT DEFAULT '',
    active INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS roles (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT DEFAULT '',
    active INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS display_order (
    id INTEGER PRIMARY KEY CHECK(id = 1),
    data TEXT NOT NULL DEFAULT '{}'
  );
`)

// Ensure display_order row exists
db.prepare(`INSERT OR IGNORE INTO display_order (id, data) VALUES (1, '{}')`).run()

// Migration: add operator columns to movements if missing
const movCols = db.prepare("PRAGMA table_info(movements)").all().map(c => c.name)
if (!movCols.includes('operator_id')) {
  db.prepare("ALTER TABLE movements ADD COLUMN operator_id TEXT DEFAULT ''").run()
  db.prepare("ALTER TABLE movements ADD COLUMN operator_name TEXT DEFAULT ''").run()
}

// Seed default admin if no users exist
import bcryptjs from 'bcryptjs'
const userCount = db.prepare('SELECT COUNT(*) as c FROM users').get().c
if (userCount === 0) {
  const hash = bcryptjs.hashSync('admin123', 10)
  db.prepare('INSERT INTO users (id, name, role, pin_hash) VALUES (?, ?, ?, ?)').run('user_admin', 'admin', 'admin', hash)
}

export default db
