# ระบบสมาชิก (Login / Logout / ลืมรหัสผ่าน)

อัปเดต: 4 พ.ย. 2026

## ฟีเจอร์

| ฟีเจอร์ | หน้า | API |
|---|---|---|
| สมัครสมาชิก | `/` → แท็บ “สมัครสมาชิก” | `POST /api/auth/register` |
| เข้าสู่ระบบ | `/` → แท็บ “เข้าสู่ระบบ” | `POST /api/auth/login` |
| ออกจากระบบ | ปุ่ม “ออกจากระบบ” (หน้าแรก + ทุกหน้าเอกสาร) | ล้าง token ฝั่ง client |
| ลืมรหัสผ่าน | `/` → “ลืมรหัสผ่าน?” | `POST /api/auth/forgot` |
| ตั้งรหัสผ่านใหม่ | `/reset-password?token=...` | `POST /api/auth/reset` |
| เปลี่ยนรหัสผ่าน (ล็อกอินอยู่) | ⚙ ข้อมูลบริษัท → เปลี่ยนรหัสผ่าน | `POST /api/auth/change-password` |

---

## 1. อัปเดตฐานข้อมูล

ระบบจะสร้าง/อัปเดตตารางให้อัตโนมัติเมื่อมีคำขอเข้าสู่ระบบครั้งแรกหลัง deploy
(`ensureAuthSchema` ใน `functions/_utils.js`) — ไม่ต้องรัน migration ก็ใช้งานได้

ถ้าต้องการรันเอง (แนะนำ เพราะเห็นผลชัดเจน):

```powershell
cd D:\Qua_PRIMECESS\app-quotation
npx wrangler login
npx wrangler d1 execute quotation_db --remote --file=migrations/2026-11-04-auth-membership.sql
```

หรือรัน SQL นี้ใน **Cloudflare Dashboard → D1 → quotation_db → Console**:

```sql
ALTER TABLE users ADD COLUMN token_version INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS password_resets (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  used INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_password_resets_user ON password_resets(user_id);
```

> ถ้าคอลัมน์ `token_version` มีอยู่แล้ว คำสั่ง `ALTER TABLE` จะ error — ข้ามไปสร้างตารางได้เลย

---

## 2. ตั้งค่าการส่งอีเมล (สำหรับ “ลืมรหัสผ่าน”)

ระบบใช้ [Resend](https://resend.com) ส่งลิงก์รีเซ็ต (ฟรี 100 อีเมล/วัน)

1. สมัคร Resend แล้วสร้าง **API Key**
2. เพิ่ม Environment Variables ใน Cloudflare Pages → Settings → Environment variables (Production):

| ชื่อ | ตัวอย่าง | จำเป็น |
|---|---|---|
| `JWT_SECRET` | สตริงสุ่มยาว ๆ (เช่น 64 ตัวอักษร) | ✅ ควรตั้งใน production |
| `RESEND_API_KEY` | `re_xxxxxxxx` | ✅ สำหรับส่งอีเมล |
| `MAIL_FROM` | `ระบบเอกสาร <no-reply@yourdomain.com>` | แนะนำ |
| `APP_ORIGIN` | `https://quotation-contractor.pages.dev` | แนะนำ |
| `AUTH_DEBUG` | `1` | ❌ เฉพาะทดสอบ (ห้ามเปิด production) |

> **หมายเหตุ:** ถ้าใช้โดเมน `onboarding@resend.dev` จะส่งได้เฉพาะอีเมลเจ้าของบัญชี Resend เท่านั้น
> การส่งถึงผู้ใช้ทั่วไปต้อง **verify domain** ของคุณใน Resend ก่อน

### ถ้ายังไม่ตั้งค่าอีเมล

- หน้า “ลืมรหัสผ่าน” จะแจ้งให้ติดต่อผู้ดูแลระบบ (ไม่ส่งลิงก์)
- สำหรับทดสอบ: ตั้ง `AUTH_DEBUG=1` ระบบจะแสดงลิงก์รีเซ็ตบนหน้าจอโดยตรง

---

## 3. ความปลอดภัย

- เก็บเฉพาะ **SHA-256 ของ token** ในตาราง `password_resets` — ฐานข้อมูลรั่วก็ใช้ token ไม่ได้
- ลิงก์มีอายุ **30 นาที** และใช้ได้ครั้งเดียว
- จำกัด **3 คำขอ / 15 นาที** ต่อบัญชี
- ตอบข้อความกลาง ๆ เสมอ → ไม่เปิดเผยว่าอีเมลมีในระบบหรือไม่
- เปลี่ยน/รีเซ็ตรหัสผ่าน → เพิ่ม `token_version` ทำให้ **token ล็อกอินเก่าใช้ไม่ได้ทั้งหมด**
- `/reset-password` ตั้ง `noindex, nofollow`

---

## 4. ทดสอบ

1. สมัครสมาชิกใหม่ที่ `/` → ต้องเข้าใช้งานได้ทันที
2. ออกจากระบบ → กลับหน้า login
3. ล็อกอินด้วยอีเมล/รหัสเดิม → ได้
4. กด “ลืมรหัสผ่าน?” → กรอกอีเมล
   - มี `RESEND_API_KEY` → ตรวจอีเมล
   - ไม่มี + `AUTH_DEBUG=1` → มีลิงก์บนหน้าจอ
5. เปิดลิงก์ → ตั้งรหัสใหม่ → ล็อกอินด้วยรหัสใหม่
6. รหัสเดิมต้องใช้ไม่ได้ และ session เก่าต้องถูกบังคับให้ล็อกอินใหม่
