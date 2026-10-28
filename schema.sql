-- D1 schema for quotation contractor multi-tenant backend
-- Apply with: wrangler d1 execute <DB_NAME> --file=schema.sql

CREATE TABLE IF NOT EXISTS companies (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '',
  name_en TEXT DEFAULT '',
  branch TEXT DEFAULT '',
  tax_id TEXT DEFAULT '',
  address TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  email TEXT DEFAULT '',
  bank_info TEXT DEFAULT '',
  logo TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  company_id TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'owner',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_company ON users(company_id);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

CREATE TABLE IF NOT EXISTS quotations (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  quote_no TEXT NOT NULL DEFAULT '',
  data TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_quotations_company ON quotations(company_id);

CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  invoice_no TEXT NOT NULL DEFAULT '',
  data TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_invoices_company ON invoices(company_id);

CREATE TABLE IF NOT EXISTS receipts (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  receipt_no TEXT NOT NULL DEFAULT '',
  data TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_receipts_company ON receipts(company_id);

CREATE TABLE IF NOT EXISTS delivery_letters (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  letter_no TEXT NOT NULL DEFAULT '',
  data TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_delivery_letters_company ON delivery_letters(company_id);

CREATE TABLE IF NOT EXISTS doc_counters (
  company_id TEXT NOT NULL,
  prefix TEXT NOT NULL,
  year TEXT NOT NULL,
  seq INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (company_id, prefix, year),
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);