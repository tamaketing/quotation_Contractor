-- ─────────────────────────────────────────────────────────────
-- Migration: ระบบสมาชิก (login / logout / forgot password)
-- ใช้กับฐานข้อมูลที่มีอยู่แล้ว (schema.sql เวอร์ชันก่อนหน้า)
--
-- วิธีรัน (ต้องล็อกอิน wrangler ก่อน: npx wrangler login)
--   npx wrangler d1 execute quotation_db --remote --file=migrations/2026-11-04-auth-membership.sql
--
-- หรือรันทีละคำสั่งใน Cloudflare Dashboard → D1 → quotation_db → Console
-- ─────────────────────────────────────────────────────────────

-- 1) token_version ใช้ยกเลิก token เก่าทั้งหมดเมื่อเปลี่ยน/รีเซ็ตรหัสผ่าน
ALTER TABLE users ADD COLUMN token_version INTEGER NOT NULL DEFAULT 0;

-- 2) ตารางรีเซ็ตรหัสผ่าน (เก็บเฉพาะ SHA-256 ของ token ไม่เก็บตัว token จริง)
CREATE TABLE IF NOT EXISTS password_resets (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  used INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_password_resets_user ON password_resets(user_id);
