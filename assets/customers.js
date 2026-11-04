/* ══════════════════════════════════════════════════════════════
   customers.js — ทะเบียนลูกค้า (เก็บบน Cloud D1)
   · เลือกลูกค้าเก่าได้จากใบเสนอราคา / ใบแจ้งหนี้ / ใบเสร็จ
   · จำข้อมูลลูกค้าอัตโนมัติเมื่อบันทึกเอกสาร
   · หน้าจัดการ: เพิ่ม / แก้ไข / ลบ / ค้นหา
   ต้อง include assets/api.js และ assets/toast.js ก่อน
   ══════════════════════════════════════════════════════════════ */
const CUSTOMERS = (function () {
  const CACHE_KEY = 'quota_customers_cache_v1';
  const FIELDS = ['name', 'address', 'taxId', 'contact', 'phone', 'email', 'project', 'note'];

  let list = [];
  let ready = null;
  let loadedOnce = false;
  const listeners = [];
  let rememberTimer = null;
  let pendingRemember = null;

  /* ── helpers ── */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  }
  function escAttr(s) {
    return esc(s).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function notify(msg, type, sub) {
    const t = (typeof TOAST !== 'undefined') ? TOAST : null;
    if (t && typeof t[type || 'success'] === 'function') t[type || 'success'](msg, sub);
    else if ((type || 'success') === 'error') alert(sub ? msg + ': ' + sub : msg);
  }
  function initial(name) {
    const s = String(name || '').trim();
    if (!s) return '?';
    const chars = Array.from(s);
    return chars[0].toUpperCase();
  }
  function userKey() {
    try {
      const u = API.getUser();
      return (u && u.email) ? String(u.email) : 'local';
    } catch (e) { return 'local'; }
  }
  function cacheKey() { return CACHE_KEY + ':' + userKey(); }
  function cacheRead() {
    try {
      const raw = localStorage.getItem(cacheKey());
      if (!raw) return [];
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    } catch (e) { return []; }
  }
  function cacheWrite() {
    try { localStorage.setItem(cacheKey(), JSON.stringify(list.slice(0, 300))); } catch (e) {}
  }
  function normalize(c) {
    const o = {};
    FIELDS.forEach(k => { o[k] = String(c && c[k] != null ? c[k] : ''); });
    o.id = (c && c.id) || '';
    return o;
  }
  function changed() {
    cacheWrite();
    listeners.forEach(fn => { try { fn(list.slice()); } catch (e) {} });
  }
  function listen(fn) {
    listeners.push(fn);
    return function () {
      const i = listeners.indexOf(fn);
      if (i >= 0) listeners.splice(i, 1);
    };
  }

  /* ── data ── */
  function ensure(force) {
    if (ready && !force) return ready;
    if (!loadedOnce) {
      const cached = cacheRead();
      if (cached.length) {
        list = cached.map(normalize);
        changed();
      }
    }
    ready = (async function () {
      try {
        const r = await API.listCustomers();
        list = (r.items || []).map(normalize);
        loadedOnce = true;
        changed();
      } catch (e) {
        console.warn('customers: load failed', e);
      }
      return list;
    })();
    return ready;
  }

  function upsertLocal(item) {
    const n = normalize(item);
    const i = list.findIndex(x => x.id === n.id);
    if (i >= 0) list[i] = n;
    else list.unshift(n);
    changed();
    return n;
  }

  async function save(payload) {
    const r = await API.createCustomer(payload);
    return upsertLocal(r.item);
  }

  async function update(id, payload) {
    const r = await API.updateCustomer(id, payload);
    return upsertLocal(r.item);
  }

  async function remove(id) {
    await API.deleteCustomer(id);
    list = list.filter(x => x.id !== id);
    changed();
  }

  function find(id) { return list.find(x => x.id === id) || null; }

  /* เรียกหลังบันทึกเอกสาร — เก็บ/อัปเดตลูกค้าอัตโนมัติ (เงียบ ๆ) */
  function rememberFromDoc(doc, map) {
    if (!doc || !map || !map.name) return;
    if (typeof API === 'undefined' || !API.isLoggedIn || !API.isLoggedIn()) return;
    const name = String(doc[map.name] || '').trim();
    if (!name) return;

    const payload = { name };
    ['address', 'taxId', 'contact', 'phone', 'email', 'project'].forEach(k => {
      const src = map[k];
      if (!src) return;
      const v = String(doc[src] == null ? '' : doc[src]).trim();
      if (v) payload[k] = v;
    });

    const cur = list.find(c => c.name.trim().toLowerCase() === name.toLowerCase());
    /* ข้อมูลไม่เปลี่ยน → ไม่ต้องยิงเซิร์ฟเวอร์ */
    if (cur && Object.keys(payload).every(k => k === 'name' || (cur[k] || '') === payload[k])) return;

    if (cur) Object.assign(cur, payload);   // อัปเดตใน cache ให้ตัวเลือกเห็นทันที
    changed();

    pendingRemember = payload;
    clearTimeout(rememberTimer);
    rememberTimer = setTimeout(function () {
      const p = pendingRemember;
      pendingRemember = null;
      if (!p) return;
      save(p).catch(e => console.warn('customers: remember failed', e));
    }, 1400);
  }

  /* ══════════════════════════════════════════════════════════
     ตัวเลือกลูกค้าเก่า
     opts: { label, currentName(), onPick(customer) }
     ══════════════════════════════════════════════════════════ */
  function attachPicker(host, opts) {
    if (!host) return null;
    opts = opts || {};

    const wrap = document.createElement('div');
    wrap.className = 'cust-pick';
    wrap.innerHTML =
      '<button type="button" class="cust-btn" aria-haspopup="listbox" aria-expanded="false" ' +
        'title="เลือกจากรายชื่อลูกค้าที่เคยทำเอกสารไว้">' +
        '<span class="cust-btn-ic">👥</span>' +
        '<span class="cust-btn-tx">' + esc(opts.label || 'เลือกลูกค้าเก่า') + '</span>' +
        '<span class="cust-cnt">0</span>' +
        '<span class="cust-ar">▾</span>' +
      '</button>' +
      '<button type="button" class="cust-mng" title="เพิ่ม / แก้ไข / ลบรายชื่อลูกค้า">จัดการ</button>' +
      '<div class="cust-drop" hidden>' +
        '<div class="cust-drop-hd">' +
          '<input class="cust-q" type="search" placeholder="ค้นหาชื่อลูกค้า / ที่อยู่ / โครงการ...">' +
          '<button type="button" class="cust-add">＋ ลูกค้าใหม่</button>' +
        '</div>' +
        '<div class="cust-rows" role="listbox"></div>' +
        '<div class="cust-drop-ft"><span>คลิกเพื่อใช้ข้อมูลลูกค้า</span><span class="cust-total"></span></div>' +
      '</div>';
    host.appendChild(wrap);

    const btn = wrap.querySelector('.cust-btn');
    const drop = wrap.querySelector('.cust-drop');
    const q = wrap.querySelector('.cust-q');
    const rows = wrap.querySelector('.cust-rows');
    const cnt = wrap.querySelector('.cust-cnt');
    const total = wrap.querySelector('.cust-total');
    let open = false;

    function setOpen(v) {
      open = !!v;
      drop.hidden = !open;
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (open) {
        q.value = '';
        renderRows('');
        setTimeout(() => { try { q.focus(); } catch (e) {} }, 30);
      }
    }

    function renderRows(filter) {
      cnt.textContent = list.length;
      total.textContent = list.length ? (list.length + ' รายชื่อ') : '';
      const f = String(filter || '').trim().toLowerCase();
      let arr = list;
      if (f) {
        arr = list.filter(c =>
          [c.name, c.address, c.project, c.taxId, c.contact, c.phone, c.email]
            .join(' ').toLowerCase().includes(f)
        );
      }
      if (!arr.length) {
        rows.innerHTML = '<div class="cust-empty">' + (list.length
          ? 'ไม่พบลูกค้าที่ค้นหา'
          : 'ยังไม่มีลูกค้าเก่า<br>กรอกชื่อลูกค้าในใบแล้วบันทึก ระบบจะเก็บให้อัตโนมัติ') + '</div>';
        return;
      }
      const curName = String((typeof opts.currentName === 'function' && opts.currentName()) || '').trim().toLowerCase();
      rows.innerHTML = arr.map(function (c) {
        const on = curName && c.name.trim().toLowerCase() === curName;
        const sub = [c.address, c.project, c.taxId ? 'เลขภาษี ' + c.taxId : '']
          .filter(Boolean).join(' · ');
        return '<button type="button" class="cust-row' + (on ? ' on' : '') + '" data-id="' + escAttr(c.id) + '" role="option">' +
          '<span class="cust-av">' + esc(initial(c.name)) + '</span>' +
          '<span class="cust-inf"><b>' + esc(c.name) + '</b><small>' + esc(sub || '—') + '</small></span>' +
          '<span class="cust-pick-ic">ใช้ ›</span>' +
          '</button>';
      }).join('');
    }

    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      setOpen(!open);
    });
    q.addEventListener('input', function () { renderRows(q.value); });
    q.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        const first = rows.querySelector('.cust-row');
        if (first) first.click();
      }
    });
    rows.addEventListener('click', function (e) {
      const row = e.target.closest('.cust-row');
      if (!row) return;
      const c = find(row.dataset.id);
      if (!c) return;
      if (typeof opts.onPick === 'function') opts.onPick(c);
      setOpen(false);
      notify('ใช้ข้อมูลลูกค้าแล้ว', 'success', c.name);
    });

    wrap.querySelector('.cust-add').addEventListener('click', function () {
      setOpen(false);
      openManager({
        create: true,
        prefillName: (typeof opts.currentName === 'function' && opts.currentName()) || '',
        onSaved: function (c) { if (typeof opts.onPick === 'function') opts.onPick(c); }
      });
    });
    wrap.querySelector('.cust-mng').addEventListener('click', function () {
      setOpen(false);
      openManager({});
    });

    document.addEventListener('click', function (e) {
      if (open && !wrap.contains(e.target)) setOpen(false);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && open) setOpen(false);
    });

    const off = listen(function () { renderRows(open ? q.value : ''); });
    ensure().then(function () { renderRows(''); });

    return {
      el: wrap,
      refresh: function () { renderRows(open ? q.value : ''); },
      close: function () { setOpen(false); },
      destroy: function () { off(); setOpen(false); wrap.remove(); }
    };
  }

  /* ══════════════════════════════════════════════════════════
     หน้าจัดการทะเบียนลูกค้า
     ══════════════════════════════════════════════════════════ */
  let mgrOpts = {};
  let mgrQuery = '';
  let mgrView = 'list';

  function buildManager() {
    if (document.getElementById('custOverlay')) return;
    const ov = document.createElement('div');
    ov.className = 'x-overlay';
    ov.id = 'custOverlay';
    ov.innerHTML =
      '<div class="x-modal wide" role="dialog" aria-label="ทะเบียนลูกค้า">' +
        '<div class="x-modal-hd"><h3>👥 ทะเบียนลูกค้า</h3>' +
          '<button type="button" class="x-close" data-cclose="1" aria-label="ปิด">&times;</button></div>' +
        '<div class="x-modal-bd" id="custMgrBody"></div>' +
        '<div class="x-modal-ft" id="custMgrFoot"></div>' +
      '</div>';
    document.body.appendChild(ov);

    ov.addEventListener('click', function (e) { if (e.target === ov) closeManager(); });
    ov.querySelector('[data-cclose]').addEventListener('click', closeManager);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && ov.classList.contains('open')) closeManager();
    });
  }

  function closeManager() {
    const ov = document.getElementById('custOverlay');
    if (ov) ov.classList.remove('open');
    mgrOpts = {};
    mgrView = 'list';
  }

  function openManager(opts) {
    opts = opts || {};
    mgrOpts = opts;
    buildManager();
    const ov = document.getElementById('custOverlay');
    ov.classList.add('open');
    mgrQuery = '';

    if (opts.create) {
      showForm({ name: opts.prefillName || '' });
      ensure();
    } else {
      showList();
      ensure().then(function () {
        if (ov.classList.contains('open') && mgrView === 'list') showList();
      });
    }
  }

  function mgrEls() {
    const ov = document.getElementById('custOverlay');
    return {
      ov: ov,
      body: ov.querySelector('#custMgrBody'),
      foot: ov.querySelector('#custMgrFoot')
    };
  }

  function renderMgrRows() {
    const box = document.getElementById('custMgrList');
    const count = document.getElementById('custMgrCount');
    if (!box) return;
    const f = mgrQuery.trim().toLowerCase();
    let arr = list;
    if (f) {
      arr = list.filter(c =>
        [c.name, c.address, c.project, c.taxId, c.contact, c.phone, c.email]
          .join(' ').toLowerCase().includes(f)
      );
    }
    if (count) count.textContent = list.length ? (list.length + ' รายชื่อ · แสดง ' + arr.length) : 'ยังไม่มีลูกค้า';
    if (!arr.length) {
      box.innerHTML = '<div class="cust-empty">' + (list.length
        ? 'ไม่พบลูกค้าที่ค้นหา'
        : 'ยังไม่มีรายชื่อลูกค้า<br>กด “＋ เพิ่มลูกค้า” หรือบันทึกเอกสารที่มีชื่อลูกค้า ระบบจะเก็บให้อัตโนมัติ') + '</div>';
      return;
    }
    box.innerHTML = arr.map(function (c) {
      const sub = [c.address, c.project, c.phone || c.contact, c.taxId ? 'เลขภาษี ' + c.taxId : '']
        .filter(Boolean).join(' · ');
      return '<div class="cust-mgr-row">' +
        '<span class="cust-av">' + esc(initial(c.name)) + '</span>' +
        '<span class="cust-inf"><b>' + esc(c.name || '(ไม่มีชื่อ)') + '</b>' +
          '<small>' + esc(sub || '—') + '</small></span>' +
        '<span class="cust-mgr-act">' +
          '<button type="button" data-cact="edit" data-id="' + escAttr(c.id) + '">แก้ไข</button>' +
          '<button type="button" class="d" data-cact="del" data-id="' + escAttr(c.id) + '">ลบ</button>' +
        '</span>' +
      '</div>';
    }).join('');
  }

  function showList() {
    const e = mgrEls();
    if (!e.body) return;
    mgrView = 'list';
    e.body.innerHTML =
      '<div class="cust-mgr-bar">' +
        '<input id="custMgrQ" type="search" placeholder="ค้นหาชื่อ / ที่อยู่ / โครงการ..." value="' + escAttr(mgrQuery) + '">' +
        '<button type="button" class="x-btn ok" id="custMgrNew">＋ เพิ่มลูกค้า</button>' +
      '</div>' +
      '<div class="cust-mgr-list" id="custMgrList"></div>';
    e.foot.innerHTML =
      '<span id="custMgrCount" style="flex:1;font-size:11.5px;color:#6b7280">—</span>' +
      '<button type="button" class="x-btn" data-cdone="1">ปิด</button>';

    const qi = e.body.querySelector('#custMgrQ');
    qi.addEventListener('input', function () { mgrQuery = qi.value; renderMgrRows(); });
    e.body.querySelector('#custMgrNew').addEventListener('click', function () {
      showForm({ name: '' });
    });
    e.foot.querySelector('[data-cdone]').addEventListener('click', closeManager);

    e.body.querySelector('#custMgrList').addEventListener('click', function (ev) {
      const b = ev.target.closest('[data-cact]');
      if (!b) return;
      const c = find(b.dataset.id);
      if (!c) return;
      if (b.dataset.cact === 'edit') showForm(c);
      if (b.dataset.cact === 'del') deleteCustomer(c);
    });

    renderMgrRows();
  }

  function showForm(c) {
    const e = mgrEls();
    if (!e.body) return;
    mgrView = 'form';
    const isNew = !c || !c.id;
    const d = normalize(c || {});
    if (isNew && !d.name) d.name = '';

    e.body.innerHTML =
      '<div class="cust-form">' +
        '<div class="x-field"><label>ชื่อลูกค้า / บริษัท <span style="color:#dc2626">*</span></label>' +
          '<input type="text" id="cfName" value="' + escAttr(d.name) + '" placeholder="บริษัท ตัวอย่าง จำกัด" autocomplete="organization"></div>' +
        '<div class="x-field"><label>ที่อยู่ <span class="hint">(ใช้เติมในเอกสาร)</span></label>' +
          '<textarea id="cfAddr" rows="2" placeholder="ที่อยู่ จังหวัด รหัสไปรษณีย์">' + esc(d.address) + '</textarea></div>' +
        '<div class="x-row2">' +
          '<div class="x-field"><label>เลขประจำตัวผู้เสียภาษี</label>' +
            '<input type="text" id="cfTax" value="' + escAttr(d.taxId) + '" placeholder="0-0000-00000-00-0"></div>' +
          '<div class="x-field"><label>ชื่อผู้ติดต่อ</label>' +
            '<input type="text" id="cfContact" value="' + escAttr(d.contact) + '" placeholder="ชื่อ-นามสกุล"></div>' +
        '</div>' +
        '<div class="x-row2">' +
          '<div class="x-field"><label>โทรศัพท์</label>' +
            '<input type="tel" id="cfPhone" value="' + escAttr(d.phone) + '" placeholder="0xx-xxx-xxxx"></div>' +
          '<div class="x-field"><label>อีเมล</label>' +
            '<input type="email" id="cfEmail" value="' + escAttr(d.email) + '" placeholder="name@example.com"></div>' +
        '</div>' +
        '<div class="x-field"><label>โครงการ / งานล่าสุด</label>' +
          '<input type="text" id="cfProject" value="' + escAttr(d.project) + '" placeholder="ชื่อโครงการ (ไม่บังคับ)"></div>' +
        '<div class="x-field"><label>บันทึกเพิ่มเติม</label>' +
          '<textarea id="cfNote" rows="2" placeholder="รายละเอียดอื่น ๆ เช่น เงื่อนไขการชำระเงิน">' + esc(d.note) + '</textarea></div>' +
        '<div class="x-note">ข้อมูลนี้จะถูกใช้เติมอัตโนมัติเมื่อเลือกลูกค้าในเอกสาร — แก้ไขแล้วมีผลกับเอกสารใหม่ ไม่ย้อนหลัง</div>' +
      '</div>';

    e.foot.innerHTML =
      (isNew ? '' : '<button type="button" class="x-btn danger" id="cfDel">ลบลูกค้า</button>') +
      '<span style="flex:1"></span>' +
      '<button type="button" class="x-btn" id="cfCancel">← กลับ</button>' +
      '<button type="button" class="x-btn ok" id="cfSave">บันทึก</button>';

    const nameEl = e.body.querySelector('#cfName');
    setTimeout(function () { try { nameEl.focus(); } catch (err) {} }, 40);

    e.foot.querySelector('#cfCancel').addEventListener('click', showList);
    if (!isNew) {
      e.foot.querySelector('#cfDel').addEventListener('click', function () { deleteCustomer(d); });
    }
    e.foot.querySelector('#cfSave').addEventListener('click', async function () {
      const payload = {
        name: e.body.querySelector('#cfName').value.trim(),
        address: e.body.querySelector('#cfAddr').value.trim(),
        taxId: e.body.querySelector('#cfTax').value.trim(),
        contact: e.body.querySelector('#cfContact').value.trim(),
        phone: e.body.querySelector('#cfPhone').value.trim(),
        email: e.body.querySelector('#cfEmail').value.trim(),
        project: e.body.querySelector('#cfProject').value.trim(),
        note: e.body.querySelector('#cfNote').value.trim()
      };
      if (!payload.name) { notify('กรุณากรอกชื่อลูกค้า', 'warn'); nameEl.focus(); return; }
      const btn = e.foot.querySelector('#cfSave');
      btn.disabled = true;
      btn.textContent = 'กำลังบันทึก...';
      try {
        const item = isNew ? await save(payload) : await update(d.id, payload);
        notify(isNew ? 'เพิ่มลูกค้าแล้ว' : 'บันทึกข้อมูลลูกค้าแล้ว', 'success', item.name);
        if (typeof mgrOpts.onSaved === 'function') {
          const cb = mgrOpts.onSaved;
          closeManager();
          cb(item);
        } else {
          showList();
        }
      } catch (err) {
        notify('บันทึกไม่สำเร็จ', 'error', err.message);
        btn.disabled = false;
        btn.textContent = 'บันทึก';
      }
    });
  }

  async function deleteCustomer(c) {
    if (!confirm('ลบลูกค้า “' + (c.name || '') + '” ?\nรายชื่อจะหายจากทะเบียน แต่เอกสารเดิมไม่ได้รับผลกระทบ')) return;
    try {
      await remove(c.id);
      notify('ลบลูกค้าแล้ว', 'success', c.name);
      showList();
    } catch (e) {
      notify('ลบไม่สำเร็จ', 'error', e.message);
    }
  }

  return {
    ensure,
    list: function () { return list.slice(); },
    find,
    save,
    update,
    remove,
    rememberFromDoc,
    attachPicker,
    openManager,
    onChange: listen,
    _showList: showList
  };
})();
window.CUSTOMERS = CUSTOMERS;
