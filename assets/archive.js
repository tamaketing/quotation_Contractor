/* ══════════════════════════════════════════════════════════════
   archive.js — บันทึกไฟล์ .json ลงโฟลเดอร์จริงบนเครื่องของผู้ใช้
   ใช้ร่วมกันทุกเอกสาร · ต้องรันบน https หรือ localhost เท่านั้น
   ══════════════════════════════════════════════════════════════ */
const ARCHIVE = (function () {

  const DB = 'quota_archive_db', STORE = 'handles';
  let dirHandle = null;
  let els = {};
  let timer = null, pending = null;

  /* ── IndexedDB (เก็บสิทธิ์เข้าถึงโฟลเดอร์ข้ามการเปิดหน้า) ── */
  function openDB() {
    return new Promise((res, rej) => {
      const q = indexedDB.open(DB, 1);
      q.onupgradeneeded = e => e.target.result.createObjectStore(STORE);
      q.onsuccess = e => res(e.target.result);
      q.onerror = e => rej(e.target.error);
    });
  }
  async function idbSet(k, v) {
    try {
      const db = await openDB();
      return new Promise((res, rej) => {
        const t = db.transaction(STORE, 'readwrite');
        t.objectStore(STORE).put(v, k);
        t.oncomplete = () => res();
        t.onerror = () => rej(t.error);
      });
    } catch { }
  }
  async function idbGet(k) {
    try {
      const db = await openDB();
      return new Promise((res) => {
        const t = db.transaction(STORE, 'readonly');
        const q = t.objectStore(STORE).get(k);
        q.onsuccess = () => res(q.result);
        q.onerror = () => res(null);
      });
    } catch { return null; }
  }

  /* ── สถานะบนหน้าจอ ── */
  function setStatus(msg) {
    if (!els.status) return;
    els.status.innerHTML = dirHandle
      ? 'โฟลเดอร์สำรอง: <b>' + esc(dirHandle.name || 'ที่เลือก') + '</b> — บันทึกลงดิสก์อัตโนมัติ'
      : (msg || 'ยังไม่ได้เลือกโฟลเดอร์สำรอง');
  }
  function setSaved(msg) {
    if (!els.saved) return;
    const t = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    els.saved.textContent = (msg ? msg + ' • ' : '') + t;
  }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  function init(opts) {
    els = { status: (opts && opts.status) || null, saved: (opts && opts.saved) || null };
    setStatus();
  }

  /* ── เขียนไฟล์ ── */
  /* โฟลเดอร์ตามปี — ใช้ปี พ.ศ. ให้ตรงกับวันที่บนเอกสาร */
  const BE = 543;
  function yearOf(data) {
    if (!data) return String(new Date().getFullYear() + BE);
    if (data.__year) return String(data.__year);
    const m = /^(\d{4})-\d{2}-\d{2}$/.exec(String(data.invDate || ''));   /* ISO ค.ศ. จาก <input type="date"> */
    if (m) return String(+m[1] + BE);
    return String(new Date().getFullYear() + BE);
  }
  function safeName(s) {
    return String(s || 'document').replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, ' ').trim().slice(0, 80) || 'document';
  }

  async function write(base, data) {
    if (!dirHandle) return false;
    try {
      const year = yearOf(data);
      const yh = await dirHandle.getDirectoryHandle(year, { create: true });
      const fh = await yh.getFileHandle(safeName(base) + '.json', { create: true });
      const w = await fh.createWritable();
      await w.write(JSON.stringify(data, null, 2));
      await w.close();
      return safeName(base) + '.json → ' + year + '/';
    } catch (e) { console.error(e); return false; }
  }

  /* เขียนแบบหน่วงเวลา ไม่ให้ยิงดิสก์ทุกครั้งที่พิมพ์ */
  function scheduleWrite(base, data) {
    pending = { base, data };
    clearTimeout(timer);
    timer = setTimeout(async () => {
      const p = pending; pending = null;
      if (!p) return;
      const res = await write(p.base, p.data);
      setSaved(res || null);
    }, 1200);
  }

  /* ── เลือกโฟลเดอร์ ── */
  function supported() { return !!window.showDirectoryPicker; }

  async function pick(getDoc) {
    if (!supported()) {
      alert('เบราว์เซอร์นี้ไม่รองรับการบันทึกลงโฟลเดอร์\n\n' +
        '· ใช้ Chrome หรือ Edge\n· ต้องเปิดผ่านลิงก์ https://… ไม่ใช่เปิดไฟล์ในเครื่อง\n\n' +
        'ถ้าใช้ไม่ได้ ให้กดปุ่ม Export เก็บไฟล์ .json ไว้ใน OneDrive แทน');
      return false;
    }
    try {
      dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
      const perm = await dirHandle.requestPermission({ mode: 'readwrite' });
      if (perm !== 'granted') throw new Error('ไม่ได้รับสิทธิ์เขียนโฟลเดอร์');
      await idbSet('dirHandle', dirHandle);
      setStatus();
      let res = false;
      const d = typeof getDoc === 'function' ? getDoc() : null;
      if (d) res = await write(d.base, d.data);
      setSaved(res);
      alert('ตั้งโฟลเดอร์สำรองเรียบร้อยแล้ว\n\nโฟลเดอร์: ' + (dirHandle.name || '') +
        '\nทุกครั้งที่แก้ไข ระบบจะเขียนไฟล์ .json ลงไปยังโฟลเดอร์นี้โดยอัตโนมัติ' +
        (res ? '\n\nบันทึกเอกสารปัจจุบันแล้ว: ' + res : ''));
      return true;
    } catch (e) {
      if (e && e.name === 'AbortError') return false;
      alert('ตั้งโฟลเดอร์ไม่สำเร็จ: ' + (e && e.message ? e.message : e));
      return false;
    }
  }

  /* คืนสิทธิ์เดิมเมื่อเปิดหน้าใหม่ (ใช้ได้ต่อเมื่อเบราว์เซอร์จำได้เอง) */
  async function restore() {
    const h = await idbGet('dirHandle');
    if (!h) { setStatus(); return false; }
    try {
      let p = await h.queryPermission({ mode: 'readwrite' });
      if (p === 'granted') { dirHandle = h; setStatus(); return true; }
    } catch { }
    setStatus();
    return false;
  }

  function has() { return !!dirHandle; }
  function folderName() { return dirHandle ? (dirHandle.name || '') : ''; }

  return { init, pick, restore, write, scheduleWrite, has, folderName, supported, setStatus, setSaved, yearOf, safeName };
})();