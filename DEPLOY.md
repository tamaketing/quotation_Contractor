# Deploy ขึ้น Cloudflare Pages

คู่มือนี้สำหรับโปรเจกต์ `app-quotation` ซึ่งเป็นเว็บ static ล้วน
(HTML + CSS + JS ไม่มี build step และไม่มีเซิร์ฟเวอร์)

> **สถานะปัจจุบัน:** โค้ดถูก push ขึ้น GitHub แล้วที่
> [github.com/tamaketing/quotation_Contractor](https://github.com/tamaketing/quotation_Contractor)
> branch `main` — เหลือขั้นตอน Cloudflare Pages ด้านล่าง

---

## 0. ก่อนเริ่ม

- สมัคร/เตรียมบัญชี **GitHub** และ **Cloudflare** (plan ฟรีพอ)
- **Export ข้อมูลเก่าเก็บไว้ก่อน** จากทุกหน้าที่เคยใช้งาน
  เพราะข้อมูลใน `localStorage` ผูกกับ URL เดิม — เปลี่ยน URL แล้วจะไม่เห็นข้อมูลเก่า
- เปลี่ยนรหัสผ่านเริ่มต้นใน `assets/gate.js` (`DEFAULT_PASSWORD`) ก่อน deploy
  เพราะรหัสผ่านนี้อยู่ในซอร์สโค้ด และเป็นเพียงการป้องกันเบื้องต้น
- ตรวจว่าโฟลเดอร์นี้ไม่มีข้อมูลลูกค้าจริงก่อน push
  (`.gitignore` กัน `invoices/`, `backup/`, `*.pdf`, `img/` ไว้แล้ว แต่ควรเช็กอีกครั้ง)
- ตรวจว่า `index.html` อยู่ที่ **root ของ repo** (ไม่ใช่ในโฟลเดอร์ย่อย)

---

## 1. ขึ้น GitHub

> ถ้าใช้ repo [tamaketing/quotation_Contractor](https://github.com/tamaketing/quotation_Contractor)
> ที่ push ไว้แล้ว ข้ามขั้นนี้ไปข้อ 2 ได้เลย

เปิด PowerShell ที่โฟลเดอร์โปรเจกต์

```powershell
cd D:\Qua_PRIMECESS\app-quotation

git config user.name "ชื่อที่ต้องการ"
git config user.email "อีเมลที่ผูกกับ GitHub"

git add -A
git commit -m "Initial commit: quotation / invoice / receipt / delivery letter"
```

ถ้ามี GitHub CLI และยังไม่ล็อกอิน

```powershell
gh auth login
gh repo create quotation_Contractor --private --source=. --remote=origin --push
```

ถ้าไม่มี GitHub CLI ให้สร้าง repo เปล่าบนเว็บ GitHub ชื่อ `quotation_Contractor` (เลือก **Private**)
แล้วรัน

```powershell
git remote add origin https://github.com/<ชื่อผู้ใช้>/quotation_Contractor.git
git branch -M main
git push -u origin main
```

> **แนะนำให้ repo เป็น Private** เพราะ `assets/gate.js` มีรหัสผ่านเริ่มต้นอยู่
> และรหัสผ่านหน้าเว็บเป็นเพียงการป้องกันเบื้องต้น ไม่ใช่ระบบล็อกอินจริง

---

## 2. สร้างโปรเจกต์บน Cloudflare Pages

1. เข้า [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. ไปที่ **Workers & Pages** → **Create application** → **Pages** → **Connect to Git**
3. เชื่อมต่อ GitHub และเลือก repo `quotation_Contractor`
4. ตั้งค่าตามนี้

| ช่อง | ค่า |
|---|---|
| Project name | `quotation-contractor` (หรือชื่อที่ยังไม่ถูกใช้) |
| Production branch | `main` |
| Framework preset | **None** |
| Build command | `exit 0` |
| Build output directory | `/` |
| Environment variables | ไม่ต้องใส่ |

5. กด **Save and deploy**
6. รอ build เสร็จ จะได้ URL ประมาณ `https://quotation-contractor.pages.dev`

> **ตั้งชื่อ project ให้เสร็จก่อนใช้งานจริง** เพราะ URL จะติดไปกับ `localStorage`
> ถ้าเปลี่ยนชื่อ project ภายหลัง ข้อมูลเดิมจะไม่ปรากฏ (ต้อง export/import)
> ถ้าจะใช้ระยะยาว แนะนำผูกโดเมนของตัวเองตั้งแต่ต้น

> ไฟล์ `_headers`, `robots.txt`, `404.html` อยู่ใน root แล้ว
> Cloudflare Pages จะอ่านและใช้งานให้อัตโนมัติ

---

## 3. ตรวจหลัง deploy

เปิด URL ที่ได้ แล้วตรวจตามนี้

- [ ] หน้าแรกโหลดได้ และใส่รหัสผ่านเข้าได้
- [ ] สร้างใบเสนอราคาใหม่ → เลขขึ้น `PCC-2569-xxx`
- [ ] สร้างใบแจ้งหนี้ใหม่ → เลขขึ้น `INV-2569-xxx`
- [ ] สร้างใบเสร็จใหม่ → เลขขึ้น `RC-2569-xxx`
- [ ] ปุ่ม **โฟลเดอร์สำรอง** ใช้งานได้ (ต้องเป็น HTTPS)
- [ ] พิมพ์ / PDF ยังทำงานปกติ
- [ ] เปิด `https://<project>.pages.dev/robots.txt` เห็น `Disallow: /`
- [ ] เปิด `https://<project>.pages.dev/หน้าที่ไม่มีอยู่` เห็นหน้า 404 ของเรา

ตรวจ header ได้ด้วย PowerShell

```powershell
curl.exe -I https://quotation-contractor.pages.dev/index.html
```

ควรเห็น `cache-control: no-store` และ `x-robots-tag: noindex, nofollow`

---

## 4. ผูกโดเมนจริง (ถ้าต้องการ)

1. ในโปรเจกต์ Pages → **Custom domains** → **Set up a domain**
2. ใส่โดเมน เช่น `docs.example.com`
3. ถ้าโดเมนอยู่บน Cloudflare อยู่แล้ว ระบบจะสร้าง DNS record ให้อัตโนมัติ
4. ถ้าโดเมนอยู่นอก Cloudflare ให้ไปสร้าง `CNAME` ชี้ไปที่ `<project>.pages.dev`

**สำคัญ:** ถ้าใช้ Cloudflare เป็น DNS ด้วย ให้ตั้ง SSL/TLS เป็น **Full (strict)**
และ **ห้ามใช้ Flexible** เพราะอาจเกิด redirect loop

ถ้าเปิดใช้โดเมนผ่าน Cloudflare proxy:
- ปิด **Rocket Loader** (อาจทำให้ inline script ของแอปทำงานผิด)
- ปิด **Auto Minify** สำหรับ JS ถ้าเจอปัญหา
- หลัง deploy เวอร์ชันใหม่ ให้ purge cache ถ้าเปิด Cache Rule ไว้

---

## 5. อัปเดตเว็บในอนาคต

แก้ไฟล์ในเครื่อง → commit → push

```powershell
git add -A
git commit -m "update ..."
git push
```

Cloudflare Pages จะ build และ deploy ใหม่อัตโนมัติ

ถ้าต้องการย้อนเวอร์ชัน:
**Pages → โปรเจกต์ → Deployments → เลือก deployment เก่า → Rollback**

---

## 6. ย้ายข้อมูลจาก URL เดิม

1. เปิดเว็บ URL เดิม → กด **ส่งออกทั้งหมด** ในแต่ละหน้า (หรือ Export รายใบ)
2. เก็บไฟล์ `.zip` / `.json` ไว้
3. เปิดเว็บ URL ใหม่ → กด **นำเข้า** ไฟล์เหล่านั้น
4. ไปที่ **โฟลเดอร์สำรอง** แล้วเลือกโฟลเดอร์ OneDrive/Google Drive อีกครั้ง
   (เบราว์เซอร์จะถามสิทธิ์ใหม่)
5. ตรวจเลขที่เอกสาร: ระบบจะ scan เลขสูงสุดจากไฟล์ที่ import และเดินต่อให้เอง

> ตัวนับเลขที่ (`docnum_v1_*`) เก็บใน `localStorage` ของ origin ใหม่
> แต่การ import เอกสารจะทำให้ระบบเห็นเลขสูงสุดและไม่สร้างเลขซ้ำ

---

## 7. ตัวเลือกเสริม: Cloudflare Access

ถ้าจะแชร์ให้ทีมหรือลูกค้า และต้องการล็อกอินจริง (ไม่ใช่รหัสผ่านใน `gate.js`):

1. Cloudflare Dashboard → **Zero Trust** → **Access** → **Applications**
2. เพิ่ม Self-hosted application ชี้ไปที่โดเมนของเว็บ
3. ตั้ง policy ให้เฉพาะอีเมล/โดเมนที่อนุญาต
4. เปิดใช้ฟรีได้ถึง 50 ผู้ใช้

> เมื่อเปิด Access แล้ว ผู้ใช้จะต้องยืนยันอีเมลก่อนเห็นหน้าเว็บ
> เหมาะกับเว็บที่มีข้อมูลลูกค้าหรือเอกสารจริง

---

## 8. ทางเลือก: อัปโหลดตรงด้วย Wrangler (ไม่ผ่าน GitHub)

ถ้าไม่อยากใช้ GitHub สามารถ deploy จากเครื่องได้

```powershell
npx wrangler login
npx wrangler pages deploy . --project-name app-quotation
```

ข้อควรระวัง:
- วิธีนี้จะอัปโหลดไฟล์ในโฟลเดอร์ปัจจุบัน รวมถึงไฟล์ที่ไม่ต้องการ (ถ้ามี)
- ควรใช้ Git integration จะปลอดภัยและย้อนเวอร์ชันง่ายกว่า

---

## Troubleshooting

| อาการ | ตรวจ |
|---|---|
| เปิดหน้าแล้ว 404 | ไฟล์ HTML ต้องอยู่ root และ Build output = `/` |
| แก้โค้ดแล้วเว็บยังเก่า | ดู `_headers` / purge cache / hard refresh |
| ปุ่มโฟลเดอร์สำรองไม่ทำงาน | ต้องเปิดผ่าน `https://` ไม่ใช่ `file://` |
| ฟอนต์หรือ JSZip ไม่โหลด | ต้องต่ออินเทอร์เน็ต (โหลดจาก Google Fonts / jsDelivr) |
| เลขที่เอกสารเริ่มไม่ตรง | Export ข้อมูลเดิมมาดู แล้วอย่าลบ `docnum_v1_*` ใน localStorage |
| ขึ้น Too many redirects | ตั้ง SSL/TLS เป็น Full (strict) ไม่ใช่ Flexible |
