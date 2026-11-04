-- ทะเบียนลูกค้า (Customers)
-- ไม่จำเป็นต้องรันเอง: ระบบจะสร้างตารางให้อัตโนมัติเมื่อมี request ที่ต้องใช้ (ensureAuthSchema)
-- ถ้าต้องการรันด้วยมือ: wrangler d1 execute quotation_db --remote --file=migrations/2026-11-04-customers.sql

CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  address TEXT DEFAULT '',
  tax_id TEXT DEFAULT '',
  contact TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  email TEXT DEFAULT '',
  project TEXT DEFAULT '',
  note TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_customers_company ON customers(company_id);
