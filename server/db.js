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

  CREATE TABLE IF NOT EXISTS work_orders (
    id TEXT PRIMARY KEY,
    number INTEGER NOT NULL UNIQUE,
    title TEXT NOT NULL,
    motor_id TEXT DEFAULT '',
    destination_id TEXT DEFAULT '',
    destination_name TEXT DEFAULT '',
    equipment TEXT DEFAULT '',
    service_type TEXT DEFAULT 'Outros',
    request_date TEXT DEFAULT '',
    request_time TEXT DEFAULT '',
    requested_by TEXT DEFAULT '',
    note TEXT DEFAULT '',
    maintenance_start_date TEXT DEFAULT '',
    maintenance_start_time TEXT DEFAULT '',
    maintenance_end_date TEXT DEFAULT '',
    maintenance_end_time TEXT DEFAULT '',
    maintenance_professional TEXT DEFAULT '',
    maintenance_materials TEXT DEFAULT '',
    maintenance_note TEXT DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS work_order_items (
    id TEXT PRIMARY KEY,
    work_order_id TEXT NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
    variation_id TEXT NOT NULL,
    item_id TEXT NOT NULL,
    item_name TEXT DEFAULT '',
    item_group TEXT DEFAULT '',
    item_category TEXT DEFAULT '',
    item_unit TEXT DEFAULT '',
    variation_values TEXT DEFAULT '{}',
    qty REAL NOT NULL,
    movement_id TEXT DEFAULT '',
    added_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS motors (
    id TEXT PRIMARY KEY,
    tag TEXT NOT NULL UNIQUE,
    serial TEXT DEFAULT '',
    name TEXT DEFAULT '',
    manufacturer TEXT DEFAULT '',
    power TEXT DEFAULT '',
    voltage TEXT DEFAULT '',
    rpm TEXT DEFAULT '',
    destination_id TEXT DEFAULT '',
    destination_name TEXT DEFAULT '',
    status TEXT NOT NULL DEFAULT 'ativo' CHECK(status IN ('ativo','em_manutencao','reserva','inativo')),
    notes TEXT DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS motor_events (
    id TEXT PRIMARY KEY,
    motor_id TEXT NOT NULL REFERENCES motors(id) ON DELETE CASCADE,
    work_order_id TEXT DEFAULT '',
    event_type TEXT NOT NULL CHECK(event_type IN ('rebobinado','reformado','revisado','instalado','removido','movimentado','inativado','reativado','observacao')),
    event_date TEXT NOT NULL,
    from_destination TEXT DEFAULT '',
    to_destination TEXT DEFAULT '',
    performed_by TEXT DEFAULT '',
    notes TEXT DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
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

// Migration: add detailed OS fields if missing
const workOrderCols = db.prepare("PRAGMA table_info(work_orders)").all().map(c => c.name)
const workOrderMigrations = [
  ['motor_id', "ALTER TABLE work_orders ADD COLUMN motor_id TEXT DEFAULT ''"],
  ['equipment', "ALTER TABLE work_orders ADD COLUMN equipment TEXT DEFAULT ''"],
  ['service_type', "ALTER TABLE work_orders ADD COLUMN service_type TEXT DEFAULT 'Outros'"],
  ['request_date', "ALTER TABLE work_orders ADD COLUMN request_date TEXT DEFAULT ''"],
  ['request_time', "ALTER TABLE work_orders ADD COLUMN request_time TEXT DEFAULT ''"],
  ['maintenance_start_date', "ALTER TABLE work_orders ADD COLUMN maintenance_start_date TEXT DEFAULT ''"],
  ['maintenance_start_time', "ALTER TABLE work_orders ADD COLUMN maintenance_start_time TEXT DEFAULT ''"],
  ['maintenance_end_date', "ALTER TABLE work_orders ADD COLUMN maintenance_end_date TEXT DEFAULT ''"],
  ['maintenance_end_time', "ALTER TABLE work_orders ADD COLUMN maintenance_end_time TEXT DEFAULT ''"],
  ['maintenance_professional', "ALTER TABLE work_orders ADD COLUMN maintenance_professional TEXT DEFAULT ''"],
  ['maintenance_materials', "ALTER TABLE work_orders ADD COLUMN maintenance_materials TEXT DEFAULT ''"],
  ['maintenance_note', "ALTER TABLE work_orders ADD COLUMN maintenance_note TEXT DEFAULT ''"],
]

for (const [col, sql] of workOrderMigrations) {
  if (!workOrderCols.includes(col)) db.prepare(sql).run()
}

// Seed default admin if no users exist
import bcryptjs from 'bcryptjs'
const userCount = db.prepare('SELECT COUNT(*) as c FROM users').get().c
if (userCount === 0) {
  const hash = bcryptjs.hashSync('admin123', 10)
  db.prepare('INSERT INTO users (id, name, role, pin_hash) VALUES (?, ?, ?, ?)').run('user_admin', 'admin', 'admin', hash)
}

export default db
