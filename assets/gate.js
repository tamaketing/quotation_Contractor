/* ══════════════════════════════════════════════════════════════
   gate.js — หน้าล็อกรหัสผ่านก่อนเข้าใช้งาน
   ⚠ เป็นการป้องกันระดับเบื้องต้น กันคนเผลอแชร์ลิงก์ต่อเท่านั้น
     ใครก็ตามที่เปิดหน้าเว็บนี้ได้ สามารถดู/แก้รหัสผ่านผ่าน DevTools ได้
     อย่าเก็บข้อมูลอะไรสำคัญไว้ในเครื่องที่คนอื่นใช้ร่วมกัน
   ══════════════════════════════════════════════════════════════ */
const GATE = (function () {

  /* 👇 เปลี่ยนรหัสผ่านเริ่มต้นตรงนี้ แล้ว commit ขึ้น GitHub ใหม่ */
  const DEFAULT_PASSWORD = 'primecess2569';

  const HKEY = 'quota_gate_hash';     /* sha-256 ของรหัสผ่านปัจจุบัน */
  const UKEY = 'quota_gate_unlocked'; /* ตัวล็อกปลดล็อกแล้ว (จบเมื่อปิดแท็บ) */

  /* hash แบบเบาๆ ใช้เมื่อเบราว์เซอร์ไม่มี crypto.subtle */
  function weakHash(str) {
    let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    for (let i = 0; i < str.length; i++) {
      const ch = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(14, '0');
  }

  async function hash(str) {
    try {
      if (window.crypto && crypto.subtle && crypto.subtle.digest) {
        const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('quota::' + str));
        return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
      }
    } catch (e) { /* ใช้ weakHash แทน */ }
    return 'w$' + weakHash(str);
  }

  /* ตั้งรหัสผ่านครั้งแรกเมื่อยังไม่มี hash ในเครื่อง */
  async function ensureHash() {
    let h = localStorage.getItem(HKEY);
    if (!h) {
      h = await hash(DEFAULT_PASSWORD);
      localStorage.setItem(HKEY, h);
      localStorage.setItem('quota_gate_is_default', '1');
    }
    return h;
  }

  function build() {
    const el = document.createElement('div');
    el.className = 'gate';
    el.id = 'gateEl';
    el.innerHTML =
      '<div class="gate-box">' +
      '<div class="g-icon">🔒</div>' +
      '<h2>ระบบเอกสารรับเหมา</h2>' +
      '<p class="sub">กรุณาใส่รหัสผ่านเพื่อเข้าใช้งาน</p>' +
      '<input type="password" id="gatePwd" placeholder="••••••••" autocomplete="current-password">' +
      '<button type="button" id="gateBtn">เข้าสู่ระบบ</button>' +
      '<div class="gate-err" id="gateErr"></div>' +
      '<div class="gate-hint">เอกสารที่ทำไว้จะถูกเก็บไว้ในเครื่องนี้<br>กรุณากดปุ่ม “บันทึก” เมื่อทำรายการเสร็จ</div>' +
      '</div>';
    document.body.appendChild(el);

    const pwd = el.querySelector('#gatePwd');
    const err = el.querySelector('#gateErr');

    async function tryUnlock() {
      const v = pwd.value;
      if (!v) { err.textContent = 'กรุณาใส่รหัสผ่าน'; return; }
      const h = await ensureHash();
      const ok = (await hash(v)) === h;
      if (!ok) {
        err.textContent = 'รหัสผ่านไม่ถูกต้อง';
        pwd.value = ''; pwd.focus();
        return;
      }
      sessionStorage.setItem(UKEY, '1');
      el.classList.add('hide');
      document.dispatchEvent(new CustomEvent('gate:passed'));
      /* หลังล็อกอินสำเร็จ ให้เข้าหน้าหลัก (เมนู) เสมอ */
      const p = (location.pathname || '/').replace(/\/+$/, '') || '/';
      if (p !== '/' && p !== '/index.html' && p !== '/index') {
        window.location.replace('/');
      }
    }

    el.querySelector('#gateBtn').addEventListener('click', tryUnlock);
    pwd.addEventListener('keydown', e => { if (e.key === 'Enter') tryUnlock(); });
    return el;
  }

  async function init() {
    if (sessionStorage.getItem(UKEY) === '1') return;   /* เข้าแล้วในแท็บนี้ */
    await ensureHash();
    const el = build();
    setTimeout(() => el.querySelector('#gatePwd').focus(), 60);
  }

  /* เรียกจากปุ่ม "เปลี่ยนรหัสผ่าน" ในหน้าตั้งค่า */
  async function changePassword(oldPwd, newPwd) {
    if (!newPwd || newPwd.length < 4) return { ok: false, msg: 'รหัสผ่านใหม่ต้องมีอย่างน้อย 4 ตัวอักษร' };
    const h = await ensureHash();
    if ((await hash(oldPwd || '')) !== h) return { ok: false, msg: 'รหัสผ่านเดิมไม่ถูกต้อง' };
    localStorage.setItem(HKEY, await hash(newPwd));
    localStorage.removeItem('quota_gate_is_default');
    return { ok: true, msg: 'เปลี่ยนรหัสผ่านเรียบร้อยแล้ว' };
  }

  /* ใช้ตอนลืมรหัสผ่าน: ล้าง hash ให้กลับไปใช้รหัสเริ่มต้นในไฟล์ */
  function resetToDefault() {
    localStorage.removeItem(HKEY);
    sessionStorage.removeItem(UKEY);
  }

  return { init, changePassword, resetToDefault, DEFAULT_PASSWORD };
})();