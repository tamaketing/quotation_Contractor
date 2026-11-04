/* ══════════════════════════════════════════════════════════════
   docs-api.js — แผงจัดการเอกสาร (เก็บบน Cloud D1 ผ่าน API)
   ใช้โดย: ใบเสนอราคา · ใบเสร็จรับเงิน · หนังสือส่งมอบงาน
   ต้อง include assets/api.js ก่อน
   ══════════════════════════════════════════════════════════════ */
const DOCS = (function () {

  function mount(opt) {
    const host = opt.mountEl;
    const API_TYPE = opt.apiType;       // 'quotations' | 'receipts' | 'delivery-letters'
    const PREFIX = opt.prefix || '';    // 'PCC' | 'RC' | ...

    const panel = document.createElement('div');
    panel.className = 'docs';
    panel.innerHTML =
      '<div class="docs-hd">' +
      '<b>📁 ' + opt.title + 'ที่ทำไว้ (<span class="cnt">0</span>)</b>' +
      '<span class="save-state" aria-live="polite"></span>' +
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

    let list = [];
    let curId = null;
    let loading = false;
    let saving = false;         // กันกดบันทึกซ้ำระหว่างกำลังบันทึก
    let queuedSave = null;      // คิวบันทึกครั้งถัดไป (true = auto)
    let lastSavedId = null;
    let lastSavedJson = null;

    function esc(s){return String(s==null?'':s).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));}

    /* แจ้งเตือนแบบไม่ขัดจังหวะ — ไม่มี alert() ในเส้นทางบันทึก */
    function notify(msg, type, sub) {
      if (typeof TOAST !== 'undefined' && TOAST && typeof TOAST[type] === 'function') TOAST[type](msg, sub);
      else if (type === 'error') alert(sub ? msg + ': ' + sub : msg);
    }

    async function loadList() {
      loading = true;
      try {
        const res = await API.listDocs(API_TYPE);
        list = (res.items || []).map(r => ({
          id: r.id,
          updatedAt: r.updatedAt ? new Date(r.updatedAt).getTime() : Date.now(),
          data: r,
        }));
        // remove meta fields from data copy? keep full
        curId = list.length ? list[0].id : null;
      } catch (e) {
        console.error('loadList failed', e);
        list = [];
        curId = null;
      }
      loading = false;
    }

    function cur(){ return list.find(x=>x.id===curId) || null; }

    async function persist() { render(); }

    function setState(kind, text) {
      const el = panel.querySelector('.save-state');
      if (!el) return;
      clearTimeout(setState._t);
      el.textContent = text || '';
      el.className = 'save-state' + (kind ? ' ' + kind : '');
      if (kind === 'ok') {
        setState._t = setTimeout(() => { el.className = 'save-state'; el.textContent = ''; }, 2600);
      }
    }

    function markSaved(rec) {
      lastSavedId = rec ? rec.id : null;
      try { lastSavedJson = rec ? JSON.stringify(rec.data) : null; } catch (e) { lastSavedJson = null; }
    }

    async function save(silent) {
      if (saving) { queuedSave = queuedSave === false ? false : !silent; return; }
      const data = opt.collect();
      let json = null;
      try { json = JSON.stringify(data); } catch (e) {}
      const existing = cur();
      /* ไม่มีอะไรเปลี่ยน → ไม่ยิงเซิร์ฟเวอร์ซ้ำ แค่บอกว่าเซฟแล้ว */
      if (existing && existing.id === lastSavedId && json && json === lastSavedJson) {
        setState('ok', '✓ บันทึกแล้ว');
        if (!silent) notify('บันทึกแล้ว', 'success', 'ข้อมูลล่าสุดถูกเก็บไว้แล้ว');
        return;
      }
      saving = true;
      const now = Date.now();
      try {
        let rec = existing;
        if (!rec) {
          const r = await API.createDoc(API_TYPE, { docNo: (data[opt.noField||'docNo']||data.quoteNo||data.invNo||data.docNo||''), data });
          rec = { id: r.id, updatedAt: now, data };
          list.unshift(rec); curId = rec.id;
        } else {
          await API.updateDoc(API_TYPE, rec.id, { docNo: (data[opt.noField||'docNo']||data.quoteNo||data.invNo||data.docNo||''), data });
          rec.data = data; rec.updatedAt = now;
          list = list.filter(x=>x.id!==curId); list.unshift(rec);
        }
        markSaved(rec);
        setState('ok', '✓ บันทึกแล้ว');
        if (typeof opt.onSaved === 'function') opt.onSaved(rec);
        try { window.dispatchEvent(new CustomEvent('doc:saved', { detail: { ok: true, silent: !!silent } })); } catch (e) {}
        if (!silent) notify('บันทึกแล้ว', 'success', 'ข้อมูลถูกเก็บไว้บน Cloud');
      } catch (e) {
        console.error('save failed', e);
        setState('err', 'บันทึกไม่สำเร็จ');
        try { window.dispatchEvent(new CustomEvent('doc:saved', { detail: { ok: false, msg: e.message, silent: !!silent } })); } catch (e2) {}
        notify('บันทึกไม่สำเร็จ', 'error', e.message);
      } finally {
        saving = false;
        render();
        if (queuedSave !== null) { const q = queuedSave; queuedSave = null; save(q); }
      }
    }

    function scheduleSave() {
      clearTimeout(save._t);
      save._t = setTimeout(() => save(true), 700);
    }

    function render() {
      const box = panel.querySelector('.docs-list');
      panel.querySelector('.cnt').textContent = list.length;
      const q = (panel.querySelector('.docs-search').value || '').toLowerCase().trim();
      let show = list;
      if (q) show = list.filter(r => opt.searchText(r).toLowerCase().includes(q));
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

    async function open(id) {
      const rec = list.find(x => x.id === id);
      if (!rec) return;
      if (curId && curId !== id) await save(true);
      curId = id;
      opt.load(rec.data);
      markSaved(rec);
      render();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    async function del(id) {
      const rec = list.find(x => x.id === id);
      if (!rec) return;
      if (!confirm('ลบ ' + opt.summary(rec).no + ' ?\nการกระทำนี้ย้อนกลับไม่ได้')) return;
      try { await API.deleteDoc(API_TYPE, id); } catch (e) { notify('ลบไม่สำเร็จ', 'error', e.message); return; }
      list = list.filter(x => x.id !== id);
      if (curId === id) {
        curId = null;
        if (list.length) { curId = list[0].id; opt.load(list[0].data); markSaved(list[0]); }
        else { const d = await opt.blank(); const r = await API.createDoc(API_TYPE, { docNo: (d[opt.noField]||d.quoteNo||d.docNo||''), data: d }); const rec2 = { id: r.id, updatedAt: Date.now(), data: d }; list = [rec2]; curId = rec2.id; opt.load(d); markSaved(rec2); }
      }
      notify('ลบเอกสารแล้ว', 'success');
      render();
    }

    async function newDoc() {
      if (cur()) await save(true);
      const d = await opt.blank();
      try {
        const r = await API.createDoc(API_TYPE, { docNo: (d[opt.noField]||d.quoteNo||d.docNo||''), data: d });
        const rec = { id: r.id, updatedAt: Date.now(), data: d };
        list.unshift(rec); curId = rec.id;
        render(); opt.load(d);
        markSaved(rec);
        notify('สร้างใบใหม่แล้ว', 'success');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } catch (e) { notify('สร้างใบใหม่ไม่สำเร็จ', 'error', e.message); }
    }

    async function dup() {
      const c = cur();
      if (!c) return notify('ยังไม่มีใบให้ทำซ้ำ', 'info');
      const d = JSON.parse(JSON.stringify(c.data));
      const n = opt.nextNo ? await opt.nextNo(d) : null;
      if (n && opt.setNo) opt.setNo(d, n);
      try {
        const r = await API.createDoc(API_TYPE, { docNo: (d[opt.noField]||d.quoteNo||d.docNo||''), data: d });
        const rec = { id: r.id, updatedAt: Date.now(), data: d };
        list.unshift(rec); curId = rec.id;
        render(); opt.load(d);
        markSaved(rec);
        notify('ทำสำเนาใบใหม่แล้ว', 'success');
      } catch (e) { notify('ทำซ้ำไม่สำเร็จ', 'error', e.message); }
    }

    async function zip() {
      if (!list.length) return notify('ยังไม่มีเอกสารให้ส่งออก', 'info');
      if (!window.JSZip) return notify('โหลดไลบรารี ZIP ไม่สำเร็จ', 'warn', 'ต้องต่ออินเทอร์เน็ตครั้งแรกก่อน');
      // fetch full list already in memory
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
          f.file(opt.safeName(opt.summary(r).no) + '.json', JSON.stringify(o, null, 2));
        });
      });
      zip.file('README.txt', 'ส่งออก: ' + new Date().toLocaleString('th-TH') + '\nจำนวน: ' + list.length + ' ฉบับ\n');
      const blob = await zip.generateAsync({ type: 'blob' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = opt.title.replace(/\s+/g, '') + '_' + new Date().toISOString().slice(0, 10) + '.zip';
      a.click();
    }

    function safeName(s){return String(s||'doc').replace(/[\\/:*?"<>|]/g,'_').replace(/\s+/g,' ').trim().slice(0,80);}

    // events
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

    // init
    (async function init() {
      await loadList();
      if (list.length) {
        curId = curId || list[0].id;
        if (curId) {
          const rec = list.find(x => x.id === curId);
          if (rec) { opt.load(rec.data); markSaved(rec); }
        }
      } else {
        const d = await opt.blank();
        try {
          const r = await API.createDoc(API_TYPE, { docNo: (d[opt.noField]||d.quoteNo||d.docNo||''), data: d });
          const rec = { id: r.id, updatedAt: Date.now(), data: d };
          list = [rec]; curId = rec.id;
          opt.load(d);
          markSaved(rec);
        } catch (e) { console.error(e); }
      }
      render();
    })();

    function _push(rec) {
      // rec is {id, updatedAt, data}
      list = list.filter(x => x.id !== rec.id);
      list.unshift(rec);
      curId = rec.id;
      render();
      // also persist to server
      API.createDoc(API_TYPE, { id: rec.id, docNo: (rec.data[opt.noField]||rec.data.quoteNo||rec.data.docNo||''), data: rec.data })
        .catch(e => console.error('push failed', e));
    }

    async function addOne(d) {
      const rec = { id: 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2,4), updatedAt: Date.now(), data: d };
      _push(rec);
      if (typeof opt.load === 'function') opt.load(d);
    }
    return { save, scheduleSave, persist, render, list: () => list, currentId: () => curId, panel, _push, addOne,
             open, del, newDoc, dup };
  }

  return { mount };
})();
window.DOCS = DOCS;