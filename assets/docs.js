/* ══════════════════════════════════════════════════════════════
   docs.js — แผงจัดการเอกสาร (เก็บแยกเป็นรายใบ)
   ใช้โดย: ใบเสนอราคา · ใบเสร็จรับเงิน  ·  (ใบแจ้งหนี้มีแผงของตัวเองอยู่แล้ว)
   ══════════════════════════════════════════════════════════════ */
const DOCS = (function () {

  function mount(opt) {
    const host = opt.mountEl;
    const KEY = opt.key, CUR = opt.curKey;

    /* ── panel ── */
    const panel = document.createElement('div');
    panel.className = 'docs';
    panel.innerHTML =
      '<div class="docs-hd">' +
      '<b>📁 ' + opt.title + 'ที่ทำไว้ (<span class="cnt">0</span>)</b>' +
      '<input class="docs-search" placeholder="ค้นหาเลขที่ / ลูกค้า / โครงการ...">' +
      '<div class="sp">' +
      '<button type="button" class="x-btn" data-a="new">+ ใบใหม่</button>' +
      '<button type="button" class="x-btn" data-a="dup">ทำซ้ำ</button>' +
      '<button type="button" class="x-btn" data-a="zip">ส่งออกทั้งหมด</button>' +
      '<button type="button" class="x-btn danger" data-a="del">ลบใบนี้</button>' +
      '</div></div>' +
      '<div class="docs-list"></div>' +
      (opt.archive ? '<div class="arc">' +
        '<span class="arc-st"></span>' +
        '<span class="arc-lasted"></span>' +
        '<button type="button" class="x-btn" data-a="arc">📁 โฟลเดอร์สำรอง</button>' +
        '</div>' : '') +
      '</div>';
    host.parentNode.insertBefore(panel, host);

    /* ── state ── */
    let list = [];
    let curId = null;

    function loadList() {
      try { const p = JSON.parse(localStorage.getItem(KEY) || '[]'); list = Array.isArray(p) ? p : []; } catch { list = []; }
      curId = localStorage.getItem(CUR);
      if (curId && !list.find(x => x.id === curId)) curId = null;
      if (!curId && list.length) curId = list[0].id;
    }
    function persist() {
      localStorage.setItem(KEY, JSON.stringify(list));
      if (curId) localStorage.setItem(CUR, curId);
      render();
    }
    function cur() { return list.find(x => x.id === curId) || null; }

    /* ── save ── */
    let timer = null;
    function save(silent) {
      const data = opt.collect();
      const now = Date.now();
      let rec = cur();
      if (!rec) {
        rec = { id: 'd' + now.toString(36) + Math.random().toString(36).slice(2, 5), updatedAt: now, data };
        list.unshift(rec); curId = rec.id;
      } else {
        rec.data = data; rec.updatedAt = now;
        list = list.filter(x => x.id !== curId); list.unshift(rec);
      }
      persist();
      if (typeof opt.onSaved === 'function') opt.onSaved(rec);
    }
    function scheduleSave() {
      clearTimeout(timer);
      timer = setTimeout(() => save(true), 700);
    }

    /* ── render ── */
    function render() {
      const box = panel.querySelector('.docs-list');
      panel.querySelector('.cnt').textContent = list.length;
      const q = (panel.querySelector('.docs-search').value || '').toLowerCase().trim();
      let show = list;
      if (q) show = list.filter(r => {
        const d = r.data, s = opt.searchText(r).toLowerCase();
        return s.includes(q);
      });
      if (!show.length) {
        box.innerHTML = '<div class="docs-empty">' + (list.length ? 'ไม่พบเอกสารที่ค้นหา' : 'ยังไม่มีเอกสาร — กด “+ ใบใหม่” เพื่อเริ่ม') + '</div>';
        return;
      }
      box.innerHTML = show.map(r => {
        const s = opt.summary(r);
        const act = r.id === curId;
        return '<div class="doc-row' + (act ? ' active' : '') + '" data-id="' + r.id + '">' +
          '<div class="d-info"><b>' + esc(s.no) + (act ? ' · กำลังแก้ไข' : '') + '</b>' +
          '<small>' + esc(s.meta) + '</small></div>' +
          '<div class="d-amt">' + THAI.fmt(s.total) + '</div>' +
          '<div class="d-act"><button type="button" data-o="open">เปิด</button>' +
          '<button type="button" class="d" data-o="del">ลบ</button></div>' +
          '</div>';
      }).join('');
    }
    function esc(s) { return String(s == null ? '' : s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])); }

    /* ── actions ── */
    function open(id) {
      const rec = list.find(x => x.id === id);
      if (!rec) return;
      if (curId && curId !== id) save(true);
      curId = id;
      localStorage.setItem(CUR, id);
      opt.load(rec.data);
      render();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    function del(id) {
      const rec = list.find(x => x.id === id);
      if (!rec) return;
      if (!confirm('ลบ ' + opt.summary(rec).no + ' ?\nการกระทำนี้ย้อนกลับไม่ได้')) return;
      list = list.filter(x => x.id !== id);
      if (curId === id) {
        curId = null;
        if (list.length) { curId = list[0].id; opt.load(list[0].data); }
        else opt.load(opt.blank());
      }
      persist();
    }
    function newDoc() {
      if (cur()) save(true);
      const d = opt.blank();
      const rec = { id: 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 4), updatedAt: Date.now(), data: d };
      list.unshift(rec); curId = rec.id;
      persist(); opt.load(d);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    function dup() {
      const c = cur();
      if (!c) return alert('ยังไม่มีใบให้ทำซ้ำ');
      const d = JSON.parse(JSON.stringify(c.data));
      const n = opt.nextNo ? opt.nextNo(d) : null;
      if (n) opt.setNo(d, n);
      const rec = { id: 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 4), updatedAt: Date.now(), data: d };
      list.unshift(rec); curId = rec.id;
      persist(); opt.load(d);
    }
    async function zip() {
      if (!list.length) return alert('ยังไม่มีเอกสารให้ส่งออก');
      if (!window.JSZip) return alert('ยังโหลดไลบรารี ZIP ไม่สำเร็จ (ต้องต่อเน็ตครั้งแรก)');
      const zip = new JSZip();
      const byYear = {};
      list.forEach(r => {
        const y = (r.data.__year) || new Date(r.updatedAt).getFullYear().toString();
        (byYear[y] = byYear[y] || []).push(r);
      });
      Object.keys(byYear).forEach(y => {
        const f = zip.folder(y);
        byYear[y].forEach(r => {
          const o = Object.assign({}, r.data); delete o.__year;
          f.file(safeName(opt.summary(r).no) + '.json', JSON.stringify(o, null, 2));
        });
      });
      zip.file('README.txt', 'ส่งออก: ' + new Date().toLocaleString('th-TH') + '\nจำนวน: ' + list.length + ' ฉบับ\n');
      const blob = await zip.generateAsync({ type: 'blob' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = opt.title.replace(/\s+/g, '') + '_' + new Date().toISOString().slice(0, 10) + '.zip';
      a.click();
    }
    function safeName(s) { return String(s || 'doc').replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, ' ').trim().slice(0, 80); }

    /* ── events ── */
    panel.querySelector('.docs-search').addEventListener('input', render);
    panel.querySelector('.docs-hd .sp').addEventListener('click', e => {
      const a = e.target.dataset.a;
      if (a === 'new') newDoc();
      if (a === 'dup') dup();
      if (a === 'zip') zip();
      if (a === 'del' && curId) del(curId);
      if (a === 'arc' && typeof opt.archive === 'function') opt.archive();
    });
    panel.querySelector('.docs-list').addEventListener('click', e => {
      const row = e.target.closest('.doc-row');
      if (!row) return;
      const id = row.dataset.id;
      if (e.target.dataset.o === 'del') del(id);
      else open(id);
    });

    /* ── init ── */
    loadList();
    if (list.length) { curId = curId || list[0].id; localStorage.setItem(CUR, curId); opt.load(cur().data); }
    else { const d = opt.blank(); const rec = { id: 'd' + Date.now().toString(36), updatedAt: Date.now(), data: d }; list = [rec]; curId = rec.id; persist(); opt.load(d); }
    render();

    /* เพิ่มเอกสารจากภายนอก (ใช้ตอน Import JSON) */
    function _push(rec) {
      list = list.filter(x => JSON.stringify(x.data) !== JSON.stringify(rec.data));
      list.unshift(rec);
      localStorage.setItem(CUR, rec.id);
      curId = rec.id;
      persist();
      return rec;
    }

    return { save, scheduleSave, persist, render, list: () => list, currentId: () => curId, panel, _push };
  }

  return { mount };
})();